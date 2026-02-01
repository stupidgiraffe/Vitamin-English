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
        // Check for DD/MM/YYYY format (less common in this app but good to support)
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

module.exports = {
    normalizeToISO,
    isValidISODate
};
