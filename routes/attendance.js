const express = require('express');
const router = express.Router();
const pool = require('../database/init');

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
        
        if (startDate) {
            query += ` AND a.date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            query += ` AND a.date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        query += ' ORDER BY a.date, s.student_type, s.name';
        
        const result = await pool.query(query, params);
        const records = result.rows;
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
        
        // Get dates
        let dateQuery = 'SELECT DISTINCT date FROM attendance WHERE class_id = $1';
        const dateParams = [classId];
        let paramIndex = 2;
        
        if (startDate) {
            dateQuery += ` AND date >= $${paramIndex}`;
            dateParams.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            dateQuery += ` AND date <= $${paramIndex}`;
            dateParams.push(endDate);
            paramIndex++;
        }
        
        dateQuery += ' ORDER BY date';
        
        const datesResult = await pool.query(dateQuery, dateParams);
        const dates = datesResult.rows.map(row => row.date);
        
        // Get attendance records
        let attendanceQuery = `
            SELECT student_id, date, status 
            FROM attendance 
            WHERE class_id = $1
        `;
        paramIndex = 2;
        if (startDate) {
            attendanceQuery += ` AND date >= $${paramIndex}`;
            paramIndex++;
        }
        if (endDate) {
            attendanceQuery += ` AND date <= $${paramIndex}`;
        }
        
        const attendanceResult = await pool.query(attendanceQuery, dateParams);
        const attendanceRecords = attendanceResult.rows;
        
        // Create attendance matrix
        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            const key = `${record.student_id}-${record.date}`;
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
        const { student_id, class_id, date, status, notes } = req.body;
        
        if (!student_id || !class_id || !date) {
            return res.status(400).json({ error: 'student_id, class_id, and date are required' });
        }
        
        // Try to update existing record first
        const existingResult = await pool.query(`
            SELECT id FROM attendance 
            WHERE student_id = $1 AND class_id = $2 AND date = $3
        `, [student_id, class_id, date]);
        const existing = existingResult.rows[0];
        
        if (existing) {
            await pool.query(`
                UPDATE attendance 
                SET status = $1, notes = $2
                WHERE id = $3
            `, [status || '', notes || '', existing.id]);
            
            const recordResult = await pool.query('SELECT * FROM attendance WHERE id = $1', [existing.id]);
            const record = recordResult.rows[0];
            res.json(record);
        } else {
            const result = await pool.query(`
                INSERT INTO attendance (student_id, class_id, date, status, notes) 
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [student_id, class_id, date, status || '', notes || '']);
            
            const recordResult = await pool.query('SELECT * FROM attendance WHERE id = $1', [result.rows[0].id]);
            const record = recordResult.rows[0];
            res.status(201).json(record);
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
        res.json(record);
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
            `, [student.id, class_id, date, status]);
        }
        
        res.json({ message: 'Bulk attendance marked successfully' });
    } catch (error) {
        console.error('Error marking bulk attendance:', error);
        res.status(500).json({ error: 'Failed to mark bulk attendance' });
    }
});

module.exports = router;
