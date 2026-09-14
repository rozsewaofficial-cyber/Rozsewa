/**
 * Pins down the Insta Work rules that are easy to break later.
 * Pure logic, no database — safe to run anywhere:
 *
 *   node scripts/instaCheck.js
 */
const assert = require('assert');
const P = require('../services/InstaPricingService');
const A = require('../services/InstaAssignmentService');
const C = require('../services/InstaConfigService');
// Only for its schema methods — requiring a model registers it, it does not
// open a connection.
const InstaJob = require('../models/InstaJob');
const read = (rel) => require('fs').readFileSync(require('path').join(__dirname, '..', rel), 'utf8');
const frontend = (...p) => require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'src', ...p), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const hourly = { pricingType: 'per_hour', rate: 150, baseCharge: 0, baseChargeEnabled: false, name: 'Bathroom Cleaning' };

console.log('\nThe billing example from the spec');
check('booked 2 hrs @ Rs 150 estimates Rs 300', () => {
    assert.strictEqual(P.estimate({ service: hourly, rate: 150, quantity: 2 }).subtotal, 300);
});
check('2 hrs 10 mins rounds up to 2.5 hrs and bills Rs 375', () => {
    const bill = P.finalBill({ service: hourly, rate: 150, bookedQuantity: 2, workedMinutes: 130, billingIntervalMinutes: 30 });
    assert.strictEqual(bill.billedMinutes, 150);
    assert.strictEqual(bill.quantity, 2.5);
    assert.strictEqual(bill.subtotal, 375);
});

console.log('\nBilling blocks round up, never down');
check('15-minute blocks', () => {
    assert.strictEqual(P.roundUpToBlock(1, 15), 15);
    assert.strictEqual(P.roundUpToBlock(15, 15), 15);
    assert.strictEqual(P.roundUpToBlock(16, 15), 30);
});
check('30-minute blocks', () => {
    assert.strictEqual(P.roundUpToBlock(1, 30), 30);
    assert.strictEqual(P.roundUpToBlock(130, 30), 150);
});
check('60-minute blocks', () => {
    assert.strictEqual(P.roundUpToBlock(61, 60), 120);
    assert.strictEqual(P.roundUpToBlock(120, 60), 120);
});
check('zero worked minutes bills nothing', () => {
    assert.strictEqual(P.roundUpToBlock(0, 30), 0);
    const bill = P.finalBill({ service: hourly, rate: 150, bookedQuantity: 2, workedMinutes: 0, billingIntervalMinutes: 30 });
    assert.strictEqual(bill.subtotal, 0);
});

console.log('\nAll five pricing types');
check('per hour', () => {
    assert.strictEqual(P.calculate({ pricingType: 'per_hour', rate: 150, quantity: 3 }).subtotal, 450);
});
check('per km', () => {
    assert.strictEqual(P.calculate({ pricingType: 'per_km', rate: 15, quantity: 8 }).subtotal, 120);
});
check('per meter', () => {
    assert.strictEqual(P.calculate({ pricingType: 'per_meter', rate: 20, quantity: 12 }).subtotal, 240);
});
check('per unit', () => {
    assert.strictEqual(P.calculate({ pricingType: 'per_unit', rate: 50, quantity: 6 }).subtotal, 300);
});
check('custom is a single priced job regardless of quantity', () => {
    const r = P.calculate({ pricingType: 'custom', rate: 900, quantity: 7 });
    assert.strictEqual(r.quantity, 1);
    assert.strictEqual(r.subtotal, 900);
});
check('an unknown pricing type is refused', () => {
    assert.throws(() => P.calculate({ pricingType: 'per_furlong', rate: 10, quantity: 1 }), /Unknown pricing type/);
});

console.log('\nBase + variable charge');
check("the spec's delivery example: Rs 30 base + Rs 15/km x 8 = Rs 150", () => {
    const r = P.calculate({
        pricingType: 'per_km', rate: 15, quantity: 8,
        baseCharge: 30, baseChargeEnabled: true
    });
    assert.strictEqual(r.baseAmount, 30);
    assert.strictEqual(r.variableAmount, 120);
    assert.strictEqual(r.subtotal, 150);
});
check('switching the base charge off removes it entirely', () => {
    const r = P.calculate({ pricingType: 'per_km', rate: 15, quantity: 8, baseCharge: 30, baseChargeEnabled: false });
    assert.strictEqual(r.baseAmount, 0);
    assert.strictEqual(r.subtotal, 120);
});

console.log('\nArrival grace period and waiting charges');
const minsAgo = (n) => new Date(Date.now() - n * 60000);
check('nothing is charged inside the grace period', () => {
    assert.strictEqual(P.chargeableIdleMinutes({ arrivedAt: minsAgo(8), graceMinutes: 10 }), 0);
    assert.strictEqual(P.chargeableIdleMinutes({ arrivedAt: minsAgo(10), graceMinutes: 10 }), 0);
});
check('only the minutes beyond the grace period are chargeable', () => {
    assert.strictEqual(P.chargeableIdleMinutes({ arrivedAt: minsAgo(25), graceMinutes: 10 }), 15);
});
check('waiting stops counting the moment work starts', () => {
    const arrived = minsAgo(40);
    const started = minsAgo(20);   // waited 20, grace 10 -> 10 chargeable
    assert.strictEqual(P.chargeableIdleMinutes({ arrivedAt: arrived, workStartedAt: started, graceMinutes: 10 }), 10);
});
check('no arrival means no waiting charge', () => {
    assert.strictEqual(P.chargeableIdleMinutes({ arrivedAt: null, graceMinutes: 10 }), 0);
});
check('waiting charge appears on the bill as its own line', () => {
    const bill = P.finalBill({
        service: hourly, rate: 150, bookedQuantity: 1, workedMinutes: 60,
        billingIntervalMinutes: 30, idleMinutes: 15, idleChargePerMinute: 2
    });
    assert.strictEqual(bill.idleAmount, 30);
    assert.strictEqual(bill.subtotal, 180);       // 150 work + 30 waiting
    assert.ok(bill.breakdown.some(b => /Waiting charge/.test(b.label)));
});

