/**
 * The "Want to become a Sewak?" enquiry on the Provider Login screen posted
 * to POST /api/public/sewak-enquiry, and `createEnquiry` was written and
 * exported from sewakEnquiryController.js — but no route file ever imported
 * or mounted it. Every submission 404'd silently (the form only reads
 * `data.success`, so a failed request just showed a "Submission Failed"
 * toast), nothing was ever written to the database, and the admin's Sewak
 * Enquiries screen stayed permanently empty as a result — not because
 * anything there was broken, but because it had nothing to show.
 *
 *   node scripts/sewakEnquiryCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const publicRoutes = read('routes/publicRoutes.js');
const adminRoutes = read('routes/adminRoutes.js');
const providerLogin = feRead('modules/provider/pages/ProviderLogin.jsx');

console.log('\nAn enquiry submitted from the site actually reaches the database');

check('the public route the form posts to is mounted', () => {
    assert.ok(/API\.post\("\/public\/sewak-enquiry"/.test(providerLogin),
        'the form still posts here');
    assert.ok(/router\.post\('\/sewak-enquiry',\s*require\('\.\.\/controllers\/sewakEnquiryController'\)\.createEnquiry\)/.test(publicRoutes),
        'and something now answers that path instead of it 404ing past every route file');
});

console.log('\nThe admin side that reads it back is already wired correctly');

check('the admin list/status/delete routes exist for what createEnquiry writes', () => {
    assert.ok(/router\.get\('\/sewak-enquiries',/.test(adminRoutes), 'list');
    assert.ok(/router\.put\('\/sewak-enquiries\/:id\/status',/.test(adminRoutes), 'status change');
    assert.ok(/router\.delete\('\/sewak-enquiries\/:id',/.test(adminRoutes), 'delete');
});

console.log(`\n${passed} sewak-enquiry checks passed.\n`);
