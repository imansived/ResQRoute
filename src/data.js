const iso = (minutesFromNow) => new Date(Date.now() + minutesFromNow * 60000).toISOString()
export const STATE_VERSION = 2

export function seedState() {
  const donations = [
    { id: 'BAT-0180', donor: 'Northside Kitchen', itemType: 'Prepared meals', quantity: 180, availableQuantity: 60, completedQuantity: 100, unit: 'meals', pickupLocation: 'Northside Kitchen · 14th Ave', pickupDeadline: iso(55), declaredExpiry: iso(150), safeDeadline: iso(130), dependencies: [], handling: 'Chilled · sealed', status: 'PARTIALLY_ALLOCATED', createdAt: iso(-74) },
    { id: 'BAT-0179', donor: 'Harbor Market', itemType: 'Produce boxes', quantity: 64, availableQuantity: 0, completedQuantity: 64, unit: 'boxes', pickupLocation: 'Harbor Market · Pier 4', pickupDeadline: iso(80), declaredExpiry: iso(380), safeDeadline: iso(320), dependencies: ['Refrigeration'], handling: 'Keep cool', status: 'DELIVERED', createdAt: iso(-190) },
    { id: 'BAT-0178', donor: 'Cedar Pharmacy', itemType: 'First aid kits', quantity: 36, availableQuantity: 36, completedQuantity: 0, unit: 'kits', pickupLocation: 'Cedar Pharmacy · Oak St', pickupDeadline: iso(110), declaredExpiry: iso(1440), safeDeadline: iso(1220), dependencies: [], handling: 'Dry storage', status: 'READY', createdAt: iso(-40) },
    { id: 'BAT-0177', donor: 'Eastbank Grocers', itemType: 'Water crates', quantity: 48, availableQuantity: 8, completedQuantity: 0, unit: 'crates', pickupLocation: 'Eastbank Grocers · 3rd St', pickupDeadline: iso(95), declaredExpiry: iso(800), safeDeadline: iso(760), dependencies: [], handling: 'Ambient', status: 'PARTIALLY_ALLOCATED', createdAt: iso(-145) },
    { id: 'BAT-0176', donor: 'Sunrise Bakery', itemType: 'Bread loaves', quantity: 92, availableQuantity: 92, completedQuantity: 0, unit: 'loaves', pickupLocation: 'Sunrise Bakery · Market Sq', pickupDeadline: iso(125), declaredExpiry: iso(260), safeDeadline: iso(220), dependencies: [], handling: 'Ambient', status: 'READY', createdAt: iso(-28) },
    { id: 'BAT-0175', donor: 'Mosaic Farms', itemType: 'Produce boxes', quantity: 30, availableQuantity: 0, completedQuantity: 30, unit: 'boxes', pickupLocation: 'Mosaic Farms · County Rd', pickupDeadline: iso(65), declaredExpiry: iso(250), safeDeadline: iso(210), dependencies: ['Refrigeration'], handling: 'Keep cool', status: 'DELIVERED', createdAt: iso(-220) },
    { id: 'BAT-0174', donor: 'Civic Relief Depot', itemType: 'Ration kits', quantity: 40, availableQuantity: 40, completedQuantity: 0, unit: 'kits', pickupLocation: 'Civic Relief Depot · Bay 2', pickupDeadline: iso(155), declaredExpiry: iso(960), safeDeadline: iso(900), dependencies: ['Water', 'Fuel'], handling: 'Dry storage', status: 'READY', createdAt: iso(-18) },
    { id: 'BAT-0173', donor: 'Westfield School', itemType: 'Prepared meals', quantity: 50, availableQuantity: 0, completedQuantity: 50, unit: 'meals', pickupLocation: 'Westfield School · Elm Rd', pickupDeadline: iso(50), declaredExpiry: iso(110), safeDeadline: iso(100), dependencies: [], handling: 'Chilled · sealed', status: 'DELIVERED', createdAt: iso(-300) },
  ]

  const shelters = [
    { id: 'S-01', name: 'Harbor Welcome Center', location: 'Old Port · 1.8 mi', status: 'OPEN', remainingDemand: 50, intakeCapacity: 70, activeInbound: 20, accepts: ['Prepared meals', 'Water crates', 'First aid kits'], resources: ['Refrigeration', 'Water', 'Fuel'], fallbackCount: 2, lastUpdated: iso(-8) },
    { id: 'S-02', name: 'Eastside Community Hub', location: 'Eastbank · 2.4 mi', status: 'OPEN', remainingDemand: 70, intakeCapacity: 100, activeInbound: 12, accepts: ['Prepared meals', 'Ration kits', 'Water crates', 'Bread loaves'], resources: ['Water', 'Fuel', 'Refrigeration'], fallbackCount: 1, lastUpdated: iso(-13) },
    { id: 'S-03', name: 'Mercy Field Hospital', location: 'Civic Plaza · 3.1 mi', status: 'OPEN', remainingDemand: 60, intakeCapacity: 80, activeInbound: 40, accepts: ['First aid kits', 'Water crates', 'Prepared meals'], resources: ['Water', 'Fuel', 'Refrigeration'], fallbackCount: 1, lastUpdated: iso(-3) },
    { id: 'S-04', name: 'Southgate Shelter', location: 'Southgate · 4.2 mi', status: 'OPEN', remainingDemand: 24, intakeCapacity: 30, activeInbound: 8, accepts: ['Bread loaves', 'Prepared meals', 'Water crates'], resources: ['Water'], fallbackCount: 0, lastUpdated: iso(-20) },
    { id: 'S-05', name: 'Riverside Warming Hall', location: 'Riverside · 5.0 mi', status: 'CLOSED', remainingDemand: 0, intakeCapacity: 0, activeInbound: 0, accepts: ['Prepared meals', 'Bread loaves'], resources: ['Water'], fallbackCount: 0, lastUpdated: iso(-32) },
  ]

  const riders = [
    { id: 'R-04', name: 'Maya Chen', availability: 'AVAILABLE', location: 'Eastbank · 0.6 mi', maxCapacity: 40, activeLoad: 0, supported: ['Prepared meals', 'Bread loaves', 'Water crates'], heartbeat: iso(-2), reliability: 0.96, state: 'READY' },
    { id: 'R-07', name: 'Jordan Lee', availability: 'AVAILABLE', location: 'Civic Plaza · 1.2 mi', maxCapacity: 40, activeLoad: 20, supported: ['Prepared meals', 'First aid kits', 'Ration kits'], heartbeat: iso(-1), reliability: 0.89, state: 'ON_ROUTE' },
    { id: 'R-11', name: 'Samira Patel', availability: 'AVAILABLE', location: 'Northside · 0.9 mi', maxCapacity: 30, activeLoad: 0, supported: ['Prepared meals', 'Produce boxes', 'Bread loaves'], heartbeat: iso(-4), reliability: 0.92, state: 'READY' },
    { id: 'R-15', name: 'Evan Brooks', availability: 'AVAILABLE', location: 'Harbor · 2.0 mi', maxCapacity: 60, activeLoad: 40, supported: ['Water crates', 'Ration kits', 'First aid kits'], heartbeat: iso(-5), reliability: 0.84, state: 'ON_ROUTE' },
    { id: 'R-18', name: 'Nia Williams', availability: 'UNAVAILABLE', location: 'Offline · last seen 22m ago', maxCapacity: 40, activeLoad: 0, supported: ['Prepared meals', 'Water crates'], heartbeat: iso(-22), reliability: 0.74, state: 'MISSED_HEARTBEAT' },
    { id: 'R-22', name: 'Luis Ortega', availability: 'AVAILABLE', location: 'Southgate · 1.1 mi', maxCapacity: 25, activeLoad: 0, supported: ['Bread loaves', 'Prepared meals'], heartbeat: iso(-3), reliability: 0.81, state: 'READY' },
  ]

  const shipments = [
    { id: 'SHP-2408', donationId: 'BAT-0180', itemType: 'Prepared meals', quantity: 20, unit: 'meals', riderId: 'R-07', shelterId: 'S-01', status: 'IN_TRANSIT', eta: iso(19), safeDeadline: donations[0].safeDeadline, score: 0.88, createdAt: iso(-28), timeline: [{ label: 'Assignment accepted', time: iso(-27), detail: 'R-07 accepted 20 meals' }, { label: 'Picked up', time: iso(-20), detail: 'Custody transferred at Northside Kitchen' }, { label: 'In transit', time: iso(-18), detail: 'Heading to Harbor Welcome Center' }] },
    { id: 'SHP-2407', donationId: 'BAT-0179', itemType: 'Produce boxes', quantity: 32, unit: 'boxes', riderId: 'R-04', shelterId: 'S-02', status: 'DELIVERED', eta: iso(-45), safeDeadline: donations[1].safeDeadline, score: 0.91, createdAt: iso(-145), deliveredAt: iso(-43), timeline: [{ label: 'Delivered', time: iso(-43), detail: '32 boxes received and reconciled' }] },
    { id: 'SHP-2406', donationId: 'BAT-0179', itemType: 'Produce boxes', quantity: 32, unit: 'boxes', riderId: 'R-11', shelterId: 'S-03', status: 'DELIVERED', eta: iso(-60), safeDeadline: donations[1].safeDeadline, score: 0.84, createdAt: iso(-155), deliveredAt: iso(-58), timeline: [{ label: 'Delivered', time: iso(-58), detail: '32 boxes received and reconciled' }] },
    { id: 'SHP-2405', donationId: 'BAT-0177', itemType: 'Water crates', quantity: 40, unit: 'crates', riderId: 'R-15', shelterId: 'S-03', status: 'ACCEPTED', eta: iso(24), safeDeadline: donations[3].safeDeadline, score: 0.79, createdAt: iso(-12), timeline: [{ label: 'Assignment accepted', time: iso(-10), detail: 'R-15 accepted 40 crates' }] },
    { id: 'SHP-2404', donationId: 'BAT-0173', itemType: 'Prepared meals', quantity: 50, unit: 'meals', riderId: 'R-22', shelterId: 'S-04', status: 'DELIVERED', eta: iso(-80), safeDeadline: donations[7].safeDeadline, score: 0.94, createdAt: iso(-220), deliveredAt: iso(-78), timeline: [{ label: 'Delivered', time: iso(-78), detail: '50 meals received before deadline' }] },
  ]

  return { version: STATE_VERSION, donations, shelters, riders, shipments, exceptions: [
    { id: 'EX-301', severity: 'CRITICAL', type: 'Safety deadline', entity: 'BAT-0180', title: 'Prepared meals approaching safe-use deadline', detail: '60 meals remain unallocated and the validated handling window has 130 minutes remaining.', action: 'Generate dispatch plan', status: 'OPEN', createdAt: iso(-4) },
    { id: 'EX-298', severity: 'HIGH', type: 'Rider availability', entity: 'R-18', title: 'Heartbeat missing', detail: 'Nia Williams has not checked in for 22 minutes. New assignments are paused.', action: 'Inspect rider', status: 'OPEN', createdAt: iso(-22) },
    { id: 'EX-296', severity: 'MEDIUM', type: 'Destination change', entity: 'S-05', title: 'Riverside Warming Hall closed', detail: 'No active shipment is currently assigned, but future recommendations are being filtered.', action: 'Review shelters', status: 'OPEN', createdAt: iso(-32) },
  ], audits: [
    { id: 'AUD-8821', actor: 'system.dispatch', entity: 'SHP-2408', from: 'PICKED_UP', to: 'IN_TRANSIT', reason: 'Rider departed pickup location', result: 'PASS', time: iso(-18) },
    { id: 'AUD-8818', actor: 'operator.demo', entity: 'SHP-2407', from: 'IN_TRANSIT', to: 'DELIVERED', reason: 'Shelter confirmed receipt', result: 'PASS', time: iso(-43) },
    { id: 'AUD-8812', actor: 'system.revalidation', entity: 'S-05', from: 'OPEN', to: 'CLOSED', reason: 'Shelter intake paused for maintenance', result: 'PASS', time: iso(-32) },
  ], activity: [
    { id: 'ACT-1', title: 'Shipment in transit', detail: 'SHP-2408 · 20 meals · Harbor Welcome Center', tone: 'blue', time: iso(-18) },
    { id: 'ACT-2', title: 'Delivery confirmed', detail: 'SHP-2407 · 32 produce boxes received', tone: 'green', time: iso(-43) },
    { id: 'ACT-3', title: 'Shelter intake closed', detail: 'Riverside Warming Hall is excluded from new plans', tone: 'amber', time: iso(-32) },
    { id: 'ACT-4', title: 'Heartbeat missed', detail: 'R-18 flagged unavailable after timeout', tone: 'red', time: iso(-22) },
  ], plans: [], scenarioRuns: [], simulatedMinutes: 0, lastUpdated: new Date().toISOString() }
}

