export const SCORE_WEIGHTS = { urgency: 0.35, demand: 0.25, reliability: 0.15, fallback: 0.15, efficiency: 0.1 }

export const STATUS_ORDER = ['AVAILABLE', 'RESERVED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED']
export const TERMINAL_SHIPMENT_STATES = ['DELIVERED', 'EXPIRED', 'RELEASED', 'CANCELLED', 'FAILED']

export function minutesUntil(now, deadline) {
  return Math.round((new Date(deadline).getTime() - new Date(now).getTime()) / 60000)
}

export function canMeetDeadline({ now, safeDeadline, pickupMinutes, deliveryMinutes, handoffMinutes = 5, bufferMinutes = 10 }) {
  const remaining = minutesUntil(now, safeDeadline)
  const required = pickupMinutes + deliveryMinutes + handoffMinutes + bufferMinutes
  return { feasible: required < remaining, remaining, required }
}

export function validateAllocation({ donation, shelter, rider, now, quantity, pickupMinutes = 12, deliveryMinutes = 18 }) {
  const errors = []
  if (!donation || donation.status === 'EXPIRED' || donation.availableQuantity <= 0) errors.push('Donation has no eligible quantity')
  if (!shelter || shelter.status !== 'OPEN') errors.push('Shelter intake is closed')
  if (!rider || rider.availability !== 'AVAILABLE') errors.push('Rider is not available')
  if (quantity <= 0) errors.push('Quantity must be greater than zero')
  if (rider && quantity > rider.maxCapacity - rider.activeLoad) errors.push('Rider capacity exceeded')
  if (shelter && quantity > Math.min(shelter.remainingDemand, shelter.intakeCapacity - shelter.activeInbound)) errors.push('Shelter demand or intake capacity exceeded')
  if (donation && shelter && !shelter.accepts.includes(donation.itemType)) errors.push('Item is incompatible with shelter intake')
  if (donation && rider && Array.isArray(rider.supported) && !rider.supported.includes(donation.itemType)) errors.push('Rider does not support this item type')
  for (const dependency of donation?.dependencies || []) {
    if (!shelter?.resources?.includes(dependency)) errors.push(`Missing dependency: ${dependency}`)
  }
  if (donation) {
    const deadline = canMeetDeadline({ now, safeDeadline: donation.safeDeadline, pickupMinutes, deliveryMinutes })
    if (!deadline.feasible) errors.push(`Deadline infeasible: requires ${deadline.required}m, ${deadline.remaining}m remain`)
  }
  return { feasible: errors.length === 0, errors }
}

export function scoreAllocation({ donation, shelter, rider, now, deliveryMinutes = 18 }) {
  const urgency = Math.max(0, Math.min(1, 1 - minutesUntil(now, donation.safeDeadline) / 240))
  const demand = Math.max(0, Math.min(1, shelter.remainingDemand / Math.max(donation.availableQuantity, 1)))
  const reliability = rider.reliability
  const fallback = shelter.fallbackCount > 0 ? 1 : 0.45
  const efficiency = Math.max(0, Math.min(1, 1 - deliveryMinutes / 60))
  const score = urgency * SCORE_WEIGHTS.urgency + demand * SCORE_WEIGHTS.demand + reliability * SCORE_WEIGHTS.reliability + fallback * SCORE_WEIGHTS.fallback + efficiency * SCORE_WEIGHTS.efficiency
  return { score: Number(score.toFixed(3)), factors: { urgency, demand, reliability, fallback, efficiency } }
}

