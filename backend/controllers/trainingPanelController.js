const mongoose = require('mongoose');
const TrainingRecord = require('../models/TrainingRecord');
const Provider = require('../models/Provider');
const StarterKitItem = require('../models/StarterKitItem');
const KitOrder = require('../models/KitOrder');
const Setting = require('../models/Setting');
const AuditLog = require('../models/AuditLog');

const DEFAULT_TOPICS = [
    { key: 'customer_talk', label: 'Customer se kaise baat karni hai' },
    { key: 'customer_behaviour', label: 'Customer ke saath kaise behave karna hai' },
    { key: 'service_delivery', label: 'Service kaise karni hai' },
    { key: 'app_usage', label: 'App kaise use karna hai' },
    { key: 'service_rules', label: 'Basic service rules' },
    { key: 'safety', label: 'Safety instructions' },
    { key: 'service_quality', label: 'Customer ko service properly kaise deni hai' }
];

const getTopics = async () => {
    const setting = await Setting.findOne({ key: 'training_panel_topics' }).lean();
    const list = Array.isArray(setting?.value) && setting.value.length ? setting.value : DEFAULT_TOPICS;
    return list.map(t => ({ key: t.key, label: t.label, covered: false, coveredAt: null }));
};

/** Mask an identity number down to its last 4 digits. */
const maskNumber = (v) => {
    if (!v || typeof v !== 'string') return '';
    const s = v.trim();
    if (s.length <= 4) return '••••';
    return `${'•'.repeat(Math.max(4, s.length - 4))}${s.slice(-4)}`;
};

const logAudit = async (actor, { entityType, entityId, entityName, action, details, reason, ip }) => {
    try {
        await AuditLog.create({
            actionType: action,
            entityType,
            entityId,
            entityName,
            verifiedByModel: actor.model,
            verifiedBy: actor.id,
            verifiedByName: actor.name,
            verifiedByRole: actor.isAdmin ? 'admin' : 'trainer',
            details: details || {},
            reason: reason || '',
            ipAddress: ip || ''
        });
    } catch (err) {
        console.error('[TrainingPanel] audit log failed:', err.message);
    }
};

const notify = async (sewakId, title, message, recordId) => {
    try {
        const { notifyUser } = require('../config/notificationService');
        await notifyUser({
            userId: sewakId,
            userRole: 'provider',
            title,
            message,
            type: 'training',
            // notifyUser dedupes on data.bookingId || data.leadId || data.id
            data: { id: recordId ? recordId.toString() : '', recordId: recordId ? recordId.toString() : '' }
        });
    } catch (err) {
        console.error('[TrainingPanel] notification failed:', err.message);
    }
};

/**
 * A trainer may only touch Sewaks in their own centre's cities AND their own
 * taught categories. Admins are unrestricted.
 *
 * Sewak codes are sequential (RSSEW00001, 00002...), so without this an
 * enumeration attack would expose every Sewak's identity documents.
 */
const assertInScope = (actor, provider) => {
    if (actor.isAdmin) return;

    const trainer = actor.trainer;
    // vendorType arrives populated on some paths and as a raw id on others.
    const idOf = (v) => String(v && v._id ? v._id : v);

    const trainerCats = (trainer.categories || []).map(idOf);
    if (!trainerCats.includes(idOf(provider.vendorType))) {
        const e = new Error('This Sewak is not in a category you train');
        e.status = 403;
        throw e;
    }

    const centreCities = (trainer.trainingCenter?.cities || []).map(c => String(c).trim().toLowerCase());
    const sewakCity = String(provider.city || '').trim().toLowerCase();
    if (centreCities.length && !centreCities.includes(sewakCity)) {
        const e = new Error('This Sewak is not in a city your training centre serves');
        e.status = 403;
        throw e;
    }
};

/**
 * Build (or refresh) the item checklist from the category's active kit items.
 *
 * Refreshing only happens while the record is still open — once training is done,
 * the snapshot is frozen so a newly-added mandatory item can't retroactively
 * knock a live Sewak offline. See D8.
 */
