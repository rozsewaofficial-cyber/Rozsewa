/**
 * A partner never receives the customer's OTPs.
 *
 * The start, completion and workshop OTPs are sent to the customer, who
 * tells them to the partner at that moment; that is the whole check. The
 * partner's booking responses used to carry the codes themselves, so a
 * partner could read them off the app and start or complete a job (or
 * take an item away) without the customer.
 *
 * For a provider, every booking in a response loses its OTPs and gains a
 * flag instead (startOtpSent / endOtpSent / workshop.pickupOtpSent /
 * workshop.returnOtpSent), which is all the partner's screens need.
 */

const plain = (v) => (v && typeof v.toJSON === 'function' && !(v instanceof Date) ? v.toJSON() : v);

const scrubBooking = (b) => {
    const out = { ...b };
    if ('startOTP' in out) { out.startOtpSent = !!out.startOTP; delete out.startOTP; }
    if ('endOTP' in out) { out.endOtpSent = !!out.endOTP; delete out.endOTP; }
    if (out.workshop && typeof out.workshop === 'object') {
        const w = { ...plain(out.workshop) };
        w.pickupOtpSent = !!w.pickupOTP;
        w.returnOtpSent = !!w.returnOTP;
        delete w.pickupOTP;
        delete w.returnOTP;
        out.workshop = w;
    }
    return out;
};

const looksLikeBooking = (o) => o && typeof o === 'object' && ('startOTP' in o || 'endOTP' in o || 'workshop' in o);

/** Scrubs a response body: a booking, a list of them, or an object holding them. */
const scrub = (body, depth = 0) => {
    const v = plain(body);
    if (Array.isArray(v)) return v.map(item => scrub(item, depth));
    if (!v || typeof v !== 'object' || v instanceof Date) return v;
    if (looksLikeBooking(v)) return scrubBooking(v);
    if (depth >= 2) return v;
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = scrub(val, depth + 1);
    return out;
};

/** Router middleware: applies to whatever the route answers, for providers only. */
const hideBookingOtpsFromProviders = (req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => json(req.user && req.user.role === 'provider' ? scrub(body) : body);
    next();
};

module.exports = { hideBookingOtpsFromProviders, scrub };
