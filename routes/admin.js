const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

// All admin routes require authentication + admin role
router.use(isAuthenticated);
router.use(isAdmin);

// GET /admin/dashboard - Dashboard with tickets list
router.get('/dashboard', adminController.dashboard);

// GET /admin/ticket/:id - Get ticket detail (API)
router.get('/ticket/:id', adminController.getTicketDetail);

// POST /admin/ticket/update-status - Update ticket status (API)
router.post('/ticket/update-status', adminController.updateTicketStatus);

// POST /admin/ticket/assign-technician - Assign technician (API)
router.post('/ticket/assign-technician', adminController.assignTechnician);

// GET /admin/categories/:requestTypeId - Get categories by request type (API)
router.get('/categories/:requestTypeId', adminController.getCategoriesByRequestType);

// GET /admin/subcategories/:categoryId - Get subcategories by category (API)
router.get('/subcategories/:categoryId', adminController.getSubcategoriesByCategory);

// POST /admin/ticket/update-category - Update ticket category data (API)
router.post('/ticket/update-category', adminController.updateTicketCategory);

// GET /admin/export-csv - Export tickets to CSV
router.get('/export-csv', adminController.exportCSV);

module.exports = router;