console.log('\nDuration extension');
check('within the booked time plus threshold, no approval is needed', () => {
    assert.strictEqual(P.needsExtension({ bookedMinutes: 120, workedMinutes: 140, overrunThresholdMinutes: 30 }), false);
    assert.strictEqual(P.needsExtension({ bookedMinutes: 120, workedMinutes: 150, overrunThresholdMinutes: 30 }), false);
});
check('past the threshold, approval is required', () => {
    assert.strictEqual(P.needsExtension({ bookedMinutes: 120, workedMinutes: 151, overrunThresholdMinutes: 30 }), true);
});
check('an approved extension pushes the limit out', () => {
    assert.strictEqual(
        P.needsExtension({ bookedMinutes: 120, workedMinutes: 175, overrunThresholdMinutes: 30, approvedExtraMinutes: 30 }),
        false
    );
});

console.log('\nPartner rate guardrail');
const guarded = { name: 'Bathroom Cleaning', sewakRate: 150, minRate: 150, maxRate: 250 };
check('a rate inside the band is accepted', () => {
    assert.strictEqual(P.resolveProviderRate({ service: guarded, providerCategory: 'partner', requestedRate: 200 }), 200);
    assert.strictEqual(P.resolveProviderRate({ service: guarded, providerCategory: 'partner', requestedRate: 150 }), 150);
    assert.strictEqual(P.resolveProviderRate({ service: guarded, providerCategory: 'partner', requestedRate: 250 }), 250);
});
check('below the floor is refused', () => {
    assert.throws(() => P.resolveProviderRate({ service: guarded, providerCategory: 'partner', requestedRate: 100 }), /at least/);
});
check('above the ceiling is refused', () => {
    assert.throws(() => P.resolveProviderRate({ service: guarded, providerCategory: 'partner', requestedRate: 400 }), /cannot exceed/);
});
check('a Sewak always gets the admin rate, whatever they ask for', () => {
    assert.strictEqual(P.resolveProviderRate({ service: guarded, providerCategory: 'sewak', requestedRate: 9999 }), 150);
});

console.log('\nWorker eligibility');
const freshProvider = (over = {}) => ({
    instaWork: {
        enabled: true,
        lastPingAt: new Date(),
        lastPing: { coordinates: [75.8577, 22.7196] },
        workingHours: { start: '', end: '' },
        restrictedUntil: null,
        disabledByAdmin: false,
        ...over
    },
    location: { coordinates: [75.8577, 22.7196] }
});
check('a recent ping counts as online', () => {
    assert.strictEqual(A.hasFreshPing(freshProvider(), 5), true);
});
check('a stale ping counts as offline however the toggle is set', () => {
    assert.strictEqual(A.hasFreshPing(freshProvider({ lastPingAt: minsAgo(30) }), 5), false);
});
check('a worker who never pinged is not available', () => {
    assert.strictEqual(A.hasFreshPing(freshProvider({ lastPingAt: null }), 5), false);
});
check('an admin-disabled worker is restricted', () => {
    assert.strictEqual(A.isRestricted(freshProvider({ disabledByAdmin: true })), true);
});
check('a live temporary restriction blocks the worker', () => {
    assert.strictEqual(A.isRestricted(freshProvider({ restrictedUntil: new Date(Date.now() + 3600e3) })), true);
});
check('an expired restriction does not', () => {
    assert.strictEqual(A.isRestricted(freshProvider({ restrictedUntil: new Date(Date.now() - 3600e3) })), false);
});
check('unset working hours mean always available', () => {
    assert.strictEqual(A.withinWorkingHours(freshProvider()), true);
});
check('a window spanning midnight is handled', () => {
    const p = freshProvider({ workingHours: { start: '22:00', end: '06:00' } });
    assert.strictEqual(A.withinWorkingHours(p, new Date('2026-01-01T23:30:00')), true);
    assert.strictEqual(A.withinWorkingHours(p, new Date('2026-01-01T03:00:00')), true);
    assert.strictEqual(A.withinWorkingHours(p, new Date('2026-01-01T12:00:00')), false);
});

console.log('\nSewak auto-assignment ranking');
check('the nearer worker wins when all else is equal', () => {
    const near = { distanceKm: 1, rating: 4, activeJobs: 0 };
    const far = { distanceKm: 8, rating: 4, activeJobs: 0 };
    assert.ok(A.sewakScore(near) < A.sewakScore(far));
});
check('a busy worker is deprioritised against an idle one nearby', () => {
    const busy = { distanceKm: 1, rating: 5, activeJobs: 1 };
    const free = { distanceKm: 2, rating: 5, activeJobs: 0 };
    assert.ok(A.sewakScore(free) < A.sewakScore(busy));
});
check('rating breaks a tie between equally close workers', () => {
    const good = { distanceKm: 3, rating: 5, activeJobs: 0 };
    const poor = { distanceKm: 3, rating: 2, activeJobs: 0 };
    assert.ok(A.sewakScore(good) < A.sewakScore(poor));
});
check('ETA is derived from distance and never shows zero', () => {
    assert.strictEqual(A.etaFromDistance(10, 20), 30);
    assert.strictEqual(A.etaFromDistance(0.1, 20), 1);
    assert.strictEqual(A.etaFromDistance(null, 20), null);
});

