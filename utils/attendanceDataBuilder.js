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

    // Get makeup guest students — students from OTHER classes who have a
    // scheduled/completed makeup lesson for THIS class within the date range.
    // They appear in the grid only for their specific makeup date(s).
    let makeupGuestQuery = `
        SELECT DISTINCT s.*, ml.scheduled_date as makeup_date, ml.id as makeup_lesson_id,
               ml.status as makeup_status, ml.reason as makeup_reason
        FROM makeup_lessons ml
        JOIN students s ON ml.student_id = s.id
        WHERE ml.class_id = $1
          AND ml.status IN ('scheduled', 'completed')
    `;
    const makeupParams = [classId];
    let makeupParamIndex = 2;

    if (normalizedStartDate) {
        makeupGuestQuery += ` AND ml.scheduled_date >= $${makeupParamIndex}`;
        makeupParams.push(normalizedStartDate);
        makeupParamIndex++;
    }
    if (normalizedEndDate) {
        makeupGuestQuery += ` AND ml.scheduled_date <= $${makeupParamIndex}`;
        makeupParams.push(normalizedEndDate);
        makeupParamIndex++;
    }

    makeupGuestQuery += ' ORDER BY ml.scheduled_date, s.name';

    const makeupResult = await pool.query(makeupGuestQuery, makeupParams);

    // Group makeup dates by student, and add guests who aren't already class members
    const makeupDatesByStudent = {};
    for (const row of makeupResult.rows) {
        const sid = row.id;
        const mDate = normalizeToISO(row.makeup_date) || row.makeup_date;
        if (!makeupDatesByStudent[sid]) {
            makeupDatesByStudent[sid] = {
                student: row,
                dates: [],
                lessonIds: []
            };
        }
        makeupDatesByStudent[sid].dates.push(mDate);
        makeupDatesByStudent[sid].lessonIds.push(row.makeup_lesson_id);
    }

    const makeupStudents = [];
    for (const [sid, info] of Object.entries(makeupDatesByStudent)) {
        if (seenIds.has(Number(sid))) {
            // Student is already a class member — just annotate their makeup dates
            const existing = students.find(s => s.id === Number(sid));
            if (existing) {
                existing.makeup_dates = info.dates;
                existing.makeup_lesson_ids = info.lessonIds;
            }
            continue;
        }
        // Mark as makeup guest — will appear in a separate section
        const guestStudent = {
            ...info.student,
            student_type: 'makeup_guest',
            is_makeup_guest: true,
            makeup_dates: info.dates,
            makeup_lesson_ids: info.lessonIds
        };
        // Remove makeup-join artifacts from student object
        delete guestStudent.makeup_date;
        delete guestStudent.makeup_lesson_id;
        delete guestStudent.makeup_status;
        delete guestStudent.makeup_reason;
        makeupStudents.push(guestStudent);
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
    
    // Combine class members and makeup guests into the full student list.
    // Makeup guests go at the end so the frontend can render them in a
    // dedicated "Makeup Students" section.
    const allStudents = [...students, ...makeupStudents];

    return {
        students: allStudents,
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
