# Accounts in development

## How accounts work

There is exactly **one pre-created account: the Admin.** Everyone else is
created by the Admin from the dashboard, which is how the real gym will work:

| Who | Created by | Signs in to |
|---|---|---|
| **Admin** | Development seed (`npm run db:seed`) | Admin dashboard (and mobile) |
| **Trainer** (`COACH`) | Admin → *Coaches → Add Trainer* | Mobile app |
| **Member** (`MEMBER`) | Admin → *Members → Add Member* | Mobile app |

Public self-registration is **off** (`ALLOW_PUBLIC_REGISTRATION=false`, the
default). The mobile app has no "create account" screen; a person with no login
asks the gym.

### Admin login (development only)

| Email | Password |
|---|---|
| `admin@illyriangym.dev` | `DevPassword!123` |

These come from `packages/database/prisma/seed.ts`. The seed refuses to run when
`NODE_ENV=production`. It only sets the password when it first creates the
account, so re-running it never resets a password you changed.

### What the Admin does

**Add Trainer** (`POST /coaches`) creates the `User` (role `COACH`) and its
linked `Coach` profile in one transaction, generates a random temporary
password, and shows it to the Admin **once**. Certifications and specialties are
whatever the Admin types - nothing is pre-filled.

**Add Member** (`POST /admin/members`) creates the `User` (role `MEMBER`; there
is no separate member-profile table, the `User` is the profile) and shows the
credentials once. The same dialog can assign a membership at the same time
(plan, start/end dates, payment status).

**Deactivate / reactivate** takes effect immediately: the API re-checks account
status on every request, so a deactivated trainer's or member's existing session
stops working at once, and they can't log in or refresh. Their history
(workouts, PRs, bookings, attendance, audit log) is kept.

**Reset password** issues a new one-time password and signs the person out of
every device. There is no email provider yet, so this is how a lost temporary
password is recovered.

> Temporary passwords are handed over by the Admin by hand until an email
> provider is configured. There is no "must change on first login" yet.

### Permissions at a glance

| | Admin | Trainer | Member |
|---|---|---|---|
| Create/edit/deactivate members & trainers, memberships, classes, exercises, announcements, challenges, gym settings | yes | no | no |
| WODs (create/publish), view PRs, verify/correct PRs, attendance, class participants | yes | yes | no |
| Analytics overview | yes | yes | no |
| Book classes, log workouts, see own membership/PRs | yes* | yes* | yes |

\* the API allows it; the product flows are designed around members.

All of this is enforced by the API (`@Roles` + a global guard), not by hiding
buttons; `apps/api/test/account-workflow.e2e-spec.ts` checks it end to end.

## Optional: fake demo people (never required)

`npm run db:seed:demo` (after `npm run db:seed`) fills a dev database with fake
people and training history so lists and the member/coach experience can be
explored without typing it all in. Nothing depends on it. It creates:

- `trainer@illyriangym.local` and `member@illyriangym.local`, password `DevPassword!123`
  - the member has an active membership, an upcoming booking, past attendance,
    workouts, two PRs with history, and an achievement
  - the trainer has classes, a published and a draft WOD, and a participant
- 3 extra trainers and 12 extra members (`@illyriangym.dev`) for realistic list volume

Everything here is fake - not real Illyrian Gym staff, members, prices, or
schedules. Do not run it against production.

## Resetting your dev database

```bash
cd packages/database
npx prisma migrate reset --force   # drops everything, re-applies migrations, re-runs the base seed
```
