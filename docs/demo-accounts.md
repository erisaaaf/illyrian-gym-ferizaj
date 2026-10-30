# Accounts in development

## How accounts work

There is exactly **one pre-created account: the Admin.** Everyone else is
created by the Admin from the dashboard, which is how the real gym will work:

| Who | Created by | Signs in to |
|---|---|---|
| **Admin / Owner** | Development seed (`npm run db:seed`) | Staff web app (and mobile) |
| **Receptionist** (`RECEPTIONIST`) | Admin → *Staff & trainers → Reception → Add reception staff* | Staff web app (front-desk screens only) |
| **Trainer** (`COACH`) | Admin → *Staff & trainers → Trainers → Add Trainer* | Staff web app (trainer portal) and mobile app |
| **Member** (`MEMBER`) | Admin or reception → *Members → Add member* | Mobile app |

**First sign-in with a temporary password.** Every account created from the dashboard is flagged
`mustChangePassword`. The API (not just the screen) refuses every request except "change password" and
"sign out" until the person chooses their own password (error code `PASSWORD_CHANGE_REQUIRED`); the web app and the
mobile app both show a "Choose your password" screen. A password reset by staff sets the flag again.

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
is no separate member-profile table, the `User` is the profile), gives it the next
member number (`IG-01001`, ...), and shows the credentials once. A membership is sold
afterwards from the member's profile (**Sell membership**), which creates the membership,
its invoice and optionally the first payment in one step.

**Deactivate / reactivate** takes effect immediately: the API re-checks account
status on every request, so a deactivated trainer's or member's existing session
stops working at once, and they can't log in or refresh. Their history
(workouts, PRs, bookings, attendance, audit log) is kept.

**Reset password** issues a new one-time password and signs the person out of
every device. There is no email provider yet, so this is how a lost temporary
password is recovered.

> Temporary passwords are handed over by hand until an email provider is configured.

### Permissions at a glance

| | Owner (Admin) | Reception | Trainer | Member |
|---|---|---|---|---|
| Dashboard, analytics, business reports, AI assistant | yes | no (front-desk home only) | no (own clients only) | no |
| Create/edit members, sell / renew / freeze memberships | yes | yes | no | no |
| Suspend members, cancel memberships, assign trainers, create staff, packages and prices, gym rules | yes | no | no | no |
| Record payments, issue invoices | yes | yes | no | no |
| Void / correct payments and invoices, expenses, finance reports and exports | yes | no | no | no |
| QR / manual check-in | yes | yes | no | no |
| Messages | all audiences | expiry / unpaid / one member | only their own clients | no |
| Clients, notes, workout plans, progress reports | any client | no | **only assigned clients** | no |
| Body measurements and photos | **never** | never | only what the client shared | their own |
| WODs, exercises, PRs, class attendance | yes | no | yes (own classes) | no |
| Book classes, log workouts, see own card / billing / plan | - | - | - | yes |

All of this is enforced by the API (`@Roles` + global guards + record-level checks such as `assertCanAccessClient`),
not by hiding buttons; the e2e suites check it end to end.

All of this is enforced by the API (`@Roles` + a global guard), not by hiding
buttons; `apps/api/test/account-workflow.e2e-spec.ts` checks it end to end.

## Optional: fake demo people (never required)

`npm run db:seed:demo` (after `npm run db:seed`) fills a dev database with fake
people and training history so lists and the member/coach experience can be
explored without typing it all in. Nothing depends on it. It creates:

- `trainer@illyriangym.local`, `member@illyriangym.local` and `reception@illyriangym.local`, password `DevPassword!123`
  (a receptionist to try the front-desk role)
- three **fictional** packages (Demo Gym Monthly, Demo CrossFit Monthly, Demo Combined 3 Months) with
  **placeholder prices**, a demo promotion, and for the 12 bulk members: member numbers, invoices in every state
  (paid by cash / bank / card, partly paid, overdue, pending), older paid memberships for the charts, 28 days of
  gym visits (two members deliberately stop visiting so "at risk" has data), six expenses, trainer assignments,
  and for the demo member a workout plan, a trainer note, three body measurements (two shared, one private) and a message.
  The prices are made up so the money screens have something to show; the real price list is entered by the owner.
  - the member has an active membership, an upcoming booking, past attendance,
    workouts, two PRs with history, and an achievement
  - the trainer has an upcoming class (with the demo member booked) and
    published/draft WODs
  - upcoming classes always start tomorrow or later and today's WOD uses the gym's
    calendar day (`GYM_TIMEZONE`), so the demo is bookable whenever you run it
- 3 extra trainers and 12 extra members (`@illyriangym.dev`) for realistic list volume

The seed is idempotent: run it again any time to refresh class times and today's
WOD (demo rows use stable UUID-shaped ids; rows from older versions of the seed
with `seed-...` ids are removed once). Everything here is fake - not real
Illyrian Gym staff, members, prices, or schedules. Do not run it against
production.

## Resetting your dev database

```bash
cd packages/database
npx prisma migrate reset --force   # drops everything, re-applies migrations, re-runs the base seed
```
