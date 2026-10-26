const { Wallet } = require('../models/Wallet');
const Setting = require('../models/Setting');

/**
 * Has this partner reached the cash limit (their unpaid dues to the admin)?
 *
 * Same rule the dispatch loop and Accept already use, in one place: the limit
 * is the service's own if the admin set one, else the partner's category's,
 * else the global default, and the partner is over it once the wallet is at or
 * below minus that amount.
 */
const cashLimitStatus = async (provider, serviceId) => {
    const [wallet, configSetting] = await Promise.all([
        Wallet.findOne({ providerId: provider._id }).select('balance').lean(),
        Setting.findOne({ key: 'cash_limits_config' }).lean()
    ]);
    const cfg = configSetting?.value || {};
    let limit = Number(cfg.defaultLimit) || 1500;
    if (provider.vendorType) {
        const cat = cfg.categoryLimits?.find(c => c.categoryId === provider.vendorType.toString());
        if (cat) limit = Number(cat.limit);
    }
    if (serviceId) {
        const srv = cfg.serviceLimits?.find(s => s.serviceId === String(serviceId));
        if (srv) limit = Number(srv.limit);
    }
    const balance = wallet?.balance || 0;
    return { over: balance <= -limit, balance, limit };
};

module.exports = { cashLimitStatus };
