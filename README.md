# Boda — wedding site + internal seating planner

Astro site for **Cristina y Miguel**: a public wedding site (RSVP flow backed by
Turso) plus an internal, password-protected **seating planner** at
`/internal/seating`.

The implementation contract for the seating planner lives in
[`docs/seating-plan-contract.md`](docs/seating-plan-contract.md).

## Requirements

- Node ≥ 22.12 or [Bun](https://bun.sh) (Bun is used for tests)
- A Turso database (the existing RSVP guest list)

## Setup

```sh
bun install
cp .env.example .env   # then fill in the values
bun dev                # http://localhost:4321
```

### Environment variables

| Variable | Used by | Required |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | RSVP features, `GET /api/internal/guests` | Yes in production. Without it the RSVP actions and the guests API return descriptive errors — no fake data is ever served. |
| `TURSO_AUTH_TOKEN` | same | Yes when the Turso URL is remote. |

## Seating planner

- UI: `/internal/seating` (password-protected)
- Data API: `GET /api/internal/guests` → `{ guests: PlannerGuest[] }`

The planner stores its state in the browser's `localStorage`
(`wedding-seating-plan-v1`); there is **no server-side plan persistence**. Use
the JSON backup export/import to move a plan between browsers.

### Auth model

`src/middleware.ts` protects **only** `/internal/seating` and `/api/internal/*`
with a single hardcoded password: **`miguel`**. Everything else — the public
wedding site — is untouched. Responses on protected paths are always
`Cache-Control: no-store` and `X-Robots-Tag: noindex`.

Open `/internal/seating`, type the password in the form, and the server sets an
HttpOnly `seating_auth` cookie (90 days) so you stay logged in. Requests to
`/api/internal/*` without that cookie get `401` JSON. No environment variable,
no per-environment setup — dev and production behave identically.

The login form posts JSON with `fetch` (hence the `<noscript>` warning) instead
of doing a native form submit: Chrome omits the `Origin` header on same-origin
form navigations, and Astro's built-in CSRF middleware answers form-content-type
POSTs without it with a `403` before our middleware runs. JSON bodies are not
form-like, so they pass through.

From the command line:

```sh
curl -i http://localhost:4321/api/internal/guests                      # 401
curl -i --cookie seating_auth=miguel http://localhost:4321/api/internal/guests
curl -i -H 'Content-Type: application/json' -d '{"password":"miguel"}' \
  http://localhost:4321/internal/seating                               # 204 + cookie
```

### Guests API

`GET /api/internal/guests` (cookie-protected) maps the existing Turso `guests` table
onto the planner's data model, read-only:

- Numeric database ids become `rsvp:<id>` ids in the planner.
- A guest's `group` is their parent's name for companions, otherwise their own name.
- `null` columns are normalized (`attendance` → `pending`, `dietaryRestrictions`
  → `omnivore`, `allergies`/`notes` → empty strings).
- Missing database configuration → `503` JSON with an explanatory message.
  Database errors → `502` JSON. No sample/fake data is ever returned.

The public RSVP actions (`src/actions/index.ts`) are not modified by the
planner.

## Project structure (seating)

```text
src/
├── lib/seating.ts          # shared types + pure helpers (parse/merge/CSV)
├── middleware.ts           # Password gate for /internal/seating + /api/internal/*
├── pages/api/internal/guests.ts  # read-only RSVP guest export
├── components/seating/     # planner UI (React)
├── pages/internal/seating.astro  # planner page
└── styles/seating.css      # planner styles
```

The planner data model (`PlannerGuest`, `PlannerTable`, `SeatingPlan`) and its
helpers (`parsePlan`, `assignGuest`, `mergeGuests`, `planToCsv`,
`parseGuestCsv`) are defined in `src/lib/seating.ts` and covered by unit tests.

## Commands

| Command | Action |
| --- | --- |
| `bun install` | Install dependencies |
| `bun dev` | Start the dev server at `localhost:4321` |
| `bun run build` | Production build to `./dist/` |
| `bun run preview` | Preview the production build locally |
| `bun test` | Run the unit tests (seating model + auth) |
| `bun run check` | Type-check the project (`astro check`) |

## Deployment notes

- The site deploys to Vercel (`@astrojs/vercel` adapter, SSR).
- Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as project environment
  variables in Vercel. The seating planner needs no extra configuration.
- The seating password lives in `src/middleware.ts` and is only read
  server-side; it never reaches the client bundle.
