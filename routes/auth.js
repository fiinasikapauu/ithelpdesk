const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest, isAuthenticated } = require('../middleware/authMiddleware');

// GET /auth/login - Show login page
router.get('/login', isGuest, authController.showLogin);

// POST /auth/login - Process login
router.post('/login', isGuest, authController.login);

// GET /auth/logout - Logout user
router.get('/logout', isAuthenticated, authController.logout);

module.exports = router;
