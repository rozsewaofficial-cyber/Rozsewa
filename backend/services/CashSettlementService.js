const PaymentAudit = require('../models/PaymentAudit');

/**
 * The single place a cash-on-delivery booking is marked as collected.
 *
 * This deliberately moves NO money, and that is the whole point of it existing.
 *
 * For a `paymentMode: 'after'` booking the partner is handed the customer's
 * cash directly, and the financial settlement — commission owed to RozSewa,
 * less any coin discount RozSewa funded — was already applied against their
 * dues wallet at completion time in verifyEndOTP. Crediting availableBalance
 * again at collection time would pay the partner a second time for one job.
 *
 * Three separate copies of this logic used to exist and had drifted apart:
 * the provider status route credited nothing (correct), while the dedicated
 * collect-payment endpoint and the admin COD settlement each credited the full
 * payout (a double payment the partner could trigger simply by choosing the
 * other button). Routing all three through here is what stops them diverging
 * again.
 */

/** Collection routes, and the audit action each one records. */
const COLLECTORS = {
    partner_cash: { collectionStatus: 'cash_collected', action: 'cash_collected' },
    staff_verified: { collectionStatus: 'staff_verified', action: 'staff_verified' },
    admin: { collectionStatus: 'staff_verified', action: 'admin_status_update' }
};

/**
 * Shared precondition check. Returns null when collection may proceed, or
 * `{ status, message }` describing why it may not.
 */
const checkCollectable = (booking) => {
    if (!booking) {
        return { status: 404, message: 'Booking not found.' };
    }
    if (booking.paymentMode !== 'after') {
        return { status: 400, message: 'Only cash on delivery bookings are settled this way.' };
    }
    if (booking.status !== 'completed') {
        return { status: 400, message: 'Payment can only be collected after the service is completed.' };
    }
    // Either flag being set means someone already recorded this collection.
    if (booking.paymentStatus === 'paid' || booking.collectionStatus !== 'not_collected') {
        return { status: 400, message: 'Payment has already been collected for this booking.' };
    }
    return null;
};

/**
 * Records the collection on the booking and writes the immutable audit row.
 * The caller is responsible for authorisation; this owns the state change.
 *
 * `booking` is mutated but NOT saved — callers save it themselves so this can
 * be composed into a larger update without a redundant write.
 */
const recordCollection = async (booking, {
    collectedBy,
    actorId = null,
    actorRole = null,
    ipAddress = null,
    deviceInfo = null,
    note = null
}) => {
    const route = COLLECTORS[collectedBy];
    if (!route) throw new Error(`Unknown cash collection route: ${collectedBy}`);

    const previousPaymentStatus = booking.paymentStatus;
    const previousCollectionStatus = booking.collectionStatus;

    // Audit first, so a crash mid-way leaves evidence rather than a silent gap.
    await PaymentAudit.create({
        bookingId: booking._id,
        providerId: collectedBy === 'partner_cash' ? actorId : null,
        staffId: collectedBy === 'staff_verified' ? actorId : null,
        adminId: collectedBy === 'admin' ? actorId : null,
        action: route.action,
        amount: booking.totalAmount,
        paymentMethod: 'cash',
        previousPaymentStatus,
        newPaymentStatus: 'paid',
        previousCollectionStatus,
        newCollectionStatus: route.collectionStatus,
        ipAddress,
        deviceInfo,
        note: note || `Cash collection recorded by ${actorRole || collectedBy}.`
    });

    booking.paymentStatus = 'paid';
    booking.collectionStatus = route.collectionStatus;
    booking.paymentCollectedBy = collectedBy === 'admin' ? 'admin' : collectedBy;
    booking.paymentCollectedAt = new Date();

    // No wallet write. See the note at the top of this file — the money for a
    // cash booking was settled at completion, and the partner is holding it.
    if (booking.providerPayout > 0) {
        console.log(`[Cash Settlement] Booking ${booking._id}: partner holds ₹${booking.totalAmount} in cash; payout of ₹${booking.providerPayout} was settled at completion. No wallet credit issued.`);
    }

    return booking;
};

module.exports = { checkCollectable, recordCollection, COLLECTORS };
