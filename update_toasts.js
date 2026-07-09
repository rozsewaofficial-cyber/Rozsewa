const fs = require('fs');
const files = [
  { path: 'd:/Rojsewa-main/frontend/src/modules/user/pages/PostService.jsx', toast: 'toast({ title: "Payment Successful", description: "Your payment was processed successfully (Simulated).", variant: "default" });' },
  { path: 'd:/Rojsewa-main/frontend/src/modules/user/pages/LiveTracking.jsx', toast: 'toast({ title: "Payment Successful", description: "Your payment was processed successfully (Simulated).", variant: "default" });' },
  { path: 'd:/Rojsewa-main/frontend/src/modules/user/pages/Checkout.jsx', toast: 'toast({ title: "Payment Successful", description: "Your payment was processed successfully (Simulated).", variant: "default" });' },
  { path: 'd:/Rojsewa-main/frontend/src/modules/provider/pages/ProviderWallet.jsx', toast: 'toast({ title: "Money Added! 🎉", description: "Amount successfully added to your wallet (Simulated).", variant: "default" });' },
  { path: 'd:/Rojsewa-main/frontend/src/modules/provider/pages/ProviderSubscriptions.jsx', toast: 'toast({ title: "Subscription Active", description: "Your subscription was activated successfully (Simulated).", variant: "default" });' },
  { path: 'd:/Rojsewa-main/frontend/src/modules/provider/pages/ProviderLeads.jsx', toast: 'toast({ title: "Lead Unlocked", description: "Lead details unlocked successfully (Simulated).", variant: "default" });' },
  { path: 'd:/Rojsewa-main/frontend/src/modules/user/pages/BazaarOfferChat.jsx', toast: 'toast({ title: "Offer Unlocked", description: "Offer details unlocked successfully (Simulated).", variant: "default" });' }
];

files.forEach(f => {
  if (fs.existsSync(f.path)) {
    let content = fs.readFileSync(f.path, 'utf8');
    content = content.replace(/toast\(\{\s*title:\s*"Payments Disabled",\s*description:\s*"Online payments are temporarily disabled\.",\s*variant:\s*"destructive"\s*\}\);/g, f.toast);
    fs.writeFileSync(f.path, content);
    console.log('Updated ' + f.path);
  }
});