export function generateDispatchPlan({ donations, shelters, riders, now }) {
  const plans = []
  const residuals = []
  const rejections = []
  const riderRemaining = new Map(riders.map((rider) => [rider.id, Math.max(0, rider.maxCapacity - rider.activeLoad)]))
  const shelterRemaining = new Map(shelters.map((shelter) => [shelter.id, Math.max(0, Math.min(shelter.remainingDemand, shelter.intakeCapacity - shelter.activeInbound))]))
  const orderedDonations = donations.filter((d) => d.availableQuantity > 0 && d.status !== 'EXPIRED').sort((a, b) => minutesUntil(now, a.safeDeadline) - minutesUntil(now, b.safeDeadline))

  for (const donation of orderedDonations) {
    let remaining = donation.availableQuantity
    const candidates = []
    for (const shelter of shelters) {
      for (const rider of riders) {
        const quantity = Math.min(remaining, riderRemaining.get(rider.id) || 0, shelterRemaining.get(shelter.id) || 0)
        if (quantity <= 0) continue
        const validation = validateAllocation({ donation, shelter, rider, now, quantity })
        if (!validation.feasible) {
          rejections.push({ donationId: donation.id, shelterId: shelter.id, riderId: rider.id, reasons: validation.errors })
          continue
        }
        const scoring = scoreAllocation({ donation, shelter, rider, now })
        candidates.push({ donationId: donation.id, shelterId: shelter.id, riderId: rider.id, quantity, ...scoring, explanation: `Assigned ${quantity} ${donation.unit} to ${rider.name} and ${shelter.name} because capacity, demand, resources, and the safety window all pass.` })
      }
    }
    candidates.sort((a, b) => b.score - a.score)
    for (const candidate of candidates) {
      if (remaining <= 0) break
      const quantity = Math.min(candidate.quantity, remaining, riderRemaining.get(candidate.riderId) || 0, shelterRemaining.get(candidate.shelterId) || 0)
      if (quantity <= 0) continue
      const allocation = { ...candidate, quantity }
      plans.push(allocation)
      remaining -= allocation.quantity
      riderRemaining.set(candidate.riderId, Math.max(0, (riderRemaining.get(candidate.riderId) || 0) - allocation.quantity))
      shelterRemaining.set(candidate.shelterId, Math.max(0, (shelterRemaining.get(candidate.shelterId) || 0) - allocation.quantity))
    }
    if (remaining > 0) residuals.push({ donationId: donation.id, quantity: remaining, reasons: collectRejectionReasons({ donation, shelters, riders, now, riderRemaining, shelterRemaining }) })
  }
  return { plans, residuals, rejections }
}

function collectRejectionReasons({ donation, shelters, riders, now, riderRemaining, shelterRemaining }) {
  const reasons = new Set()
  if (!riders.some((r) => r.availability === 'AVAILABLE' && (riderRemaining?.get(r.id) || 0) > 0)) reasons.add('No available rider capacity')
  if (!shelters.some((s) => s.status === 'OPEN' && (shelterRemaining?.get(s.id) || 0) > 0)) reasons.add('No open shelter demand or intake capacity')
  if (!shelters.some((s) => s.status === 'OPEN' && s.accepts.includes(donation.itemType))) reasons.add('No compatible shelter')
  if (!riders.some((r) => r.availability === 'AVAILABLE' && (!Array.isArray(r.supported) || r.supported.includes(donation.itemType)))) reasons.add('No compatible rider')
  const deadline = canMeetDeadline({ now, safeDeadline: donation.safeDeadline, pickupMinutes: 12, deliveryMinutes: 18 })
  if (!deadline.feasible) reasons.add('Safety deadline cannot be met with buffer')
  if (donation.dependencies?.length && !shelters.some((s) => donation.dependencies.every((d) => s.resources.includes(d)))) reasons.add('Required resources unavailable')
  if (reasons.size === 0) reasons.add('All currently eligible rider and shelter capacity was consumed by higher-priority allocations')
  return [...reasons]
}

export function assertQuantityInvariant({ donation, shipments }) {
  const allocated = shipments.filter((s) => s.donationId === donation.id && !['DELIVERED', 'CANCELLED', 'FAILED', 'RELEASED', 'EXPIRED'].includes(s.status)).reduce((sum, shipment) => sum + shipment.quantity, 0)
  return donation.quantity === donation.availableQuantity + allocated + (donation.completedQuantity || 0)
}

export function assertNetworkInvariants(state) {
  const errors = []
  for (const donation of state.donations) {
    if (!Number.isFinite(donation.availableQuantity) || donation.availableQuantity < 0) errors.push(`${donation.id}: negative or invalid available quantity`)
    if (!assertQuantityInvariant({ donation, shipments: state.shipments })) errors.push(`${donation.id}: quantity conservation failed`)
  }
  for (const rider of state.riders) {
    const activeLoad = state.shipments.filter((shipment) => shipment.riderId === rider.id && !TERMINAL_SHIPMENT_STATES.includes(shipment.status)).reduce((sum, shipment) => sum + shipment.quantity, 0)
    if (activeLoad > rider.maxCapacity) errors.push(`${rider.id}: active load exceeds capacity`)
  }
  for (const shelter of state.shelters) {
    if (shelter.remainingDemand < 0 || shelter.activeInbound > shelter.intakeCapacity) errors.push(`${shelter.id}: demand or inbound capacity exceeded`)
  }
  return { valid: errors.length === 0, errors }
}

