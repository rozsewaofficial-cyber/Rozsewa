/**
 * Which of its category's services a provider has chosen to offer.
 *
 * Provider.subServices holds the selection made at registration (service
 * names) or by the Sewak "Choose Your Services" screen (names); older admin
 * category syncs wrote catalog ids instead, so both shapes are understood.
 * An empty selection means the provider offers the whole category.
 *
 * A partner who picked one service still appears in the category listing, but
 * only that service shows on its shop page and only that service can be booked.
 */

const key = (v) => String(v || '').trim().toLowerCase();

/**
 * Returns a matcher `(service) => boolean`, or null when the provider offers
 * everything. `categoryServices` (the category's embedded catalog) lets a
 * selection stored as catalog ids match a provider's own copy, which is
 * linked to the catalog by name only.
 */
const serviceScopeFor = (provider, categoryServices = []) => {
    const picked = (provider?.subServices || []).filter(Boolean).map(String);
    if (picked.length === 0) return null;

    const ids = new Set(picked);
    const names = new Set(picked.map(key));
    for (const s of categoryServices) {
        if (s && s._id && ids.has(String(s._id))) names.add(key(s.name));
    }

    return (service) => !!service && (ids.has(String(service._id)) || names.has(key(service.name)));
};

/** A combo is on offer only when every service in it is. */
const comboInScope = (offers, combo) =>
    !offers || (combo.services || []).every(s => s && offers(s));

module.exports = { serviceScopeFor, comboInScope };
