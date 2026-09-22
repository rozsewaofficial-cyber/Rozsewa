/**
 * The Provider Approval screen's "Identity Documents" section read four
 * fixed legacy fields (`kycAadhaarPhoto`, `kycAadhaarBackPhoto`,
 * `kycPanPhoto`, `profileImage`), never the `documents[]` array the model has
 * actually carried per-document status and rejection reasons on all along.
 * Worse, the row a table click handed the modal was fetched with a
 * projection that strips `documents` entirely for the list, so even a
 * correct read there would have shown nothing. The result: every uploaded
 * document read as "Missing" regardless of what was actually submitted, no
 * document could be approved or rejected on its own, and rejecting a whole
 * application asked for no reason at all — a rejection with no reason is
 * exactly what a Suspend already required, just not a Reject.
 *
 * These pin the shape that fixes it: the detail modal fetches the full
 * provider, the documents it renders come from the real array, each one can
 * be approved or rejected with a required, provider-visible reason, and that
 * same reason box is what a whole-application reject uses too.
 *
 *   node scripts/providerDocumentCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

// A fixed-length slice after a function's `const name` breaks the moment
// anything earlier in that function grows past the window — as happened here
// once already. Slicing to the next top-level `const` declaration instead
// tracks the function's real end regardless of how long its body gets.
const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const controller = read('controllers/adminController.js');
const routes = read('routes/adminRoutes.js');
const ui = feRead('modules/admin/pages/AdminProviders.jsx');

console.log('\nThe detail modal can actually see the documents');

check('a dedicated endpoint returns the full provider, documents included', () => {
    const fn = controller.slice(controller.indexOf('const getProviderById'), controller.indexOf('// @desc    Providers as a dropdown') > -1
        ? controller.indexOf('// @desc    Counts behind the provider screens')
        : controller.length);
    assert.ok(/Provider\.findById\(req\.params\.id\)/.test(fn), 'fetched fresh, by id');
    assert.ok(!/PROVIDER_LIST_FIELDS/.test(fn),
        'and not through the list projection, which strips documents entirely');
});

check('it is mounted after /stats and /picker, not before', () => {
    const statsAt = routes.indexOf("router.get('/providers/stats'");
    const pickerAt = routes.indexOf("router.get('/providers/picker'");
    const idAt = routes.indexOf("router.get('/providers/:id'");
    assert.ok(statsAt > -1 && pickerAt > -1 && idAt > -1, 'all three routes exist');
    assert.ok(idAt > statsAt && idAt > pickerAt,
        'or :id would swallow /stats and /picker as literal provider ids');
});

check('opening Details fetches the full record instead of reusing the table row', () => {
    const fn = sliceFn(ui, 'const openProviderDetails');
    assert.ok(/API\.get\(`\/admin\/providers\/\$\{provider\._id\}`\)/.test(fn),
        'the row from the table is not treated as the whole record');
});

check('the grid renders whatever documents were actually submitted', () => {
    const fn = ui.slice(ui.indexOf('Identity Documents'), ui.indexOf('Identity Documents') + 2000);
    assert.ok(/selectedProvider\.documents \|\| \[\]\)\.map/.test(fn),
        'read from the real array, not four fixed labels reading legacy flat fields');
    assert.ok(!/kycAadhaarPhoto/.test(fn) && !/kycPanPhoto/.test(fn),
        'the dead fields are gone from this section');
});

console.log('\nA document can be reviewed on its own');

check('there is a per-document verify endpoint, reachable for any provider category', () => {
    assert.ok(/const verifyProviderDocument = async/.test(controller), 'the function exists');
    assert.ok(/router\.put\('\/providers\/:id\/documents\/:docId\/status'/.test(routes), 'and is routed');
});

check('rejecting a document requires a reason', () => {
    const fn = sliceFn(controller, 'const verifyProviderDocument');
    assert.ok(/status === 'rejected' && !String\(rejectionReason \|\| ''\)\.trim\(\)/.test(fn),
        'checked before anything is written');
});

check("the response carries documents, so the grid doesn't go blank after a review", () => {
    const fn = sliceFn(controller, 'const verifyProviderDocument');
    const respIdx = fn.lastIndexOf('Provider.findById(id).select(');
    assert.ok(respIdx > -1, 'the response is built from a fresh read');
    assert.ok(!/PROVIDER_LIST_FIELDS/.test(fn.slice(respIdx, respIdx + 120)),
        'not through the list projection, which strips documents — the exact ' +
        'mistake that made every document vanish the instant one was reviewed');
});

check('a Sewak stays gated behind training even when fully document-verified', () => {
    const fn = sliceFn(controller, 'const verifyProviderDocument');
    assert.ok(/requiresTrainingBeforeGoLive\(provider\)/.test(fn),
        'the same gate the rest of the Sewak flow already depends on, reused rather than reimplemented');
});

console.log('\nA rejection always carries a reason');

check('the whole-application reject opens a reason dialog instead of window.prompt', () => {
    const fn = sliceFn(ui, 'const handleUpdateStatus');
    assert.ok(/newStatus === "rejected"/.test(fn) && /setRejectionTarget/.test(fn),
        'reject routes through the same dialog as suspend already did');
});

check('an empty reason is refused before anything is sent', () => {
    const fn = sliceFn(ui, 'const submitRejection');
    assert.ok(/!rejectionReason\.trim\(\)/.test(fn), 'checked client-side before the call');
});

check('the same dialog serves both a document reject and a whole-application reject', () => {
    const fn = ui.slice(ui.indexOf('const submitRejection'), ui.indexOf('const handleDocumentAction'));
    assert.ok(/const \{ providerId, docId \} = rejectionTarget/.test(fn),
        'one function, branching on whether a document was named');
});

console.log(`\n${passed} provider-document checks passed.\n`);
