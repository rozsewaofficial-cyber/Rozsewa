const mongoose = require('mongoose');

/**
 * Turns a finished Insta job into money, using the same commission engine and
 * the same wallet mechanics as an ordinary booking.
 *
 * Insta Work deliberately does not get its own financial model. Commission
 * rules, free trials, subscription overrides and the partner dues wallet all
 * behave identically here, so finance has one story to tell rather than two.
 */

/**
 * Settles a job that has been paid for.
 *
 *   cash   — the worker already holds the customer's money, so only the
 *            commission they owe RozSewa moves, as a debit against their dues.
 *   online — RozSewa holds the money, so the worker's payout is credited to
 *            their withdrawable balance.
 *
 * Never throws: a settlement problem must not undo a job that genuinely
 * happened. Failures are logged and surfaced in the return value.
 */
const settle = async (job) => {
    const Provider = require('../models/Provider');
    const { Wallet, Transaction } = require('../models/Wallet');
    const CommissionRuleEngine = require('./CommissionRuleEngine');
    const CommissionService = require('./CommissionService');
    const FinancialLedger = require('../models/FinancialLedger');
    const CommissionLog = require('../models/CommissionLog');

    try {
        if (!job.providerId) return { ok: false, reason: 'no provider on job' };
        // Settling twice would pay the worker twice; the stored id is the guard.
        if (job.settlementSnapshot && job.settlementSnapshot.settledAt) {
            return { ok: true, alreadySettled: true };
        }

        const provider = await Provider.findById(job.providerId).populate('vendorType');
        if (!provider) return { ok: false, reason: 'provider not found' };

        const gross = Number(job.finalAmount) || 0;
        if (gross <= 0) return { ok: false, reason: 'nothing to settle' };

        const matchedRule = await CommissionRuleEngine.selectRule(gross, provider, provider.vendorType);
        const calculation = CommissionService.calculate(gross, matchedRule);

        const adminCommission = calculation.platformAmount;
        const providerPayout = calculation.providerAmount;
        const txnId = `INSTA-${new mongoose.Types.ObjectId().toString().toUpperCase()}`;

        let wallet = await Wallet.findOne({ providerId: provider._id });
        if (!wallet) wallet = await Wallet.create({ providerId: provider._id, balance: 0, availableBalance: 0 });

        const prevBalance = wallet.balance;
        const prevAvailable = wallet.availableBalance || 0;

        if (job.paymentMode === 'cash') {
            // The worker was paid in cash on site, so they owe RozSewa the
            // commission. No payout credit — they already have the money.
            wallet.balance -= adminCommission;
            await wallet.save();

            // A free-trial or fully-waived job owes nothing, and a zero-value
            // row in the worker's statement reads as a bug rather than a perk.
            if (adminCommission > 0) {
                await Transaction.create({
                    providerId: provider._id,
                    title: `Insta Work Commission: ${job.serviceName}`,
                    amount: adminCommission,
                    type: 'debit',
                    status: 'completed',
                    description: `Commission on Insta job ${job.jobCode} (cash collected on site)`
                });
            }

            if (adminCommission > 0) await FinancialLedger.create({
                transactionId: txnId,
                booking: null,
                provider: provider._id,
                ledgerType: 'COMMISSION',
                amount: -adminCommission,
                previousBalance: prevBalance,
                newBalance: wallet.balance,
                description: `Insta Work cash commission for job ${job.jobCode}`,
                metadata: { instaJobId: String(job._id), jobCode: job.jobCode, gross, paymentMode: 'cash' }
            });
        } else {
            // RozSewa collected the money, so the worker's share is credited.
            wallet.availableBalance = prevAvailable + providerPayout;
            await wallet.save();

            if (providerPayout > 0) await Transaction.create({
                providerId: provider._id,
                title: `Insta Work Earnings: ${job.serviceName}`,
                amount: providerPayout,
                type: 'credit',
                status: 'completed',
                description: `Payout for Insta job ${job.jobCode}`
            });

            await FinancialLedger.create({
                transactionId: txnId,
                booking: null,
                provider: provider._id,
                ledgerType: 'WALLET_CREDIT',
                amount: providerPayout,
                previousBalance: prevAvailable,
                newBalance: wallet.availableBalance,
                description: `Insta Work payout for job ${job.jobCode}`,
                metadata: { instaJobId: String(job._id), jobCode: job.jobCode, gross, paymentMode: 'online' }
            });
        }

        provider.walletBalance = wallet.balance;
        provider.completedBookingsCount = (provider.completedBookingsCount || 0) + 1;

        // A free-trial job must consume a trial slot. Taking the 0% rate
        // without spending the allowance would let a worker run on free
        // commission indefinitely — the trial would never end.
        if (calculation.source === 'FREE_TRIAL') {
            if (!provider.freeTrial) provider.freeTrial = { usedServices: 0 };
            provider.freeTrial.usedServices = (provider.freeTrial.usedServices || 0) + 1;
            const PartnerProgram = require('../models/PartnerProgram');
            const program = await PartnerProgram.findOne();
            const totalTrial = program ? program.freeServiceCount : 3;
            if (provider.freeTrial.usedServices >= (totalTrial + (provider.freeTrial.extraFreeServices || 0))) {
                provider.freeTrial.trialCompletedAt = Date.now();
            }
        }
        if (calculation.source === 'WAIVER') {
            if (!provider.commissionWaiver) provider.commissionWaiver = { bookingsWaivedCount: 0 };
            provider.commissionWaiver.bookingsWaivedCount = (provider.commissionWaiver.bookingsWaivedCount || 0) + 1;
        }

        await provider.save();

        await CommissionLog.create({
            booking: null,
            provider: provider._id,
            appliedRule: calculation.ruleApplied,
            appliedPercentage: calculation.commissionRate,
            platformEarnings: calculation.platformAmount,
            providerEarnings: calculation.providerAmount,
            triggerEvent: 'INSTA_JOB_COMPLETED'
        }).catch(err => console.log('[InstaWork] Commission log failed:', err.message));

        job.adminCommission = adminCommission;
        job.providerPayout = providerPayout;
        job.commissionStatus = String(calculation.source || '').toLowerCase();
        job.settlementSnapshot = {
            transactionId: txnId,
            gross,
            commissionRate: calculation.commissionRate,
            commissionAmount: calculation.commissionAmount,
            providerEarnings: calculation.providerAmount,
            platformEarnings: calculation.platformAmount,
            commissionSource: calculation.source,
            ruleApplied: calculation.ruleApplied,
            paymentMode: job.paymentMode,
            settledAt: new Date()
        };

        return { ok: true, adminCommission, providerPayout };
    } catch (err) {
        console.error('[InstaWork] Settlement failed:', err.message);
        return { ok: false, reason: err.message };
    }
};

module.exports = { settle };