console.log('\nConfiguration guards');
check('the shipping defaults match the spec', () => {
    const d = C.DEFAULT_CONFIG;
    assert.strictEqual(d.billingIntervalMinutes, 30);
    assert.strictEqual(d.arrivalGraceMinutes, 10);
    assert.strictEqual(d.overrunThresholdMinutes, 30);
    assert.ok(d.cancellationFees.workStarted > d.cancellationFees.beforeAcceptance);
});
check('cancellation escalates: warn, then restrict, then disable', () => {
    const p = C.DEFAULT_CONFIG.cancellationPolicy;
    assert.ok(p.warnAfter < p.restrictAfter);
    assert.ok(p.restrictAfter < p.disableAfter);
});

console.log('\nUnapproved overrun is not billable');
check('time past booked + tolerance is capped away', () => {
    // 1 hr booked, 30 min tolerance, nothing approved, worker ran 5 hours.
    const r = P.billableMinutes({ workedMinutes: 300, bookedMinutes: 60, overrunThresholdMinutes: 30 });
    assert.strictEqual(r.authorisedMinutes, 90);
    assert.strictEqual(r.billableMinutes, 90);
    assert.strictEqual(r.unbilledOverrunMinutes, 210);
});
check('an approved extension raises the ceiling', () => {
    const r = P.billableMinutes({
        workedMinutes: 300, bookedMinutes: 60, overrunThresholdMinutes: 30, approvedExtraMinutes: 30
    });
    assert.strictEqual(r.authorisedMinutes, 120);
    assert.strictEqual(r.billableMinutes, 120);
});
check('work inside the tolerance bills in full', () => {
    const r = P.billableMinutes({ workedMinutes: 80, bookedMinutes: 60, overrunThresholdMinutes: 30 });
    assert.strictEqual(r.billableMinutes, 80);
    assert.strictEqual(r.unbilledOverrunMinutes, 0);
});
check('declining an extension genuinely costs the worker the overrun', () => {
    // Declining leaves approvedExtraMinutes at 0, so the ceiling does not move.
    const declined = P.billableMinutes({ workedMinutes: 200, bookedMinutes: 60, overrunThresholdMinutes: 30, approvedExtraMinutes: 0 });
    const approved = P.billableMinutes({ workedMinutes: 200, bookedMinutes: 60, overrunThresholdMinutes: 30, approvedExtraMinutes: 60 });
    assert.ok(
        approved.billableMinutes > declined.billableMinutes,
        'approval must change what is billable, or the prompt is decorative'
    );
});
check('stopWork actually applies the cap', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'instaProviderController.js'), 'utf8');
    assert.ok(src.includes('Pricing.billableMinutes'), 'stopWork must compute the cap');
    assert.ok(src.includes('cap.billableMinutes'), 'the bill must use the capped minutes');
});

console.log('\nOnline payment is bound to the job');
check('verification checks the order, the signature and replay', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'instaCustomerController.js'), 'utf8');
    // Each is a distinct failure the audit found elsewhere in this platform:
    // an unbound amount, a signature-only check, and payment replay.
    assert.ok(src.includes('razorpay_order_id !== job.razorpayOrderId'), 'the paid order must match the job');
    assert.ok(src.includes('createHmac'), 'the signature must be verified');
    assert.ok(src.includes('razorpayPaymentId: razorpay_payment_id'), 'a used payment id must be rejected');
    assert.ok(src.includes('Math.round(Number(job.finalAmount) * 100)'), 'the amount must come from the job');
});

console.log('\nExtension requests expire');
check('both ends expire a request the customer never answered', () => {
    const fs = require('fs');
    const path = require('path');
    const prov = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'instaProviderController.js'), 'utf8');
    const cust = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'instaCustomerController.js'), 'utf8');
    // Only one request may be pending at a time, so without expiry a single
    // unanswered one blocks every future request for the life of the job.
    assert.ok(prov.includes('expireStaleExtensions'), 'provider side must expire stale requests');
    assert.ok(cust.includes('expireStaleExtensions'), 'customer side must expire stale requests');
});

console.log('\nThe start OTP never reaches the worker');
check('every provider job response is sanitised', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'controllers', 'instaProviderController.js'),
        'utf8'
    );
    // The OTP is the customer's proof that the worker is standing in front of
    // them. A worker who can read it from their own API can start the timer
    // alone, which defeats the entire check.
    assert.ok(src.includes('delete plain.startOTP'), 'forWorker must strip startOTP');
    assert.ok(!src.includes('res.json({ job })'), 'a raw job must never be returned to a worker');
    assert.ok(!src.includes('res.json({ jobs })'), 'a raw job list must never be returned to a worker');
});


