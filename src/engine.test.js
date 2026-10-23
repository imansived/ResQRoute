import test from 'node:test'
import assert from 'node:assert/strict'
import { approveDispatchPlan, assertNetworkInvariants, assertQuantityInvariant, canMeetDeadline, closeShelterAndRevalidate, expireReservation, generateDispatchPlan, runScenario, transitionShipment, validateAllocation } from './engine.js'
import { hydrateState, seedState } from './data.js'

const baseNow = new Date('2026-10-23T09:00:00.000Z')

test('deadline feasibility includes handling and safety buffer', () => {
  const safe = canMeetDeadline({ now: baseNow, safeDeadline: '2026-10-23T09:40:00.000Z', pickupMinutes: 10, deliveryMinutes: 12, handoffMinutes: 5, bufferMinutes: 10 })
  assert.equal(safe.required, 37)
  assert.equal(safe.feasible, true)
  const unsafe = canMeetDeadline({ now: baseNow, safeDeadline: '2026-10-23T09:35:00.000Z', pickupMinutes: 10, deliveryMinutes: 12, handoffMinutes: 5, bufferMinutes: 10 })
  assert.equal(unsafe.feasible, false)
})

test('allocation validation rejects capacity, demand, and missing dependencies', () => {
  const result = validateAllocation({
    now: baseNow,
    donation: { status: 'READY', availableQuantity: 40, itemType: 'Ration kits', dependencies: ['Water', 'Fuel'], safeDeadline: '2026-10-23T12:00:00.000Z' },
    shelter: { status: 'OPEN', remainingDemand: 10, intakeCapacity: 10, activeInbound: 0, accepts: ['Ration kits'], resources: ['Water'] },
    rider: { availability: 'AVAILABLE', maxCapacity: 8, activeLoad: 0 },
    quantity: 12,
  })
  assert.equal(result.feasible, false)
  assert.match(result.errors.join(' '), /capacity/i)
  assert.match(result.errors.join(' '), /demand/i)
  assert.match(result.errors.join(' '), /Fuel/i)
})

test('dispatch splits across feasible riders and shelters and reports residuals', () => {
  const donations = [{ id: 'B', itemType: 'Prepared meals', quantity: 180, availableQuantity: 180, status: 'READY', unit: 'meals', safeDeadline: '2026-10-23T14:00:00.000Z', dependencies: [] }]
  const shelters = [
    { id: 'S1', status: 'OPEN', remainingDemand: 50, intakeCapacity: 50, activeInbound: 0, accepts: ['Prepared meals'], resources: [], fallbackCount: 1 },
    { id: 'S2', status: 'OPEN', remainingDemand: 70, intakeCapacity: 70, activeInbound: 0, accepts: ['Prepared meals'], resources: [], fallbackCount: 1 },
  ]
  const riders = [40, 40, 40].map((capacity, index) => ({ id: `R${index}`, name: `Rider ${index}`, availability: 'AVAILABLE', maxCapacity: capacity, activeLoad: 0, reliability: .9 }))
  const result = generateDispatchPlan({ donations, shelters, riders, now: baseNow })
  assert.equal(result.plans.reduce((sum, plan) => sum + plan.quantity, 0), 120)
  assert.equal(result.residuals[0].quantity, 60)
  assert.ok(result.plans.every((plan) => plan.quantity <= 40))
})

test('shipment state machine rejects stale transitions', () => {
  assert.equal(transitionShipment({ status: 'RESERVED' }, 'ACCEPTED').status, 'ACCEPTED')
  assert.throws(() => transitionShipment({ status: 'DELIVERED' }, 'IN_TRANSIT'), /Invalid transition/)
})

test('quantity conservation assertion catches duplicate allocation', () => {
  const donation = { id: 'B', quantity: 20, availableQuantity: 0, completedQuantity: 0 }
  assert.equal(assertQuantityInvariant({ donation, shipments: [{ donationId: 'B', quantity: 20, status: 'RESERVED' }] }), true)
  assert.equal(assertQuantityInvariant({ donation, shipments: [{ donationId: 'B', quantity: 20, status: 'RESERVED' }, { donationId: 'B', quantity: 2, status: 'RESERVED' }] }), false)
})

test('seeded baseline is internally consistent before dispatch', () => {
  const state = seedState()
  const result = assertNetworkInvariants(state)
  assert.equal(result.valid, true, result.errors.join('; '))
})

test('seeded 180-meal dispatch rejects unsupported riders and reports residual reasons', () => {
  const state = seedState()
  const result = generateDispatchPlan({ donations: state.donations, shelters: state.shelters, riders: state.riders, now: new Date() })
  const mealPlans = result.plans.filter((plan) => plan.donationId === 'BAT-0180')
  assert.ok(mealPlans.length > 0)
  assert.ok(mealPlans.every((plan) => plan.quantity <= 40))
  assert.ok(result.rejections.some((rejection) => rejection.donationId === 'BAT-0180' && rejection.reasons.some((reason) => /support/i.test(reason))))
  assert.ok(result.residuals.every((residual) => residual.reasons.length > 0))
})

