# Illyrian Gym Ferizaj

Member mobile app, staff web app (owner, reception, trainer), and backend API for Illyrian Gym
Ferizaj, Kosovo. Production application, not a prototype - see
[docs/architecture.md](docs/architecture.md) for the full design rationale.

## Structure

```
apps/api      NestJS backend (REST API, source of truth)
apps/admin    Next.js staff web app: owner dashboard, front desk, trainer portal
apps/mobile   Expo (React Native) member app
packages/database  Prisma schema + client
packages/types      Shared DTOs/enums (no Prisma dependency - safe for client apps)
packages/config     Shared design tokens (extracted from the official website)
docs/               Architecture, database, and testing documentation
```

## Prerequisites

- Node.js >= 20
- PostgreSQL (local, Docker, or managed) for `apps/api`
- An `.env` file per app based on [.env.example](.env.example) (never commit
  real `.env` files)

## Getting started

```bash
npm install

# Database - local Postgres via Docker (recommended)
docker compose up -d
cp .env.example packages/database/.env
# packages/database/.env: DATABASE_URL=postgresql://illyrian:illyrian_dev_only@localhost:5434/illyrian_gym_dev
npm run db:generate
npm run db:migrate
npm run db:seed        # creates the one Admin account + the exercise catalog (see docs/demo-accounts.md)

# API
cp .env.example apps/api/.env            # fill in secrets
npm run dev:api                          # http://localhost:3010

# Admin dashboard
npm run db:seed:demo   # optional: fictional demo data (reception@, trainer@, member@illyriangym.local)
npm run dev:admin                        # http://localhost:3001 - sign in as the Admin

# Mobile app
npm run dev:mobile                       # Expo dev server; trainers/members sign in with logins the Admin creates

The mobile app finds the API by itself (`apps/mobile/lib/api-config.ts`): `localhost` in a
browser or the iOS simulator, the PC's LAN address on a physical phone (taken from the Expo
dev server), `10.0.2.2` in the Android emulator. The API port defaults to 3010
(`EXPO_PUBLIC_API_PORT`); set `EXPO_PUBLIC_API_URL` only to override it (required for a
production build). Your LAN address changes between networks, which is why nothing is hard-coded.
In development builds a failed login also shows which address it tried.

If the app says it cannot reach the server, run the read-only check first:

```bash
npm run doctor        # EXPO_PORT=8082 npm run doctor if Expo runs on 8082
```

It tells you whether the API is up, whether PostgreSQL is reachable, whether the API answers on
this PC's LAN address (what a phone uses), whether CORS allows a browser opened that way, and
whether Expo is running. For a physical phone the PC and phone must be on the same wifi, and
Windows Firewall must allow inbound connections for `node.exe` on the profile your wifi uses
(Windows asks the first time Node listens; check Settings > Network > the connection's profile
if you chose "Public").
```

## Documentation

- [docs/demo-accounts.md](docs/demo-accounts.md) - **Admin login**, how trainers/members
  are created, permissions, optional demo data
- [docs/architecture.md](docs/architecture.md) - stack choices, RBAC, auth
  design, error handling, open business decisions still pending
- [docs/database.md](docs/database.md) - schema, migrations, booking/PR
  concurrency strategy
- [docs/testing.md](docs/testing.md) - unit/integration/e2e conventions and current results
- [docs/design-system.md](docs/design-system.md) - the website-derived tokens, components, icons, accessibility
- [docs/requirements-checklist.md](docs/requirements-checklist.md) - every requirement of the project document with its honest status

## Status

Working end to end against a real PostgreSQL database and covered by automated tests (63 unit + 191 e2e,
see [docs/testing.md](docs/testing.md)). The full requirement-by-requirement status, including what is
partial or pending, is in [docs/requirements-checklist.md](docs/requirements-checklist.md).

- **Owner (Admin)**: dashboard (active members, revenue received, expiring soon, today's check-ins, charts),
  members and profiles, packages / sell / renew / freeze, payments, invoices (PDF) and expenses with Excel/PDF
  export, check-in and visit statistics, staff and trainers, messages, analytics (growth, at-risk members),
  monthly business report and a business assistant over the real records, gym rules, plus classes, WODs,
  exercises, PRs, challenges and announcements.
- **Reception**: front-desk home, members, memberships, payments, invoices, QR/manual check-in, messages. The
  API refuses everything else.
- **Trainer**: their own clients only (coaching data, never payments), notes, workout plans that appear in the
  client's app, progress reports, shared body data, classes, WODs, PRs, messages to their clients.
- **Member (mobile)**: home, **membership card with QR**, renewal / freeze requests, payments and invoices,
  today's plan from the trainer, schedule with booking and waitlist, WOD and workout logging, PRs and progress,
  private body measurements, AI Coach (labelled basic mode without an API key).
- **First sign-in**: accounts created by staff must choose their own password before anything else works
  (enforced by the API).

Not built: e-mail / SMS / push delivery, online payments, progress photos in the mobile app, Muscle Map and
wellness tracking, Albanian UI text. Things that are placeholders say so on screen. Prices, the freeze policy and
other business rules are **not invented**: they stay empty or configurable until the gym decides
(see the decisions table in the checklist).