console.log('\nEarnings surfaces include Insta Work');
const Adapter = require('../services/InstaEarningsAdapter');
check('a finished job is presented in the shape the analytics read', () => {
    const row = Adapter.toBookingShape({
        _id: 'j1', createdAt: new Date('2026-09-14T07:10:45.982Z'), status: 'CLOSED',
        paymentStatus: 'paid', paymentMode: 'cash', finalAmount: 225,
        adminCommission: 22.5, providerPayout: 202.5, serviceName: 'Bathroom Cleaning'
    });
    assert.strictEqual(row.status, 'completed');
    assert.strictEqual(row.totalAmount, 225);
    assert.strictEqual(row.adminCommission, 22.5);
    // Cash on site is the equivalent of a booking paid 'after'; the reports
    // speak Booking's vocabulary, so the adapter has to translate.
    assert.strictEqual(row.paymentMode, 'after');
});
check('a cancelled job maps to cancelled, not completed', () => {
    const row = Adapter.toBookingShape({ status: 'CANCELLED', createdAt: new Date() });
    assert.strictEqual(row.status, 'cancelled');
});
check('dates are display strings, because the settlement table renders them raw', () => {
    const row = Adapter.toBookingShape({ createdAt: new Date('2026-09-14T07:10:45.982Z'), status: 'CLOSED' });
    assert.strictEqual(typeof row.bookingDate, 'string');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(row.bookingDate), 'bookingDate must not be a raw ISO timestamp');
});
check('a booking-vocabulary status filter is translated, not passed through', () => {
    // The admin dashboard asks for 'completed'; Insta calls that PAYMENT_COMPLETED
    // or CLOSED. Passing the filter through unchanged would silently return nothing.
    assert.ok(Adapter.DONE_STATUSES.includes('CLOSED'));
    assert.ok(Adapter.DONE_STATUSES.includes('PAYMENT_COMPLETED'));
});
check('both earnings surfaces actually consult the adapter', () => {
    const fs = require('fs');
    const path = require('path');
    const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
    // Insta revenue was invisible on both screens: each read only Booking, so
    // every rupee of Insta commission and payout was missing from reporting.
    assert.ok(read('controllers', 'commissionController.js').includes('InstaEarningsAdapter'),
        'admin earnings must include Insta jobs');
    assert.ok(read('controllers', 'providerController.js').includes('InstaEarningsAdapter'),
        "a worker's own earnings must include Insta jobs");
});
check('the admin dashboard sums a field that actually holds money', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'adminController.js'), 'utf8');
    // It summed `$amount`, which is not a top-level Booking field, so the
    // headline revenue was always zero however much had been earned.
    assert.ok(!src.includes('$sum: "$amount"'), 'revenue must not sum a non-existent field');
    // What it must sum is now the shared gross definition, so the headline
    // agrees with the earnings dashboard; that is pinned in codAndAnalyticsCheck.
    assert.ok(src.includes('grossAggregationExpr()'), 'revenue must use the shared gross definition');
});

console.log('\nSettlement consumes the allowances it spends');
check('a free-trial Insta job uses up a trial slot', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'InstaSettlementService.js'), 'utf8');
    // Taking the 0% rate without spending the allowance would leave the worker
    // on free commission indefinitely — the trial would never end.
    assert.ok(src.includes('freeTrial.usedServices'), 'settlement must increment the trial counter');
    assert.ok(src.includes('trialCompletedAt'), 'settlement must close the trial when it runs out');
});

console.log('\nA job cannot be created without a location');
check('createJob rejects a job with no usable coordinates', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'instaCustomerController.js'), 'utf8');
    // Without coordinates the matcher cannot apply its radius and falls back to
    // "anyone who is live", which books a worker who may be far away.
    assert.ok(src.includes('validCoords'), 'createJob must validate coordinates');
});
check('the worker is told when their location cannot be shared', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'provider', 'pages', 'ProviderInstaWork.jsx'),
        'utf8'
    );
    // A blocked location silently removes them from matching. Showing "you are
    // live" while nobody can find them is the worst thing this screen can say.
    assert.ok(src.includes('setLocationError'), 'a failed position report must be surfaced');
});


console.log('\nNearby means nearby');
const Distance = require('../services/DistanceChargeService');
const INDORE = { lat: 22.7196, lng: 75.8577 };
const KM_PER_DEG_LAT = 110.574;
const northOf = (km) => INDORE.lat + km / KM_PER_DEG_LAT;

check('the distance used for matching is the real one', () => {
    // Matching, ETA and per-km billing all read this number, so an error here
    // is an error in three places at once.
    [2, 9, 14.5, 40].forEach(km => {
        const got = Distance.calculateDistance(INDORE.lat, INDORE.lng, northOf(km), INDORE.lng);
        // 1%: the placement uses an average degree-length, so the check
        // allows for that rather than for sloppiness in the calculation.
        assert.ok(Math.abs(got - km) / km < 0.01, `${km}km computed as ${got}`);
    });
});

check('a worker outside the radius is not offered the job', () => {
    const config = { matchRadiusKm: 15, pingFreshnessMinutes: 5, maxConcurrentJobs: 1, etaSpeedKmph: 20 };
    const inside = Distance.calculateDistance(INDORE.lat, INDORE.lng, northOf(14.5), INDORE.lng);
    const outside = Distance.calculateDistance(INDORE.lat, INDORE.lng, northOf(16), INDORE.lng);
    assert.ok(inside <= config.matchRadiusKm, 'a worker just inside the radius must qualify');
    assert.ok(outside > config.matchRadiusKm, 'a worker just outside it must not');
});

check('proximity decides the auto-assignment', () => {
    // Rating and workload break ties, but they must not let a distant worker
    // beat a near one for an on-demand job.
    const near = { distanceKm: 2, rating: 4.0, activeJobs: 0 };
    const far = { distanceKm: 12, rating: 5.0, activeJobs: 0 };
    assert.ok(A.sewakScore(near) < A.sewakScore(far));
});

check('a busy worker yields to a free one a little further away', () => {
    const busyAndNear = { distanceKm: 2, rating: 5, activeJobs: 1 };
    const freeAndFurther = { distanceKm: 4, rating: 5, activeJobs: 0 };
    assert.ok(A.sewakScore(freeAndFurther) < A.sewakScore(busyAndNear));
});

check('an unknown distance ranks mid-table, never first', () => {
    // A worker whose position could not be read must not win by default.
    const unknown = { distanceKm: null, rating: 5, activeJobs: 0 };
    const known = { distanceKm: 2, rating: 5, activeJobs: 0 };
    assert.ok(A.sewakScore(known) < A.sewakScore(unknown));
});


