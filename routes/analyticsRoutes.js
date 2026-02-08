const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const analyticsController = require('../controllers/analyticsController');

// @route   POST api/analytics/sync
// @desc    Sync followers from Instagram
// @access  Private
router.post('/sync', auth, analyticsController.syncFollowers);

// @route   GET api/analytics/summary
// @desc    Get analytics summary
// @access  Private
router.get('/summary', auth, analyticsController.getAnalyticsSummary);

module.exports = router;
