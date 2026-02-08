const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// @route   POST api/auth/instagram
// @desc    Login with Instagram code
// @access  Public
router.get('/instagram/login', authController.instagramLoginRedirect);
router.post('/instagram', authController.instagramLogin);
router.get('/instagram/callback', authController.instagramCallback);

module.exports = router;
