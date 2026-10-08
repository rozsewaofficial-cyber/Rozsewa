// Partner registration: account types and the "how do you work" cards each
// one may pick. Keep in step with
// frontend/src/modules/provider/data/partnerModels.js.

const ACCOUNT_TYPES = ['individual', 'business'];

// Card id -> the account types it is offered to.
const PARTNER_MODELS = {
    shop: ['business'],
    hotel: ['business'],
    service_provider: ['individual', 'business'],
    taxi: ['individual', 'business'],
    delivery: ['individual', 'business'],
    tutor_doc: ['individual', 'business'],
    labour: ['individual', 'business'],
    food: ['individual', 'business'],
    property_dealer: ['individual', 'business'],
};

const PARTNER_MODEL_IDS = Object.keys(PARTNER_MODELS);

const isModelFor = (modelId, accountType) =>
    !!PARTNER_MODELS[modelId] && PARTNER_MODELS[modelId].includes(accountType);

/** Keeps only known card ids, once each. */
const cleanModelIds = (ids) =>
    [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter(id => PARTNER_MODEL_IDS.includes(id));

module.exports = { ACCOUNT_TYPES, PARTNER_MODELS, PARTNER_MODEL_IDS, isModelFor, cleanModelIds };
