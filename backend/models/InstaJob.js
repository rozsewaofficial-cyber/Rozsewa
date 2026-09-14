const mongoose = require('mongoose');

/**
 * A single Insta Work job.
 *
 * Deliberately its own model rather than an extension of `Booking`. The spec's
 * lifecycle has eleven states against Booking's six, and every provider tab,
 * admin filter and analytics query in this codebase switches on
 * `Booking.status` — widening that enum would silently change what appears in
 * screens that have nothing to do with Insta Work.
 *
 * Money still settles through the same commission engine as a booking, so
 * there is one financial model in the platform, not two.
 */

/** The lifecycle from the spec, in order. */
const JOB_STATUSES = [
    'REQUESTED',          // customer submitted, nothing assigned yet
    'MATCHING',           // searching for a Sewak (managed supply only)
    'ASSIGNED',           // a Sewak was auto-assigned
    'PARTNER_SELECTED',   // the customer picked a Partner
    'ACCEPTED',           // the worker accepted
    'ON_THE_WAY',
    'ARRIVED',
    'WORK_STARTED',
    'WORK_COMPLETED',
    'CUSTOMER_CONFIRMED',
    'PAYMENT_COMPLETED',
    'CLOSED',
    'CANCELLED'
];

/** States in which no worker has committed yet. */
const PRE_ACCEPTANCE = ['REQUESTED', 'MATCHING', 'ASSIGNED', 'PARTNER_SELECTED'];

/**
 * States in which a job occupies one of a worker's concurrent slots.
 *
 * Named once because matching, the capacity check and any future reporting
 * must agree on what "currently working" means.
 */
const OCCUPIES_WORKER = ['ASSIGNED', 'PARTNER_SELECTED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'WORK_STARTED'];

const instaJobSchema = new mongoose.Schema({
    jobCode: { type: String, unique: true, index: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', default: null },

    /**
     * Which supply model this job runs on. It decides whether the worker was
     * auto-assigned or hand-picked, and whether the rate was fixed or chosen.
     */
    supplyModel: { type: String, enum: ['sewak', 'partner'], required: true },

    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'InstaService', required: true },
    // Snapshotted so a job stays readable after the service is renamed or removed.
    serviceName: { type: String, required: true },
    pricingType: { type: String, required: true },
    unitLabel: { type: String, default: '' },

    /* ------------------------------ pricing ------------------------------ */

    // The rate agreed for this job: admin-fixed for a Sewak, the Partner's own
    // (guardrailed) rate otherwise. Frozen here so a later rate change never
    // rewrites a job already in flight.
    rate: { type: Number, required: true, min: 0 },
    baseCharge: { type: Number, default: 0 },
    baseChargeEnabled: { type: Boolean, default: false },

    // What the customer asked for, in the pricing type's own unit.
    bookedQuantity: { type: Number, required: true, min: 0 },
    // What was actually delivered — from the timer for hourly work, or recorded
    // on site for measured work.
    actualQuantity: { type: Number, default: null },

    estimateAmount: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },
    // Per-line working, so the customer's bill can show how it was reached.
    billBreakdown: { type: Array, default: [] },

    /* ------------------------------- timer ------------------------------- */

    // Only hourly work runs a timer; measured work has no clock.
    isTimed: { type: Boolean, default: false },
    workStartedAt: { type: Date, default: null },
    workCompletedAt: { type: Date, default: null },
    workedMinutes: { type: Number, default: 0 },
    billedMinutes: { type: Number, default: 0 },
    billingIntervalMinutes: { type: Number, default: 30 },

    /**
     * Duration extension requests. Raised by the worker once the job runs past
     * the booked time plus the admin threshold, and only the customer's
     * approval lets the clock keep running — otherwise a job can silently eat
     * the worker's next appointment.
     */
    extensions: [{
        requestedMinutes: { type: Number, required: true },
        requestedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' },
        respondedAt: { type: Date, default: null },
        note: { type: String, default: '' }
    }],
    approvedExtraMinutes: { type: Number, default: 0 },
    // The ceiling on billable time: booked + approved extensions + the admin's
    // overrun tolerance. Stored so a disputed bill can be reconstructed.
    authorisedMinutes: { type: Number, default: 0 },
    // Time the worker spent beyond what the customer authorised. Recorded
    // rather than silently dropped so the worker can query it.
    unbilledOverrunMinutes: { type: Number, default: 0 },

    /* ---------------------------- waiting time ---------------------------- */

    arrivedAt: { type: Date, default: null },
    // Minutes past the grace period that the worker waited before being told to
    // start. Charged at the admin's per-minute rate.
    idleMinutes: { type: Number, default: 0 },
    idleChargePerMinute: { type: Number, default: 0 },
    idleAmount: { type: Number, default: 0 },

    /* ------------------------------ location ------------------------------ */

    address: { type: String, required: true },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    city: { type: String, default: '' },
    // Straight-line distance and rough ETA captured when the worker was matched.
    matchedDistanceKm: { type: Number, default: null },
    matchedEtaMinutes: { type: Number, default: null },

    /* ------------------------------ lifecycle ----------------------------- */

    status: { type: String, enum: JOB_STATUSES, default: 'REQUESTED', index: true },
    // Every transition, so a disputed job can be reconstructed exactly.
    statusHistory: [{
        status: { type: String },
        at: { type: Date, default: Date.now },
        by: { type: String, default: 'system' },
        note: { type: String, default: '' }
    }],

    startOTP: { type: String, default: null },
    // Workers this job was offered to and who declined, so it isn't re-offered.
    rejectedProviders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }],

    extraCharges: [{
        item: { type: String },
        amount: { type: Number }
    }],

    /* ----------------------------- cancellation ---------------------------- */

    cancelledBy: { type: String, enum: ['customer', 'provider', 'admin', 'system', null], default: null },
    cancellationReason: { type: String, default: '' },
    // Charged according to how far the job had progressed when it was killed.
    cancellationFee: { type: Number, default: 0 },
    cancellationStage: { type: String, default: null },
    /**
     * Whether that fee has been recovered yet.
     *
     * Insta Work is post-paid, so there is no payment method to charge at the
     * moment of cancellation. The fee waits here and is added to the next job
     * this customer completes. 'none' means there was nothing to collect.
     */
    cancellationFeeStatus: {
        type: String,
        enum: ['none', 'pending', 'collected', 'waived'],
        default: 'none'
    },
    // The later job whose bill carried this fee.
    cancellationFeeCollectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'InstaJob', default: null },

    // Fees from this customer's earlier cancellations that THIS job's bill
    // collected. Kept per-fee so the customer's bill can name what they are
    // paying for, and so they can be released if this job is itself cancelled.
    recoveredFees: [{
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'InstaJob' },
        jobCode: { type: String },
        amount: { type: Number }
    }],
    recoveredFeeTotal: { type: Number, default: 0 },

    /* ------------------------------- payment ------------------------------- */

    // Insta Work is post-paid: an hourly bill cannot be known until the timer
    // stops, which is why the spec puts PAYMENT_COMPLETED after WORK_COMPLETED.
    paymentMode: { type: String, enum: ['cash', 'online'], default: 'cash' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    paidAt: { type: Date, default: null },
    // The gateway order raised for THIS job, for exactly this job's final
    // amount. Verification requires the paid order to match it, so a payment
    // for a different (cheaper) order cannot be presented against this one.
    razorpayOrderId: { type: String, default: null },
    // Deliberately no default: a `sparse` unique index still indexes an
    // explicit null, so defaulting this to null made every unpaid job collide
    // with every other unpaid job. The field is simply absent until a payment
    // is captured, and uniqueness is enforced by the partial index below.
    razorpayPaymentId: { type: String },

    /* ------------------------------ settlement ----------------------------- */

    adminCommission: { type: Number, default: 0 },
    providerPayout: { type: Number, default: 0 },
    commissionStatus: { type: String, default: 'free' },
    settlementSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },

    rating: { type: Number, default: 0 },
    review: { type: String, default: '' }
}, { timestamps: true });

