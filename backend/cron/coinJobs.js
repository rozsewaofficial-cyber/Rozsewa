const cron = require('node-cron');
const CoinRewardService = require('../services/CoinRewardService');

/**
 * Coin housekeeping.
 *
 * Unlike the older cron modules in this folder, nothing is scheduled at import
 * time — the schedules are created only when startCoinCron() is called, so a
 * module require (a script, a test) never silently starts moving balances.
 */
let started = false;

const startCoinCron = () => {
    if (started) return;
    started = true;

    // Daily expiry sweep at 00:30, just after midnight so a coin's last day is
    // a whole day.
    cron.schedule('30 0 * * *', async () => {
        try {
            console.log('[Coins] Running daily expiry sweep...');
            await CoinRewardService.expireDueLots();
        } catch (err) {
            console.error('[Coins] Expiry sweep failed:', err.message);
        }
    });

    // Abandoned checkouts every 10 minutes. Holds have a 30-minute TTL, so this
    // returns a stranded balance well inside the hour.
    cron.schedule('*/10 * * * *', async () => {
        try {
            await CoinRewardService.releaseStaleHolds();
        } catch (err) {
            console.error('[Coins] Stale hold release failed:', err.message);
        }
    });

    console.log('RozSewa Coins cron jobs initialized.');
};

module.exports = { startCoinCron };