function hasArrayState(value) {
  return value && Array.isArray(value.donations) && Array.isArray(value.shelters) && Array.isArray(value.riders) && Array.isArray(value.shipments) && Array.isArray(value.exceptions) && Array.isArray(value.audits) && Array.isArray(value.activity)
}

export function hydrateState(raw) {
  if (!hasArrayState(raw)) return { state: seedState(), recovered: true, reason: 'Saved demo state was incomplete and was replaced with the known-good baseline.' }
  const state = {
    ...raw,
    version: STATE_VERSION,
    plans: Array.isArray(raw.plans) ? raw.plans : [],
    residuals: Array.isArray(raw.residuals) ? raw.residuals : [],
    scenarioRuns: Array.isArray(raw.scenarioRuns) ? raw.scenarioRuns : [],
    simulatedMinutes: Number.isFinite(raw.simulatedMinutes) ? raw.simulatedMinutes : 0,
  }
  const requiredKeys = ['id', 'quantity', 'availableQuantity', 'completedQuantity']
  const validDonations = state.donations.every((item) => requiredKeys.every((key) => item[key] !== undefined) && item.availableQuantity >= 0 && item.completedQuantity >= 0)
  const validShelters = state.shelters.every((item) => item.id && Number.isFinite(item.remainingDemand) && Number.isFinite(item.intakeCapacity) && Number.isFinite(item.activeInbound))
  const validRiders = state.riders.every((item) => item.id && Number.isFinite(item.maxCapacity) && Number.isFinite(item.activeLoad))
  if (!validDonations || !validShelters || !validRiders) return { state: seedState(), recovered: true, reason: 'Saved demo state contained invalid quantities or capacity values and was replaced with the known-good baseline.' }
  return { state, recovered: false }
}
