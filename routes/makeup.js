const express = require('express');
const router = express.Router();
const pool = require('../database/init');

// Get all makeup lessons
router.get('/', async (req, res) => {
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
        let paramIndex = 1;
        
        if (status) {
            query += ` AND ml.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        if (studentId) {
            query += ` AND ml.student_id = $${paramIndex}`;
            params.push(studentId);
            paramIndex++;
        }
        
        query += ' ORDER BY ml.scheduled_date DESC, ml.scheduled_time';
        
        const result = await pool.query(query, params);
        const lessons = result.rows;
        res.json(lessons);
    } catch (error) {
        console.error('Error fetching makeup lessons:', error);
        res.status(500).json({ error: 'Failed to fetch makeup lessons' });
    }
});

// Get upcoming makeup lessons
router.get('/upcoming', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await pool.query(`
            SELECT ml.*, s.name as student_name, c.name as class_name 
            FROM makeup_lessons ml 
            LEFT JOIN students s ON ml.student_id = s.id 
            LEFT JOIN classes c ON ml.class_id = c.id 
            WHERE ml.scheduled_date >= $1 AND ml.status = 'scheduled'
            ORDER BY ml.scheduled_date, ml.scheduled_time
            LIMIT 10
        `, [today]);
        const lessons = result.rows;
        
        res.json(lessons);
    } catch (error) {
        console.error('Error fetching upcoming makeup lessons:', error);
        res.status(500).json({ error: 'Failed to fetch upcoming makeup lessons' });
    }
});

// Create a new makeup lesson
router.post('/', async (req, res) => {
    try {
        const { student_id, class_id, scheduled_date, scheduled_time, reason, notes } = req.body;
        
        if (!student_id || !class_id || !scheduled_date) {
            return res.status(400).json({ error: 'Student, class, and date are required' });
        }
        
        const result = await pool.query(`
            INSERT INTO makeup_lessons (student_id, class_id, scheduled_date, scheduled_time, reason, notes, status) 
            VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
            RETURNING id
        `, [student_id, class_id, scheduled_date, scheduled_time || '', reason || '', notes || '']);
        
        const lessonResult = await pool.query(`
            SELECT ml.*, s.name as student_name, c.name as class_name 
            FROM makeup_lessons ml 
            LEFT JOIN students s ON ml.student_id = s.id 
            LEFT JOIN classes c ON ml.class_id = c.id 
            WHERE ml.id = $1
        `, [result.rows[0].id]);
        const lesson = lessonResult.rows[0];
        
        res.status(201).json(lesson);
    } catch (error) {
        console.error('Error creating makeup lesson:', error);
        res.status(500).json({ error: 'Failed to create makeup lesson' });
    }
});

// Update a makeup lesson
router.put('/:id', async (req, res) => {
    try {
        const { scheduled_date, scheduled_time, reason, status, notes } = req.body;
        
        await pool.query(`
            UPDATE makeup_lessons 
            SET scheduled_date = $1, scheduled_time = $2, reason = $3, status = $4, notes = $5
            WHERE id = $6
        `, [
            scheduled_date, 
            scheduled_time || '', 
            reason || '', 
            status || 'scheduled',
            notes || '',
            req.params.id
        ]);
        
        const result = await pool.query(`
            SELECT ml.*, s.name as student_name, c.name as class_name 
            FROM makeup_lessons ml 
            LEFT JOIN students s ON ml.student_id = s.id 
            LEFT JOIN classes c ON ml.class_id = c.id 
            WHERE ml.id = $1
        `, [req.params.id]);
        const lesson = result.rows[0];
        
        res.json(lesson);
    } catch (error) {
        console.error('Error updating makeup lesson:', error);
        res.status(500).json({ error: 'Failed to update makeup lesson' });
    }
});

// Delete a makeup lesson
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM makeup_lessons WHERE id = $1', [req.params.id]);
        res.json({ message: 'Makeup lesson deleted successfully' });
    } catch (error) {
        console.error('Error deleting makeup lesson:', error);
        res.status(500).json({ error: 'Failed to delete makeup lesson' });
    }
});

module.exports = router;
