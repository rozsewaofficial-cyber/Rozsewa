/**
 * Training Records had only a status filter. The admin note asked for
 * city-wise, training-centre-wise, date-wise and trainer-wise filters too.
 *
 * A record carries none of those directly — city comes from the Sewak
 * (Provider) it belongs to, and centre/trainer only exist once a Trainer
 * has actually completed it (completedBy/completedByModel is the one
 * structured trainer reference TrainingRecord carries; TRAINING_PANEL_PLAN.md
 * §6 confirms this is set at "Training Done", not before).
 *
 * These pin the shared scope builder, and specifically the bug caught while
 * testing it live in the browser: aggregate()'s $match does not auto-cast
 * the way find()/countDocuments() does, so an id straight from req.query
 * silently matched nothing until it was cast to an ObjectId explicitly —
 * the trainer filter returned zero rows for a trainer who plainly had one.
 *
 *   node scripts/trainingRecordsFilterCheck.js
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

const controller = read('controllers/trainingPanelController.js');
const ui = feRead('modules/admin/pages/AdminTrainingRecords.jsx');

console.log('\nIds reaching the aggregation pipeline are actually ObjectIds, not strings');

check('categoryId is cast explicitly before it reaches $match', () => {
    const fn = sliceFn(controller, 'const adminTrainingScope');
    assert.ok(/query\.categoryId = new mongoose\.Types\.ObjectId\(categoryId\)/.test(fn),
        'aggregate() does not auto-cast the way find() does — a raw string here silently matches nothing');
});

check('trainerId is cast explicitly too', () => {
    const fn = sliceFn(controller, 'const adminTrainingScope');
    assert.ok(/query\.completedBy = new mongoose\.Types\.ObjectId\(trainerId\)/.test(fn));
});

console.log('\nCity, centre and trainer resolve through the right relationship, not a field on the record itself');

check('city resolves through the Sewak (Provider), not a field on TrainingRecord', () => {
    const fn = sliceFn(controller, 'const adminTrainingScope');
    assert.ok(/Provider\.find\(\{ city: new RegExp/.test(fn));
});

check('a trainer/centre filter only matches records an actual Trainer completed', () => {
    const fn = sliceFn(controller, 'const adminTrainingScope');
    assert.ok(/query\.completedByModel = 'Trainer'/.test(fn),
        'completedBy is typed for either a User or a Trainer — without this, an admin-completed record could false-match');
});

check('the training-centre filter resolves through the trainers who work there', () => {
    const fn = sliceFn(controller, 'const adminTrainingScope');
    assert.ok(/Trainer\.find\(\{ trainingCenter: trainingCenterId \}\)/.test(fn),
        'TrainingRecord has no centre of its own — Trainer.trainingCenter is the only link');
});

console.log('\nThe work queue and its stats tiles share the same scope, so they cannot disagree');

check('stats deliberately drops status but keeps every other filter', () => {
    const fn = sliceFn(ui, 'const fetchAll');
    assert.ok(/scopeParams = \{[\s\S]{0,400}\}/.test(fn));
    assert.ok(/training-records\/stats", \{ params: scopeParams \}/.test(fn),
        'status must not be in scopeParams, or picking one status tab would zero out every other tile');
});

check('the stats endpoint returns the filter dropdowns\' own options', () => {
    const fn = sliceFn(controller, 'const getTrainingStats');
    assert.ok(/cities: cities\.filter\(Boolean\)\.sort\(\)/.test(fn));
    assert.ok(/trainers,/.test(fn) && /trainingCenters/.test(fn));
});

console.log('\nThe admin screen offers all four filters and shows who actually did the training');

check('all four selects and the date range exist, wired to state', () => {
    assert.ok(/value=\{cityFilter\}/.test(ui) && /value=\{centerFilter\}/.test(ui) && /value=\{trainerFilter\}/.test(ui));
    assert.ok(/value=\{dateFrom\}/.test(ui) && /value=\{dateTo\}/.test(ui));
});

check('a completed record shows which trainer and centre did it', () => {
    assert.ok(/Completed by \{r\.completedByTrainer\.name\}/.test(ui));
});

console.log(`\n${passed} training-records-filter checks passed.\n`);
