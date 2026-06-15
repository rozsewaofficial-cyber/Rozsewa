const Setting = require('../models/Setting');

// Default Configuration
const DEFAULT_CONFIG = {
    commissionSlabs: [
        { min: 50, max: 100, rate: 15 },
        { min: 101, max: 300, rate: 14 },
        { min: 301, max: 700, rate: 12 },
        { min: 701, max: 999999, rate: 10 }
    ],
    subscriptionPlans: {
        elite: { commissionRate: 0, cost: 999, months: 6 },
        pro: { commissionRate: 5, cost: 599, months: 6 },
        basic: { commissionRate: 8, cost: 299, months: 6 }
    },
    performanceBonuses: {
        silverStarRate: 1,
        goldStarRate: 2,
        loyaltyBonusBookings: 100,
        loyaltyBonusAmount: 1000
    },
    penalties: {
        cancellationCharge: 50
    },
    referral: {
        commissionRate: 1,
        durationMonths: 12
    },
    attendance: {
        requiredDays: 30,
        discountRate: 2
    }
};

exports.getConfig = async (req, res) => {
    try {
        let config = await Setting.findOne({ key: 'partner_program_config' });
        
        if (!config) {
            // Create default if not exists
            config = await Setting.create({
                key: 'partner_program_config',
                value: JSON.stringify(DEFAULT_CONFIG)
            });
        }

        res.json(JSON.parse(config.value));
    } catch (error) {
        console.error('Error fetching partner config:', error);
        res.status(500).json({ message: 'Server error fetching configuration' });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        const newConfig = req.body;
        
        let config = await Setting.findOne({ key: 'partner_program_config' });
        
        if (!config) {
            config = new Setting({ key: 'partner_program_config' });
        }

        config.value = JSON.stringify(newConfig);
        await config.save();

        res.json({ message: 'Partner program configuration updated successfully', config: newConfig });
    } catch (error) {
        console.error('Error updating partner config:', error);
        res.status(500).json({ message: 'Server error updating configuration' });
    }
};
