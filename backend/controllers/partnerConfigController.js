const PartnerProgram = require('../models/PartnerProgram');
const CommissionSlab = require('../models/CommissionSlab');
const AuditLog = require('../models/AuditLog');

// Slab contiguity checker
const validateSlabsContiguity = (slabs) => {
    if (!slabs || slabs.length === 0) return { isValid: true };
    // Sort by minAmount
    const sorted = [...slabs].sort((a, b) => a.minAmount - b.minAmount);
    
    // First slab must start at 0
    if (sorted[0].minAmount !== 0) {
        return { isValid: false, message: "First slab must start at 0." };
    }
    
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        
        if (next.minAmount <= current.maxAmount) {
            return { isValid: false, message: `Overlap detected between slabs: ${current.minAmount}-${current.maxAmount} and ${next.minAmount}-${next.maxAmount}` };
        }
        
        if (next.minAmount > current.maxAmount + 1) {
            return { isValid: false, message: `Gap detected between slabs: ${current.minAmount}-${current.maxAmount} and ${next.minAmount}-${next.maxAmount}` };
        }
    }
    
    // Last slab must cover up to a very high upper bound (e.g. 999999)
    const lastSlab = sorted[sorted.length - 1];
    if (lastSlab.maxAmount < 99999) {
        return { isValid: false, message: "Last slab max amount must be a very large number (e.g., 999999) to cover all ranges." };
    }
    
    return { isValid: true };
};

exports.getConfig = async (req, res) => {
    try {
        let program = await PartnerProgram.findOne();
        if (!program) {
            program = await PartnerProgram.create({
                ruleVersion: 1,
                freeTrialEnabled: true,
                freeServiceCount: 3,
                applyTo: 'all'
            });
        }

        const slabs = await CommissionSlab.find();
        
        // Map slabs to legacy format for front-end compatibility
        const legacySlabs = slabs.map(s => ({
            _id: s._id,
            categoryId: s.category ? s.category.toString() : '',
            min: s.minAmount,
            max: s.maxAmount,
            rate: s.commissionRate
        }));

        res.json({
            ruleVersion: program.ruleVersion,
            freeTrialEnabled: program.freeTrialEnabled,
            freeServiceCount: program.freeServiceCount,
            applyTo: program.applyTo,
            selectedCategories: program.selectedCategories,
            trialStarts: program.trialStarts,
            trialEnds: program.trialEnds,
            commissionSlabs: legacySlabs,
            performanceBonuses: { silverStarRate: 1, goldStarRate: 2, loyaltyBonusBookings: 100, loyaltyBonusAmount: 1000 },
            penalties: { cancellationCharge: 50 },
            referral: { commissionRate: 1, durationMonths: 12 },
            attendance: { requiredDays: 30, discountRate: 2 }
        });
    } catch (error) {
        console.error('Error fetching partner config:', error);
        res.status(500).json({ message: 'Server error fetching configuration' });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        const { 
            freeTrialEnabled, 
            freeServiceCount, 
            applyTo, 
            selectedCategories, 
            trialStarts, 
            trialEnds, 
            commissionSlabs 
        } = req.body;

        // 1. Group slabs by category to run contiguity check
        const slabsByCategory = {};
        if (commissionSlabs && commissionSlabs.length > 0) {
            commissionSlabs.forEach(s => {
                const catKey = s.categoryId || 'global';
                if (!slabsByCategory[catKey]) slabsByCategory[catKey] = [];
                slabsByCategory[catKey].push({
                    minAmount: Number(s.min),
                    maxAmount: Number(s.max),
                    commissionRate: Number(s.rate),
                    category: s.categoryId || null
                });
            });
        }

        // Validate contiguity and overlaps for each category
        for (const catKey of Object.keys(slabsByCategory)) {
            const validation = validateSlabsContiguity(slabsByCategory[catKey]);
            if (!validation.isValid) {
                const catName = catKey === 'global' ? 'Global Default' : `Category ID ${catKey}`;
                return res.status(400).json({ 
                    message: `Validation failed for ${catName}: ${validation.message}` 
                });
            }
        }

        // 2. Fetch/Create program config
        let program = await PartnerProgram.findOne();
        const prevValue = program ? program.toObject() : {};

        if (!program) {
            program = new PartnerProgram();
        }

        program.freeTrialEnabled = freeTrialEnabled !== undefined ? freeTrialEnabled : program.freeTrialEnabled;
        program.freeServiceCount = freeServiceCount !== undefined ? Number(freeServiceCount) : program.freeServiceCount;
        program.applyTo = applyTo || program.applyTo;
        program.selectedCategories = selectedCategories || program.selectedCategories;
        program.trialStarts = trialStarts || program.trialStarts;
        program.trialEnds = trialEnds || program.trialEnds;
        
        // Increment Rule Version
        program.ruleVersion = (program.ruleVersion || 1) + 1;
        await program.save();

        // 3. Save slabs (clear and insert new)
        await CommissionSlab.deleteMany({});
        const slabsToInsert = [];
        Object.keys(slabsByCategory).forEach(catKey => {
            slabsToInsert.push(...slabsByCategory[catKey]);
        });
        if (slabsToInsert.length > 0) {
            await CommissionSlab.insertMany(slabsToInsert);
        }

        // 4. Create Audit Log entry
        await AuditLog.create({
            actionType: 'UPDATE_SETTINGS',
            entityType: 'PARTNER_PROGRAM',
            entityId: program._id,
            entityName: 'Partner Program Config',
            verifiedBy: req.user._id,
            verifiedByName: req.user.ownerName || req.user.name || 'Admin',
            verifiedByRole: 'Admin',
            details: {
                previousValue: prevValue,
                newValue: program.toObject(),
                slabsCount: slabsToInsert.length
            },
            ipAddress: req.ip || '',
            reason: 'Admin updated partner program onboarding and slab rules'
        });

        // Maintain setting value for backward compatibility checks elsewhere in legacy code
        const Setting = require('../models/Setting');
        await Setting.findOneAndUpdate(
            { key: 'partner_program_config' },
            { 
                value: JSON.stringify({
                    commissionSlabs: commissionSlabs || [],
                    performanceBonuses: { silverStarRate: 1, goldStarRate: 2, loyaltyBonusBookings: 100, loyaltyBonusAmount: 1000 },
                    penalties: { cancellationCharge: 50 },
                    referral: { commissionRate: 1, durationMonths: 12 },
                    attendance: { requiredDays: 30, discountRate: 2 }
                })
            },
            { upsert: true }
        );

        res.json({ 
            message: 'Partner program configuration updated successfully', 
            ruleVersion: program.ruleVersion
        });
    } catch (error) {
        console.error('Error updating partner config:', error);
        res.status(500).json({ message: 'Server error updating configuration' });
    }
};
