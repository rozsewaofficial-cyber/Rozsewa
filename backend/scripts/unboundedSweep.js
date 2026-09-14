/**
 * Lists every query that can return a whole collection, and every screen that
 * derives a number from rows it only has one page of.
 *
 *   node scripts/unboundedSweep.js
 *
 * This reports; it does not fail. Not every entry is a bug — a list of
 * categories is bounded by how the business is set up rather than by how much
 * it is used. It exists because both problems are invisible until the data
 * grows: an unbounded read works perfectly on a small database, and a total
 * measured off a page keeps looking like a total.
 *
 * The rule it supports: if a list is paged, every number describing it comes
 * from the server. pagedFiguresCheck.js pins that rule for the screens that
 * already follow it.
 */
const fs = require('fs');
const path = require('path');

const BE = path.join(__dirname, '..');
const FE = path.join(BE, '..', 'frontend', 'src');

const walk = (dir, out = []) => {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === 'dist') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.jsx?$/.test(e.name)) out.push(p);
    }
    return out;
};
const rel = (base, f) => path.relative(base, f).replace(/\\/g, '/');

// Collections that are configuration: a row per category, per zone, per
// setting. Bounded by how the business is set up, so reading them whole is the
// point rather than an oversight.
const CONFIG = /^(CommissionSlab|PartnerPolicy|Setting|Category|Subcategory|Zone|Banner|BenefitPolicy|SubscriptionPlan|Combo|BazaarCategory|BazaarChatTemplate|Service|InstaService|Promotion|Coupon|Faq|FAQ|Guide|Page|StarterKitItem|KitCombo)$/;

