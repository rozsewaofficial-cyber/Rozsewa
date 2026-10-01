// Sign in with Apple, via Apple's own JS SDK in a popup. It hands back an
// identity token (a signed JWT) that the backend verifies at POST /auth/apple.
//
// Apple only allows an https domain registered on the Services ID as the
// redirect — it will not work on plain http://localhost.
const SDK_SRC = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

let sdkPromise;
const loadSdk = () => {
  if (window.AppleID) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { sdkPromise = undefined; reject(new Error("Could not load Apple Sign-In")); };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
};

export const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID;

// Resolves to { identityToken, name } or throws. A person closing the popup is
// reported as { cancelled: true } rather than an error.
export const signInWithApple = async () => {
  await loadSdk();
  window.AppleID.auth.init({
    clientId: appleClientId,
    scope: "name email",
    redirectURI: import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin,
    usePopup: true,
  });
  try {
    const res = await window.AppleID.auth.signIn();
    const identityToken = res?.authorization?.id_token;
    if (!identityToken) throw new Error("Apple did not return a token");
    // Apple sends the name only on a person's first sign-in.
    const n = res.user?.name;
    const name = n ? [n.firstName, n.lastName].filter(Boolean).join(" ") : undefined;
    return { identityToken, name };
  } catch (err) {
    if (err?.error === "popup_closed_by_user" || err?.error === "user_cancelled_authorize") {
      return { cancelled: true };
    }
    throw err;
  }
};
