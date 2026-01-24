const express = require('express');
const router = express.Router();
const db = require('../database/init');

// Get all students
router.get('/', (req, res) => {
    try {
        const { classId } = req.query;
        let query = `
            SELECT s.*, c.name as class_name 
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id 
            WHERE s.active = 1
        `;
        const params = [];
        
        if (classId) {
            query += ' AND s.class_id = ?';
            params.push(classId);
        }
        
        query += ' ORDER BY s.student_type, s.name';
        
        const students = db.prepare(query).all(...params);
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Get a single student
router.get('/:id', (req, res) => {
    try {
        const student = db.prepare(`
            SELECT s.*, c.name as class_name 
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id 
            WHERE s.id = ?
        `).get(req.params.id);
        
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
router.get('/:id/details', (req, res) => {
    try {
        const student = db.prepare(`
            SELECT s.*, c.name as class_name, c.id as class_id
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id 
            WHERE s.id = ?
        `).get(req.params.id);
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        // Get attendance records (last 60 days)
        const attendance = db.prepare(`
            SELECT date, status, notes 
            FROM attendance 
            WHERE student_id = ? 
            ORDER BY date DESC 
            LIMIT 60
        `).all(req.params.id);
        
        // Get lesson reports for the student's class (last 20)
        const reports = db.prepare(`
            SELECT lr.*, u.full_name as teacher_name 
            FROM lesson_reports lr 
            LEFT JOIN users u ON lr.teacher_id = u.id 
            WHERE lr.class_id = ? 
            ORDER BY lr.date DESC 
            LIMIT 20
        `).all(student.class_id);
        
        // Calculate attendance stats
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'O' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN status = 'X' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN status = '/' THEN 1 ELSE 0 END) as partial
            FROM attendance 
            WHERE student_id = ?
        `).get(req.params.id);
        
        // Get makeup lessons for this student
        const makeupLessons = db.prepare(`
            SELECT ml.*, c.name as class_name 
            FROM makeup_lessons ml 
            LEFT JOIN classes c ON ml.class_id = c.id 
            WHERE ml.student_id = ? 
            ORDER BY ml.scheduled_date DESC 
            LIMIT 10
        `).all(req.params.id);
        
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
router.post('/', (req, res) => {
    try {
        const { 
            name, class_id, student_type, color_code, notes,
            email, phone, parent_name, parent_phone, parent_email, enrollment_date 
        } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        const result = db.prepare(`
            INSERT INTO students (
                name, class_id, student_type, color_code, notes,
                email, phone, parent_name, parent_phone, parent_email, enrollment_date
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            name, 
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
        );
        
        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(student);
    } catch (error) {
        console.error('Error creating student:', error);
        res.status(500).json({ error: 'Failed to create student' });
    }
});

// Update a student
router.put('/:id', (req, res) => {
    try {
        const { 
            name, class_id, student_type, color_code, notes, active,
            email, phone, parent_name, parent_phone, parent_email, enrollment_date
        } = req.body;
        
        db.prepare(`
            UPDATE students 
            SET name = ?, class_id = ?, student_type = ?, color_code = ?, notes = ?, active = ?,
                email = ?, phone = ?, parent_name = ?, parent_phone = ?, parent_email = ?, enrollment_date = ?
            WHERE id = ?
        `).run(
            name, 
            class_id || null, 
            student_type || 'regular', 
            color_code || '', 
            notes || '', 
            active !== undefined ? active : 1,
            email || '',
            phone || '',
            parent_name || '',
            parent_phone || '',
            parent_email || '',
            enrollment_date || '',
            req.params.id
        );
        
        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
        res.json(student);
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({ error: 'Failed to update student' });
    }
});

// Delete a student (soft delete)
router.delete('/:id', (req, res) => {
    try {
        db.prepare('UPDATE students SET active = 0 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ error: 'Failed to delete student' });
    }
});

module.exports = router;