/* ------------------------- reads without a ceiling ------------------------ */
const unbounded = [];
walk(path.join(BE, 'controllers')).concat(walk(path.join(BE, 'services'))).forEach((f) => {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
        // A model read, not Array.prototype.find.
        const m = line.match(/\b([A-Z]\w+)\.(find|aggregate)\(/);
        if (!m || /findOne|findById|findOneAnd/.test(line)) return;
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (CONFIG.test(m[1])) return;
        if (!/await|return|=\s*$/.test(lines.slice(Math.max(0, i - 2), i + 1).join(' '))) return;

        // An aggregation pipeline can run long before it reaches its $limit, so
        // it gets a wider window than a find() chain.
        const stmt = lines.slice(i, i + (/\.aggregate\(/.test(line) ? 45 : 16)).join(' ');
        const bounded =
            /\.limit\(/.test(stmt) ||
            /\$limit/.test(stmt) ||
            /paginate\(/.test(lines.slice(Math.max(0, i - 3), i + 3).join(' ')) ||
            /countDocuments|distinct/.test(line) ||
            // Looking up a known set of ids is bounded by that set — which is
            // usually the page of rows that produced it. This is the shape a
            // fixed N+1 takes, so flagging it would flag the cure.
            /\w*[iI]d: \{ \$in:/.test(stmt) ||
            // An aggregation that groups down to a fixed set of rows is bounded
            // by its own shape, however many documents it reads on the way: one
            // row per status, per month, per rating. What is not bounded is a
            // $group keyed on something that grows — a provider, a customer —
            // or one that collects the documents with $push.
            (/\.aggregate\(/.test(line) &&
                /\$group/.test(stmt) &&
                !/\$push/.test(stmt) &&
                /_id: (null|\{ \$dateToString|'\$status'|'\$rating'|"\$status"|'\$mode'|'\$ownerType'|'\$serviceName'|\{ (status|role):)/.test(stmt));
        if (bounded) return;

        unbounded.push({
            file: rel(BE, f),
            line: i + 1,
            projected: /\.select\(|\.lean\(\)/.test(stmt),
            code: line.trim().slice(0, 100)
        });
    });
});

/**
 * Reads that are deliberately left unbounded, and why. Matched on a fragment of
 * the line rather than a line number, so they survive edits above them.
 *
 * These are judgement calls, not oversights — putting a ceiling on any of them
 * would trade a performance problem for a correctness one.
 */
const ACCEPTED = [
    {
        file: 'controllers/adminCoinController.js',
        match: 'CoinLot.find(',
        why: 'FIFO coin deduction: consumes lots until the amount is covered, and stops early. A ceiling here could silently under-deduct, which is a money bug.'
    },
    {
        file: 'services/CoinRewardService.js',
        match: 'CoinLot.find(',
        why: 'The same deduction loop, in reverse order, for clawing a reward back.'
    },
    {
        file: 'controllers/commissionController.js',
        match: 'const bookings = await Booking.find({',
        why: "The sewak incentive report: one day of completed work, projected to the three fields the grouping reads. Bounded by the day, not by how long the platform has been running."
    },
    {
        file: 'controllers/commissionController.js',
        match: 'Withdrawal.find(withdrawalMatch)',
        why: 'The settlement analytics total these and the pending-settlement card draws a sparkline over them, so this one genuinely needs the rows. Bounded by the chosen range, and there are orders of magnitude fewer withdrawals than bookings.'
    },
    {
        file: 'controllers/v2CommissionController.js',
        match: 'Booking.find(',
        why: 'The v2 commission KPIs, bounded by the same chosen range.'
    },
    {
        file: 'services/InstaEarningsAdapter.js',
        match: 'InstaJob.find(',
        why: 'The Insta half of the same analytics, so it has to match whatever the booking half does.'
    },
    {
        file: 'controllers/trainingController.js',
        match: 'Trainer.aggregate(',
        why: 'Grouped per training centre, matched to the page of centres just fetched — bounded by that page.'
    }
];

const acceptedFor = (r) =>
    ACCEPTED.find(a => a.file === r.file && r.code.includes(a.match));

const open = unbounded.filter(r => !acceptedFor(r));
const known = unbounded.filter(r => acceptedFor(r));

console.log(`\n=== ${open.length} reads that can return a whole collection ===\n`);
if (!open.length) console.log('  (none)\n');
const byFile = {};
open.forEach(r => { (byFile[r.file] ||= []).push(r); });
Object.entries(byFile).forEach(([f, rs]) => {
    console.log(`  ${f}`);
    rs.forEach(r => console.log(`      :${r.line}  ${r.projected ? '(projected)' : '(whole documents)'}  ${r.code}`));
});

if (known.length) {
    console.log(`\n=== ${known.length} left unbounded on purpose ===\n`);
    const seen = new Set();
    known.forEach(r => {
        const a = acceptedFor(r);
        const key = a.file + a.match;
        console.log(`  ${r.file}:${r.line}  ${r.code.slice(0, 70)}`);
        if (!seen.has(key)) {
            console.log(`      ${a.why}`);
            seen.add(key);
        }
    });
}

/* --------------------- figures derived from a page ------------------------ */
// Every list the paging work touched.
const PAGED = [
    '/admin/bookings', '/admin/feedback', '/admin/withdrawals', '/admin/finance',
    '/admin/commission', '/admin/leads', '/provider/withdrawals', '/wallet',
    '/bookings/provider', '/notifications', '/bazaar/admin/transactions',
    '/public/providers/'
];
const DERIVES = [
    [/\.reduce\s*\(/, 'sums the rows'],
    [/\.length\s*\}/, 'prints the row count'],
    [/\/\s*\w+\.length/, 'averages over the rows'],
    [/\.filter\([^)]*\)\.length/, 'counts a subset']
];
// Rows a screen holds deliberately — a cart, one booking's extra charges, a
// form — are its own, and counting them is right.
const LOCAL = /cart|items\.length|parts\.length|digits\.length|coordinates\.length|payload\.length|tips\.length|rows\.length|headers|photos|images|attachments|extraCharges|\bfiles\b|wordCount/i;

console.log(`\n=== Screens deriving a figure from rows they hold one page of ===\n`);
let flagged = 0;
walk(FE).forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    if (!PAGED.some(e => src.includes(e))) return;

    const hits = [];
    src.split(/\r?\n/).forEach((line, i) => {
        if (/^\s*(\/\/|\*|\{\/\*)/.test(line) || LOCAL.test(line)) return;
        DERIVES.forEach(([rx, why]) => {
            if (rx.test(line)) hits.push(`:${i + 1} ${why} — ${line.trim().slice(0, 80)}`);
        });
    });
    if (!hits.length) return;
    flagged += hits.length;
    console.log(`  ${rel(FE, f)}`);
    hits.forEach(h => console.log(`      ${h}`));
});

console.log(`\n  ${flagged} to judge by hand — a figure is only wrong if the list it`);
console.log('  describes actually arrives one page at a time.\n');
