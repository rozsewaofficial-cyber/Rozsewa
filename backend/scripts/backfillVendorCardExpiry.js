/**
 * One-time migration: every Provider registered before vendorCardExpiry
 * existed has it as null, which the 99 Card screen correctly treats as
 * "still active" rather than expired — but it means the Active/Expired split
 * only reflects reality going forward, not for anyone already on the
 * platform. This backfills joinedDate + the current vendorCardValidityDays
 * setting (default 365) for every provider missing it, so existing cards
 * start expiring on schedule too.
 *
 * Safe to re-run: only touches providers where vendorCardExpiry is null.
 *
 *   node scripts/backfillVendorCardExpiry.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const Setting = require('../models/Setting');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const setting = await Setting.findOne({ key: 'vendorCardValidityDays' });
    const days = setting ? parseInt(setting.value, 10) : 365;
    const validDays = Number.isFinite(days) && days > 0 ? days : 365;

    const missing = await Provider.find({ vendorCardExpiry: null }).select('_id joinedDate').lean();
    console.log(`${missing.length} providers missing vendorCardExpiry, backfilling at ${validDays} days from joinedDate...`);

    let updated = 0;
    for (const p of missing) {
        const base = p.joinedDate ? new Date(p.joinedDate) : new Date();
        const expiry = new Date(base.getTime() + validDays * 24 * 60 * 60 * 1000);
        await Provider.updateOne({ _id: p._id }, { $set: { vendorCardExpiry: expiry } });
        updated += 1;
    }

    console.log(`Backfilled ${updated} providers.`);
    process.exit(0);
})();
