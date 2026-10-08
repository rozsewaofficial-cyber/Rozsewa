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

    // A service the partner added themselves (Add Service) is one they offer,
    // whatever they picked at registration: only Sewaks ever had services
    // created for them. Without this, a partner who picked one service at
    // registration had every service they added later hidden from customers
    // ("No specific services listed") and refused at booking.
    const ownerId = String(provider?._id || '');
    const ownService = (service) => {
        const by = service.providerId && (service.providerId._id || service.providerId);
        return !!by && String(by) === ownerId;
    };

    return (service) => !!service && (ownService(service) || ids.has(String(service._id)) || names.has(key(service.name)));
};

/**
 * A service name reduced to letters and digits, so a partner's own copy
 * ("✨ Highlights", "Hair  Cut") matches the catalog entry it was made from
 * ("Highlights", "Hair cut") — the copy is linked to the catalog by name only.
 */
const serviceNameKey = (name) =>
    String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

/** A combo is on offer only when every service in it is. */
const comboInScope = (offers, combo) =>
    !offers || (combo.services || []).every(s => s && offers(s));

module.exports = { serviceScopeFor, comboInScope, serviceNameKey };
