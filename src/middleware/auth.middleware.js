// Auth middleware for role-based access

// All employee positions
const ALL_ROLES = ['RECEP', 'VET', 'SALES', 'MGR', 'DIRECTOR'];

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session?.employee) {
            return res.redirect('/login');
        }
        const pos = req.session.employee.position?.trim();
        if (roles.includes(pos)) return next();
        res.status(403).render('error', {
            title: 'Truy cập bị từ chối',
            message: 'Bạn không có quyền truy cập trang này.'
        });
    };
}

// Allow any logged-in employee (all roles)
export function requireAnyEmployee() {
    return requireRole(...ALL_ROLES);
}

export function injectUser(req, res, next) {
    res.locals.employee = req.session?.employee || null;
    next();
}
