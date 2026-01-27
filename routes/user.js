const express = require('express');
const router = express.Router();
const { isAuthenticated, isUser } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

// All user routes require authentication + user role
router.use(isAuthenticated);
router.use(isUser);

// GET /user/dashboard - redirect to form
router.get('/dashboard', (req, res) => {
    res.redirect('/user/form');
});

// GET /user/form - Ticket submission form
router.get('/form', userController.showForm);

// GET /user/riwayat - Ticket history
router.get('/riwayat', (req, res) => {
    res.render('user/riwayat', {
        title: 'Riwayat Pengaduan - IT Helpdesk',
        user: req.session
    });
});

// API routes for user tickets
router.post('/tickets', userController.createTicket);
router.get('/tickets', userController.getMyTickets);
router.get('/tickets/:id', userController.getTicketDetail);
router.put('/tickets/:id', userController.updateTicket);

module.exports = router;