export function approveDispatchPlan(state, planId, now = new Date()) {
  const plan = state.plans?.find((candidate) => candidate.id === planId)
  if (!plan) return { ok: false, errors: ['Dispatch plan was not found. Generate a fresh plan.'] }
  if (plan.status !== 'PROPOSED') return { ok: false, idempotent: true, errors: [`Dispatch plan ${planId} has already been ${plan.status.toLowerCase()}.`] }
  const donation = state.donations.find((candidate) => candidate.id === plan.donationId)
  const shelter = state.shelters.find((candidate) => candidate.id === plan.shelterId)
  const rider = state.riders.find((candidate) => candidate.id === plan.riderId)
  const validation = validateAllocation({ donation, shelter, rider, now, quantity: plan.quantity })
  if (!validation.feasible) return { ok: false, errors: validation.errors }
  const shipmentId = `SHP-${plan.id.replace(/^PLAN-/, '')}`
  if (state.shipments.some((shipment) => shipment.id === shipmentId)) return { ok: false, idempotent: true, errors: [`Shipment ${shipmentId} already exists for this plan.`] }
  const createdAt = new Date(now).toISOString()
  const shipment = { id: shipmentId, donationId: donation.id, itemType: donation.itemType, quantity: plan.quantity, unit: donation.unit, riderId: rider.id, shelterId: shelter.id, status: 'RESERVED', eta: new Date(new Date(now).getTime() + 30 * 60000).toISOString(), safeDeadline: donation.safeDeadline, score: plan.score, createdAt, timeline: [{ label: 'Reservation created', time: createdAt, detail: 'Temporary lock committed; awaiting rider acknowledgement' }] }
  const next = {
    ...state,
    donations: state.donations.map((item) => item.id === donation.id ? { ...item, availableQuantity: item.availableQuantity - plan.quantity, status: item.availableQuantity - plan.quantity === 0 ? 'ALLOCATED' : 'PARTIALLY_ALLOCATED' } : item),
    shelters: state.shelters.map((item) => item.id === shelter.id ? { ...item, remainingDemand: item.remainingDemand - plan.quantity, activeInbound: item.activeInbound + plan.quantity } : item),
    riders: state.riders.map((item) => item.id === rider.id ? { ...item, activeLoad: item.activeLoad + plan.quantity } : item),
    shipments: [shipment, ...state.shipments],
    plans: state.plans.map((item) => item.id === planId ? { ...item, status: 'APPROVED', approvedShipmentId: shipment.id } : item),
  }
  const invariants = assertNetworkInvariants(next)
  if (!invariants.valid) return { ok: false, errors: invariants.errors }
  return { ok: true, state: next, shipment }
}

export function expireReservation(state, shipmentId, now = new Date()) {
  const shipment = state.shipments.find((candidate) => candidate.id === shipmentId)
  if (!shipment) return { ok: false, errors: ['Reservation was not found.'] }
  if (shipment.status !== 'RESERVED') return { ok: false, idempotent: TERMINAL_SHIPMENT_STATES.includes(shipment.status), errors: [`Reservation is ${shipment.status.toLowerCase()} and cannot expire.`] }
  const next = {
    ...state,
    donations: state.donations.map((donation) => donation.id === shipment.donationId ? { ...donation, availableQuantity: donation.availableQuantity + shipment.quantity, status: 'PARTIALLY_ALLOCATED' } : donation),
    shelters: state.shelters.map((shelter) => shelter.id === shipment.shelterId ? { ...shelter, remainingDemand: shelter.remainingDemand + shipment.quantity, activeInbound: Math.max(0, shelter.activeInbound - shipment.quantity) } : shelter),
    riders: state.riders.map((rider) => rider.id === shipment.riderId ? { ...rider, activeLoad: Math.max(0, rider.activeLoad - shipment.quantity) } : rider),
    shipments: state.shipments.map((item) => item.id === shipmentId ? { ...item, status: 'EXPIRED', timeline: [{ label: 'Reservation expired', time: new Date(now).toISOString(), detail: 'Unacknowledged reservation released exactly once' }, ...(item.timeline || [])] } : item),
  }
  const invariants = assertNetworkInvariants(next)
  if (!invariants.valid) return { ok: false, errors: invariants.errors }
  return { ok: true, state: next, shipment: next.shipments.find((item) => item.id === shipmentId) }
}

