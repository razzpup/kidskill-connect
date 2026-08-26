# KidSkill Connect

Three-sided marketplace matching parents with vetted local trainers for kids' hobbies,
sports and talents. Trainers set their own per-class rate; the platform takes a
commission at payout. Hackathon build — demo-first, but the money logic is real.

Full detail: `docs/spec.md`. Schema of record: `supabase/migrations/0001_init.sql`.

## Roles

| Role | Does |
|---|---|
| Parent | Manages child profiles, searches trainers by location + category, sends or receives enquiries, pays a monthly commitment, reads the progress timeline |
| Trainer | Applies per category with credentials, sets rate, accepts enquiries, marks attendance + writes assessments, watches earnings accrue |
| Admin | Approves trainer category applications, monitors every currently running service live, sees every ledger entry, can hold or refund |

## Invariants — do not violate these

1. **Balances are never stored.** Every rupee is a row in `ledger_entries`. Balances
   come from the `account_balances` view. Never add a `balance` column anywhere.
2. **Money moves only on a verified session.** The escrow → trainer release is fired by
   a Postgres trigger when a session flips to `attended` *and* carries an assessment
   note of at least 10 characters. Never release from application code.
3. **Marking attendance is one atomic update.** Status and assessment note go in the
   same `UPDATE`. There is no "mark attended now, write the note later" path — the
   trigger will reject it.
4. **Releases are idempotent.** The trigger checks for an existing `release` entry on
   that session before inserting. Re-running must never double-pay.
5. **Only approved categories are searchable.** A trainer appears in results for a
   category only where `trainer_categories.status = 'approved'`. This is the barrier
   to entry and it is a hard filter in the search RPC, not a UI concern.

   **Suspended for the current demo** (migrations 0021–0022, deliberate and temporary):
   `pending` categories are searchable and bookable too, so a coach is discoverable the
   moment they apply rather than after admin reviews them. The admin approvals queue
   still functions for real — approving still flips the status and the UI still shows
   the difference (an `ApprovedBadge` vs. an "Application pending" chip) — it just isn't
   the search/booking gate right now. `rejected` still never surfaces. To restore the
   real rule: put `status = 'approved'` back in `search_trainers`, `book_slots`,
   `send_enquiry`, `accept_enquiry`, and `trainerDetail`'s category filter
   (`lib/db/parent.ts`).
6. **Commission is split at release**, not at payment. One release produces two ledger
   rows: escrow → trainer (net) and escrow → platform (commission).

## Stack

- Next.js 15, App Router, TypeScript, server components by default
- Supabase — Postgres + PostGIS, Auth (phone OTP), Realtime, Row Level Security
- Tailwind CSS v4. No component library; hand-build.
- Notifications through a `NotificationProvider` interface, selected by `NOTIFY_PROVIDER`.
  Both implementations always write the `notifications` row; Twilio additionally sends.
  Twilio WhatsApp sandbox is fine for the MVP — see `docs/spec.md` §7 for its six
  constraints, of which the three-day join expiry is the one that will bite you.

Realtime is not optional — it is the demo's central moment. The trainer marking
attendance on one device must visibly update the parent's dashboard on another with
no refresh. Subscribe to `sessions` and `ledger_entries`.

## Design direction

Two surfaces, deliberately different, sharing one accent.

**Parent app — light.** Used occasionally, on a phone, in daylight, by someone deciding
whether to trust a stranger with their child. Calm and legible wins.

```
--paper    #F2F4F1   page
--card     #FFFFFF   surfaces
--ink      #1A2420   primary text
--muted    #6B7670   secondary text
--grass    #2F6F4E   primary action, growth, progress
--marigold #F0B429   money states only — escrow, released, balance
--line     #DDE2DC   hairlines
```

**Trainer + admin dashboards — dark.** Lived in daily, dense, data-heavy.

```
--base   #121512   page
--panel  #1C211D   surfaces
--ink    #E8EDE7   primary text
--muted  #8A948C   secondary text
--grass  #4E9B72   actions
--marigold #F0B429 money states only
--line   #2A312C   hairlines
```

Marigold is reserved for money. If it appears on a non-financial element, that is a bug.

**Type** — Fontshare only, self-hosted. Cabinet Grotesk for display and headings,
Switzer for UI and body. Numbers use Switzer with `font-variant-numeric: tabular-nums`
so ledger columns align. No Google Fonts. No monospace for labels or explanatory text.

**Signature element** — the parent dashboard's hero is the child's progress spine: a
vertical dated timeline of assessment entries, newest at top, each showing what the kid
worked on and the skill rating. Not a stats row, not KPI cards. The spine is the product's
whole argument — a kid ends up with a documented skill history that otherwise wouldn't
exist. Build it first and build it well.

## UX mandate

The brief is explicit: fast, smooth, simple, and light on forms for the parent side.

- Parent onboarding is phone OTP, then name, then one child. Three screens. Everything
  else is inferred or asked later in context.
- Search is a single screen: category chips + a distance slider, results updating live.
  No separate filter page, no submit button, no results page navigation.
- Never ask for the same fact twice. Location is captured once via browser geolocation
  with a manual pin fallback, then reused.
- Trainer onboarding is allowed to be longer — vetting justifies friction, and it's a
  trust signal for parents. Put the friction on the side that benefits from it.

## Code conventions

- Server components fetch; client components only where interaction demands it
- Money is `numeric(12,2)` in Postgres and integer paise in TypeScript. Never float.
- All DB access through typed helpers in `lib/db/`. No inline Supabase calls in pages.
- RLS is on for every table. Test as parent, trainer and admin separately.
- Seed data lives in `supabase/seed.sql` — 16 trainers spread across real Bangalore
  neighbourhoods and across music, dance, sports, chess and arts categories, so distance
  sorting and category breadth both visibly work in the demo.

## Out of scope — do not build

In-app chat, public reviews or star ratings, recommendation algorithms,
trainer-initiated enquiries or any trainer-side feed of children, group classes,
multi-child bundle pricing, native mobile app, real payment gateway integration. If a task drifts toward any of these, stop and flag it.

Video calling is a deliberate exception: a class's video call is embedded via Jitsi's
free public server (`components/VideoCall.tsx`), room name derived from the session id
so both sides land in the same room. No recording, no waiting room, no account — same
trust model as handing someone a meeting link, just rendered inside the app instead of
sent to one. Don't build anything beyond that (recording, scheduling integration, a
dedicated call history) without the same kind of explicit go-ahead.

## Demo path

The one flow that must be flawless, in order:

1. Parent searches "Karnatic vocal" within 5 km — results sort by distance
2. Opens a trainer, sees approved-category badge and credentials, sends an enquiry
3. Trainer (second window) sees it arrive live, accepts
4. Parent pays the month — mock gateway, instant — wallet shows held amount + 8 credits
5. Trainer opens today's class, marks attended, writes the assessment, submits
6. Parent's screen updates without refresh: balance drops, credit spent, new entry on
   the progress spine, WhatsApp-style notification appears
7. Admin's active services screen — already open on a third window — updates in the same
   second, and the ledger shows both rows: trainer net and platform commission

Every task should be judged against whether it makes this seven-step path better.
