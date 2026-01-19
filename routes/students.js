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

// Create a new student
router.post('/', (req, res) => {
    try {
        const { name, class_id, student_type, color_code, notes } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        const result = db.prepare(`
            INSERT INTO students (name, class_id, student_type, color_code, notes) 
            VALUES (?, ?, ?, ?, ?)
        `).run(name, class_id || null, student_type || 'regular', color_code || '', notes || '');
        
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
        const { name, class_id, student_type, color_code, notes, active } = req.body;
        
        db.prepare(`
            UPDATE students 
            SET name = ?, class_id = ?, student_type = ?, color_code = ?, notes = ?, active = ?
            WHERE id = ?
        `).run(
            name, 
            class_id || null, 
            student_type || 'regular', 
            color_code || '', 
            notes || '', 
            active !== undefined ? active : 1,
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
