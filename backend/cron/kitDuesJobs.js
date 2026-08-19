const cron = require('node-cron');
const mongoose = require('mongoose');
const KitDue = require('../models/KitDue');
const Provider = require('../models/Provider');
const { Wallet } = require('../models/Wallet');
const { applyKitWalletMovement, advanceDueDate, getDebtLimitFor } = require('../utils/kitWallet');

const notify = async (sewakId, title, message, dueId) => {
    try {
        const { notifyUser } = require('../config/notificationService');
        await notifyUser({
            userId: sewakId,
            userRole: 'provider',
            title,
            message,
            type: 'kit_order',
            data: { id: dueId.toString(), dueId: dueId.toString() }
        });
    } catch (err) {
        console.error('[KitDuesCron] notification failed:', err.message);
    }
};

/**
 * Recover kit instalments from Sewak wallets.
 *
 * One job covers daily/weekly/monthly because `nextDeductionDate` already
 * encodes the schedule — the cron just asks "what is due now".
 */
const runKitDueDeductions = async () => {
    try {
        const now = new Date();
        const dues = await KitDue.find({
            status: 'active',
            nextDeductionDate: { $lte: now }
        }).limit(500);

        if (!dues.length) return;
        console.log(`[KitDuesCron] processing ${dues.length} due instalment(s)`);

        for (const due of dues) {
            const provider = await Provider.findById(due.sewakId).select('vendorType ownerName').lean();
            if (!provider) continue;

            const amount = Math.min(due.instalmentAmount, due.balance);
            if (amount <= 0) {
                due.status = 'cleared';
                due.clearedAt = new Date();
                await due.save();
                continue;
            }

            const wallet = await Wallet.findOne({ providerId: due.sewakId });
            const currentBalance = wallet?.balance ?? 0;

            // Q4 deadlock guard: the existing cash_limits_config debt system locks a
            // Sewak out of the entire app at `balance <= -limit`. If an instalment
            // would push them past that, they could no longer work — and therefore
            // never earn the money to clear this very debt. So we skip, record the
            // miss, and retry next cycle rather than bricking the account.
            const debtLimit = await getDebtLimitFor(provider);
            if (currentBalance - amount <= -debtLimit) {
                due.missedCount += 1;
                due.lastAttemptAt = now;
                due.nextDeductionDate = advanceDueDate(due.nextDeductionDate, due.frequency);
                await due.save();

                console.log(`[KitDuesCron] skipped ${due._id} — would breach debt limit (-${debtLimit})`);

                if (due.missedCount === 1 || due.missedCount % 5 === 0) {
                    await notify(
                        due.sewakId,
                        'Kit Instalment Pending',
                        `We could not collect your ₹${amount} kit instalment because your wallet balance is too low. It will be retried next cycle.`,
                        due._id
                    );
                }
                continue;
            }

            // Wallet write + due write must land together, or a crash between them
            // double-charges on the next run.
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    await applyKitWalletMovement({
                        providerId: due.sewakId,
                        amount,
                        direction: 'debit',
                        ledgerType: 'KIT_EMI_DEDUCTION',
                        title: 'Starter kit instalment',
                        description: `Instalment of ₹${amount} towards kit order ${due.orderId}`,
                        metadata: { dueId: due._id.toString(), orderId: due.orderId?.toString() },
                        session
                    });

                    due.paidSoFar += amount;
                    due.balance -= amount;
                    due.lastAttemptAt = now;

                    if (due.balance <= 0) {
                        due.balance = 0;
                        due.status = 'cleared';
                        due.clearedAt = new Date();
                    } else {
                        due.nextDeductionDate = advanceDueDate(due.nextDeductionDate, due.frequency);
                    }

                    await due.save({ session });
                });

                if (due.status === 'cleared') {
                    await notify(
                        due.sewakId,
                        'Kit Dues Cleared',
                        'Your starter kit instalments are fully paid. Thank you!',
                        due._id
                    );
                } else {
                    await notify(
                        due.sewakId,
                        'Kit Instalment Deducted',
                        `₹${amount} was deducted towards your starter kit. Remaining balance: ₹${due.balance}.`,
                        due._id
                    );
                }
            } catch (err) {
                console.error(`[KitDuesCron] deduction failed for due ${due._id}:`, err.message);
            } finally {
                session.endSession();
            }
        }
    } catch (error) {
        console.error('[KitDuesCron] job failed:', error);
    }
};

const startKitDuesCron = () => {
    // Daily at 01:00 — nextDeductionDate carries the actual per-due schedule.
    cron.schedule('0 1 * * *', runKitDueDeductions);
    console.log('Kit dues cron scheduled (daily at 01:00).');
};

module.exports = { startKitDuesCron, runKitDueDeductions };
