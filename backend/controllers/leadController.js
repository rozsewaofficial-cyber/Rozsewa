const mongoose = require('mongoose');
const Lead = require('../models/Lead');
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

// Helper to get configurable settings from DB
const getSettingVal = async (key, defaultValue) => {
    try {
        const doc = await Setting.findOne({ key });
        if (doc && doc.value !== undefined) {
            return doc.value;
        }
        return defaultValue;
    } catch (err) {
        console.error(`Error fetching setting ${key}:`, err);
        return defaultValue;
    }
};

// Haversine straight-line fallback distance in km
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Fetch real road distances from Google Maps Distance Matrix API.
 * origins: array of { lat, lon }
 * destinations: array of { lat, lon }
 * Returns array of distances in km (indexed parallel to destinations).
 * Falls back to Haversine if API is unavailable.
 */
const getRoadDistances = async (originLat, originLon, destinations) => {
    const axios = require('axios');
    const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

    // Build the destinations query string (lat,lon|lat,lon|...)
    const destStr = destinations
        .map(d => `${d.lat},${d.lon}`)
        .join('|');

    if (!GMAPS_KEY || destinations.length === 0) {
        return destinations.map(d => haversineDistance(originLat, originLon, d.lat, d.lon));
    }

    try {
        const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
        const { data } = await axios.get(url, {
            params: {
                origins: `${originLat},${originLon}`,
                destinations: destStr,
                mode: 'driving',
                units: 'metric',
                key: GMAPS_KEY
            },
            timeout: 4000
        });

        if (data.status === 'OK' && data.rows && data.rows[0]) {
            return data.rows[0].elements.map((el, i) => {
                if (el.status === 'OK' && el.distance) {
                    return el.distance.value / 1000; // metres → km
                }
                // Fallback for individual element failure
                return haversineDistance(originLat, originLon, destinations[i].lat, destinations[i].lon);
            });
        }
        throw new Error(`Distance Matrix status: ${data.status}`);
    } catch (err) {
        console.warn('[Lead Distance] Road distance API failed, using Haversine fallback:', err.message);
        return destinations.map(d => haversineDistance(originLat, originLon, d.lat, d.lon));
    }
};

