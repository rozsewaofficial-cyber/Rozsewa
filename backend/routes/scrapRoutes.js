const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  createScrap,
  getMyScrap,
  getAvailableScrap,
  acceptScrap,
  completeScrap,
  getAllScrapAdmin,
  getScrapById,
  deleteScrap,
  listInBazaar,
  getBazaarItems
} = require('../controllers/scrapController');

// User Routes
router.post('/', protect, createScrap);
router.get('/my', protect, getMyScrap);

// Bazaar (must be before /:id)
router.get('/bazaar', protect, getBazaarItems);

// Vendor/Admin Actions - Now Admin Only
router.put('/:id/accept', protect, admin, acceptScrap);
router.put('/:id/complete', protect, admin, completeScrap);
router.put('/:id/list-bazaar', protect, admin, listInBazaar);
router.delete('/:id', protect, deleteScrap); // User can delete their own

// Admin Routes
router.get('/all', protect, admin, getAllScrapAdmin);

// Shared/Specific ID Route
router.get('/:id', protect, getScrapById);

module.exports = router;

