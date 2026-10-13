/**
 * One-time fix: 24/7 is a partner setting and a Sewak no longer has a 24/7
 * option (no switch in the app, and the server refuses it). A Sewak who turned
 * it on before would stay "open at all hours" with no way to turn it off, so
 * this switches it off (both fields) for every Sewak that has it.
 *
 * Safe to re-run: only touches Sewaks that still have it on.
 *
 *   node scripts/clearSewak24x7.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('../models/Provider');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const filter = { providerCategory: 'sewak', $or: [{ is24x7: true }, { isEmergencyEnabled: true }] };
    const count = await Provider.countDocuments(filter);
    console.log(`${count} Sewaks have 24/7 on, switching it off...`);

    const { modifiedCount } = await Provider.updateMany(filter, { $set: { is24x7: false, isEmergencyEnabled: false } });

    console.log(`Switched off 24/7 for ${modifiedCount} Sewaks.`);
    process.exit(0);
})();
