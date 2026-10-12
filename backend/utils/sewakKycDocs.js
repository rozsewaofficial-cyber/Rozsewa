/**
 * What a Sewak's KYC needs verified before approval: Aadhaar, PAN and the
 * live video.
 *
 * Registration stores Aadhaar as two photos, 'aadhaar_front' and
 * 'aadhaar_back' (older accounts may have a single 'aadhaar' document), while
 * the approval rule asked for a document called 'aadhaar' — which a new
 * registration never has — so no Sewak registered since could be approved.
 */
const SEWAK_REQUIRED_DOCS = ['aadhaar', 'pan', 'live_video'];

const isVerified = (docs, id) => docs.some(d => d && d.id === id && d.status === 'verified');

/** Aadhaar: the single document, or the front photo plus the back if one was given. */
const aadhaarVerified = (docs) =>
    isVerified(docs, 'aadhaar') ||
    (isVerified(docs, 'aadhaar_front') && (!docs.some(d => d && d.id === 'aadhaar_back') || isVerified(docs, 'aadhaar_back')));

const requiredDocVerified = (docs, id) => (id === 'aadhaar' ? aadhaarVerified(docs) : isVerified(docs, id));

/** Status shown for a required document that is not verified yet. */
const requiredDocState = (docs, id) => {
    const ids = id === 'aadhaar' ? ['aadhaar', 'aadhaar_front', 'aadhaar_back'] : [id];
    const found = docs.filter(d => d && ids.includes(d.id));
    if (found.some(d => d.status === 'rejected')) return 'rejected';
    if (found.length === 0) return 'missing';
    return found.find(d => d.status !== 'verified')?.status || 'pending';
};

/** Required documents not verified yet, e.g. ['aadhaar (pending)']. */
const missingRequiredDocs = (docs = []) =>
    SEWAK_REQUIRED_DOCS
        .filter(id => !requiredDocVerified(docs, id))
        .map(id => `${id} (${requiredDocState(docs, id)})`);

module.exports = { SEWAK_REQUIRED_DOCS, requiredDocVerified, missingRequiredDocs };