// @desc    Create a new Lead requirement
// @route   POST /api/leads
// @access  Private (Customer)
const createLead = async (req, res) => {
    const { categoryId, serviceName, requirementDescription, preferredDate, preferredTime, coordinates, address, images } = req.body;

    if (!categoryId || !serviceName || !requirementDescription || !preferredDate || !preferredTime || !coordinates || coordinates.length < 2) {
        return res.status(400).json({ message: "Please provide all required lead fields." });
    }

    try {
        // Backend Validation: check category business model
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ message: "Category not found." });
        }

        if (category.businessModel !== 'lead') {
            return res.status(400).json({ message: "Category is not lead-based. Please use booking flow instead." });
        }

        // Load configs
        const leadPrice = category.defaultLeadPrice || 0;
        const maxUnlockCount = await getSettingVal('lead_max_unlock_count', 1);
        const geofenceRadius = await getSettingVal('lead_geofence_radius', 15);
        const leadExpiryHours = await getSettingVal('lead_expiry_duration', 24);
        const minWalletBalance = await getSettingVal('lead_min_wallet_balance', 200);

        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + Number(leadExpiryHours));

        // Create Lead
        const lead = await Lead.create({
            customer: req.user._id,
            category: categoryId,
            service: serviceName,
            requirementForm: {
                description: requirementDescription,
                preferredDate,
                preferredTime,
                images: images || [],
                address: address || ""
            },
            location: {
                type: 'Point',
                coordinates: [Number(coordinates[0]), Number(coordinates[1])] // [lon, lat]
            },
            leadPrice,
            maxUnlockLimit: maxUnlockCount,
            expiry: expiryDate,
            status: 'available'
        });

        // 🔍 Find nearby eligible providers
        const radiusInRadians = Number(geofenceRadius) / 6371;
        const providers = await Provider.find({
            status: 'verified',
            isOnline: true,
            vendorType: categoryId,
            canReceiveLead: true,
            location: {
                $geoWithin: {
                    $centerSphere: [[Number(coordinates[0]), Number(coordinates[1])], radiusInRadians]
                }
            }
        });

        // Filter out providers who do not meet wallet minimum threshold or are blocked
        const eligibleProviders = [];
        for (const p of providers) {
            const wallet = await Wallet.findOne({ providerId: p._id });
            const balance = wallet ? (wallet.availableBalance ?? wallet.balance) : 0;
            if (balance >= minWalletBalance) {
                eligibleProviders.push(p._id);
            }
        }

        // Update lead with matched nearby providers
        lead.nearbyProviders = eligibleProviders;
        await lead.save();

        // 🔔 Send push notifications to nearby partners
        for (const providerId of eligibleProviders) {
            try {
                await notifyUser({
                    userId: providerId,
                    userRole: 'provider',
                    title: 'New Lead Available!',
                    message: `A new ${serviceName} request is available near you. Unlock details now!`,
                    type: 'lead',
                    data: { leadId: lead._id.toString() }
                });
            } catch (notiErr) {
                console.error(`Failed notification for provider ${providerId}:`, notiErr);
            }
        }

        // Notify customer
        try {
            await notifyUser({
                userId: req.user._id,
                userRole: 'customer',
                title: 'Request Submitted Successfully',
                message: 'Your service request has been received. Nearby verified partners will contact you soon.',
                type: 'lead',
                data: { leadId: lead._id.toString() }
            });
        } catch (cNotiErr) {
            console.error("Customer notify error:", cNotiErr);
        }

        res.status(201).json({
            message: "Your request has been submitted. Nearby verified partners will contact you shortly.",
            leadId: lead._id
        });

    } catch (error) {
        console.error("Error creating lead:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get nearby available leads for a provider
// @route   GET /api/leads/nearby
// @access  Private (Provider)
const getNearbyLeads = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: "Provider not found." });

        if (!provider.vendorType) {
            return res.json({ leads: [], page, pages: 0, count: 0 });
        }

        const minWalletBalance = await getSettingVal('lead_min_wallet_balance', 200);
        const wallet = await Wallet.findOne({ providerId: req.user._id });
        const walletBalance = wallet ? (wallet.availableBalance ?? wallet.balance) : 0;

        if (walletBalance < minWalletBalance) {
            return res.status(403).json({ 
                message: `Wallet balance is below minimum limit (₹${minWalletBalance}). Please recharge your wallet to view leads.`,
                walletBalance
            });
        }

        // Fetch leads matching provider's category which are open/available and not expired
        const query = {
            category: provider.vendorType,
            status: { $in: ['available', 'unlocked'] },
            expiry: { $gt: new Date() },
            nearbyProviders: req.user._id // Matched on creation
        };

        const totalLeads = await Lead.countDocuments(query);
        const rawLeads = await Lead.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('category', 'name')
            .populate('customer', 'name mobile');

        // Build road-distance lookup for all leads in one API call
        let roadDistances = [];
        const pCoords = provider.location?.coordinates;
        if (pCoords && pCoords.length >= 2) {
            const destinations = rawLeads.map(l => {
                const lc = l.location?.coordinates;
                return lc && lc.length >= 2
                    ? { lat: lc[1], lon: lc[0] }
                    : null;
            });
            const validDest = destinations.map(d => d || { lat: pCoords[1], lon: pCoords[0] });
            roadDistances = await getRoadDistances(pCoords[1], pCoords[0], validDest);
        }

        // Mask client contact info if not unlocked by this provider
        const leads = rawLeads.map((l, idx) => {
            const hasUnlocked = l.unlockedProviders.includes(req.user._id);
            const leadObj = l.toObject();

            // Real road distance (or Haversine fallback)
            let distance = "Nearby";
            if (roadDistances[idx] !== undefined) {
                const km = roadDistances[idx];
                if (km < 0.05) {
                    distance = "Same Area";
                } else if (km < 1) {
                    distance = `${Math.round(km * 1000)} m`;
                } else {
                    distance = `${km.toFixed(1)} KM`;
                }
            }

            if (!hasUnlocked) {
                // Masking Details
                leadObj.customer = {
                    name: "MASKED CLIENT",
                    mobile: "XXXXXX"
                };
                leadObj.requirementForm.address = "Masked until unlocked";
                leadObj.isUnlocked = false;
            } else {
                leadObj.isUnlocked = true;
            }
            leadObj.distance = distance;
            return leadObj;
        });

        res.json({
            leads,
            page,
            pages: Math.ceil(totalLeads / limit),
            count: totalLeads
        });

    } catch (error) {
        console.error("Error fetching nearby leads:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Unlock customer contact details
// @route   POST /api/leads/:id/unlock
// @access  Private (Provider)
const unlockLead = async (req, res) => {
    const leadId = req.params.id;
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const lead = await Lead.findById(leadId).session(session);
        if (!lead) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Lead not found." });
        }

        // validations
        if (lead.expiry <= new Date()) {
            lead.status = 'expired';
            await lead.save({ session });
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Lead has expired." });
        }

        if (lead.unlockedProviders.length >= lead.maxUnlockLimit) {
            lead.status = 'closed';
            await lead.save({ session });
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Lead has reached its maximum unlock count." });
        }

        if (lead.unlockedProviders.includes(req.user._id)) {
            await session.abortTransaction();
            session.endSession();
            // Already unlocked, return customer details directly
            const fullLead = await Lead.findById(leadId).populate('customer', 'name mobile');
            return res.json({ success: true, lead: fullLead });
        }

        // Wallet Minimum balance verification
        const minWalletBalance = await getSettingVal('lead_min_wallet_balance', 200);
        let wallet = await Wallet.findOne({ providerId: req.user._id }).session(session);
        if (!wallet) {
            wallet = await Wallet.create([{ providerId: req.user._id, balance: 0, availableBalance: 0 }], { session });
            wallet = wallet[0];
        }

        const walletBalance = wallet.availableBalance ?? wallet.balance;
        if (walletBalance < minWalletBalance) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: `Wallet balance is below minimum limit (₹${minWalletBalance}). Please top up first.` });
        }

        // Decision Tree: Check subscription credits first
        const activeSub = await ProviderSubscription.findOne({
            provider: req.user._id,
            status: 'active',
            endDate: { $gt: new Date() },
            creditsRemaining: { $gt: 0 }
        }).session(session);

        let unlockedVia = 'none';

        if (activeSub) {
            // Option 1: active credit consumption
            activeSub.creditsRemaining -= 1;
            await activeSub.save({ session });

            // update provider's global credits log
            await Provider.findByIdAndUpdate(req.user._id, { $inc: { leadCredits: -1 } }).session(session);
            unlockedVia = 'credit';
        } else {
            // Option 2: wallet cash balance deduction
            const leadPrice = lead.leadPrice;
            const currentWalletBalance = wallet.availableBalance ?? wallet.balance;
            if (currentWalletBalance < leadPrice) {
                // Pay-per-lead payment gateway fallback check
                const payPerLeadEnabled = await getSettingVal('lead_pay_per_lead_enabled', true);
                if (payPerLeadEnabled) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(402).json({ 
                        message: "Insufficient wallet balance. Direct payment fallback available.",
                        paymentRequired: true,
                        leadPrice
                    });
                } else {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: "Insufficient wallet balance." });
                }
            }

            if (wallet.availableBalance !== undefined) {
                wallet.availableBalance -= leadPrice;
            }
            wallet.balance -= leadPrice;
            await wallet.save({ session });

            // Create financial ledger transaction record
            await Transaction.create([{
                providerId: req.user._id,
                title: 'Lead Unlock Charge',
                amount: leadPrice,
                type: 'debit',
                status: 'completed',
                description: `Debited for unlocking Lead ID #${lead._id.toString().slice(-6).toUpperCase()}`
            }], { session });

            // Update Provider flat wallet balance copy for caching
            await Provider.findByIdAndUpdate(req.user._id, { walletBalance: wallet.availableBalance ?? wallet.balance }).session(session);
            unlockedVia = 'wallet';
        }

        // Unlock lead and log transaction
        lead.unlockedProviders.push(req.user._id);
        lead.status = lead.unlockedProviders.length >= lead.maxUnlockLimit ? 'closed' : 'unlocked';
        await lead.save({ session });

        await LeadUnlockTransaction.create([{
            provider: req.user._id,
            lead: lead._id,
            unlockAmount: lead.leadPrice,
            walletUsed: unlockedVia === 'wallet',
            creditUsed: unlockedVia === 'credit',
            status: 'success'
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // Reveal client info
        const populatedLead = await Lead.findById(leadId).populate('customer', 'name mobile');

        // Notify client
        try {
            await notifyUser({
                userId: lead.customer,
                userRole: 'customer',
                title: 'Lead Unlocked',
                message: `Rozsewa partner "${req.user.shopName}" has unlocked your contact. They will reach out to you shortly.`,
                type: 'lead',
                data: { leadId: lead._id.toString() }
            });
        } catch (notiErr) {
            console.error("Failed notification for customer:", notiErr);
        }

        res.json({
            success: true,
            message: "Lead unlocked successfully!",
            lead: populatedLead
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Unlock transaction aborted:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Raise a lead dispute claim for refunds
// @route   POST /api/leads/:id/dispute
// @access  Private (Provider)
const raiseDispute = async (req, res) => {
    const leadId = req.params.id;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ message: "Please specify a dispute reason." });

    try {
        const disputeEnabled = await getSettingVal('lead_dispute_enabled', true);
        if (!disputeEnabled) {
            return res.status(400).json({ message: "Disputes are currently disabled by the system." });
        }

        // Validate provider unlocked this lead
        const lead = await Lead.findById(leadId);
        if (!lead || !lead.unlockedProviders.includes(req.user._id)) {
            return res.status(403).json({ message: "Access denied. You have not unlocked this lead." });
        }

        // Create Dispute
        const dispute = await LeadDispute.create({
            lead: leadId,
            provider: req.user._id,
            reason
        });

        // Update Lead status
        lead.status = 'disputed';
        await lead.save();

        // Create Audit log
        await AuditLog.create({
            actionType: 'DISPUTE_RAISED',
            entityType: 'LEAD_DISPUTE',
            entityId: dispute._id,
            entityName: `Dispute on Lead #${leadId.slice(-6).toUpperCase()}`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.ownerName || "Partner",
            verifiedByRole: 'provider',
            details: { reason, leadId }
        });

        res.status(201).json({
            message: "Dispute raised successfully. Admin desk will review your claim.",
            dispute
        });

    } catch (error) {
        console.error("Dispute registration failed:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get subscription plans config for lead credits
// @route   GET /api/leads/plans
// @access  Private (Provider)
const getLeadPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({
            leadCredits: { $gt: 0 },
            status: 'active'
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Lead details
// @route   GET /api/leads/:id
// @access  Private
const getLeadDetails = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id).populate('category', 'name');
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const isCustomer = req.user.role !== 'provider';
        const hasUnlocked = lead.unlockedProviders.includes(req.user._id);

        const leadObj = lead.toObject();

        if (isCustomer) {
            // Customer can view their own full lead details
            if (lead.customer.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Access Denied." });
            }
            const populated = await Lead.findById(req.params.id).populate('category', 'name');
            return res.json(populated);
        }

        // Mask contact details if not unlocked by provider
        if (!hasUnlocked) {
            leadObj.customer = {
                name: "MASKED CLIENT",
                mobile: "XXXXXX"
            };
            leadObj.requirementForm.address = "Masked until unlocked";
            leadObj.isUnlocked = false;
        } else {
            const populated = await Lead.findById(req.params.id).populate('customer', 'name mobile').populate('category', 'name');
            return res.json(populated);
        }

        res.json(leadObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Admin: List all leads
// @route   GET /api/admin/leads
// @access  Private/Admin
const getAdminLeads = async (req, res) => {
    try {
        const leads = await Lead.find()
            .populate('customer', 'name mobile')
            .populate('category', 'name')
            .sort({ createdAt: -1 });
        res.json(leads);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Admin: List all lead disputes
// @route   GET /api/admin/leads/disputes
// @access  Private/Admin
const getAdminDisputes = async (req, res) => {
    try {
        const disputes = await LeadDispute.find()
            .populate('provider', 'ownerName shopName')
            .sort({ createdAt: -1 });
        res.json(disputes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Admin: Resolve a dispute (Approve refund / Reject claim)
// @route   POST /api/admin/leads/disputes/:id/resolve
// @access  Private/Admin
const resolveDispute = async (req, res) => {
    const disputeId = req.params.id;
    const { decision } = req.body; // 'approved', 'rejected'

    if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ message: "Invalid decision value." });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const dispute = await LeadDispute.findById(disputeId).session(session);
        if (!dispute) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Dispute claim not found." });
        }

        if (dispute.adminDecision !== 'pending') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Dispute has already been resolved." });
        }

        dispute.adminDecision = decision;
        
        const lead = await Lead.findById(dispute.lead).session(session);

        if (decision === 'approved') {
            const refundEnabled = await getSettingVal('lead_refund_enabled', true);
            
            if (refundEnabled) {
                // Find original unlock record to decide wallet refund or credit restore
                const transaction = await LeadUnlockTransaction.findOne({
                    provider: dispute.provider,
                    lead: dispute.lead,
                    status: 'success'
                }).session(session);

                if (transaction) {
                    if (transaction.creditUsed) {
                        // Restore credit to provider subscription
                        const provider = await Provider.findById(dispute.provider).session(session);
                        if (provider) {
                            provider.leadCredits += 1;
                            await provider.save({ session });
                        }

                        // update subscription record details
                        const subscription = await ProviderSubscription.findOne({
                            provider: dispute.provider,
                            status: 'active'
                        }).session(session);
                        if (subscription) {
                            subscription.creditsRemaining += 1;
                            await subscription.save({ session });
                        }
                        dispute.refundStatus = 'refunded';
                    } else if (transaction.walletUsed) {
                        // Refund wallet cash balance
                        let wallet = await Wallet.findOne({ providerId: dispute.provider }).session(session);
                        if (wallet) {
                            if (wallet.availableBalance !== undefined) {
                                wallet.availableBalance += transaction.unlockAmount;
                            }
                            wallet.balance += transaction.unlockAmount;
                            await wallet.save({ session });

                            // log credit transaction
                            await Transaction.create([{
                                providerId: dispute.provider,
                                title: 'Lead Refund Credit',
                                amount: transaction.unlockAmount,
                                type: 'credit',
                                status: 'completed',
                                description: `Refunded for Lead ID #${dispute.lead.toString().slice(-6).toUpperCase()} claim approval.`
                            }], { session });

                            // sync cache provider walletBalance
                            await Provider.findByIdAndUpdate(dispute.provider, { walletBalance: wallet.availableBalance ?? wallet.balance }).session(session);
                        }
                        dispute.refundStatus = 'refunded';
                    }
                }
            } else {
                dispute.refundStatus = 'none';
            }
            if (lead) lead.disputeStatus = 'refunded';
        } else {
            dispute.refundStatus = 'rejected';
            if (lead) lead.disputeStatus = 'rejected';
        }

        if (lead) {
            lead.status = 'closed';
            await lead.save({ session });
        }

        await dispute.save({ session });

        // Audit Log
        await AuditLog.create([{
            actionType: decision === 'approved' ? 'LEAD_REFUND_APPROVED' : 'LEAD_REFUND_REJECTED',
            entityType: 'LEAD_REFUND',
            entityId: dispute._id,
            entityName: `Refund dispute resolution`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name || "System Admin",
            verifiedByRole: req.user.role,
            details: { disputeId, decision }
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // Send notifications
        try {
            await notifyUser({
                userId: dispute.provider,
                userRole: 'provider',
                title: `Lead Dispute ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
                message: decision === 'approved' 
                    ? `Your claim was approved. Lead cost has been refunded.`
                    : `Your dispute request for lead details was rejected.`,
                type: 'lead',
                data: { leadId: dispute.lead.toString() }
            });
        } catch (notiErr) {
            console.error("Dispute notification error:", notiErr);
        }

        res.json({ message: `Dispute resolve marked: ${decision}`, dispute });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Failed to resolve dispute:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Admin: Manual Lead closure
// @route   POST /api/admin/leads/:id/close
// @access  Private/Admin
const forceCloseLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        lead.status = 'closed';
        await lead.save();

        await AuditLog.create({
            actionType: 'MANUAL_LEAD_CLOSURE',
            entityType: 'LEAD',
            entityId: lead._id,
            entityName: `Force close lead`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { leadId: lead._id }
        });

        res.json({ message: "Lead closed successfully." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Admin: Get operational statistics
// @route   GET /api/admin/leads/stats
// @access  Private/Admin
const getAdminStats = async (req, res) => {
    try {
        const totalLeads = await Lead.countDocuments();
        
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const todayLeads = await Lead.countDocuments({ createdAt: { $gte: startOfDay } });

        const unlockedLeadsCount = await Lead.countDocuments({ unlockedProviders: { $not: { $size: 0 } } });

        // Aggregate dispute refund logs
        const resolvedDisputes = await LeadDispute.find({ adminDecision: 'approved' }).populate('lead');
        const refundAmount = resolvedDisputes.reduce((sum, d) => sum + (d.lead?.leadPrice || 0), 0);

        const allTransactions = await LeadUnlockTransaction.find({ status: 'success' });
        const revenue = allTransactions.reduce((sum, tx) => sum + tx.unlockAmount, 0);

        const conversionRate = totalLeads > 0 ? Math.round((unlockedLeadsCount / totalLeads) * 100) : 0;
        const pendingDisputesCount = await LeadDispute.countDocuments({ adminDecision: 'pending' });

        res.json({
            totalLeads,
            todayLeads,
            unlockedLeadsCount,
            revenue,
            refundAmount,
            conversionRate,
            pendingDisputesCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createLead,
    getNearbyLeads,
    unlockLead,
    raiseDispute,
    getLeadPlans,
    getLeadDetails,
    getAdminLeads,
    getAdminDisputes,
    resolveDispute,
    forceCloseLead,
    getAdminStats
};
