const express = require('express');
const router = express.Router();
const db = require('../database/init');

// Get all makeup lessons
router.get('/', (req, res) => {
    try {
        const { status, studentId } = req.query;
        let query = `
            SELECT ml.*, s.name as student_name, c.name as class_name 
            FROM makeup_lessons ml 
            LEFT JOIN students s ON ml.student_id = s.id 
            LEFT JOIN classes c ON ml.class_id = c.id 
            WHERE 1=1
        `;
        const params = [];
        
        if (status) {
            query += ' AND ml.status = ?';
            params.push(status);
        }
        
        if (studentId) {
            query += ' AND ml.student_id = ?';
            params.push(studentId);
        }
        
        query += ' ORDER BY ml.scheduled_date DESC, ml.scheduled_time';
        
        const lessons = db.prepare(query).all(...params);
        res.json(lessons);
    } catch (error) {
        console.error('Error fetching makeup lessons:', error);
        res.status(500).json({ error: 'Failed to fetch makeup lessons' });
    }
});

// Get upcoming makeup lessons
router.get('/upcoming', (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const lessons = db.prepare(`
            SELECT ml.*, s.name as student_name, c.name as class_name 
            FROM makeup_lessons ml 
            LEFT JOIN students s ON ml.student_id = s.id 
            LEFT JOIN classes c ON ml.class_id = c.id 
            WHERE ml.scheduled_date >= ? AND ml.status = 'scheduled'
            ORDER BY ml.scheduled_date, ml.scheduled_time
            LIMIT 10
        `).all(today);
        
        res.json(lessons);
    } catch (error) {
        console.error('Error fetching upcoming makeup lessons:', error);
        res.status(500).json({ error: 'Failed to fetch upcoming makeup lessons' });
    }
});

// Create a new makeup lesson
router.post('/', (req, res) => {
    try {
        const { student_id, class_id, scheduled_date, scheduled_time, reason, notes } = req.body;
        
        if (!student_id || !class_id || !scheduled_date) {
            return res.status(400).json({ error: 'Student, class, and date are required' });
        }
        
        const result = db.prepare(`
            INSERT INTO makeup_lessons (student_id, class_id, scheduled_date, scheduled_time, reason, notes, status) 
            VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
        `).run(student_id, class_id, scheduled_date, scheduled_time || '', reason || '', notes || '');
        
        const lesson = db.prepare(`
            SELECT ml.*, s.name as student_name, c.name as class_name 
            FROM makeup_lessons ml 
            LEFT JOIN students s ON ml.student_id = s.id 
            LEFT JOIN classes c ON ml.class_id = c.id 
            WHERE ml.id = ?
        `).get(result.lastInsertRowid);
        
        res.status(201).json(lesson);
    } catch (error) {
        console.error('Error creating makeup lesson:', error);
        res.status(500).json({ error: 'Failed to create makeup lesson' });
    }
});

// Update a makeup lesson
router.put('/:id', (req, res) => {
    try {
        const { scheduled_date, scheduled_time, reason, status, notes } = req.body;
        
        db.prepare(`
            UPDATE makeup_lessons 
            SET scheduled_date = ?, scheduled_time = ?, reason = ?, status = ?, notes = ?
            WHERE id = ?
        `).run(
            scheduled_date, 
            scheduled_time || '', 
            reason || '', 
            status || 'scheduled',
            notes || '',
            req.params.id
        );
        
        const lesson = db.prepare(`
            SELECT ml.*, s.name as student_name, c.name as class_name 
            FROM makeup_lessons ml 
            LEFT JOIN students s ON ml.student_id = s.id 
            LEFT JOIN classes c ON ml.class_id = c.id 
            WHERE ml.id = ?
        `).get(req.params.id);
        
        res.json(lesson);
    } catch (error) {
        console.error('Error updating makeup lesson:', error);
        res.status(500).json({ error: 'Failed to update makeup lesson' });
    }
});

// Delete a makeup lesson
router.delete('/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM makeup_lessons WHERE id = ?').run(req.params.id);
        res.json({ message: 'Makeup lesson deleted successfully' });
    } catch (error) {
        console.error('Error deleting makeup lesson:', error);
        res.status(500).json({ error: 'Failed to delete makeup lesson' });
    }
});

module.exports = router;
