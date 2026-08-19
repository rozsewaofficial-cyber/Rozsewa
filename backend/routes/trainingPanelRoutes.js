const express = require('express');
const router = express.Router();
const {
    searchSewak,
    viewDocument,
    getRecord,
    verifyItem,
    holdTraining,
    setTopic,
    completeTraining
} = require('../controllers/trainingPanelController');
const { protectAdminOrTrainer } = require('../middleware/authMiddleware');

// Every route accepts either an admin or a trainer token; trainers are
// additionally scoped to their own centre's cities and categories.
router.get('/search', protectAdminOrTrainer, searchSewak);
router.get('/:sewakId', protectAdminOrTrainer, getRecord);
router.post('/:sewakId/view-document', protectAdminOrTrainer, viewDocument);
router.put('/:sewakId/verify-item', protectAdminOrTrainer, verifyItem);
router.put('/:sewakId/hold', protectAdminOrTrainer, holdTraining);
router.put('/:sewakId/topic', protectAdminOrTrainer, setTopic);
router.post('/:sewakId/complete', protectAdminOrTrainer, completeTraining);

module.exports = router;
