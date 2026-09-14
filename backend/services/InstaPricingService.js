/**
 * All money arithmetic for the Insta Work module.
 *
 * Deliberately pure: no database reads, no side effects. Everything it needs is
 * passed in, so the same function computes the estimate the customer is quoted
 * at booking time and the final bill produced when the timer stops. Quote and
 * bill drifting apart is the classic failure in a metered-billing system, and
 * one shared function is what prevents it.
 */

/** The five pricing models from the spec. */
const PRICING_TYPES = ['per_hour', 'per_km', 'per_meter', 'per_unit', 'custom'];

/** What the customer is asked for, per pricing type. */
const UNIT_LABELS = {
    per_hour: 'Hour',
    per_km: 'KM',
    per_meter: 'Meter',
    per_unit: 'Unit',
    custom: 'Job'
};

/** Only hourly work runs a timer; the rest are measured, not clocked. */
const isTimed = (pricingType) => pricingType === 'per_hour';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Rounds worked minutes UP to the next billing block.
 *
 * The spec's example: booked 2 hrs at Rs 150/hr, actual 2 hrs 10 mins, billed
 * in 30-minute blocks, becomes 2.5 hrs = Rs 375. Rounding up is intentional and
 * always in the provider's favour — a worker who stays ten extra minutes is
 * paid for the block they entered.
 */
const roundUpToBlock = (minutes, blockMinutes) => {
    const mins = Math.max(0, Number(minutes) || 0);
    const block = Number(blockMinutes) > 0 ? Number(blockMinutes) : 30;
    if (mins === 0) return 0;
    return Math.ceil(mins / block) * block;
};

/** Billable minutes expressed in the unit the rate is quoted in (hours). */
const minutesToBillableHours = (minutes, blockMinutes) =>
    roundUpToBlock(minutes, blockMinutes) / 60;

/**
 * The single billing calculation, used for both the estimate and the final bill.
 *
 * `quantity` is in the pricing type's own unit — hours, kilometres, metres or
 * units. For a `custom` job it is always 1 and the rate carries the whole price.
 *
 * Returns every component separately so the customer's bill can show its
 * working rather than a single unexplained number.
 */