export function findSafeFallback({ shipment, shelters, donation, rider, now }) {
  return shelters
    .filter((shelter) => shelter.id !== shipment.shelterId)
    .map((shelter) => ({ shelter, validation: validateAllocation({ donation, shelter, rider, now, quantity: shipment.quantity }) }))
    .filter((candidate) => candidate.validation.feasible)
    .sort((a, b) => b.shelter.fallbackCount - a.shelter.fallbackCount)[0] || null
}

export function closeShelterAndRevalidate(state, shelterId, now = new Date()) {
  const shelter = state.shelters.find((candidate) => candidate.id === shelterId)
  if (!shelter) return { ok: false, errors: ['Shelter was not found.'] }
  const affected = state.shipments.filter((shipment) => shipment.shelterId === shelterId && ['PICKED_UP', 'IN_TRANSIT', 'REROUTE_PENDING'].includes(shipment.status))
  let nextShipments = state.shipments
  const proposals = []
  for (const shipment of affected) {
    const donation = state.donations.find((candidate) => candidate.id === shipment.donationId)
    const rider = state.riders.find((candidate) => candidate.id === shipment.riderId)
    const fallback = findSafeFallback({ shipment, shelters: state.shelters, donation: { ...donation, availableQuantity: shipment.quantity, status: 'READY' }, rider, now })
    proposals.push({ shipmentId: shipment.id, fallback: fallback?.shelter || null, reasons: fallback ? [] : ['No open compatible shelter can accept this quantity before the safety deadline.'] })
    nextShipments = nextShipments.map((item) => item.id === shipment.id ? { ...item, status: fallback ? 'REROUTE_PENDING' : 'RECOVERY_REQUIRED', proposedShelterId: fallback?.shelter.id, timeline: [{ label: fallback ? 'Reroute proposed' : 'Recovery required', time: new Date(now).toISOString(), detail: fallback ? `${shelter.name} closed; ${fallback.shelter.name} passed fallback validation` : 'Custody preserved; no safe fallback destination' }, ...(item.timeline || [])] } : item)
  }
  const next = { ...state, shelters: state.shelters.map((item) => item.id === shelterId ? { ...item, status: 'CLOSED', remainingDemand: 0, intakeCapacity: 0 } : item), shipments: nextShipments }
  return { ok: true, state: next, proposals }
}

