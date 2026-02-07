const { normalizeToISO } = require('./dateUtils');

/**
 * Build attendance matrix data for grid views and PDF exports
 * This ensures UI and PDF use the same data source and formatting
 * 
 * @param {Object} pool - Database connection pool
 * @param {Number} classId - Class ID
 * @param {String} startDate - Start date in ISO format (YYYY-MM-DD)
 * @param {String} endDate - End date in ISO format (YYYY-MM-DD)
 * @returns {Promise<Object>} - { students, dates, attendanceMap, classData }
 */
async function buildAttendanceMatrix(pool, classId, startDate, endDate) {
    // Normalize dates to ISO format
    const normalizedStartDate = startDate ? normalizeToISO(startDate) : null;
    const normalizedEndDate = endDate ? normalizeToISO(endDate) : null;
    
    // Get class data
    const classResult = await pool.query(`
        SELECT c.*, u.full_name as teacher_name
        FROM classes c
        LEFT JOIN users u ON c.teacher_id = u.id
        WHERE c.id = $1
    `, [classId]);
    
    if (classResult.rows.length === 0) {
        throw new Error('Class not found');
    }
    
    const classData = classResult.rows[0];
    
    // Get students in the class
    const studentsResult = await pool.query(`
        SELECT * FROM students 
        WHERE class_id = $1 AND active = true
        ORDER BY student_type, name
    `, [classId]);
    const students = studentsResult.rows;
    
    // Generate date range - always include all dates in range (including empty days)
    let dates = [];
    
    if (normalizedStartDate && normalizedEndDate) {
        // Parse dates safely without timezone issues
        const [startYear, startMonth, startDay] = normalizedStartDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = normalizedEndDate.split('-').map(Number);
        
        const start = new Date(startYear, startMonth - 1, startDay);
        const end = new Date(endYear, endMonth - 1, endDay);
        const current = new Date(start);
        
        while (current <= end) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            dates.push(`${year}-${month}-${day}`);
            current.setDate(current.getDate() + 1);
        }
    } else {
        // If no date range provided, get dates from existing attendance records
        let dateQuery = 'SELECT DISTINCT date FROM attendance WHERE class_id = $1';
        const dateParams = [classId];
        let paramIndex = 2;
        
        if (normalizedStartDate) {
            dateQuery += ` AND date >= $${paramIndex}`;
            dateParams.push(normalizedStartDate);
            paramIndex++;
        }
        
        if (normalizedEndDate) {
            dateQuery += ` AND date <= $${paramIndex}`;
            dateParams.push(normalizedEndDate);
            paramIndex++;
        }
        
        dateQuery += ' ORDER BY date';
        
        const datesResult = await pool.query(dateQuery, dateParams);
        dates = datesResult.rows.map(row => normalizeToISO(row.date) || row.date);
    }
    
    // Get attendance records
    let attendanceQuery = `
        SELECT student_id, date, status 
        FROM attendance 
        WHERE class_id = $1
    `;
    const attendanceParams = [classId];
    let paramIndex = 2;
    
    if (normalizedStartDate) {
        attendanceQuery += ` AND date >= $${paramIndex}`;
        attendanceParams.push(normalizedStartDate);
        paramIndex++;
    }
    
    if (normalizedEndDate) {
        attendanceQuery += ` AND date <= $${paramIndex}`;
        attendanceParams.push(normalizedEndDate);
    }
    
    const attendanceResult = await pool.query(attendanceQuery, attendanceParams);
    
    // Create attendance map with normalized dates
    const attendanceMap = {};
    attendanceResult.rows.forEach(record => {
        const normalizedDate = normalizeToISO(record.date) || record.date;
        const key = `${record.student_id}-${normalizedDate}`;
        attendanceMap[key] = record.status;
    });
    
    return {
        students,
        dates,
        attendanceMap,
        classData,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
    };
}

/**
 * Format attendance status for display
 * @param {String} status - Status code ('O', 'X', '/', '')
 * @returns {Object} - { symbol, text, color }
 */
function formatAttendanceStatus(status) {
    const statusMap = {
        'O': { symbol: '⭕', text: 'Present', color: '#d4edda', textColor: '#155724' },
        'X': { symbol: '❌', text: 'Absent', color: '#f8d7da', textColor: '#721c24' },
        '/': { symbol: '⚠️', text: 'Late', color: '#fff3cd', textColor: '#856404' },
        '': { symbol: '-', text: 'Not marked', color: '#e2e3e5', textColor: '#6c757d' }
    };
    return statusMap[status] || statusMap[''];
}

/**
 * Format date for display (human-friendly)
 * @param {String} isoDate - Date in ISO format (YYYY-MM-DD)
 * @returns {String} - Formatted date string
 */
function formatDisplayDate(isoDate) {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate + 'T00:00:00');
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

module.exports = {
    buildAttendanceMatrix,
    formatAttendanceStatus,
    formatDisplayDate
};
