// Auth middleware for role-based access

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

export function injectUser(req, res, next) {
    res.locals.employee = req.session?.employee || null;
    next();
}
