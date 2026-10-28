/**
 * Customer-side Insta Work: the flat/house number is optional, a job shows up
 * under My Bookings, the OTP and a live countdown are on the job card, a timer
 * stopped inside its first minute still bills, and an online payment is
 * settled by the gateway callback and webhook as well as by the page.
 *
 *   node scripts/instaCustomerFixesCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const picker = read('frontend', 'src', 'modules', 'user', 'components', 'InstaLocationPicker.jsx');
const page = read('frontend', 'src', 'modules', 'user', 'pages', 'InstaWork.jsx');
const history = read('frontend', 'src', 'modules', 'user', 'pages', 'ServiceHistory.jsx');
const provider = read('backend', 'controllers', 'instaProviderController.js');
const customer = read('backend', 'controllers', 'instaCustomerController.js');
const payment = read('backend', 'controllers', 'paymentController.js');

check('the house / flat number is optional when confirming a location', () => {
    assert.ok(picker.includes('placeholder="House / Flat No. (optional)"'));
    assert.ok(!/canConfirm[^;]*details\.house/.test(picker), 'house is not required to confirm');
});
check('Insta Work jobs are listed in My Bookings', () => {
    assert.ok(history.includes('API.get("/insta/jobs")'));
    assert.ok(history.includes('data-insta-job'));
});
check('the job card shows the OTP, a free-waiting countdown, an ETA and a running timer', () => {
    assert.ok(page.includes('{activeJob.startOTP}'));
    assert.ok(page.includes('data-insta-grace') && page.includes('data-insta-eta') && page.includes('data-insta-timer'));
    assert.ok(page.includes('setInterval(() => setNowMs(Date.now()), 1000)'));
});
check('work stopped inside its first minute still bills a minute', () => {
    assert.ok(provider.includes('Math.max(1, Pricing.minutesBetween(job.workStartedAt, job.workCompletedAt))'));
});
check('an online payment is finished by the callback and the webhook too, and the checkout is told where to call back', () => {
    assert.ok(customer.includes('settleOnlinePayment'));
    assert.ok(payment.includes("require('./instaCustomerController').settleOnlinePayment"));
    assert.ok(payment.includes('/insta-work?payment='));
    assert.ok(page.includes('callback_url: `${API.defaults.baseURL}/payment/callback`'));
});

check('booking checkout opens Razorpay with the key the server raised the order under, not a built-in test key', () => {
    const checkout = read('frontend', 'src', 'modules', 'user', 'pages', 'Checkout.jsx');
    assert.ok(checkout.includes('key: order.key || import.meta.env.VITE_RAZORPAY_KEY_ID,'));
    assert.ok(!checkout.includes('rzp_test_8sYbzHWidwe5Zw'));
});

check('the booked-time countdown includes extra time the customer approved', () => {
    assert.ok(page.includes('(Number(activeJob.approvedExtraMinutes) || 0)) * 60000 - nowMs'));
});

console.log(`\n${passed} insta customer checks passed.`);
