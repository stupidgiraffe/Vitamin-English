const express = require('express');
const router = express.Router();
const db = require('../database/init');

// Get attendance records
router.get('/', (req, res) => {
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
        
        if (classId) {
            query += ' AND a.class_id = ?';
            params.push(classId);
        }
        
        if (studentId) {
            query += ' AND a.student_id = ?';
            params.push(studentId);
        }
        
        if (startDate) {
            query += ' AND a.date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND a.date <= ?';
            params.push(endDate);
        }
        
        query += ' ORDER BY a.date, s.student_type, s.name';
        
        const records = db.prepare(query).all(...params);
        res.json(records);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Get attendance for a specific class and date range (matrix view)
router.get('/matrix', (req, res) => {
    try {
        const { classId, startDate, endDate } = req.query;
        
        if (!classId) {
            return res.status(400).json({ error: 'classId is required' });
        }
        
        // Get students in the class
        const students = db.prepare(`
            SELECT * FROM students 
            WHERE class_id = ? AND active = 1
            ORDER BY student_type, name
        `).all(classId);
        
        // Get dates
        let dateQuery = 'SELECT DISTINCT date FROM attendance WHERE class_id = ?';
        const dateParams = [classId];
        
        if (startDate) {
            dateQuery += ' AND date >= ?';
            dateParams.push(startDate);
        }
        
        if (endDate) {
            dateQuery += ' AND date <= ?';
            dateParams.push(endDate);
        }
        
        dateQuery += ' ORDER BY date';
        
        const dates = db.prepare(dateQuery).all(...dateParams).map(row => row.date);
        
        // Get attendance records
        const attendanceRecords = db.prepare(`
            SELECT student_id, date, status 
            FROM attendance 
            WHERE class_id = ?
            ${startDate ? 'AND date >= ?' : ''}
            ${endDate ? 'AND date <= ?' : ''}
        `).all(...dateParams);
        
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
router.post('/', (req, res) => {
    try {
        const { student_id, class_id, date, status, notes } = req.body;
        
        if (!student_id || !class_id || !date) {
            return res.status(400).json({ error: 'student_id, class_id, and date are required' });
        }
        
        // Try to update existing record first
        const existing = db.prepare(`
            SELECT id FROM attendance 
            WHERE student_id = ? AND class_id = ? AND date = ?
        `).get(student_id, class_id, date);
        
        if (existing) {
            db.prepare(`
                UPDATE attendance 
                SET status = ?, notes = ?
                WHERE id = ?
            `).run(status || '', notes || '', existing.id);
            
            const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id);
            res.json(record);
        } else {
            const result = db.prepare(`
                INSERT INTO attendance (student_id, class_id, date, status, notes) 
                VALUES (?, ?, ?, ?, ?)
            `).run(student_id, class_id, date, status || '', notes || '');
            
            const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);
            res.status(201).json(record);
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        res.status(500).json({ error: 'Failed to save attendance' });
    }
});

// Update attendance record
router.put('/:id', (req, res) => {
    try {
        const { status, notes } = req.body;
        
        db.prepare(`
            UPDATE attendance 
            SET status = ?, notes = ?
            WHERE id = ?
        `).run(status || '', notes || '', req.params.id);
        
        const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
        res.json(record);
    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({ error: 'Failed to update attendance' });
    }
});

// Delete attendance record
router.delete('/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.id);
        res.json({ message: 'Attendance record deleted successfully' });
    } catch (error) {
        console.error('Error deleting attendance:', error);
        res.status(500).json({ error: 'Failed to delete attendance' });
    }
});

// Bulk mark attendance
router.post('/bulk', (req, res) => {
    try {
        const { class_id, date, status } = req.body;
        
        if (!class_id || !date || status === undefined) {
            return res.status(400).json({ error: 'class_id, date, and status are required' });
        }
        
        // Get all students in the class
        const students = db.prepare(`
            SELECT id FROM students 
            WHERE class_id = ? AND active = 1
        `).all(class_id);
        
        const insertStmt = db.prepare(`
            INSERT INTO attendance (student_id, class_id, date, status) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_id, class_id, date) 
            DO UPDATE SET status = ?
        `);
        
        students.forEach(student => {
            insertStmt.run(student.id, class_id, date, status, status);
        });
        
        res.json({ message: 'Bulk attendance marked successfully' });
    } catch (error) {
        console.error('Error marking bulk attendance:', error);
        res.status(500).json({ error: 'Failed to mark bulk attendance' });
    }
});

module.exports = router;
