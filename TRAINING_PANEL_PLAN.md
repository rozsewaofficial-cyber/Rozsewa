# RozSewa Training Panel — Implementation Plan

> **Status:** ✅ Implemented and tested end to end.
> **Scope:** Sewak lookup by code, physical Starter Kit item verification, basic training
> checklist, and profile go-live activation.
> **Depends on:** [SKILL_SESSION_PLAN.md](SKILL_SESSION_PLAN.md) (built) and
> [STARTER_KIT_PLAN.md](STARTER_KIT_PLAN.md) (built).

---

## Table of contents

1. [What this is, and what it isn't](#1-what-this-is-and-what-it-isnt)
2. [Codebase fit — what already exists](#2-codebase-fit--what-already-exists)
3. [Design decisions (D1–D9)](#3-design-decisions)
4. [The activation chain](#4-the-activation-chain)
5. [Data model](#5-data-model)
6. [API surface](#6-api-surface)
7. [Build phases](#7-build-phases)
8. [Known traps](#8-known-traps)
9. [Out of scope for v1](#9-out-of-scope-for-v1)

---

## 1. What this is, and what it isn't

This is **not** a third standalone training system. It is the operational glue that answers:
*"when a Sewak physically shows up at the centre, what does the trainer actually do?"* — plus one
genuinely new gate: **profile activation blocked on physical possession of mandatory kit items.**

It sits alongside the Skill Session system, at a different level:

| | **Training Panel** (this plan) | **Skill Session** (already built) |
|---|---|---|
| How it starts | Walk-in — trainer types a Sewak Code | Sewak books; system auto-allocates a centre + trainer |
| Frequency | Once per Sewak, at onboarding | Once per gated service |
| What's checked | Mandatory kit items in hand + basic training delivered | Attendance at a scheduled session |
| What it unlocks | **The whole profile** → `Provider.status = 'verified'` | **One service** → `Service.visible = true` |
| Training content | Generic: conduct, app usage, safety, service rules | Service-specific: e.g. AC Repair technique |

**Neither replaces the other.** A Sewak completes the Training Panel **once** to go live at all, then
completes a Skill Session **per service** that requires one.

---

## 2. Codebase fit — what already exists

### 2.1 One field controls whether a Sewak is discoverable

```js
// backend/controllers/homeController.js:160
let query = { status: 'verified', isOnline: true };
```

That single condition governs public discovery, and `status: 'verified'` is also checked in booking
dispatch (`bookingController.js:496`, `:510`), emergency broadcast, and analytics — roughly eight
call sites in total.

**Today `status: 'verified'` is set by KYC approval** (`adminController.js:1899` in `verifySewak`,
and `:2111` in `verifySewakDocument`). So the current reality is: **KYC approved → instantly live.**
Inserting a training gate necessarily changes that. See [D2](#d2--training-done-owns-go-live-not-kyc-approval).

### 2.2 Reusable pieces already in place

| Need | Already exists |
|---|---|
| Trainer identity + auth | `Trainer` model with password, `protectTrainer` middleware, `/trainer/login` |
| Trainer scoping data | `Trainer.categories` + `Trainer.trainingCenter` → `{ cities, categories }` |
| Kit items per category | `StarterKitItem` — `categoryId`, `kitQuantity`, `isMandatory` |
| Sewak's own kit shop | `SewakKitStore.jsx` + `/api/kit-store/*` — the exact place Step 3 sends them |
| Sewak documents | `Provider.documents[]` with `{ id, url, status, fileName }` |
| Audit trail | `AuditLog` model — but see [Trap 4](#trap-4--auditlogverifiedby-cannot-reference-a-trainer) |
| Trainer-facing UI shell | `TrainerSessions.jsx`, `TrainerProtectedRoute` |

### 2.3 Gaps between the spec and reality

| Spec (Step 1) asks to show | Reality |
|---|---|
| Sewak Name / Code / Phone / Category | ✅ On `Provider` |
| Sewak Profile Photo | ✅ `Provider.profileImage` |
| Aadhaar Photo, PAN Photo | ✅ Collected at registration as `aadhaar_front`, `aadhaar_back`, `pan` |
| **Police Verification Document** | ⚠️ **Not collected at registration.** `Provider.kycPoliceVerification` exists as a number field, and `police` is an *optional* upload in the Verification Vault. Most Sewaks will have nothing here — the panel must render "Not uploaded" rather than break. |
| Other registration documents | ✅ `gst`, `license`, `certification`, `live_video` when present |

---

## 3. Design decisions

### D1 — Training Panel and Skill Session both stay, at different levels

**Decision (confirmed):** build the Training Panel as a new profile-level gate. Keep the Skill
Session system exactly as-is for per-service gating. Nothing is removed.

#### D1a — AMENDED: Skill Session also gates profile activation

Originally D1 left the two systems fully independent, so a Sewak could go live with their profile
while individual gated services stayed hidden. End-to-end testing against the activation flow diagram
showed that diagram states a stricter rule — **"Skill Session Completed (Test Pass)"** is listed as
one of the four conditions for the account to become active.

**Amended decision:** `completeTraining` now additionally asserts that **every** service in the
Sewak's `subServices` requiring a skill session has a completed one. Specifically:

- "Test Pass" means a session in `completed` status, read from the `Provider.skillCertifications`
  array that `markAttendance` already denormalises. A `no_show` is a fail and does not count.
- A Sewak whose services need **no** skill session satisfies this vacuously.
- Partial completion is not enough — 1 of 2 required sessions still blocks activation.

The per-service gate (`Service.visible`) is unchanged; this adds a profile-level gate on top of it.
There are now **three** gates on activation, all asserted server-side.

### D2 — Training Done owns go-live, not KYC approval

**Decision (confirmed):**

- KYC approval sets `kycVerified: true` and `kycStatus: 'verified'` — **but no longer flips
  `status` to `'verified'`** for Sewaks with an incomplete training record.
- **Training Done** sets `status: 'verified'` and `isOnline: true`.

**Why this over adding a new `trainingVerified` flag:** because every downstream consumer already
reads `status: 'verified'`, flipping that same field means **zero query changes** across discovery,
booking dispatch, emergency broadcast and analytics. The alternative required editing ~8 call sites,
where a single missed one would let an untrained Sewak receive bookings through a side door.

**Migration:** Sewaks already `verified` today stay verified — grandfathered, no backfill. The gate
applies to new onboardings only.

**Partners are untouched.** This gate is Sewak-only (`providerCategory === 'sewak'`).

### D3 — Trainer access is scoped, masked and audited

**Decision (confirmed):** Sewak codes are **sequential** —

```js
// backend/controllers/providerController.js:226
const vendorCode = `RSSEW${String(nextSewakNum).padStart(5, '0')}`;  // RSSEW00001, 00002, ...
```

so they are trivially enumerable. Since Step 1 surfaces Aadhaar and PAN images, an unscoped lookup
would let any trainer harvest every Sewak's identity documents by counting upward.

Therefore:

1. **Scope** — a trainer may only look up Sewaks whose `vendorType` is in their own
   `Trainer.categories` **and** whose `city` is served by their `trainingCenter.cities`.
2. **Mask** — document *numbers* (Aadhaar, PAN) render masked (`XXXX XXXX 1234`) by default.
3. **Audit** — opening an actual document image writes an audit row.
4. **Rate-limit** — cap lookups per trainer per hour to blunt enumeration.
5. **Admins are unrestricted** — they already have full KYC access elsewhere.

### D4 — Item verification is physical, not derived from orders

**Decision:** the trainer ticks each item by hand. The system does **not** auto-tick an item because
a `KitOrder` containing it reached `delivered`.

**Why:** the spec's whole point is *"Item Sewak ke paas hai"* — physically present, today, in the
room. A delivered order proves shipment, not possession. The panel **will** show order status
alongside each item as context ("ordered · delivered 3 Aug"), but the tick stays manual.

### D5 — Mandatory blocks; optional doesn't

**Decision:** every active `StarterKitItem` for the Sewak's category is listed and tickable, but only
`isMandatory: true` items block Training Done.

**This supersedes Q2 in [STARTER_KIT_PLAN.md](STARTER_KIT_PLAN.md)**, where — absent any spec — I
assumed `isMandatory` was a decorative label. It now becomes a real gate.

### D6 — Training topics are a checklist, stored as a setting

**Decision:** the seven Step-4 topics render as individual checkboxes rather than one "Training Done"
button, giving a per-topic audit trail. They live in a `Setting` key (`training_panel_topics`) so
they can be edited without a deploy, seeded with the spec's list:

> Customer se baat · Customer ke saath behaviour · Service kaise karni hai · App kaise use karna hai
> · Basic service rules · Safety instructions · Customer ko service properly kaise deni hai

### D7 — The record is created at KYC approval

**Decision:** auto-create a `TrainingRecord` when a Sewak's KYC is approved, with a lazy fallback if a
trainer searches a Sewak that somehow has none.

**Why:** creating it lazily on first search would work, but then "which Sewaks are waiting for
training?" is unanswerable — and admin needs exactly that work queue.

### D8 — Adding a mandatory item later does not deactivate live Sewaks

**Decision:** the item list is **snapshotted onto the record** when it's created, and re-synced only
while the record is still open. Once a Sewak is live, adding a new mandatory item to their category
does **not** knock them offline.

**Why:** retroactive deactivation would take an entire category's workforce offline without warning.
New items apply to new onboardings; existing Sewaks can be re-opened deliberately (D9).

### D9 — Admin can reopen a completed record

**Decision:** admin (not trainer) can reopen a `training_done` record, which reverts the Sewak to
`status: 'pending'` and takes them offline, with a mandatory reason logged.

---

## 4. The activation chain

```
Sewak registers
        │  status: 'pending' · isOnline: false · kycVerified: false
        ▼
Uploads Live Video → submits KYC
        │
        ▼
Admin approves KYC
        │  kycVerified: true · kycStatus: 'verified'
        │  status stays 'pending'          ← CHANGED (D2)
        │  TrainingRecord auto-created     ← NEW (D7)
        │
        │  Sewak can now reach /provider/kit-store to buy missing items  ← must stay open (Trap 1)
        ▼
Trainer opens Training Panel, enters Sewak Code
        │
        ├─ mandatory item missing ──► status: 'on_hold_item_missing'
        │                             Sewak orders it from their own app
        │                             trainer re-opens later and re-verifies
        │
        ▼
All mandatory items ticked ✓
        │
        ▼
Basic training delivered → all topics ticked ✓
        │
        ▼
Trainer clicks "Training Done"
        │  System asserts all THREE gates:
        │    skillSessionPassed ✓ AND allMandatoryVerified ✓ AND allTopicsCovered ✓
        ▼
Provider.status = 'verified' · isOnline = true   →  DISCOVERABLE / GO LIVE
        │
        ▼
[per service] Skill Session completed → that service becomes visible
```

---

## 5. Data model

### 5.1 New: `TrainingRecord`

`backend/models/TrainingRecord.js` — one per Sewak.

| Field | Type | Notes |
|---|---|---|
| `sewakId` | `ObjectId → Provider`, required, **unique** | One record per Sewak |
| `categoryId` | `ObjectId → Category` | Snapshotted at creation |
| `status` | enum | `pending` · `in_progress` · `on_hold_item_missing` · `training_done` |
| `itemVerifications` | `[itemVerificationSchema]` | Snapshotted list — see below (D8) |
| `trainingTopics` | `[{ key, label, covered, coveredAt }]` | Seeded from the `Setting` at creation |
| `trainingCompleted` | Boolean, default `false` | |
| `completedByModel` | `'User' \| 'Trainer'` | Admin or trainer |
| `completedBy` | `ObjectId` | refPath on `completedByModel` |
| `completedAt` | Date | |
| `activatedAt` | Date | When the profile actually went live |
| `holdReason` | String | Which mandatory items were missing |
| `reopenedCount` | Number, default `0` | D9 |
| `history` | `[{ action, byModel, by, byName, at, note }]` | Full audit trail |

**Item verification sub-schema:**

```js
const itemVerificationSchema = mongoose.Schema({
    itemId:       { type: ObjectId, ref: 'StarterKitItem' },
    itemName:     String,    // snapshot
    requiredQty:  Number,    // snapshot of kitQuantity
    isMandatory:  Boolean,   // snapshot — decides whether it blocks
    verified:     { type: Boolean, default: false },
    verifiedAt:   Date,
    verifiedByModel: { type: String, enum: ['User', 'Trainer'] },
    verifiedBy:   ObjectId
}, { _id: false });
```

**Indexes:** `{ sewakId: 1 }` (unique), `{ status: 1, updatedAt: -1 }` (admin work queue)

### 5.2 Extended: existing models

| Model | Change |
|---|---|
| `AuditLog` | `verifiedBy` must accept a Trainer — add `verifiedByModel` with `refPath`, and add `TRAINING` to the `entityType` enum. See [Trap 4](#trap-4--auditlogverifiedby-cannot-reference-a-trainer). |
| `Notification` | Add `'training'` to the `type` enum — **required**, see [Trap 3](#trap-3--the-notification-type-enum-rejects-unknown-values-silently). |
| `Provider` | No new fields. `status` / `isOnline` / `kycVerified` already carry everything (D2). |

### 5.3 New setting

`Setting` key `training_panel_topics` — array of `{ key, label }`, seeded with the seven Step-4 topics.

---

## 6. API surface

### 6.1 Shared — admin **or** trainer (`protectAdminOrTrainer`)

A new middleware is needed: these endpoints accept either an admin `User` token or a `Trainer` token,
resolving the actor into `req.actor = { id, model, name }` for audit purposes.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/training-panel/search?code=RSSEW00016` | **Step 1** — Sewak profile + documents (scoped & masked per D3) |
| `GET` | `/api/training-panel/:sewakId` | Full record: items to verify + topics + status |
| `PUT` | `/api/training-panel/:sewakId/verify-item` | **Step 2** — body `{ itemId, verified }` |
| `PUT` | `/api/training-panel/:sewakId/hold` | **Step 3** — put on hold, body `{ reason }` |
| `PUT` | `/api/training-panel/:sewakId/topic` | **Step 4** — body `{ topicKey, covered }` |
| `POST` | `/api/training-panel/:sewakId/complete` | **Step 5** — asserts both gates, then activates |
| `POST` | `/api/training-panel/:sewakId/view-document` | Logs a document view (D3) and returns the URL |

### 6.2 Admin only (`protect, admin`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/training-records` | Work queue — filter by status, category, city |
| `POST` | `/api/admin/training-records/:sewakId/reopen` | D9 — reverts to pending, body `{ reason }` |
| `GET` | `/api/admin/training-records/stats` | Counts by status for the dashboard |

### 6.3 Sewak (`protect`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/kit-store/training-status` | What's blocking me, and which items I still need to buy |

---

## 7. Build phases

### Phase 1 — Data foundation
*No dependencies · backend only · no visible change*

- 🆕 `models/TrainingRecord.js`
- ✏️ `models/AuditLog.js` (polymorphic `verifiedBy` + `TRAINING` entity type)
- ✏️ `models/Notification.js` (`'training'` in enum)
- 🆕 `Setting` seed for `training_panel_topics`
- 🆕 `middleware/protectAdminOrTrainer`

**Done when:** a record can be created and read; `Notification.create({ type: 'training' })` succeeds;
an `AuditLog` row can reference a Trainer.

### Phase 2 — Lookup & record API
*Depends on 1*

- 🆕 `controllers/trainingPanelController.js` — search, get, verify-item, hold, topic
- 🆕 `routes/trainingPanelRoutes.js`, mounted in `index.js`
- Scoping + masking + view-document audit (D3)

**Done when:** trainer search returns only in-scope Sewaks; out-of-scope returns 403; document
numbers arrive masked; ticking an item persists with the correct actor recorded.

### Phase 3 — Activation ⚠️
*Depends on 2 · **highest-risk phase — this is where go-live changes***

- ✏️ `adminController.verifySewak` / `verifySewakDocument` — stop setting `status: 'verified'` for
  Sewaks with an open training record; auto-create the record instead (D2, D7)
- 🆕 `POST /complete` — asserts both gates, flips `status` + `isOnline`, writes audit + notification
- ✏️ `adminController` — reopen endpoint (D9)

**Done when:** KYC approval alone no longer makes a Sewak discoverable; Training Done does; a Sewak
with a missing mandatory item cannot be completed; already-verified Sewaks are unaffected; Partners
are unaffected.

### Phase 4 — Trainer panel UI
*Depends on 2, 3*

- 🆕 `frontend/src/modules/trainer/pages/TrainingPanel.jsx` — search box → profile card → item
  checklist → topic checklist → Training Done
- ✏️ `TrainerSessions.jsx` — add navigation between "My Sessions" and "Training Panel"

**Done when:** a trainer can run all five steps end-to-end; on-hold state is obvious; Training Done is
disabled with a clear reason until both gates pass.

### Phase 5 — Admin panel UI
*Depends on 3*

- 🆕 `frontend/src/modules/admin/pages/AdminTrainingRecords.jsx` — work queue + same panel + reopen
- ✏️ `AdminSidebar.jsx`, `App.jsx`

**Done when:** admin sees everyone awaiting training, can run the panel unscoped, and can reopen a
completed record with a logged reason.

### Phase 6 — Sewak-side visibility
*Depends on 3*

- ✏️ `ProviderDashboard.jsx` — a status card: "Training pending" / "On hold — items missing" / "Live"
- ✏️ `SewakKitStore.jsx` — highlight exactly which mandatory items are blocking, linking to purchase

**Done when:** a held Sewak sees precisely which items to buy and can buy them without obstruction.

---

## 8. Known traps

### Trap 1 — Blocking the kit store creates an unbreakable deadlock

Step 3 requires the Sewak to buy the missing item **themselves**
(*"Sewak apne App se missing item khud order karega"*). But
[`ProtectedRoute.jsx:50`](frontend/src/components/ProtectedRoute.jsx#L50) already restricts Sewaks to
dashboard / documents / support until `kycVerified`.

**If the training gate is ever added to that guard, the Sewak cannot reach the store to buy the item
that is blocking their training.** Same shape as the wallet deadlock found in the Starter Kit plan.

**Rule: the training gate must never restrict `/provider/kit-store`.** Gate on `kycVerified` only —
which is already true by the time training starts.

### Trap 2 — `isMandatory` currently enforces nothing

`StarterKitItem.isMandatory` exists but is decorative — Q2 of the Starter Kit plan was implemented as
a label. Phase 3 makes it load-bearing. Audit existing items before switching the gate on: any item
mistakenly flagged mandatory will block every Sewak in that category.

### Trap 3 — The `Notification` type enum rejects unknown values *silently*

`Notification.js` enumerates allowed types. An unlisted value makes `Notification.create` throw —
which `notifyUser` **catches and logs**, returning normally. Push still delivers, so it presents as
"notifications work but the in-app bell is empty." Add `'training'` in Phase 1, and always pass
`data: { id: recordId }` — `notifyUser` builds its dedupe key from
`data.bookingId || data.leadId || data.id`.

### Trap 4 — `AuditLog.verifiedBy` cannot reference a Trainer

```js
verifiedBy: { type: ObjectId, ref: 'User', required: true }
```

A Trainer is a `Trainer` document, not a `User`. Writing a trainer's id here produces a reference that
silently fails to populate. Needs `verifiedByModel` + `refPath` in Phase 1 — before any trainer action
is logged.

### Trap 5 — Sewak codes are sequential and enumerable

`RSSEW00001`, `RSSEW00002`… Combined with Step 1's document exposure, an unscoped lookup is a bulk PII
leak. D3's scope + mask + audit + rate-limit exists specifically for this. Do not ship Phase 2 without
the scoping.

### Trap 6 — Changing KYC approval affects a live, working flow

Phase 3 edits `verifySewak`, which admins use every day. Get wrong and either (a) nobody goes live, or
(b) everybody goes live untrained. Gate the change on `providerCategory === 'sewak'` **and** the
existence of an incomplete `TrainingRecord`, so Partners and grandfathered Sewaks are provably
untouched.

---

## 9. Out of scope for v1

| Not building | Reasoning |
|---|---|
| Trainer ordering items on the Sewak's behalf | Explicitly excluded by the spec — *"Trainer/Admin ka kaam item order karna nahi hoga"* |
| Photo evidence of verified items | Spec says physical check only; add later if disputes arise |
| Training quiz / assessment | Spec is a checklist of topics covered, not a test |
| Retroactive deactivation on new mandatory items | D8 — would take a whole category offline unannounced |
| Per-service training inside this panel | That is the Skill Session system (D1) |
| Collecting Police Verification at registration | Separate change to the registration flow; the panel renders "not uploaded" |

---

*Plan prepared for review before build. D1–D3 were confirmed; D4–D9 are stated assumptions —
flag any you want changed before Phase 3, since that is where go-live behaviour actually shifts.*
