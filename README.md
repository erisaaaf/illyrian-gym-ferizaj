# Illyrian Gym Ferizaj

Member mobile app, coach/admin dashboard, and backend API for Illyrian Gym
Ferizaj, Kosovo. Production application, not a prototype - see
[docs/architecture.md](docs/architecture.md) for the full design rationale.

## Structure

```
apps/api      NestJS backend (REST API, source of truth)
apps/admin    Next.js coach/admin dashboard
apps/mobile   Expo (React Native) member app
packages/database  Prisma schema + client
packages/types      Shared DTOs/enums (no Prisma dependency - safe for client apps)
packages/config     Shared design tokens
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
npm run dev:api                          # http://localhost:3000 (3010 in this machine's local .env)

# Admin dashboard
npm run dev:admin                        # http://localhost:3001 - sign in as the Admin

# Mobile app
npm run dev:mobile                       # Expo dev server; trainers/members sign in with logins the Admin creates
```

## Documentation

- [docs/demo-accounts.md](docs/demo-accounts.md) - **Admin login**, how trainers/members
  are created, permissions, optional demo data
- [docs/architecture.md](docs/architecture.md) - stack choices, RBAC, auth
  design, error handling, open business decisions still pending
- [docs/database.md](docs/database.md) - schema, migrations, booking/PR
  concurrency strategy
- [docs/testing.md](docs/testing.md) - unit/integration/e2e conventions

## Status

Working end to end against a real PostgreSQL database: Admin dashboard (members,
memberships and plans, trainers, classes, bookings, WODs, exercises, PR
management, attendance, challenges, announcements, notifications log,
analytics, settings), the API behind it with server-side role enforcement, and
mobile sign-in for trainers and members. Not built yet: most member-facing
mobile screens (schedule, WOD, workout logging, PRs, progress - the API for
them exists), the AI Coach, push notifications, email delivery. Things that are
placeholders say so on screen. See
[docs/architecture.md#phased-build-plan](docs/architecture.md#phased-build-plan).
