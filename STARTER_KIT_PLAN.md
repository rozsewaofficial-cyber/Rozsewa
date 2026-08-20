# RozSewa Starter Kit, Combo Packs & Inventory — Implementation Plan

> **Status:** Planning only — nothing implemented yet.
> **Scope:** Starter Kit catalog + central inventory, Combo Packs, order & delivery workflow,
> category-wise payment rules (Full / Part payment + EMI auto-deduction), wallet & payout lock,
> and the Sewak app store.

---

## Table of contents

1. [Codebase fit — what already exists](#1-codebase-fit--what-already-exists)
2. [Design decisions (D1–D12)](#2-design-decisions)
3. [Data model](#3-data-model)
4. [Stock deduction & concurrency](#4-stock-deduction--concurrency)
5. [Payment & EMI engine](#5-payment--emi-engine)
6. [API surface](#6-api-surface)
7. [Build phases](#7-build-phases)
8. [Known traps](#8-known-traps)
9. [Open questions — need your decision](#9-open-questions--need-your-decision)
10. [Out of scope for v1](#10-out-of-scope-for-v1)

---

## 1. Codebase fit — what already exists

I read the existing code before planning. Five findings materially change the design.

### 1.1 There is no inventory concept anywhere — this is fully greenfield

`grep` for `stock` / `inventory` across all models and controllers returns **nothing**. No existing
model tracks physical quantity. Every part of section 1–4 of the SRS is new code, not an extension.

### 1.2 A negative-balance / debt system ALREADY exists — and it is already category-wise

This is the biggest overlap. The SRS asks for "Negative Balance Support" and "Category-Wise Payout
Lock" as if new, but the codebase already has:

| Piece | Where |
|---|---|
| Category-wise negative limits config | `Setting` key `cash_limits_config` → `{ defaultLimit: 1500, categoryLimits: [], serviceLimits: [] }` |
| Admin UI for it | `AdminCashLimits.jsx` (`/admin/settings/cash-limits`) |
| Limit computed on login | `authController.js:255-280`, `providerController.js:474-495` → returns `debtLimitExceeded`, `currentDebt`, `allowedLimit` |
| Full-screen "Account Restricted" paywall | `ProtectedRoute.jsx:148` — already blocks the whole provider app when `debtLimitExceeded` |
| Blocks receiving bookings | `bookingController.js:566`, `:938`, `:1140` |

**What this means:** wallet can already go negative, and there is already a category-wise threshold
that locks the Sewak out. The SRS's payout lock is a *different enforcement point* (withdrawal, not
bookings) on the *same signal*. See [D8](#d8--payout-lock-reuse-the-existing-debt-system-or-build-a-new-one).

### 1.3 Wallet is two-tier with a denormalized mirror

- `Wallet.balance` — authoritative
- `Wallet.availableBalance` — what withdrawals check
- `Provider.walletBalance` — a denormalized mirror, re-synced in `bookingController`/`leadController`
- `Wallet` has a `post('save')` hook that emits `WALLET_UPDATED` over socket

Any EMI deduction must write through `Wallet`, not `Provider.walletBalance`, or the socket event and
the authoritative balance both go stale.

### 1.4 Withdrawal has a clean insertion point for the payout lock

`withdrawalController.requestWithdrawal` already gates on `kycVerified`, linked bank account, and
`availableBalance`. The payout lock is one more check in the same function — no restructuring.

### 1.5 Mongoose transactions are available and already used

`startSession()` / `startTransaction()` appear in `leadController.js:753`, `paymentController.js:327`,
`v2CommissionController.js:366`. The DB is a replica set. **Stock deduction can and must be
transactional** — unlike the Skill Session allocator, where I had to settle for optimistic re-checking.

### 1.6 Reusable patterns

| Need | Existing template |
|---|---|
| Razorpay purchase + verify | `paymentController.verifySubscriptionPayment` (HMAC verify + `isSimulated` bypass) |
| Recurring background job | `cron/subscriptionCheck.js` — daily cron, registered in `index.js:103-113` |
| Money audit trail | `FinancialLedger` model (`ledgerType` enum, `previousBalance`/`newBalance`) |
| Category-scoped admin config page | `SewakPricing.jsx`, `AdminCashLimits.jsx` |
| Admin CRUD page shape | `AdminTrainingCenters.jsx` (built in the Skill Session work) |

---

## 2. Design decisions

### D1 — Where do category payment settings live?

**Decision:** A separate `KitPaymentConfig` collection keyed by `categoryId` — **not** new fields on
`Category`.

**Why:** `Category` is already carrying `businessModel`, `defaultLeadPrice`, `gstPercent`,
`platformFee`, plus the four Skill Session fields. More importantly, `adminController.updateCategory`
rebuilds parts of the document from a hardcoded field whitelist (this is the bug I found and fixed
during the Skill Session work — see [Trap 1](#trap-1--updatecategory-silently-drops-fields-not-in-its-whitelist)).
Every field added to `Category` has to be threaded through that whitelist or it gets silently wiped.
A separate collection sidesteps that trap entirely and keeps payment rules independently auditable.

### D2 — When is stock deducted?

**Decision:** On **admin confirm**, not on order placement. Exactly as the SRS specifies.

```
Sewak places order  →  status: pending    →  stock UNCHANGED
Admin confirms      →  status: confirmed  →  stock -= (kitQty × orderQty)   [transactional]
```

**Consequence to accept:** orders are allowed at 0 stock (SRS explicitly requires this), so confirming
them drives stock **negative**. That is intentional — negative stock is a backorder signal, and the
admin dashboard must show it in red rather than refusing. Blocking at confirm time would contradict
"0 Stock par bhi Order allowed".

### D3 — Combo quantities: live reference or snapshot?

**Decision:** **Both**, at different layers — and this is the single most important correctness call
in the whole feature.

| Layer | Behaviour |
|---|---|
| Combo *definition* | Live reference. Combo stores only `{ itemId }`; quantity is read from `StarterKitItem.kitQuantity` at display time — exactly as the SRS asks ("quantity … automatically fetch hogi"). |
| Order *line* | **Frozen snapshot.** When an order is placed, each line copies `itemName`, `kitQuantity`, and `unitPrice` into the order document. |

**Why the snapshot is non-negotiable:** without it, an admin editing a kit's quantity or price
retroactively rewrites what past orders contained and what they cost. Stock already deducted would no
longer reconcile against the order that caused it, and a Sewak's EMI balance would silently change.
Every serious commerce system freezes order lines; this one must too.

### D4 — Naming: `Combo` already exists

The codebase already has a `Combo` model — provider-created **service** bundles, with its own
approval workflow (`pending`/`approved`/`rejected`) and admin page (`AdminVerifyCombo.jsx`).

**Decision:** name the new one **`KitCombo`**, and label it "Combo Pack" only in UI copy. Do not touch
or extend the existing `Combo` model — they share a word, nothing else.

### D5 — Order model: reuse `Booking` or create new?

**Decision:** New **`KitOrder`** model.

`Booking` is deeply service-shaped — `providerId`, `serviceId`, `bookingDate`, `bookingTime`,
`travelCharge`, `commission`, `extraStatus`, night charges, dispute sub-documents. A merchandise order
shares almost none of that. Overloading `Booking` would poison every existing booking query with
records that aren't bookings.

### D6 — Order status model

**Decision:**

```
pending  →  confirmed  →  dispatched  →  delivered
   └──────────────────────────────────────→ cancelled
```

- `pending` → `confirmed` is where stock deducts and `expectedDeliveryDays` is set
- Cancellation *after* confirm must restore stock (and reverse dues) — see [Trap 4](#trap-4--cancelling-a-confirmed-order-must-reverse-three-things-not-one)

### D7 — How is the EMI instalment amount computed?

**Decision (needs your confirmation — see [Q1](#q1--how-should-the-instalment-amount-be-decided)):**
Admin sets a **fixed instalment amount** per category, and the schedule runs until the balance is
cleared. The final instalment is automatically the remainder (so it never overshoots).

The SRS says "roz **fixed amount** deduct hoga", which points to a fixed amount rather than a fixed
number of instalments — but it never says who sets that amount or whether it's a percentage. Flagged.

### D8 — Payout lock: reuse the existing debt system, or build a new one?

**Decision:** **Reuse the signal, add a new enforcement point.** Do not build a second parallel debt
system.

| | Existing (`cash_limits_config`) | New (this feature) |
|---|---|---|
| Threshold | `balance <= -categoryLimit` | `balance < 0` **or** open kit dues exist |
| Blocks | Receiving bookings + whole-app paywall | **Withdrawal only** |
| Where | `bookingController`, `ProtectedRoute` | `withdrawalController.requestWithdrawal` |

Keeping them separate matters: the existing one is a hard lockout at a large negative number; the
payout lock should trigger at *any* negative balance but must **not** lock the Sewak out of the app —
they still need to work to earn the money that clears the dues. Locking earning and withdrawal at the
same threshold would make the debt unrepayable.

### D9 — Stock is global, not per-city

**Decision:** one `availableStock` number per item. The SRS says "Company Physical Stock" and shows a
single central deduction. No warehouse/zone split in v1.

### D10 — Which Sewaks see which kits?

**Decision:** `Provider.vendorType` (their category) → kits/combos where `categoryId` matches and
`isActive: true`. This mirrors how the Skill Session eligibility endpoint already scopes by
`vendorType`.

### D11 — Down payment goes through Razorpay; the remainder never does

**Decision:** the down payment (or full payment) is a real Razorpay transaction, verified with the
same HMAC pattern as `verifySubscriptionPayment`. The remaining balance is **never** charged to a
card — it is recovered only by deducting from the Sewak's RozSewa earnings wallet on schedule. This
matches "Wallet se roz fixed amount deduct hoga".

### D12 — Ledger, not just a balance number

**Decision:** every EMI deduction writes a `FinancialLedger` row (new `ledgerType` values:
`KIT_DOWN_PAYMENT`, `KIT_EMI_DEDUCTION`, `KIT_REFUND`) **and** a `Transaction` row.

`FinancialLedger` already stores `previousBalance`/`newBalance`, which is exactly what the SRS's
"Wallet & EMI Ledger" screen needs to render an auditable history rather than a bare number.

---

## 3. Data model

### 3.1 New: `StarterKitItem`

`backend/models/StarterKitItem.js`

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | e.g. "T-Shirt" |
| `categoryId` | `ObjectId → Category`, required, indexed | Which category this item belongs to |
| `description` | String | |
| `image` | String | |
| `availableStock` | Number, default `0` | **Company physical stock.** Can go negative (backorder) |
| `kitQuantity` | Number, default `1` | Qty per kit, fixed at creation (e.g. T-Shirt × 2) |
| `price` | Number, required | Per-item price |
| `isMandatory` | Boolean, default `false` | See [Q2](#q2--what-does-mandatory-actually-enforce) |
| `isActive` | Boolean, default `true` | |
| `lowStockThreshold` | Number, default `5` | Drives the dashboard warning |

**Indexes:** `{ categoryId: 1, isActive: 1 }`

### 3.2 New: `KitCombo`

`backend/models/KitCombo.js`

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | |
| `categoryId` | `ObjectId → Category`, required, indexed | |
| `items` | `[{ itemId: ObjectId → StarterKitItem }]` | **No quantity here** — inherited live (D3) |
| `comboPrice` | Number, required | Admin's custom total, independent of item prices |
| `description` / `image` | String | |
| `isActive` | Boolean, default `true` | |

### 3.3 New: `KitPaymentConfig`

`backend/models/KitPaymentConfig.js` — one document per category (D1)

| Field | Type | Notes |
|---|---|---|
| `categoryId` | `ObjectId → Category`, required, **unique** | |
| `paymentMode` | `'full' \| 'part' \| 'both'`, default `'full'` | What the Sewak is allowed to choose |
| `downPaymentType` | `'percentage' \| 'fixed'`, default `'percentage'` | |
| `downPaymentValue` | Number, default `50` | e.g. 50 → 50% down |
| `deductionFrequency` | `'daily' \| 'weekly' \| 'monthly'`, default `'weekly'` | |
| `instalmentAmount` | Number, default `0` | Fixed amount per deduction (D7) |
| `weeklyDeductionDay` | Number `0–6`, default `1` | Monday |
| `monthlyDeductionDate` | Number `1–28`, default `1` | Capped at 28 to avoid month-length bugs |
| `blockPayoutOnDues` | Boolean, default `true` | Category-wise payout lock (D8) |
| `isActive` | Boolean, default `true` | |

### 3.4 New: `KitOrder`

`backend/models/KitOrder.js`

| Field | Type | Notes |
|---|---|---|
| `sewakId` | `ObjectId → Provider`, required, indexed | |
| `categoryId` | `ObjectId → Category`, required | |
| `orderType` | `'single' \| 'combo'` | |
| `comboId` | `ObjectId → KitCombo`, nullable | Set when `orderType === 'combo'` |
| `lines` | `[orderLineSchema]` | **Frozen snapshot** — see below (D3) |
| `orderQuantity` | Number, default `1` | How many kits/combos ordered |
| `totalAmount` | Number, required | Frozen at order time |
| `paymentMode` | `'full' \| 'part'` | |
| `downPaymentAmount` | Number, default `0` | Actually paid up front |
| `remainingAmount` | Number, default `0` | Drives the EMI schedule |
| `status` | `'pending' \| 'confirmed' \| 'dispatched' \| 'delivered' \| 'cancelled'` | D6 |
| `expectedDeliveryDays` | Number, nullable | Admin enters at confirm |
| `expectedDeliveryDate` | Date, nullable | Derived at confirm |
| `stockDeducted` | Boolean, default `false` | **Idempotency guard** — see [Trap 2](#trap-2--double-confirm-would-deduct-stock-twice) |
| `confirmedAt` / `dispatchedAt` / `deliveredAt` / `cancelledAt` | Date | |
| `confirmedBy` | `ObjectId → User` | Audit |
| `razorpayOrderId` / `razorpayPaymentId` | String | |

**Order line sub-schema (frozen snapshot):**

```js
const orderLineSchema = mongoose.Schema({
    itemId:      { type: ObjectId, ref: 'StarterKitItem' }, // reference only
    itemName:    String,   // frozen
    kitQuantity: Number,   // frozen  <- what stock deducts against
    unitPrice:   Number,   // frozen
    isMandatory: Boolean   // frozen
}, { _id: false });
```

**Indexes:** `{ sewakId: 1, status: 1 }`, `{ status: 1, createdAt: -1 }`

### 3.5 New: `KitDue`

`backend/models/KitDue.js` — the EMI schedule for one part-payment order

| Field | Type | Notes |
|---|---|---|
| `sewakId` | `ObjectId → Provider`, required, indexed | |
| `orderId` | `ObjectId → KitOrder`, required | |
| `categoryId` | `ObjectId → Category` | Which config governs it |
| `totalDue` | Number | Original remaining balance |
| `paidSoFar` | Number, default `0` | |
| `balance` | Number | `totalDue − paidSoFar` |
| `frequency` | `'daily' \| 'weekly' \| 'monthly'` | Snapshot from config at order time |
| `instalmentAmount` | Number | Snapshot from config at order time |
| `nextDeductionDate` | Date, indexed | What the cron queries on |
| `status` | `'active' \| 'cleared' \| 'cancelled'` | |
| `missedCount` | Number, default `0` | Incremented when wallet couldn't cover it |
| `lastAttemptAt` | Date | |

**Indexes:** `{ status: 1, nextDeductionDate: 1 }` (the cron's query), `{ sewakId: 1, status: 1 }`

> Frequency and instalment amount are **snapshotted onto the due**, not read live from
> `KitPaymentConfig`. Otherwise an admin changing the category config would silently rewrite the
> repayment terms of every existing debt — same reasoning as D3.

### 3.6 Extended: existing models

| Model | Change |
|---|---|
| `FinancialLedger` | Add `KIT_DOWN_PAYMENT`, `KIT_EMI_DEDUCTION`, `KIT_REFUND` to the `ledgerType` enum |
| `Notification` | Add `'kit_order'` to the `type` enum — **required**, see [Trap 3](#trap-3--the-notification-type-enum-rejects-unknown-values-silently) |

---

## 4. Stock deduction & concurrency

Unlike the Skill Session allocator (where I accepted optimistic re-checking), stock **must** be
transactional — two admins confirming two orders for the last unit is a realistic, money-losing race.

### 4.1 The confirm operation

```js
const session = await mongoose.startSession();
try {
    session.startTransaction();

    const order = await KitOrder.findById(id).session(session);
    if (!order)                     throw badRequest('Order not found');
    if (order.status !== 'pending') throw badRequest('Only a pending order can be confirmed');
    if (order.stockDeducted)        throw badRequest('Stock already deducted for this order');

    // Deduct every line atomically. $inc is applied server-side, so concurrent
    // confirms serialise correctly inside the transaction.
    for (const line of order.lines) {
        await StarterKitItem.updateOne(
            { _id: line.itemId },
            { $inc: { availableStock: -(line.kitQuantity * order.orderQuantity) } },
            { session }
        );
    }

    order.status               = 'confirmed';
    order.stockDeducted        = true;          // idempotency guard
    order.expectedDeliveryDays = days;
    order.expectedDeliveryDate = addDays(new Date(), days);
    order.confirmedAt          = new Date();
    order.confirmedBy          = req.user._id;
    await order.save({ session });

    // Part payment -> open the EMI schedule in the same transaction
    if (order.paymentMode === 'part' && order.remainingAmount > 0) {
        await KitDue.create([{ ...dueFields }], { session });
    }

    await session.commitTransaction();
} catch (err) {
    await session.abortTransaction();
    throw err;
} finally {
    session.endSession();
}
```

### 4.2 Why `$inc` and not read-modify-write

`item.availableStock = item.availableStock - n; await item.save()` reads a stale value under
concurrency. `$inc` is evaluated by MongoDB against the current document, so two concurrent
decrements both land. Combined with the transaction, the confirm is safe.

### 4.3 Negative stock is allowed by design

Per D2 the deduction is *not* guarded by a "do we have enough" check — 0-stock orders are explicitly
permitted. Negative `availableStock` is surfaced as a red backorder badge on the admin dashboard, not
prevented.

---

## 5. Payment & EMI engine

### 5.1 Checkout

```
Sewak picks kit/combo + quantity
        │
        ▼
GET category KitPaymentConfig
        │
        ├─ paymentMode 'full'  → only Full Payment offered
        ├─ paymentMode 'part'  → only Part Payment offered
        └─ paymentMode 'both'  → Sewak chooses
        │
        ▼
amountToPayNow = full   ? totalAmount
                        : downPaymentType === 'percentage'
                            ? totalAmount × downPaymentValue / 100
                            : downPaymentValue
        │
        ▼
Razorpay order → verify HMAC (same pattern as verifySubscriptionPayment)
        │
        ▼
KitOrder created (status: pending, stock NOT yet touched)
FinancialLedger: KIT_DOWN_PAYMENT
```

### 5.2 The EMI cron

`backend/cron/kitDuesJobs.js`, registered in `index.js` beside the existing five. Runs **daily at
01:00** — one job handles all three frequencies, because `nextDeductionDate` already encodes the
schedule.

```
for each KitDue where status='active' AND nextDeductionDate <= now:

    amount = min(due.instalmentAmount, due.balance)   // never overshoot

    wallet = Wallet.findOne({ providerId: due.sewakId })

    // Deduction proceeds even if it drives the balance negative — that is
    // the SRS's "Negative Balance Support".
    wallet.balance          -= amount
    wallet.availableBalance -= amount
    await wallet.save()                     // fires WALLET_UPDATED socket event

    Provider.walletBalance   = wallet.balance    // keep the mirror in sync (1.3)
    Transaction:      debit, "Kit EMI instalment"
    FinancialLedger:  KIT_EMI_DEDUCTION (previousBalance / newBalance)

    due.paidSoFar += amount
    due.balance   -= amount
    if (wallet.balance < 0) due.missedCount++     // recorded, not blocking

    due.nextDeductionDate = advance(due.frequency)
    if (due.balance <= 0) { due.status = 'cleared'; notify('Kit dues cleared') }
```

**Idempotency:** the cron advances `nextDeductionDate` in the same write that records the deduction,
so a re-run on the same day finds nothing due. A crash between the wallet write and the due write
would double-charge — so **both writes go in one transaction**.

### 5.3 Payout lock

One additional check at the top of `withdrawalController.requestWithdrawal`:

```js
const wallet = await Wallet.findOne({ providerId: req.user._id });
const openDues = await KitDue.exists({ sewakId: req.user._id, status: 'active' });

if (openDues) {
    const cfg = await KitPaymentConfig.findOne({ categoryId: provider.vendorType });
    if (cfg?.blockPayoutOnDues && wallet.balance < 0) {
        return res.status(400).json({
            message: 'Your wallet balance is negative due to pending kit instalments. Clear your dues to withdraw.'
        });
    }
}
```

Note this is **withdrawal-only** and deliberately does not touch the existing
`cash_limits_config` booking block (D8).

---

## 6. API surface

### 6.1 Admin — `/api/admin/*`, behind `protect, admin`

| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` | `/starter-kit-items` | List (filter by category), create |
| `PUT` `DELETE` | `/starter-kit-items/:id` | Update, remove |
| `PATCH` | `/starter-kit-items/:id/stock` | Manual stock adjustment (restock) with a reason |
| `GET` `POST` | `/kit-combos` | List, create |
| `PUT` `DELETE` | `/kit-combos/:id` | Update, remove |
| `GET` `PUT` | `/kit-payment-config/:categoryId` | Read / upsert category payment rules |
| `GET` | `/kit-orders` | Filter by status, category, sewak, date range |
| `PUT` | `/kit-orders/:id/confirm` | Body: `expectedDeliveryDays` → **deducts stock** |
| `PUT` | `/kit-orders/:id/dispatch` | → `dispatched` |
| `PUT` | `/kit-orders/:id/deliver` | → `delivered` |
| `PUT` | `/kit-orders/:id/cancel` | Restores stock + cancels dues if already confirmed |
| `GET` | `/kit-inventory/summary` | Real-time stock dashboard (incl. low/negative) |
| `GET` | `/kit-dues` | All active EMI schedules, filterable |

### 6.2 Sewak — `/api/kit-store/*`, behind `protect`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/catalog` | Kits + combos for my category, with live-inherited quantities |
| `GET` | `/payment-config` | What payment options my category allows |
| `POST` | `/order` | Place an order (after Razorpay verify) |
| `GET` | `/orders` | My orders + delivery tracking |
| `GET` | `/orders/:id` | One order (ownership checked) |
| `GET` | `/dues` | My EMI ledger, schedule, balance, payout-lock status |

### 6.3 Payment

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/payment/verify-kit-order` | HMAC verify → create the `KitOrder` |

---

## 7. Build phases

Ordered by dependency. Each phase leaves the app deployable.

### Phase 1 — Inventory foundation
*No dependencies · backend + admin · no Sewak-visible change*

- 🆕 `models/StarterKitItem.js`, `models/KitCombo.js`
- 🆕 `controllers/starterKitController.js`
- ✏️ `routes/adminRoutes.js`, `models/Notification.js` (enum), `models/FinancialLedger.js` (enum)
- 🆕 `AdminStarterKits.jsx`, `AdminKitCombos.jsx` + sidebar/route wiring

**Done when:** items CRUD with stock + kit quantity; combos select items and show inherited
quantities live; stock edits persist and are visible.

### Phase 2 — Category payment rules
*Depends on 1 · admin only*

- 🆕 `models/KitPaymentConfig.js`, `controllers/kitPaymentConfigController.js`
- 🆕 `AdminKitPaymentSettings.jsx` (category picker → rules form, modelled on `SewakPricing.jsx`)

**Done when:** per-category full/part/both, down-payment %, frequency, instalment amount all persist
and read back correctly.

### Phase 3 — Sewak catalog (read-only)
*Depends on 1, 2 · first Sewak-visible slice*

- 🆕 `controllers/kitStoreController.js` (`/catalog`, `/payment-config`), `routes/kitStoreRoutes.js`
- 🆕 `SewakKitStore.jsx` + dashboard tile (same pattern as the Skill Sessions tile)

**Done when:** Sewak sees only their category's kits/combos, with correct inherited quantities and
prices; no checkout yet.

### Phase 4 — Ordering & payment
*Depends on 3*

- 🆕 `models/KitOrder.js`
- ✏️ `paymentController.js` → `verifyKitOrderPayment`
- 🆕 checkout UI (full vs part per config)

**Done when:** order places at 0 stock; totals and lines are frozen snapshots; down payment verified
and ledgered.

### Phase 5 — Admin order workflow & stock deduction ⚠️
*Depends on 4 · **the highest-risk phase***

- 🆕 `AdminKitOrders.jsx`
- ✏️ confirm / dispatch / deliver / cancel with the transactional deduction from §4

**Done when:** confirm deducts exactly once (double-confirm rejected); concurrent confirms don't
double-deduct; cancel-after-confirm restores stock; negative stock shows as a backorder warning.

### Phase 6 — EMI engine & payout lock
*Depends on 5*

- 🆕 `models/KitDue.js`, `cron/kitDuesJobs.js`
- ✏️ `index.js` (register cron), `withdrawalController.js` (payout lock)

**Done when:** dues open on confirm of a part-payment order; cron deducts on schedule and never
overshoots; balance goes negative rather than failing; withdrawal blocked while negative with dues
open; cron re-run in the same window is a no-op.

### Phase 7 — Sewak wallet & EMI ledger
*Depends on 6*

- ✏️ `ProviderWallet.jsx` — remaining balance, schedule, next deduction date, payout-lock banner
- 🆕 `/kit-store/dues` endpoint

**Done when:** Sewak sees remaining EMI, next deduction, full history, and a clear reason if payout
is locked.

### Phase 8 — Inventory dashboard & tracking
*Depends on 5*

- 🆕 `/kit-inventory/summary` + admin dashboard widget
- ✏️ Sewak order tracking (expected delivery + dispatch status)

**Done when:** real-time per-item stock with low/negative highlighting; Sewak sees "Delivery in 3–5
days" and live dispatch status.

---

## 8. Known traps

Four of these are lessons already paid for during the Skill Session work in this same codebase.

### Trap 1 — `updateCategory` silently drops fields not in its whitelist

`adminController.js:543` rebuilds `category.services[]` from a hardcoded field list. It was silently
dropping `image` until I fixed it during the Skill Session work. **This is exactly why category
payment settings live in their own collection (D1)** rather than as new `Category` fields.

### Trap 2 — Double-confirm would deduct stock twice

Two admins (or one double-click) confirming the same order would each run the deduction. Mitigated by
the `stockDeducted` boolean guard checked **inside** the transaction, plus the `status !== 'pending'`
check. Both are required — the status check alone loses to a race, the flag alone loses to a
partially-failed write.

### Trap 3 — The `Notification` type enum rejects unknown values *silently*

`Notification.js:8` enumerates allowed types. An unlisted value makes `Notification.create` throw —
which `notifyUser` **catches and logs**, returning normally. Push still delivers, so the bug presents
as "notifications work but the in-app bell is empty." Add `'kit_order'` in Phase 1.
Also pass `data: { id: order._id }` — `notifyUser` builds its dedupe key from
`data.bookingId || data.leadId || data.id`, and omitting it collapses every order's notifications
onto one shared key.

### Trap 4 — Cancelling a confirmed order must reverse three things, not one

Naive cancellation only flips the status. A confirmed order has also: **(a)** deducted stock,
**(b)** possibly opened a `KitDue`, **(c)** taken a down payment. Cancel must restore stock
(`$inc` positive), cancel the due, and decide the refund path — all in one transaction.
See [Q3](#q3--what-happens-on-cancellation-and-refunds).

### Trap 5 — Writing to `Provider.walletBalance` instead of `Wallet.balance`

`Wallet.balance` is authoritative; `Provider.walletBalance` is a mirror. Writing only the mirror means
the EMI deduction never really happens (bookings and withdrawals read `Wallet`), and the
`WALLET_UPDATED` socket event never fires. Always write `Wallet`, then sync the mirror.

### Trap 6 — `monthlyDeductionDate` above 28

A monthly schedule set to the 29th–31st silently skips February and short months. The schema caps it
at 28; if a true month-end option is wanted later it needs explicit last-day-of-month logic.

---

## 9. Open questions — need your decision

These genuinely change what gets built, and the SRS doesn't settle them.

### Q1 — How should the instalment amount be decided?

The SRS says "roz fixed amount deduct hoga" but never says who sets it. Options:

- **(a)** Admin sets a fixed ₹ amount per category *(assumed in this plan)*
- **(b)** Admin sets a number of instalments; amount is derived per order
- **(c)** Percentage of the remaining balance each cycle

### Q2 — What does "Mandatory" actually enforce?

The SRS says items are tagged Mandatory/Optional but never states the consequence. Is a mandatory
item:

- **(a)** Just a visual label? *(assumed in this plan — lowest risk)*
- **(b)** Auto-added to every cart in that category and non-removable?
- **(c)** Something a Sewak **must** purchase before their services can go live — i.e. a gate like the
  Skill Session one?

If it's (c), that's a materially bigger feature and would need its own gate wired into service
activation.

### Q3 — What happens on cancellation and refunds?

The SRS is silent on cancellation entirely. Needed:

- Can a Sewak cancel, or only an admin?
- Up to which status — before `confirmed` only, or also after `dispatched`?
- Is the down payment refunded to the wallet, refunded to source via Razorpay, or forfeited?

### Q4 — Is there a floor on how negative a wallet can go?

"Negative Balance Support" has no stated limit. But the **existing** `cash_limits_config` already
locks a Sewak out of the entire app at `balance <= -categoryLimit` (default −₹1,500). So EMI
deductions will eventually trip that existing paywall and stop them working — which stops them
earning — which stops the dues clearing.

**This needs an explicit rule.** Options: exempt kit dues from the existing debt limit; raise the
limit for Sewaks with active dues; or pause deductions once the limit is near.

### Q5 — GST on kits?

`Category` already carries `gstPercent` and `platformFee`, used for services. Do kit prices include
GST, or is it added at checkout? The SRS shows only a flat price.

---

## 10. Out of scope for v1

Named as decisions, not omissions.

| Not building | Reasoning / seam |
|---|---|
| Per-city / warehouse stock | SRS specifies one central company stock (D9) |
| Purchase orders / supplier restocking | Stock is adjusted manually via `PATCH /stock` |
| Courier / AWB tracking integration | Dispatch status is admin-entered, no logistics API |
| Kit returns & exchanges | Only cancellation is in scope, and it needs [Q3](#q3--what-happens-on-cancellation-and-refunds) answered first |
| Partner (non-Sewak) kit purchasing | SRS is Sewak-only; the models are category-scoped so it can extend later |
| Automatic reorder alerts to suppliers | `lowStockThreshold` drives a dashboard badge only |

---

*Plan prepared for review before build. Q1–Q5 in §9 should be answered before Phase 2 starts —
Q1 and Q4 in particular change the EMI engine's shape.*
