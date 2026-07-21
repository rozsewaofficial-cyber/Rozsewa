const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  postAd,
  getLiveAds,
  getSingleAd,
  getPendingAds,
  getAllAdminAds,
  reviewAd,
  deleteAd,
  makeOffer,
  respondToOffer,
  getOfferHistory,
  getUserOffers,
  unlockLead,
  checkUnlockStatus,
  getUnlockedContactDetails,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getChatTemplates,
  createChatTemplate,
  updateChatTemplate,
  deleteChatTemplate,
  getBazaarSettings,
  updateBazaarSettings,
  editAdAdmin,
  getSellerOfferRequests,
  getUserAds,
  getBazaarTransactions,
  getPIIViolations,
  getAllBazaarOffersAdmin
} = require('../controllers/bazaarController');

// ========================
// PUBLIC / BUYER ROUTES
// ========================
router.get('/live', getLiveAds);
router.get('/live/:id', getSingleAd);
router.get('/categories', getCategories);

// ========================
// BUYER / BIDDING ROUTES (Protected)
// ========================
router.post('/offer', protect, makeOffer);
router.get('/offer/:adId', protect, getOfferHistory);
router.get('/user-offers', protect, getUserOffers);
router.get('/seller-requests', protect, getSellerOfferRequests);

// ── Unlock Contact (Paid) ──────────────────────────────────────────────────
router.get('/unlock/status/:adId', protect, checkUnlockStatus);         // Check if unlocked + get fee
router.post('/unlock', protect, unlockLead);                             // Pay to unlock (wallet deduction)
router.get('/unlock/contact/:adId', protect, getUnlockedContactDetails); // Securely retrieve contact after unlock

// ========================
// SELLER ROUTES (Protected)
// ========================
router.post('/post', protect, postAd);
router.get('/my-ads', protect, getUserAds);
router.put('/offer/respond', protect, respondToOffer);

// ========================
// ADMIN ROUTES
// ========================
router.get('/admin/pending', protect, admin, getPendingAds);
router.get('/admin/ads', protect, admin, getAllAdminAds);
router.put('/admin/ads/:id', protect, admin, editAdAdmin);
router.put('/admin/review/:id', protect, admin, reviewAd);     // Now accepts unlockFee + adminNote
router.delete('/admin/ads/:id', protect, admin, deleteAd);

// ========================
// CATEGORY ROUTES
// ========================
router.post('/admin/categories', protect, admin, createCategory);
router.put('/admin/categories/:id', protect, admin, updateCategory);
router.delete('/admin/categories/:id', protect, admin, deleteCategory);

// ========================
// CHAT TEMPLATE ROUTES
// ========================
// GET supports ?role=buyer|seller for client-side filtering
router.get('/chat-templates', getChatTemplates);
router.post('/admin/chat-templates', protect, admin, createChatTemplate);
router.put('/admin/chat-templates/:id', protect, admin, updateChatTemplate); // NEW: edit template
router.delete('/admin/chat-templates/:id', protect, admin, deleteChatTemplate);

// ========================
// SETTINGS
// ========================
router.get('/settings', getBazaarSettings);
router.get('/admin/settings', protect, admin, getBazaarSettings);
router.put('/admin/settings', protect, admin, updateBazaarSettings);

// ========================
// TRANSACTIONS & VIOLATIONS & INSPECTION
// ========================
router.get('/admin/transactions', protect, admin, getBazaarTransactions);
router.get('/admin/violations', protect, admin, getPIIViolations);
router.get('/admin/offers', protect, admin, getAllBazaarOffersAdmin);

module.exports = router;
