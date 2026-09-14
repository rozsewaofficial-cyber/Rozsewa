/**
 * Every list on every screen now arrives one page at a time. That quietly
 * changes the meaning of anything counted, summed or averaged over it: a total
 * measured off the rows in hand stops describing the collection and starts
 * describing the page, and it does so without failing, without an error, and
 * without looking wrong.
 *
 * So this pins the rule rather than the instances: a screen holding one page of
 * something must take its counts, sums and averages from the server.
 *
 *   node scripts/pagedFiguresCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', '..', 'frontend', 'src');
const read = (rel) => fs.readFileSync(path.join(SRC, rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

/**
 * A screen, the figures it must not measure off its own rows, and the
 * server-supplied value it must use instead.
 */
const SCREENS = [
    {
        file: 'modules/provider/pages/ProviderReviews.jsx',
        what: "a worker's own rating",
        banned: [
            [/sum \/ reviews\.length/, 'averaged the page of reviews'],
            [/total: reviews\.length/, 'counted the page of reviews'],
            [/reviews\.length < 10/, 'judged a career by one page']
        ],
        needs: [/bookings\/provider\/reviews\/stats/]
    },
    {
        file: 'modules/user/pages/ShopDetail.jsx',
        what: 'a provider rating shown to customers',
        banned: [
            [/reviewsList\.reduce\(\(sum, r\) => sum \+ r\.rating/, 'averaged the page of reviews'],
            [/totalReviews = reviewsList\.length/, 'counted the page of reviews']
        ],
        needs: [/reviews\/stats/]
    },
    {
        file: 'modules/user/pages/Wallet.jsx',
        what: 'lifetime earned and spent',
        banned: [
            [/transactions\s*\r?\n?\s*\.filter\(\(t\) => t\.type === "credit"\)/, 'summed the page of transactions'],
            [/Math\.ceil\(transactions\.length \/ itemsPerPage\)/, 'paged by the rows in hand'],
            [/transactions\.slice\(\s*\r?\n?\s*\(currentPage/, 'sliced a page out of a page']
        ],
        needs: [/data\.totalEarned/, /data\.transactionsTotal/]
    },
    {
        file: 'modules/admin/pages/AdminBazaar.jsx',
        what: 'total unlocks and the moderation queue',
        banned: [
            [/>\{data\.transactions\.length\}</, 'counted the page of unlocks'],
            [/\{ads\.length\} ads waiting/, 'counted the page of the moderation queue'],
            // Falling back to the page length hides a broken figure behind a
            // plausible one. A zero is visibly wrong; a page count is not.
            [/data\.totalUnlocks \?\? data\.transactions\.length/, 'falls back to the page count']
        ],
        needs: [/data\.totalUnlocks/, /totalUnlocks: res\.data\.totalUnlocks/, /pendingTotal/]
    },
    {
        file: 'context/SocketContext.jsx',
        what: 'the pending-withdrawals badge',
        banned: [[/res\.data\.filter\(w => w\.status === 'pending'\)\.length/, 'counted the page of withdrawals']],
        needs: [/x-pending-count/]
    },
    {
        file: 'modules/admin/pages/AdminCommission.jsx',
        what: 'the settlement and withdrawal tables',
        banned: [
            [/withdrawals\.filter\(w => w\.status === 'pending'\)/, 'counted the page of withdrawals'],
            [/settlements\.filter\(s => s\.currentDues > 0\)/, 'counted the page of settlements'],
            [/settlements\.reduce\(/, 'summed the page of settlements'],
            [/pendingWithdrawals\.reduce\(/, 'summed the page of withdrawals'],
            [/\{settlements\.length\} Records/, 'counted the page of settlements'],
            [/\{withdrawals\.length\} Total/, 'counted the page of withdrawals']
        ],
        needs: [/settlementsTotals/, /x-pending-count/, /x-total-count/]
    },
    {
        file: 'modules/provider/components/RecentBookingsList.jsx',
        what: "the counts on a worker's status tabs",
        banned: [[/requests\.filter\(r => r\.status === "pending"\)\.length/, 'counted the page of bookings']],
        needs: [/bookings\/provider\/stats/]
    },
    {
        file: 'modules/user/pages/Notifications.jsx',
        what: 'the unread-notifications count',
        banned: [
            [/notifications\.filter\(n => !n\.isRead\)\.length/, 'counted the twenty it was sent'],
            // Calling the right endpoint and reading the wrong field off it
            // gives a badge of zero, which looks like "nothing unread" rather
            // than like a bug.
            [/unread\.count\b/, 'read a field the endpoint does not return']
        ],
        needs: [/notifications\/unread-count/, /unread\.unreadCount/]
    },
    {
        file: 'modules/admin/pages/AdminLeads.jsx',
        what: 'the leads pager',
        banned: [
            [/filteredLeads\.slice\(/, 'sliced a page out of a page'],
            [/Math\.ceil\(filteredLeads\.length/, 'paged by the rows in hand'],
            [/\{filteredLeads\.length\}<\/span> leads/, 'counted the page of leads']
        ],
        needs: [/leadsTotal/, /leadParams\.search = search/, /leadParams\.city = filterCity/]
    },
    {
        file: 'modules/admin/pages/AdminBookings.jsx',
        what: 'the total value beside the pager',
        banned: [[/Total Value: ₹\{filteredBookings\.reduce/, 'summed the page of bookings']],
        needs: [/x-total-value/]
    }
];

console.log('\nFigures on screens that hold one page');
SCREENS.forEach(({ file, what, banned, needs }) => {
    check(`${what} describes the whole set`, () => {
        const src = read(file);
        banned.forEach(([rx, why]) => {
            assert.ok(!rx.test(src), `${file} still ${why}`);
        });
        needs.forEach(rx => {
            assert.ok(rx.test(src), `${file} must read ${rx} from the server`);
        });
    });
});

console.log('\nAnd the server has something to answer with');
const BE = path.join(__dirname, '..');
const beRead = (rel) => fs.readFileSync(path.join(BE, rel.split('/').join(path.sep)), 'utf8');

check('review stats are aggregated, not paged', () => {
    const src = beRead('controllers/bookingController.js');
    assert.ok(/const reviewStats = async/.test(src), 'there must be one definition');
    assert.ok(/Booking\.aggregate\(\[[\s\S]{0,400}rating: \{ \$gt: 0 \}/.test(src),
        'it must count in the database, not in JavaScript');
    ['getProviderReviewStats', 'getPublicReviewStats', 'getProviderBookingStats'].forEach(fn => {
        assert.ok(new RegExp(`\\b${fn}\\b`).test(src), `${fn} must exist`);
    });
});

check('both review-stats endpoints are routed', () => {
    assert.ok(/\/provider\/reviews\/stats/.test(beRead('routes/bookingRoutes.js')),
        "a worker's own stats");
    assert.ok(/\/providers\/:id\/reviews\/stats/.test(beRead('routes/publicRoutes.js')),
        'and the public one, next to the reviews it describes');
});

check('the tab counts come from the same rules the tabs use', () => {
    const src = beRead('controllers/bookingController.js');
    const fn = src.slice(src.indexOf('const getProviderBookingStats'));
    // A booking finished but not yet paid for counts as active on the screen;
    // if the server disagreed the tab would not match its own list.
    assert.ok(/'confirmed', 'on_the_way', 'started'/.test(fn), 'active means the same thing');
    assert.ok(/counts\.active \+= count/.test(fn), 'completed-but-unpaid stays active');
    assert.ok(/eligiblePendingFor\(provider\)/.test(fn),
        'and pending counts the broadcast jobs the list would show');
});

check('the broadcast eligibility rule has one definition', () => {
    const src = beRead('controllers/bookingController.js');
    assert.strictEqual((src.match(/const eligiblePendingFor = async/g) || []).length, 1,
        'two copies would drift apart');
    assert.strictEqual((src.match(/eligiblePendingFor\(provider\)/g) || []).length, 2,
        'the list and the counts must both go through it');
});

check('the wallet totals every transaction, not the page it returns', () => {
    const src = beRead('controllers/walletController.js');
    assert.ok(/Transaction\.aggregate\(/.test(src), 'summed in the database');
    assert.ok(/transactionsTotal: await Transaction\.countDocuments\(query\)/.test(src),
        'and the count comes back too');
});

check('withdrawals can be filtered and counted without being listed', () => {
    const src = beRead('controllers/withdrawalController.js');
    assert.ok(/req\.query\.status/.test(src), 'a status filter');
    assert.ok(/X-Total-Count/.test(src) && /X-Pending-Count/.test(src), 'and both counts');
});

check('every count header a screen reads is exposed to it', () => {
    // A custom response header the browser is not allowed to read is the same
    // as one that was never sent — and the screen silently falls back to
    // describing its own page.
    const cors = beRead('index.js');
    const exposed = (cors.match(/exposedHeaders:\s*\[([^\]]*)\]/) || [])[1] || '';

    // Every controller, not a list of the ones that had headers when this was
    // written — the next one to add a header is the one that would be missed.
    const dir = path.join(BE, 'controllers');
    const sent = new Set();
    fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        (src.match(/res\.set\(\s*'(X-[\w-]+)'/g) || []).forEach(m => {
            sent.add(m.replace(/res\.set\(\s*'/, '').replace(/'$/, ''));
        });
    });

    assert.ok(sent.size > 0, 'the scan must find the headers being set');
    sent.forEach(h => {
        assert.ok(exposed.includes(h), `${h} is sent but not exposed, so no browser can read it`);
    });
});

check('the finance screen asks the server its question', () => {
    const ui = read('modules/admin/pages/AdminFinance.jsx');
    assert.ok(!/ledger\.filter\(item =>/.test(ui), 'the browser cannot search what it was not sent');
    assert.ok(/params\.search = searchTerm/.test(ui) && /params\.status = statusFilter/.test(ui),
        'both must travel with the request');
    assert.ok(/exportRows/.test(ui), 'and the export must cover the match, not the page');

    const src = beRead('controllers/commissionController.js');
    assert.ok(!/const wallets = await Wallet\.find\(\)/.test(src),
        'the escrow total does not need every wallet');
    assert.ok(/ledgerTotal/.test(src), 'the ledger reports how many matched');
    assert.ok(/\.select\('adminCommission createdAt'\)[\s\S]{0,40}\.lean\(\)/.test(src),
        'the chart needs two fields per booking, not whole documents');
});

check('the figures a screen reads are the ones the route sends', () => {
    // Two of these were wrong and neither failed anything: the notifications
    // badge read `count` off a response that sends `unreadCount`, and the
    // unlocks count was added to the wrong function entirely. Both rendered as
    // a plausible number rather than as a break, so this pins field names
    // rather than just the presence of a call.
    const pairs = [
        ['controllers/notificationController.js', /unreadCount: count/, 'modules/user/pages/Notifications.jsx', /unread\.unreadCount/],
        ['controllers/bazaarController.js', /totalUnlocks: totals\?\.count/, 'modules/admin/pages/AdminBazaar.jsx', /res\.data\.totalUnlocks/],
        ['controllers/walletController.js', /totalEarned:/, 'modules/user/pages/Wallet.jsx', /data\.totalEarned/],
        ['controllers/commissionController.js', /settlementsTotals:/, 'modules/admin/pages/AdminCommission.jsx', /data\.settlementsTotals/]
    ];

    pairs.forEach(([server, sends, screen, reads]) => {
        assert.ok(sends.test(beRead(server)), `${server} must send ${sends}`);
        assert.ok(reads.test(read(screen)), `${screen} must read ${reads}`);
    });
});

check('the unlock cards describe every unlock, not the page', () => {
    const src = beRead('controllers/bazaarController.js');
    const fn = src.slice(src.indexOf('exports.getBazaarTransactions'));
    assert.ok(!/transactions\.reduce\(/.test(fn.slice(0, 1200)),
        'total revenue must not be summed over the page');
    assert.ok(/BazaarUnlockTransaction\.aggregate\(/.test(fn.slice(0, 1200)),
        'both figures come from one aggregation');
});

check('the settlement ledger is narrowed by the database', () => {
    const src = beRead('controllers/commissionController.js');
    assert.ok(/Wallet\.aggregate\(/.test(src), 'not every wallet loaded and filtered in JavaScript');
    assert.ok(/\$facet/.test(src), 'one pass for the page and the totals');
    assert.ok(!/const wallets = await Wallet\.find\(/.test(src), 'and nothing left of the old way');
    assert.ok(/settlementsTotals/.test(src), 'the totals row has something to read');
    assert.ok(!/const pendingWithdrawals = await Withdrawal\.find/.test(src),
        'sums do not need the documents');
});

console.log(`\n${passed} paged-figure checks passed.\n`);