const syncItemVerifications = async (record) => {
    if (record.status === 'training_done') return record;

    const items = await StarterKitItem.find({
        categoryId: record.categoryId,
        isActive: true
    }).lean();

    const existing = new Map((record.itemVerifications || []).map(v => [String(v.itemId), v]));

    record.itemVerifications = items.map(i => {
        const prev = existing.get(String(i._id));
        return {
            itemId: i._id,
            itemName: i.name,
            requiredQty: i.kitQuantity,
            isMandatory: i.isMandatory,
            // Preserve any tick already made.
            verified: prev ? prev.verified : false,
            verifiedAt: prev ? prev.verifiedAt : null,
            verifiedByModel: prev ? prev.verifiedByModel : null,
            verifiedBy: prev ? prev.verifiedBy : null
        };
    });

    return record;
};

/**
 * Has the Sewak passed the Skill Session for every service that requires one?
 *
 * "Test Pass" == a completed session, which markAttendance denormalises onto
 * Provider.skillCertifications. A no-show is a fail and does not count.
 * A Sewak with no gated services satisfies this vacuously.
 */
const checkSkillSessionGate = async (provider) => {
    const categoryId = provider.vendorType?._id || provider.vendorType;
    if (!categoryId) return { satisfied: true, pending: [], required: [] };

    const Category = require('../models/Category');
    const category = await Category.findById(categoryId).lean();
    const catalog = category?.services || [];

    const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
    const certified = new Set(
        (provider.skillCertifications || [])
            .filter(c => String(c.categoryId) === String(categoryId))
            .map(c => c.serviceKey)
    );

    const required = [];
    const pending = [];
    for (const name of (provider.subServices || [])) {
        const key = norm(name);
        const entry = catalog.find(s => norm(s.name) === key);
        const needsSession = !!entry?.skillSessionRequired && entry?.skillSessionActive !== false;
        if (!needsSession) continue;
        required.push(name);
        if (!certified.has(key)) pending.push(name);
    }

    return { satisfied: pending.length === 0, pending, required };
};

/**
 * The three gates that must all pass before a profile can go live:
 *   1. Skill Session passed for every gated service
 *   2. Every mandatory kit item physically verified
 *   3. Every basic-training topic covered
 */
const buildGates = async (record, provider) => {
    const skill = await checkSkillSessionGate(provider);
    const allMandatoryVerified = record.allMandatoryVerified();
    const allTopicsCovered = record.allTopicsCovered();

    return {
        skillSessionPassed: skill.satisfied,
        pendingSkillSessions: skill.pending,
        requiredSkillSessions: skill.required,
        allMandatoryVerified,
        missingMandatory: record.missingMandatory(),
        allTopicsCovered,
        canComplete: skill.satisfied && allMandatoryVerified && allTopicsCovered && !record.trainingCompleted
    };
};

