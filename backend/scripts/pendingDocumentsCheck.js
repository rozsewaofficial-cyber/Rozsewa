/**
 * A Sewak sees which documents are still pending: the dashboard Documents
 * card names them (as it names rejected ones), and the KYC screen's checklist
 * lists the registration documents (Aadhaar, PAN) with their actual status.
 *
 *   node scripts/pendingDocumentsCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const lib = read('frontend', 'src', 'lib', 'documentStatus.js');
const card = read('frontend', 'src', 'modules', 'provider', 'components', 'DocumentStatusCard.jsx');
const dash = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDashboard.jsx');

check('the shared status lists the documents waiting for admin', () => {
    assert.ok(/const pending = docs\s*\.filter\(\(d\) => d\.status === "pending"\)/.test(lib));
    assert.ok(/return \{ state, total, verified, rejected, pending \};/.test(lib));
});
check('the card waits for the documents (login returns none) instead of saying "upload"', () => {
    assert.ok(/if \(!Array\.isArray\(user\.documents\)\) return null;\s*const status = partnerDocumentStatus\(user\);/.test(card));
});
check('the dashboard Documents card names each pending document', () => {
    assert.ok(/\{status\.pending\.length > 0 && \(\s*<ul[^>]*data-pending-documents>/.test(card));
});
check("the KYC checklist shows Aadhaar and PAN with their status when they're on file", () => {
    for (const id of ['aadhaar_front', 'aadhaar_back', 'aadhaar', 'pan']) {
        assert.ok(dash.includes(`user?.documents?.some(d => d.id === '${id}') && getChecklistItem(`), id);
    }
});

check('the Verification Vault counter counts the documents it lists (no "6/5")', () => {
    const vault = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDocuments.jsx');
    assert.ok(vault.includes('const listedIds = new Set([...listedDocTypes.map(t => t.id), "live_video"]);'));
    assert.ok(vault.includes('{verifiedCount}/{totalItems} items verified'));
    assert.ok(vault.includes('(verifiedCount / totalItems) * 100'));
});

console.log(`\n${passed} pending documents checks passed.`);