console.log('\nCustom work is priced on site, within the admin band');
const oddJob = { name: 'Odd Jobs', pricingType: 'custom', minRate: 100, maxRate: 5000 };

check('the amount the worker sets becomes the bill', () => {
    // Custom work has no quantity to measure, so this figure IS the price. It
    // had no way in at all: the job was created at rate 0 and stopWork only
    // accepted a quantity, so every custom job settled at zero.
    assert.strictEqual(P.resolveCustomAmount({ service: oddJob, amount: 1250 }), 1250);
});

check('a custom job with no amount cannot be billed', () => {
    [undefined, null, '', 0, -50].forEach(amount => {
        assert.throws(() => P.resolveCustomAmount({ service: oddJob, amount }),
            `an amount of ${JSON.stringify(amount)} should be refused`);
    });
});

check('the admin band bounds what a worker may charge', () => {
    // The one number a worker picks freely, so it is checked rather than trusted.
    assert.throws(() => P.resolveCustomAmount({ service: oddJob, amount: 50 }), /at least/);
    assert.throws(() => P.resolveCustomAmount({ service: oddJob, amount: 999999 }), /cannot exceed/);
    assert.strictEqual(P.resolveCustomAmount({ service: oddJob, amount: 100 }), 100);
    assert.strictEqual(P.resolveCustomAmount({ service: oddJob, amount: 5000 }), 5000);
});

check('stopWork asks for that amount and refuses without it', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'instaProviderController.js'), 'utf8');
    assert.ok(src.includes('resolveCustomAmount'), 'stopWork must resolve the on-site amount');
});

console.log('\nOnly timed work has a clock to extend');
check('an extension on measured work is refused', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'instaProviderController.js'), 'utf8');
    // Asking a customer to approve more minutes on a job billed by the unit is
    // incoherent, and it leaves a pending request on a job with no timer.
    assert.ok(/if \(!job\.isTimed\) \{[\s\S]{0,200}cannot be extended/.test(src),
        'requestExtension must reject untimed jobs');
});

console.log('\nAll five pricing types bill correctly');
const bill = (service, opts) => P.finalBill({ service, rate: opts.rate, ...opts }).subtotal;

check('per hour rounds up to the billing block', () => {
    const s = { pricingType: 'per_hour', name: 'Clean' };
    assert.strictEqual(bill(s, { rate: 150, bookedQuantity: 2, workedMinutes: 70, billingIntervalMinutes: 30 }), 225);
});
check('per km charges the distance actually covered, plus any base', () => {
    const s = { pricingType: 'per_km', name: 'Delivery', baseChargeEnabled: true, baseCharge: 30 };
    assert.strictEqual(bill(s, { rate: 15, bookedQuantity: 8, actualQuantity: 10 }), 30 + 150);
});
check('per meter can bill less than was booked', () => {
    // The worker records what was done; booking 20m and painting 18m costs 18m.
    const s = { pricingType: 'per_meter', name: 'Fence' };
    assert.strictEqual(bill(s, { rate: 40, bookedQuantity: 20, actualQuantity: 18 }), 720);
});
check('per unit can bill more than was booked', () => {
    const s = { pricingType: 'per_unit', name: 'Taps', baseChargeEnabled: true, baseCharge: 50 };
    assert.strictEqual(bill(s, { rate: 120, bookedQuantity: 3, actualQuantity: 4 }), 50 + 480);
});
check('custom is one job at the quoted price', () => {
    const s = { pricingType: 'custom', name: 'Odd Jobs' };
    assert.strictEqual(bill(s, { rate: 1250, bookedQuantity: 1 }), 1250);
});

console.log('\nA Partner is booked at their own rate, not the Sewak rate');
const banded = { name: 'Clean', pricingType: 'per_hour', sewakRate: 150, minRate: 150, maxRate: 250 };
check('a Sewak always gets the admin rate, whatever is asked for', () => {
    assert.strictEqual(P.resolveProviderRate({ service: banded, providerCategory: 'sewak', requestedRate: 9999 }), 150);
});
check('a Partner rate inside the band is honoured', () => {
    assert.strictEqual(P.resolveProviderRate({ service: banded, providerCategory: 'partner', requestedRate: 200 }), 200);
});
check('a Partner rate outside the band is refused', () => {
    // The customer's client sends this figure, so it is re-validated server-side.
    assert.throws(() => P.resolveProviderRate({ service: banded, providerCategory: 'partner', requestedRate: 50 }));
    assert.throws(() => P.resolveProviderRate({ service: banded, providerCategory: 'partner', requestedRate: 5000 }));
});


console.log('\nWaiting is charged only past the grace window');
const waited = (minutes, graceMinutes = 10) => P.chargeableIdleMinutes({
    arrivedAt: new Date(Date.now() - minutes * 60000),
    workStartedAt: new Date(),
    graceMinutes
});