/** Get or lazily create the record for a Sewak. */
const ensureRecord = async (provider) => {
    let record = await TrainingRecord.findOne({ sewakId: provider._id });
    if (!record) {
        record = new TrainingRecord({
            sewakId: provider._id,
            categoryId: provider.vendorType,
            status: 'pending',
            trainingTopics: await getTopics(),
            history: [{ action: 'record_created', byModel: 'System', byName: 'System', note: 'Created on first access' }]
        });
    }
    await syncItemVerifications(record);
    await record.save();
    return record;
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Sewak search
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Look up a Sewak by vendor code
// @route   GET /api/training-panel/search?code=RSSEW00016
// @access  Admin or Trainer
const searchSewak = async (req, res) => {
    try {
        const code = String(req.query.code || '').trim().toUpperCase();
        if (!code) return res.status(400).json({ message: 'Enter a Sewak code' });

        const provider = await Provider.findOne({ vendorCode: code })
            .populate('vendorType', 'name icon')
            .lean();

        if (!provider) return res.status(404).json({ message: 'No Sewak found with that code' });
        if (provider.providerCategory !== 'sewak') {
            return res.status(400).json({ message: 'That code belongs to a Partner, not a Sewak' });
        }

        assertInScope(req.actor, provider);

        const docs = (provider.documents || []).map(d => ({
            id: d.id,
            fileName: d.fileName,
            status: d.status,
            uploadedAt: d.uploadedAt,
            // The URL is deliberately withheld here — fetched via /view-document,
            // which writes an audit row. See D3.
            hasFile: !!d.url
        }));

        const byId = (id) => docs.find(d => d.id === id) || null;

        res.json({
            sewak: {
                _id: provider._id,
                name: provider.ownerName,
                vendorCode: provider.vendorCode,
                mobile: provider.mobile,
                city: provider.city,
                state: provider.state,
                address: provider.address,
                category: provider.vendorType?.name || '—',
                categoryId: provider.vendorType?._id || provider.vendorType,
                profileImage: provider.profileImage || '',
                subServices: provider.subServices || [],
                status: provider.status,
                kycVerified: provider.kycVerified,
                joinedDate: provider.joinedDate
            },
            documents: {
                aadhaarFront: byId('aadhaar_front'),
                aadhaarBack: byId('aadhaar_back'),
                pan: byId('pan'),
                police: byId('police'),
                liveVideo: byId('live_video'),
                others: docs.filter(d => !['aadhaar_front', 'aadhaar_back', 'pan', 'police', 'live_video'].includes(d.id))
            },
            // Numbers are masked; admins get the same masking in the panel by
            // default since they have unmasked access via the KYC screens already.
            identity: {
                aadhaarMasked: maskNumber(provider.kycAadhaar),
                panMasked: maskNumber(provider.kycPanNumber),
                policeVerification: provider.kycPoliceVerification
                    ? maskNumber(provider.kycPoliceVerification)
                    : null
            }
        });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// @desc    Reveal one document URL (audited)
// @route   POST /api/training-panel/:sewakId/view-document
// @access  Admin or Trainer
const viewDocument = async (req, res) => {
    try {
        const { docId } = req.body;
        const provider = await Provider.findById(req.params.sewakId).lean();
        if (!provider) return res.status(404).json({ message: 'Sewak not found' });

        assertInScope(req.actor, provider);

        const doc = (provider.documents || []).find(d => d.id === docId);
        if (!doc || !doc.url) return res.status(404).json({ message: 'Document not uploaded' });

        await logAudit(req.actor, {
            entityType: 'TRAINING_DOC_VIEW',
            entityId: provider._id,
            entityName: provider.ownerName,
            action: 'VIEW_DOCUMENT',
            details: { docId, vendorCode: provider.vendorCode },
            ip: req.ip
        });

        res.json({ url: doc.url, id: doc.id, status: doc.status });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// STEPS 2-5 — the record
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Full training record for a Sewak
// @route   GET /api/training-panel/:sewakId
// @access  Admin or Trainer
const getRecord = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.sewakId)
            .populate('vendorType', 'name')
            .lean();
        if (!provider) return res.status(404).json({ message: 'Sewak not found' });

        assertInScope(req.actor, provider);

        const providerDoc = await Provider.findById(req.params.sewakId);
        const record = await ensureRecord(providerDoc);

        // Order context per item — helps the trainer, but never auto-ticks (D4).
        const orders = await KitOrder.find({
            sewakId: provider._id,
            status: { $in: ['pending', 'confirmed', 'dispatched', 'delivered'] }
        }).select('lines status expectedDeliveryDate').lean();

        const orderByItem = new Map();
        for (const o of orders) {
            for (const l of (o.lines || [])) {
                const key = String(l.itemId);
                const prev = orderByItem.get(key);
                // Prefer the most progressed order for context.
                const rank = { pending: 0, confirmed: 1, dispatched: 2, delivered: 3 };
                if (!prev || (rank[o.status] ?? -1) > (rank[prev.status] ?? -1)) {
                    orderByItem.set(key, { status: o.status, expectedDeliveryDate: o.expectedDeliveryDate });
                }
            }
        }

        res.json({
            record: {
                ...record.toObject(),
                itemVerifications: record.itemVerifications.map(v => ({
                    ...(v.toObject ? v.toObject() : v),
                    orderContext: orderByItem.get(String(v.itemId)) || null
                }))
            },
            gates: await buildGates(record, providerDoc),
            sewak: {
                _id: provider._id,
                name: provider.ownerName,
                vendorCode: provider.vendorCode,
                mobile: provider.mobile,
                city: provider.city,
                category: provider.vendorType?.name || '—',
                profileImage: provider.profileImage || '',
                status: provider.status,
                kycVerified: provider.kycVerified
            }
        });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// @desc    Tick / untick one kit item  (STEP 2)
// @route   PUT /api/training-panel/:sewakId/verify-item
// @access  Admin or Trainer
const verifyItem = async (req, res) => {
    try {
        const { itemId, verified } = req.body;
        if (!itemId) return res.status(400).json({ message: 'itemId is required' });

        const provider = await Provider.findById(req.params.sewakId);
        if (!provider) return res.status(404).json({ message: 'Sewak not found' });
        assertInScope(req.actor, provider);

        const record = await ensureRecord(provider);
        if (record.status === 'training_done') {
            return res.status(400).json({ message: 'Training is already complete. Reopen the record to make changes.' });
        }

        const line = record.itemVerifications.find(v => String(v.itemId) === String(itemId));
        if (!line) return res.status(404).json({ message: 'That item is not part of this Sewak\'s checklist' });

        line.verified = !!verified;
        line.verifiedAt = verified ? new Date() : null;
        line.verifiedByModel = verified ? req.actor.model : null;
        line.verifiedBy = verified ? req.actor.id : null;

        if (record.status === 'pending') record.status = 'in_progress';
        // Clearing the last missing mandatory item lifts the hold automatically.
        if (record.status === 'on_hold_item_missing' && record.allMandatoryVerified()) {
            record.status = 'in_progress';
            record.holdReason = '';
        }

        record.history.push({
            action: verified ? 'item_verified' : 'item_unverified',
            byModel: req.actor.model,
            by: req.actor.id,
            byName: req.actor.name,
            note: line.itemName
        });

        await record.save();

        res.json({ record, gates: await buildGates(record, provider) });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// @desc    Put training on hold for a missing mandatory item  (STEP 3)
// @route   PUT /api/training-panel/:sewakId/hold
// @access  Admin or Trainer
const holdTraining = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.sewakId);
        if (!provider) return res.status(404).json({ message: 'Sewak not found' });
        assertInScope(req.actor, provider);

        const record = await ensureRecord(provider);
        if (record.status === 'training_done') {
            return res.status(400).json({ message: 'Training is already complete' });
        }

        const missing = record.missingMandatory();
        if (missing.length === 0) {
            return res.status(400).json({ message: 'No mandatory items are missing — nothing to hold for' });
        }

        record.status = 'on_hold_item_missing';
        record.holdReason = req.body.reason || `Missing mandatory item(s): ${missing.join(', ')}`;
        record.history.push({
            action: 'training_held',
            byModel: req.actor.model,
            by: req.actor.id,
            byName: req.actor.name,
            note: record.holdReason
        });
        await record.save();

        await notify(
            provider._id,
            'Training On Hold — Item Missing',
            `Your training is on hold because these items are missing: ${missing.join(', ')}. Order them from the Starter Kits section, then visit the centre again.`,
            record._id
        );

        res.json({ record, missingMandatory: missing });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// @desc    Tick / untick a training topic  (STEP 4)
// @route   PUT /api/training-panel/:sewakId/topic
// @access  Admin or Trainer
const setTopic = async (req, res) => {
    try {
        const { topicKey, covered } = req.body;
        if (!topicKey) return res.status(400).json({ message: 'topicKey is required' });

        const provider = await Provider.findById(req.params.sewakId);
        if (!provider) return res.status(404).json({ message: 'Sewak not found' });
        assertInScope(req.actor, provider);

        const record = await ensureRecord(provider);
        if (record.status === 'training_done') {
            return res.status(400).json({ message: 'Training is already complete. Reopen the record to make changes.' });
        }

        const topic = record.trainingTopics.find(t => t.key === topicKey);
        if (!topic) return res.status(404).json({ message: 'Unknown training topic' });

        topic.covered = !!covered;
        topic.coveredAt = covered ? new Date() : null;
        if (record.status === 'pending') record.status = 'in_progress';

        await record.save();

        res.json({ record, gates: await buildGates(record, provider) });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// @desc    Complete training and activate the profile  (STEP 5)
// @route   POST /api/training-panel/:sewakId/complete
// @access  Admin or Trainer
const completeTraining = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.sewakId);
        if (!provider) return res.status(404).json({ message: 'Sewak not found' });
        assertInScope(req.actor, provider);

        const record = await ensureRecord(provider);

        if (record.trainingCompleted) {
            return res.status(400).json({ message: 'Training is already complete for this Sewak' });
        }
        if (!provider.kycVerified) {
            return res.status(400).json({ message: 'KYC must be approved before training can be completed' });
        }

        // All three gates asserted server-side — the UI disables the button, but
        // the API must not rely on that.
        const skillGate = await checkSkillSessionGate(provider);
        if (!skillGate.satisfied) {
            return res.status(400).json({
                message: `Cannot complete — Skill Session not passed for: ${skillGate.pending.join(', ')}`
            });
        }

        const missing = record.missingMandatory();
        if (missing.length > 0) {
            return res.status(400).json({
                message: `Cannot complete — mandatory item(s) not verified: ${missing.join(', ')}`
            });
        }
        if (!record.allTopicsCovered()) {
            const pending = record.trainingTopics.filter(t => !t.covered).map(t => t.label);
            return res.status(400).json({
                message: `Cannot complete — training topics not covered: ${pending.join(', ')}`
            });
        }

        const now = new Date();
        record.status = 'training_done';
        record.trainingCompleted = true;
        record.completedByModel = req.actor.model;
        record.completedBy = req.actor.id;
        record.completedAt = now;
        record.activatedAt = now;
        record.holdReason = '';
        record.history.push({
            action: 'training_completed',
            byModel: req.actor.model,
            by: req.actor.id,
            byName: req.actor.name,
            note: 'Profile activated'
        });
        await record.save();

        // THE activation. Flipping `status` is what makes the Sewak discoverable —
        // every existing consumer already reads this field. See D2.
        provider.status = 'verified';
        provider.isOnline = true;
        await provider.save();

        await logAudit(req.actor, {
            entityType: 'TRAINING',
            entityId: provider._id,
            entityName: provider.ownerName,
            action: 'TRAINING_COMPLETE',
            details: { vendorCode: provider.vendorCode, activatedAt: now },
            ip: req.ip
        });

        await notify(
            provider._id,
            'Training Complete — You are Live',
            'Your training is complete and your profile is now active. You can start receiving service requests.',
            record._id
        );

        res.json({ record, message: 'Training complete. Profile is now active.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Work queue of training records
// @route   GET /api/admin/training-records
// @access  Private/Admin
const getTrainingRecords = async (req, res) => {
    try {
        const { status, categoryId } = req.query;
        const query = {};
        if (status) query.status = status;
        if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) query.categoryId = categoryId;

        const records = await TrainingRecord.find(query)
            .populate('sewakId', 'ownerName vendorCode mobile city status kycVerified profileImage')
            .populate('categoryId', 'name')
            .sort({ status: 1, updatedAt: -1 })
            .lean();

        // Pending / on-hold first — those are the rows needing a human.
        const rank = { on_hold_item_missing: 0, pending: 1, in_progress: 2, training_done: 3 };
        records.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));

        res.json(records);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Counts by status
// @route   GET /api/admin/training-records/stats
// @access  Private/Admin
const getTrainingStats = async (req, res) => {
    try {
        const rows = await TrainingRecord.aggregate([
            { $group: { _id: '$status', n: { $sum: 1 } } }
        ]);
        const map = Object.fromEntries(rows.map(r => [r._id, r.n]));
        res.json({
            total: rows.reduce((s, r) => s + r.n, 0),
            pending: map.pending || 0,
            inProgress: map.in_progress || 0,
            onHold: map.on_hold_item_missing || 0,
            completed: map.training_done || 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reopen a completed record — takes the Sewak back offline
// @route   POST /api/admin/training-records/:sewakId/reopen
// @access  Private/Admin
const reopenTraining = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: 'A reason is required to reopen a completed training' });
        }

        const record = await TrainingRecord.findOne({ sewakId: req.params.sewakId });
        if (!record) return res.status(404).json({ message: 'Training record not found' });
        if (record.status !== 'training_done') {
            return res.status(400).json({ message: 'Only a completed training record can be reopened' });
        }

        const provider = await Provider.findById(req.params.sewakId);
        if (!provider) return res.status(404).json({ message: 'Sewak not found' });

        record.status = 'in_progress';
        record.trainingCompleted = false;
        record.completedAt = null;
        record.completedBy = null;
        record.completedByModel = null;
        record.reopenedCount += 1;
        record.history.push({
            action: 'training_reopened',
            byModel: 'User',
            by: req.user._id,
            byName: req.user.name || 'Admin',
            note: reason
        });
        // Re-sync now that the record is open again, picking up any new items.
        await syncItemVerifications(record);
        await record.save();

        provider.status = 'pending';
        provider.isOnline = false;
        await provider.save();

        await logAudit(
            { id: req.user._id, model: 'User', name: req.user.name || 'Admin', isAdmin: true },
            {
                entityType: 'TRAINING',
                entityId: provider._id,
                entityName: provider.ownerName,
                action: 'TRAINING_REOPEN',
                details: { vendorCode: provider.vendorCode },
                reason,
                ip: req.ip
            }
        );

        await notify(
            provider._id,
            'Training Reopened',
            `Your training has been reopened by admin and your profile is temporarily offline. Reason: ${reason}`,
            record._id
        );

        res.json({ record, message: 'Training reopened. The Sewak is now offline.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEWAK
// ─────────────────────────────────────────────────────────────────────────────

// @desc    My own training status — what is blocking me
// @route   GET /api/kit-store/training-status
// @access  Private (Sewak)
const getMyTrainingStatus = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id).lean();
        if (!provider) return res.status(404).json({ message: 'Provider not found' });
        if (provider.providerCategory !== 'sewak') {
            return res.json({ applicable: false });
        }

        const record = await TrainingRecord.findOne({ sewakId: provider._id }).lean();
        if (!record) {
            const preGate = await checkSkillSessionGate(provider);
            return res.json({
                applicable: true,
                status: provider.kycVerified ? 'pending' : 'awaiting_kyc',
                missingItems: [],
                pendingSkillSessions: preGate.pending,
                skillSessionPassed: preGate.satisfied,
                isLive: provider.status === 'verified'
            });
        }

        const missing = (record.itemVerifications || [])
            .filter(i => i.isMandatory && !i.verified)
            .map(i => ({ itemId: i.itemId, itemName: i.itemName, requiredQty: i.requiredQty }));

        const skillGate = await checkSkillSessionGate(provider);

        res.json({
            applicable: true,
            status: record.status,
            holdReason: record.holdReason,
            missingItems: missing,
            pendingSkillSessions: skillGate.pending,
            skillSessionPassed: skillGate.satisfied,
            topicsCovered: (record.trainingTopics || []).filter(t => t.covered).length,
            topicsTotal: (record.trainingTopics || []).length,
            isLive: provider.status === 'verified',
            completedAt: record.completedAt
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    searchSewak,
    viewDocument,
    getRecord,
    verifyItem,
    holdTraining,
    setTopic,
    completeTraining,
    getTrainingRecords,
    getTrainingStats,
    reopenTraining,
    getMyTrainingStatus,
    ensureRecord,
    getTopics,
    checkSkillSessionGate,
    buildGates,
    DEFAULT_TOPICS
};
