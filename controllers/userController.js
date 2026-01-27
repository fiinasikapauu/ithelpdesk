const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const userController = {
    // GET /user/form - Render ticket submission form with dropdown data from DB
    showForm: async (req, res) => {
        try {
            const [units, requestTypes, categories, subcategories] = await Promise.all([
                prisma.it_helpdesk_units.findMany({
                    orderBy: { unit_name: 'asc' }
                }),
                prisma.it_helpdesk_request_types.findMany({
                    orderBy: { request_type_name: 'asc' }
                }),
                prisma.it_helpdesk_categories.findMany({
                    orderBy: { category_name: 'asc' }
                }),
                prisma.it_helpdesk_subcategories.findMany({
                    orderBy: { subcategory_name: 'asc' }
                })
            ]);

            res.render('user/form', {
                title: 'Buat Pengaduan - IT Helpdesk',
                user: req.session,
                units,
                requestTypes,
                categories,
                subcategories
            });
        } catch (error) {
            console.error('Show user form error:', error);
            return res.status(500).render('error', {
                message: 'Terjadi kesalahan saat memuat form pengaduan',
                error: { status: 500 }
            });
        }
    },

    // POST /user/tickets - Create new ticket for logged in user
    createTicket: async (req, res) => {
        try {
            const { requester, unitKerja, requestType, category, subcategory, subject } = req.body;

            if (!req.session || !req.session.userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            if (!requester || !unitKerja || !requestType || !category || !subcategory || !subject) {
                return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
            }

            const [unit, requestTypeRow, categoryRow, subcategoryRow, statusOpen] = await Promise.all([
                prisma.it_helpdesk_units.findFirst({ where: { unit_name: unitKerja } }),
                prisma.it_helpdesk_request_types.findFirst({ where: { request_type_name: requestType } }),
                prisma.it_helpdesk_categories.findFirst({ where: { category_name: category } }),
                prisma.it_helpdesk_subcategories.findFirst({ where: { subcategory_name: subcategory } }),
                prisma.it_helpdesk_request_statuses.findFirst({ where: { status_name: 'Open' } })
            ]);

            if (!unit) {
                return res.status(400).json({ success: false, message: 'Unit kerja tidak ditemukan di sistem' });
            }
            if (!requestTypeRow) {
                return res.status(400).json({ success: false, message: 'Request type tidak ditemukan di sistem' });
            }
            if (!categoryRow) {
                return res.status(400).json({ success: false, message: 'Category tidak ditemukan di sistem' });
            }
            if (!subcategoryRow) {
                return res.status(400).json({ success: false, message: 'Subcategory tidak ditemukan di sistem' });
            }
            if (!statusOpen) {
                return res.status(500).json({ success: false, message: 'Status Open belum dikonfigurasi di sistem' });
            }

            // Get all ticket IDs to find the max (since string sorting might be incorrect for "10" vs "9")
            // Optimally we'd store ticket_id as Int, but given schema is String:
            const allTicketIds = await prisma.it_helpdesk_tickets.findMany({
                select: { ticket_id: true }
            });

            let nextNumber = 11001; // Default start as requested (example 11000 -> 11001)

            if (allTicketIds.length > 0) {
                // Find max manually
                let maxId = 0;
                let foundNumeric = false;
                allTicketIds.forEach(t => {
                    const num = parseInt(t.ticket_id, 10);
                    if (!isNaN(num)) {
                        foundNumeric = true;
                        if (num > maxId) {
                            maxId = num;
                        }
                    }
                });

                // If we found any numeric IDs, continue from the largest one
                // Otherwise use the default 11001
                if (foundNumeric && maxId > 0) {
                    nextNumber = maxId + 1;
                }
            }

            let attempts = 0;
            const maxAttempts = 3;
            let ticket = null;
            let currentNextNumber = nextNumber;

            // Loop for retry mechanism (optimistic concurrency for custom ID)
            while (attempts < maxAttempts && !ticket) {
                try {
                    const ticketId = String(currentNextNumber);
                    const now = new Date();
                    const tahun = String(now.getFullYear());
                    const bulan = String(now.getMonth() + 1).padStart(2, '0');

                    ticket = await prisma.it_helpdesk_tickets.create({
                        data: {
                            ticket_id: ticketId,
                            requester_name: requester,
                            unit_id: unit.unit_id,
                            request_type_id: requestTypeRow.request_type_id,
                            category_id: categoryRow.category_id,
                            subcategory_id: subcategoryRow.subcategory_id,
                            subject,
                            status_id: statusOpen.status_id,
                            technician_id: null,
                            user_id: req.session.userId,
                            tahun,
                            bulan
                        }
                    });
                } catch (createError) {
                    if (createError.code === 'P2002') {
                        // Unique constraint failed (likely ID collision), try next ID
                        console.warn(`Ticket ID collision for ${currentNextNumber}, retrying...`);
                        currentNextNumber++;
                        attempts++;
                    } else {
                        // Other error, rethrow
                        throw createError;
                    }
                }
            }

            if (!ticket) {
                throw new Error("Failed to generate unique ticket ID after multiple attempts");
            }

            return res.json({
                success: true,
                message: 'Tiket berhasil dibuat',
                ticket: {
                    ticket_id: ticket.ticket_id
                }
            });
        } catch (error) {
            console.error('Create ticket error:', error);
            return res.status(500).json({ success: false, message: 'Gagal membuat tiket' });
        }
    },

    // GET /user/tickets - List tickets for logged in user
    getMyTickets: async (req, res) => {
        try {
            if (!req.session || !req.session.userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            const tickets = await prisma.it_helpdesk_tickets.findMany({
                where: { user_id: req.session.userId },
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
                ]
            });

            const mapped = tickets.map(t => {
                const yearNum = parseInt(t.tahun, 10) || new Date().getFullYear();
                const monthNum = parseInt(t.bulan, 10) || 1;
                const createdAt = new Date(yearNum, monthNum - 1, 1).toISOString();

                return {
                    noTiket: t.ticket_id,
                    bulan: monthNum,
                    tahun: yearNum,
                    requester: t.requester_name,
                    unitKerja: t.unit ? t.unit.unit_name : null,
                    requestType: t.request_type ? t.request_type.request_type_name : null,
                    category: t.category ? t.category.category_name : null,
                    subcategory: t.subcategory ? t.subcategory.subcategory_name : null,
                    subject: t.subject,
                    requestStatus: t.status ? t.status.status_name : null,
                    tanggalDibuat: createdAt,
                    technician: t.technician ? t.technician.technician_name : null
                };
            });

            return res.json({ success: true, tickets: mapped });
        } catch (error) {
            console.error('Get my tickets error:', error);
            return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat tiket' });
        }
    },

    // GET /user/tickets/:id - Get detail ticket milik user
    getTicketDetail: async (req, res) => {
        try {
            if (!req.session || !req.session.userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

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

            if (!ticket || ticket.user_id !== req.session.userId) {
                return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });
            }

            return res.json({ success: true, ticket });
        } catch (error) {
            console.error('Get ticket detail (user) error:', error);
            return res.status(500).json({ success: false, message: 'Gagal mengambil detail tiket' });
        }
    },

    // PUT /user/tickets/:id - Update ticket milik user (misalnya ubah subject, kategori, dll) selama masih Open
    updateTicket: async (req, res) => {
        try {
            if (!req.session || !req.session.userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            const { id } = req.params;
            const { subject, category, subcategory } = req.body;

            const ticket = await prisma.it_helpdesk_tickets.findUnique({ where: { ticket_id: id } });

            if (!ticket || ticket.user_id !== req.session.userId) {
                return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });
            }

            const status = await prisma.it_helpdesk_request_statuses.findUnique({ where: { status_id: ticket.status_id } });
            if (!status || status.status_name.toLowerCase() !== 'open') {
                return res.status(400).json({ success: false, message: 'Tiket hanya bisa diubah ketika status masih Open' });
            }

            const dataToUpdate = {};

            if (subject) {
                dataToUpdate.subject = subject;
            }

            if (category) {
                const categoryRow = await prisma.it_helpdesk_categories.findFirst({ where: { category_name: category } });
                if (!categoryRow) {
                    return res.status(400).json({ success: false, message: 'Category tidak ditemukan di sistem' });
                }
                dataToUpdate.category_id = categoryRow.category_id;
            }

            if (subcategory) {
                const subcategoryRow = await prisma.it_helpdesk_subcategories.findFirst({ where: { subcategory_name: subcategory } });
                if (!subcategoryRow) {
                    return res.status(400).json({ success: false, message: 'Subcategory tidak ditemukan di sistem' });
                }
                dataToUpdate.subcategory_id = subcategoryRow.subcategory_id;
            }

            const updated = await prisma.it_helpdesk_tickets.update({
                where: { ticket_id: id },
                data: dataToUpdate
            });

            return res.json({ success: true, message: 'Tiket berhasil diperbarui', ticket: updated });
        } catch (error) {
            console.error('Update ticket (user) error:', error);
            return res.status(500).json({ success: false, message: 'Gagal memperbarui tiket' });
        }
    }
};

module.exports = userController;
