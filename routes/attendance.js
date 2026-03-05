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

// ─── Part 5: New analytics endpoints ──────────────────────────────────────────

// GET /api/attendance/student-summary/:studentId
// Returns attendance data across ALL classes for a student, plus streak data
router.get('/student-summary/:studentId', async (req, res) => {
    try {
        const studentId = parseInt(req.params.studentId);
        const { startDate, endDate } = req.query;

        const normalizedStart = startDate ? normalizeToISO(startDate) : null;
        const normalizedEnd   = endDate   ? normalizeToISO(endDate)   : null;

        // Fetch student info
        const studentResult = await dataHub.query(
            'SELECT * FROM students WHERE id = $1',
            [studentId]
        );
        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const student = studentResult.rows[0];

        // Fetch attendance records across all classes
        let q = `
            SELECT a.date, a.status, a.class_id, c.name as class_name
            FROM attendance a
            JOIN classes c ON a.class_id = c.id
            WHERE a.student_id = $1
        `;
        const params = [studentId];
        let idx = 2;
        if (normalizedStart) { q += ` AND a.date >= $${idx++}`; params.push(normalizedStart); }
        if (normalizedEnd)   { q += ` AND a.date <= $${idx++}`; params.push(normalizedEnd); }
        q += ' ORDER BY a.date ASC';

        const attResult = await dataHub.query(q, params);
        const records = attResult.rows.map(r => ({
            date: normalizeToISO(r.date) || r.date,
            status: r.status,
            class_id: r.class_id,
            class_name: r.class_name
        }));

        // Calculate streaks (consecutive 'O' records; '/' doesn't break but doesn't count)
        let currentStreak = 0, bestStreak = 0, runningStreak = 0;
        for (let i = records.length - 1; i >= 0; i--) {
            const s = records[i].status;
            if (s === 'O') {
                runningStreak++;
                if (currentStreak === 0) currentStreak = runningStreak; // still computing from end
            } else if (s === '/') {
                // partial doesn't break streak but doesn't count
            } else {
                if (currentStreak === 0) currentStreak = runningStreak; // lock in current streak
                runningStreak = 0;
            }
        }
        // current streak is the streak at the most recent end of records
        let cStreak = 0, bStreak = 0, tempStreak = 0;
        for (const r of records) {
            if (r.status === 'O') {
                tempStreak++;
                if (tempStreak > bStreak) bStreak = tempStreak;
            } else if (r.status === '/') {
                // doesn't count, doesn't break
            } else {
                tempStreak = 0;
            }
        }
        cStreak = tempStreak; // streak at end of sorted records
        bStreak = Math.max(bStreak, cStreak);

        // Summary stats
        const total = records.length;
        const present = records.filter(r => r.status === 'O').length;
        const absent  = records.filter(r => r.status === 'X').length;
        const partial = records.filter(r => r.status === '/').length;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        // Heatmap data: group by date
        const heatmap = {};
        records.forEach(r => {
            if (!heatmap[r.date]) {
                heatmap[r.date] = { status: r.status, classes: [] };
            }
            heatmap[r.date].classes.push({ class_id: r.class_id, class_name: r.class_name, status: r.status });
            // Summarise: O > / > X > ''
            const rank = { 'O': 3, '/': 2, 'X': 1, '': 0 };
            if ((rank[r.status] || 0) > (rank[heatmap[r.date].status] || 0)) {
                heatmap[r.date].status = r.status;
            }
        });

        res.json({
            student,
            records,
            heatmap,
            stats: { total, present, absent, partial, rate },
            streaks: { current: cStreak, best: bStreak }
        });
    } catch (error) {
        console.error('❌ Error fetching student summary:', error);
        res.status(500).json({ error: 'Failed to fetch student summary' });
    }
});

