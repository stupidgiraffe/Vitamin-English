// Input sanitization middleware
function sanitizeInput(req, res, next) {
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                // Trim whitespace
                req.body[key] = req.body[key].trim();
                
                // Remove all HTML tags while preserving Japanese and unicode characters
                // Apply twice to handle nested tags and avoid incomplete sanitization
                let cleaned = req.body[key];
                let previous;
                do {
                    previous = cleaned;
                    cleaned = cleaned.replace(/<[^>]*>/g, '');
                } while (cleaned !== previous);
                req.body[key] = cleaned;
            }
        }
    }
    next();
}

module.exports = { sanitizeInput };
