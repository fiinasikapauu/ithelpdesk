const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authController = {
    // Render login page
    showLogin: (req, res) => {
        // Set no-cache headers
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        res.render('auth/login', {
            title: 'Login - IT Helpdesk',
            error: null
        });
    },

    // Handle login POST request
    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.render('auth/login', {
                    title: 'Login - IT Helpdesk',
                    error: 'Email dan password harus diisi'
                });
            }

            // Find user by email
            const user = await prisma.it_helpdesk_users.findUnique({
                where: { email: email }
            });

            console.log('Login attempt for:', email);
            console.log('User found:', user ? 'Yes' : 'No');

            if (!user) {
                return res.render('auth/login', {
                    title: 'Login - IT Helpdesk',
                    error: 'Email atau password salah'
                });
            }

            console.log('User role from DB:', user.role);

            // Compare password - check if bcrypt hash or plain text
            let isValidPassword = false;

            // Check if password is bcrypt hashed (starts with $2)
            if (user.password.startsWith('$2')) {
                isValidPassword = await bcrypt.compare(password, user.password);
            } else {
                // Plain text comparison for testing
                isValidPassword = (password === user.password);
            }

            if (!isValidPassword) {
                return res.render('auth/login', {
                    title: 'Login - IT Helpdesk',
                    error: 'Email atau password salah'
                });
            }

            // Create session
            req.session.userId = user.user_id;
            req.session.userEmail = user.email;
            req.session.userRole = user.role;

            console.log('Session created with role:', req.session.userRole);

            // Redirect based on role
            if (user.role === 'admin') {
                console.log('Redirecting to admin dashboard');
                return res.redirect('/admin/dashboard');
            } else {
                console.log('Redirecting to user form');
                return res.redirect('/user/form');
            }

        } catch (error) {
            console.error('Login error:', error);
            return res.render('auth/login', {
                title: 'Login - IT Helpdesk',
                error: 'Terjadi kesalahan sistem'
            });
        }
    },

    // Handle logout
    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
            }
            // Clear cookie
            res.clearCookie('connect.sid');
            res.redirect('/auth/login');
        });
    }
};

module.exports = authController;