// GET /api/attendance/class-summary/:classId?year=YYYY
// Returns monthly attendance rates, per-student rates, lowest performers
router.get('/class-summary/:classId', async (req, res) => {
    try {
        const classId = parseInt(req.params.classId);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Validate classId
        const classResult = await dataHub.query(
            'SELECT c.*, u.full_name as teacher_name FROM classes c LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = $1',
            [classId]
        );
        if (classResult.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        const classData = classResult.rows[0];

        // Students
        const studentsResult = await dataHub.query(
            'SELECT id, name, student_type FROM students WHERE class_id = $1 AND active = true ORDER BY student_type, name',
            [classId]
        );
        const students = studentsResult.rows;

        // Attendance for the year
        const attResult = await dataHub.query(`
            SELECT a.student_id, a.date, a.status
            FROM attendance a
            WHERE a.class_id = $1 AND EXTRACT(YEAR FROM a.date::date) = $2
            ORDER BY a.date
        `, [classId, year]);

        // Build monthly stats
        const monthlyStats = {};
        for (let m = 1; m <= 12; m++) {
            monthlyStats[m] = { total: 0, present: 0, rate: null };
        }

        // Per-student stats
        const studentStats = {};
        students.forEach(s => {
            studentStats[s.id] = { id: s.id, name: s.name, student_type: s.student_type, total: 0, present: 0, rate: 0 };
        });

        attResult.rows.forEach(r => {
            const date = normalizeToISO(r.date) || r.date;
            const month = parseInt(date.split('-')[1]);
            if (!monthlyStats[month]) monthlyStats[month] = { total: 0, present: 0, rate: null };
            monthlyStats[month].total++;
            if (r.status === 'O') monthlyStats[month].present++;

            if (studentStats[r.student_id]) {
                studentStats[r.student_id].total++;
                if (r.status === 'O') studentStats[r.student_id].present++;
            }
        });

        // Compute rates
        Object.keys(monthlyStats).forEach(m => {
            const ms = monthlyStats[m];
            ms.rate = ms.total > 0 ? Math.round((ms.present / ms.total) * 100) : null;
        });
        Object.keys(studentStats).forEach(id => {
            const ss = studentStats[id];
            ss.rate = ss.total > 0 ? Math.round((ss.present / ss.total) * 100) : 0;
        });

        // Lowest performers (bottom 3 by rate, must have at least 1 record)
        const sortedStudents = Object.values(studentStats)
            .filter(s => s.total > 0)
            .sort((a, b) => a.rate - b.rate);
        const lowestPerformers = sortedStudents.slice(0, 3);

        // Overall rate for the year
        const totalAll = attResult.rows.length;
        const presentAll = attResult.rows.filter(r => r.status === 'O').length;
        const overallRate = totalAll > 0 ? Math.round((presentAll / totalAll) * 100) : null;

        res.json({
            class: classData,
            year,
            monthlyStats,
            studentStats: Object.values(studentStats),
            lowestPerformers,
            overallRate
        });
    } catch (error) {
        console.error('❌ Error fetching class summary:', error);
        res.status(500).json({ error: 'Failed to fetch class summary' });
    }
});

// GET /api/attendance/teacher-dashboard
// Returns all classes for the current teacher with current-month attendance rates
router.get('/teacher-dashboard', async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const userRole = req.session.role;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // Get classes (all for admin, teacher's own for teachers)
        let classQuery = `
            SELECT c.*, u.full_name as teacher_name
            FROM classes c
            LEFT JOIN users u ON c.teacher_id = u.id
        `;
        const classParams = [];
        if (userRole !== 'admin') {
            classQuery += ' WHERE c.teacher_id = $1';
            classParams.push(userId);
        }
        classQuery += ' ORDER BY c.name';

        const classResult = await dataHub.query(classQuery, classParams);
        const classes = classResult.rows;

        // For each class, get attendance stats for current month
        const classesWithStats = await Promise.all(classes.map(async (cls) => {
            const attResult = await dataHub.query(`
                SELECT a.student_id, a.status
                FROM attendance a
                WHERE a.class_id = $1 AND a.date >= $2 AND a.date <= $3
            `, [cls.id, monthStart, monthEnd]);

            const total = attResult.rows.length;
            const present = attResult.rows.filter(r => r.status === 'O').length;
            const rate = total > 0 ? Math.round((present / total) * 100) : null;

            // Students with low attendance this month
            const studentMap = {};
            attResult.rows.forEach(r => {
                if (!studentMap[r.student_id]) studentMap[r.student_id] = { total: 0, present: 0 };
                studentMap[r.student_id].total++;
                if (r.status === 'O') studentMap[r.student_id].present++;
            });

            // Get student names for flagged students
            const flaggedIds = Object.keys(studentMap).filter(id => {
                const s = studentMap[id];
                return s.total > 0 && Math.round((s.present / s.total) * 100) < 75;
            });

            let flaggedStudents = [];
            if (flaggedIds.length > 0) {
                const namesResult = await dataHub.query(
                    `SELECT id, name FROM students WHERE id = ANY($1::int[])`,
                    [flaggedIds.map(Number)]
                );
                flaggedStudents = namesResult.rows.map(s => ({
                    id: s.id,
                    name: s.name,
                    rate: Math.round((studentMap[s.id].present / studentMap[s.id].total) * 100)
                }));
            }

            return {
                ...cls,
                monthlyRate: rate,
                monthlyTotal: total,
                monthlyPresent: present,
                flaggedStudents
            };
        }));

        res.json({
            month,
            year,
            monthLabel: new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
            classes: classesWithStats
        });
    } catch (error) {
        console.error('❌ Error fetching teacher dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch teacher dashboard data' });
    }
});

module.exports = router;
