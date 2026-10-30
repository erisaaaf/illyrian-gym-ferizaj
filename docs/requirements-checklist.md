# Requirements checklist

Source of truth: `ILLYRIAN GYM.docx` - *Project Requirements: Complete Fitness & Gym Management System*
(all text, 4 tables and the 6 embedded example screens reviewed). The example screens in the
document come from other products (Fit-Life, GymLane, FitFlow, GymFlow, an invoice app); they inform
layout and function only. **Brand source: the official website** (https://illyrian-gym.vercel.app/),
see [design-system.md](design-system.md). The sample numbers in the document (248 members, EUR 8,420...)
are illustrative and are **never used as data**: every figure on screen is calculated from stored records.

Status legend
- **Done**: works through UI + API + database, authorised on the server, and covered by an automated test.
- **Done (UI checked by hand)**: as above, but the screen itself was only exercised manually in a browser.
- **Partial**: works, with the stated gap.
- **Pending**: not built.
- **Blocked**: needs a decision or credentials from the gym.

Document phases: 1 Foundation, 2 Gym operations, 3 Fitness tracking = *mandatory*; 4 Coaching = *high*;
5 AI & advanced = *bonus*. Anything in phase 4 or 5 that is only partly built is labelled as such, never
presented as complete.

Evidence: `apps/api/test/*.e2e-spec.ts` (191 tests) and `apps/api/src/**/*.spec.ts` (63 tests), all passing;
TypeScript clean on API, staff web and mobile. See [testing.md](testing.md).

## 1. Roles and access

| # | Requirement | Phase | Status | Notes / evidence |
|---|---|---|---|---|
| 1.1 | Member role | 1 | Done | `member-flow.e2e` |
| 1.2 | Trainer/Coach role | 1 | Done | `trainer-flow.e2e`, `coaching.e2e` |
| 1.3 | Receptionist role | 1 | Done | `front-desk.e2e` ("Reception role") |
| 1.4 | Admin/Owner role | 1 | Done | `admin-management.e2e` |
| 1.5 | No self-created active accounts; staff create the account, the client activates it by choosing a password | 1 | Done | self-registration off; temporary password shown once; **server-enforced first-login password change** (`PASSWORD_CHANGE_REQUIRED`) on web and mobile. No e-mail invitation: there is no mail provider (Blocked) |
| 1.6 | Server-side authorisation | 1 | Done | global guards, role e2e tests, record-level checks (`assertCanAccessClient`) |

## 2. Member app (mobile)

| # | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 2.A.1 | Membership type Gym / CrossFit / Combined | 1 | Done | `MembershipPlan.planType`; `front-desk.e2e` |
| 2.A.2 | Package monthly / 3 / 6 / 12 months | 1 | Done | `period` + configurable length; the owner creates the packages |
| 2.A.3 | Start / end date, days remaining | 1 | Done (UI checked by hand) | "My card" tab |
| 2.A.4 | Status Active / Expiring Soon / Expired / Frozen | 1 | Done | derived from dates and freeze; one rule used everywhere |
| 2.A.5 | Price and next payment date | 2 | Partial | price and next payment are shown in Payments & invoices (from the invoice). The card itself does not show the price |
| 2.A.6 | Renewal / freeze request | 2 | Done | request handled by staff (`front-desk.e2e`); there is no online payment, so renewal is paid at the desk. The request buttons on the card screen were built but not clicked in a browser |
| 2.A.7 | Digital card with unique QR | 2 | Done | signed QR (HMAC), revocable with `qrVersion`; `front-desk.e2e`. Scanned at the desk by a keyboard-wedge scanner or the browser camera. Phone-camera scanning on a real device was not tested |
| 2.A.8 | Previous packages history | 1 | Partial | API: `GET /memberships/me/history`. Staff see it on the member profile. No history list in the mobile app yet |
| 2.B.1 | Completed payments, unpaid amount, invoice history, PDF, Paid/Pending/Overdue, reminders, Request Renewal | 2 | Partial | all present. Invoice **PDF downloads on web only**; saving a PDF on a phone needs `expo-file-system`/`expo-sharing` (Pending). Reminders are in-app messages sent by staff (no push, no SMS) |
| 2.C.1 | Weekly schedule, trainer, free spots, book/cancel, waitlist, attendance history, notifications | 2/4 | Done | `member-flow.e2e`. The schedule screen was not redesigned to the document's date-strip layout |
| 2.D.1 | Workout Planner (trainer-assigned plans) | 3 | Done | a plan written in the trainer portal appears in the member app (`coaching.e2e`), with adherence. The app shows **today's session**, not the whole week |
| 2.D.2 | Daily Workout Log | 3 | Done | |
| 2.D.3 | Personal Records and lifting history | 3 | Done | PR engine, concurrency tested |
| 2.D.4 | Body progress monthly photos | 3 | Partial | **API Done and tested** (private by default, magic-byte validation, 3 MB limit, only member / assigned trainer when shared, never the owner). **No photo screen in the app yet** (needs `expo-image-picker` and authenticated image display; Pending) |
| 2.D.5 | Weight and body measurements | 3 | Done | private by default, share per entry; API tested in `coaching.e2e`; the screen was opened in a browser (history, share state) but adding / deleting an entry was not clicked |
| 2.D.6 | AI Fitness Assistant | 5 | Partial | answers from the member's own data in a labelled basic mode; the OpenAI path has never been run (no key) |
| 2.D.7 | Exercise Library & Muscle Map | 5 | Partial | library exists for staff; no member view, **no Muscle Map** |
| 2.D.8 | Goals, Challenges, Achievements | 5 | Partial | challenges + points; plan goal text; no goals tracker or achievements screen |
| 2.D.9 | Cardio, Recovery, Wellness tracking | 5 | Pending | |
| 2.D.10 | Weekly/monthly progress charts | 3 | Partial | weekly training days; no monthly view |
| 2.D.11 | Messages and notifications from the gym | 2 | Done | staff messages arrive as in-app notifications; read state is real |

## 3. Staff web app: Admin / Owner, Reception, Trainer

| # | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 3.A | Dashboard: Active Members, Monthly Revenue, Expiring Soon, Today's Check-ins + charts | 2 | Done (UI checked by hand) | `GET /admin/reports/dashboard` is e2e-tested against the raw records; revenue = money received. Reception and trainer get their own home screens |
| 3.B.1 | Member list with search and filters (Active, Expired, New, Unpaid, Inactive) | 1 | Done | plus Expiring soon, Frozen, Not visiting |
| 3.B.2 | Member profile: member number, registration date, membership, trainer, payment history, visits, admin notes, activate/suspend/deactivate | 1/2 | Done (UI checked by hand) | |
| 3.C | Membership management: packages, sell, renew, freeze, history, expiry alerts, discounts, restrictions | 1/2 | Partial | all except **restrictions** (which classes a package may book): not built. **Freeze policy is not confirmed**: no limit is set until the owner enters one in Settings |
| 3.D | Payments and finance: cash/bank/card, full/partial, debts, invoices with unique numbers, corrections with history, daily/weekly/monthly reports, filters, Excel/PDF, expenses | 2 | Done | `finance.e2e` (20). Prices are entered by the owner; nothing is invented. Online card payment is **not** integrated (Blocked: needs a provider) |
| 3.E | Attendance and check-in: QR, reception scan, membership verification, entry time, visit counts, peak hours, inactive list, monthly report | 2 | Done | `front-desk.e2e`; reception screen verified by hand |
| 3.F | Client progress reports with privacy | 4 | Done | report built only from recorded data; body numbers only if shared; photos never in a report; printable |
| 3.G | Staff and trainers: create, roles, assign clients, class schedule, attendance, workload | 1/4 | Done | |
| 3.H | Communication centre: announcements, expiry notices, schedule changes, offers, individual/group messages, sent log | 2 | Done | delivery = in-app, with real delivered/read counts. **No e-mail, SMS or push**; the screen says so |

## 4. Business features

| # | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 4.1 | At-risk members (14/30 days, configurable) | 5 | Done | thresholds in Settings |
| 4.2 | Membership growth analytics (new, renewed, lost, renewal rate, month comparison) | 5 | Done | |
| 4.3 | Gym and CrossFit scheduling | 4 | Done | |
| 4.4 | AI Business Assistant | 5 | Partial | **rules-based**, not a language model: keyword intents (English and Albanian) answered by database queries, with the records shown. It says so on screen and replies "I did not understand" instead of guessing |
| 4.5 | Monthly business report | 5 | Done | screen + Excel + PDF |

## 5-7. Structure and decisions

| # | Requirement | Status |
|---|---|---|
| 5 | One shared database/auth with three role interfaces | Done: member app (mobile), owner + reception + trainer (staff web; trainers also on mobile) |
| 7.1 | Payment automatically linked to membership, status updated, invoice visible in the app | Done (`finance.e2e`) |
| 7.2 | Trainer-assigned plan appears in the member app | Done (`coaching.e2e`) |
| 7.3 | Full process: register client -> assign package -> record payment -> activate membership -> check-in -> log workout -> reports updated | Done at API level (each link is an e2e test and they share the same records). Not walked through in one manual UI session |

## Cross-cutting

| Item | Status |
|---|---|
| Brand identity matches the official website | Done on the staff web app. Mobile uses the same colour/shape tokens but **does not load Sora/Manrope yet** (system font) |
| Shared design system (tokens, components, one icon family) | Done ([design-system.md](design-system.md)) |
| Mobile login fixed and verified | Done (see README, `npm run doctor`); a physical phone could not be tested here |
| Albanian / English UI | **Pending**: the website is Albanian-first; the apps are English only |
| Accessibility (contrast, focus, reduced motion, touch targets) | Partial: designed and checked by hand (AA contrast on derived tokens, focus, `prefers-reduced-motion`, 375 px layout). No automated audit (axe/Lighthouse) was run |
| Demo data | Done: idempotent, fictional, never for production ([demo-accounts.md](demo-accounts.md)) |

## Decisions the gym still has to make (nothing here is invented)

| Decision | Current behaviour |
|---|---|
| Real package prices | empty until the owner enters them; a package with no price is sold without an invoice |
| Freeze policy (maximum length, allowed times per year, fee) | no limit; setting exists (`maxFreezeDays`) |
| Duplicate-scan window | 10 minutes (configurable) |
| May unpaid members enter? | yes (switch `blockUnpaidCheckIn`, off by default) |
| Which package may book which classes (restrictions) | not enforced |
| "Expiring soon" / "at risk" thresholds | 7 / 14 / 30 days (configurable) |
| Invoice payment term | due the day it is issued (`invoiceDueDays` = 0) |
| E-mail / SMS / push provider, online payments, image storage provider | none configured; photos are stored in the database |
| Login rate limit at the gym's shared wifi | 5 per minute per IP: may need raising |

## Not done or not verified (read this)

- Phase 5: Muscle Map, Cardio/Recovery/Wellness, goals tracker, monthly progress charts, a real language-model
  assistant (the OpenAI path was never run).
- Mobile: photo upload and display, native PDF saving, membership history list, the document's schedule layout,
  custom fonts, Albanian text. None of the mobile screens was tested on a physical phone.
- No automated browser (end-to-end UI) tests; UI was verified by hand in a browser.
- Package restrictions by class type.
