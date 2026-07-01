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
  getCategories,
  createCategory,
  deleteCategory,
  getChatTemplates,
  createChatTemplate,
  deleteChatTemplate,
  getBazaarSettings,
  updateBazaarSettings,
  editAdAdmin,
  getSellerOfferRequests,
  getUserAds
} = require('../controllers/bazaarController');

// ========================
// PUBLIC / BUYER ROUTES
// ========================
router.get('/live', getLiveAds); // Can add 'protect' if we want only logged-in users to search
router.get('/live/:id', getSingleAd);

// ========================
// BUYER / BIDDING ROUTES
// ========================
router.post('/offer', protect, makeOffer);
router.get('/offer/:adId', protect, getOfferHistory);
router.get('/user-offers', protect, getUserOffers);
router.get('/seller-requests', protect, getSellerOfferRequests);
router.post('/lead/unlock', protect, unlockLead);

// ========================
// SELLER ROUTES
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
router.put('/admin/review/:id', protect, admin, reviewAd);
router.delete('/admin/ads/:id', protect, admin, deleteAd);

// ========================
// CATEGORY ROUTES
// ========================
router.get('/categories', getCategories);
router.post('/admin/categories', protect, admin, createCategory);
router.delete('/admin/categories/:id', protect, admin, deleteCategory);

// ========================
// CHAT TEMPLATE ROUTES
// ========================
router.get('/chat-templates', getChatTemplates);
router.post('/admin/chat-templates', protect, admin, createChatTemplate);
router.delete('/admin/chat-templates/:id', protect, admin, deleteChatTemplate);
router.get('/settings', getBazaarSettings);
router.get('/admin/settings', protect, admin, getBazaarSettings);
router.put('/admin/settings', protect, admin, updateBazaarSettings);

module.exports = router;
