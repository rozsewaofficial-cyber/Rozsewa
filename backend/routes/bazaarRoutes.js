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
  unlockLead,
  getCategories,
  createCategory,
  deleteCategory
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
router.post('/lead/unlock', protect, unlockLead);

// ========================
// SELLER ROUTES
// ========================
router.post('/post', protect, postAd);
router.put('/offer/respond', protect, respondToOffer);

// ========================
// ADMIN ROUTES
// ========================
router.get('/admin/pending', protect, admin, getPendingAds);
router.get('/admin/ads', protect, admin, getAllAdminAds);
router.put('/admin/review/:id', protect, admin, reviewAd);
router.delete('/admin/ads/:id', protect, admin, deleteAd);

// ========================
// CATEGORY ROUTES
// ========================
router.get('/categories', getCategories);
router.post('/categories', protect, admin, createCategory);
router.delete('/categories/:id', protect, admin, deleteCategory);

module.exports = router;
