/**
 * Dashboard income (Today / This Week / This Month) is what the partner
 * earned: payout after commission plus tips, on the day the job was
 * completed, in India time.
 *
 * It added up the customers' whole bills (commission included) by the day
 * each booking was made, with "today" starting at the server's midnight
 * (5:30 AM IST on a UTC server) — so it showed more than the partner earned.
 *
 *   node scripts/partnerIncomeStatsCheck.js
 *
 * Runs the real controller with the models stubbed; no database.
 */
const assert = require('assert');
require('mongoose').set('bufferCommands', false);
const Booking = require('../models/Booking');
const Tip = require('../models/Tip');
const Insta = require('../services/InstaEarningsAdapter');
const { getProviderStats } = require('../controllers/providerController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

const OFF = 5.5 * 60 * 60 * 1000;
const ist = new Date(Date.now() + OFF);
const todayIST = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - OFF);
const minutes = (n) => new Date(todayIST.getTime() + n * 60000);
const DAY = 24 * 60 * 60 * 1000;

let bookings = [], tips = [], insta = [];
Booking.find = () => ({ select: () => ({ limit: () => ({ lean: async () => bookings }) }) });
Booking.countDocuments = async () => bookings.length;
Tip.find = () => ({ select: () => ({ limit: () => ({ lean: async () => tips }) }) });
Insta.getProviderJobs = async () => insta;
Insta.countProviderJobs = async () => insta.length;

const stats = () => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve(b); } };
    getProviderStats({ user: { _id: 'p1' } }, res);
});

(async () => {
    await check('a ₹1000 job at 23% commission is ₹770 of income, not ₹1000', async () => {
        bookings = [{ totalAmount: 1000, adminCommission: 230, providerPayout: 770, completedAt: minutes(60), createdAt: minutes(30) }];
        tips = []; insta = [];
        const s = await stats();
        assert.strictEqual(s.today, 770);
    });

    await check('counted on the day it was completed, not the day it was booked', async () => {
        bookings = [{ totalAmount: 500, providerPayout: 400, completedAt: minutes(120), createdAt: new Date(todayIST.getTime() - 3 * DAY) }];
        const s = await stats();
        assert.strictEqual(s.today, 400);
    });

    await check('"today" starts at midnight India time (a job at 00:30 IST is today)', async () => {
        bookings = [{ totalAmount: 300, providerPayout: 300, completedAt: minutes(30), createdAt: minutes(10) }];
        assert.strictEqual((await stats()).today, 300);
        bookings = [{ totalAmount: 300, providerPayout: 300, completedAt: new Date(todayIST.getTime() - 60000), createdAt: new Date(todayIST.getTime() - 60000) }];
        assert.strictEqual((await stats()).today, 0, '23:59 IST yesterday is not today');
    });

    await check('tips (online and cash) and Insta Work payouts are income; old jobs fall back to bill minus commission', async () => {
        bookings = [{ totalAmount: 600, adminCommission: 100, providerPayout: 0, completedAt: minutes(200) }];
        tips = [{ amount: 50, createdAt: minutes(210) }, { amount: 20, createdAt: minutes(220) }];
        insta = [{ totalAmount: 400, adminCommission: 40, providerPayout: 360, createdAt: minutes(230) }];
        const s = await stats();
        assert.strictEqual(s.today, 500 + 70 + 360);
        assert.ok(s.week >= s.today && s.month >= s.today);
        assert.strictEqual(s.chartData[6].amount, s.today, "today's bar is today's income");
    });

    console.log(`\n${passed} income stats checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
