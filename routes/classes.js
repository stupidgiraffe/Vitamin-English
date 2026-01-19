const express = require('express');
const router = express.Router();
const db = require('../database/init');

// Get all classes
router.get('/', (req, res) => {
    try {
        const classes = db.prepare(`
            SELECT c.*, u.full_name as teacher_name 
            FROM classes c 
            LEFT JOIN users u ON c.teacher_id = u.id 
            WHERE c.active = 1
            ORDER BY c.name
        `).all();
        
        res.json(classes);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
});

// Get a single class
router.get('/:id', (req, res) => {
    try {
        const classInfo = db.prepare(`
            SELECT c.*, u.full_name as teacher_name 
            FROM classes c 
            LEFT JOIN users u ON c.teacher_id = u.id 
            WHERE c.id = ?
        `).get(req.params.id);
        
        if (!classInfo) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        res.json(classInfo);
    } catch (error) {
        console.error('Error fetching class:', error);
        res.status(500).json({ error: 'Failed to fetch class' });
    }
});

// Get students in a class
router.get('/:id/students', (req, res) => {
    try {
        const students = db.prepare(`
            SELECT * FROM students 
            WHERE class_id = ? AND active = 1
            ORDER BY student_type, name
        `).all(req.params.id);
        
        res.json(students);
    } catch (error) {
        console.error('Error fetching class students:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Create a new class
router.post('/', (req, res) => {
    try {
        const { name, teacher_id, schedule, color } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        const result = db.prepare(`
            INSERT INTO classes (name, teacher_id, schedule, color) 
            VALUES (?, ?, ?, ?)
        `).run(name, teacher_id || null, schedule || '', color || '#4A90E2');
        
        const classInfo = db.prepare('SELECT * FROM classes WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(classInfo);
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).json({ error: 'Failed to create class' });
    }
});

// Update a class
router.put('/:id', (req, res) => {
    try {
        const { name, teacher_id, schedule, color, active } = req.body;
        
        db.prepare(`
            UPDATE classes 
            SET name = ?, teacher_id = ?, schedule = ?, color = ?, active = ?
            WHERE id = ?
        `).run(
            name, 
            teacher_id || null, 
            schedule || '', 
            color || '#4A90E2',
            active !== undefined ? active : 1,
            req.params.id
        );
        
        const classInfo = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
        res.json(classInfo);
    } catch (error) {
        console.error('Error updating class:', error);
        res.status(500).json({ error: 'Failed to update class' });
    }
});

// Delete a class (soft delete)
router.delete('/:id', (req, res) => {
    try {
        db.prepare('UPDATE classes SET active = 0 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error('Error deleting class:', error);
        res.status(500).json({ error: 'Failed to delete class' });
    }
});

module.exports = router;
