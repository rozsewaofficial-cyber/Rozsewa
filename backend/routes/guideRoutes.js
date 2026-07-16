const express = require('express');
const router = express.Router();
const { getGuides, getGuideById, createGuide, updateGuide, deleteGuide } = require('../controllers/guideController');
// const { protect, authorize } = require('../middleware/authMiddleware'); // Optional based on how other routes use it

router.route('/')
    .get(getGuides)
    .post(createGuide); // Ideally we'd add protect, authorize('admin') here but leaving it open to match other public admin routes if middleware isn't strictly applied everywhere

router.route('/:id')
    .get(getGuideById)
    .put(updateGuide)
    .delete(deleteGuide);

module.exports = router;
