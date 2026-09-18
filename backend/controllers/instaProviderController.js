const CancellationFees = require('../services/InstaCancellationFeeService');
const InstaService = require('../models/InstaService');
const InstaJob = require('../models/InstaJob');
const Provider = require('../models/Provider');
const InstaConfig = require('../services/InstaConfigService');
const Pricing = require('../services/InstaPricingService');

const notify = (userId, userRole, title, message) => {
    try {
        const { notifyUser } = require('../config/notificationService');
        notifyUser({ userId, userRole, title, message, type: 'booking' })
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

/**
 * Strips fields a worker must never see from a job before it is returned.
 *
 * `startOTP` is the customer's proof that the worker is actually standing in
 * front of them. Returning it on the worker's own endpoints would let them read
 * it from the API and start the timer without the customer present, which
 * defeats the entire purpose of the check.
 */
const forWorker = (job) => {
    const plain = job && typeof job.toObject === 'function' ? job.toObject() : { ...(job || {}) };
    delete plain.startOTP;
    return plain;
};

/**
 * Marks any pending extension the customer never answered as expired.
 *
 * Without this a single unanswered request blocks every future one for the
 * life of the job, because only one may be pending at a time. Applied lazily
 * wherever extensions are read or written, so it is correct between cron runs.
 * The caller saves the document.
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

/** Loads a job and checks it belongs to the calling worker. */
const loadOwnJob = async (req, res) => {
    const job = await InstaJob.findById(req.params.id);
    if (!job) {
        res.status(404).json({ message: 'Job not found.' });
        return null;
    }
    if (String(job.providerId) !== String(req.user._id)) {
        res.status(403).json({ message: 'Not authorized for this job.' });
        return null;
    }
    return job;
};

// @desc    The worker's Insta Work settings and the services they may offer
// @route   GET /api/insta/provider/profile
// @access  Private (Provider / Sewak)
const getInstaProfile = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: 'Provider not found.' });

        const category = provider.providerCategory === 'sewak' ? 'sewak' : 'partner';
        const config = await InstaConfig.getConfig();

        const services = await InstaService.find({
            isActive: true,
            availableFor: category
        }).sort({ name: 1 }).lean();

        const selected = new Map(
            (provider.instaWork?.services || []).map(s => [String(s.serviceId), s])
        );

        res.json({
            enabled: !!provider.instaWork?.enabled,
            providerCategory: category,
            // A Sewak's rate is admin-fixed, so their app must not offer a rate field.
            canSetRate: category === 'partner',
            canSetHours: category === 'partner',
            workingHours: provider.instaWork?.workingHours || { start: '', end: '' },
            lastPingAt: provider.instaWork?.lastPingAt || null,
            restrictedUntil: provider.instaWork?.restrictedUntil || null,
            disabledByAdmin: !!provider.instaWork?.disabledByAdmin,
            pingFreshnessMinutes: config.pingFreshnessMinutes,
            services: services.map(s => {
                const chosen = selected.get(String(s._id));
                return {
                    _id: s._id,
                    name: s.name,
                    icon: s.icon,
                    pricingType: s.pricingType,
                    unitLabel: Pricing.UNIT_LABELS[s.pricingType],
                    selected: !!chosen,
                    // What the worker will be paid at: fixed for Sewak, their own
                    // (or the floor, as a starting point) for a Partner.
                    rate: chosen ? chosen.rate : (category === 'sewak' ? s.sewakRate : s.minRate),
                    fixedRate: category === 'sewak' ? s.sewakRate : null,
                    minRate: s.minRate,
                    maxRate: s.maxRate
                };
            })
        });
    } catch (error) {
        console.error('[InstaWork] getInstaProfile failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Turn Insta Work on or off
// @route   PATCH /api/insta/provider/toggle
// @access  Private (Provider / Sewak)
const toggleInstaWork = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: 'Provider not found.' });

        const next = req.body.enabled !== undefined ? Boolean(req.body.enabled) : !provider.instaWork?.enabled;

        if (next) {
            // Admin bars and temporary restrictions both block switching on.
            if (provider.instaWork?.disabledByAdmin) {
                return res.status(403).json({ message: 'Insta Work has been disabled on your account. Please contact support.' });
            }
            if (provider.instaWork?.restrictedUntil && new Date(provider.instaWork.restrictedUntil) > new Date()) {
                const until = new Date(provider.instaWork.restrictedUntil).toLocaleString('en-IN');
                return res.status(403).json({ message: `Insta Work is temporarily restricted on your account until ${until}.` });
            }
            if (!(provider.instaWork?.services || []).length) {
                return res.status(400).json({ message: 'Select at least one service before going live.' });
            }
        }

        provider.instaWork.enabled = next;
        await provider.save();

        res.json({
            enabled: provider.instaWork.enabled,
            message: next
                ? 'You are live for Insta Work. Keep the app open so your location keeps updating.'
                : 'You are offline for Insta Work.'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Choose services and (for Partners) rates
// @route   PUT /api/insta/provider/services
// @access  Private (Provider / Sewak)
const setInstaServices = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: 'Provider not found.' });

        const category = provider.providerCategory === 'sewak' ? 'sewak' : 'partner';
        const incoming = Array.isArray(req.body.services) ? req.body.services : [];

        const resolved = [];
        for (const item of incoming) {
            const service = await InstaService.findById(item.serviceId);
            if (!service || !service.isActive) continue;
            if (!service.availableFor.includes(category)) continue;

            // The guardrail is enforced here, at the point the worker saves a
            // rate — not at checkout. A Sewak's requested rate is ignored
            // entirely in favour of the admin's figure.
            const rate = Pricing.resolveProviderRate({
                service,
                providerCategory: category,
                requestedRate: item.rate
            });

            resolved.push({ serviceId: service._id, serviceName: service.name, rate });
        }

        provider.instaWork.services = resolved;
        // Selecting nothing necessarily takes the worker offline.
        if (resolved.length === 0) provider.instaWork.enabled = false;
        await provider.save();

        res.json({ services: provider.instaWork.services, enabled: provider.instaWork.enabled });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Set working hours (Partners only)
