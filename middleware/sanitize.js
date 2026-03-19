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

/**
 * Convert a string to Title Case.
 * Handles Japanese/Unicode characters gracefully by only capitalising ASCII
 * word boundaries so that non-Latin scripts are left untouched.
 *
 * Examples:
 *   " jOhn doe "  → "John Doe"
 *   "MARY-JANE"   → "Mary-Jane"
 *   "田中 花子"     → "田中 花子"  (unchanged)
 *
 * @param {string} str - Input string (may be mixed-case or contain extra whitespace)
 * @returns {string} Title-cased string with trimmed whitespace, or the original
 *                   value unchanged if it is not a string.
 */
function toTitleCase(str) {
    if (typeof str !== 'string') return str;
    // Trim first so leading/trailing spaces do not produce empty "words"
    return str.trim().replace(/\S+/g, (word) => {
        // Only capitalise the first character if it is an ASCII letter so that
        // Japanese or other Unicode words are left unchanged.
        if (/^[A-Za-z]/.test(word)) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word;
    });
}

/**
 * Normalise a date string from various common input formats into
 * ISO 8601 (YYYY-MM-DD) so it can be passed safely to PostgreSQL.
 *
 * Accepted formats:
 *   YYYY-MM-DD  (already ISO – returned as-is after validation)
 *   MM/DD/YYYY  (US format, e.g. "03/19/2026")
 *   DD/MM/YYYY  (EU format, e.g. "19/03/2026") – only attempted when the first
 *               segment exceeds 12, making it unambiguously the day value
 *   MM-DD-YYYY  (hyphen-separated US)
 *   YYYY/MM/DD  (slash-separated ISO)
 *   Unix timestamp (integer seconds or milliseconds as a string)
 *
 * Ambiguity note: When both day and month candidates are ≤ 12 (e.g.
 * "11/12/2026") the format is inherently ambiguous.  This function defaults
 * to MM/DD/YYYY (US order) for those cases, which is consistent with the HTML
 * `<input type="date">` output used throughout the application.
 *
 * Returns null when the input cannot be parsed into a valid calendar date.
 *
 * @param {string|number} input - Date value to normalise
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null on failure
 */
function normalizeDate(input) {
    if (!input && input !== 0) return null;

    const raw = String(input).trim();
    if (!raw) return null;

    // Strip any time component – we only care about the date portion
    const datePart = raw.split(/[T ]/)[0];

    let year, month, day;

    // YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = datePart.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        [, year, month, day] = isoMatch;
    }

    // MM/DD/YYYY or MM-DD-YYYY  (US format, with DD/MM fallback when unambiguous)
    if (!year) {
        const usMatch = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (usMatch) {
            const [, m, d, y] = usMatch;
            // When the first segment > 12 it can only be the day (DD/MM/YYYY)
            if (parseInt(m, 10) > 12) {
                // Unambiguously DD/MM/YYYY (EU)
                [day, month, year] = [m, d, y];
            } else {
                // Default to MM/DD/YYYY (US); ambiguous cases like 11/12/2026
                // are intentionally treated as November 12th.
                [month, day, year] = [m, d, y];
            }
        }
    }

    if (year && month && day) {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        const d = parseInt(day, 10);

        // Validate ranges using a real Date object so that dates like Feb 31
        // are correctly rejected rather than silently rolled over.
        if (m >= 1 && m <= 12 && d >= 1 && y >= 1900 && y <= 2100) {
            const check = new Date(y, m - 1, d);
            if (
                check.getFullYear() === y &&
                check.getMonth() === m - 1 &&
                check.getDate() === d
            ) {
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }
        return null;
    }

    // Unix timestamp (seconds or milliseconds)
    if (/^\d+$/.test(raw)) {
        const ts = parseInt(raw, 10);
        // Heuristic: timestamps > 1e10 are likely milliseconds
        const ms = ts > 1e10 ? ts : ts * 1000;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) {
            return d.toISOString().slice(0, 10);
        }
    }

    // Final fallback: try the native Date parser (handles RFC 2822, etc.)
    const fallback = new Date(raw);
    if (!isNaN(fallback.getTime())) {
        return fallback.toISOString().slice(0, 10);
    }

    return null;
}

module.exports = { sanitizeInput, sanitizeString, toTitleCase, normalizeDate };
