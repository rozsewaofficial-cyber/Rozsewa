/**
 * Benefit Policy note (item 38) asked for four things the pure-CMS feature
 * didn't have: a real content type (already existed as `type`, unchanged),
 * user-wise vs provider-wise audience targeting (it was provider-only), a
 * request/claim workflow with a status an admin can act on (it was purely
 * admin-authored content, no claiming), and exclusion of Sewak (the route
 * gate actually let Sewak in).
 *
 * These pin: BenefitPolicy carries an audience; the public endpoint filters
 * by it; BenefitRequest resolves its applicant across two different
 * collections via refPath (User vs Provider, mirroring Notification); the
 * create endpoint blocks Sewak and audience mismatches and duplicate
 * pending requests; the admin approve/reject endpoint guards against
 * reprocessing a non-pending request; and both the provider and the new
 * customer page offer a claim button, a status, and (for the provider) a
 * hard Sewak lockout screen.
 *
 *   node scripts/benefitPolicyRequestCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const policyModel = read('models/BenefitPolicy.js');
const requestModel = read('models/BenefitRequest.js');
const policyController = read('controllers/benefitPolicyController.js');
const requestController = read('controllers/benefitRequestController.js');
const adminRoutes = read('routes/adminRoutes.js');
const requestRoutes = read('routes/benefitRequestRoutes.js');
const index = read('index.js');
const providerUi = feRead('modules/provider/pages/ProviderBenefitPolicy.jsx');
const customerUi = feRead('modules/user/pages/CustomerBenefitPolicy.jsx');
const adminUi = feRead('modules/admin/pages/AdminBenefitPolicies.jsx');

console.log('\nBenefitPolicy carries an audience, and the public feed filters by it');

check('audience defaults to provider (existing content stays provider-facing)', () => {
    assert.ok(/audience:.*enum: \['user', 'provider'\], default: 'provider'/.test(policyModel));
});

check('the public endpoint only narrows by audience when one is explicitly asked for', () => {
    const fn = sliceFn(policyController, 'const getPublicBenefitPolicies');
    assert.ok(/scope\.audience = req\.query\.audience/.test(fn),
        'otherwise a customer and a provider hitting the same endpoint would see each other\'s content');
});

console.log('\nBenefitRequest resolves its applicant across two collections, like Notification does');

check('applicantId uses refPath, not a fixed ref, since a customer is a User and a provider is a Provider', () => {
    assert.ok(/applicantId:.*refPath: 'applicantModel'/.test(requestModel));
    assert.ok(/applicantModel:.*enum: \['User', 'Provider'\]/.test(requestModel));
});

console.log('\nClaiming a benefit is gated correctly');

check('Sewak is blocked from claiming, even if the audience is provider', () => {
    const fn = sliceFn(requestController, 'const createBenefitRequest');
    assert.ok(/req\.user\.providerCategory === 'sewak'/.test(fn));
});

check('a mismatched audience (a customer claiming a provider-only benefit, or vice versa) is rejected', () => {
    const fn = sliceFn(requestController, 'const createBenefitRequest');
    assert.ok(/policy\.audience && policy\.audience !== \(applicantRole === 'provider' \? 'provider' : 'user'\)/.test(fn));
});

check('a second pending request for the same benefit is blocked, not duplicated', () => {
    const fn = sliceFn(requestController, 'const createBenefitRequest');
    assert.ok(/status: 'pending'/.test(fn) && /already have a pending request/.test(fn));
});

check('the admin cannot reprocess a request that already has a final status', () => {
    const fn = sliceFn(requestController, 'const updateBenefitRequestStatus');
    assert.ok(/request\.status !== 'pending'/.test(fn));
});

console.log('\nRoutes are wired for both the shared claim endpoint and the admin review endpoint');

check('the claim/list-own routes sit on a shared, unprefixed mount (like Complaint), not under /provider or /user', () => {
    assert.ok(/app\.use\('\/api\/benefit-requests', benefitRequestRoutes\)/.test(index));
    assert.ok(/router\.post\('\/', protect, createBenefitRequest\)/.test(requestRoutes));
    assert.ok(/router\.get\('\/', protect, getMyBenefitRequests\)/.test(requestRoutes));
});

check('the admin list and status-update routes are protected and admin-gated', () => {
    assert.ok(/router\.get\('\/benefit-requests', protect, admin, getBenefitRequests\)/.test(adminRoutes));
    assert.ok(/router\.patch\('\/benefit-requests\/:id', protect, admin, updateBenefitRequestStatus\)/.test(adminRoutes));
});

console.log('\nThe provider app hard-locks Sewak out, and both apps offer a claim button with a status');

check('ProviderBenefitPolicy shows an Access Restricted screen for Sewak, like Provider99Card does', () => {
    assert.ok(/provider\?\.providerCategory === 'sewak'/.test(providerUi));
    assert.ok(/Access Restricted/.test(providerUi));
});

check('both the provider and customer pages fetch their own audience only', () => {
    assert.ok(/audience: "provider"/.test(providerUi));
    assert.ok(/audience: "user"/.test(customerUi));
});

check('both pages let an unclaimed benefit be requested, and show pending/approved/rejected once claimed', () => {
    [providerUi, customerUi].forEach(ui => {
        assert.ok(/Request This Benefit/.test(ui));
        assert.ok(/Request Pending/.test(ui) && /Approved/.test(ui) && /Rejected/.test(ui));
    });
});

console.log('\nThe admin can manage audience and review requests');

check('the admin form lets a policy be marked user-wise or provider-wise', () => {
    assert.ok(/value=\{formData\.audience \|\| 'provider'\}/.test(adminUi));
});

check('a Requests tab exists with approve/reject actions', () => {
    assert.ok(/BenefitRequestsTab/.test(adminUi));
    assert.ok(/\/admin\/benefit-requests\/\$\{id\}/.test(adminUi));
});

console.log(`\n${passed} benefit-policy-request checks passed.\n`);