instaJobSchema.index({ customerId: 1, createdAt: -1 });
instaJobSchema.index({ providerId: 1, status: 1, createdAt: -1 });
instaJobSchema.index({ status: 1, createdAt: -1 });
// Finding what a customer still owes, on every bill they are shown.
instaJobSchema.index({ customerId: 1, cancellationFeeStatus: 1 });
instaJobSchema.index({ location: '2dsphere' });

/**
 * A captured payment may settle exactly one job. Partial rather than sparse,
 * so only jobs that actually carry a payment id are constrained — this is what
 * stops a captured payment being replayed against a second job.
 */
instaJobSchema.index(
    { razorpayPaymentId: 1 },
    { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);

/** True while no worker has committed to the job yet. */
instaJobSchema.methods.isPreAcceptance = function () {
    return PRE_ACCEPTANCE.includes(this.status);
};

/**
 * Which cancellation-fee band this job currently falls into. Named rather than
 * derived ad hoc at each call site so the customer, the provider and the admin
 * all read the same stage.
 */
instaJobSchema.methods.cancellationStageNow = function () {
    // Listed explicitly rather than by fallthrough. WORK_COMPLETED and
    // CUSTOMER_CONFIRMED used to land in the default, which is the FREE band —
    // so a customer could let the worker finish the entire job and then cancel
    // out of paying for it. A new status must not be able to inherit that by
    // accident, so anything at or past completion bills the highest band.
    if (['WORK_STARTED', 'WORK_COMPLETED', 'CUSTOMER_CONFIRMED'].includes(this.status)) return 'workStarted';
    if (this.status === 'ARRIVED') return 'afterArrival';
    if (['ACCEPTED', 'ON_THE_WAY'].includes(this.status)) return 'afterAcceptance';
    if (PRE_ACCEPTANCE.includes(this.status)) return 'beforeAcceptance';
    return 'workStarted';
};

/** Appends to the audit trail. Callers still save the document. */
instaJobSchema.methods.pushStatus = function (status, by = 'system', note = '') {
    this.status = status;
    this.statusHistory.push({ status, at: new Date(), by, note });
};

module.exports = mongoose.model('InstaJob', instaJobSchema);
module.exports.JOB_STATUSES = JOB_STATUSES;
module.exports.PRE_ACCEPTANCE = PRE_ACCEPTANCE;
module.exports.OCCUPIES_WORKER = OCCUPIES_WORKER;
