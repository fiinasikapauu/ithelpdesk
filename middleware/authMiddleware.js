const authMiddleware = {
    // Prevent browser caching for protected pages
    noCache: (req, res, next) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        next();
    },

    // Check if user is authenticated - redirect to login if not
    isAuthenticated: (req, res, next) => {
        // Set no-cache headers to prevent back button access after logout
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        if (req.session && req.session.userId) {
            return next();
        }
        // Not authenticated - redirect to login
        return res.redirect('/auth/login');
    },

    // Check if user is admin - redirect to error if not
    isAdmin: (req, res, next) => {
        // Set no-cache headers
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        // Check if logged in first
        if (!req.session || !req.session.userId) {
            return res.redirect('/auth/login');
        }

        // Check if admin role
        if (req.session.userRole === 'admin') {
            return next();
        }

        // Not admin - show error
        return res.status(403).render('error', {
            message: 'Akses Ditolak',
            error: { status: 403 }
        });
    },

    // Check if user is regular user - redirect to error if not
    isUser: (req, res, next) => {
        // Set no-cache headers
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        // Check if logged in first
        if (!req.session || !req.session.userId) {
            return res.redirect('/auth/login');
        }

        // Check if user role
        if (req.session.userRole === 'user') {
            return next();
        }

        // Not user - show error
        return res.status(403).render('error', {
            message: 'Akses Ditolak',
            error: { status: 403 }
        });
    },

    // Check if user is guest (not logged in) - for login page
    isGuest: (req, res, next) => {
        // Set no-cache headers
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        if (req.session && req.session.userId) {
            // Already logged in, redirect to appropriate dashboard
            if (req.session.userRole === 'admin') {
                return res.redirect('/admin/dashboard');
            } else {
                return res.redirect('/user/form');
            }
        }
        return next();
    },

    // Make user data available to all views
    setLocals: (req, res, next) => {
        res.locals.currentUser = null;
        res.locals.isLoggedIn = false;

        if (req.session && req.session.userId) {
            res.locals.currentUser = {
                userId: req.session.userId,
                email: req.session.userEmail,
                role: req.session.userRole
            };
            res.locals.isLoggedIn = true;
        }
        next();
    }
};

module.exports = authMiddleware;
