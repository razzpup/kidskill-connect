# KidSkill Connect

Three-sided marketplace matching parents with vetted local trainers for kids' hobbies,
sports and talents. Money moves only when a class is actually taught.

The design brief is in `CLAUDE.md`, the flows and build order in `docs/spec.md`, and the
schema of record in `supabase/migrations/0001_init.sql`.

---

## Running it

Needs Docker Desktop and Node 20+.

```bash
npm install
npx supabase start          # first run pulls ~4 GB of images
npm run dev                 # http://localhost:3002
npm test                    # money and commission maths
```

`supabase start` prints an anon key and a service-role key. Put them in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
NOTIFY_PROVIDER=inapp
NEXT_PUBLIC_DEMO_OTP=123456
```

To reload the schema and reseed: `npm run db:reset`.

### Ports

This project runs on **544xx**, not the Supabase default 543xx, because another local
Supabase project (`kotsaas`) is already using those ports on this machine, and the Next
dev server is pinned to **3002** for the same reason. Both projects can run at once.

| | |
|---|---|
| App | `3002` |
| API gateway | `54421` |
| Postgres | `54422` |
| Studio | `54423` |

Storage, edge functions and analytics are switched off in `supabase/config.toml`. Nothing
in this product uploads a file, every write goes through a Postgres RPC rather than an
edge function, and Logflare is several hundred megabytes of images for logs nobody reads
during a hackathon. Turn them back on there if you need them.

### Demoing on real devices (ngrok)

Three terminals:

```bash
npm run dev        # Next on 3002
npm run proxy      # reverse proxy on 3003
npm run tunnel     # ngrok -> 3003, prints the public URL
```

Then point the **browser** at the tunnel and leave the **server** on loopback:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-domain>.ngrok-free.dev/supabase
SUPABASE_INTERNAL_URL=http://127.0.0.1:54421
```

and restart `npm run dev` so it picks the values up.

Why a proxy rather than just tunnelling port 3002: the browser talks to Supabase
directly. Sign-in, the search RPC and the realtime websocket all go device → Kong
without passing through Next, so `127.0.0.1:54421` on a phone is that phone's own
loopback. ngrok's free plan gives one domain, so `scripts/demo-proxy.mjs` puts both
behind a single origin — `/supabase/*` to Kong, everything else to Next — and forwards
websocket upgrades, which a Next `rewrites` rule cannot do.

Two details that bite otherwise, both already handled:

- **The session cookie is pinned** to `sb-kidskill-auth` in `lib/supabase/config.ts`.
  By default @supabase/ssr derives the cookie name from the Supabase hostname; with the
  browser on a tunnel domain and the server on loopback the two names disagree and every
  page renders signed-out.
- **ngrok's free interstitial** returns HTML to the browser's first API call. The
  browser client sends `ngrok-skip-browser-warning`, which is inert without a tunnel.

> **The tunnel is public and unauthenticated.** The sign-in screen lists the demo
> accounts and `NEXT_PUBLIC_DEMO_OTP` shows the code, so anyone with the URL can sign in
> as any seeded user, including the admin. That is fine for a hackathon demo and wrong
> for anything else — stop the tunnel when you are not demoing.

### Signing in

Auth is real Supabase phone OTP. Locally the code is pinned per number in
`supabase/config.toml` under `[auth.sms.test_otp]`, so no SMS provider is involved and
no message is sent. The sign-in screen lists the demo accounts; the code is always
`123456`.

| Role | Phone |
|---|---|
| Parent — Anitha Rao, Kammanahalli | `+91 98765 00001` |
| Parent — Vikram Shetty, Indiranagar | `+91 98765 00002` |
| Trainer — Lakshmi Narayanan, Carnatic vocal | `+91 98765 10001` |
| Trainer — Priya Menon, Sketching | `+91 98765 10005` |
| Admin — Meera Kulkarni | `+91 98765 90001` |

Trainers 3 through 10 are `+91 98765 1000<n>`.

---

## The money rule

Balances are never stored. Every rupee is a row in `ledger_entries`; balances come from
the `account_balances` view. There is no `balance` column anywhere and adding one is a
regression, not an optimisation.

The escrow → trainer release is fired by a Postgres trigger when a session flips to
`attended` **and** carries an assessment note of at least ten characters. Application
code never releases money. One release writes exactly two rows — escrow → trainer at the
net rate, and escrow → platform at the commission — and re-running is idempotent, because
the trigger checks for an existing `release` on that session before inserting.

