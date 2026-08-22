# KidSkill Connect — build spec

Companion to `CLAUDE.md`. This document holds the flows, screens and build order.
The schema is authoritative in `supabase/migrations/0001_init.sql`.

---

## 1. The two loops

Everything in this product is one of two loops. Keep them separate in your head.

**Setup loop — runs once per enrollment.**
Enquiry → acceptance → payment into escrow. Slow, deliberate, form-heavy on the trainer
side and near-frictionless on the parent side.

**Delivery loop — runs once per class, ~8 times a month.**
Trainer marks attendance with an assessment → trigger releases one class fee, split
between trainer and platform → parent's balance drops, timeline grows, both sides get a
feedback prompt. Fast, one-tap, mobile.

The delivery loop is where the product lives and where the demo lands. Optimise it.

---

## 2. Barrier to entry

A trainer account by itself grants nothing. Visibility is per category.

1. Trainer signs up, fills profile, sets a service radius and base location
2. Applies to a category — uploads a credential (certificate, competition record,
   employment letter) and sets their per-class rate for that category
3. Row lands in `trainer_categories` with `status = 'pending'`
4. Admin reviews and approves or rejects, with a reason
5. Only approved rows appear in search

A trainer can hold different rates in different categories — a music teacher may charge
more for advanced theory than for beginner keyboard. Rate lives on the category row, not
the trainer.

For the demo: seed most trainers as approved, leave two pending so the admin approval
screen has something real to act on.

---

## 3. Location matching

Store `geography(point, 4326)` on both `profiles` (parent) and `trainer_profiles`
(trainer base). Match is a `ST_DWithin` intersection constrained by the trainer's own
`service_radius_km` — a trainer who will only travel 5 km should not surface to a parent
12 km away even if the parent's slider is set wide.

Capture parent location once, via browser geolocation, with a map-pin fallback for denied
permission. Store an `area_label` alongside ("Kammanahalli") so the UI can say something
human without reverse-geocoding on every render.

Sort results by distance ascending by default. Show distance on every card — it is the
single most decision-relevant number for a parent, more than price.

---

## 4. Enquiry — parent-initiated only

One direction. A parent opens a trainer's profile, picks which child and which category,
and sends. The trainer accepts or declines. There is no trainer-side demand feed, no
"offer to teach", no negotiation thread.

This is deliberate. A trainer browsing children's profiles is a bad look for a
child-safety product and a judge will notice. Parents choose; trainers consent. Keep the
initiative on the side that has custody of the child.

On accept, an `enrollment` is created in `pending_payment` and both sides are notified.
A parent may withdraw an open enquiry — `enquiry_status` carries `withdrawn` for this.

---

## 5. Money

Four account types: `parent_wallet`, `escrow`, `trainer_earnings`, `platform_revenue`.
One `platform_revenue` account exists globally with a null owner.

**On payment** (`fund_enrollment` RPC) — two rows:
- `topup`: external → parent_wallet, full month amount
- `hold`: parent_wallet → escrow, full month amount

**On each verified session** (trigger) — two rows:
- `commission`: escrow → platform_revenue, `rate × commission_pct`
- `release`: escrow → trainer_earnings, the remainder

Default commission is 15%, stored per enrollment so it can be varied later without
rewriting history.

**Balances** come from `account_balances`. Parent's "classes remaining" is derived too:
`classes_per_month − count(sessions where a release exists)`.

At month end, any escrow remainder is a decision — see open questions.

**Writes that must go through RPCs.** `ledger_entries` and `enrollments` have no client
insert policy on purpose — they are written only by triggers and `security definer`
functions. The migration ships `fund_enrollment`. You still need to write
`accept_enquiry(enquiry_id, classes_per_month)`, which flips the enquiry to `accepted`,
copies the rate off the approved `trainer_categories` row, and creates the enrollment in
`pending_payment`. Write it before Phase 3 or the accept button has nowhere to go.

