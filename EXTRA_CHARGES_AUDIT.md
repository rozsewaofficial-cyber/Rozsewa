# Extra-Charges Multi-Round Flow — Bug/Blocker Audit

Scope: the extra-charges rewrite done earlier this session (allows a provider to submit
multiple rounds of extra-service/spare-parts requests between a booking's start-OTP and
completion-OTP, instead of being limited to exactly one round ever). This audit covers
only that change and the files it touches — not the wider codebase.

Files in scope: `backend/models/Booking.js`, `backend/controllers/bookingController.js`,
`frontend/src/modules/provider/components/RecentBookingsList.jsx`,
`frontend/src/modules/user/pages/LiveTracking.jsx`,
`frontend/src/modules/user/pages/PostService.jsx`,
`frontend/src/modules/user/pages/ServiceHistory.jsx`.

Method: parallel sub-agent review (partially interrupted by a session rate limit — two of
three agents produced no output; one produced partial findings) + direct manual review to
fill every gap, then verified against `git diff`. All findings below were independently
confirmed by reading the actual code, not just agent claims. **All bugs found have already
been fixed** as part of this audit — this file is a record of what was wrong and why.

---

## Bugs found and fixed during this audit

### 1. BLOCKER (fixed) — Night Charge double-counted into the customer's actual payment amount
**File:** `frontend/src/modules/user/pages/PostService.jsx`, `approvedExtraTotal` (~line 161)
**Also latent in:** `frontend/src/modules/user/pages/LiveTracking.jsx`, dead `handleRazorpayPayment` (~line 127)

`booking.totalAmount` already has the night-charge amount baked in at booking creation
(`finalTotalAmount = payableAmount + nightChargeAmount + gstAmount + platformFee`). The
Night Charge is *also* recorded as its own `extraCharges` entry, now tagged
`status: 'approved'` by this session's schema change. `PostService.jsx`'s
`approvedExtraTotal` summed **every** approved `extraCharges` entry — including that Night
Charge line — and added it on top of `baseAmount = booking.totalAmount`, which already
contained it.

**Failure scenario:** any night-time booking → customer reaches the post-service payment
screen → "Total Payable" and the actual amount sent to `/payment/order` for Razorpay both
include the night charge twice → real overcharge.

