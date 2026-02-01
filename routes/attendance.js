const express = require('express');
const router = express.Router();
const pool = require('../database/init');
const { normalizeToISO } = require('../utils/dateUtils');

// Get attendance records
router.get('/', async (req, res) => {
    try {
        const { classId, studentId, startDate, endDate } = req.query;
        
        let query = `
            SELECT a.*, s.name as student_name, s.student_type, s.color_code, c.name as class_name
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            JOIN classes c ON a.class_id = c.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (classId) {
            query += ` AND a.class_id = $${paramIndex}`;
            params.push(classId);
            paramIndex++;
        }
        
        if (studentId) {
            query += ` AND a.student_id = $${paramIndex}`;
            params.push(studentId);
            paramIndex++;
        }
        
        // Normalize date inputs to ISO format (YYYY-MM-DD)
        if (startDate) {
            const normalizedStartDate = normalizeToISO(startDate);
            if (normalizedStartDate) {
                query += ` AND a.date >= $${paramIndex}`;
                params.push(normalizedStartDate);
                paramIndex++;
            }
        }
        
        if (endDate) {
            const normalizedEndDate = normalizeToISO(endDate);
            if (normalizedEndDate) {
                query += ` AND a.date <= $${paramIndex}`;
                params.push(normalizedEndDate);
                paramIndex++;
            }
        }
        
        query += ' ORDER BY a.date, s.student_type, s.name';
        
        const result = await pool.query(query, params);
        const records = result.rows.map(record => ({
            ...record,
            // Ensure date is in ISO format
            date: normalizeToISO(record.date) || record.date
        }));
        res.json(records);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Get attendance for a specific class and date range (matrix view)
router.get('/matrix', async (req, res) => {
    try {
        const { classId, startDate, endDate } = req.query;
        
        if (!classId) {
            return res.status(400).json({ error: 'classId is required' });
        }
        
        // Get students in the class
        const studentsResult = await pool.query(`
            SELECT * FROM students 
            WHERE class_id = $1 AND active = true
            ORDER BY student_type, name
        `, [classId]);
        const students = studentsResult.rows;
        
        // Normalize date inputs to ISO format (YYYY-MM-DD)
        const normalizedStartDate = startDate ? normalizeToISO(startDate) : null;
        const normalizedEndDate = endDate ? normalizeToISO(endDate) : null;
        
        let dates = [];
        
        // If date range is provided, generate all dates in range
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
            // Otherwise, get dates from existing attendance records
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
            // Normalize all dates to ISO format
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
        const attendanceRecords = attendanceResult.rows;
        
        // Create attendance matrix with normalized dates
        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            const normalizedDate = normalizeToISO(record.date) || record.date;
            const key = `${record.student_id}-${normalizedDate}`;
            attendanceMap[key] = record.status;
        });
        
        res.json({
            students,
            dates,
            attendance: attendanceMap
        });
    } catch (error) {
        console.error('Error fetching attendance matrix:', error);
        res.status(500).json({ error: 'Failed to fetch attendance matrix' });
    }
});

// Create or update attendance record
router.post('/', async (req, res) => {
    try {
        const { student_id, class_id, date, status, notes, time } = req.body;
        
        if (!student_id || !class_id || !date) {
            return res.status(400).json({ error: 'student_id, class_id, and date are required' });
        }
        
        // Normalize date to ISO format (YYYY-MM-DD)
        const normalizedDate = normalizeToISO(date);
        if (!normalizedDate) {
            return res.status(400).json({ error: 'Invalid date format. Expected ISO date (YYYY-MM-DD)' });
        }
        
        // Try to update existing record first
        const existingResult = await pool.query(`
            SELECT id FROM attendance 
            WHERE student_id = $1 AND class_id = $2 AND date = $3
        `, [student_id, class_id, normalizedDate]);
        const existing = existingResult.rows[0];
        
        if (existing) {
            await pool.query(`
                UPDATE attendance 
                SET status = $1, notes = $2, time = $3
                WHERE id = $4
            `, [status || '', notes || '', time || null, existing.id]);
            
            const recordResult = await pool.query('SELECT * FROM attendance WHERE id = $1', [existing.id]);
            const record = recordResult.rows[0];
            // Ensure returned date is in ISO format
            res.json({
                ...record,
                date: normalizeToISO(record.date) || record.date
            });
        } else {
            const result = await pool.query(`
                INSERT INTO attendance (student_id, class_id, date, status, notes, time) 
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            `, [student_id, class_id, normalizedDate, status || '', notes || '', time || null]);
            
            const recordResult = await pool.query('SELECT * FROM attendance WHERE id = $1', [result.rows[0].id]);
            const record = recordResult.rows[0];
            // Ensure returned date is in ISO format
            res.status(201).json({
                ...record,
                date: normalizeToISO(record.date) || record.date
            });
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        res.status(500).json({ error: 'Failed to save attendance' });
    }
});

// Update attendance record
router.put('/:id', async (req, res) => {
    try {
        const { status, notes } = req.body;
        
        await pool.query(`
            UPDATE attendance 
            SET status = $1, notes = $2
            WHERE id = $3
        `, [status || '', notes || '', req.params.id]);
        
        const result = await pool.query('SELECT * FROM attendance WHERE id = $1', [req.params.id]);
        const record = result.rows[0];
        // Ensure returned date is in ISO format
        res.json({
            ...record,
            date: normalizeToISO(record.date) || record.date
        });
    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({ error: 'Failed to update attendance' });
    }
});

// Delete attendance record
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM attendance WHERE id = $1', [req.params.id]);
        res.json({ message: 'Attendance record deleted successfully' });
    } catch (error) {
        console.error('Error deleting attendance:', error);
        res.status(500).json({ error: 'Failed to delete attendance' });
    }
});

// Bulk mark attendance
router.post('/bulk', async (req, res) => {
    try {
        const { class_id, date, status } = req.body;
        
        if (!class_id || !date || status === undefined) {
            return res.status(400).json({ error: 'class_id, date, and status are required' });
        }
        
        // Normalize date to ISO format (YYYY-MM-DD)
        const normalizedDate = normalizeToISO(date);
        if (!normalizedDate) {
            return res.status(400).json({ error: 'Invalid date format. Expected ISO date (YYYY-MM-DD)' });
        }
        
        // Get all students in the class
        const studentsResult = await pool.query(`
            SELECT id FROM students 
            WHERE class_id = $1 AND active = true
        `, [class_id]);
        const students = studentsResult.rows;
        
        for (const student of students) {
            await pool.query(`
                INSERT INTO attendance (student_id, class_id, date, status) 
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (student_id, class_id, date) 
                DO UPDATE SET status = $4
            `, [student.id, class_id, normalizedDate, status]);
        }
        
        res.json({ message: 'Bulk attendance marked successfully' });
    } catch (error) {
        console.error('Error marking bulk attendance:', error);
        res.status(500).json({ error: 'Failed to mark bulk attendance' });
    }
});

// Move attendance records from one date to another
router.post('/move', async (req, res) => {
    // Authentication check
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const { class_id, from_date, to_date } = req.body;
        
        if (!class_id || !from_date || !to_date) {
            return res.status(400).json({ error: 'class_id, from_date, and to_date are required' });
        }
        
        // Normalize dates to ISO format (YYYY-MM-DD)
        const normalizedFromDate = normalizeToISO(from_date);
        const normalizedToDate = normalizeToISO(to_date);
        
        if (!normalizedFromDate || !normalizedToDate) {
            return res.status(400).json({ error: 'Invalid date format. Expected ISO date (YYYY-MM-DD)' });
        }
        
        if (normalizedFromDate === normalizedToDate) {
            return res.status(400).json({ error: 'Source and target dates must be different' });
        }
        
        // Check if there are records to move
        const checkResult = await pool.query(`
            SELECT COUNT(*) as count FROM attendance 
            WHERE class_id = $1 AND date = $2
        `, [class_id, normalizedFromDate]);
        
        const recordCount = parseInt(checkResult.rows[0].count);
        
        if (recordCount === 0) {
            return res.status(404).json({ error: 'No attendance records found for the source date' });
        }
        
        // Delete any existing records at the target date first
        await pool.query(`
            DELETE FROM attendance 
            WHERE class_id = $1 AND date = $2
        `, [class_id, normalizedToDate]);
        
        // Move records by updating the date
        const result = await pool.query(`
            UPDATE attendance 
            SET date = $1
            WHERE class_id = $2 AND date = $3
            RETURNING id
        `, [normalizedToDate, class_id, normalizedFromDate]);
        
        res.json({ 
            message: 'Attendance records moved successfully',
            movedCount: result.rowCount
        });
    } catch (error) {
        console.error('Error moving attendance:', error);
        res.status(500).json({ error: 'Failed to move attendance records' });
    }
});

// Generate dates based on class schedule
// Helper function to parse schedule and generate dates
function generateScheduleDates(schedule, startDate, endDate) {
    const dates = [];
    
    if (!schedule || !startDate || !endDate) {
        return dates;
    }
    
    // Parse day names from schedule (e.g., "Monday, Wednesday" or "Mon/Wed 10:00-11:30")
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayAbbr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    
    const scheduleLower = schedule.toLowerCase();
    const scheduleDays = [];
    
    // Check for each day in the schedule
    dayNames.forEach((day, index) => {
        if (scheduleLower.includes(day) || scheduleLower.includes(dayAbbr[index])) {
            scheduleDays.push(index);
        }
    });
    
    // If no days found, return empty array
    if (scheduleDays.length === 0) {
        return dates;
    }
    
    // Generate dates for those days of the week within the date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (scheduleDays.includes(dayOfWeek)) {
            dates.push(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
}

// Get schedule-based dates for a class
router.get('/schedule-dates', async (req, res) => {
    try {
        const { classId, startDate, endDate } = req.query;
        
        if (!classId) {
            return res.status(400).json({ error: 'classId is required' });
        }
        
        // Get class information including schedule
        const classResult = await pool.query('SELECT schedule FROM classes WHERE id = $1', [classId]);
        
        if (classResult.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        const classData = classResult.rows[0];
        
        // Helper to get default date range (last 6 months)
        const getDefaultDateRange = () => {
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 6);
            return {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            };
        };
        
        // Use provided dates or default to last 6 months
        const defaults = getDefaultDateRange();
        const endDateValue = endDate ? normalizeToISO(endDate) : defaults.end;
        const startDateValue = startDate ? normalizeToISO(startDate) : defaults.start;
        
        // Generate dates based on schedule
        const dates = generateScheduleDates(classData.schedule, startDateValue, endDateValue);
        
        res.json({
            schedule: classData.schedule,
            startDate: startDateValue,
            endDate: endDateValue,
            dates
        });
    } catch (error) {
        console.error('Error generating schedule dates:', error);
        res.status(500).json({ error: 'Failed to generate schedule dates' });
    }
});

module.exports = router;
