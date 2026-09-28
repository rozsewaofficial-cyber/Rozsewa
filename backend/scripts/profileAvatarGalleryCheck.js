/**
 * Customer complaint: tapping the pencil icon on Edit Profile's avatar to
 * change the photo only opened the front camera directly — there was no
 * option to pick an existing photo from the gallery.
 *
 * The file input had `capture="user"`, which tells mobile browsers to skip
 * their normal "Camera or Gallery" chooser and launch the front camera
 * straight away. Dropping `capture` restores that chooser.
 *
 *   node scripts/profileAvatarGalleryCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/Profile.jsx');

console.log('\nEdit Profile\'s avatar picker offers the gallery, not just the camera');

check('the avatar file input has no capture attribute forcing the camera', () => {
    const inputLine = page.split('\n').find(l => l.includes('type="file"') && l.includes('handleImageUpload'));
    assert.ok(inputLine, 'the avatar upload input exists');
    assert.ok(!/capture=/.test(inputLine),
        'capture="user"/"environment" skips the OS chooser and opens a camera directly, hiding the gallery option');
    assert.ok(/accept="image\/\*"/.test(inputLine), 'still scoped to images only');
});

console.log(`\n${passed} profile-avatar-gallery checks passed.\n`);