test('approval is atomic and idempotent', () => {
  const state = seedState()
  const result = generateDispatchPlan({ donations: state.donations, shelters: state.shelters, riders: state.riders, now: new Date() })
  const planned = { ...state, plans: result.plans.map((plan, index) => ({ ...plan, id: `PLAN-${index}`, status: 'PROPOSED' })) }
  const first = approveDispatchPlan(planned, 'PLAN-0', new Date())
  assert.equal(first.ok, true)
  assert.equal(assertNetworkInvariants(first.state).valid, true)
  const second = approveDispatchPlan(first.state, 'PLAN-0', new Date())
  assert.equal(second.ok, false)
  assert.equal(second.idempotent, true)
  assert.equal(first.state.shipments.length, state.shipments.length + 1)
})

test('infeasible plan cannot be approved after state changes', () => {
  const state = seedState()
  const result = generateDispatchPlan({ donations: state.donations, shelters: state.shelters, riders: state.riders, now: new Date() })
  const plan = { ...result.plans[0], id: 'PLAN-STALE', status: 'PROPOSED' }
  const stale = { ...state, plans: [plan], riders: state.riders.map((rider) => rider.id === plan.riderId ? { ...rider, availability: 'UNAVAILABLE' } : rider) }
  const approved = approveDispatchPlan(stale, plan.id, new Date())
  assert.equal(approved.ok, false)
  assert.match(approved.errors.join(' '), /available/i)
})

test('reservation expiry releases quantity once and preserves invariants', () => {
  const state = seedState()
  const result = generateDispatchPlan({ donations: state.donations, shelters: state.shelters, riders: state.riders, now: new Date() })
  const planned = { ...state, plans: result.plans.map((plan, index) => ({ ...plan, id: `PLAN-${index}`, status: 'PROPOSED' })) }
  const approved = approveDispatchPlan(planned, 'PLAN-0', new Date())
  assert.equal(approved.ok, true)
  const expired = expireReservation(approved.state, approved.shipment.id, new Date())
  assert.equal(expired.ok, true)
  assert.equal(expired.shipment.status, 'EXPIRED')
  assert.equal(assertNetworkInvariants(expired.state).valid, true)
  const repeated = expireReservation(expired.state, approved.shipment.id, new Date())
  assert.equal(repeated.ok, false)
  assert.equal(repeated.idempotent, true)
})

test('closing a shelter creates reroute proposal or recovery-required state', () => {
  const state = seedState()
  const result = closeShelterAndRevalidate(state, 'S-01', new Date())
  assert.equal(result.ok, true)
  assert.equal(result.state.shelters.find((shelter) => shelter.id === 'S-01').status, 'CLOSED')
  const affected = result.state.shipments.find((shipment) => shipment.id === 'SHP-2408')
  assert.ok(['REROUTE_PENDING', 'RECOVERY_REQUIRED'].includes(affected.status))
  assert.ok(affected.timeline[0].detail.includes('closed'))
})

test('invalid persisted state is replaced by a known-good baseline', () => {
  const hydrated = hydrateState({ donations: [{ id: 'bad', quantity: 4, availableQuantity: -1, completedQuantity: 0 }] })
  assert.equal(hydrated.recovered, true)
  assert.equal(assertNetworkInvariants(hydrated.state).valid, true)
})

test('all eight simulation scenarios mutate real domain state', () => {
  const ids = ['oversized', 'ghost', 'closure', 'dependency', 'deadline', 'claims', 'rider-failure', 'no-fallback']
  for (const scenarioId of ids) {
    const result = runScenario({}, scenarioId, baseNow)
    assert.ok(result.state, `${scenarioId} returned no state`)
    assert.ok(result.summary, `${scenarioId} returned no summary`)
    assert.ok(result.checks.length > 0, `${scenarioId} returned no checks`)
    if (scenarioId === 'oversized') assert.ok(result.state.plans.length > 0)
    if (scenarioId === 'ghost') assert.equal(result.state.shipments[0].status, 'EXPIRED')
    if (scenarioId === 'closure') assert.equal(result.state.shipments[0].status, 'REROUTE_PENDING')
    if (scenarioId === 'dependency') assert.ok(result.state.rejections.some((item) => item.reasons.some((reason) => /dependency|resource/i.test(reason))))
    if (scenarioId === 'deadline') assert.equal(result.state.plans.length, 0)
    if (scenarioId === 'claims') assert.equal(result.state.shipments.length, 1)
    if (scenarioId === 'rider-failure') assert.equal(result.state.shipments[0].status, 'REROUTE_PENDING')
    if (scenarioId === 'no-fallback') assert.equal(result.state.shipments[0].status, 'RECOVERY_REQUIRED')
  }
})