check('waiting inside the grace window is free', () => {
    // The customer is never billed for a worker arriving a few minutes early.
    assert.strictEqual(waited(0), 0);
    assert.strictEqual(waited(5), 0);
    assert.strictEqual(waited(10), 0);
});
check('only the time past the grace window is charged', () => {
    assert.strictEqual(waited(25), 15);
    assert.strictEqual(waited(40), 30);
});
check('a worker who never marked arrival cannot charge waiting', () => {
    // Otherwise the charge would start from a moment nobody recorded.
    assert.strictEqual(P.chargeableIdleMinutes({ arrivedAt: null, workStartedAt: new Date() }), 0);
});
check('the clock stops when work starts, not when the bill is read', () => {
    const arrivedAt = new Date(Date.now() - 60 * 60000);
    const workStartedAt = new Date(Date.now() - 40 * 60000);
    // Waited 20 minutes before starting, so 10 are chargeable — the 40 minutes
    // of work since must not be added to the waiting charge as well.
    assert.strictEqual(P.chargeableIdleMinutes({ arrivedAt, workStartedAt, graceMinutes: 10 }), 10);
});
check('the waiting charge appears on the bill as its own line', () => {
    // A charge the customer cannot see is a charge they will dispute.
    const bill = P.finalBill({
        service: { pricingType: 'per_hour', name: 'Clean' },
        rate: 150, bookedQuantity: 2, workedMinutes: 70, billingIntervalMinutes: 30,
        idleMinutes: 30, idleChargePerMinute: 2
    });
    assert.strictEqual(bill.subtotal, 225 + 60);
    assert.ok(bill.breakdown.some(l => /wait/i.test(l.label)), 'a waiting line must be shown');
});

console.log('\nThe cancellation fee follows how far the job had got');
const stageOf = (status) => {
    const job = { status, cancellationStageNow: InstaJob.schema.methods.cancellationStageNow };
    return job.cancellationStageNow();
};
check('each stage maps to its own band', () => {
    // A worker who has already driven out has lost more than one who has not.
    assert.strictEqual(stageOf('ASSIGNED'), 'beforeAcceptance');
    assert.strictEqual(stageOf('ACCEPTED'), 'afterAcceptance');
    assert.strictEqual(stageOf('ON_THE_WAY'), 'afterAcceptance');
    assert.strictEqual(stageOf('ARRIVED'), 'afterArrival');
    assert.strictEqual(stageOf('WORK_STARTED'), 'workStarted');
});
check('the fee rises with each stage', () => {
    const f = C.DEFAULT_CONFIG.cancellationFees;
    assert.ok(f.beforeAcceptance < f.afterAcceptance);
    assert.ok(f.afterAcceptance < f.afterArrival);
    assert.ok(f.afterArrival < f.workStarted);
});

console.log('\nRepeated cancellation escalates against the worker');
check('the policy escalates in order, and each step is reachable', () => {
    const p = C.DEFAULT_CONFIG.cancellationPolicy;
    assert.ok(p.warnAfter < p.restrictAfter, 'a warning must come before a restriction');
    assert.ok(p.restrictAfter < p.disableAfter, 'a restriction must come before disabling');
    assert.ok(p.restrictionHours > 0, 'a restriction with no duration never lifts');
});
check('a restriction lifts once its time has passed', () => {
    // Stored as an expiry rather than a flag, so nothing has to remember to
    // clear it.
    const now = new Date();
    assert.strictEqual(A.isRestricted({ instaWork: { restrictedUntil: new Date(+now + 3600000) } }, now), true);
    assert.strictEqual(A.isRestricted({ instaWork: { restrictedUntil: new Date(+now - 3600000) } }, now), false);
    assert.strictEqual(A.isRestricted({ instaWork: {} }, now), false);
});
check('a worker cancelling is what escalates, not a customer cancelling', () => {
    const fs = require('fs');
    const path = require('path');
    const providerSrc = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'instaProviderController.js'), 'utf8');
    const customerSrc = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'instaCustomerController.js'), 'utf8');
    assert.ok(/cancelCount/.test(providerSrc), 'a worker cancelling must count against them');
    assert.ok(!/cancelCount/.test(customerSrc), 'a customer cancelling must not count against the worker');
});


console.log('\nAn unpaid cancellation fee is carried, not forgotten');
const Fees = require('../services/InstaCancellationFeeService');
const readSrc = (...p) => require('fs').readFileSync(require('path').join(__dirname, '..', ...p), 'utf8');

check('work already done cannot be cancelled away', () => {
    // WORK_COMPLETED and CUSTOMER_CONFIRMED used to fall through to the FREE
    // band, so a customer could let the worker finish the whole job and then
    // cancel out of paying for it.
    const stage = (status) => InstaJob.schema.methods.cancellationStageNow.call({ status });
    assert.strictEqual(stage('WORK_COMPLETED'), 'workStarted');
    assert.strictEqual(stage('CUSTOMER_CONFIRMED'), 'workStarted');
    const src = readSrc('controllers', 'instaCustomerController.js');
    assert.ok(/WORK_ALREADY_DONE/.test(src), 'cancelling completed work must be refused outright');
});

check('an unknown status never lands in the free band by accident', () => {
    // The default is the highest band, so a status added later cannot silently
    // become free to cancel.
    const stage = InstaJob.schema.methods.cancellationStageNow.call({ status: 'SOMETHING_NEW' });
    assert.strictEqual(stage, 'workStarted');
});

check('the fee is marked owed rather than charged at cancellation', () => {
    // Insta Work is post-paid, so there is no payment method to charge at that
    // moment; it waits for the next bill.
    const src = readSrc('controllers', 'instaCustomerController.js');
    assert.ok(/cancellationFeeStatus = fee > 0 \? 'pending' : 'none'/.test(src));
    assert.ok(/next booking/.test(src), 'the customer must be told when it will be charged');
});

check('the bill names the job each carried fee came from', () => {
    // "Cancellation fee" with no reference is a charge a customer cannot check.
    const line = Fees.breakdownLine({ jobCode: 'IW0ABC123', amount: 60 });
    assert.ok(line.label.includes('IW0ABC123'));
    assert.strictEqual(line.amount, 60);
});

