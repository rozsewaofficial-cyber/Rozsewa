/**
 * The RozSewa Welfare Fund takes money from two sides of the marketplace:
 * customers, whose wallet is keyed by `userId`, and partners and Sewaks, whose
 * wallet is keyed by `providerId`. One controller serves both, which is what
 * makes it worth pinning — a single wrong key would either debit a stranger's
 * wallet or file a gift against nobody, and neither shows up as an error.
 *
 * The other rule here is the one the paged-figure sweep is about: what somebody
 * has given, and what the fund holds, describe every contribution ever made.
 * Neither may be measured off the page of rows that happens to be in hand.
 *
 *   node scripts/welfareFundCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const controller = read('controllers/welfareFundController.js');

console.log('\nBoth sides of the marketplace can give');

check('one place decides whose money it is', () => {
    assert.ok(/const contributorFor = async/.test(controller),
        'the customer and partner paths must not each work the key out for themselves');
    const fn = controller.slice(controller.indexOf('const contributorFor'),
        controller.indexOf('// @desc    Contribute'));
    assert.ok(/role === 'provider' \|\| .*role === 'sewak'/.test(fn),
        'a partner and a Sewak are both providers');
    assert.ok(/walletQuery: \{ providerId/.test(fn) && /walletQuery: \{ userId/.test(fn),
        'and the two kinds draw on differently-keyed wallets');
});

check('a customer is not looked up as a partner', () => {
    // The original controller went straight to Provider.findById and answered
    // 404 to every customer who tried to give.
    const fn = controller.slice(controller.indexOf('const contributorFor'),
        controller.indexOf('// @desc    Contribute'));
    assert.ok(/User\.findById/.test(fn), 'a customer resolves through User');
    assert.ok(/Provider\.findById/.test(fn), 'a partner through Provider');
});

check('the gift, the debit and the wallet all use the same key', () => {
    const fn = controller.slice(controller.indexOf('const contributeToWelfareFund'),
        controller.indexOf('// @desc    The caller'));
    assert.ok(/Wallet\.findOne\(contributor\.walletQuery\)/.test(fn), 'the wallet');
    assert.ok(/\.\.\.contributor\.ledgerKey/.test(fn), 'the wallet transaction');
    assert.ok(/\.\.\.contributor\.contributionKey/.test(fn), 'and the contribution row');
    assert.ok(/contributorType: contributor\.kind/.test(fn),
        'typed by the same decision, so the type cannot disagree with the key');
});

check('a gift is refused when the wallet cannot cover it', () => {
    const fn = controller.slice(controller.indexOf('const contributeToWelfareFund'),
        controller.indexOf('// @desc    The caller'));
    assert.ok(/wallet\.balance < amount/.test(fn), 'the server checks the balance itself');
    assert.ok(/amount < 1|isNaN\(amount\)/.test(fn), 'and that the amount is a real one');
    // The client guard is a courtesy; it can be walked straight past.
    assert.ok(fn.indexOf('wallet.balance < amount') < fn.indexOf('wallet.balance -= amount'),
        'and it checks before it debits');
});

check("a partner's dashboard copy of the balance keeps up", () => {
    const fn = controller.slice(controller.indexOf('const contributeToWelfareFund'),
        controller.indexOf('// @desc    The caller'));
    assert.ok(/contributor\.provider\.walletBalance = wallet\.balance/.test(fn),
        'the profile carries a copy for the dashboard, which would otherwise go stale');
});

console.log('\nThe totals describe the fund, not a page of it');

check('what a contributor has given is counted in the database', () => {
    const fn = controller.slice(controller.indexOf('const getMyWelfareFundContributions'),
        controller.indexOf('// @desc    What the fund has received'));
    assert.ok(/WelfareFundContribution\.aggregate/.test(fn), 'aggregated');
    assert.ok(/total: \{ \$sum: '\$amount' \}/.test(fn), 'over every amount');
    assert.ok(!/contributions\.reduce/.test(fn),
        'and never summed over the page that was fetched for display');
});

check('the fund total and the gift count come from the whole ledger', () => {
    const fn = controller.slice(controller.indexOf('const getWelfareFundSummary'));
    assert.ok(/totalRaised: \{ \$sum: '\$amount' \}/.test(fn), 'the total');
    assert.ok(/contributions: \{ \$sum: 1 \}/.test(fn), 'and the number of gifts');
});

check('the two halves are counted so they can add up to the whole', () => {
    const fn = controller.slice(controller.indexOf('const getWelfareFundSummary'));
    assert.ok(/fromCustomers/.test(fn) && /fromPartners/.test(fn), 'both sides are reported');
    assert.ok(/\$in: \['\$contributorType', \['provider', 'sewak'\]\]/.test(fn),
        'a Sewak counts as a partner, so nobody falls between the two');
});

check('contributors are people, not gifts', () => {
    const fn = controller.slice(controller.indexOf('const getWelfareFundSummary'));
    // Somebody who gives twice is one contributor. Counting rows would quietly
    // inflate the number of people behind the fund.
    assert.ok(/\$group: \{ _id: \{ \$ifNull: \['\$userId', '\$providerId'\] \} \}/.test(fn),
        'distinct givers, across both keys');
    assert.ok(/\$count: 'contributors'/.test(fn), 'then counted');
});

console.log('\nThe card a customer sees');

const card = feRead('modules/user/components/WelfareFundCard.jsx');

check('it takes both figures from the server', () => {
    assert.ok(/my-contributions/.test(card) && /welfare-fund\/summary/.test(card),
        'its own giving and the fund total are both asked for');
    assert.ok(/mine\.data\.totalContributed/.test(card),
        'and the total shown is the server total');
    assert.ok(!/\.reduce\(/.test(card), 'nothing on the card is summed out of a list');
});

check('it reads the balance from the wallet, not the session', () => {
    // A partner carries walletBalance on their profile; a customer does not,
    // so the card is handed the balance by the page that loaded the wallet.
    assert.ok(/walletBalance = 0, onContributed/.test(card),
        'the balance and the refresh callback are both props');
    assert.ok(!/useAuth/.test(card), 'it must not reach for a balance the session has not got');
});

check('the wallet page hands it the balance and refreshes after a gift', () => {
    const wallet = feRead('modules/user/pages/Wallet.jsx');
    assert.ok(/<WelfareFundCard/.test(wallet), 'the card is on the wallet page');
    assert.ok(/walletBalance=\{balance\}/.test(wallet), 'given the balance it just loaded');
    assert.ok(/onContributed=\{\(\) => fetchWalletData/.test(wallet),
        'and the page reloads itself afterwards, so the balance and the ledger agree');
});

check('the routes are open to whoever protect lets through', () => {
    const routes = read('routes/welfareFundRoutes.js');
    for (const p of ['/contribute', '/my-contributions', '/summary']) {
        assert.ok(new RegExp(`'${p}', protect`).test(routes), `${p} is behind protect`);
    }
    assert.ok(!/providerProtect|isProvider/.test(routes),
        'and not behind a partner-only guard, which is what shut customers out');
});

console.log(`\n${passed} welfare-fund checks passed.\n`);
