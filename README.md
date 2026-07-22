# SAIFI / SAIDI Monitoring Web App

Full-stack enterprise dashboard for PEA's "รายงาน 50" (power outage event report):
upload → validate/review anomalies → SAIFI/SAIDI dashboard.

Stack: React + Vite + Tailwind + Recharts (frontend), Node.js + Express + Prisma + TypeScript (backend), PostgreSQL.

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (or Docker Desktop to run `docker compose up -d` for a local instance)

## Setup

```bash
npm install                       # installs both workspaces
cp backend/.env.example backend/.env   # edit DATABASE_URL / JWT_SECRET as needed

docker compose up -d              # starts local Postgres (skip if you have your own)

npm run prisma:migrate            # creates tables
npm run prisma:seed               # creates the first admin user (see backend/.env)

npm run dev:backend               # http://localhost:4000
npm run dev:frontend              # http://localhost:5173 (proxies /api to :4000)
```

Log in with the seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `backend/.env`,
defaults to `admin@pea.local` / `ChangeMe123!`), then use **อัปโหลดรายงาน 50** to upload the
`.xlsx` export and **ตั้งค่าเป้าหมาย** to configure SAIFI/SAIDI targets per area category before
checking the dashboard.

## How the data model works

Each "รายงาน 50" export is a **year-to-date cumulative report** (from Jan 1 through the export
date), not an incremental daily/monthly diff — a later upload supersedes an earlier one rather
than adding to it. The dashboard therefore reads from a single upload batch (the latest
**approved** one) and derives the monthly trend, cause breakdown, and area/feeder breakdown by
grouping that batch's individual events, rather than summing across multiple uploads.

The parser reconciles three sheets in the workbook:
- `50` — the full raw event list (source of truth for event details)
- `ประเมิน` — events counted toward SAIFI/SAIDI, with precomputed customer-minutes
- `ไม่ประเมิน` — events excluded from SAIFI/SAIDI (e.g. exceptional events)

Every event is tagged `evaluated: true/false/null` based on which sheet(s) it's found in;
`null` (found in neither) is flagged as an anomaly for manual review before a batch is approved.

Also note: the source file encodes the Buddhist Era year directly into date values
(e.g. `2569` instead of Gregorian `2026`) — the parser converts this on import.

## Role model

- **ADMIN** — upload, review/approve batches, set targets
- **ENGINEER** — upload, review/approve batches
- **VIEWER** — dashboard read-only

## Known security notes

`npm audit` flags two unresolved advisories, left as-is deliberately:
- **`xlsx` (SheetJS) — prototype pollution / ReDoS, no npm-registry fix available.** SheetJS only
  publishes patched builds via their own CDN now, not npm. Mitigated here by gating the upload
  endpoint to authenticated `ADMIN`/`ENGINEER` users only — not a public upload surface. If this
  matters for your threat model, switch to the CDN-distributed build per
  [SheetJS's install docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs).
- **`esbuild`/`vite` — dev server accepts cross-origin requests.** Only exploitable against a
  developer's local `npm run dev` session, not the production build. Fixing it requires a
  breaking Vite 8 upgrade; not done here.

## Roadmap ideas (not yet built)

- Office/feeder master data management UI (currently free-text from the report)
- GIS overlay of worst feeders
- Automated outage-alert integration
