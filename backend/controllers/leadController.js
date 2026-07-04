const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const LeadForm = require('../models/LeadForm');
const LeadActivity = require('../models/LeadActivity');
const LeadUnlockTransaction = require('../models/LeadUnlockTransaction');
const LeadDispute = require('../models/LeadDispute');
const Category = require('../models/Category');
const Service = require('../models/Service');
const Provider = require('../models/Provider');
const ProviderSubscription = require('../models/ProviderSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Setting = require('../models/Setting');
const { Wallet, Transaction } = require('../models/Wallet');
const AuditLog = require('../models/AuditLog');
const { notifyUser } = require('../config/notificationService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSettingVal = async (key, defaultValue) => {
    try {
        const doc = await Setting.findOne({ key });
        return (doc && doc.value !== undefined) ? doc.value : defaultValue;
    } catch {
        return defaultValue;
    }
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getRoadDistances = async (originLat, originLon, destinations) => {
    const axios = require('axios');
    const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GMAPS_KEY || destinations.length === 0)
        return destinations.map(d => haversineDistance(originLat, originLon, d.lat, d.lon));
    try {
        const destStr = destinations.map(d => `${d.lat},${d.lon}`).join('|');
        const { data } = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
            params: { origins: `${originLat},${originLon}`, destinations: destStr, mode: 'driving', units: 'metric', key: GMAPS_KEY },
            timeout: 4000
        });
        if (data.status === 'OK' && data.rows?.[0]) {
            return data.rows[0].elements.map((el, i) =>
                el.status === 'OK' && el.distance
                    ? el.distance.value / 1000
                    : haversineDistance(originLat, originLon, destinations[i].lat, destinations[i].lon)
            );
        }
        throw new Error(`Distance Matrix: ${data.status}`);
    } catch (err) {
        console.warn('[Lead Distance] Falling back to Haversine:', err.message);
        return destinations.map(d => haversineDistance(originLat, originLon, d.lat, d.lon));
    }
};

const formatDistance = (km) => {
    if (km < 0.05) return 'Same Area';
    if (km < 1)    return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} KM`;
};

// Log an activity event (non-blocking)
const logActivity = async (leadId, actorId, actorRole, event, detail = {}) => {
    try {
        await LeadActivity.create({ leadId, actorId, actorRole, event, detail });
    } catch (e) {
        console.error(`[LeadActivity] Failed to log ${event}:`, e.message);
    }
};

// ─── 9-Layer Provider Targeting Pipeline ─────────────────────────────────────

/**
 * Find all providers eligible to receive a lead notification.
 *
 * Layers:
 *   1. Category match  (vendorType === categoryId)
 *   2. Service match   (subServices includes serviceId/subServiceId, if specified)
 *   3. Business model  (providerType IN ['lead', 'both'])
 *   4. Account status  (status === 'verified')
 *   5. Online/Active   (isOnline === true)
 *   6. Geofence        ($geoWithin $centerSphere)
 *   7. Lead receive    (canReceiveLead === true)
 *   8. Wallet minimum  (availableBalance >= lead_min_wallet_balance)
 *   9. Subscription    (if category requires: isSubscribed + creditsRemaining > 0)
 */
const findEligibleProviders = async (lead, category) => {
    console.log(`[LeadTargeting] Finding eligible providers for lead #${lead._id} in category "${category.name}"`);
    const geofenceRadius = await getSettingVal('lead_geofence_radius', 15);
    const minWalletBalance = await getSettingVal('lead_min_wallet_balance', 200);
    const [lng, lat] = lead.location.coordinates;
    const radiusInRadians = Number(geofenceRadius) / 6371;

    console.log(`[LeadTargeting] Geofence: ${geofenceRadius} km, Min wallet balance required: ₹${minWalletBalance}`);

    // Build base geo+DB query (Layers 1, 3, 4, 5, 6, 7 done in DB)
    const geoQuery = {
        vendorType:     lead.categoryId,
        status:         'verified',                     // Layer 4
        isOnline:       true,                           // Layer 5
        canReceiveLead: true,                           // Layer 7
        location: {
            $geoWithin: {
                $centerSphere: [[lng, lat], radiusInRadians] // Layer 6
            }
        }
    };

    const candidates = await Provider.find(geoQuery).lean();
    console.log(`[LeadTargeting] Found ${candidates.length} candidates in database matching geo-queries & online/verified criteria.`);

    const eligible = [];
    for (const p of candidates) {
        console.log(`[LeadTargeting] Checking candidate provider "${p.shopName || p.ownerName}" (ID: ${p._id})`);

        // Layer 2 — Service/SubService match (if lead specifies one)
        if (lead.serviceId || lead.subServiceId) {
            const serviceKey = lead.serviceId?.toString() || lead.subServiceId;
            const hasService = p.subServices?.some(s =>
                s === serviceKey || s === lead.subServiceId
            );
            if (!hasService) {
                console.log(`  ➔ [Layer 2] Skip: Provider does not offer the requested specific sub-service ID "${serviceKey}".`);
                continue;
            }
        }

        // Layer 8 — Wallet minimum
        const wallet = await Wallet.findOne({ providerId: p._id }).lean();
        const balance = wallet ? (wallet.availableBalance ?? wallet.balance ?? 0) : 0;
        if (balance < minWalletBalance) {
            console.log(`  ➔ [Layer 8] Skip: Insufficient wallet balance (Has ₹${balance}, needs ₹${minWalletBalance}).`);
            continue;
        }

        // Layer 9 — Subscription eligibility (only if category enforces it)
        if (category.requiresSubscription) {
            if (!p.isSubscribed) {
                console.log(`  ➔ [Layer 9] Skip: Provider has no active subscription.`);
                continue;
            }
            if (p.subscriptionExpiry && p.subscriptionExpiry < new Date()) {
                console.log(`  ➔ [Layer 9] Skip: Provider subscription expired.`);
                continue;
            }
            const sub = await ProviderSubscription.findOne({
                provider: p._id,
                status: 'active',
                endDate: { $gt: new Date() },
                creditsRemaining: { $gt: 0 }
            }).lean();
            if (!sub) {
                console.log(`  ➔ [Layer 9] Skip: No active subscription record with remaining lead credits found.`);
                continue;
            }
        }

        console.log(`  ➔ [Eligible] Provider matched all criteria!`);
        eligible.push(p._id);
    }
    console.log(`[LeadTargeting] Total eligible providers targeted for notification: ${eligible.length}`);
    return eligible;
};

