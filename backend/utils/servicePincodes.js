const Zone = require('../models/Zone');

/**
 * Which PIN codes RozSewa serves.
 *
 * The admin lists the PIN codes of each service city on its zone. Once any
 * active zone lists some, an address outside every list is turned away
 * (Insta Work bookings and lead requests). While no zone lists any, nothing is
 * restricted, so a deployment that has not set them up keeps working as before.
 */
const CACHE_MS = 60 * 1000;
let cache = { at: 0, set: null, cities: [] };

const clean = (pin) => String(pin ?? '').replace(/\D/g, '').slice(0, 6);

/** Valid 6-digit PIN codes out of whatever the admin typed (commas, spaces, lines). */
const parsePincodes = (input) => {
    const parts = Array.isArray(input) ? input : String(input ?? '').split(/[\s,;]+/);
    return [...new Set(parts.map(p => String(p).trim()).filter(p => /^[1-9]\d{5}$/.test(p)))];
};

const load = async () => {
    if (cache.set && Date.now() - cache.at < CACHE_MS) return cache;
    const zones = await Zone.find({ isActive: true }).select('name pincodes').lean();
    const set = new Set();
    for (const z of zones) for (const p of z.pincodes || []) set.add(String(p));
    cache = { at: Date.now(), set, cities: zones.filter(z => (z.pincodes || []).length).map(z => z.name) };
    return cache;
};

/** Forget the cached list (after the admin changes a zone). */
const refresh = () => { cache = { at: 0, set: null, cities: [] }; };

/** The list as the apps need it. */
const summary = async () => {
    const { set, cities } = await load();
    return { restricted: set.size > 0, pincodes: [...set].sort(), cities };
};

/**
 * Is this PIN code one we serve? `required` makes a missing PIN code a
 * refusal too (when restricted), for places where it is always known.
 * Returns null when fine, otherwise the message to show.
 */
const pincodeProblem = async (pincode, { required = false } = {}) => {
    const { set, cities } = await load();
    if (set.size === 0) return null;
    const pin = clean(pincode);
    if (!pin) return required ? 'Enter the PIN code of your address.' : null;
    if (set.has(pin)) return null;
    const where = cities.length ? ` We currently serve ${cities.join(', ')}.` : '';
    return `We do not serve PIN code ${pin} yet.${where}`;
};

module.exports = { parsePincodes, summary, pincodeProblem, refresh };
