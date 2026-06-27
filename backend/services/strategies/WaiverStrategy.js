class WaiverStrategy {
    getMetadata() {
        return {
            id: "WAIVER",
            name: "Commission Waiver",
            description: "Temporary commission waiver granted manually by admins",
            enabled: true
        };
    }
    
    async evaluate(bookingAmount, provider, category) {
        const waiver = provider.commissionWaiver;
        if (!waiver || !waiver.enabled) return null;

        // Check date limitation if set
        if (waiver.untilDate && new Date(waiver.untilDate) < new Date()) {
            return null;
        }

        // Check booking limit if set
        if (waiver.maxBookings !== null && waiver.maxBookings !== undefined) {
            const waivedCount = waiver.bookingsWaivedCount || 0;
            if (waivedCount >= waiver.maxBookings) {
                return null;
            }
        }

        return {
            rate: 0,
            source: 'WAIVER',
            ruleName: this.getMetadata().name,
            isWaiver: true,
            metadata: {
                reason: waiver.reason,
                untilDate: waiver.untilDate,
                maxBookings: waiver.maxBookings,
                bookingsWaivedCount: waiver.bookingsWaivedCount
            }
        };
    }
}

module.exports = WaiverStrategy;
