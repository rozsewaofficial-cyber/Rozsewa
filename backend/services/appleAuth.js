// Verifies the identity token ("id_token") Apple's Sign in with Apple hands the
// browser. Apple signs it with RS256 keys published at a public JWKS URL; the
// token is only trusted if the signature, issuer and audience (our Services
// ID) all check out and it has not expired.
const { createRemoteJWKSet, jwtVerify } = require('jose');

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

let remoteKeys;
const defaultKeys = (...args) => {
    if (!remoteKeys) remoteKeys = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
    return remoteKeys(...args);
};

// `keys` can be swapped for a local key resolver in tests.
const verifyAppleIdentityToken = async (identityToken, clientId, keys = defaultKeys) => {
    const { payload } = await jwtVerify(identityToken, keys, {
        issuer: APPLE_ISSUER,
        audience: clientId,
        algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('Apple token has no subject');
    return {
        appleId: payload.sub,
        email: payload.email ? String(payload.email).trim().toLowerCase() : null,
        // Apple sends this as a string "true" or a boolean depending on the flow.
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    };
};

module.exports = { verifyAppleIdentityToken, APPLE_ISSUER };
