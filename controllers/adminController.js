const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to get current time (system is already in WIB)
function getWIBDate() {
    return new Date();
}

const adminController = {
    // GET /admin/dashboard - Show dashboard with tickets
    dashboard: async (req, res) => {
        try {
            // Get filter parameters from query
            const { status, unit, bulan, tahun, search, page, limit } = req.query;

            // Pagination parameters
            const currentPage = parseInt(page) || 1;
            const itemsPerPage = parseInt(limit) || 25; // Default 25 tickets per page
            const skip = (currentPage - 1) * itemsPerPage;

            // Build where clause for filtering
            let whereClause = {};

            if (status && status !== '') {
                whereClause.status_id = status;
            }
            if (unit && unit !== '') {
                whereClause.unit_id = unit;
            }
            if (bulan && bulan !== '') {
                whereClause.bulan = bulan;
            }
            if (tahun && tahun !== '') {
                whereClause.tahun = tahun;
            }
            if (search && search !== '') {
                whereClause.OR = [
                    { ticket_id: { contains: search } },
                    { subject: { contains: search } },
                    { requester_name: { contains: search } }
                ];
            }

            // Get total count for pagination
            const totalTickets = await prisma.it_helpdesk_tickets.count({
                where: whereClause
            });

            // Calculate total pages
            const totalPages = Math.ceil(totalTickets / itemsPerPage);

            // Fetch tickets with pagination and relations
            const tickets = await prisma.it_helpdesk_tickets.findMany({
                where: whereClause,
                include: {
                    unit: true,
                    category: true,
                    subcategory: true,
                    status: true,
                    technician: true,
                    request_type: true
                },
                orderBy: [
                    { tahun: 'desc' },
                    { bulan: 'desc' },
                    { ticket_id: 'desc' }
                ],
                skip: skip,
                take: itemsPerPage
            });

            // Fetch filter options
            const statuses = await prisma.it_helpdesk_request_statuses.findMany();
            const units = await prisma.it_helpdesk_units.findMany();
            const technicians = await prisma.it_helpdesk_technicians.findMany();
            const requestTypes = await prisma.it_helpdesk_request_types.findMany();
            const categories = await prisma.it_helpdesk_categories.findMany();
            const subcategories = await prisma.it_helpdesk_subcategories.findMany();

            // Get unique years from tickets
            const years = await prisma.it_helpdesk_tickets.findMany({
                select: { tahun: true },
                distinct: ['tahun'],
                orderBy: { tahun: 'desc' }
            });

            // Count tickets by status (from current filtered results)
            const ticketCounts = {
                total: totalTickets,
                open: tickets.filter(t => t.status?.status_name?.toLowerCase() === 'open').length,
                onHold: tickets.filter(t => t.status?.status_name?.toLowerCase() === 'on hold').length,
                closed: tickets.filter(t => t.status?.status_name?.toLowerCase() === 'closed').length
            };

            res.render('admin/dashboard', {
                title: 'Admin Dashboard - LPS Helpdesk',
                user: req.session,
                tickets,
                statuses,
                units,
                technicians,
                requestTypes,
                categories,
                subcategories,
                years: years.map(y => y.tahun),
                ticketCounts,
                filters: { status, unit, bulan, tahun, search },
                pagination: {
                    currentPage,
                    totalPages,
                    totalTickets,
                    itemsPerPage,
                    hasNextPage: currentPage < totalPages,
                    hasPrevPage: currentPage > 1
                }
            });

        } catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).render('error', {
                message: 'Terjadi kesalahan saat memuat dashboard',
                error: { status: 500 }
            });
        }
    },

    // POST /admin/ticket/update-status - Update ticket status
    updateTicketStatus: async (req, res) => {
        try {
            const { ticketId, statusId } = req.body;

            await prisma.it_helpdesk_tickets.update({
                where: { ticket_id: ticketId },
                data: { status_id: statusId, log_status: getWIBDate() }
            });

            res.json({ success: true, message: 'Status berhasil diperbarui' });
        } catch (error) {
            console.error('Update status error:', error);
            res.status(500).json({ success: false, message: 'Gagal memperbarui status' });
        }
    },

    // POST /admin/ticket/assign-technician - Assign technician to ticket
    assignTechnician: async (req, res) => {
        try {
            const { ticketId, technicianId } = req.body;

            await prisma.it_helpdesk_tickets.update({
                where: { ticket_id: ticketId },
                data: { technician_id: technicianId, log_technician: getWIBDate() }
            });

            res.json({ success: true, message: 'Teknisi berhasil ditugaskan' });
        } catch (error) {
            console.error('Assign technician error:', error);
            res.status(500).json({ success: false, message: 'Gagal menugaskan teknisi' });
        }
    },

    // GET /admin/ticket/:id - Get ticket detail
    getTicketDetail: async (req, res) => {
        try {
            const { id } = req.params;

            const ticket = await prisma.it_helpdesk_tickets.findUnique({
                where: { ticket_id: id },
                include: {
                    unit: true,
                    category: true,
                    subcategory: true,
                    status: true,
                    technician: true,
                    request_type: true,
                    user: true
                }
            });

            if (!ticket) {
                return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });
            }

            res.json({ success: true, ticket });
        } catch (error) {
            console.error('Get ticket detail error:', error);
            res.status(500).json({ success: false, message: 'Gagal mengambil detail tiket' });
        }
    },

    // GET /admin/categories/:requestTypeId - Get categories by request type
    getCategoriesByRequestType: async (req, res) => {
        try {
            const { requestTypeId } = req.params;

            const categories = await prisma.it_helpdesk_categories.findMany({
                where: { request_type_id: requestTypeId }
            });

            res.json({ success: true, categories });
        } catch (error) {
            console.error('Get categories error:', error);
            res.status(500).json({ success: false, message: 'Gagal mengambil kategori' });
        }
    },

    // GET /admin/subcategories/:categoryId - Get subcategories by category
    getSubcategoriesByCategory: async (req, res) => {
        try {
            const { categoryId } = req.params;

            const subcategories = await prisma.it_helpdesk_subcategories.findMany({
                where: { category_id: categoryId }
            });

            res.json({ success: true, subcategories });
        } catch (error) {
            console.error('Get subcategories error:', error);
            res.status(500).json({ success: false, message: 'Gagal mengambil subkategori' });
        }
    },

    // POST /admin/ticket/update-category - Update ticket request type, category, subcategory
    updateTicketCategory: async (req, res) => {
        try {
            const { ticketId, requestTypeId, categoryId, subcategoryId } = req.body;

            await prisma.it_helpdesk_tickets.update({
                where: { ticket_id: ticketId },
                data: {
                    request_type_id: requestTypeId,
                    category_id: categoryId,
                    subcategory_id: subcategoryId
                }
            });

            res.json({ success: true, message: 'Kategori tiket berhasil diperbarui' });
        } catch (error) {
            console.error('Update ticket category error:', error);
            res.status(500).json({ success: false, message: 'Gagal memperbarui kategori tiket' });
        }
    },

    // GET /admin/export-csv - Export tickets to CSV
    exportCSV: async (req, res) => {
        try {
            const tickets = await prisma.it_helpdesk_tickets.findMany({
                include: {
                    unit: true,
                    category: true,
                    subcategory: true,
                    status: true,
                    technician: true
                },
                orderBy: { ticket_id: 'desc' }
            });

            // Create CSV content
            let csv = 'No Tiket,Subject,Unit Kerja,Kategori,Sub Kategori,Requester,Status,Teknisi\n';

            tickets.forEach(ticket => {
                csv += `"${ticket.ticket_id}","${ticket.subject}","${ticket.unit?.unit_name || ''}","${ticket.category?.category_name || ''}","${ticket.subcategory?.subcategory_name || ''}","${ticket.requester_name}","${ticket.status?.status_name || ''}","${ticket.technician?.technician_name || 'Belum ditugaskan'}"\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=tickets.csv');
            res.send(csv);

        } catch (error) {
            console.error('Export CSV error:', error);
            res.status(500).json({ success: false, message: 'Gagal export CSV' });
        }
    }
};

module.exports = adminController;
