const crypto = require('crypto');
const vapidKey = "BKaj1FRPsv0u1cXLSKSpl3VDotbIgrN_pPn_3v7wwowIRshUWm6o1q__yd1FYZMV_k7COJf71bS5PHRZx3FDFPY";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  try {
    const rawData = Buffer.from(base64, 'base64').toString('binary');
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    return null;
  }
}

const arr = urlBase64ToUint8Array(vapidKey);
if (arr) {
  console.log("Length:", arr.length);
  
  // Create an ECDH object to verify the public key
  try {
    const ecdh = crypto.createECDH('prime256v1');
    // Buffer from the Uint8Array
    const pubKeyBuffer = Buffer.from(arr);
    
    // ECDH setPublicKey throws an error if the public key is not on the curve
    ecdh.setPublicKey(pubKeyBuffer);
    console.log("VALID: The public key is on the P-256 curve.");
  } catch (err) {
    console.error("INVALID PUBLIC KEY:", err.message);
  }
}