// @route   PUT /api/insta/provider/hours
// @access  Private (Partner)
const setWorkingHours = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: 'Provider not found.' });
        if (provider.providerCategory === 'sewak') {
            return res.status(403).json({ message: 'Sewak working hours are managed by RozSewa.' });
        }

        const { start, end } = req.body;
        const valid = (v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
        if (!valid(start) || !valid(end)) {
            return res.status(400).json({ message: 'Enter times as HH:MM, for example 09:00.' });
        }

        provider.instaWork.workingHours = { start: start || '', end: end || '' };
        await provider.save();
        res.json({ workingHours: provider.instaWork.workingHours });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Real-time GPS ping while Insta Work is on
// @route   POST /api/insta/provider/ping
// @access  Private (Provider / Sewak)
const pingLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const latitude = Number(lat);
        const longitude = Number(lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return res.status(400).json({ message: 'Valid coordinates are required.' });
        }

        // A targeted update rather than a full document save: this endpoint is
        // called every few seconds by every live worker.
        await Provider.updateOne(
            { _id: req.user._id },
            {
                $set: {
                    'instaWork.lastPingAt': new Date(),
                    'instaWork.lastPing': { type: 'Point', coordinates: [longitude, latitude] },
                    // Keep the profile location current too, so matching still
                    // works from a slightly stale position.
                    location: { type: 'Point', coordinates: [longitude, latitude] }
                }
            }
        );

        res.json({ ok: true, at: new Date() });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    The worker's Insta jobs
// @route   GET /api/insta/provider/jobs
// @access  Private (Provider / Sewak)
const getProviderJobs = async (req, res) => {
    try {
        const jobs = await InstaJob.find({ providerId: req.user._id })
            .populate('customerId', 'name mobile')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json({ jobs: jobs.map(forWorker) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Accept an offered job
// @route   PATCH /api/insta/provider/jobs/:id/accept
// @access  Private (Provider / Sewak)
const acceptJob = async (req, res) => {
    try {
        const job = await loadOwnJob(req, res);
        if (!job) return;
        if (!['ASSIGNED', 'PARTNER_SELECTED'].includes(job.status)) {
            return res.status(400).json({ message: `This job cannot be accepted from status ${job.status}.` });
        }

        job.pushStatus('ACCEPTED', 'provider', 'Worker accepted the job');
        await job.save();

        notify(job.customerId, 'user', 'Worker on the way soon',
            `Your ${job.serviceName} job ${job.jobCode} has been accepted.`);
        emitJob(job, 'INSTA_JOB_ACCEPTED');
        res.json({ job: forWorker(job) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Decline an offered job, returning it for re-matching
// @route   PATCH /api/insta/provider/jobs/:id/reject
// @access  Private (Provider / Sewak)
const rejectJob = async (req, res) => {
    try {
        const job = await loadOwnJob(req, res);
        if (!job) return;
        if (!['ASSIGNED', 'PARTNER_SELECTED'].includes(job.status)) {
            return res.status(400).json({ message: 'This job can no longer be declined.' });
        }

        job.rejectedProviders.push(req.user._id);
        const config = await InstaConfig.getConfig();

        if (job.supplyModel === 'sewak') {
            // Managed supply re-matches automatically; the customer should not
            // have to do anything because one worker said no.
            const Assignment = require('../services/InstaAssignmentService');
            const service = await InstaService.findById(job.serviceId);
            const next = await Assignment.autoAssignSewak({
                service,
                location: job.location,
                config,
                excludeIds: job.rejectedProviders
            });

            // Matching filtered on capacity a moment ago, but two workers
            // declining at the same instant could still both be handed on to the
            // same next person. The claim is what settles it.
            if (next) {
                job.matchedDistanceKm = next.distanceKm;
                job.matchedEtaMinutes = next.etaMinutes;

                const claim = await Assignment.claimWorker({ job, providerId: next.providerId, config });
                if (claim.ok) {
                    job.pushStatus('ASSIGNED', 'system', 'Re-assigned after decline');
                    await job.save();
                    notify(next.providerId, 'provider', '⚡ New Insta Work job',
                        `${job.serviceName} at ${job.address}. Accept now.`);
                    emitJob(job, 'INSTA_JOB_REASSIGNED');
                    return res.json({ job: forWorker(job), reassigned: true });
                }
                // Lost the claim — fall through to waiting rather than pretending
                // this job has someone.
            }

            job.providerId = null;
            job.pushStatus('MATCHING', 'system', 'No other Sewak available');
            await job.save();
            notify(job.customerId, 'user', 'Still finding a Sewak',
                `We are still looking for someone for ${job.jobCode}.`);
            return res.json({ job: forWorker(job), reassigned: false });
        }

        // Open supply: the customer chose this Partner, so the choice returns
        // to them rather than the system silently picking someone else.
        job.providerId = null;
        job.pushStatus('REQUESTED', 'provider', 'Partner declined; awaiting a new selection');
        await job.save();
        notify(job.customerId, 'user', 'Partner unavailable',
            `Your chosen Partner could not take ${job.jobCode}. Please pick another.`);
        emitJob(job, 'INSTA_PARTNER_DECLINED');
        res.json({ job: forWorker(job), reassigned: false });
    } catch (error) {
        console.error('[InstaWork] rejectJob failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark travelling to site
// @route   PATCH /api/insta/provider/jobs/:id/on-the-way
// @access  Private (Provider / Sewak)
const markOnTheWay = async (req, res) => {
    try {
        const job = await loadOwnJob(req, res);
        if (!job) return;
        if (job.status !== 'ACCEPTED') {
            return res.status(400).json({ message: 'Accept the job before starting your journey.' });
        }

        job.pushStatus('ON_THE_WAY', 'provider', 'Worker is travelling to site');
        await job.save();

        notify(job.customerId, 'user', 'Worker on the way',
            `Your worker is heading to you for ${job.jobCode}.`);
        emitJob(job, 'INSTA_ON_THE_WAY');
        res.json({ job: forWorker(job) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark arrival — this starts the free grace period
// @route   PATCH /api/insta/provider/jobs/:id/arrived
// @access  Private (Provider / Sewak)
const markArrived = async (req, res) => {
    try {
        const job = await loadOwnJob(req, res);
        if (!job) return;
        if (!['ACCEPTED', 'ON_THE_WAY'].includes(job.status)) {
            return res.status(400).json({ message: 'You cannot mark arrival from this status.' });
        }

        const config = await InstaConfig.getConfig();
        job.arrivedAt = new Date();
        // The start OTP is generated on arrival and given to the customer, so
        // work can only begin with the customer physically present.
        job.startOTP = String(Math.floor(1000 + Math.random() * 9000));
        job.pushStatus('ARRIVED', 'provider', 'Worker arrived at site');
        await job.save();

        notify(job.customerId, 'user', 'Your worker has arrived',
            `Share OTP ${job.startOTP} to start work on ${job.jobCode}. Free waiting time: ${config.arrivalGraceMinutes} minutes.`);
        emitJob(job, 'INSTA_ARRIVED', { graceMinutes: config.arrivalGraceMinutes });

        res.json({
            job: forWorker(job),
            // Never returned to the worker — it is the customer's to give.
            message: `Arrival recorded. Ask the customer for their start OTP. Waiting charges begin after ${config.arrivalGraceMinutes} minutes.`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Start work by verifying the customer's OTP; starts the timer
// @route   PATCH /api/insta/provider/jobs/:id/start
// @access  Private (Provider / Sewak)
const startWork = async (req, res) => {
    try {
        const job = await loadOwnJob(req, res);
        if (!job) return;
        if (job.status !== 'ARRIVED') {
            return res.status(400).json({ message: 'Mark your arrival before starting work.' });
        }
        if (!job.startOTP || String(req.body.otp || '').trim() !== job.startOTP) {
            return res.status(400).json({ message: 'Incorrect OTP. Please ask the customer again.' });
        }

        const config = await InstaConfig.getConfig();

        // Waiting time is frozen at the moment work starts, so the charge
        // reflects how long the worker actually waited, not how long the job ran.
        job.idleMinutes = Pricing.chargeableIdleMinutes({
            arrivedAt: job.arrivedAt,
            workStartedAt: new Date(),
            graceMinutes: config.arrivalGraceMinutes
        });
        job.idleChargePerMinute = config.idleChargePerMinute;
        job.idleAmount = Math.round(job.idleMinutes * config.idleChargePerMinute * 100) / 100;

        job.workStartedAt = new Date();
        job.billingIntervalMinutes = config.billingIntervalMinutes;
        job.pushStatus('WORK_STARTED', 'provider', 'OTP verified, timer started');
        await job.save();

        notify(job.customerId, 'user', 'Work started',
            `Work has started on ${job.jobCode}.${job.idleMinutes > 0 ? ` Waiting charge: ₹${job.idleAmount}.` : ''}`);
        emitJob(job, 'INSTA_WORK_STARTED', { workStartedAt: job.workStartedAt, idleMinutes: job.idleMinutes });

        res.json({ job: forWorker(job) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Ask the customer for more time
// @route   POST /api/insta/provider/jobs/:id/extension
// @access  Private (Provider / Sewak)
const requestExtension = async (req, res) => {
    try {
        const job = await loadOwnJob(req, res);
        if (!job) return;
        if (job.status !== 'WORK_STARTED') {
            return res.status(400).json({ message: 'Extensions can only be requested while work is running.' });
        }
        // Only hourly work has a clock to extend. On measured work the
        // request is meaningless, and asking the customer to approve more
        // minutes on a job billed by the unit is simply confusing.
        if (!job.isTimed) {
            return res.status(400).json({ message: 'This job is not billed by time, so it cannot be extended.' });
        }
        const config = await InstaConfig.getConfig();
        expireStaleExtensions(job, config.extensionResponseMinutes);
        if (job.extensions.some(e => e.status === 'pending')) {
            return res.status(400).json({ message: 'An extension request is already awaiting the customer.' });
        }

        const minutes = Math.max(1, Math.round(Number(req.body.minutes) || 30));
        job.extensions.push({ requestedMinutes: minutes, status: 'pending', note: req.body.note || '' });
        await job.save();

        notify(job.customerId, 'user', 'More time requested',
            `Your worker needs ${minutes} more minutes on ${job.jobCode}. Approve to let the work continue.`);
        emitJob(job, 'INSTA_EXTENSION_REQUESTED', { minutes });

        res.json({ job: forWorker(job) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Stop the timer and produce the final bill
// @route   PATCH /api/insta/provider/jobs/:id/stop
// @access  Private (Provider / Sewak)
const stopWork = async (req, res) => {
    try {
        const job = await loadOwnJob(req, res);
        if (!job) return;
        if (job.status !== 'WORK_STARTED') {
            return res.status(400).json({ message: 'There is no running timer on this job.' });
        }

        const config = await InstaConfig.getConfig();
        const service = await InstaService.findById(job.serviceId);
        if (!service) return res.status(404).json({ message: 'Service record missing for this job.' });

        job.workCompletedAt = new Date();
        job.workedMinutes = Pricing.minutesBetween(job.workStartedAt, job.workCompletedAt);

        // Time past the booked duration is only billable once the customer has
        // approved it. Without this cap the approval prompt is decorative: a
        // worker could run a one-hour job for five hours and bill all of it,
        // and declining an extension would change nothing.
        const cap = Pricing.billableMinutes({
            workedMinutes: job.workedMinutes,
            bookedMinutes: job.isTimed ? (job.bookedQuantity || 0) * 60 : 0,
            overrunThresholdMinutes: config.overrunThresholdMinutes,
            approvedExtraMinutes: job.approvedExtraMinutes || 0
        });
        if (job.isTimed) {
            job.authorisedMinutes = cap.authorisedMinutes;
            job.unbilledOverrunMinutes = cap.unbilledOverrunMinutes;
        }

        // Measured (non-hourly) work: the worker records what was actually done,
        // which may differ from what was booked.
        const actualQuantity = req.body.actualQuantity !== undefined
            ? Number(req.body.actualQuantity)
            : null;
        if (!job.isTimed && actualQuantity !== null) {
            if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
                return res.status(400).json({ message: 'Enter a valid completed quantity.' });
            }
            job.actualQuantity = actualQuantity;
        }

        // Custom work is quoted on site: there is no quantity to measure and
        // no admin rate to fall back on, so without the amount the worker
        // sets here the job has no price at all and settles at zero — the
        // whole pricing type was unbillable. Stored on the rate, because a
        // custom job is one unit priced at whatever the work was worth, and
        // every downstream figure already derives from quantity x rate.
        if (service.pricingType === 'custom') {
            try {
                job.rate = Pricing.resolveCustomAmount({
                    service,
                    amount: req.body.finalAmount ?? req.body.customAmount
                });
            } catch (err) {
                return res.status(400).json({ message: err.message });
            }
        }

        const bill = Pricing.finalBill({
            service,
            rate: job.rate,
            bookedQuantity: job.bookedQuantity,
            actualQuantity: job.actualQuantity,
            // Capped at what the customer authorised.
            workedMinutes: job.isTimed ? cap.billableMinutes : job.workedMinutes,
            billingIntervalMinutes: job.billingIntervalMinutes || config.billingIntervalMinutes,
            idleMinutes: job.idleMinutes,
            idleChargePerMinute: job.idleChargePerMinute,
            extraCharges: job.extraCharges
        });

        // Anything this customer still owes from an earlier cancellation is
        // added here, where they can see it before confirming and paying.
        // Claimed at bill time rather than at payment, so two bills raised
        // close together cannot both charge the same fee.
        const carried = await CancellationFees.claimFor(job);
        job.recoveredFees = carried.recovered;
        job.recoveredFeeTotal = carried.total;

        job.finalAmount = bill.subtotal + carried.total;
        job.billedMinutes = bill.billedMinutes || 0;
        job.billBreakdown = [
            ...bill.breakdown,
            ...carried.recovered.map(CancellationFees.breakdownLine)
        ];
        if (job.isTimed) job.actualQuantity = bill.quantity;

        job.pushStatus('WORK_COMPLETED', 'provider',
            `Timer stopped. Worked ${job.workedMinutes} min, billed ${bill.billedMinutes ?? '-'} min, total ₹${bill.subtotal}`
            + (cap.unbilledOverrunMinutes > 0
                ? ` (${cap.unbilledOverrunMinutes} min unapproved overrun not billed)`
                : ''));
        await job.save();

        notify(job.customerId, 'user', 'Work completed',
            `${job.serviceName} is done. Final bill ₹${job.finalAmount}. Please confirm and pay.`);
        emitJob(job, 'INSTA_WORK_COMPLETED', { finalAmount: job.finalAmount, breakdown: job.billBreakdown });

        res.json({ job: forWorker(job), bill });
    } catch (error) {
        console.error('[InstaWork] stopWork failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Worker cancels, which counts against their cancellation record
// @route   PATCH /api/insta/provider/jobs/:id/cancel
// @access  Private (Provider / Sewak)
const providerCancelJob = async (req, res) => {
    try {
        const job = await loadOwnJob(req, res);
        if (!job) return;
        if (['PAYMENT_COMPLETED', 'CLOSED', 'CANCELLED'].includes(job.status)) {
            return res.status(400).json({ message: 'This job can no longer be cancelled.' });
        }
        // The customer is stopped from cancelling once the work is done, so
        // that nobody can watch a job finish and then walk away from the bill.
        // The same has to hold on this side: cancelling here voided a bill for
        // work genuinely performed, losing the worker their money and the
        // platform its commission, and it was reachable by a mis-tap or by a
        // customer who offered to settle off the books. A finished job that
        // has gone wrong is a support matter, not a cancellation.
        if (['WORK_COMPLETED', 'CUSTOMER_CONFIRMED'].includes(job.status)) {
            return res.status(400).json({
                message: 'The work on this job is already finished. Contact support if something is wrong.',
                code: 'WORK_ALREADY_DONE'
            });
        }

        const config = await InstaConfig.getConfig();
        const provider = await Provider.findById(req.user._id);

        // The worker walking away must not clear the customer's carried
        // fees; they go back to pending for the next bill.
        await CancellationFees.release(job);
        job.recoveredFees = [];
        job.recoveredFeeTotal = 0;

        job.cancelledBy = 'provider';
        job.cancellationReason = req.body.reason || '';
        job.cancellationStage = job.cancellationStageNow();
        job.pushStatus('CANCELLED', 'provider', `Worker cancelled at stage "${job.cancellationStage}"`);
        await job.save();

        // Escalating consequences for repeated cancellation, per the spec.
        const policy = config.cancellationPolicy;
        provider.instaWork.cancelCount = (provider.instaWork.cancelCount || 0) + 1;
        const count = provider.instaWork.cancelCount;

        let consequence = null;
        if (count >= policy.disableAfter) {
            provider.instaWork.disabledByAdmin = true;
            provider.instaWork.enabled = false;
            consequence = 'Insta Work has been disabled on your account due to repeated cancellations.';
        } else if (count >= policy.restrictAfter) {
            provider.instaWork.restrictedUntil = new Date(Date.now() + policy.restrictionHours * 3600000);
            provider.instaWork.enabled = false;
            consequence = `Insta Work is restricted on your account for ${policy.restrictionHours} hours.`;
        } else if (count >= policy.warnAfter) {
            consequence = 'Warning: repeated cancellations may restrict your access to Insta Work.';
        }
        await provider.save();

        notify(job.customerId, 'user', 'Worker cancelled',
            `Your worker cancelled ${job.jobCode}. Please book again.`);
        if (consequence) notify(req.user._id, 'provider', 'Insta Work cancellation notice', consequence);
        emitJob(job, 'INSTA_JOB_CANCELLED', { by: 'provider' });

        res.json({ job: forWorker(job), cancelCount: count, consequence });
    } catch (error) {
        console.error('[InstaWork] providerCancelJob failed:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getInstaProfile,
    toggleInstaWork,
    setInstaServices,
    setWorkingHours,
    pingLocation,
    getProviderJobs,
    acceptJob,
    rejectJob,
    markOnTheWay,
    markArrived,
    startWork,
    requestExtension,
    stopWork,
    providerCancelJob
};