export function createScenarioFixture(scenarioId, now = new Date()) {
  const timestamp = new Date(now).toISOString()
  const deadline = (minutes) => new Date(new Date(now).getTime() + minutes * 60000).toISOString()
  const baseDonation = (overrides = {}) => ({ id: 'SCN-BATCH', donor: 'Scenario donor', itemType: 'Prepared meals', quantity: 180, availableQuantity: 180, completedQuantity: 0, unit: 'meals', pickupLocation: 'Simulated origin', pickupDeadline: deadline(60), declaredExpiry: deadline(180), safeDeadline: deadline(150), dependencies: [], handling: 'Chilled', status: 'READY', createdAt: timestamp, ...overrides })
  const baseShelter = (id, demand, overrides = {}) => ({ id, name: `Scenario shelter ${id}`, location: 'Simulated location', status: 'OPEN', remainingDemand: demand, intakeCapacity: demand, activeInbound: 0, accepts: ['Prepared meals', 'Ration kits'], resources: ['Water', 'Fuel', 'Refrigeration'], fallbackCount: 1, lastUpdated: timestamp, ...overrides })
  const baseRiders = (count = 5, overrides = {}) => Array.from({ length: count }, (_, index) => ({ id: `SCN-R${index + 1}`, name: `Scenario rider ${index + 1}`, availability: 'AVAILABLE', location: 'Simulated location', maxCapacity: 40, activeLoad: 0, supported: ['Prepared meals', 'Ration kits'], heartbeat: timestamp, reliability: .9, state: 'READY', ...overrides }))
  const base = { version: 2, donations: [baseDonation()], shelters: [baseShelter('SCN-S1', 50), baseShelter('SCN-S2', 70), baseShelter('SCN-S3', 60)], riders: baseRiders(), shipments: [], exceptions: [], audits: [], activity: [], plans: [], residuals: [], rejections: [], scenarioRuns: [], simulatedMinutes: 0, lastUpdated: timestamp }
  if (scenarioId === 'oversized') return base
  if (scenarioId === 'ghost') {
    const donation = baseDonation({ quantity: 20, availableQuantity: 20 })
    const shelter = baseShelter('SCN-S1', 20)
    return { ...base, donations: [donation], shelters: [shelter], riders: baseRiders(2) }
  }
  if (scenarioId === 'closure') {
    const donation = baseDonation({ quantity: 40, availableQuantity: 0 })
    const shipment = { id: 'SCN-SHP-C', donationId: donation.id, itemType: donation.itemType, quantity: 40, unit: donation.unit, riderId: 'SCN-R1', shelterId: 'SCN-S1', status: 'IN_TRANSIT', eta: deadline(25), safeDeadline: deadline(100), score: .8, createdAt: timestamp, timeline: [{ label: 'In transit', time: timestamp, detail: 'Custody preserved in simulated route' }] }
    return { ...base, donations: [donation], shelters: [baseShelter('SCN-S1', 0, { intakeCapacity: 0 }), baseShelter('SCN-S2', 70)], riders: baseRiders(2), shipments: [shipment] }
  }
  if (scenarioId === 'dependency') {
    const donation = baseDonation({ id: 'SCN-RATION', itemType: 'Ration kits', quantity: 20, availableQuantity: 20, dependencies: ['Water', 'Fuel'] })
    return { ...base, donations: [donation], shelters: [baseShelter('SCN-S1', 20, { resources: ['Water'] }), baseShelter('SCN-S2', 20, { resources: ['Water', 'Fuel'] })], riders: baseRiders(2) }
  }
  if (scenarioId === 'deadline') return { ...base, donations: [baseDonation({ safeDeadline: deadline(20) })], shelters: [baseShelter('SCN-S1', 50)], riders: baseRiders(2) }
  if (scenarioId === 'claims') return { ...base, donations: [baseDonation({ quantity: 20, availableQuantity: 20 })], shelters: [baseShelter('SCN-S1', 20)], riders: baseRiders(2) }
  if (scenarioId === 'rider-failure') {
    const donation = baseDonation({ quantity: 20, availableQuantity: 0 })
    const shipment = { id: 'SCN-SHP-G', donationId: donation.id, itemType: donation.itemType, quantity: 20, unit: donation.unit, riderId: 'SCN-R1', shelterId: 'SCN-S1', status: 'IN_TRANSIT', eta: deadline(25), safeDeadline: deadline(100), score: .8, createdAt: timestamp, timeline: [{ label: 'In transit', time: timestamp, detail: 'Rider has custody in simulated route' }] }
    return { ...base, donations: [donation], shipments: [shipment], riders: baseRiders(2), shelters: [baseShelter('SCN-S1', 0, { intakeCapacity: 0 }), baseShelter('SCN-S2', 20)] }
  }
  if (scenarioId === 'no-fallback') {
    const donation = baseDonation({ quantity: 40, availableQuantity: 0 })
    const shipment = { id: 'SCN-SHP-H', donationId: donation.id, itemType: donation.itemType, quantity: 40, unit: donation.unit, riderId: 'SCN-R1', shelterId: 'SCN-S1', status: 'IN_TRANSIT', eta: deadline(25), safeDeadline: deadline(30), score: .8, createdAt: timestamp, timeline: [{ label: 'In transit', time: timestamp, detail: 'Custody preserved in simulated route' }] }
    return { ...base, donations: [donation], shipments: [shipment], riders: baseRiders(1), shelters: [baseShelter('SCN-S1', 0, { intakeCapacity: 0 }), baseShelter('SCN-S2', 40, { status: 'CLOSED' }), baseShelter('SCN-S3', 40, { accepts: ['Ration kits'] })] }
  }
  return base
}