**Fix applied:** `approvedExtraTotal` now excludes entries whose `item` string contains
`"Night Charge"` or `"Travel Charge"` (mirroring the exclusion pattern already used in
`RecentBookingsList.jsx`'s "Total Bill" calc, which was correct). Same fix applied to the
LiveTracking.jsx dead code path (currently unreachable — its payment UI was removed per an
existing comment, "provider will collect payment" — but fixed for when/if it's re-enabled)
and to the "Accepted Extra Charges" informational card in `LiveTracking.jsx`, which was
also misleadingly listing the Night Charge as if it were a separate provider-added item.

---

### 2. BUG (fixed) — `handleRemoveExtraCharge` could permanently wedge a booking in "pending"
**File:** `frontend/src/modules/provider/components/RecentBookingsList.jsx` (~line 477)
**Also fixed defensively in:** `backend/controllers/bookingController.js` (~line 1388)

`handleRemoveExtraCharge` computed the new `extraStatus` to send as
`updatedCharges.length === 0 ? 'none' : 'pending'` — i.e. it checked the **total array
length**, not whether anything remaining was actually still pending. That was correct
under the old single-round design (the array could only ever contain one round's worth of
items), but breaks under the new multi-round design: if round 1 was already approved
(leaving one *approved* item in the array) and the provider removes their just-added,
still-pending round-2 item, the array length is 1 (not 0), so this sent
`extraStatus: 'pending'` even though nothing was actually pending anymore.

**Failure scenario:** provider adds a round-2 item, then removes it before the customer
acts → booking gets stuck reporting `extraStatus: 'pending'` forever → `verifyEndOTP`
permanently refuses to let the job complete, and the customer sees an approval card with
nothing in it to approve.

**Fix applied:** two layers —
1. **Backend (primary fix):** the handler no longer trusts the client's literal
   `extraStatus` value for the pending/none branch. It now always re-derives
   `booking.extraStatus` from the actual array (`extraCharges.some(c => c.status === 'pending')`),
   so no caller — this one or any future one — can desync the flag from reality.
2. **Frontend (defense in depth):** `handleRemoveExtraCharge` now computes the value it
   sends the same way (`updatedCharges.some(c => c.status === 'pending')`), so the code
   isn't left visibly wrong even though the backend now makes the mistake harmless.

---

### 3. BUG (fixed) — Concurrent extra-charges actions surfaced as an opaque 500
**File:** `backend/controllers/bookingController.js`, outer catch of `updateBookingStatusByProvider` (~line 1703)
**Also fixed:** the 4 frontend call sites that hit this endpoint for extra-charges actions — `RecentBookingsList.jsx`'s `submitExtraCharges` and `handleRemoveExtraCharge`, `LiveTracking.jsx`'s `handleExtraAction`, `PostService.jsx`'s `handleExtraAction`.

This was originally listed below as an unfixed "known limitation." On reflection it was
cheap and directly in scope to fix, so it's fixed now rather than deferred. The handler
uses a fetch-then-mutate-then-`.save()` pattern; Mongoose's default `__v` version checking
(the `Booking` schema doesn't disable it) throws a `VersionError` if two requests race on
the same document — e.g. a provider submitting round 2 at the same instant the customer
approves round 1. That error was falling through to the handler's generic
`catch (error) { res.status(500)... }`, surfacing as an unhelpful "Failed to add
charges"/"Failed to update" toast with no path forward for the user.

**Fix applied:** the outer catch now recognizes `error.name === 'VersionError'` specifically
and returns `409` with a clear message ("This booking was just updated. Please refresh and
try again."). All 4 frontend call sites now detect a `409` response and both show that
message *and* immediately refetch the booking, so the UI self-heals to the latest state
instead of leaving the user stuck. This doesn't retry the original action automatically
(deliberately — retrying the whole handler is unsafe given several non-idempotent side
effects earlier in the same function, like notifications and socket emits), but it turns a
dead-end error into a normal "just try again" flow.

---

## Correction to this document

An earlier version of this file claimed `PostService.jsx` had no real-time listener for a
new pending extra-charges round. That was **wrong** — it re-checked and found
`PostService.jsx` already has a correct `socket.on("EXTRA_CHARGES_PENDING", ...)` listener
(~line 84) that triggers an immediate refetch. No fix was needed there.

While correcting this, a different, genuine (but pre-existing, unrelated to this session's
change) issue turned up: `LiveTracking.jsx` listens for `EXTRA_CHARGES_PENDING` via
`window.addEventListener(...)` (~line 441) — a plain DOM `CustomEvent` — but nothing in the
codebase ever calls `window.dispatchEvent(new CustomEvent("EXTRA_CHARGES_PENDING", ...))`.
That listener is dead code and never fires. It's harmless in practice only because the same
file also polls `fetchBookingStatus` every 3 seconds (`setInterval`, ~line 341), which picks
up a new pending round within a few seconds regardless. Left as-is: it's outside this
session's scope (not part of the extra-charges rewrite, and the polling fallback means
there's no user-facing symptom), but noted here so it isn't mistaken for working code later.

---

## Areas checked and confirmed OK (no fix needed)

- **Persistence correctness:** `updateBookingStatusByProvider` fetches `booking` via
  `Booking.findById` (a real hydrated document, not `.lean()`), so in-place mutation of
  `extraCharges[i].status` is tracked by Mongoose's normal subdocument change-detection.
  `markModified('extraCharges')` was added defensively but is not strictly required — safe,
  not a bug. Traced the control flow to confirm no early return between the extraStatus
  block and the function's final `booking.save()` (line ~1523) for an extraStatus-only
  request; the one mid-function document re-fetch (line ~1238) only fires when a provider
  is claiming a brand-new unclaimed booking, not reachable from the extra-charges flow.
- **Every `extraCharges` construction site** in the backend (`createBooking`, and the two
  counter-offer/fixed-price Night Charge rewrite sites) explicitly sets
  `status: 'approved'` — confirmed via a full-file grep, no site was missed.
- **`DistanceChargeService`** only ever *filters out* stale `"Travel Charge"` entries, never
  adds one — a "Travel Charge" `extraCharges` entry is dead/unreachable in the current
  codebase (the real travel charge lives on the separate `booking.travelCharge` field).
  Pre-existing, unrelated to this change; the `!item.includes('Travel Charge')` guards
  added throughout are inert-but-harmless defensive parity with the Night Charge handling.
- **Backward compatibility with pre-migration bookings** (an `extraCharges` entry saved
  before this session, with no `status` field at all — schema `default` only applies to
  newly-created subdocuments, not retroactively): verified every filter added across all 4
  frontend files treats `undefined` the same as `'approved'` (all use
  `status !== 'declined' && status !== 'pending'`, never a strict `=== 'approved'` check),
  so legacy entries display and bill correctly. Also noted: the moment a legacy booking's
  `extraCharges` array is reassigned wholesale (e.g. via the provider's pending-round
  submission path, which does `booking.extraCharges = req.body.extraCharges`), Mongoose
  re-casts each element through the subdocument schema and backfills the `'approved'`
  default — a free, automatic migration on next write.
- **`ServiceHistory.jsx`** — re-derived the arithmetic for all 4 touched spots (list total,
  invoice `basePrice`, invoice line-items, detail-modal payment breakdown) by hand with
  concrete numbers. Unlike `PostService.jsx`, this file already explicitly *subtracts* all
  itemized extras (Night Charge included) from the total to get a "base price" and then
  re-lists them separately — internally consistent, no double-count.
- **`IncomingRequestModal.jsx`** — only reads Travel/Night Charge (always `'approved'`,
  never touched by the new pending/declined logic) during pre-acceptance counter-offer
  negotiation, before a job even starts. Not affected by this change.
- **`verifyEndOTP`'s completion gate** (`if (booking.extraStatus === 'pending') return 400`)
  still works unchanged and correctly blocks completion while any round is unresolved.

---

## Known limitation (not fixed — genuinely out of scope)

- **`LiveTracking.jsx`'s dead `EXTRA_CHARGES_PENDING` window-event listener** — see the
  "Correction to this document" section above. Pre-existing, unrelated to this session's
  change, and masked by a 3-second polling fallback already in that file, so there's no
  user-facing symptom today. Left alone.

---

## Verification performed

- `node -c` on both modified backend files — clean.
- ESLint on all 4 modified frontend files — zero new errors/warnings (only pre-existing,
  unrelated `react-hooks/exhaustive-deps` warnings on `fetchBookings`/`fetchBookingStatus`
  dependency arrays).
- **Not yet done:** an actual browser click-through of the full flow (submit round 1 →
  approve → submit round 2 → decline → complete, checking the payment amount at each step).
  Recommended before considering this fully verified — see the original implementation
  plan's verification section for the exact steps.
