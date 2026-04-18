const express = require('express');
const router = express.Router();
const { getMyServices, createService, updateService, deleteService, createCombo, updateCombo, deleteCombo } = require('../controllers/serviceController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getMyServices);
router.post('/', protect, createService);
router.put('/:id', protect, updateService);
router.delete('/:id', protect, deleteService);

// Combos
router.post('/combos', protect, createCombo);
router.put('/combos/:id', protect, updateCombo);
router.delete('/combos/:id', protect, deleteCombo);

module.exports = router;