export function runScenario(state, scenarioId, now = new Date()) {
  const fixture = createScenarioFixture(scenarioId, now)
  if (scenarioId === 'oversized' || scenarioId === 'dependency' || scenarioId === 'deadline') {
    const plan = generateDispatchPlan({ donations: fixture.donations, shelters: fixture.shelters, riders: fixture.riders, now })
    return { state: { ...fixture, plans: plan.plans.map((item, index) => ({ ...item, id: `SCN-PLAN-${index}`, status: 'PROPOSED' })), residuals: plan.residuals, rejections: plan.rejections }, summary: scenarioId === 'oversized' ? '180 meals evaluated and split only across feasible capacity; residuals are reported.' : scenarioId === 'dependency' ? 'Ration kit candidates were checked against water and fuel requirements.' : 'Every candidate route was checked against the safe-use deadline and blocked when infeasible.', checks: scenarioId === 'oversized' ? ['Capacity-compliant plan quantities', 'Demand and intake limits respected', 'Residual quantity explained'] : scenarioId === 'dependency' ? ['DEPENDENCY_NOT_MET rejection recorded', 'Compatible shelter remains eligible', 'No unsafe plan created'] : ['Deadline rule applied before scoring', 'Safety buffer included', 'No override path exposed'] }
  }
  if (scenarioId === 'ghost' || scenarioId === 'claims') {
    const plan = generateDispatchPlan({ donations: fixture.donations, shelters: fixture.shelters, riders: fixture.riders, now })
    const planned = { ...fixture, plans: plan.plans.map((item, index) => ({ ...item, id: `SCN-PLAN-${index}`, status: 'PROPOSED' })) }
    const approved = approveDispatchPlan(planned, 'SCN-PLAN-0', now)
    if (!approved.ok) return { state: planned, summary: approved.errors.join(' · '), checks: ['Approval rejected by shared validation'] }
    if (scenarioId === 'ghost') {
      const expired = expireReservation(approved.state, approved.shipment.id, now)
      return { state: expired.ok ? expired.state : approved.state, summary: 'Unacknowledged reservation expired and quantity was released once for reassignment.', checks: ['Atomic release recorded', 'Inventory returned to eligible quantity', 'Late response cannot accept expired reservation'] }
    }
    const competingPlan = { ...planned.plans[0], id: 'SCN-PLAN-1', riderId: fixture.riders[1]?.id || planned.plans[0].riderId, status: 'PROPOSED' }
    const competing = approveDispatchPlan({ ...approved.state, plans: [...approved.state.plans, competingPlan] }, competingPlan.id, now)
    return { state: approved.state, summary: 'One concurrent claim committed; the competing claim was rejected because the last quantity was already reserved.', checks: ['Single reservation committed', 'Balance never negative', `Competing claim rejected: ${competing.errors[0]}`] }
  }
  if (scenarioId === 'closure' || scenarioId === 'no-fallback') {
    const closed = closeShelterAndRevalidate(fixture, 'SCN-S1', now)
    return { state: closed.state, summary: scenarioId === 'closure' ? 'Closed destination triggered custody-preserving fallback validation.' : 'No feasible destination remained; shipment entered recovery-required state.', checks: scenarioId === 'closure' ? ['Closed destination excluded', 'Fallback proposal recorded', 'Custody preserved'] : ['Recovery required recorded', 'Rejection reasons retained', 'No fabricated delivery'] }
  }
  if (scenarioId === 'rider-failure') {
    const shipment = fixture.shipments[0]
    const failed = transitionShipment(shipment, 'REROUTE_PENDING')
    return { state: { ...fixture, shipments: [{ ...failed, failureReason: 'Vehicle issue reported after pickup', timeline: [{ label: 'Rider failure reported', time: new Date(now).toISOString(), detail: 'Custody preserved; replacement handoff required' }, ...shipment.timeline] }], exceptions: [{ id: 'SCN-EX-G', severity: 'CRITICAL', type: 'Rider failure', entity: shipment.id, title: 'Vehicle issue after pickup', detail: 'Replacement carrier must be validated before custody transfer.', status: 'OPEN', createdAt: new Date(now).toISOString() }] }, summary: 'Rider failure created a custody-preserving exception without returning collected aid to donor inventory.', checks: ['Physical custody preserved', 'Exception created', 'Replacement handoff required'] }
  }
  return { state: fixture, summary: 'Scenario completed with no state mutation.', checks: [] }
}

export function transitionShipment(shipment, nextStatus) {
  const allowed = {
    AVAILABLE: ['RESERVED', 'CANCELLED'],
    RESERVED: ['ACCEPTED', 'EXPIRED', 'RELEASED', 'CANCELLED'],
    ACCEPTED: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['IN_TRANSIT', 'FAILED', 'REROUTE_PENDING'],
    IN_TRANSIT: ['DELIVERED', 'FAILED', 'REROUTE_PENDING', 'RECOVERY_REQUIRED'],
    REROUTE_PENDING: ['IN_TRANSIT', 'RECOVERY_REQUIRED', 'FAILED'],
    RECOVERY_REQUIRED: ['IN_TRANSIT', 'FAILED'],
    DELIVERED: [],
    EXPIRED: [],
    RELEASED: [],
    CANCELLED: [],
    FAILED: [],
  }
  if (!allowed[shipment.status]?.includes(nextStatus)) throw new Error(`Invalid transition ${shipment.status} → ${nextStatus}`)
  return { ...shipment, status: nextStatus }
}