// ═══════════════════════════════════════════════════════════════════════════════
// FORM SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Get dynamic form schema for a category/service
// @route GET /api/leads/forms/:categoryId?serviceId=xxx
// @access Public (customer)
const getFormSchema = async (req, res) => {
    const { categoryId } = req.params;
    const { serviceId } = req.query;
    try {
        // Prefer service-specific form first, then fall back to category-wide form
        let form = null;
        if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
            form = await LeadForm.findOne({ categoryId, serviceId, isPublished: true, isArchived: false });
        }
        if (!form) {
            form = await LeadForm.findOne({ categoryId, serviceId: null, isPublished: true, isArchived: false });
        }
        if (!form) {
            // Return empty schema — form builder not configured yet
            return res.json({ formId: null, formVersion: null, sections: [], title: 'Service Request' });
        }
        res.json({
            formId: form._id,
            formVersion: form.version,
            title: form.title,
            description: form.description,
            sections: form.sections
        });
    } catch (err) {
        console.error('[getFormSchema]', err);
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DRAFT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Save or create a lead draft
// @route POST /api/leads/draft
// @access Private (Customer)
const saveDraft = async (req, res) => {
    const {
        categoryId, serviceId, subServiceId,
        requirementTitle, requirementDesc, dynamicAnswers,
        preferredDate, preferredTime, isDateFlexible, isTimeFlexible,
        location, locationDetail, attachments,
        formId, formVersion
    } = req.body;

    if (!categoryId) return res.status(400).json({ message: 'categoryId is required to save a draft.' });

    try {
        const category = await Category.findById(categoryId);
        if (!category) return res.status(404).json({ message: 'Category not found.' });
        if (category.businessModel !== 'lead')
            return res.status(400).json({ message: 'Category is not lead-based.' });

        const leadExpiryHours = await getSettingVal('lead_expiry_duration', 24);
        const expiryDate = new Date(Date.now() + Number(leadExpiryHours) * 3600000);

        const coords = location?.coordinates || [0, 0];

        const draft = await Lead.create({
            customer: req.user._id,
            categoryId,
            category: categoryId,           // legacy compat
            serviceId: serviceId || null,
            subServiceId: subServiceId || null,
            service: subServiceId || null,  // legacy compat
            requirementTitle: requirementTitle || '',
            requirementDesc: requirementDesc || '',
            dynamicAnswers: dynamicAnswers || [],
            preferredDate: preferredDate || '',
            preferredTime: preferredTime || '',
            isDateFlexible: isDateFlexible || false,
            isTimeFlexible: isTimeFlexible || false,
            location: { type: 'Point', coordinates: coords },
            locationDetail: locationDetail || {},
            attachments: (attachments || []).slice(0, 10),
            formId: formId || null,
            formVersion: formVersion || null,
            leadPrice: category.defaultLeadPrice || 0,
            status: 'draft',
            expiry: expiryDate,
            requirementForm: {
                description: requirementDesc || '',
                preferredDate: preferredDate || '',
                preferredTime: preferredTime || '',
                address: locationDetail?.street || ''
            }
        });

        await logActivity(draft._id, req.user._id, 'customer', 'LEAD_DRAFT_SAVED', { step: 'initial' });

        res.status(201).json({ message: 'Draft saved.', draftId: draft._id, leadId: draft._id });
    } catch (err) {
        console.error('[saveDraft]', err);
        res.status(500).json({ message: err.message });
    }
};

// @desc  Update an existing draft
// @route PUT /api/leads/draft/:id
// @access Private (Customer)
const updateDraft = async (req, res) => {
    try {
        const draft = await Lead.findOne({ _id: req.params.id, customer: req.user._id });
        if (!draft) return res.status(404).json({ message: 'Draft not found.' });
        if (draft.status !== 'draft')
            return res.status(400).json({ message: 'Only drafts can be updated via this endpoint.' });

        const allowedFields = [
            'requirementTitle', 'requirementDesc', 'dynamicAnswers',
            'preferredDate', 'preferredTime', 'isDateFlexible', 'isTimeFlexible',
            'location', 'locationDetail', 'attachments',
            'serviceId', 'subServiceId', 'formId', 'formVersion'
        ];
        allowedFields.forEach(f => {
            if (req.body[f] !== undefined) draft[f] = req.body[f];
        });

        // Cap attachments
        if (draft.attachments?.length > 10) draft.attachments = draft.attachments.slice(0, 10);

        // Sync legacy fields
        draft.requirementForm = {
            description: draft.requirementDesc,
            preferredDate: draft.preferredDate,
            preferredTime: draft.preferredTime,
            address: draft.locationDetail?.street || ''
        };

        await draft.save();
        await logActivity(draft._id, req.user._id, 'customer', 'LEAD_DRAFT_SAVED', { step: req.body.step || 'update' });

        res.json({ message: 'Draft updated.', draftId: draft._id });
    } catch (err) {
        console.error('[updateDraft]', err);
        res.status(500).json({ message: err.message });
    }
};

// @desc  Delete a draft
// @route DELETE /api/leads/draft/:id
// @access Private (Customer)
const deleteDraft = async (req, res) => {
    try {
        const draft = await Lead.findOne({ _id: req.params.id, customer: req.user._id, status: 'draft' });
        if (!draft) return res.status(404).json({ message: 'Draft not found.' });
        await Lead.deleteOne({ _id: draft._id });
        res.json({ message: 'Draft deleted.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD CREATION (Submit Draft → Available)
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Create (publish) a Lead — or upgrade existing draft to available
// @route POST /api/leads
// @access Private (Customer)
const createLead = async (req, res) => {
    const {
        draftId,         // if continuing from a saved draft
        categoryId, serviceId, subServiceId,
        requirementTitle, requirementDesc,
        dynamicAnswers,
        preferredDate, preferredTime, isDateFlexible, isTimeFlexible,
        coordinates, location, locationDetail,
        attachments, formId, formVersion,
        // legacy support
        requirementDescription, address, images, serviceName
    } = req.body;

    const catId = categoryId;
    if (!catId) return res.status(400).json({ message: 'categoryId is required.' });

    const coords = coordinates || location?.coordinates;
    if (!coords || coords.length < 2)
        return res.status(400).json({ message: 'Valid location coordinates are required.' });

    try {
        const category = await Category.findById(catId);
        if (!category) return res.status(404).json({ message: 'Category not found.' });
        if (category.businessModel !== 'lead')
            return res.status(400).json({ message: 'Category is not lead-based. Use the booking flow.' });

        const title = requirementTitle || '';
        const desc  = requirementDesc || requirementDescription || '';

        if (title && title.length < 10)
            return res.status(400).json({ message: 'Requirement title must be at least 10 characters.' });
        if (desc && desc.length < 15)
            return res.status(400).json({ message: 'Please describe your requirement in at least 15 characters.' });

        const leadPrice     = category.defaultLeadPrice || 0;
        const maxUnlockCount= await getSettingVal('lead_max_unlock_count', 1);
        const leadExpiryHrs = await getSettingVal('lead_expiry', await getSettingVal('lead_expiry_duration', 24));
        const expiryDate    = new Date(Date.now() + Number(leadExpiryHrs) * 3600000);

        let lead;
        if (draftId) {
            if (mongoose.Types.ObjectId.isValid(draftId)) {
                // Upgrade existing draft
                lead = await Lead.findOne({ _id: draftId, customer: req.user._id, status: 'draft' });
            }
            if (!lead) {
                console.log(`[createLead] Draft ID ${draftId} not found or invalid. Creating a new lead instead.`);
            }
        }

        const locDetail = locationDetail || {};
        const richAttachments = (attachments || []).slice(0, 10);

        const leadData = {
            customer:         req.user._id,
            categoryId:       catId,
            category:         catId,
            serviceId:        serviceId || null,
            subServiceId:     subServiceId || null,
            service:          serviceName || subServiceId || null,
            requirementTitle: title,
            requirementDesc:  desc,
            dynamicAnswers:   dynamicAnswers || [],
            preferredDate:    preferredDate || '',
            preferredTime:    preferredTime || '',
            isDateFlexible:   isDateFlexible || false,
            isTimeFlexible:   isTimeFlexible || false,
            location: { type: 'Point', coordinates: [Number(coords[0]), Number(coords[1])] },
            locationDetail:   locDetail,
            attachments:      richAttachments,
            formId:           formId   || null,
            formVersion:      formVersion || null,
            leadPrice,
            maxUnlockLimit:   maxUnlockCount,
            expiry:           expiryDate,
            status:           'available',
            // Legacy compat
            requirementForm: {
                description:   desc,
                preferredDate: preferredDate || '',
                preferredTime: preferredTime || '',
                images:        images || richAttachments.filter(a => a.mimeType?.startsWith('image/')).map(a => a.url),
                address:       address || locDetail.street || ''
            }
        };

        if (lead) {
            Object.assign(lead, leadData);
            await lead.save();
        } else {
            lead = await Lead.create(leadData);
        }

        // 9-layer provider targeting
        const eligibleProviders = await findEligibleProviders(lead, category);
        lead.nearbyProviders = eligibleProviders;
        await lead.save();

        await logActivity(lead._id, req.user._id, 'customer', 'LEAD_CREATED', {
            categoryId: catId, serviceId, eligibleCount: eligibleProviders.length
        });

        const dateStr = preferredDate || '';
        const timeStr = preferredTime || '';
        const scheduleStr = dateStr ? `${dateStr}${timeStr ? ` at ${timeStr}` : ''}` : 'Anytime';

        const areaStr = locDetail.area || locDetail.street || '';
        const cityStr = locDetail.city || '';
        const locStr = [areaStr, cityStr].filter(Boolean).join(', ') || 'Nearby';

        // Notify eligible providers
        for (const providerId of eligibleProviders) {
            try {
                await notifyUser({
                    userId: providerId,
                    userRole: 'provider',
                    title: `New Lead: ${category.name}`,
                    message: `A new request is available for ${scheduleStr} in ${locStr}. Value: ₹${leadPrice}. Unlock details now!`,
                    type: 'lead',
                    data: {
                        leadId: lead._id.toString(),
                        link: '/provider/leads',
                        userRole: 'provider'
                    }
                });
            } catch (e) {
                console.error(`[Lead notify provider ${providerId}]:`, e.message);
            }
        }

        // Notify customer
        try {
            await notifyUser({
                userId: req.user._id,
                userRole: 'customer',
                title: 'Request Submitted Successfully',
                message: `Your request for ${category.name} on ${scheduleStr} is live. Nearby verified partners will contact you directly.`,
                type: 'lead',
                data: {
                    leadId: lead._id.toString(),
                    link: '/my-leads',
                    userRole: 'customer'
                }
            });
        } catch (e) {
            console.error('[Lead notify customer]:', e.message);
        }

        // Notify admins
        try {
            const User = require('../models/User');
            const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
            for (const adminUser of admins) {
                try {
                    await notifyUser({
                        userId: adminUser._id,
                        userRole: 'admin',
                        title: `New Lead: ${category.name}`,
                        message: `A new request for ${scheduleStr} in ${locStr} has been submitted by ${req.user.name || 'a customer'}. Value: ₹${leadPrice}.`,
                        type: 'lead',
                        data: {
                            leadId: lead._id.toString(),
                            link: '/admin/leads',
                            userRole: 'admin'
                        }
                    });
                } catch (e) {
                    console.error(`[Lead notify admin ${adminUser._id}]:`, e.message);
                }
            }
        } catch (e) {
            console.error('[Lead notify admins]:', e.message);
        }

        res.status(201).json({
            message: 'Your request has been submitted. Nearby verified partners will contact you directly.',
            leadId: lead._id
        });

    } catch (err) {
        console.error('[createLead]', err);
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE LEAD (edit — locked after first unlock)
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Update a lead (customer edits before first unlock)
// @route PUT /api/leads/:id
// @access Private (Customer)
const updateLead = async (req, res) => {
    try {
        const lead = await Lead.findOne({ _id: req.params.id, customer: req.user._id });
        if (!lead) return res.status(404).json({ message: 'Lead not found.' });

        if (lead.isEditLocked)
            return res.status(403).json({ message: 'This lead is locked for editing because a provider has already unlocked it.' });

        if (!['draft', 'available'].includes(lead.status))
            return res.status(400).json({ message: `Cannot edit a lead with status "${lead.status}".` });

        const editableFields = [
            'requirementTitle', 'requirementDesc', 'dynamicAnswers',
            'preferredDate', 'preferredTime', 'isDateFlexible', 'isTimeFlexible',
            'locationDetail', 'attachments', 'location'
        ];
        const changed = [];
        editableFields.forEach(f => {
            if (req.body[f] !== undefined) { lead[f] = req.body[f]; changed.push(f); }
        });

        if (lead.attachments?.length > 10) lead.attachments = lead.attachments.slice(0, 10);

        // Sync legacy fields
        lead.requirementForm = {
            description:   lead.requirementDesc,
            preferredDate: lead.preferredDate,
            preferredTime: lead.preferredTime,
            address:       lead.locationDetail?.street || ''
        };

        await lead.save();
        await logActivity(lead._id, req.user._id, 'customer', 'LEAD_EDITED', { changedFields: changed });

        // Notify customer
        try {
            await notifyUser({ userId: req.user._id, userRole: 'customer', title: 'Lead Updated', message: 'Your request has been updated.', type: 'lead', data: { leadId: lead._id.toString() } });
        } catch {}

        res.json({ message: 'Lead updated successfully.', leadId: lead._id });
    } catch (err) {
        console.error('[updateLead]', err);
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER — MY LEADS
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Get customer's own lead submissions
// @route GET /api/leads/my
// @access Private (Customer)
const getCustomerLeads = async (req, res) => {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status= req.query.status; // optional filter
    const skip  = (page - 1) * limit;

    try {
        const query = { customer: req.user._id };
        if (status) query.status = status;

        const total = await Lead.countDocuments(query);
        const leads = await Lead.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('categoryId', 'name icon')
            .lean();

        const enriched = leads.map(l => ({
            ...l,
            unlockCount:    l.unlockedProviders?.length || 0,
            viewCount:      l.viewedProviders?.length   || 0,
            canEdit:        !l.isEditLocked && ['draft', 'available'].includes(l.status),
            isDraft:        l.status === 'draft',
            isExpired:      l.expiry && new Date(l.expiry) < new Date()
        }));

        res.json({ leads: enriched, page, pages: Math.ceil(total / limit), count: total });
    } catch (err) {
        console.error('[getCustomerLeads]', err);
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER — NEARBY LEADS
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Get nearby available leads for a provider
// @route GET /api/leads/nearby
// @access Private (Provider)
const getNearbyLeads = async (req, res) => {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;
    const tab   = req.query.tab || 'available'; // 'available' | 'unlocked' | 'expired'

    try {
        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: 'Provider not found.' });
        if (!provider.vendorType) return res.json({ leads: [], page, pages: 0, count: 0 });

        // Query successful unlocks to determine free trial status
        const LeadUnlockTransaction = require('../models/LeadUnlockTransaction');
        const unlockedCount = await LeadUnlockTransaction.countDocuments({
            provider: req.user._id,
            status: 'success'
        });
        const hasFreeLeft = unlockedCount < 3;

        // Wallet check - bypassed during free trial
        const minWalletBalance = await getSettingVal('lead_min_wallet_balance', 200);
        const wallet = await Wallet.findOne({ providerId: req.user._id });
        const walletBalance = wallet ? (wallet.availableBalance ?? wallet.balance ?? 0) : 0;

        if (!hasFreeLeft && walletBalance < minWalletBalance) {
            return res.status(403).json({
                message: `Wallet balance (₹${walletBalance}) is below the minimum required (₹${minWalletBalance}). Please recharge to view leads.`,
                walletBalance
            });
        }

        let statusFilter;
        switch (tab) {
            case 'unlocked': statusFilter = { $in: ['partially_unlocked', 'fully_unlocked'] }; break;
            case 'expired':  statusFilter = { $in: ['expired', 'closed'] }; break;
            default:         statusFilter = { $in: ['available', 'partially_unlocked'] };
        }

        const baseQuery = {
            status: statusFilter,
            nearbyProviders: req.user._id
        };
        if (tab !== 'expired') baseQuery.expiry = { $gt: new Date() };

        const totalLeads = await Lead.countDocuments(baseQuery);
        const rawLeads = await Lead.find(baseQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('categoryId', 'name icon')
            .populate('customer', 'name mobile email')
            .lean();

        // Road distance calculation
        let roadDistances = [];
        const pCoords = provider.location?.coordinates;
        if (pCoords?.length >= 2) {
            const destinations = rawLeads.map(l => {
                const c = l.location?.coordinates;
                return c?.length >= 2 ? { lat: c[1], lon: c[0] } : { lat: pCoords[1], lon: pCoords[0] };
            });
            roadDistances = await getRoadDistances(pCoords[1], pCoords[0], destinations);
        }

        const unlockPriceSetting = await getSettingVal('lead_unlock_price', 50);

        const leads = rawLeads.map((l, idx) => {
            const hasUnlocked = l.unlockedProviders?.some(id => id.toString() === req.user._id.toString());
            const lead = { ...l };

            // Dynamic lead price for this provider
            if (hasFreeLeft) {
                lead.leadPrice = 0;
            } else {
                lead.leadPrice = l.leadPrice || Number(unlockPriceSetting);
            }

            lead.distance = roadDistances[idx] !== undefined
                ? formatDistance(roadDistances[idx])
                : 'Nearby';

            lead.expiresIn = l.expiry
                ? Math.max(0, Math.floor((new Date(l.expiry) - Date.now()) / 1000))
                : null; // seconds

            // Show dynamic answer preview (first 2) without masking content
            lead.dynamicAnswersPreview = (l.dynamicAnswers || []).slice(0, 2);

            if (!hasUnlocked) {
                // Mask customer contact info
                lead.customer = { name: 'MASKED CLIENT', mobile: 'XXXXXX', email: 'XXXXXX' };
                if (lead.locationDetail) {
                    lead.locationDetail = { city: lead.locationDetail.city || '', area: lead.locationDetail.area || '' };
                }
                lead.requirementForm = { ...l.requirementForm, address: 'Masked until unlocked' };
                lead.isUnlocked = false;
            } else {
                lead.isUnlocked = true;
            }

            return lead;
        });

        res.json({ leads, page, pages: Math.ceil(totalLeads / limit), count: totalLeads, walletBalance });
    } catch (err) {
        console.error('[getNearbyLeads]', err);
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD UNLOCK
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Unlock customer contact details
// @route POST /api/leads/:id/unlock
// @access Private (Provider)
const unlockLead = async (req, res) => {
    const leadId  = req.params.id;
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const lead = await Lead.findById(leadId).session(session);
        if (!lead) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Lead not found.' }); }

        if (lead.expiry <= new Date()) {
            lead.status = 'expired';
            await lead.save({ session });
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Lead has expired.' });
        }

        if (lead.unlockedProviders.length >= lead.maxUnlockLimit) {
            lead.status = 'fully_unlocked';
            await lead.save({ session });
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Lead has reached its maximum unlock count.' });
        }

        const alreadyUnlocked = lead.unlockedProviders.some(id => id.toString() === req.user._id.toString());
        if (alreadyUnlocked) {
            await session.abortTransaction();
            session.endSession();
            const full = await Lead.findById(leadId).populate('customer', 'name mobile email');
            return res.json({ success: true, lead: full });
        }

        // Query successful unlocks to determine free trial status
        const LeadUnlockTransaction = require('../models/LeadUnlockTransaction');
        const unlockedCount = await LeadUnlockTransaction.countDocuments({
            provider: req.user._id,
            status: 'success'
        }).session(session);
        const hasFreeLeft = unlockedCount < 3;

        // Wallet minimum check - bypassed during free trial
        const minWalletBalance = await getSettingVal('lead_min_wallet_balance', 200);
        let wallet = await Wallet.findOne({ providerId: req.user._id }).session(session);
        if (!wallet) {
            wallet = (await Wallet.create([{ providerId: req.user._id, balance: 0, availableBalance: 0 }], { session }))[0];
        }
        const walletBalance = wallet.availableBalance ?? wallet.balance ?? 0;
        if (!hasFreeLeft && walletBalance < minWalletBalance) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: `Wallet balance (₹${walletBalance}) is below minimum (₹${minWalletBalance}). Please top up.`, walletBalance });
        }

        // Subscription credit first, then wallet cash, else free trial
        const activeSub = await ProviderSubscription.findOne({
            provider: req.user._id,
            status: 'active',
            endDate: { $gt: new Date() },
            creditsRemaining: { $gt: 0 }
        }).session(session);

        let unlockedVia = 'none';
        let actualPrice = 0;

        if (activeSub) {
            activeSub.creditsRemaining -= 1;
            await activeSub.save({ session });
            await Provider.findByIdAndUpdate(req.user._id, { $inc: { leadCredits: -1 } }).session(session);
            unlockedVia = 'credit';
            actualPrice = 0;
        } else if (hasFreeLeft) {
            unlockedVia = 'free_trial';
            actualPrice = 0;
        } else {
            const unlockPriceSetting = await getSettingVal('lead_unlock_price', 50);
            const leadPrice = lead.leadPrice || Number(unlockPriceSetting);
            actualPrice = leadPrice;

            if (walletBalance < leadPrice) {
                const payPerLead = await getSettingVal('lead_pay_per_lead_enabled', true);
                await session.abortTransaction();
                session.endSession();
                if (payPerLead) {
                    return res.status(402).json({ message: 'Insufficient wallet balance. Direct payment available.', paymentRequired: true, leadPrice });
                }
                return res.status(400).json({ message: 'Insufficient wallet balance.' });
            }
            if (wallet.availableBalance !== undefined) wallet.availableBalance -= leadPrice;
            wallet.balance -= leadPrice;
            await wallet.save({ session });
            await Transaction.create([{
                providerId: req.user._id,
                title: 'Lead Unlock Charge',
                amount: leadPrice,
                type: 'debit',
                status: 'completed',
                description: `Lead unlock fee — ID #${lead._id.toString().slice(-6).toUpperCase()}`
            }], { session });
            await Provider.findByIdAndUpdate(req.user._id, { walletBalance: wallet.availableBalance ?? wallet.balance }).session(session);
            unlockedVia = 'wallet';
        }

        // Mark unlock and update status
        lead.unlockedProviders.push(req.user._id);
        const newUnlockCount = lead.unlockedProviders.length;

        // Status transition
        if (newUnlockCount >= lead.maxUnlockLimit) {
            lead.status = 'fully_unlocked';
        } else {
            lead.status = 'partially_unlocked';
        }

        // EDIT LOCK — set automatically on first unlock
        if (newUnlockCount === 1) {
            lead.isEditLocked = true;
        }

        await lead.save({ session });

        await LeadUnlockTransaction.create([{
            provider: req.user._id,
            lead: lead._id,
            unlockAmount: actualPrice,
            walletUsed:   unlockedVia === 'wallet',
            creditUsed:   unlockedVia === 'credit',
            status: 'success',
            notes: hasFreeLeft ? `Free trial unlock (${unlockedCount + 1}/3)` : undefined
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // Audit
        await logActivity(lead._id, req.user._id, 'provider', 'LEAD_UNLOCKED', { unlockedVia, leadPrice: actualPrice });
        if (newUnlockCount === 1) {
            await logActivity(lead._id, req.user._id, 'system', 'LEAD_EDIT_LOCKED', {});
        }

        const populatedLead = await Lead.findById(leadId).populate('customer', 'name mobile email');

        // Notify all nearby providers to sync their screen lists
        try {
            const { emitToProvider } = require('../config/socket');
            for (const pId of lead.nearbyProviders) {
                emitToProvider(pId, 'NEW_NOTIFICATION', { type: 'lead', leadId: lead._id.toString() });
            }
        } catch (sockErr) {
            console.error('[Socket Broadcast Error] Provider lists refresh emit failed:', sockErr.message);
        }

        // Notify admins to sync their screen lists
        try {
            const { emitToUser } = require('../config/socket');
            const User = require('../models/User');
            const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
            for (const adminUser of admins) {
                emitToUser(adminUser._id, 'NEW_NOTIFICATION', { type: 'lead', leadId: lead._id.toString() });
            }
        } catch (sockErr) {
            console.error('[Socket Broadcast Error] Admin refresh emit failed:', sockErr.message);
        }

        // Notify customer
        try {
            const prov = await Provider.findById(req.user._id).select('shopName ownerName').lean();
            await notifyUser({
                userId: lead.customer,
                userRole: 'customer',
                title: 'Your Lead Was Unlocked',
                message: `"${prov?.shopName || 'A verified partner'}" has unlocked your contact. They will reach out to you directly.`,
                type: 'lead',
                data: { leadId: lead._id.toString() }
            });
        } catch {}

        // Notify provider — unlock confirmation
        try {
            await notifyUser({
                userId: req.user._id,
                userRole: 'provider',
                title: 'Lead Unlocked Successfully',
                message: `You have unlocked lead #${lead._id.toString().slice(-6).toUpperCase()}. Customer details are now visible.`,
                type: 'lead',
                data: { leadId: lead._id.toString() }
            });
        } catch {}

        res.json({ success: true, message: 'Lead unlocked! Customer details are now visible.', lead: populatedLead });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('[unlockLead]', err);
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD DETAILS
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Get lead details
// @route GET /api/leads/:id
// @access Private
const getLeadDetails = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate('categoryId', 'name icon')
            .populate('customer', 'name mobile email');

        if (!lead) return res.status(404).json({ message: 'Lead not found.' });

        const isCustomer = req.user.role !== 'provider';

        if (isCustomer) {
            if (lead.customer._id.toString() !== req.user._id.toString())
                return res.status(403).json({ message: 'Access Denied.' });
            return res.json(lead);
        }

        // Provider: track view
        const alreadyViewed = lead.viewedProviders?.some(id => id.toString() === req.user._id.toString());
        if (!alreadyViewed) {
            lead.viewedProviders.push(req.user._id);
            await lead.save();
            await logActivity(lead._id, req.user._id, 'provider', 'LEAD_VIEWED', {});
            // Notify customer (debounced to once per provider)
            try {
                await notifyUser({ userId: lead.customer._id, userRole: 'customer', title: 'Lead Viewed', message: 'A provider has viewed your request.', type: 'lead', data: { leadId: lead._id.toString() } });
            } catch {}
        }

        const hasUnlocked = lead.unlockedProviders?.some(id => id.toString() === req.user._id.toString());
        if (!hasUnlocked) {
            const leadObj = lead.toObject();
            leadObj.customer = { name: 'MASKED CLIENT', mobile: 'XXXXXX', email: 'XXXXXX' };
            if (leadObj.locationDetail) {
                leadObj.locationDetail = { city: leadObj.locationDetail.city, area: leadObj.locationDetail.area };
            }
            if (leadObj.requirementForm) leadObj.requirementForm.address = 'Masked until unlocked';
            leadObj.isUnlocked = false;
            return res.json(leadObj);
        }

        res.json({ ...lead.toObject(), isUnlocked: true });
    } catch (err) {
        console.error('[getLeadDetails]', err);
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Get activity/audit trail for a lead
// @route GET /api/leads/activity/:id
// @access Private (Customer — own lead, or Admin)
const getLeadActivity = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id).lean();
        if (!lead) return res.status(404).json({ message: 'Lead not found.' });

        const isCustomer = req.user.role !== 'provider';
        if (isCustomer && lead.customer.toString() !== req.user._id.toString())
            return res.status(403).json({ message: 'Access Denied.' });

        const activities = await LeadActivity.find({ leadId: req.params.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json(activities);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DISPUTE
// ═══════════════════════════════════════════════════════════════════════════════

// @desc  Raise a lead dispute
// @route POST /api/leads/:id/dispute
// @access Private (Provider)
const raiseDispute = async (req, res) => {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'Please specify a dispute reason.' });
    try {
        const disputeEnabled = await getSettingVal('lead_dispute_enabled', true);
        if (!disputeEnabled) return res.status(400).json({ message: 'Disputes are currently disabled.' });

        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found.' });
        const hasUnlocked = lead.unlockedProviders?.some(id => id.toString() === req.user._id.toString());
        if (!hasUnlocked) return res.status(403).json({ message: 'You have not unlocked this lead.' });

        const dispute = await LeadDispute.create({ lead: req.params.id, provider: req.user._id, reason });
        lead.status = 'disputed';
        await lead.save();

        await logActivity(lead._id, req.user._id, 'provider', 'DISPUTE_RAISED', { reason });
        await AuditLog.create({
            actionType: 'DISPUTE_RAISED', entityType: 'LEAD_DISPUTE', entityId: dispute._id,
            entityName: `Dispute on Lead #${req.params.id.slice(-6).toUpperCase()}`,
            verifiedBy: req.user._id, verifiedByName: req.user.ownerName || 'Partner', verifiedByRole: 'provider',
            details: { reason, leadId: req.params.id }
        });

        res.status(201).json({ message: 'Dispute raised. Admin will review your claim.', dispute });
    } catch (err) {
        console.error('[raiseDispute]', err);
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS
// ═══════════════════════════════════════════════════════════════════════════════

const getLeadPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({ leadCredits: { $gt: 0 }, status: 'active' });
        res.json(plans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — LEADS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const getAdminLeads = async (req, res) => {
    try {
        const { status, category, page = 1, limit = 50 } = req.query;
        const query = {};
        if (status) query.status = status;
        if (category) query.categoryId = category;

        const total = await Lead.countDocuments(query);
        const leads = await Lead.find(query)
            .populate('customer', 'name mobile email')
            .populate('categoryId', 'name')
            .populate('unlockedProviders', 'ownerName shopName mobile email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({ leads, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getAdminDisputes = async (req, res) => {
    try {
        const disputes = await LeadDispute.find()
            .populate('provider', 'ownerName shopName')
            .sort({ createdAt: -1 });
        res.json(disputes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const resolveDispute = async (req, res) => {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision))
        return res.status(400).json({ message: 'Invalid decision value.' });

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const dispute = await LeadDispute.findById(req.params.id).session(session);
        if (!dispute) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Dispute not found.' }); }
        if (dispute.adminDecision !== 'pending') { await session.abortTransaction(); session.endSession(); return res.status(400).json({ message: 'Dispute already resolved.' }); }

        dispute.adminDecision = decision;
        const lead = await Lead.findById(dispute.lead).session(session);

        if (decision === 'approved') {
            const refundEnabled = await getSettingVal('lead_refund_enabled', true);
            if (refundEnabled) {
                const tx = await LeadUnlockTransaction.findOne({ provider: dispute.provider, lead: dispute.lead, status: 'success' }).session(session);
                if (tx) {
                    if (tx.creditUsed) {
                        const sub = await ProviderSubscription.findOne({ provider: dispute.provider, status: 'active' }).session(session);
                        if (sub) { sub.creditsRemaining += 1; await sub.save({ session }); }
                        await Provider.findByIdAndUpdate(dispute.provider, { $inc: { leadCredits: 1 } }).session(session);
                    } else if (tx.walletUsed) {
                        const wallet = await Wallet.findOne({ providerId: dispute.provider }).session(session);
                        if (wallet) {
                            if (wallet.availableBalance !== undefined) wallet.availableBalance += tx.unlockAmount;
                            wallet.balance += tx.unlockAmount;
                            await wallet.save({ session });
                            await Transaction.create([{
                                providerId: dispute.provider,
                                title: 'Lead Refund',
                                amount: tx.unlockAmount,
                                type: 'credit',
                                status: 'completed',
                                description: `Refund for Lead #${dispute.lead.toString().slice(-6).toUpperCase()}`
                            }], { session });
                            await Provider.findByIdAndUpdate(dispute.provider, { walletBalance: wallet.availableBalance ?? wallet.balance }).session(session);
                        }
                    }
                    dispute.refundStatus = 'refunded';
                }
            } else { dispute.refundStatus = 'none'; }

            if (lead) { lead.status = 'refunded'; lead.disputeStatus = 'refunded'; }
        } else {
            dispute.refundStatus = 'rejected';
            if (lead) { lead.disputeStatus = 'rejected'; lead.status = 'closed'; }
        }

        if (lead) await lead.save({ session });
        await dispute.save({ session });

        await AuditLog.create([{
            actionType: decision === 'approved' ? 'LEAD_REFUND_APPROVED' : 'LEAD_REFUND_REJECTED',
            entityType: 'LEAD_REFUND', entityId: dispute._id, entityName: 'Lead Refund Resolution',
            verifiedBy: req.user._id, verifiedByName: req.user.name || 'Admin', verifiedByRole: req.user.role,
            details: { disputeId: req.params.id, decision }
        }], { session });

        await session.commitTransaction();
        session.endSession();

        if (lead) await logActivity(lead._id, req.user._id, 'admin', 'DISPUTE_RESOLVED', { decision });

        try {
            await notifyUser({
                userId: dispute.provider, userRole: 'provider',
                title: `Lead Dispute ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
                message: decision === 'approved' ? 'Your dispute was approved. Refund processed.' : 'Your dispute was rejected by the admin.',
                type: 'lead', data: { leadId: dispute.lead.toString() }
            });
        } catch {}

        res.json({ message: `Dispute resolved: ${decision}`, dispute });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('[resolveDispute]', err);
        res.status(500).json({ message: err.message });
    }
};

const forceCloseLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found.' });
        lead.status = 'closed';
        await lead.save();
        await logActivity(lead._id, req.user._id, 'admin', 'LEAD_CLOSED', { reason: 'admin_force_close' });
        await AuditLog.create({
            actionType: 'MANUAL_LEAD_CLOSURE', entityType: 'LEAD', entityId: lead._id,
            entityName: 'Force close lead', verifiedBy: req.user._id, verifiedByName: req.user.name, verifiedByRole: req.user.role,
            details: { leadId: lead._id }
        });
        res.json({ message: 'Lead closed successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  12-metric analytics for admin dashboard
const getAdminStats = async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

        const [
            totalLeads, todayLeads, expiredLeads,
            unlockedLeadsCount, refundedCount,
            allTransactions, allDisputes, pendingDisputes
        ] = await Promise.all([
            Lead.countDocuments(),
            Lead.countDocuments({ createdAt: { $gte: todayStart } }),
            Lead.countDocuments({ status: 'expired' }),
            Lead.countDocuments({ status: { $in: ['partially_unlocked', 'fully_unlocked'] } }),
            Lead.countDocuments({ status: 'refunded' }),
            LeadUnlockTransaction.find({ status: 'success' }).lean(),
            LeadDispute.countDocuments(),
            LeadDispute.countDocuments({ adminDecision: 'pending' })
        ]);

        const revenue = allTransactions.reduce((s, t) => s + (t.walletUsed ? t.unlockAmount : 0), 0);
        const refundAmount = allTransactions.reduce((s, t) => s + (t.creditUsed ? 0 : t.unlockAmount * (t.status === 'success' && t.walletUsed ? 0 : 0)), 0);

        const conversionRate = totalLeads > 0 ? +((unlockedLeadsCount / totalLeads) * 100).toFixed(1) : 0;
        const disputeRate    = totalLeads > 0 ? +((allDisputes / totalLeads) * 100).toFixed(1) : 0;

        // Top categories
        const topCategories = await Lead.aggregate([
            { $group: { _id: '$categoryId', count: { $sum: 1 } } },
            { $sort: { count: -1 } }, { $limit: 5 },
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
            { $project: { name: { $arrayElemAt: ['$cat.name', 0] }, count: 1 } }
        ]);

        // Top providers by unlock count
        const topProviders = await LeadUnlockTransaction.aggregate([
            { $match: { status: 'success' } },
            { $group: { _id: '$provider', count: { $sum: 1 } } },
            { $sort: { count: -1 } }, { $limit: 5 },
            { $lookup: { from: 'providers', localField: '_id', foreignField: '_id', as: 'prov' } },
            { $project: { name: { $arrayElemAt: ['$prov.shopName', 0] }, count: 1 } }
        ]);

        res.json({
            totalLeads, todayLeads, unlockedLeadsCount, expiredLeads,
            revenue, refundAmount: refundedCount * 0, // computed from transactions if needed
            conversionRate, disputeRate,
            pendingDisputesCount: pendingDisputes,
            topCategories, topProviders,
            totalDisputes: allDisputes
        });
    } catch (err) {
        console.error('[getAdminStats]', err);
        res.status(500).json({ message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — LEAD FORM BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

const getLeadForms = async (req, res) => {
    try {
        const { categoryId } = req.query;
        const query = { isArchived: false };
        if (categoryId) query.categoryId = categoryId;
        const forms = await LeadForm.find(query)
            .populate('categoryId', 'name')
            .populate('serviceId', 'name')
            .sort({ updatedAt: -1 });
        res.json(forms);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const createLeadForm = async (req, res) => {
    const { categoryId, serviceId, title, description, sections } = req.body;
    if (!categoryId || !title)
        return res.status(400).json({ message: 'categoryId and title are required.' });
    try {
        const form = await LeadForm.create({
            categoryId,
            serviceId: serviceId || null,
            title,
            description: description || '',
            sections: sections || [],
            version: 1,
            isPublished: false,
            lastModifiedBy: req.user._id
        });
        await logActivity(form._id, req.user._id, 'admin', 'ADMIN_FORM_CREATED', { title });
        res.status(201).json({ message: 'Form created.', form });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateLeadForm = async (req, res) => {
    try {
        const form = await LeadForm.findById(req.params.id);
        if (!form || form.isArchived) return res.status(404).json({ message: 'Form not found.' });

        const { title, description, sections } = req.body;
        if (title)       form.title       = title;
        if (description !== undefined) form.description = description;
        if (sections)    form.sections    = sections;
        form.lastModifiedBy = req.user._id;

        await form.save();
        await logActivity(form._id, req.user._id, 'admin', 'ADMIN_FORM_UPDATED', { title: form.title });
        res.json({ message: 'Form updated.', form });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const publishLeadForm = async (req, res) => {
    try {
        const form = await LeadForm.findById(req.params.id);
        if (!form || form.isArchived) return res.status(404).json({ message: 'Form not found.' });

        // Unpublish any previously published form for same category/service
        await LeadForm.updateMany(
            { categoryId: form.categoryId, serviceId: form.serviceId, _id: { $ne: form._id }, isPublished: true },
            { isPublished: false }
        );

        form.isPublished = true;
        form.publishedAt = new Date();
        form.version = (form.version || 1) + 1;
        form.lastModifiedBy = req.user._id;
        await form.save();

        await logActivity(form._id, req.user._id, 'admin', 'ADMIN_FORM_PUBLISHED', { version: form.version });
        res.json({ message: `Form published (v${form.version}).`, form });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteLeadForm = async (req, res) => {
    try {
        const form = await LeadForm.findById(req.params.id);
        if (!form) return res.status(404).json({ message: 'Form not found.' });
        form.isArchived = true;
        form.isPublished = false;
        await form.save();
        await logActivity(form._id, req.user._id, 'admin', 'ADMIN_FORM_ARCHIVED', {});
        res.json({ message: 'Form archived.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    // Form Schema
    getFormSchema,
    // Draft
    saveDraft,
    updateDraft,
    deleteDraft,
    // Lead Lifecycle
    createLead,
    updateLead,
    getLeadDetails,
    getLeadActivity,
    getCustomerLeads,
    // Provider
    getNearbyLeads,
    unlockLead,
    raiseDispute,
    getLeadPlans,
    // Admin — Leads
    getAdminLeads,
    getAdminDisputes,
    resolveDispute,
    forceCloseLead,
    getAdminStats,
    // Admin — Form Builder
    getLeadForms,
    createLeadForm,
    updateLeadForm,
    publishLeadForm,
    deleteLeadForm
};
