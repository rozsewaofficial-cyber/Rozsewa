/**
 * A partner's service photo: their own upload or the catalog photo, saved
 * on that service, kept on edit unless replaced, and removed from storage
 * once nothing uses it.
 *
 *   node scripts/serviceImageCheck.js
 *
 * Runs the real code with the models and Cloudinary stubbed; nothing is
 * uploaded or deleted.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('mongoose').set('bufferCommands', false);
process.env.CLOUDINARY_CLOUD_NAME = 'rozcloud';
const Service = require('../models/Service');
const Combo = require('../models/Combo');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Provider = require('../models/Provider');
const { releaseServiceImage, cloudinaryPublicId } = require('../utils/serviceImageCleanup');
// Never reach the real storage from a check.
const cloudDestroyed = [];
require('../config/cloudinary').cloudinary.uploader.destroy = async (id) => { cloudDestroyed.push(id); return { result: 'ok' }; };

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

const OURS = 'https://res.cloudinary.com/rozcloud/image/upload/v1712345678/rojsewa/kyc/abc123.jpg';
let used = {};
Service.exists = async (q) => (used.service && q._id?.$ne !== used.service ? { _id: 'x' } : null);
Combo.exists = async () => (used.combo ? { _id: 'c' } : null);
Category.exists = async () => (used.category ? { _id: 'k' } : null);
Subcategory.exists = async () => null;

(async () => {
    await check('only our own Cloudinary uploads are ever candidates', async () => {
        assert.strictEqual(cloudinaryPublicId(OURS), 'rojsewa/kyc/abc123');
        assert.strictEqual(cloudinaryPublicId('https://res.cloudinary.com/othercloud/image/upload/v1/rojsewa/kyc/a.jpg'), null);
        assert.strictEqual(cloudinaryPublicId('https://images.unsplash.com/photo-1?w=400'), null);
        assert.strictEqual(cloudinaryPublicId('https://res.cloudinary.com/rozcloud/image/upload/v1/other/folder/a.jpg'), null);
    });

    await check('an unused photo is deleted; one still used anywhere is kept', async () => {
        const destroyed = [];
        const destroy = async (id) => destroyed.push(id);
        used = {};
        assert.strictEqual((await releaseServiceImage(OURS, { destroy })).released, true);
        used = { combo: true };
        assert.strictEqual((await releaseServiceImage(OURS, { destroy })).released, false);
        used = { category: true }; // the catalog photo admin set
        assert.strictEqual((await releaseServiceImage(OURS, { destroy })).released, false);
        used = { service: 'other' }; // another partner's service
        assert.strictEqual((await releaseServiceImage(OURS, { destroy, excludeServiceId: 's1' })).released, false);
        used = {};
        assert.strictEqual((await releaseServiceImage('https://images.unsplash.com/x', { destroy })).released, false);
        assert.deepStrictEqual(destroyed, ['rojsewa/kyc/abc123']);
    });

    await check('a storage error never breaks the request', async () => {
        used = {};
        const r = await releaseServiceImage(OURS, { destroy: async () => { throw new Error('cloud down'); } });
        assert.strictEqual(r.released, false);
    });

    // The controller: photo saved per service, kept on edit, released on replace / delete.
    const ctrl = require('../controllers/serviceController');
    const call = (fn, body, params = {}) => new Promise((resolve) => {
        const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
        fn({ body, params, user: { _id: 'p1', vendorType: 'c1' } }, res);
    });
    const lean = (v) => ({ lean: async () => v });
    Provider.findById = () => lean({ _id: 'p1', providerCategory: 'partner', vendorType: 'c1' });
    // The partner's category catalog (services can only come from it).
    // Subcategories of the category (none here).
    require('../models/Subcategory').find = () => ({ select: () => ({ lean: async () => [] }) });
    Category.findById = () => lean({ _id: 'c1', name: 'Electrician', services: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
    Service.find = () => ({ select: () => ({ lean: async () => [] }) });

    await check("each service is saved with its own photo, and a non-link photo is refused", async () => {
        const made = [];
        Service.create = async (d) => { made.push(d); return { ...d, toObject() { return { ...d }; } }; };
        await call(ctrl.createService, { name: 'A', price: 100, duration: '1 hour', image: 'https://x/a.jpg' });
        await call(ctrl.createService, { name: 'B', price: 100, duration: '1 hour', image: 'https://x/b.jpg' });
        assert.deepStrictEqual(made.map(m => m.image), ['https://x/a.jpg', 'https://x/b.jpg']);
        const bad = await call(ctrl.createService, { name: 'C', price: 100, image: 'data:image/png;base64,AAAA' });
        assert.strictEqual(bad.code, 400);
    });

    await check('editing without a new photo keeps it; replacing releases the old one', async () => {
        const svc = { _id: 's1', providerId: 'p1', name: 'A', price: 100, image: OURS, save: async function () { return this; } };
        Service.findById = async () => svc;
        used = {};
        await call(ctrl.updateService, { price: 150 }, { id: 's1' });
        assert.strictEqual(svc.image, OURS, 'kept when no photo is sent');
        await call(ctrl.updateService, { image: 'https://x/new.jpg' }, { id: 's1' });
        assert.strictEqual(svc.image, 'https://x/new.jpg');
        await new Promise(r => setImmediate(r));
        assert.deepStrictEqual(cloudDestroyed, ['rojsewa/kyc/abc123'], 'the replaced upload was released');
        const src = read('backend', 'controllers', 'serviceController.js');
        assert.ok(/if \(replacedImage\) releaseServiceImage\(replacedImage\)/.test(src));
        assert.ok(/if \(service\.image\) releaseServiceImage\(service\.image, \{ excludeServiceId: service\._id \}\)/.test(src), 'delete releases the photo');
    });

    await check('the form says which photo customers see and checks the file', async () => {
        const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderServices.jsx');
        assert.ok(/RozSewa catalog photo/.test(page) && /"Your photo"/.test(page));
        assert.ok(/Use catalog photo/.test(page) && /Replace photo/.test(page));
        assert.ok(/PHOTO_TYPES\.includes/.test(page) && /MAX_PHOTO_MB \* 1024 \* 1024/.test(page));
        assert.ok(/setPhotoError\(/.test(page));
    });

    await check("admin sees the partner's services with their photos", async () => {
        const routes = read('backend', 'routes', 'adminRoutes.js');
        assert.ok(/router\.get\('\/providers\/:id\/services', protect, admin, getProviderServicesForAdmin\)/.test(routes));
        const page = read('frontend', 'src', 'modules', 'admin', 'pages', 'AdminProviders.jsx');
        assert.ok(/<ServiceVisual src=\{svc\.image\}/.test(page));
    });

    await check('listed for one service, a partner card shows their photo of it', async () => {
        const home = read('backend', 'controllers', 'homeController.js');
        assert.ok(/\.select\('name price image providerId'\)/.test(home));
        assert.ok(/matchedService = \{ _id: offered\._id, name: offered\.name, price: offered\.price, image: offered\.image \|\| undefined \}/.test(home));
        const listing = read('frontend', 'src', 'modules', 'user', 'pages', 'ShopListing.jsx');
        assert.ok(/image: p\.matchedService\?\.image \|\| p\.profileImage/.test(listing));
    });

    await check('a HEIC upload is saved under a .jpg link browsers can show', async () => {
        const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderServices.jsx');
        assert.ok(/replace\(\/\\\.\(heic\|heif\)\(\\\?\|\$\)\/i, "\.jpg\$2"\)/.test(page));
        assert.strictEqual(cloudinaryPublicId(OURS.replace('.jpg', '.heic')), 'rojsewa/kyc/abc123', 'cleanup still finds it');
    });

    console.log(`\n${passed} service image checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
