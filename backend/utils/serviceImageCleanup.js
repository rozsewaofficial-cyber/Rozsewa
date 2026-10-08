/**
 * Removes a service photo from Cloudinary once nothing uses it any more.
 *
 * A partner's service is often shown with the catalog photo admin set, or a
 * photo shared with a combo, so the same URL can belong to many records.
 * A photo is deleted only when it is one of our Cloudinary uploads and no
 * service (partner or catalog), combo, category or subcategory still points
 * at it. Anything else — an outside URL, a photo in use, a failed lookup —
 * is left alone: keeping an unused file is cheap, deleting a used one is not.
 */
const Service = require('../models/Service');
const Combo = require('../models/Combo');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');

/** "rojsewa/kyc/abc123" from https://res.cloudinary.com/<cloud>/image/upload/v1/rojsewa/kyc/abc123.jpg */
const cloudinaryPublicId = (url) => {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloud || typeof url !== 'string') return null;
    const m = url.match(/^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(rojsewa\/[^?#]+?)(?:\.[a-z0-9]+)?(?:[?#].*)?$/i);
    if (!m || m[1] !== cloud) return null;
    return m[2];
};

const stillUsed = async (url, excludeServiceId) => {
    const [service, combo, category, subcategory] = await Promise.all([
        Service.exists({ image: url, ...(excludeServiceId ? { _id: { $ne: excludeServiceId } } : {}) }),
        Combo.exists({ image: url }),
        Category.exists({ $or: [{ image: url }, { 'services.image': url }, { 'combos.image': url }] }),
        Subcategory.exists({ image: url }),
    ]);
    return !!(service || combo || category || subcategory);
};

/** Fire-and-forget: never throws, never delays the response it follows. */
const releaseServiceImage = async (url, { excludeServiceId, destroy } = {}) => {
    try {
        const publicId = cloudinaryPublicId(url);
        if (!publicId) return { released: false, reason: 'not ours' };
        if (await stillUsed(url, excludeServiceId)) return { released: false, reason: 'in use' };
        const remove = destroy || ((id) => require('../config/cloudinary').cloudinary.uploader.destroy(id));
        await remove(publicId);
        return { released: true, publicId };
    } catch (err) {
        console.log('Service image cleanup skipped:', err.message);
        return { released: false, reason: 'error' };
    }
};

module.exports = { releaseServiceImage, cloudinaryPublicId };
