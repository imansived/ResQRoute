# ResQRoute

ResQRoute is a premium civic-tech operations prototype for coordinating surplus food and emergency aid across donors, volunteer riders, and receiving shelters.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Checks

```bash
npm test
npm run build
```

The test suite covers deadline feasibility, capacity/demand/dependency validation, dispatch splitting and residuals, state-machine transitions, and quantity conservation.

## Demo flow

1. Start on **Operations overview** and review live KPIs, the seeded logistics schematic, exception queue, and selected shipment detail.
2. Click **Generate dispatch plan** to create explainable allocations from current donation, rider, shelter, deadline, and resource state.
3. Open **Dispatch center** to approve a safe reservation and inspect the score breakdown.
4. Open **Live shipments** to advance a reservation through accepted, pickup, transit, and delivery states. Invalid transitions are rejected.
5. Open **Simulation lab** and run scenarios A–H. Each scenario records a visible result and audit event; use **Reset demo baseline** to rehearse again.
6. Use **Shelters** to close intake and create a reroute proposal for an in-transit shipment, or demonstrate `RECOVERY_REQUIRED` when no safe fallback exists.
7. Use **Audit & impact** to inspect confirmed delivery totals and the immutable transition trail.

## Architecture

- `src/data.js` contains coherent seeded demo state and local persistence.
- `src/engine.js` contains the shared allocation, deadline, compatibility, scoring, quantity-invariant, and shipment-state rules.
- `src/App.jsx` provides the role-switchable operations UI, mutation flows, scenario lab, and audit views.
- `src/styles.css` implements the responsive civic-tech visual system.

## Known limitations

This hackathon build uses browser localStorage and deterministic seeded route estimates instead of a remote API, database, Socket.IO transport, or external map provider. The business rules are isolated in `src/engine.js` so a persistent backend can replace the local state layer without rewriting the UI.

The top-bar role switcher is a demo control; real authentication and server-side role authorization would be the next production step.
