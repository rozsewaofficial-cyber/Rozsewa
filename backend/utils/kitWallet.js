const crypto = require('crypto');
const { Wallet, Transaction } = require('../models/Wallet');
const Provider = require('../models/Provider');
const FinancialLedger = require('../models/FinancialLedger');
const Setting = require('../models/Setting');

/**
 * The account-lockout threshold a Sewak must not be pushed past by an EMI
 * deduction. This is the SAME config the existing debt system uses
 * (cash_limits_config) — reused deliberately so the two can't disagree.
 *
 * Returns a positive number, e.g. 1500 meaning "lock out at -1500".
 */
const getDebtLimitFor = async (provider) => {
    const configSetting = await Setting.findOne({ key: 'cash_limits_config' });
    let limit = 1500;
    if (configSetting && configSetting.value) {
        const cfg = configSetting.value;
        limit = Number(cfg.defaultLimit) || 1500;
        if (provider?.vendorType) {
            const catId = provider.vendorType.toString();
            const catLimitObj = cfg.categoryLimits?.find(c => c.categoryId === catId);
            if (catLimitObj) limit = Number(catLimitObj.limit);
        }
    }
    return limit;
};

const newTxnId = (prefix) =>
    `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

/**
 * Apply a wallet movement for a kit purchase/instalment.
 *
 * Always writes Wallet (authoritative) and then syncs Provider.walletBalance
 * (the denormalized mirror other code reads). Writing only the mirror would mean
 * the deduction never really happens and no WALLET_UPDATED socket event fires.
 *
 * @param {'debit'|'credit'} direction
 */
const applyKitWalletMovement = async ({
    providerId,
    amount,
    direction,
    ledgerType,
    title,
    description,
    metadata = {},
    session = null
}) => {
    const q = Wallet.findOne({ providerId });
    if (session) q.session(session);
    let wallet = await q;

    if (!wallet) {
        const created = await Wallet.create([{ providerId, balance: 0, availableBalance: 0 }], { session: session || undefined });
        wallet = created[0];
    }

    const previousBalance = wallet.balance;
    const delta = direction === 'debit' ? -Math.abs(amount) : Math.abs(amount);

    wallet.balance += delta;
    wallet.availableBalance = (wallet.availableBalance || 0) + delta;
    wallet.updatedAt = new Date();
    await wallet.save({ session: session || undefined });

    await Provider.findByIdAndUpdate(
        providerId,
        { walletBalance: wallet.balance },
        { session: session || undefined }
    );

    await Transaction.create([{
        providerId,
        title,
        amount: Math.abs(amount),
        type: direction,
        status: 'completed',
        description
    }], { session: session || undefined });

    await FinancialLedger.create([{
        transactionId: newTxnId(ledgerType),
        provider: providerId,
        ledgerType,
        amount: Math.abs(amount),
        previousBalance,
        newBalance: wallet.balance,
        description,
        metadata
    }], { session: session || undefined });

    return { previousBalance, newBalance: wallet.balance, wallet };
};

/** Advance a due date by its frequency. */
const advanceDueDate = (from, frequency, cfg = {}) => {
    const d = new Date(from);
    if (frequency === 'daily') {
        d.setDate(d.getDate() + 1);
    } else if (frequency === 'weekly') {
        d.setDate(d.getDate() + 7);
    } else {
        // monthly — date is capped at 28 by the schema so this never skips a month
        d.setMonth(d.getMonth() + 1);
        if (cfg.monthlyDeductionDate) d.setDate(Math.min(cfg.monthlyDeductionDate, 28));
    }
    d.setHours(2, 0, 0, 0);
    return d;
};

/** First deduction date after an order is confirmed. */
const firstDueDate = (frequency, cfg = {}) => {
    const d = new Date();
    d.setHours(2, 0, 0, 0);

    if (frequency === 'daily') {
        d.setDate(d.getDate() + 1);
        return d;
    }

    if (frequency === 'weekly') {
        const target = Number.isInteger(cfg.weeklyDeductionDay) ? cfg.weeklyDeductionDay : 1;
        let diff = (target - d.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        d.setDate(d.getDate() + diff);
        return d;
    }

    const targetDate = Math.min(cfg.monthlyDeductionDate || 1, 28);
    d.setMonth(d.getMonth() + 1);
    d.setDate(targetDate);
    return d;
};

module.exports = {
    applyKitWalletMovement,
    advanceDueDate,
    firstDueDate,
    getDebtLimitFor
};
