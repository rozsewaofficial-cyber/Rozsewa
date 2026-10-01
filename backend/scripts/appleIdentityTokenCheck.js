/**
 * Sign in with Apple: the backend trusts an identity token only if its
 * signature, issuer, audience and expiry all check out. This signs tokens with
 * a throwaway local RSA key and runs them through the real verifier (with the
 * key lookup swapped for the local key), so it exercises the actual crypto —
 * nothing here contacts Apple.
 *
 *   node scripts/appleIdentityTokenCheck.js
 */
const assert = require('assert');
const { generateKeyPair, SignJWT } = require('jose');
const { verifyAppleIdentityToken, APPLE_ISSUER } = require('../services/appleAuth');

const CLIENT = 'com.rozsewa.web';
let passed = 0;
const check = async (label, fn) => { await fn(); passed += 1; console.log(`  ok  ${label}`); };

(async () => {
    const good = await generateKeyPair('RS256');
    const other = await generateKeyPair('RS256');
    const keys = async () => good.publicKey;
    const sign = (claims, { key = good.privateKey, alg = 'RS256', iss = APPLE_ISSUER, aud = CLIENT, exp = '5m' } = {}) =>
        new SignJWT(claims).setProtectedHeader({ alg }).setIssuer(iss).setAudience(aud).setSubject(claims.sub || 'apple-user-1').setIssuedAt().setExpirationTime(exp).sign(key);
    const rejects = async (token) => { let threw = false; try { await verifyAppleIdentityToken(token, CLIENT, keys); } catch (e) { threw = true; } assert.ok(threw, 'token should have been rejected'); };

    console.log('\nA genuine Apple-shaped token is accepted');
    await check('returns the Apple id, lower-cased email and verified flag', async () => {
        const id = await verifyAppleIdentityToken(await sign({ email: 'Person@Example.COM', email_verified: 'true' }), CLIENT, keys);
        assert.deepStrictEqual(id, { appleId: 'apple-user-1', email: 'person@example.com', emailVerified: true });
    });
    await check('a repeat sign-in without an email still verifies (Apple only sends it the first time)', async () => {
        const id = await verifyAppleIdentityToken(await sign({}), CLIENT, keys);
        assert.strictEqual(id.email, null);
        assert.strictEqual(id.emailVerified, false);
    });

    console.log('\nForged or mismatched tokens are rejected');
    await check('signed with someone else\'s key', async () => rejects(await sign({}, { key: other.privateKey })));
    await check('issued for a different app (wrong audience)', async () => rejects(await sign({}, { aud: 'com.someone.else' })));
    await check('not issued by Apple', async () => rejects(await sign({}, { iss: 'https://evil.example.com' })));
    await check('expired', async () => rejects(await sign({}, { exp: Math.floor(Date.now() / 1000) - 60 })));
    await check('garbage', async () => rejects('not.a.jwt'));

    console.log(`\n${passed} apple-identity-token checks passed.\n`);
})().catch((e) => { console.error(e); process.exit(1); });
