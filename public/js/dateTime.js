/**
 * Centralized Date/Time Formatting Utilities
 * All dates/times use Japan timezone (Asia/Tokyo)
 */

/**
 * Format date and time in Japan style (24-hour format)
 * @param {string|Date} dateInput - Date to format
 * @returns {string} Formatted date/time (e.g., "2026年2月7日 15:30")
 */
function formatDateTimeJP(dateInput) {
    if (!dateInput) return '';
    
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        
        // Convert to Japan timezone
        const options = {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        const formatter = new Intl.DateTimeFormat('ja-JP', options);
        return formatter.format(d);
    } catch (e) {
        console.error('Error formatting date/time:', e);
        return '';
    }
}

/**
 * Format date only in Japan style (no time)
 * @param {string|Date} dateInput - Date to format
 * @returns {string} Formatted date (e.g., "2026年2月7日")
 */
function formatDateJP(dateInput) {
    if (!dateInput) return '';
    
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        
        // Convert to Japan timezone
        const options = {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        };
        
        const formatter = new Intl.DateTimeFormat('ja-JP', options);
        return formatter.format(d);
    } catch (e) {
        console.error('Error formatting date:', e);
        return '';
    }
}

/**
 * Smart date formatter - shows date only for date-only values, 
 * date+time for timestamps with meaningful time
 * @param {string|Date} dateInput - Date to format
 * @param {boolean} forceDateTime - Force showing time even if at midnight
 * @returns {string} Formatted date or date/time
 */
function formatDateSmart(dateInput, forceDateTime = false) {
    if (!dateInput) return '';
    
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        
        // Get Japan timezone time components
        const japanDateStr = d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        const japanDate = new Date(japanDateStr);
        
        const hours = japanDate.getHours();
        const minutes = japanDate.getMinutes();
        const seconds = japanDate.getSeconds();
        
        // If time is midnight (00:00:00) or not meaningful, show date only
        // unless forceDateTime is true
        const hasMeaningfulTime = hours !== 0 || minutes !== 0 || seconds !== 0;
        
        if (hasMeaningfulTime || forceDateTime) {
            return formatDateTimeJP(dateInput);
        } else {
            return formatDateJP(dateInput);
        }
    } catch (e) {
        console.error('Error in smart date formatting:', e);
        return '';
    }
}

/**
 * Format date in ISO format (YYYY-MM-DD) for date inputs
 * @param {string|Date} dateInput - Date to format
 * @returns {string} ISO date string
 */
function formatDateISO(dateInput) {
    if (!dateInput) return '';
    
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        
        // Use Japan timezone and extract date
        const japanDateStr = d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        const japanDate = new Date(japanDateStr);
        
        const year = japanDate.getFullYear();
        const month = String(japanDate.getMonth() + 1).padStart(2, '0');
        const day = String(japanDate.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('Error formatting to ISO:', e);
        return '';
    }
}

/**
 * Format date in English readable format for compatibility
 * @param {string|Date} dateInput - Date to format
 * @param {boolean} includeYear - Whether to include year
 * @returns {string} Formatted date (e.g., "Feb. 7, 2026")
 */
function formatDateReadableEN(dateInput, includeYear = true) {
    if (!dateInput) return '';
    
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        
        const monthAbbr = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June',
                          'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
        
        // Use Japan timezone
        const japanDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        const formatted = `${monthAbbr[japanDate.getMonth()]} ${japanDate.getDate()}`;
        
        return includeYear ? `${formatted}, ${japanDate.getFullYear()}` : formatted;
    } catch (e) {
        console.error('Error formatting date readable:', e);
        return '';
    }
}