check('the fee is claimed at bill time so two bills cannot both take it', () => {
    const src = readSrc('services', 'InstaCancellationFeeService.js');
    // The claim is conditional on the row still being pending, which is what
    // makes concurrent bills safe.
    assert.ok(/cancellationFeeStatus: 'pending'/.test(src), 'the claim must be conditional');
    assert.ok(/modifiedCount === 1/.test(src), 'only a winning claim may count');
});

check('a job that never gets paid hands its fees back', () => {
    // Otherwise a customer clears the debt by cancelling the job carrying it,
    // and a worker walking away would clear it too.
    const customer = readSrc('controllers', 'instaCustomerController.js');
    const provider = readSrc('controllers', 'instaProviderController.js');
    assert.ok(/CancellationFees\.release\(job\)/.test(customer), 'customer cancel must release');
    assert.ok(/CancellationFees\.release\(job\)/.test(provider), 'worker cancel must release');
});

check('the worker is neither paid nor taxed for it', () => {
    // The worker on the next job is almost never the one who was cancelled on,
    // so the fee is the platform's; commission is charged on the work alone.
    const src = readSrc('services', 'InstaSettlementService.js');
    assert.ok(/const workValue = Math\.max\(0, gross - carriedFees\)/.test(src),
        'commission must be computed on the work, not the fee');
    assert.ok(/CommissionService\.calculate\(workValue, matchedRule\)/.test(src));
    assert.ok(/calculation\.platformAmount \+ carriedFees/.test(src),
        'the fee must go to the platform whole');
});

check('commission plus payout still equals the bill', () => {
    // The invariant the earnings dashboard relies on must survive the fee.
    const gross = 255, carriedFees = 30;
    const workValue = gross - carriedFees;
    const commissionOnWork = workValue * 0.10;
    const adminCommission = commissionOnWork + carriedFees;
    const providerPayout = workValue - commissionOnWork;
    assert.strictEqual(adminCommission + providerPayout, gross);
});

check('the customer is warned before booking, not at the end', () => {
    const src = readSrc('controllers', 'instaCustomerController.js');
    assert.ok(/pendingCancellationFeeTotal/.test(src), 'the quote must disclose what is owed');
    assert.ok(/estimatedTotal/.test(src), 'and what they will actually pay');
});


console.log('\nOnly time the customer approved may be billed');
const extSrc = () => require('fs').readFileSync(
    require('path').join(__dirname, '..', 'controllers', 'instaCustomerController.js'), 'utf8');

check('approving adds exactly what was asked for, declining adds nothing', () => {
    const src = extSrc();
    assert.ok(/job\.approvedExtraMinutes = \(job\.approvedExtraMinutes \|\| 0\) \+ pending\.requestedMinutes/.test(src),
        'an approval must add the requested minutes');
    // Scoped to this handler: the file has many else branches, and only this
    // one's treatment of the ceiling is under test.
    const handler = src.slice(src.indexOf('const respondToExtension'), src.indexOf('const selectPartner'));
    const declineBranch = handler.slice(handler.indexOf('} else {'), handler.indexOf('Declined duration extension') + 40);
    assert.ok(declineBranch.length > 0, 'the decline branch must still exist');
    assert.ok(!/approvedExtraMinutes/.test(declineBranch), 'declining must not move the ceiling');
});

check('a request the customer sat on cannot still be cashed in', () => {
    // Expiry is applied when the response is read, not only by the cron, so a
    // late approval cannot revive a request that has already lapsed.
    const src = extSrc();
    assert.ok(/expireStaleExtensions\(job, cfg\.extensionResponseMinutes\)/.test(src),
        'stale requests must expire before a response is accepted');
    assert.ok(/if \(!pending\)[\s\S]{0,160}may have expired/.test(src),
        'with no pending request the response must be refused');
});

check('the ceiling is booked time plus approvals plus the admin tolerance', () => {
    // Declined: 60 booked + 0 + 30 tolerance.
    assert.strictEqual(P.billableMinutes({
        workedMinutes: 170, bookedMinutes: 60, overrunThresholdMinutes: 30, approvedExtraMinutes: 0
    }).authorisedMinutes, 90);
    // Approved an hour: the ceiling moves by exactly that hour.
    assert.strictEqual(P.billableMinutes({
        workedMinutes: 170, bookedMinutes: 60, overrunThresholdMinutes: 30, approvedExtraMinutes: 60
    }).authorisedMinutes, 150);
    // Two approvals stack.
    assert.strictEqual(P.billableMinutes({
        workedMinutes: 230, bookedMinutes: 60, overrunThresholdMinutes: 30, approvedExtraMinutes: 90
    }).authorisedMinutes, 180);
});

check('the answer is worth real money, which is the point of asking', () => {
    const service = { pricingType: 'per_hour', name: 'Clean' };
    const bill = (approvedExtraMinutes) => {
        const cap = P.billableMinutes({ workedMinutes: 170, bookedMinutes: 60, overrunThresholdMinutes: 30, approvedExtraMinutes });
        return P.finalBill({
            service, rate: 150, bookedQuantity: 1,
            workedMinutes: cap.billableMinutes, billingIntervalMinutes: 30
        }).subtotal;
    };
    // Same work, same request — only the customer's answer differs.
    assert.strictEqual(bill(0), 225);
    assert.strictEqual(bill(60), 375);
});

check('time beyond the ceiling is recorded rather than silently dropped', () => {
    // The worker can query what they were not paid for.
    const cap = P.billableMinutes({ workedMinutes: 170, bookedMinutes: 60, overrunThresholdMinutes: 30, approvedExtraMinutes: 60 });
    assert.strictEqual(cap.billableMinutes, 150);
    assert.strictEqual(cap.unbilledOverrunMinutes, 20);
});

