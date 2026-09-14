const Employee = require('../models/Employee');
const Provider = require('../models/Provider');

// A supervisor's team, and the sewaks it onboarded. Both are bounded by how the
// field organisation is staffed rather than by how much the platform is used,
// but a ceiling keeps one badly-shaped record from turning into a full scan.
const TEAM_CAP = 1000;
const TEAM_SEWAK_CAP = 5000;

/**
 * The staff codes a supervisor's own work and their team's work is filed under.
 *
 * Returns null when the signed-in supervisor has no employee record — callers
 * treat that as "sees nothing" rather than "sees everything", which is the
 * difference between an empty screen and a permissions hole.
 */
const teamCodesFor = async (userId) => {
    const supervisor = await Employee.findOne({ userId }).select('_id ownCode').lean();
    if (!supervisor) return null;

    // Only the code is read off each teammate, so only the code is loaded.
    const team = await Employee.find({
        $or: [
            { managedBy: supervisor._id },
            { supervisorCode: supervisor.ownCode },
            { createdBy: userId }
        ]
    })
        .select('ownCode')
        .limit(TEAM_CAP)
        .lean();

    return {
        supervisor,
        // How many people report to them, which is not the same as the number of
        // codes below — that one also carries the supervisor's own.
        teamSize: team.length,
        codes: [supervisor.ownCode, ...team.map(e => e.ownCode)].filter(Boolean)
    };
};

/** Narrows a provider query to the people a team brought in. */
const sewaksOfTeam = (codes) => ({
    providerCategory: 'sewak',
    $or: [
        { referredBy: { $in: codes } },
        { onboardedByStaff: { $in: codes } }
    ]
});

/** The ids of those sewaks, for scoping a query that joins to them. */
const teamSewakIds = async (codes) => {
    const rows = await Provider.find(sewaksOfTeam(codes))
        .select('_id')
        .limit(TEAM_SEWAK_CAP)
        .lean();
    return rows.map(r => r._id);
};

module.exports = { teamCodesFor, sewaksOfTeam, teamSewakIds, TEAM_CAP, TEAM_SEWAK_CAP };