const calculate = ({
    pricingType,
    rate,
    quantity,
    baseCharge = 0,
    baseChargeEnabled = false,
    idleMinutes = 0,
    idleChargePerMinute = 0,
    extraCharges = []
}) => {
    if (!PRICING_TYPES.includes(pricingType)) {
        throw new Error(`Unknown pricing type: ${pricingType}`);
    }

    const unitRate = Math.max(0, Number(rate) || 0);
    // A custom job is a single priced piece of work; its quantity is always 1.
    const qty = pricingType === 'custom' ? 1 : Math.max(0, Number(quantity) || 0);

    const variableAmount = round2(unitRate * qty);
    // The base charge is a flat call-out fee that applies on top of the metered
    // amount, e.g. Delivery = Rs 30 base + Rs 15/km. Admin toggles it per service.
    const baseAmount = baseChargeEnabled ? round2(Math.max(0, Number(baseCharge) || 0)) : 0;

    // Idle waiting is only ever charged after the grace period, and the caller
    // is responsible for having already subtracted the grace minutes.
    const idleAmount = round2(Math.max(0, Number(idleMinutes) || 0) * Math.max(0, Number(idleChargePerMinute) || 0));

    const extrasAmount = round2(
        (extraCharges || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    );

    const subtotal = round2(baseAmount + variableAmount + idleAmount + extrasAmount);

    return {
        pricingType,
        unitLabel: UNIT_LABELS[pricingType],
        rate: unitRate,
        quantity: qty,
        baseAmount,
        variableAmount,
        idleAmount,
        extrasAmount,
        subtotal,
        // Human-readable working, shown on the bill so the figure is explainable.
        breakdown: [
            ...(baseAmount > 0 ? [{ label: 'Base charge', amount: baseAmount }] : []),
            {
                label: pricingType === 'custom'
                    ? 'Job charge'
                    : `${qty} ${UNIT_LABELS[pricingType]}${qty === 1 ? '' : 's'} × ₹${unitRate}`,
                amount: variableAmount
            },
            ...(idleAmount > 0 ? [{ label: `Waiting charge (${idleMinutes} min)`, amount: idleAmount }] : []),
            ...(extraCharges || []).map(e => ({ label: e.item || 'Extra charge', amount: Number(e.amount) || 0 }))
        ]
    };
};

/**
 * The estimate shown before the job starts.
 *
 * For hourly work this is the customer's requested duration at the agreed rate.
 * It is explicitly an estimate: the final bill is driven by the timer, which is
 * why the return carries `isEstimate`.
 */
const estimate = ({ service, rate, quantity, idleChargePerMinute = 0 }) => {
    const result = calculate({
        pricingType: service.pricingType,
        rate,
        quantity,
        baseCharge: service.baseCharge,
        baseChargeEnabled: service.baseChargeEnabled
    });
    return {
        ...result,
        isEstimate: true,
        timed: isTimed(service.pricingType),
        idleChargePerMinute
    };
};

/**
 * The final bill once work has finished.
 *
 * For hourly work the billed quantity comes from the timer, rounded up to the
 * configured block. For every other type the quantity is whatever was actually
 * measured on site, which may differ from what was booked.
 */
const finalBill = ({
    service,
    rate,
    bookedQuantity,
    actualQuantity,
    workedMinutes = 0,
    billingIntervalMinutes = 30,
    idleMinutes = 0,
    idleChargePerMinute = 0,
    extraCharges = []
}) => {
    let billedQuantity;
    let billedMinutes = null;

    if (isTimed(service.pricingType)) {
        billedMinutes = roundUpToBlock(workedMinutes, billingIntervalMinutes);
        billedQuantity = minutesToBillableHours(workedMinutes, billingIntervalMinutes);
    } else {
        // Measured work: trust what was recorded on site, falling back to the
        // booked quantity when nothing was recorded.
        billedQuantity = actualQuantity !== undefined && actualQuantity !== null
            ? Number(actualQuantity)
            : Number(bookedQuantity) || 0;
    }

    const result = calculate({
        pricingType: service.pricingType,
        rate,
        quantity: billedQuantity,
        baseCharge: service.baseCharge,
        baseChargeEnabled: service.baseChargeEnabled,
        idleMinutes,
        idleChargePerMinute,
        extraCharges
    });

    return {
        ...result,
        isEstimate: false,
        timed: isTimed(service.pricingType),
        workedMinutes: Math.max(0, Number(workedMinutes) || 0),
        billedMinutes,
        billingIntervalMinutes,
        idleMinutes
    };
};

/**
 * Validates a rate a Partner wants to charge against the admin guardrail.
 *
 * Sewaks never reach this: their rate is admin-fixed and they cannot change it.
 * Returns the rate to store, or throws with a message the Partner will see.
 */
const resolveProviderRate = ({ service, providerCategory, requestedRate }) => {
    if (providerCategory === 'sewak') {
        // Managed workforce: the admin rate is the only rate.
        return Number(service.sewakRate ?? service.rate) || 0;
    }

    const min = Number(service.minRate) || 0;
    const max = Number(service.maxRate) || 0;
    const asked = Number(requestedRate);

    if (!Number.isFinite(asked) || asked <= 0) {
        throw new Error('Enter a valid hourly rate.');
    }
    if (min > 0 && asked < min) {
        throw new Error(`Your rate must be at least ₹${min} for ${service.name}.`);
    }
    if (max > 0 && asked > max) {
        throw new Error(`Your rate cannot exceed ₹${max} for ${service.name}.`);
    }
    return asked;
};

/**
 * Waiting time chargeable after the arrival grace period.
 *
 * Returns 0 during the grace window — the customer is never charged for the
 * first few minutes after a worker arrives.
 */
const chargeableIdleMinutes = ({ arrivedAt, workStartedAt, graceMinutes = 10 }) => {
    if (!arrivedAt) return 0;
    const end = workStartedAt ? new Date(workStartedAt) : new Date();
    const waitedMs = end.getTime() - new Date(arrivedAt).getTime();
    if (waitedMs <= 0) return 0;
    const waitedMinutes = Math.floor(waitedMs / 60000);
    return Math.max(0, waitedMinutes - Math.max(0, Number(graceMinutes) || 0));
};

/**
 * The most time this job is currently authorised to bill for: what was booked,
 * plus any extension the customer approved, plus the admin's overrun tolerance.
 *
 * The tolerance exists so a worker running a few minutes over does not have to
 * interrupt the customer for permission; past it, approval is required.
 */
const authorisedMinutes = ({ bookedMinutes, overrunThresholdMinutes = 30, approvedExtraMinutes = 0 }) =>
    (Number(bookedMinutes) || 0)
    + (Number(approvedExtraMinutes) || 0)
    + Math.max(0, Number(overrunThresholdMinutes) || 0);

/**
 * Whether the worker has run far enough past the booked duration that the
 * customer must approve an extension before more time may be billed.
 *
 * Guarding this matters for more than billing: an unbounded job eats the
 * worker's next appointment.
 */
const needsExtension = ({ bookedMinutes, workedMinutes, overrunThresholdMinutes = 30, approvedExtraMinutes = 0 }) =>
    (Number(workedMinutes) || 0) > authorisedMinutes({ bookedMinutes, overrunThresholdMinutes, approvedExtraMinutes });

/**
 * Caps billable time at what the customer actually authorised.
 *
 * The spec is explicit that the timer only continues past the booked duration
 * once the customer approves. Without this cap a worker could run a one-hour
 * booking for five hours and bill all of it, and declining an extension would
 * change nothing — which is what made the approval prompt decorative rather
 * than a control.
 *
 * Returns both figures so the bill can show the time actually spent alongside
 * the time being charged for.
 */
const billableMinutes = ({ workedMinutes, bookedMinutes, overrunThresholdMinutes = 30, approvedExtraMinutes = 0 }) => {
    const worked = Math.max(0, Number(workedMinutes) || 0);
    const allowed = authorisedMinutes({ bookedMinutes, overrunThresholdMinutes, approvedExtraMinutes });
    const billable = Math.min(worked, allowed);
    return {
        workedMinutes: worked,
        authorisedMinutes: allowed,
        billableMinutes: billable,
        // Time the worker spent that nobody approved. Recorded rather than
        // silently dropped, so a dispute can be settled from the job record.
        unbilledOverrunMinutes: Math.max(0, worked - billable)
    };
};

/** Minutes between two instants, floored, never negative. */
const minutesBetween = (from, to = new Date()) => {
    if (!from) return 0;
    const ms = new Date(to).getTime() - new Date(from).getTime();
    return ms <= 0 ? 0 : Math.floor(ms / 60000);
};

module.exports = {
    PRICING_TYPES,
    UNIT_LABELS,
    isTimed,
    roundUpToBlock,
    authorisedMinutes,
    billableMinutes,
    minutesToBillableHours,
    calculate,
    estimate,
    finalBill,
    resolveProviderRate,
    chargeableIdleMinutes,
    needsExtension,
    minutesBetween
};
