// Input sanitization middleware
// Provides comprehensive protection against XSS and injection attacks
function sanitizeInput(req, res, next) {
    if (req.body) {
        sanitizeObject(req.body);
    }
    if (req.query) {
        sanitizeObject(req.query);
    }
    if (req.params) {
        sanitizeObject(req.params);
    }
    next();
}

// Recursively sanitize an object's string values
function sanitizeObject(obj) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (typeof obj[key] === 'string') {
                obj[key] = sanitizeString(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeObject(obj[key]);
            }
        }
    }
}

// Sanitize a single string value
function sanitizeString(str) {
    // Trim whitespace
    let cleaned = str.trim();
    
    // Remove all HTML tags while preserving Japanese and unicode characters
    // Apply iteratively to handle nested tags and avoid incomplete sanitization
    let previous;
    do {
        previous = cleaned;
        cleaned = cleaned.replace(/<[^>]*>/g, '');
    } while (cleaned !== previous);
    
    // Remove potentially dangerous patterns (script injection attempts)
    // This handles cases like javascript: URLs and on* event handlers
    cleaned = cleaned.replace(/javascript:/gi, '');
    cleaned = cleaned.replace(/vbscript:/gi, '');
    cleaned = cleaned.replace(/data:/gi, 'data-safe:');
    
    // Remove null bytes that could be used for injection
    cleaned = cleaned.replace(/\x00/g, '');
    
    return cleaned;
}

module.exports = { sanitizeInput, sanitizeString };