---

## 6. Screens

### Parent

| Screen | Notes |
|---|---|
| Onboarding | Phone OTP → name → add first child. Three steps, no more. |
| Home | The progress spine for the selected child. Child switcher if more than one. Balance and classes remaining as a quiet strip, not cards. |
| Search | Category chips, distance slider, live results. One screen, no submit. |
| Trainer profile | Photo, headline, approved-category badges with credentials, rate, distance, availability. One primary action: send enquiry. |
| Enquiry status | Thin — sent / accepted / declined. |
| Payment | Mock gateway. One button. Success state shows what was locked and what happens next. |
| Session detail | Opened from a spine entry: date, what was covered, skill rating, feedback box. |

### Trainer

| Screen | Notes |
|---|---|
| Onboarding | Longer. Profile, base location, service radius, then category applications with credential upload. |
| Today | Default landing. Today's classes as large tap targets. This is the money screen. |
| Mark attended | Attendance toggle, assessment note (required, min 10 chars), skill rating 1–5, optional focus areas. One submit. |
| Enquiries | Incoming requests with child age, category, area, distance. Accept or decline. |
| Earnings | Ledger of released amounts, net of commission, with the session each came from. |
| Categories | Application status per category, rate editing on approved ones. |

### Admin

| Screen | Notes |
|---|---|
| Approvals | Pending `trainer_categories` with credential preview. Approve or reject with reason. |
| Active services | The default landing screen. Every currently running accepted service, one row each. Backed by the `admin_active_services()` RPC. |
| Ledger | Every `ledger_entries` row, filterable by enrollment. Held vs released totals. |
| Enrollments | Full history including completed and cancelled, with a hold/refund action. |

**Active services** is the screen the stakeholder asked for, so build it properly. Each
row shows child, parent, trainer, category, area, classes delivered against classes
committed, and three money columns that must always sum to the committed amount: still in
escrow, released to trainer, platform earned. Plus last class marked and next class
scheduled.

Two things make it worth looking at rather than just correct. Subscribe it to
`ledger_entries` over realtime, so rows move while the admin is watching — during the
demo the trainer marks attendance and the admin screen updates in the same second. And
flag rows where `next_class_at` is in the past or `last_class_at` is more than ten days
old: that is a stalled service holding a parent's money, which is exactly the thing an
admin exists to catch.

---

## 7. Notifications — Twilio WhatsApp sandbox

Yes, the sandbox is usable for the MVP. It needs no WhatsApp Business Account and no
Meta approval, and it works the day you sign up. Six constraints shape how you build
against it:

1. **Recipients must join first.** Everyone who will receive a message sends
   `join <your-keyword>` to the shared sandbox number `+1 415 523 8886`. Anyone who
   hasn't joined fails with error `63015`.
2. **The join expires after three days.** Re-join every device the morning of the demo.
   This is the single most likely thing to break your pitch.
3. **Free-form only inside a 24-hour session.** Once a user messages in, you have 24
   hours of free-form replies. Business-initiated messages outside that window must use
   a pre-approved template. Since your demo devices will have just joined, free-form
   works — but write the templates anyway, because production needs them.
4. **One message every three seconds.** Fire notifications through a queue, not in a
   loop. Accepting an enquiry that notifies both sides plus admin is three messages —
   naive code will drop two.
5. **Shared number, Twilio-branded.** Messages arrive from a Twilio number with the
   Twilio logo, not from KidSkill. Fine for a demo, worth acknowledging if a judge asks.
6. **Trial accounts include 100 free WhatsApp messages.** Beyond that it bills at
   standard rates. Plenty for a hackathon; do not leave a reminder cron running after.

Twilio is explicit that the sandbox is for testing and discovery, not production. So the
architecture is a provider interface, not a Twilio dependency:

```ts
interface NotificationProvider {
  send(to: string, template: TemplateKey, payload: Record<string, unknown>): Promise<SendResult>
}
```

