const mongoose = require('mongoose');

/**
 * One translated string. The app's screens are made of a few thousand fixed
 * phrases, so each is translated by Google once and read from here after.
 * `key` is a hash of the language and the source text.
 */
const translationCacheSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    lang: { type: String, required: true },
    source: { type: String, required: true },
    text: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('TranslationCache', translationCacheSchema);
