# Wedding seating planner implementation contract

Build Spanish internal tool at `/internal/seating`, for Cristina y Miguel. Preserve public wedding site. No production guest mutations.

## Shared types (`src/lib/seating.ts`, data worker owns)
- `PlannerGuest`: `{ id: string; name: string; attendance: 'confirmed' | 'pending' | 'declined'; dietaryRestrictions: string; allergies: string; notes: string; isChild: boolean; group: string; tableId: string | null }`
- `PlannerTable`: `{ id: string; name: string; capacity: number; shape: 'round' | 'rectangular'; position?: { x: number; y: number } }`
- `SeatingPlan`: `{ version: 1; name: string; guests: PlannerGuest[]; tables: PlannerTable[] }`
- exports `emptyPlan(): SeatingPlan`, `parsePlan(input: unknown): SeatingPlan` (throws descriptive error, validates IDs/references/capacity/invariants), `assignGuest(plan, guestId, tableId: string | null): SeatingPlan` (rejects full table/declined guest), `mergeGuests(plan, guests: PlannerGuest[]): SeatingPlan` (preserve local seating/details except incoming RSVP metadata; clear declined seating; keep manual guests), `planToCsv(plan): string` (proper escaping, spreadsheet formula safety), `parseGuestCsv(text): PlannerGuest[]` (header-based name,group,attendance,dietaryRestrictions,allergies,notes,isChild; quoted commas/newlines; errors useful).

## Server (data worker owns)
- Protect `/internal/seating` and `/api/internal/*` with a hardcoded password (`miguel`) kept in an HttpOnly cookie: the page renders a login form, the API returns 401 JSON. No secret in the frontend bundle. no-store and noindex for private responses. Middleware scopes only these paths.
- GET `/api/internal/guests` -> `{ guests: PlannerGuest[] }`; imports guests read-only from existing Turso DB, numeric IDs become `rsvp:<id>`, group based on parent or self; nulls normalized. Missing database configuration returns useful 503 JSON, no fake data. Lazy DB import to avoid build/local failures. Do not modify public RSVP actions.

## UI (UI worker owns)
Own `src/components/seating/*`, `src/pages/internal/seating.astro`, `src/styles/seating.css`. Import the shared functions/types above. Do not edit lib/server files.
- Polished responsive desktop workspace; warm ivory/olive wedding style, clear sidebar guest list and table cards, typography/hierarchy and accessible labels.
- Start with an honest empty plan; explicit load-demo button for sample plan.
- Table create/edit/delete including shape/capacity, deletion unassigns guests, prevent shrinking below occupancy.
- Guest create/edit/delete, group/diet/child/RSVP metadata, search/filter, assignment and move/unassign through keyboard-accessible select controls (drag/drop optional). Counts: confirmed, seated, unassigned, places. Respect capacity and exclude declined from assignment.
- Import RSVP guest button from protected API, manual guest CSV upload, JSON backup import/export, CSV seating export, print table lists including diets/allergies; guests never disappear silently. Import validation failures leave old plan untouched. Confirmation for destructive replacement/removal.
- Browser localStorage persistence under `wedding-seating-plan-v1`; handle corrupt/unavailable storage without silently overwriting saved data; clear saved/error status; browser-local persistence explicitly explained. JSON backup is portable to another browser. No server persistence claims.
- Plan name editable. Useful empty states/error feedback. Mobile usable, no overflow.

## Validation
Data worker owns meaningful Bun unit tests for invariants/import/export/merge and auth. UI worker checks implementation and builds when possible. Coordinator independently runs all checks, browser exercises the full workflow, reviews print and mobile rendering. README setup by data worker. No commits or deployment unless coordinator directs.

## Visual layout

The optional table `position` stores canvas coordinates in pixels (finite numbers from 0 to 10000). Existing v1 backups without positions remain valid and receive an automatic layout in the UI. Table movements persist through autosave and JSON export/import; guest moves use the same capacity and attendance checks as list assignments. Pointer dragging supports mouse and touch. Table handles also accept arrow keys (10px, or 50px with Shift); selecting a guest exposes an accessible table selector.

Guests carry an optional 0-based `seat` index at their table. `tableSeats(guests, table)` resolves the layout (explicit seats first, everyone else fills the first free seats), `assignGuest` picks the first free seat and `seatGuest(plan, guestId, tableId, seat)` moves a guest to a specific seat at the same or another table, swapping with the occupant (or sliding the occupant to a free seat when the mover had no table). The visual mode shows only tables and seats: drag a guest onto a seat, a table or the "Sin mesa" tray; the selection bar offers table and seat selectors for keyboard use; a fullscreen toggle (Esc to exit) expands the plan.