The seed proves this rather than asserting it: it creates its history by calling
`fund_enrollment()` and then `UPDATE`ing sessions to `attended`, so every seeded rupee is
trigger-authored. It then checks the resulting totals and fails loudly if they are wrong.
If the trigger regresses, `npm run db:reset` stops working.

---

## What lives where

```
app/
  sign-in/            phone OTP, three steps total for a parent
  onboarding/         name + location, then one child
  parent/             light surface — spine, search, trainer, pay, wallet, messages
  trainer/            dark surface — today, enquiries, earnings, categories
  admin/              dark surface — active services, approvals, ledger, enrollments
components/
  ProgressSpine.tsx   the signature element
  ui.tsx              Money, SkillMeter, chips, icons — no component library
lib/
  db/                 every database call in the product; pages hold none
  db/embeds.ts        the one PostgREST join that is not obvious — see its header
  service-health.ts   stalled-service rule, client-safe so the monitor can import it
  notify/             NotificationProvider interface + templates
  money.ts            numeric(12,2) ↔ integer paise, never float
  realtime.ts         subscribe, then re-render on the server
supabase/
  migrations/0001     schema, triggers, RLS, search + admin RPCs
  migrations/0002     the writes 0001 left unwritten, plus realtime publication
  migrations/0003     table privileges — see below
  migrations/0004     a trainer may read the children they actually teach
  seed.sql            10 Bangalore trainers, two funded enrollments, eight verified classes
```

### Grants are not optional

Recent Supabase images are secure-by-default: a table created in `public` lands with no
SELECT, INSERT or UPDATE for `authenticated`, so its RLS policies are never reached at
all — every query fails with `permission denied` before a policy is consulted.
`0003_grants.sql` states the privileges explicitly, one table at a time. Read its DML
columns as the real access-control summary, because the interesting part is what is
*not* granted:

- `ledger_entries` — SELECT only. No client role can insert, update or delete a ledger
  row, which is the balances invariant made structural rather than merely intended.
- `enrollments` — SELECT only. They are created by `accept_enquiry()` and activated by
  `fund_enrollment()`, so no client can invent a rate for themselves.
- `sessions` — SELECT and UPDATE, never INSERT. The month's classes are generated by
  `fund_enrollment()`.
- Nothing at all is granted to `anon`.

### A trainer sees only their own pupils

`children` belongs to its parent. `0004` lets a trainer read a child's row only where
that parent has already created the relationship — an enrollment, or an open or accepted
enquiry. It is granted per child, never to trainers as a role, so there is no query a
trainer can write that returns a list of children in general. Withdrawn and declined
enquiries stop disclosing.

---

## Realtime

`sessions`, `ledger_entries`, `enrollments`, `enquiries` and `notifications` are in the
`supabase_realtime` publication with `replica identity full`.

Subscriptions call `router.refresh()` rather than patching client state. The server
component re-reads the database, so escrow, credits, the spine and the ledger all move
together and stay consistent — which a client-side patch cannot guarantee, because it
would have to guess what the trigger did.

Verify it on two real browsers, not two tabs of one.

---

## Notifications

`NOTIFY_PROVIDER=inapp|twilio`.

Every notification row is written inside the database by the transaction that caused it,
so the in-app thread is complete before any provider is consulted and stays complete if
one fails. The provider's job is to deliver rows and record what happened. Flip to
`inapp` and the demo still works with no network at all.

The Twilio WhatsApp sandbox needs six things kept in mind — see `docs/spec.md` §7. Two
bite hardest:

- **Recipients must send `join <keyword>` to +1 415 523 8886, and that expires after
  three days.** Re-join every demo device on the morning of the pitch.
- **One message every three seconds.** The provider serialises sends through a chain with
  a 3.2 s gap; a naive loop drops messages silently.

Failures are recorded verbatim on the notification row, including Twilio error `63015`,
so the thread says "not delivered — recipient has not joined the sandbox" instead of
pretending it sent.

---

## Conventions

- Server components fetch; client components only where interaction demands it.
- Money is `numeric(12,2)` in Postgres and integer paise in TypeScript. `lib/money.ts`
  converts on the digits, never through a float.
- All database access goes through `lib/db/`. No inline Supabase calls in pages.
- RLS is on for every table, and every table has explicit grants. Test as parent,
  trainer and admin separately — a policy that is never reached looks identical to a
  policy that denies.
- Marigold `#F0B429` is reserved for money. On a non-financial element it is a bug.

---

## Out of scope

In-app chat, video calls, public reviews or star ratings, recommendation algorithms,
trainer-initiated enquiries or any trainer-side feed of children, group classes,
multi-child bundle pricing, native mobile app, real payment gateway integration.
