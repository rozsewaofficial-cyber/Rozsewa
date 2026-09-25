/**
 * Banner note (item 39): "Possible ho to chota sa video upload" — the admin
 * Banner screen only ever supported a static image. This adds an optional
 * short video, capped under 10MB per the clarifying note, reusing the same
 * multer/Cloudinary video pipeline already proven by the provider KYC live-
 * verification-video upload (providerController.uploadLiveVideo) rather than
 * inventing a new one.
 *
 * These pin: the model carries an optional videoUrl; the upload endpoint
 * enforces the 10MB limit server-side (never trusting the client-side check
 * alone); the admin form offers a video picker with its own client-side size
 * guard; and the customer homepage renders a <video> instead of an <img>
 * when a banner has one.
 *
 *   node scripts/bannerVideoUploadCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const model = read('models/Banner.js');
const controller = read('controllers/adminController.js');
const routes = read('routes/adminRoutes.js');
const adminUi = feRead('modules/admin/pages/AdminBanners.jsx');
const customerUi = feRead('modules/user/pages/Index.jsx');

console.log('\nBanner carries an optional video, never required (existing banners keep working)');

check('videoUrl defaults to empty, unlike the required imageUrl', () => {
    assert.ok(/imageUrl: \{ type: String, required: true \}/.test(model));
    assert.ok(/videoUrl: \{ type: String, default: '' \}/.test(model));
});

console.log('\nThe upload endpoint enforces the 10MB limit server-side, reusing the KYC video pipeline');

check('uploadBannerVideo rejects a file over 10MB before ever touching Cloudinary', () => {
    const fn = sliceFn(controller, 'const uploadBannerVideo');
    assert.ok(/req\.file\.size > 10 \* 1024 \* 1024/.test(fn));
    assert.ok(/less than 10MB/.test(fn));
});

check('it streams to Cloudinary as resource_type video, in its own banners folder', () => {
    const fn = sliceFn(controller, 'const uploadBannerVideo');
    assert.ok(/folder: 'rojsewa\/banners', resource_type: 'video'/.test(fn));
});

check('the route reuses the existing uploadVideo multer config (memoryStorage, video-only filter), not a new one', () => {
    assert.ok(/const \{ uploadVideo \} = require\('\.\.\/config\/cloudinary'\)/.test(routes));
    assert.ok(/router\.post\('\/banners\/upload-video', protect, admin, uploadVideo\.single\('video'\), uploadBannerVideo\)/.test(routes));
});

console.log('\nThe admin form offers a video picker with its own client-side size guard');

check('a file over 10MB is rejected client-side before the request is even sent', () => {
    const fn = sliceFn(adminUi, 'const handleVideoUpload');
    assert.ok(/file\.size > MAX_VIDEO_SIZE/.test(fn));
    assert.ok(/less than 10 MB/.test(fn));
});

check('a chosen video is uploaded to the new endpoint and stored on the form', () => {
    const fn = sliceFn(adminUi, 'const handleVideoUpload');
    assert.ok(/\/admin\/banners\/upload-video/.test(fn));
    assert.ok(/setForm\(\{ \.\.\.form, videoUrl: res\.data\.url \}\)/.test(fn));
});

console.log('\nThe customer homepage plays the video instead of the static image when one exists');

check('the banner mapping carries the video through from the API response', () => {
    assert.ok(/video: b\.videoUrl \|\| null/.test(customerUi));
});

check('a <video> renders (autoplay, muted, loop) in place of the <img> when banner.video is set', () => {
    assert.ok(/banner\.video \?/.test(customerUi));
    assert.ok(/src=\{banner\.video\}/.test(customerUi));
    assert.ok(/autoPlay/.test(customerUi) && /muted/.test(customerUi) && /loop/.test(customerUi));
});

console.log(`\n${passed} banner-video-upload checks passed.\n`);
