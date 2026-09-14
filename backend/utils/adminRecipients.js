const User = require('../models/User');

// A notification fan-out should not be able to turn into an unbounded read of
// the user collection, however many admins get added over the years.
const MAX_RECIPIENTS = 200;

/**
 * Everyone who should hear about something needing admin attention.
 *
 * Ids only: every caller is about to notify these people, not display them, and
 * loading whole user documents to read one field off each is the difference
 * between a small query and a large one. Returned as documents rather than
 * bare ids so callers keep reading `admin._id`.
 */
const adminRecipients = async () => {
    return User.find({ role: { $in: ['admin', 'superadmin'] } })
        .select('_id')
        .limit(MAX_RECIPIENTS)
        .lean();
};

module.exports = { adminRecipients, MAX_RECIPIENTS };
