const mongoose = require('mongoose');

/**
 * A short-lived hand-off for redirect-mode sign-in (Google on iPhone).
 *
 * In redirect mode the provider posts the credential to the server instead of
 * returning it to the page, so the server has to hand the result back across a
 * page load. The page first opens a hand-off (getting a nonce that Google signs
 * into the ID token), the server stores the signed-in result against a random
 * one-time code, and the page swaps that code — together with its nonce — for
 * the session. The nonce ties the code to the browser that started the sign-in,
 * so a code sent to someone else in a link is useless to them.
 */
const authHandoffSchema = new mongoose.Schema({
    kind: { type: String, enum: ['google'], required: true },
    nonce: { type: String, required: true, unique: true },
    returnOrigin: { type: String, required: true },
    // sha256 of the one-time code, set once the provider's post arrives.
    codeHash: { type: String, default: null, index: true },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

// Expired hand-offs are removed by MongoDB itself.
authHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AuthHandoff', authHandoffSchema);
