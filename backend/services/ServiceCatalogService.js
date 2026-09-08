const mongoose = require('mongoose');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Combo = require('../models/Combo');
const Provider = require('../models/Provider');

/**
 * Removing a service from the admin catalog has to reach every copy of it.
 *
 * The catalog is denormalised into four places, none of which hold a foreign
 * key back to the catalog Service document:
 *
 *   1. Category.services[]     — the embedded list Sewak surfaces read from
 *   2. Service{providerId}     — a partner's OWN copy, created when they add
 *                                the service to their shop. Linked to the
 *                                catalog by NAME only, never by id.
 *   3. Provider.subServices[]  — the services a provider offers, stored as
 *                                names by the Sewak selection flow and as ids
 *                                by the admin category sync. Both shapes exist
 *                                in live data, so both are cleaned.
 *   4. Combo.services[]        — ObjectId references that would otherwise
 *                                dangle and populate as null.
 *
 * Deleting only the catalog document (which is all the delete endpoint used to
 * do) left every one of these behind, so a service the admin had removed kept
 * showing to customers on a partner's shop page and kept appearing in the
 * partner's and Sewak's own service lists.
 */

const normalizeKey = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/** Escapes a string so it can be used as a literal inside a RegExp. */
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Removes one catalog service everywhere it has been copied.
 *
 * Provider-owned copies are matched by name, so the match is deliberately
 * scoped to providers in the SAME category — otherwise deleting "Deep Clean"
 * from one industry would wipe an identically named service from another.
 * When the category cannot be determined, provider copies are left alone and
 * reported rather than guessed at.
 *
 * Returns a summary of what was touched, so the caller can surface the blast
 * radius to the admin instead of silently reaching across the database.
 */
const cascadeServiceRemoval = async ({ serviceId, serviceName, categoryId }) => {
    const summary = {
        categoryEntriesRemoved: 0,
        providerCopiesDeleted: 0,
        providerSelectionsCleaned: 0,
        combosUpdated: 0,
        combosDeactivated: 0,
        providerCopiesSkipped: false
    };

    const nameKey = normalizeKey(serviceName);
    const idStr = serviceId ? String(serviceId) : null;

    // 1. The embedded catalog entry on the Category.
    if (categoryId) {
        const category = await Category.findById(categoryId);
        if (category && Array.isArray(category.services)) {
            const before = category.services.length;
            // Keep everything that is NOT this service. The previous version
            // inverted this and dropped any entry that merely lacked an _id, or
            // that shared a name with a different service.
            category.services = category.services.filter(s => {
                const idMatch = idStr && s._id && s._id.toString() === idStr;
                const nameMatch = nameKey && normalizeKey(s.name) === nameKey;
                return !(idMatch || nameMatch);
            });
            summary.categoryEntriesRemoved = before - category.services.length;
            if (summary.categoryEntriesRemoved > 0) {
                category.markModified('services');
                await category.save();
            }
        }
    }

    // 2. Partner-owned copies. Scoped to providers in this category, because
    //    the only link back to the catalog is the service name.
    let providerIds = [];
    if (categoryId) {
        const providers = await Provider.find({ vendorType: categoryId }).select('_id').lean();
        providerIds = providers.map(p => p._id);

        if (providerIds.length > 0 && nameKey) {
            const copies = await Service.deleteMany({
                providerId: { $in: providerIds },
                name: { $regex: `^${escapeRegex(serviceName.trim())}$`, $options: 'i' }
            });
            summary.providerCopiesDeleted = copies.deletedCount || 0;
        }
    } else {
        // No category to scope by — deleting by name alone could reach services
        // in unrelated industries, so leave them and let the caller say so.
        summary.providerCopiesSkipped = true;
    }

    // 3. Provider.subServices. Holds names in some rows and ids in others, so
    //    pull both representations.
    const pullValues = [serviceName, serviceName?.trim()].filter(Boolean);
    if (idStr) pullValues.push(idStr);
    const selectionFilter = categoryId ? { vendorType: categoryId } : {};
    const selectionResult = await Provider.updateMany(
        selectionFilter,
        { $pull: { subServices: { $in: [...new Set(pullValues)] } } }
    );
    summary.providerSelectionsCleaned = selectionResult.modifiedCount || 0;

    // 4. Combos that referenced the service. A combo left with nothing in it is
    //    deactivated rather than deleted, so the partner still sees it and can
    //    decide what to do — silently removing something they priced would be
    //    worse than showing it as inactive.
    if (idStr && mongoose.Types.ObjectId.isValid(idStr)) {
        const affected = await Combo.find({ services: idStr }).select('_id services');
        if (affected.length > 0) {
            const comboUpdate = await Combo.updateMany(
                { services: idStr },
                { $pull: { services: idStr } }
            );
            summary.combosUpdated = comboUpdate.modifiedCount || 0;

            const emptied = await Combo.updateMany(
                { _id: { $in: affected.map(c => c._id) }, services: { $size: 0 }, isActive: true },
                { $set: { isActive: false } }
            );
            summary.combosDeactivated = emptied.modifiedCount || 0;
        }
    }

    return summary;
};

/**
 * Same cascade, for every service under a subcategory. Used when a whole
 * subcategory is removed.
 */
const cascadeSubcategoryRemoval = async (subcategoryId) => {
    const services = await Service.find({ subcategoryId }).select('_id name categoryId').lean();

    const totals = {
        servicesRemoved: services.length,
        categoryEntriesRemoved: 0,
        providerCopiesDeleted: 0,
        providerSelectionsCleaned: 0,
        combosUpdated: 0,
        combosDeactivated: 0
    };

    for (const svc of services) {
        const summary = await cascadeServiceRemoval({
            serviceId: svc._id,
            serviceName: svc.name,
            categoryId: svc.categoryId
        });
        totals.categoryEntriesRemoved += summary.categoryEntriesRemoved;
        totals.providerCopiesDeleted += summary.providerCopiesDeleted;
        totals.providerSelectionsCleaned += summary.providerSelectionsCleaned;
        totals.combosUpdated += summary.combosUpdated;
        totals.combosDeactivated += summary.combosDeactivated;
    }

    // The catalog rows themselves, including any that were not matched above.
    await Service.deleteMany({ subcategoryId });

    return totals;
};

module.exports = { cascadeServiceRemoval, cascadeSubcategoryRemoval, normalizeKey };
