/**
 * The partner's Home page shows their document verification status.
 *
 * Nothing on Home said a document was pending or rejected, and an uploaded
 * document was saved as verified on the spot, so it never was pending. The
 * Home page now shows Pending / Under Review / Rejected (re-upload) from the
 * documents on the profile, and an uploaded file waits for admin.
 *
 *   node scripts/partnerDocumentStatusHomeCheck.js
 *
 * Runs the real upload controller with the model stubbed; no database needed.
 */
const assert = require('assert');
// No database: anything not stubbed fails at once instead of waiting 10s.
require('mongoose').set('bufferCommands', false);
const fs = require('fs');
const path = require('path');
const Provider = require('../models/Provider');
const { uploadDocument } = require('../controllers/providerController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

let provider;
Provider.findById = async () => provider;
const call = (body, file) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    uploadDocument({ body, file, user: { _id: 'p1' } }, res);
});
const fresh = (docs) => ({
    _id: 'p1', ownerName: 'Owner', documents: docs,
    save: async function () { return this; }
});

(async () => {
    await check('an uploaded file waits for admin review (was saved as verified)', async () => {
        provider = fresh([]);
        await call({ docId: 'police', docNumber: 'PV123' }, { path: 'https://x/police.jpg', originalname: 'police.jpg' });
        assert.strictEqual(provider.documents[0].status, 'pending');
    });

    await check('re-uploading a rejected document puts it back to pending, reason cleared', async () => {
        provider = fresh([{ id: 'pan', status: 'rejected', rejectionReason: 'blurry', url: 'https://x/old.jpg' }]);
        await call({ docId: 'pan' }, { path: 'https://x/new.jpg', originalname: 'pan.jpg' });
        assert.strictEqual(provider.documents.length, 1);
        assert.strictEqual(provider.documents[0].status, 'pending');
        assert.strictEqual(provider.documents[0].url, 'https://x/new.jpg');
        assert.ok(!provider.documents[0].rejectionReason);
    });

    // The status rules (lib/documentStatus.js is ESM; evaluate its function bodies here).
    const lib = read('frontend', 'src', 'lib', 'documentStatus.js');
    const mod = { exports: {} };
    new Function('module', lib.replace(/export const /g, 'const ') + '\nmodule.exports = { partnerDocumentStatus, documentVerification, documentLabel };')(mod);
    const { partnerDocumentStatus, documentVerification } = mod.exports;
    const st = (docs) => partnerDocumentStatus({ documents: docs.map(([id, status, rejectionReason]) => ({ id, status, rejectionReason })) });

    await check('Home status: none / draft / review / rejected / verified', async () => {
        assert.strictEqual(st([]).state, 'none');
        assert.strictEqual(st([['pan', 'verified'], ['live_video', 'draft']]).state, 'draft');
        assert.strictEqual(st([['pan', 'verified'], ['aadhaar_front', 'pending']]).state, 'review');
        const r = st([['pan', 'rejected', 'blurry'], ['aadhaar_front', 'pending']]);
        assert.strictEqual(r.state, 'rejected', 'rejected comes first');
        assert.deepStrictEqual(r.rejected, [{ id: 'pan', label: 'PAN Card', reason: 'blurry' }]);
        const v = st([['pan', 'verified'], ['police', 'verified']]);
        assert.strictEqual(v.state, 'verified');
        assert.strictEqual(v.verified, 2);
    });

    await check('admin badges and Home read the same rules', async () => {
        assert.strictEqual(documentVerification({ documents: [{ status: 'rejected' }] }).key, 'rejected');
        const admin = read('frontend', 'src', 'modules', 'admin', 'components', 'VerificationStatus.jsx');
        assert.ok(/from "@\/lib\/documentStatus"/.test(admin));
        assert.ok(!/const documentVerification = /.test(admin), 'no second copy of the rules');
    });

    await check('the Home page shows the card, and its button opens the documents page', async () => {
        const dash = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDashboard.jsx');
        assert.ok(/<DocumentStatusCard \/>/.test(dash), 'main dashboard');
        assert.ok(/<DocumentStatusCard showVerified \/>/.test(dash), 'approval-pending screen');
        const card = read('frontend', 'src', 'modules', 'provider', 'components', 'DocumentStatusCard.jsx');
        assert.ok(/to="\/provider\/documents"/.test(card));
        assert.ok(/API\.get\("\/provider\/profile"\)/.test(card), 'refreshes from the profile');
    });

    await check('a rejected registration document can be re-uploaded on the documents page', async () => {
        const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDocuments.jsx');
        assert.ok(/listedDocTypes\.map/.test(page));
        assert.ok(/registrationDocTypes/.test(page));
    });

    console.log(`\n${passed} document status checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
