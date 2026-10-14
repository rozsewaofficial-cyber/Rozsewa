/**
 * Leads are for partners: a Sewak has no Leads tab or tile, the Leads page
 * sends them to their dashboard, and the server neither sends them leads nor
 * lists or unlocks one for them. Partners keep Leads.
 *
 *   node scripts/sewakNoLeadsCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const nav = read('frontend', 'src', 'modules', 'provider', 'components', 'ProviderBottomNav.jsx');
const dash = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDashboard.jsx');
const app = read('frontend', 'src', 'App.jsx');
const ctrl = read('backend', 'controllers', 'leadController.js');

check('no Leads tab in a Sewak\'s bottom bar (partners keep it)', () => {
    assert.ok(/\.\.\.\(!isSewakUser \? \[\{ icon: Briefcase, label: "Leads", path: "\/provider\/leads" \}\] : \[\]\)/.test(nav));
});
check('no Leads tile on a Sewak\'s dashboard', () => {
    assert.ok(dash.includes('if (item.title === "Leads" || item.path === "/provider/leads") return user?.providerCategory !== \'sewak\';'));
});
check('the Leads page sends a Sewak to their dashboard', () => {
    assert.ok(app.includes('<NoSewak><ProviderLeads /></NoSewak>'));
    assert.ok(/const NoSewak = [\s\S]{0,200}<Navigate to="\/provider" replace \/>/.test(app));
});
check('the server sends, lists and unlocks no leads for a Sewak', () => {
    assert.ok(/vendorType:\s+lead\.categoryId,[\s\S]{0,120}providerCategory: \{ \$ne: 'sewak' \},/.test(ctrl), 'targeting');
    assert.ok(ctrl.includes("if (!provider.vendorType || provider.providerCategory === 'sewak') return res.json({ leads: [], page, pages: 0, count: 0 });"), 'list');
    assert.ok(/const unlockLead = async \(req, res\) => \{[\s\S]{0,200}if \(req\.user\?\.providerCategory === 'sewak'\) \{\s*return res\.status\(403\)/.test(ctrl), 'unlock');
});

console.log(`\n${passed} sewak no-leads checks passed.`);
