function requireAdmin(req, res, next) {
    if (req.session?.role === 'admin') {
        return next();
    }

    return res.status(403).json({ error: 'Admin access required' });
}

module.exports = requireAdmin;
