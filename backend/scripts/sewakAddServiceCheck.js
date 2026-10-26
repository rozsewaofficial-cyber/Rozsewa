/**
 * A Sewak can add services after the first pick: the Services page has Add
 * Service, which offers the category's services they don't offer yet and saves
 * through the same endpoint as the dashboard picker (no new API).
 *
 *   node scripts/sewakAddServiceCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderServices.jsx');
const routes = read('backend', 'routes', 'providerRoutes.js');

check('a Sewak sees Add Service on the services tab', () => {
    assert.ok(/\{user\?\.providerCategory === 'sewak' && activeTab === "services" && \([\s\S]{0,500}onClick=\{openSewakAdd\} data-sewak-add-service/.test(page));
});
check("it offers only priced category services the Sewak doesn't offer yet", () => {
    assert.ok(/categoryServices\.filter\(c => Number\(c\.basePrice\) > 0 && !sewakPickedKeys\.has\(/.test(page));
});
check('it saves through the existing select-services endpoint, on top of the current picks read fresh', () => {
    assert.ok(page.includes('const { data: me } = await API.get("/provider/profile");'));
    assert.ok(page.includes('.filter(n => available.has(n))'), 'picks admin hid are left out');
    assert.ok(page.includes('...sewakPicks.filter(n => !current.includes(n))'), 'no duplicates');
    assert.ok(page.includes('API.put("/provider/select-services", { subServices })'));
    assert.ok(page.includes('updateUser({ subServices: data.subServices })'));
    assert.ok(routes.includes("router.put('/select-services', protect, selectServices);"));
});
check("the list shows the services the Sewak offers (whole category until they pick)", () => {
    assert.ok(/const listedServices = sewakPickedKeys\.size > 0\s*\? services\.filter/.test(page));
    assert.ok((page.match(/listedServices\.filter\(s => serviceSubTab/g) || []).length === 2);
});
check('partners keep their own Add Service form', () => {
    assert.ok(/\{user\?\.providerCategory !== 'sewak' && \([\s\S]{0,700}resetForm\(\), setShowForm\(true\)/.test(page));
});

console.log(`\n${passed} sewak add service checks passed.`);
