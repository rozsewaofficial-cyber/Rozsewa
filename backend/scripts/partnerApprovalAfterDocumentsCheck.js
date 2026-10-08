/**
 * A partner is approved only after every document is verified.
 *
 * Admin's Approve used to mark every pending document verified on the spot,
 * so a partner whose documents nobody had looked at went live; and verifying
 * the last document approved the partner by itself, before admin's approval
 * step. Approval is now refused until every document is verified, and the
 * last document verified completes document verification only.
 *
 *   node scripts/partnerApprovalAfterDocumentsCheck.js
 *
 * Runs the real controllers with the models stubbed; no database needed.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Provider = require('../models/Provider');
const AuditLog = require('../models/AuditLog');
const { updateProviderStatus, verifyProviderDocument, verifySewak, verifySewakDocument } = require('../controllers/adminController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

AuditLog.create = async () => ({});
// No database: notifications are skipped rather than waiting 10s on each.
const NotificationLog = require('../models/NotificationLog');
const Notification = require('../models/Notification');
NotificationLog.findOne = () => { throw new Error('no db in this check'); };
Notification.create = async () => { throw new Error('no db in this check'); };
let provider;
// Read plainly, or re-read with .select(...) at the end of a document review.
Provider.findById = () => { const q = Promise.resolve(provider); q.select = () => { const r = Promise.resolve(provider); r.lean = async () => provider; return r; }; return q; };
const admin = { _id: 'a1', name: 'Admin', role: 'admin' };
const partner = (docs) => ({
    _id: 'p1', shopName: 'Shop', ownerName: 'Owner', providerCategory: 'partner', status: 'pending', kycStatus: 'submitted',
    kycVerified: false, isOnline: false,
    documents: docs.map(([id, status]) => ({ id, status, fileName: `${id}.jpg`, url: 'https://x/y.jpg' })),
    markModified() {},
    save: async function () { return this; }
});
const call = (fn, params, body) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    fn({ params, body, user: admin }, res);
});
const approve = () => call(updateProviderStatus, { id: 'p1' }, { status: 'verified' });
const verifyDoc = (docId, status = 'verified') => call(verifyProviderDocument, { id: 'p1', docId }, { status, rejectionReason: 'blurry' });

(async () => {
    await check('approval is refused while a document is pending, and documents stay pending', async () => {
        provider = partner([['aadhaar_front', 'verified'], ['pan', 'pending']]);
        const r = await approve();
        assert.strictEqual(r.code, 400);
        assert.strictEqual(r.body.code, 'DOCUMENTS_NOT_VERIFIED');
        assert.ok(/pan\.jpg \(pending\)/.test(r.body.message));
        assert.strictEqual(provider.status, 'pending');
        assert.strictEqual(provider.documents[1].status, 'pending');
    });

    await check('approval is refused while a document is rejected', async () => {
        provider = partner([['aadhaar_front', 'verified'], ['pan', 'rejected']]);
        const r = await approve();
        assert.strictEqual(r.code, 400);
        assert.notStrictEqual(provider.status, 'verified');
    });

    await check('approval is refused when no documents were submitted', async () => {
        provider = partner([]);
        const r = await approve();
        assert.strictEqual(r.code, 400);
    });

    await check('verifying the last document completes documents but does not approve the partner', async () => {
        provider = partner([['aadhaar_front', 'verified'], ['pan', 'pending']]);
        const r = await verifyDoc('pan');
        assert.strictEqual(r.code, 200);
        assert.strictEqual(provider.kycStatus, 'verified');
        assert.strictEqual(provider.kycVerified, true);
        assert.strictEqual(provider.status, 'pending');
        assert.strictEqual(provider.isOnline, false);
    });

    await check('a rejected partner whose documents are then all verified returns to pending', async () => {
        provider = partner([['aadhaar_front', 'verified'], ['pan', 'rejected']]);
        provider.status = 'rejected';
        await verifyDoc('pan');
        assert.strictEqual(provider.status, 'pending');
    });

    await check('with every document verified, approval goes through', async () => {
        provider = partner([['aadhaar_front', 'verified'], ['pan', 'verified']]);
        const r = await approve();
        assert.strictEqual(r.code, 200);
        assert.strictEqual(provider.status, 'verified');
        assert.strictEqual(provider.kycVerified, true);
    });

    await check('rejecting or suspending needs no document check', async () => {
        provider = partner([['pan', 'pending']]);
        const r = await call(updateProviderStatus, { id: 'p1' }, { status: 'rejected', reason: 'fake' });
        assert.strictEqual(r.code, 200);
        assert.strictEqual(provider.status, 'rejected');
    });

    // --- Sewaks follow the same rule ---
    const sewak = (docs) => ({ ...partner(docs), providerCategory: 'sewak' });

    await check('Verify Sewak is refused until Aadhaar, PAN and the live video are verified', async () => {
        provider = sewak([['aadhaar', 'verified'], ['pan', 'pending'], ['live_video', 'verified']]);
        const r = await call(verifySewak, { id: 'p1' }, {});
        assert.strictEqual(r.code, 400);
        assert.ok(/pan \(pending\)/.test(r.body.message), r.body.message);
        assert.strictEqual(provider.documents[1].status, 'pending', 'documents are not verified for the admin');
        assert.notStrictEqual(provider.status, 'verified');
    });

    await check("verifying a Sewak's last document completes KYC but does not approve", async () => {
        provider = sewak([['aadhaar', 'verified'], ['pan', 'verified'], ['live_video', 'pending']]);
        const r = await call(verifySewakDocument, { id: 'p1', docId: 'live_video' }, { status: 'verified' });
        assert.strictEqual(r.code, 200);
        assert.strictEqual(provider.kycStatus, 'verified');
        assert.strictEqual(provider.status, 'pending');
    });

    await check("an approved partner's later upload is not verified by opening their profile", async () => {
        const src = read('backend', 'controllers', 'providerController.js');
        assert.ok(/providerDoc\.status === 'verified' && syncedLegacy/.test(src));
    });

    await check('admin screens show document verification and approval separately', async () => {
        const comp = read('frontend', 'src', 'modules', 'admin', 'components', 'VerificationStatus.jsx');
        assert.ok(/export const canApprove/.test(comp));
        for (const f of ['AdminProviders.jsx', 'AdminKYC.jsx']) {
            const page = read('frontend', 'src', 'modules', 'admin', 'pages', f);
            assert.ok(/<VerificationStatus provider=/.test(page), f);
            assert.ok(/canApprove\(/.test(page), f);
        }
    });

    console.log(`\n${passed} partner approval checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
