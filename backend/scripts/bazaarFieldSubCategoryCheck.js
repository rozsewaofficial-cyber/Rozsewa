/**
 * A Bazaar category's dynamic fields applied to the whole category — no way
 * to say a field ("Screen Size") only belongs to one of its subcategories
 * ("TVs"), not the others ("Mobiles", "Laptops") sharing the same category.
 * Every field showed up on every subcategory's posting form regardless.
 *
 * These pin: the field schema carries an optional subCategory (blank means
 * every subcategory, the same convention subCategoryUnlockFees already
 * uses), the admin "Add New Dynamic Field" modal offers a subcategory
 * picker scoped to the selected category's own list, the fields table shows
 * each field's scope, and the seller's posting form (AddScrap.jsx) actually
 * filters which fields render — and which are validated as required — by
 * the subcategory chosen, not just by category.
 *
 *   node scripts/bazaarFieldSubCategoryCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const model = read('models/BazaarCategory.js');
const adminUi = feRead('modules/admin/pages/AdminBazaar.jsx');
const postUi = feRead('modules/user/pages/Scrap/AddScrap.jsx');

console.log('\nA field can be scoped to one subcategory');

check('the schema carries it, blank by default (applies to every subcategory)', () => {
    const fn = model.slice(model.indexOf('fields: ['), model.indexOf('fields: [') + 700);
    assert.ok(/subCategory: \{ type: String, trim: true, default: '' \}/.test(fn));
});

check('updateCategory saves the fields array whole, so subCategory passes through without extra wiring', () => {
    const fn = read('controllers/bazaarController.js');
    const updateCat = fn.slice(fn.indexOf('exports.updateCategory'), fn.indexOf('exports.deleteCategory'));
    assert.ok(/if \(fields\) category\.fields = fields;/.test(updateCat));
});

console.log('\nThe admin can actually set it from the Add Field modal');

check('a subcategory select exists, scoped to the selected category\'s own subcategories', () => {
    assert.ok(/Applies To \(Subcategory\)/.test(adminUi));
    assert.ok(/selectedCat\.subCategories\.map\(sub =>/.test(adminUi));
});

check('the value round-trips: prefilled on edit, included on save', () => {
    assert.ok(/subCategory: field\.subCategory \|\| ''/.test(adminUi), 'prefilled when editing an existing field');
    assert.ok(/subCategory: fieldForm\.subCategory \|\| ''/.test(adminUi), 'included in what gets saved');
});

check('the fields table shows each field\'s scope', () => {
    assert.ok(/<th className="px-4 py-3 text-left">Subcategory<\/th>/.test(adminUi));
});

console.log('\nThe seller\'s posting form actually respects the scope, not just the admin table');

check('a derived visibleFields filters by the chosen subcategory', () => {
    assert.ok(/const visibleFields = selectedCategoryFields\.filter\(/.test(postUi));
    assert.ok(/!f\.subCategory \|\| f\.subCategory === \(formData\.subCategory \|\| ''\)/.test(postUi));
});

check('both the required-field validation and the rendered inputs use it, not the unfiltered list', () => {
    assert.ok(/for \(const field of visibleFields\)/.test(postUi),
        'a field hidden for this subcategory should not block submission for being "required"');
    assert.ok(/visibleFields\.length > 0/.test(postUi) && /visibleFields\.map\(\(field\) =>/.test(postUi));
});

console.log(`\n${passed} bazaar-field-subcategory checks passed.\n`);