`InAppProvider` writes to the `notifications` table and renders a WhatsApp-styled thread
inside the app. `TwilioWhatsAppProvider` calls the sandbox and also writes the row. Both
always write the row — that way the in-app thread stays truthful, and if the venue wifi
or Twilio flakes mid-pitch you flip an env var and the demo still works. Set
`NOTIFY_PROVIDER=inapp|twilio`.

Log the Twilio `MessageSid` and status callback into `notifications.payload` so the admin
screen can show delivery state rather than assuming it.

Templates needed: enquiry received, enquiry accepted, payment confirmed, class reminder
(T-2h), class completed with assessment summary, feedback request.

---

## 8. Build order

Rough hours assume two people. Adjust to the actual window.

**Phase 0 — foundation (2h).** Next.js + Supabase wired. Run the migration. Seed data:
10 trainers across real Bangalore neighbourhoods with real coordinates, 6 categories,
2 parents, 3 children, 2 pending category applications. Auth working for all three roles.

**Phase 1 — the spine (3h).** Parent home with the progress timeline, rendering seeded
assessment entries. Build this before search. It is the signature element and everything
else is scaffolding around it.

**Phase 2 — discovery (3h).** `search_trainers` RPC, the single-screen search, trainer
profile page. Distance sorting visibly correct.

**Phase 3 — the money loop (4h).** Enquiry, accept, mock payment, `fund_enrollment`,
sessions generated for the month, trainer's Today screen, mark-attended with assessment,
trigger firing, balances moving. This is the core — do not start it late.

**Phase 4 — realtime (1.5h).** Subscribe parent dashboard to `sessions` and
`ledger_entries`. Verify the cross-device update on two real browsers, not two tabs.

**Phase 5 — admin (2.5h).** Active services monitor first, then approvals queue, then
the raw ledger view. The monitor is the screen that gets demoed.

**Phase 6 — notifications + feedback (2.5h).** Provider interface, in-app implementation
and the WhatsApp-styled thread, then the Twilio sandbox behind `NOTIFY_PROVIDER`. Join
your demo devices to the sandbox on day one so you find problems early, then re-join on
demo morning. Feedback prompts on both sides last.

**Phase 7 — polish (remaining).** Empty states, loading skeletons, the pitch narrative,
and a full dry run of the seven-step demo path at least three times.

Cut in this order if time runs short: feedback, admin enrollments history, Twilio (the
in-app thread carries the demo alone), admin approvals queue. Never cut phases 1, 3, 4,
or the active services monitor.

---

## 9. Open decisions — settle these before Phase 3

1. **Auto-release or admin-approved?** The trigger currently auto-releases with admin
   override. If the stakeholder wants admin to actively approve each release, that is a
   different trigger and a different demo. Confirm before building.
2. **No-show.** Trainer arrived, child didn't. Does the trainer get paid? Recommendation:
   yes, with the trainer required to log a no-show note, and the parent notified. Needs
   an explicit `no_show` release path if agreed.
3. **Unused classes at month end.** Roll over, refund to wallet, or expire? Rolling over
   is kindest and simplest to implement — escrow just carries.
4. **Commission rate** — 15% assumed. Confirm, and confirm whether it varies by category.
5. **Trainer identity verification.** Category credentials are covered. A background or
   ID check is a separate and, for a child-facing product, more important gate. At
   minimum ship an `id_verified` boolean with an admin toggle so the badge exists.
6. **Cancellation window** — how late can either side cancel without penalty?

---

## 10. Pitch framing

The social-impact argument is not "we connect parents and trainers" — that is a
marketplace. It is that six months of trainer assessment notes become a documented skill
history for a child who otherwise has none, and that local trainers, retired athletes,
homemakers with real skill, get verified income and a reputation they can carry.

The mechanism that makes both true is the same one line of code: money only moves when a
learning artifact is created. Lead the pitch with that, then show the spine.
