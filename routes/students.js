const express = require('express');
const router = express.Router();
const pool = require('../database/init');

// Get all students
router.get('/', async (req, res) => {
    try {
        const { classId } = req.query;
        let query = `
            SELECT s.*, c.name as class_name 
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id 
            WHERE s.active = true
        `;
        const params = [];
        
        if (classId) {
            query += ' AND s.class_id = $1';
            params.push(classId);
        }
        
        query += ' ORDER BY s.student_type, s.name';
        
        const result = await pool.query(query, params);
        const students = result.rows;
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Get a single student
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.*, c.name as class_name 
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id 
            WHERE s.id = $1
        `, [req.params.id]);
        const student = result.rows[0];
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json(student);
    } catch (error) {
        console.error('Error fetching student:', error);
        res.status(500).json({ error: 'Failed to fetch student' });
    }
});

// Get student details with attendance and reports
router.get('/:id/details', async (req, res) => {
    try {
        const studentResult = await pool.query(`
            SELECT s.*, c.name as class_name, c.id as class_id
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id 
            WHERE s.id = $1
        `, [req.params.id]);
        const student = studentResult.rows[0];
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        // Get attendance records (last 60 days)
        const attendanceResult = await pool.query(`
            SELECT date, status, notes 
            FROM attendance 
            WHERE student_id = $1 
            ORDER BY date DESC 
            LIMIT 60
        `, [req.params.id]);
        const attendance = attendanceResult.rows;
        
        // Get lesson reports for the student's class (last 20)
        const reportsResult = await pool.query(`
            SELECT lr.*, u.full_name as teacher_name 
            FROM lesson_reports lr 
            LEFT JOIN users u ON lr.teacher_id = u.id 
            WHERE lr.class_id = $1 
            ORDER BY lr.date DESC 
            LIMIT 20
        `, [student.class_id]);
        const reports = reportsResult.rows;
        
        // Calculate attendance stats
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'O' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN status = 'X' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN status = '/' THEN 1 ELSE 0 END) as partial
            FROM attendance 
            WHERE student_id = $1
        `, [req.params.id]);
        const stats = statsResult.rows[0];
        
        // Get makeup lessons for this student
        const makeupResult = await pool.query(`
            SELECT ml.*, c.name as class_name 
            FROM makeup_lessons ml 
            LEFT JOIN classes c ON ml.class_id = c.id 
            WHERE ml.student_id = $1 
            ORDER BY ml.scheduled_date DESC 
            LIMIT 10
        `, [req.params.id]);
        const makeupLessons = makeupResult.rows;
        
        res.json({
            student,
            attendance,
            reports,
            stats,
            makeupLessons
        });
    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).json({ error: 'Failed to fetch student details' });
    }
});

// Create a new student
router.post('/', async (req, res) => {
    try {
        const { 
            name, class_id, student_type, color_code, notes,
            email, phone, parent_name, parent_phone, parent_email, enrollment_date 
        } = req.body;
        
        // Only validate name
        if (!name || !name.trim()) {
            return res.status(400).json({ 
                error: 'Student name is required',
                hint: 'Enter the student\'s name to get started'
            });
        }
        
        const result = await pool.query(`
            INSERT INTO students (
                name, class_id, student_type, color_code, notes,
                email, phone, parent_name, parent_phone, parent_email, enrollment_date
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `, [
            name.trim(), 
            class_id || null, 
            student_type || 'regular', 
            color_code || '', 
            notes || '',
            email || '',
            phone || '',
            parent_name || '',
            parent_phone || '',
            parent_email || '',
            enrollment_date || new Date().toISOString().split('T')[0]
        ]);
        
        const studentResult = await pool.query('SELECT * FROM students WHERE id = $1', [result.rows[0].id]);
        const student = studentResult.rows[0];
        res.status(201).json(student);
    } catch (error) {
        console.error('Error creating student:', error);
        res.status(500).json({ 
            error: 'Could not create student',
            hint: 'Please try again or contact support'
        });
    }
});

// Update a student
router.put('/:id', async (req, res) => {
    try {
        const { 
            name, class_id, student_type, color_code, notes, active,
            email, phone, parent_name, parent_phone, parent_email, enrollment_date
        } = req.body;
        
        await pool.query(`
            UPDATE students 
            SET name = $1, class_id = $2, student_type = $3, color_code = $4, notes = $5, active = $6,
                email = $7, phone = $8, parent_name = $9, parent_phone = $10, parent_email = $11, enrollment_date = $12
            WHERE id = $13
        `, [
            name, 
            class_id || null, 
            student_type || 'regular', 
            color_code || '', 
            notes || '', 
            active !== undefined ? active : true,
            email || '',
            phone || '',
            parent_name || '',
            parent_phone || '',
            parent_email || '',
            enrollment_date || '',
            req.params.id
        ]);
        
        const result = await pool.query('SELECT * FROM students WHERE id = $1', [req.params.id]);
        const student = result.rows[0];
        res.json(student);
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({ error: 'Failed to update student' });
    }
});

// Delete a student (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('UPDATE students SET active = false WHERE id = $1', [req.params.id]);
        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ error: 'Failed to delete student' });
    }
});

module.exports = router;