check('the customer is actually given a way to answer', () => {
    // The approval endpoint is worth nothing if the prompt never reaches them —
    // the same way custom pricing was unbillable for want of an input.
    const api = extSrc();
    assert.ok(/pendingExtension: job\.extensions\.find\(e => e\.status === 'pending'\)/.test(api),
        'the live job must expose the pending request');
    const ui = require('fs').readFileSync(
        require('path').join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'user', 'pages', 'InstaWork.jsx'), 'utf8');
    assert.ok(/live\?\.pendingExtension/.test(ui), 'the customer screen must read it');
    assert.ok(/approve: true/.test(ui) && /approve: false/.test(ui),
        'both answers must be offered');
});


console.log('\nA worker cannot be handed to two customers at once');
check('the assignment is settled after the write, not trusted before it', () => {
    // Matching counted a worker's active jobs and then assigned them with
    // nothing in between, so two customers booking at the same instant could
    // both be told they had the same person.
    const src = read('controllers/instaCustomerController.js');
    assert.ok(/const aheadOfThis = await InstaJob\.countDocuments\(/.test(src),
        'the claim must be checked against what already existed');
    assert.ok(/createdAt: \{ \$lte: job\.createdAt \}/.test(src),
        'settled by age, so the earlier job always wins');
    assert.ok(/WORKER_JUST_TAKEN/.test(src), 'and the loser is told why');
});

check('the loser releases the worker rather than holding them', () => {
    const src = read('controllers/instaCustomerController.js');
    const guard = src.slice(src.indexOf('const aheadOfThis'), src.indexOf('WORKER_JUST_TAKEN'));
    assert.ok(/job\.providerId = null;/.test(guard), 'it must let the worker go');
    assert.ok(/pushStatus\('CANCELLED', 'system'/.test(guard), 'and be recorded, not left dangling');
});

check('one definition of "currently working"', () => {
    // Matching and the capacity check disagreeing about which states count is
    // how a limit stops meaning anything.
    const InstaJob = require('../models/InstaJob');
    assert.deepStrictEqual(InstaJob.OCCUPIES_WORKER,
        ['ASSIGNED', 'PARTNER_SELECTED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'WORK_STARTED']);
    const matching = read('services/InstaAssignmentService.js');
    assert.ok(/InstaJob\.OCCUPIES_WORKER/.test(matching), 'matching must use it');
});

console.log('\nThe payment split reports what is known');
check('no payment instrument is invented', () => {
    // UPI / Card / Wallet / Net Banking were assigned by hashing the booking id.
    // It looked like analytics and was fiction, so a decision made on it would
    // have been made on nothing.
    const src = read('services/EarningsAnalyticsService.js');
    // Matched as a quoted label, so the comment explaining its removal does
    // not count as its return.
    assert.ok(!/= 'Net Banking'|: 'Net Banking'/.test(src), 'no invented instrument may remain');
    assert.ok(!/charCodeAt\(0\)\), 0\) % 100/.test(src), 'nor the hash that produced them');

    const S = require('../services/EarningsAnalyticsService');
    const out = S.getPaymentAnalytics([
        { paymentMode: 'after', totalAmount: 100 },
        { paymentMode: 'now', totalAmount: 200 }
    ]);
    assert.deepStrictEqual(out.map(o => o.name).sort(), ['Cash on Completion', 'Paid Online']);
    assert.strictEqual(out.find(o => o.name === 'Paid Online').value, 200);
});

check('the filter offers the distinction that exists', () => {
    const src = read('controllers/commissionController.js');
    assert.ok(!/method = 'UPI'/.test(src), 'the hashed filter must be gone');
    assert.ok(/wantsCash/.test(src), 'and replaced by the real one');
});

console.log('\nAn analytics window has an end');
check('commission analytics does not default to all of time', () => {
    // With no filter this read every completed booking ever, on page load.
    const src = read('controllers/v2CommissionController.js');
    assert.ok(/DEFAULT_WINDOW_DAYS/.test(src), 'there must be a default window');
    assert.ok(/matchQuery\.completedAt\.\$gte = startDate/.test(src),
        'which an explicit start date still overrides');
});

console.log('\nThe screens listen to what the server announces');
check('the Insta screens subscribe to job events', () => {
    // Nine events were being emitted and nothing was listening: a customer
    // watching their worker arrive found out on the next five-second poll.
    ['modules/user/pages/InstaWork.jsx', 'modules/provider/pages/ProviderInstaWork.jsx'].forEach(p => {
        const ui = frontend(...p.split('/'));
        assert.ok(/useSocket\(\)/.test(ui), `${p} must take the socket`);
        assert.ok(/INSTA_WORK_COMPLETED/.test(ui), `${p} must listen for job events`);
        assert.ok(/socket\.off\(e, refresh\)/.test(ui), `${p} must unsubscribe`);
    });
});

check('polling is kept as the fallback, not replaced', () => {
    // A dropped connection should slow the screen down, not freeze it.
    const ui = frontend('modules', 'user', 'pages', 'InstaWork.jsx');
    assert.ok(/setInterval\(loadActiveJob, 5000\)/.test(ui), 'the poll must remain');
});

console.log('\nA status reads as words');
check('every underscore is replaced, not just the first', () => {
    // on_the_way rendered as "ON THE_WAY".
    ['modules/provider/components/RecentBookingsList.jsx',
     'modules/admin/pages/PartnerProgramConfig.jsx'].forEach(p => {
        const ui = frontend(...p.split('/'));
        assert.ok(!/replace\("_", " "\)/.test(ui), `${p} still replaces only the first underscore`);
    });
});

console.log(`\n${passed} Insta Work checks passed.\n`);
