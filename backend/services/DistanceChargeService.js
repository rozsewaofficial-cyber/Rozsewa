const Setting = require('../models/Setting');
const Booking = require('../models/Booking');
const Provider = require('../models/Provider');

class DistanceChargeService {
    // Haversine formula to calculate distance between two coordinates in KM
    static calculateDistance(lat1, lon1, lat2, lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
        
        const toRad = (value) => (value * Math.PI) / 180;
        const R = 6371; // Earth radius in KM

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
                  
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    static async getConfig(categoryId = null) {
        const configSetting = await Setting.findOne({ key: 'distance_charge_config' });
        let config = {
            enabled: true,
            baseDistance: 3,
            baseFee: 40,
            extraFeePerKm: 10,
            maximumDistance: null,
            maximumCharge: null,
            rounding: 'nearest',
            calculationMethod: 'haversine',
            fallbackCharge: 40,
            categoryOverrides: {}
        };

        if (configSetting && configSetting.value) {
            config = { ...config, ...configSetting.value };
        }

        // Apply category override if exists
        if (categoryId && config.categoryOverrides && config.categoryOverrides[categoryId]) {
            const override = config.categoryOverrides[categoryId];
            config = { ...config, ...override };
        }

        return config;
    }

    static async calculateTravelCharge(distanceKm, categoryId = null) {
        const config = await this.getConfig(categoryId);
        if (!config.enabled) return { amount: 0, config };
        
        let charge = 0;
        
        if (distanceKm <= config.baseDistance) {
            charge = config.baseFee;
        } else {
            const extraKm = distanceKm - config.baseDistance;
            charge = config.baseFee + (extraKm * config.extraFeePerKm);
        }

        if (config.maximumCharge && charge > config.maximumCharge) {
            charge = config.maximumCharge;
        }

        switch(config.rounding) {
            case 'up': charge = Math.ceil(charge); break;
            case 'down': charge = Math.floor(charge); break;
            case 'none': break;
            case 'nearest':
            default:
                charge = Math.round(charge); break;
        }

        return { amount: charge, config };
    }

    static async applyTravelChargeToBooking(bookingId, providerId) {
        try {
            const booking = await Booking.findById(bookingId);
            if (!booking) throw new Error('Booking not found');

            // If travel charge is already final, do not recalculate
            if (booking.travelCharge && booking.travelCharge.status === 'final') {
                return { booking, travelChargeObj: booking.travelCharge, chargeDifference: 0 };
            }

            const provider = await Provider.findById(providerId);
            if (!provider) throw new Error('Provider not found');

            let distanceKm = null;
            let status = 'fallback';
            let amount = 0;
            
            // Get category ID from provider
            const categoryId = provider.vendorType ? provider.vendorType.toString() : null;
            const config = await this.getConfig(categoryId);

            // Extract coordinates
            // Assuming GeoJSON format: [longitude, latitude]
            const bCoords = booking.location?.coordinates;
            const pCoords = provider.location?.coordinates;

            if (bCoords && bCoords.length >= 2 && pCoords && pCoords.length >= 2) {
                const bLon = bCoords[0];
                const bLat = bCoords[1];
                const pLon = pCoords[0];
                const pLat = pCoords[1];

                distanceKm = this.calculateDistance(bLat, bLon, pLat, pLon);
            }

            let resultCharge = 0;

            if (distanceKm !== null && !isNaN(distanceKm)) {
                if (config.maximumDistance && distanceKm > config.maximumDistance) {
                    distanceKm = config.maximumDistance;
                }
                const calculation = await this.calculateTravelCharge(distanceKm, categoryId);
                resultCharge = calculation.amount;
                status = 'final';
            } else {
                resultCharge = config.fallbackCharge || 40;
                status = 'fallback';
                distanceKm = 0;
            }

            if (!config.enabled) {
                resultCharge = 0;
                status = 'final';
            }

            const oldAmount = booking.travelCharge?.amount || 0;
            const chargeDifference = resultCharge - oldAmount;

            const travelChargeObj = {
                distanceKm: distanceKm,
                billableDistanceKm: distanceKm,
                baseDistance: config.baseDistance,
                baseFee: config.baseFee,
                extraFeePerKm: config.extraFeePerKm,
                amount: resultCharge,
                calculationMethod: config.calculationMethod,
                calculatedAt: new Date(),
                status: status
            };

            booking.travelCharge = travelChargeObj;

            if (!booking.extraCharges) booking.extraCharges = [];
            booking.extraCharges = booking.extraCharges.filter(c => !c.item.includes('Travel Charge'));

            if (resultCharge > 0) {
                booking.extraCharges.push({
                    item: `Travel Charge${distanceKm > 0 ? ` (${distanceKm.toFixed(2)} km)` : ' (Standard)'}`,
                    amount: resultCharge
                });
            }

            // Update Total Amounts
            booking.totalAmount = (booking.totalAmount || 0) + chargeDifference;
            if (booking.originalFixedPrice) {
                booking.originalFixedPrice += chargeDifference;
            }
            if (booking.customerOffer) {
                booking.customerOffer += chargeDifference;
            }
            if (booking.negotiation && booking.negotiation.userProposedAmount) {
                booking.negotiation.userProposedAmount += chargeDifference;
            }

            await booking.save();
            return { booking, travelChargeObj, chargeDifference };

        } catch (error) {
            console.error('Error applying travel charge:', error);
            throw error;
        }
    }
}

module.exports = DistanceChargeService;
