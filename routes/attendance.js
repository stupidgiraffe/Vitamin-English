const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');
const { normalizeToISO } = require('../utils/dateUtils');
const { buildAttendanceMatrix } = require('../utils/attendanceDataBuilder');

// Get attendance records
router.get('/', async (req, res) => {
    try {
        const { classId, studentId, startDate, endDate } = req.query;
        
        // Build query using direct SQL for complex filtering
        let query = `
            SELECT a.*, s.name as student_name, s.student_type, s.color_code, c.name as class_name, u.full_name as teacher_name
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            JOIN classes c ON a.class_id = c.id
            LEFT JOIN users u ON a.teacher_id = u.id
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
        
        const result = await dataHub.query(query, params);
        const records = result.rows.map(record => ({
            ...record,
            // Ensure date is in ISO format
            date: normalizeToISO(record.date) || record.date
        }));
        res.json(records);
    } catch (error) {
        console.error('❌ Error fetching attendance:', error);
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
        
        // Use shared data builder for consistency between UI and PDF
        const matrixData = await buildAttendanceMatrix(dataHub.pool, parseInt(classId), startDate, endDate);
        
        res.json({
            students: matrixData.students,
            dates: matrixData.dates,
            attendance: matrixData.attendanceMap
        });
    } catch (error) {
        console.error('❌ Error fetching attendance matrix:', error);
        res.status(500).json({ error: 'Failed to fetch attendance matrix' });
    }
});

// Create or update attendance record
router.post('/', async (req, res) => {
    try {
        const { student_id, class_id, date, status, notes, time, teacher_id } = req.body;
        
        if (!student_id || !class_id || !date) {
            return res.status(400).json({ error: 'student_id, class_id, and date are required' });
        }
        
        // Normalize date to ISO format (YYYY-MM-DD)
        const normalizedDate = normalizeToISO(date);
        if (!normalizedDate) {
            return res.status(400).json({ error: 'Invalid date format. Expected ISO date (YYYY-MM-DD)' });
        }
        
        // Use upsert method from repository
        const record = await dataHub.attendance.upsert({
            student_id,
            class_id,
            date: normalizedDate,
            status: status || '',
            notes: notes || '',
            time: time || null,
            teacher_id: teacher_id || null
        });
        
        // Ensure returned date is in ISO format
        res.status(201).json({
            ...record,
            date: normalizeToISO(record.date) || record.date
        });
    } catch (error) {
        console.error('❌ Error saving attendance:', error);
        
        // Provide specific error messages for common issues
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({ 
                error: 'Attendance record already exists for this student, class, and date' 
            });
        }
        
        if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({ 
                error: 'Invalid student, class, or teacher ID' 
            });
        }
        
        res.status(500).json({ error: 'Failed to save attendance' });
    }
});

// Update attendance record
router.put('/:id', async (req, res) => {
    try {
        const { status, notes, teacher_id } = req.body;
        
        const record = await dataHub.attendance.update(req.params.id, {
            status: status || '',
            notes: notes || '',
            teacher_id: teacher_id || null
        });
        
        if (!record) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }
        
        // Ensure returned date is in ISO format
        res.json({
            ...record,
            date: normalizeToISO(record.date) || record.date
        });
    } catch (error) {
        console.error('❌ Error updating attendance:', error);
        res.status(500).json({ error: 'Failed to update attendance' });
    }
});

// Delete attendance record
router.delete('/:id', async (req, res) => {
    try {
        await dataHub.attendance.delete(req.params.id);
        res.json({ message: 'Attendance record deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting attendance:', error);
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
        const students = await dataHub.students.findAll({
            classId: parseInt(class_id),
            perPage: 0 // No pagination, get all
        });
        
        // Bulk upsert attendance records
        const records = students.map(student => ({
            student_id: student.id,
            class_id: parseInt(class_id),
            date: normalizedDate,
            status,
            notes: '',
            time: null,
            teacher_id: null
        }));
        
        await dataHub.attendance.bulkUpsert(records);
        
        res.json({ message: 'Bulk attendance marked successfully' });
    } catch (error) {
        console.error('❌ Error marking bulk attendance:', error);
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
        const checkResult = await dataHub.query(`
            SELECT COUNT(*) as count FROM attendance 
            WHERE class_id = $1 AND date = $2
        `, [class_id, normalizedFromDate]);
        
        const recordCount = parseInt(checkResult.rows[0].count);
        
        if (recordCount === 0) {
            return res.status(404).json({ error: 'No attendance records found for the source date' });
        }
        
        // Delete any existing records at the target date first
        await dataHub.query(`
            DELETE FROM attendance 
            WHERE class_id = $1 AND date = $2
        `, [class_id, normalizedToDate]);
        
        // Move records by updating the date
        const result = await dataHub.query(`
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
        console.error('❌ Error moving attendance:', error);
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
        const classData = await dataHub.classes.findById(classId);
        
        if (!classData) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
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
        console.error('❌ Error generating schedule dates:', error);
        res.status(500).json({ error: 'Failed to generate schedule dates' });
    }
});

module.exports = router;
