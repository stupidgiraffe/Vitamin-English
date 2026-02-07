/**
 * Date utility functions for normalizing date formats
 * Ensures all dates are in ISO format (YYYY-MM-DD)
 */

/**
 * Normalizes a date to ISO format (YYYY-MM-DD)
 * @param {string|Date} dateInput - Date in various formats
 * @returns {string|null} Date in ISO format (YYYY-MM-DD) or null if invalid
 */
function normalizeToISO(dateInput) {
    if (!dateInput) {
        return null;
    }

    let date;
    
    // If already a Date object
    if (dateInput instanceof Date) {
        date = dateInput;
    } 
    // If it's a string
    else if (typeof dateInput === 'string') {
        // Remove any time component if present
        const dateOnly = dateInput.split('T')[0].split(' ')[0];
        
        // Check if already in ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
            // Validate it's a real date
            date = new Date(dateOnly + 'T00:00:00');
        }
        // Check for MM/DD/YYYY format
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateOnly)) {
            const [month, day, year] = dateOnly.split('/');
            date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
        }
        // Check for DD-MM-YYYY format (hyphen-separated)
        else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateOnly)) {
            const [day, month, year] = dateOnly.split('-');
            date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
        }
        // Try parsing as-is
        else {
            date = new Date(dateOnly);
        }
    } else {
        return null;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return null;
    }

    // Return in ISO format (YYYY-MM-DD)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

/**
 * Validates if a date string is in valid ISO format
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid ISO date
 */
function isValidISODate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return false;
    }
    
    const isoDate = normalizeToISO(dateStr);
    return isoDate !== null;
}

/**
 * Format a date to Japan time (Asia/Tokyo) in a readable format
 * @param {string|Date} dateInput - Date to format
 * @param {string} format - Format type: 'date' (default), 'datetime', 'short'
 * @returns {string} Formatted date string
 */
function formatJapanTime(dateInput, format = 'date') {
    if (!dateInput) return '';
    
    try {
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
        
        // Validate date
        if (isNaN(date.getTime())) {
            return '';
        }
        
        // Use Intl.DateTimeFormat for Asia/Tokyo timezone
        const options = {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        
        if (format === 'datetime') {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.hour12 = false;
        } else if (format === 'short') {
            // Short format like "Feb 7"
            const monthAbbr = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June',
                              'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
            const jpDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
            return `${monthAbbr[jpDate.getMonth()]} ${jpDate.getDate()}`;
        }
        
        // Return formatted date
        const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD format
        const parts = formatter.formatToParts(date);
        
        if (format === 'datetime') {
            // Return YYYY-MM-DD HH:mm format
            const year = parts.find(p => p.type === 'year').value;
            const month = parts.find(p => p.type === 'month').value;
            const day = parts.find(p => p.type === 'day').value;
            const hour = parts.find(p => p.type === 'hour')?.value || '00';
            const minute = parts.find(p => p.type === 'minute')?.value || '00';
            return `${year}-${month}-${day} ${hour}:${minute}`;
        } else {
            // Return YYYY-MM-DD format (default)
            const year = parts.find(p => p.type === 'year').value;
            const month = parts.find(p => p.type === 'month').value;
            const day = parts.find(p => p.type === 'day').value;
            return `${year}-${month}-${day}`;
        }
    } catch (error) {
        console.error('Error formatting Japan time:', error);
        return '';
    }
}

/**
 * Get a human-readable date for display (e.g., "Feb. 7")
 * @param {string|Date} dateInput - Date to format
 * @returns {string} Short formatted date
 */
function formatShortDate(dateInput) {
    return formatJapanTime(dateInput, 'short');
}

module.exports = {
    normalizeToISO,
    isValidISODate,
    formatJapanTime,
    formatShortDate
};
