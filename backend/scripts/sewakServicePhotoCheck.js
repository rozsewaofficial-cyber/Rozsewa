/**
 * A Sewak's services carry the photo admin set on the catalog service, so it
 * shows on the Sewak's own pages and on the customer shop page.
 *
 *   node scripts/sewakServicePhotoCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const svc = read('backend', 'controllers', 'serviceController.js');
const home = read('backend', 'controllers', 'homeController.js');
const dash = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDashboard.jsx');

check("a Sewak's own services list includes the catalog photo", () => {
    assert.ok(/image: catSvc\.image \|\| '',/.test(svc));
});
check("customers see a Sewak's service photos on the shop page", () => {
    assert.ok(/image: catSvc\.image \|\| '',/.test(home));
});
check('the "Choose your services" list shows each service photo (icon when none)', () => {
    assert.ok(/import ServiceVisual from "@\/components\/ServiceVisual";/.test(dash));
    assert.ok(/data-service-photo>\s*<ServiceVisual src=\{s\.image\} name=\{s\.name\}/.test(dash));
});

console.log(`\n${passed} sewak service photo checks passed.`);
