const CancellationFees = require('../services/InstaCancellationFeeService');
const mongoose = require('mongoose');
const InstaService = require('../models/InstaService');
const InstaJob = require('../models/InstaJob');
const Provider = require('../models/Provider');
const InstaConfig = require('../services/InstaConfigService');
const Pricing = require('../services/InstaPricingService');
const Assignment = require('../services/InstaAssignmentService');
const Settlement = require('../services/InstaSettlementService');

/** Short, human-quotable job reference. */
const makeJobCode = () =>
    `IW${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

const notify = (userId, userRole, title, message, extra = {}) => {
    try {
        const { notifyUser } = require('../config/notificationService');
        notifyUser({ userId, userRole, title, message, type: 'booking', ...extra })
            .catch(err => console.log('[InstaWork] notify failed:', err.message));
    } catch (err) {
        console.log('[InstaWork] notify threw:', err.message);
    }
};

const emitJob = (job, event, payload = {}) => {
    try {
        const { emitToUser, emitToProvider } = require('../config/socket');
        const body = { jobId: String(job._id), jobCode: job.jobCode, status: job.status, ...payload };
        emitToUser(job.customerId, event, body);
        if (job.providerId) emitToProvider(job.providerId, event, body);
    } catch (err) {
        console.log('[InstaWork] socket emit failed:', err.message);
    }
};

// @desc    Insta services a customer can book right now
// @route   GET /api/insta/services
// @access  Public
const getServices = async (req, res) => {
    try {
        const config = await InstaConfig.getConfig();
        if (!config.enabled) return res.json({ enabled: false, services: [] });

        const services = await InstaService.find({ isActive: true }).sort({ name: 1 }).lean();
        const city = req.query.city;

        const visible = services.filter(s =>
            !s.cities || s.cities.length === 0 || !city ||
            s.cities.some(c => c.toLowerCase() === String(city).toLowerCase())
        );

        res.json({
            enabled: true,
            services: visible.map(s => ({
                _id: s._id,
                name: s.name,
                description: s.description,
                icon: s.icon,
                categoryName: s.categoryName,
                pricingType: s.pricingType,
                unitLabel: Pricing.UNIT_LABELS[s.pricingType],
                // Sewak work is admin-priced, so the customer sees one number.
                // Partner work is a band, because each Partner sets their own.
                sewakRate: s.sewakRate,
                minRate: s.minRate,
                maxRate: s.maxRate,
                baseChargeEnabled: s.baseChargeEnabled,
                baseCharge: s.baseCharge,
                minQuantity: s.minQuantity,
                maxQuantity: s.maxQuantity,
                availableFor: s.availableFor,
                timed: Pricing.isTimed(s.pricingType)
            }))
        });
    } catch (error) {
        console.error('[InstaWork] getServices failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Price estimate before booking
// @route   POST /api/insta/quote
// @access  Private (Customer)
const getQuote = async (req, res) => {
    try {
        const { serviceId, quantity, supplyModel, rate } = req.body;
        const service = await InstaService.findById(serviceId);
        if (!service || !service.isActive) return res.status(404).json({ message: 'Service not available.' });

        const config = await InstaConfig.getConfig();
        const qty = Number(quantity);

        if (service.pricingType !== 'custom') {
            if (!Number.isFinite(qty) || qty < service.minQuantity || qty > service.maxQuantity) {
                return res.status(400).json({
                    message: `Choose between ${service.minQuantity} and ${service.maxQuantity} ${Pricing.UNIT_LABELS[service.pricingType]}s.`
                });
            }
        }

        // A Sewak's rate is fixed by the admin; a Partner's comes from the
        // Partner the customer picked, so it is passed in.
        const effectiveRate = supplyModel === 'sewak'
            ? Number(service.sewakRate) || 0
            : Number(rate) || Number(service.minRate) || 0;

        const quote = Pricing.estimate({
            service,
            rate: effectiveRate,
            quantity: qty,
            idleChargePerMinute: config.idleChargePerMinute
        });

        // Anything owed from an earlier cancellation joins this job's bill, so
        // the customer is told before booking rather than at the end. A charge
        // that appears only once the work is done is the kind people dispute.
        const owed = await CancellationFees.outstandingFor(req.user._id);
        const owedTotal = Math.round(owed.reduce((s, f) => s + f.amount, 0) * 100) / 100;

        res.json({
            ...quote,
            pendingCancellationFees: owed,
            pendingCancellationFeeTotal: owedTotal,
            estimatedTotal: Math.round((quote.subtotal + owedTotal) * 100) / 100,
            note: quote.timed
                ? 'This is an estimate. The final bill is based on the actual time worked.'
                : 'Final bill may change if the measured quantity differs on site.'
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Partners available for a service near the customer
// @route   POST /api/insta/partners
// @access  Private (Customer)
const getAvailablePartners = async (req, res) => {
    try {
        const { serviceId, location } = req.body;
        const service = await InstaService.findById(serviceId);
        if (!service || !service.isActive) return res.status(404).json({ message: 'Service not available.' });
        if (!service.availableFor.includes('partner')) {
            return res.status(400).json({ message: 'This service is served by RozSewa Sewaks only.' });
        }

        const config = await InstaConfig.getConfig();
        const partners = await Assignment.listPartners({ service, location, config });

        res.json({
            partners,
            searchRadiusKm: config.matchRadiusKm,
            // Shown so a customer with no results understands why.
            emptyReason: partners.length === 0
                ? `No Partners are online for this service within ${config.matchRadiusKm} km right now.`
                : null
        });
    } catch (error) {
        console.error('[InstaWork] getAvailablePartners failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create an Insta Work job
// @route   POST /api/insta/jobs
// @access  Private (Customer)
const createJob = async (req, res) => {
    try {
        const { serviceId, quantity, supplyModel, providerId, address, location, city, paymentMode } = req.body;

        const config = await InstaConfig.getConfig();
        if (!config.enabled) return res.status(503).json({ message: 'Insta Work is currently unavailable.' });

        const service = await InstaService.findById(serviceId);
        if (!service || !service.isActive) return res.status(404).json({ message: 'Service not available.' });
        if (!['sewak', 'partner'].includes(supplyModel)) {
            return res.status(400).json({ message: 'Choose a valid supply option.' });
        }
        if (!service.availableFor.includes(supplyModel)) {
            return res.status(400).json({ message: `This service is not offered by ${supplyModel}s.` });
        }
        if (!address) return res.status(400).json({ message: 'A service address is required.' });

        // Coordinates are not optional for Insta Work. Without them the
        // matcher cannot apply its radius, so it falls back to "anyone who is
        // live" — which silently books a worker who may be a hundred
        // kilometres away, and leaves them with nowhere to navigate to.
        const coords = location?.coordinates;
        const validCoords = Array.isArray(coords) && coords.length === 2
            && coords.every(n => Number.isFinite(Number(n)))
            && !(Number(coords[0]) === 0 && Number(coords[1]) === 0);
        if (!validCoords) {
            return res.status(400).json({ message: 'We need your location to find someone nearby. Please enable location access.' });
        }

        const qty = service.pricingType === 'custom' ? 1 : Number(quantity);
        if (service.pricingType !== 'custom') {
            if (!Number.isFinite(qty) || qty < service.minQuantity || qty > service.maxQuantity) {
                return res.status(400).json({
                    message: `Choose between ${service.minQuantity} and ${service.maxQuantity} ${Pricing.UNIT_LABELS[service.pricingType]}s.`
                });
            }
        }

        let assignedProviderId = null;
        let rate = 0;
        let status = 'REQUESTED';
        let matchedDistanceKm = null;
        let matchedEtaMinutes = null;

        if (supplyModel === 'sewak') {
            // Managed supply: the system chooses, the customer does not.
            status = 'MATCHING';
            const match = await Assignment.autoAssignSewak({ service, location, config });
            if (!match) {
                return res.status(409).json({
                    message: `No Sewak is available for ${service.name} near you right now. Please try again shortly.`,
                    code: 'NO_SEWAK_AVAILABLE'
                });
            }
            assignedProviderId = match.providerId;
            // Admin-fixed rate — never the worker's own figure.
            rate = Number(service.sewakRate) || 0;
            matchedDistanceKm = match.distanceKm;
            matchedEtaMinutes = match.etaMinutes;
            status = 'ASSIGNED';
        } else {
            // Open supply: the customer has already chosen a Partner.
            if (!mongoose.Types.ObjectId.isValid(providerId || '')) {
                return res.status(400).json({ message: 'Select a Partner to continue.' });
            }
            const partner = await Provider.findById(providerId);
            if (!partner) return res.status(404).json({ message: 'Selected Partner not found.' });

            const entry = (partner.instaWork?.services || [])
                .find(s => String(s.serviceId) === String(service._id));
            if (!partner.instaWork?.enabled || !entry) {
                return res.status(409).json({ message: 'That Partner is no longer available for this service.' });
            }
            if (!Assignment.hasFreshPing(partner, config.pingFreshnessMinutes)) {
                return res.status(409).json({ message: 'That Partner has just gone offline. Please choose another.' });
            }

            assignedProviderId = partner._id;
            // Re-validated against the guardrail rather than trusted, so a
            // stale or tampered rate can never be booked.
            rate = Pricing.resolveProviderRate({
                service,
                providerCategory: 'partner',
                requestedRate: entry.rate
            });

            const pos = Assignment.positionOf(partner, config.pingFreshnessMinutes);
            if (pos && location?.coordinates?.length === 2) {
                const DistanceChargeService = require('../services/DistanceChargeService');
                matchedDistanceKm = DistanceChargeService.calculateDistance(
                    location.coordinates[1], location.coordinates[0], pos.lat, pos.lng
                );
                matchedDistanceKm = matchedDistanceKm === null ? null : Math.round(matchedDistanceKm * 10) / 10;
                matchedEtaMinutes = Assignment.etaFromDistance(matchedDistanceKm, config.etaSpeedKmph);
            }
            status = 'PARTNER_SELECTED';
        }

        const quote = Pricing.estimate({ service, rate, quantity: qty });

        const job = await InstaJob.create({
            jobCode: makeJobCode(),
            customerId: req.user._id,
            providerId: assignedProviderId,
            supplyModel,
            serviceId: service._id,
            serviceName: service.name,
            pricingType: service.pricingType,
            unitLabel: Pricing.UNIT_LABELS[service.pricingType],
            rate,
            baseCharge: service.baseCharge,
            baseChargeEnabled: service.baseChargeEnabled,
            bookedQuantity: qty,
            estimateAmount: quote.subtotal,
            billBreakdown: quote.breakdown,
            isTimed: quote.timed,
            billingIntervalMinutes: config.billingIntervalMinutes,
            idleChargePerMinute: config.idleChargePerMinute,
            address,
            location: location || { type: 'Point', coordinates: [0, 0] },
            city: city || '',
            matchedDistanceKm,
            matchedEtaMinutes,
            status,
            statusHistory: [{ status, at: new Date(), by: 'customer', note: 'Job created' }],
            paymentMode: paymentMode === 'online' ? 'online' : 'cash'
        });

        // Claiming the worker.
        //
        // Matching counted this worker's active jobs and then assigned them, with
        // nothing between the two — so two customers booking at the same instant
        // could both be told they had the same person. There is no conditional
        // insert to lean on, so the race is settled after the fact and by age:
        // each job asks how many active jobs that worker already had before it,
        // and only the ones inside the limit keep them. That is deterministic —
        // the earlier job always wins, so two racers never both stand down.
        if (assignedProviderId) {
            const aheadOfThis = await InstaJob.countDocuments({
                providerId: assignedProviderId,
                status: { $in: InstaJob.OCCUPIES_WORKER },
                _id: { $ne: job._id },
                createdAt: { $lte: job.createdAt }
            });

            if (aheadOfThis >= Math.max(1, Number(config.maxConcurrentJobs) || 1)) {
                job.providerId = null;
                job.pushStatus('CANCELLED', 'system',
                    'Another customer reached this worker first');
                job.cancelledBy = 'system';
                job.cancellationReason = 'Worker was taken at the same moment';
                await job.save();

                return res.status(409).json({
                    message: `That worker was booked a moment before you. Please try again.`,
                    code: 'WORKER_JUST_TAKEN'
                });
            }
        }

        notify(
            assignedProviderId, 'provider',
            '⚡ New Insta Work job',
            `${service.name} — ${qty} ${Pricing.UNIT_LABELS[service.pricingType]}${qty === 1 ? '' : 's'} at ${address}. Accept now.`
        );
        emitJob(job, 'INSTA_JOB_CREATED', { estimateAmount: job.estimateAmount, serviceName: job.serviceName });

        res.status(201).json({ job });
    } catch (error) {
        console.error('[InstaWork] createJob failed:', error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    The customer's own jobs
// @route   GET /api/insta/jobs
// @access  Private (Customer)
const getMyJobs = async (req, res) => {
    try {
        const jobs = await InstaJob.find({ customerId: req.user._id })
            .populate('providerId', 'ownerName shopName mobile profileImage rating')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json({ jobs });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Marks a pending extension the customer never answered as expired.
 * Mirrors the provider-side helper so both ends agree on what is still live.
 */
const expireStaleExtensions = (job, responseMinutes = 10) => {
    const cutoff = Date.now() - Math.max(1, Number(responseMinutes) || 10) * 60000;
    let changed = false;
    for (const ext of job.extensions || []) {
        if (ext.status === 'pending' && new Date(ext.requestedAt).getTime() < cutoff) {
            ext.status = 'expired';
            changed = true;
        }
    }
    return changed;
};

/** Loads a job and checks the caller owns it. */
const loadOwnedJob = async (req, res) => {
    const job = await InstaJob.findById(req.params.id);
    if (!job) {
        res.status(404).json({ message: 'Job not found.' });
        return null;
    }
    if (String(job.customerId) !== String(req.user._id)) {
        res.status(403).json({ message: 'Not authorized for this job.' });
        return null;
    }
    return job;
};

// @desc    One job, with its live timer state
// @route   GET /api/insta/jobs/:id
// @access  Private (Customer)
const getJob = async (req, res) => {
    try {
        const job = await loadOwnedJob(req, res);
        if (!job) return;

        const populated = await InstaJob.findById(job._id)
            .populate('providerId', 'ownerName shopName mobile profileImage rating instaWork.lastPing')
            .lean();

        // Live counters the tracking screen needs, computed rather than stored
        // so they are correct between polls.
        const liveWorkedMinutes = job.workStartedAt && !job.workCompletedAt
            ? Pricing.minutesBetween(job.workStartedAt)
            : job.workedMinutes;

        const config = await InstaConfig.getConfig();
        if (expireStaleExtensions(job, config.extensionResponseMinutes)) await job.save();

        const liveIdleMinutes = job.status === 'ARRIVED'
            ? Pricing.chargeableIdleMinutes({
                arrivedAt: job.arrivedAt,
                workStartedAt: null,
                graceMinutes: config.arrivalGraceMinutes
            })
            : job.idleMinutes;

        res.json({
            job: populated,
            live: {
                workedMinutes: liveWorkedMinutes,
                idleMinutes: liveIdleMinutes,
                graceMinutes: config.arrivalGraceMinutes,
                pendingExtension: job.extensions.find(e => e.status === 'pending') || null
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve or reject a duration extension
// @route   PATCH /api/insta/jobs/:id/extension
// @access  Private (Customer)
const respondToExtension = async (req, res) => {
    try {
        const job = await loadOwnedJob(req, res);
        if (!job) return;

        const { approve } = req.body;
        const cfg = await InstaConfig.getConfig();
        // An request the customer sat on is no longer theirs to approve.
        if (expireStaleExtensions(job, cfg.extensionResponseMinutes)) await job.save();

        const pending = job.extensions.find(e => e.status === 'pending');
        if (!pending) {
            return res.status(400).json({
                message: 'There is no extension request awaiting your response. It may have expired.'
            });
        }

        pending.status = approve ? 'approved' : 'rejected';
        pending.respondedAt = new Date();

        if (approve) {
            job.approvedExtraMinutes = (job.approvedExtraMinutes || 0) + pending.requestedMinutes;
            job.statusHistory.push({
                status: job.status, at: new Date(), by: 'customer',
                note: `Approved ${pending.requestedMinutes} min extension`
            });
        } else {
            job.statusHistory.push({
                status: job.status, at: new Date(), by: 'customer',
                note: 'Declined duration extension'
            });
        }
        await job.save();

        notify(
            job.providerId, 'provider',
            approve ? 'Extension approved' : 'Extension declined',
            approve
                ? `The customer approved ${pending.requestedMinutes} more minutes on ${job.jobCode}.`
                : `The customer declined more time on ${job.jobCode}. Please wrap up and stop the timer.`
        );
        emitJob(job, 'INSTA_EXTENSION_RESPONSE', { approved: !!approve, minutes: pending.requestedMinutes });

        res.json({ job });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Customer confirms the work is done, accepting the final bill
// @route   PATCH /api/insta/jobs/:id/confirm
// @access  Private (Customer)
const confirmWork = async (req, res) => {
    try {
        const job = await loadOwnedJob(req, res);
        if (!job) return;

        if (job.status !== 'WORK_COMPLETED') {
            return res.status(400).json({ message: 'This job is not awaiting your confirmation yet.' });
        }

        job.pushStatus('CUSTOMER_CONFIRMED', 'customer', 'Customer confirmed the work');
        await job.save();

        notify(job.providerId, 'provider', 'Work confirmed',
            `The customer confirmed ${job.jobCode}. Final bill ₹${job.finalAmount}.`);
        emitJob(job, 'INSTA_WORK_CONFIRMED', { finalAmount: job.finalAmount });

        res.json({ job });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Raise a gateway order for this job's final amount
// @route   POST /api/insta/jobs/:id/payment-order
// @access  Private (Customer)
const createPaymentOrder = async (req, res) => {
    try {
        const job = await loadOwnedJob(req, res);
        if (!job) return;

        if (job.paymentMode !== 'online') {
            return res.status(400).json({ message: 'This job is being paid in cash.' });
        }
        if (job.status !== 'CUSTOMER_CONFIRMED') {
            return res.status(400).json({ message: 'Confirm the work before paying.' });
        }
        if (job.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'This job has already been paid.' });
        }
        if (!(Number(job.finalAmount) > 0)) {
            return res.status(400).json({ message: 'This job has no amount to pay.' });
        }

        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        // The amount comes from the job, never from the request. A client that
        // could name its own amount could pay ₹1 for a ₹400 job.
        const order = await razorpay.orders.create({
            amount: Math.round(Number(job.finalAmount) * 100),
            currency: 'INR',
            receipt: `insta_${job.jobCode}`
        });

        job.razorpayOrderId = order.id;
        await job.save();

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            jobCode: job.jobCode
        });
    } catch (error) {
        console.error('[InstaWork] createPaymentOrder failed:', error);
        res.status(500).json({ message: error.message || 'Could not start the payment.' });
    }
};

// @desc    Record payment and settle the job
// @route   PATCH /api/insta/jobs/:id/pay
// @access  Private (Customer)
const payJob = async (req, res) => {
    try {
        const job = await loadOwnedJob(req, res);
        if (!job) return;

        if (job.status !== 'CUSTOMER_CONFIRMED') {
            return res.status(400).json({ message: 'Confirm the work before paying.' });
        }
        if (job.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'This job has already been paid.' });
        }

        // A job that ended up costing nothing has nothing to collect, and no
        // gateway order can be raised for zero. Without this it would sit in
        // CUSTOMER_CONFIRMED forever, unable to move in either direction.
        const nothingToPay = !(Number(job.finalAmount) > 0);

        if (job.paymentMode === 'online' && !nothingToPay) {
            // Cash is confirmed by the two people standing in the room. An
            // online payment has no such witness, so it needs gateway proof —
            // and proof that is bound to THIS job, not merely a valid-looking
            // signature for some other order.
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                return res.status(400).json({ message: 'Payment details are missing.' });
            }
            if (!job.razorpayOrderId) {
                return res.status(400).json({ message: 'Start the payment before confirming it.' });
            }
            if (razorpay_order_id !== job.razorpayOrderId) {
                return res.status(400).json({
                    message: 'This payment belongs to a different order.',
                    code: 'ORDER_MISMATCH'
                });
            }

            const crypto = require('crypto');
            const expected = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                .digest('hex');
            if (expected !== razorpay_signature) {
                return res.status(400).json({ message: 'Payment verification failed.', code: 'BAD_SIGNATURE' });
            }

            // A unique index on razorpayPaymentId is what actually stops a
            // captured payment being replayed against a second job; this check
            // just turns the resulting write error into a clear message.
            const replay = await InstaJob.findOne({ razorpayPaymentId: razorpay_payment_id }).select('_id').lean();
            if (replay) {
                return res.status(409).json({ message: 'This payment has already been used.', code: 'PAYMENT_REUSED' });
            }
            job.razorpayPaymentId = razorpay_payment_id;
        }

        job.paymentStatus = 'paid';
        job.paidAt = new Date();
        job.pushStatus('PAYMENT_COMPLETED', 'customer', `Paid ₹${job.finalAmount} by ${job.paymentMode}`);

        // Settlement runs after the job is marked paid and never throws, so a
        // commission problem cannot undo a payment the customer actually made.
        const result = await Settlement.settle(job);
        job.pushStatus('CLOSED', 'system', result.ok ? 'Settled' : `Settlement deferred: ${result.reason}`);
        await job.save();

        notify(job.providerId, 'provider', 'Insta Work payment received',
            `₹${job.finalAmount} settled for ${job.jobCode}.`);
        emitJob(job, 'INSTA_JOB_CLOSED', { finalAmount: job.finalAmount });

        res.json({ job, settled: result.ok });
    } catch (error) {
        console.error('[InstaWork] payJob failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel a job, applying the stage-appropriate fee
// @route   PATCH /api/insta/jobs/:id/cancel
// @access  Private (Customer)
const cancelJob = async (req, res) => {
    try {
        const job = await loadOwnedJob(req, res);
        if (!job) return;

        if (['PAYMENT_COMPLETED', 'CLOSED', 'CANCELLED'].includes(job.status)) {
            return res.status(400).json({ message: 'This job can no longer be cancelled.' });
        }
        // Once the work is done there is nothing left to cancel — only a bill to
        // settle. Allowing it here let a customer watch the job finish and then
        // walk away from paying, leaving the worker with nothing for work they
        // genuinely did. A disputed bill is a support matter, not a cancellation.
        if (['WORK_COMPLETED', 'CUSTOMER_CONFIRMED'].includes(job.status)) {
            return res.status(400).json({
                message: 'This job is already complete. Please pay the bill, or contact support if something is wrong.',
                code: 'WORK_ALREADY_DONE'
            });
        }

        const config = await InstaConfig.getConfig();
        const stage = job.cancellationStageNow();
        const fee = Number(config.cancellationFees[stage]) || 0;

        // A job being cancelled may itself have been carrying someone
        // else's fee. Hand those back to pending, or a customer could
        // clear a debt by cancelling the job that was collecting it.
        const releasedCount = await CancellationFees.release(job);

        job.cancellationStage = stage;
        job.cancellationFee = fee;
        // Post-paid work has no payment method to charge at this moment, so
        // the fee waits here and joins this customer's next bill.
        job.cancellationFeeStatus = fee > 0 ? 'pending' : 'none';
        job.recoveredFees = [];
        job.recoveredFeeTotal = 0;
        job.cancelledBy = 'customer';
        job.cancellationReason = req.body.reason || '';
        job.pushStatus('CANCELLED', 'customer', `Cancelled at stage "${stage}", fee ₹${fee}`);
        await job.save();

        if (job.providerId) {
            notify(job.providerId, 'provider', 'Insta Work job cancelled',
                `The customer cancelled ${job.jobCode}.`);
        }
        emitJob(job, 'INSTA_JOB_CANCELLED', { cancellationFee: fee, stage });

        res.json({
            job,
            cancellationFee: fee,
            releasedFees: releasedCount,
            message: fee > 0
                ? `Job cancelled. A cancellation fee of ₹${fee} will be added to your next booking.`
                : 'Job cancelled. No cancellation fee applies.'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Pick a different Partner after the first one declined
// @route   PATCH /api/insta/jobs/:id/select-partner
// @access  Private (Customer)
const selectPartner = async (req, res) => {
    try {
        const job = await loadOwnedJob(req, res);
        if (!job) return;

        // Only a job that lost its Partner is re-selectable. Without this the
        // customer was left staring at a job in REQUESTED with no way forward.
        if (job.supplyModel !== 'partner' || job.providerId || job.status !== 'REQUESTED') {
            return res.status(400).json({ message: 'This job is not awaiting a new Partner.' });
        }

        const config = await InstaConfig.getConfig();
        const service = await InstaService.findById(job.serviceId);
        if (!service || !service.isActive) {
            return res.status(404).json({ message: 'This service is no longer available.' });
        }

        const partner = await Provider.findById(req.body.providerId);
        if (!partner) return res.status(404).json({ message: 'Selected Partner not found.' });
        if (job.rejectedProviders.some(id => String(id) === String(partner._id))) {
            return res.status(400).json({ message: 'That Partner has already declined this job.' });
        }

        const entry = (partner.instaWork?.services || [])
            .find(s => String(s.serviceId) === String(service._id));
        if (!partner.instaWork?.enabled || !entry) {
            return res.status(409).json({ message: 'That Partner is no longer available for this service.' });
        }
        if (!Assignment.hasFreshPing(partner, config.pingFreshnessMinutes)) {
            return res.status(409).json({ message: 'That Partner has just gone offline. Please choose another.' });
        }

        // Re-validated against the guardrail rather than trusted.
        job.rate = Pricing.resolveProviderRate({
            service, providerCategory: 'partner', requestedRate: entry.rate
        });
        job.providerId = partner._id;

        // The estimate moves with the rate, so it is recomputed rather than
        // left showing the declined Partner's price.
        const quote = Pricing.estimate({ service, rate: job.rate, quantity: job.bookedQuantity });
        job.estimateAmount = quote.subtotal;
        job.billBreakdown = quote.breakdown;

        job.pushStatus('PARTNER_SELECTED', 'customer', 'Customer chose a replacement Partner');
        await job.save();

        notify(partner._id, 'provider', '⚡ New Insta Work job',
            `${job.serviceName} at ${job.address}. Accept now.`);
        emitJob(job, 'INSTA_PARTNER_RESELECTED');

        res.json({ job });
    } catch (error) {
        console.error('[InstaWork] selectPartner failed:', error);
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getServices,
    selectPartner,
    createPaymentOrder,
    getQuote,
    getAvailablePartners,
    createJob,
    getMyJobs,
    getJob,
    respondToExtension,
    confirmWork,
    payJob,
    cancelJob
};
