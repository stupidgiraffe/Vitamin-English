// Input sanitization middleware
function sanitizeInput(req, res, next) {
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                // Trim whitespace
                req.body[key] = req.body[key].trim();
                
                // Remove dangerous characters but preserve Japanese and other unicode
                // Only remove actual HTML tags
                req.body[key] = req.body[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            }
        }
    }
    next();
}

module.exports = { sanitizeInput };
