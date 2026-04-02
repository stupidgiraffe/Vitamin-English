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
    // Deduplicate by student id in case of any unexpected duplicates
    const seenIds = new Set();
    const students = studentsResult.rows.filter(s => {
        if (seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
    });

    // Get makeup visitor students for this class within the date range
    let makeupVisitors = [];
    if (normalizedStartDate && normalizedEndDate) {
        try {
            const makeupResult = await pool.query(
                `SELECT ams.student_id, ams.date as makeup_date,
                        s.id, s.name, s.student_type, s.color_code,
                        sc.name as source_class_name
                 FROM attendance_makeup_students ams
                 JOIN students s ON ams.student_id = s.id
                 LEFT JOIN classes sc ON ams.source_class_id = sc.id
                 WHERE ams.class_id = $1
                   AND ams.date >= $2
                   AND ams.date <= $3
                 ORDER BY ams.date, s.name`,
                [classId, normalizedStartDate, normalizedEndDate]
            );

            // Group makeup visitors by student_id so each student appears once,
            // carrying a `makeup_dates` array of the specific dates they were added for.
            const visitorMap = new Map();
            makeupResult.rows.forEach(row => {
                if (!visitorMap.has(row.student_id)) {
                    visitorMap.set(row.student_id, {
                        id: row.id,
                        name: row.name,
                        student_type: row.student_type,
                        color_code: row.color_code,
                        is_makeup_visitor: true,
                        source_class_name: row.source_class_name,
                        makeup_dates: []
                    });
                }
                visitorMap.get(row.student_id).makeup_dates.push(row.makeup_date);
            });

            // Only include makeup visitors that are not already permanent members
            visitorMap.forEach((visitor) => {
                if (!seenIds.has(visitor.id)) {
                    makeupVisitors.push(visitor);
                }
            });
        } catch (err) {
            // Gracefully degrade if the table does not exist yet (before migration)
            if (err.code !== '42P01') throw err;
            console.warn('⚠️  attendance_makeup_students table not found – skipping makeup visitors');
        }
    }
    
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
        students: [...students, ...makeupVisitors],
        dates,
        attendanceMap,
        classData,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
    };
}

/**
 * Format attendance status for display
 * NOTE: This function returns emoji symbols and colors for UI display.
 * PDF rendering uses the raw status characters ('O', 'X', '/') directly.
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
