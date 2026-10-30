# Design system

The product looks like the official website (https://illyrian-gym.vercel.app/). The values below were
**read from the website's rendered CSS and assets**, not guessed from screenshots, and live in one place:
[`packages/config/src/design-tokens.ts`](../packages/config/src/design-tokens.ts). The staff web app
(Tailwind) and the member mobile app (React Native) both import it, so a change there changes both.

## What was extracted from the website

| Token | Value | Where it comes from |
|---|---|---|
| Brand lime | `#bfff00` | primary buttons, active markers, accents |
| Ink | `#0a0d0b` (+ `#141a15`, `#1d241e` surfaces) | hero, nav rail, footer, the mobile app background |
| Mint canvas | `#f5f7f0` | light page background |
| Headings | **Sora 800**, letter-spacing `-0.05em` | every title, big numbers |
| Body | **Manrope** 400-800 | everything else |
| Eyebrow labels | uppercase, `0.22em` tracking, small bold | section labels above titles |
| Buttons | fully rounded (pill), bold | primary = lime fill with **ink** text |
| Cards | white, 1px border `rgba(10,13,11,.08)`, radius ~22px | content blocks |
| Imagery | the real logo and hero photograph | `apps/admin/public/brand/`, `apps/mobile/assets/brand/` |

## Derived tokens (contrast-checked)

Lime is a *light* colour: it is only used as a **fill** (with ink text on top) or as **text on dark**. For text
and links on the light canvas the system uses derived colours that were checked against WCAG AA:

| Token | Value | Use |
|---|---|---|
| `mossText` | `#4a6600` | brand-coloured text/links on light surfaces |
| `textMutedOnLight` | `#566057` | secondary text on the mint canvas |
| `limeTint` | lime at low opacity | soft backgrounds for icons and selected rows |

## Colour meaning

Red is **semantic only**. It is never used for navigation or decoration.

| Colour | Meaning |
|---|---|
| Green | active, paid, success |
| Amber | needs attention: expiring soon, pending, partial, unpaid but not yet overdue |
| Red | a problem or a destructive action: expired, overdue, suspended, void, "do not admit" |
| Blue | information |
| Cyan | frozen membership |
| Lime / ink | brand and navigation |

The badge components (`MembershipStatusBadge`, `PaymentStatusBadge`, `UserStatusBadge`) are the only place
these mappings are written, so a status looks the same on every screen.

## Layout

- **Staff web app**: dark ink navigation rail + light mint canvas. The rail is grouped (Overview, People,
  Money, Gym floor, Training, Communication, System) and shows only what the signed-in role may use.
  Collapsible on desktop; a drawer on phones.
- **Members and Memberships are separate entries** with different icons. "Active" is decided by exact route or
  child route (`isActive` in `apps/admin/src/lib/nav.ts`), so `/members` never highlights `/memberships`.
- **Mobile app**: dark ink theme with the same tokens; bottom tabs.

## Components (staff web)

`apps/admin/src/components/ui/`: `button`, `badge`, `field` (text/select/textarea/checkbox, with hints and
errors), `modal` (`Modal` + side `Drawer`, focus trap, Escape), `confirm-dialog`, `table` (sticky header,
sort, pagination, horizontal scroll inside the card), `states` (skeletons, empty, error), `tabs`
(arrow-key navigation), `toast`, `avatar`, `charts` (dependency-free SVG bar / line / donut with an
accessible data table for screen readers), `page-header` (eyebrow + title + actions, search, filters).
Money-specific building blocks are in `components/money/` (member picker, sell membership, record payment,
reason dialog, export buttons).

## Icons

One library per platform, same family: **Lucide** (`lucide-react` on the web, `lucide-react-native` on the
phone). No emoji and no mixed icon sets.

## Accessibility

- Contrast: text and controls meet AA on both the light canvas and the ink surfaces (see derived tokens).
- Focus: every interactive element has a visible focus style; dialogs trap focus and close on Escape;
  tablists support arrow keys; a "Skip to content" link is the first focusable element.
- Motion: animations are disabled under `prefers-reduced-motion`.
- Forms: every field has a visible label, hints/errors are linked with `aria-describedby`, errors use
  `role="alert"`, results that change (check-in outcome, assistant answers) use live regions.
- Charts never rely on colour alone and expose their numbers as a hidden table.
- Layout was checked at 375 px: no horizontal page scroll; wide tables scroll inside their card.

## Language

The website is Albanian-first with an English toggle; the apps are currently **English only** (the Business
assistant understands Albanian questions). Translating the UI is listed as pending in
[requirements-checklist.md](requirements-checklist.md).
