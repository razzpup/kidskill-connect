# The seven-step demo path

Three browser windows, on three devices if possible. Run it end to end at least three
times before pitching. The whole thing takes about ninety seconds.

**Before you start**

```bash
npm run db:reset     # back to a known state — takes about 20 seconds
npm run dev          # http://localhost:3002
```

If you are demoing WhatsApp, re-join every device to the Twilio sandbox this morning.
The join expires after three days and this is the single most likely thing to break the
pitch. If the venue wifi looks bad, set `NOTIFY_PROVIDER=inapp` and restart — the in-app
thread carries the demo alone.

| Window | Sign in as | Land on |
|---|---|---|
| A — parent | `+91 98765 00001` (Anitha) | `/parent` |
| B — trainer | `+91 98765 10001` (Lakshmi) | `/trainer` |
| C — admin | `+91 98765 90001` (Meera) | `/admin` |

Code is `123456` everywhere. Leave B and C open and visible; the point of steps 6 and 7
is that nobody touches them.

---

### 1 · Search

**Window A** → Find → tap **Carnatic vocal**, drag the slider to **5 km**.

Results reorder live as the slider moves. Nearest first: Lakshmi at 1.0 km, Deepa at
1.3 km. Ravi is a stronger teacher on paper but sits at 7.6 km and does not appear until
you widen the slider — and Manjunath never appears at any width, because his own service
radius is 7 km and Anitha is 9.2 km away.

> Say: the radius is a two-way constraint. A trainer who will not travel to you is not a
> result you should have to filter out yourself.

### 2 · Enquire

Open **Lakshmi Narayanan**.

The approved-category badge and the credential behind it are on the page in full —
*Certificate of completion, Vidwan course, 2006. Letter of study from Vidwan R. K.
Srikantan.* That text was read by an admin before she became visible.

**Send enquiry** → pick **Aarav** → send.

> Say: enquiries only go this direction. There is no trainer-side feed of children.

### 3 · Accept — live

**Window B** was already open on Today. The enquiry has arrived without a refresh.

Go to **Enquiries**, leave it at 8 classes, **Accept**.

### 4 · Pay

**Window A** → the accepted enquiry is on the home screen. Tap it → **Pay ₹6,400**.

The success state is the argument: *held, not spent*. Escrow shows ₹6,400, credits show
8, and the four steps that follow are spelled out.

### 5 · Mark the class

**Window B** → Today now has Aarav's class. **Mark attended**.

Write a real assessment — the submit button stays disabled under ten characters and the
counter says why. Pick a skill rating. Submit.

> Say: this is one atomic update. There is no path where a trainer marks attendance now
> and writes the note later, because the trigger that releases the money reads both in
> the same statement.

### 6 · Watch window A — do not touch it

Without a refresh:

- escrow drops ₹6,400 → ₹5,600
- credits 8 → 7
- a new entry lands at the top of the progress spine, animating in
- the spine's rail thickens at that point, because the rating was recorded
- a WhatsApp-styled message appears under the chat icon

### 7 · Watch window C — do not touch it either

The active services row for Aarav moves in the same second: delivered 0/8 → 1/8, escrow
down, to-trainer up ₹680, platform up ₹120. The row flashes so you can see which one
changed.

Open **Ledger**. Both rows are there — *escrow → trainer, ₹680* and *escrow → platform,
₹120* — written by the trigger, in the same transaction, from one `UPDATE`.

---

## The close

> Every rupee in this system is a row in a ledger, and no row is written unless a
> learning artifact was created first. That one rule is what makes both halves of the
> pitch true at once: the trainer gets verified income, and the child ends up with six
> months of written assessments that would otherwise not exist anywhere.

Then go back to window A and scroll the spine. Aarav has five sketching entries from
Priya and now a vocal entry from Lakshmi — a record that follows the child, not the
trainer.

---

## Two things worth showing if there is time

**The stall detector.** `/admin` flags any service holding a parent's money with nothing
happening against it — next class in the past, or nothing marked for ten days. Sorted to
the top, marked in the left border. That is the failure mode an escrow marketplace
actually has.

**The approvals queue.** `/admin/approvals` has two real pending applications. Anand
claims eight years of Carnatic training with no certificate; Girish runs a school chess
club with no coaching qualification. Reject one with a reason and show the trainer's
Categories screen — the reason is there, and they are still not in search results.

---

## If something breaks

| Symptom | Fix |
|---|---|
| Nothing updates live | Check the browser console for a realtime subscription error. `npm run db:reset` re-adds the tables to the publication. |
| "Recipient has not joined the sandbox (63015)" | The three-day join expired. Re-join, or set `NOTIFY_PROVIDER=inapp` and restart. |
| Payment fails | The enrollment is probably already funded. `npm run db:reset`. |
| Trainer sees no class today | `fund_enrollment` schedules weekly from today, so class one is today. If you reset yesterday, reset again. |
| Docker hangs | Check free disk space first. A full disk remounts the Docker VM read-only, and every docker command then hangs rather than failing. |
| Port already allocated | Another local Supabase project is running. This one is on 544xx and the app on 3002, so both can coexist — but check nothing else took those. |
