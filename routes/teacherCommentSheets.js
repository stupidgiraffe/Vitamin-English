const express = require('express');
const router = express.Router();
const pool = require('../database/init');

// Get teacher comment sheets
router.get('/', async (req, res) => {
    try {
        const { classId, teacherId, startDate, endDate } = req.query;
        
        let query = `
            SELECT r.*, c.name as class_name, u.full_name as teacher_name
            FROM teacher_comment_sheets r
            JOIN classes c ON r.class_id = c.id
            JOIN users u ON r.teacher_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (classId) {
            query += ` AND r.class_id = $${paramIndex}`;
            params.push(classId);
            paramIndex++;
        }
        
        if (teacherId) {
            query += ` AND r.teacher_id = $${paramIndex}`;
            params.push(teacherId);
            paramIndex++;
        }
        
        if (startDate) {
            query += ` AND r.date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            query += ` AND r.date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        query += ' ORDER BY r.date DESC';
        
        const result = await pool.query(query, params);
        const reports = result.rows;
        res.json(reports);
    } catch (error) {
        console.error('Error fetching teacher comment sheets:', error);
        res.status(500).json({ error: 'Failed to fetch teacher comment sheets' });
    }
});

// Get a single teacher comment sheet
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, c.name as class_name, u.full_name as teacher_name
            FROM teacher_comment_sheets r
            JOIN classes c ON r.class_id = c.id
            JOIN users u ON r.teacher_id = u.id
            WHERE r.id = $1
        `, [req.params.id]);
        const report = result.rows[0];
        
        if (!report) {
            return res.status(404).json({ error: 'Teacher comment sheet not found' });
        }
        
        res.json(report);
    } catch (error) {
        console.error('Error fetching teacher comment sheet:', error);
        res.status(500).json({ error: 'Failed to fetch teacher comment sheet' });
    }
});

// Get teacher comment sheet by class and date
router.get('/by-date/:classId/:date', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, c.name as class_name, u.full_name as teacher_name
            FROM teacher_comment_sheets r
            JOIN classes c ON r.class_id = c.id
            JOIN users u ON r.teacher_id = u.id
            WHERE r.class_id = $1 AND r.date = $2
        `, [req.params.classId, req.params.date]);
        const report = result.rows[0];
        
        res.json(report || null);
    } catch (error) {
        console.error('Error fetching teacher comment sheet by date:', error);
        res.status(500).json({ error: 'Failed to fetch teacher comment sheet' });
    }
});

// Create a new teacher comment sheet
router.post('/', async (req, res) => {
    try {
        const { class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments } = req.body;
        
        console.log('Saving teacher comment sheet:', { class_id, teacher_id, date });
        
        if (!class_id || !teacher_id || !date) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                details: {
                    class_id: !class_id ? 'required' : 'ok',
                    teacher_id: !teacher_id ? 'required' : 'ok',
                    date: !date ? 'required' : 'ok'
                }
            });
        }
        
        const existingResult = await pool.query(`
            SELECT id FROM teacher_comment_sheets 
            WHERE class_id = $1 AND date = $2
        `, [class_id, date]);
        const existing = existingResult.rows[0];
        
        if (existing) {
            return res.status(400).json({ 
                error: 'Teacher comment sheet for this class and date already exists',
                existingReportId: existing.id
            });
        }
        
        const result = await pool.query(`
            INSERT INTO teacher_comment_sheets (class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [class_id, teacher_id, date, target_topic || '', vocabulary || '', mistakes || '', strengths || '', comments || '']);
        
        const reportResult = await pool.query('SELECT * FROM teacher_comment_sheets WHERE id = $1', [result.rows[0].id]);
        const report = reportResult.rows[0];
        
        console.log('Teacher comment sheet created successfully:', report.id);
        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating teacher comment sheet:', error);
        res.status(500).json({ 
            error: 'Failed to create teacher comment sheet',
            message: error.message 
        });
    }
});

// Update a teacher comment sheet
router.put('/:id', async (req, res) => {
    try {
        const { teacher_id, target_topic, vocabulary, mistakes, strengths, comments } = req.body;
        
        console.log('Updating teacher comment sheet:', req.params.id);
        
        if (!teacher_id) {
            return res.status(400).json({ 
                error: 'Missing required field: teacher_id'
            });
        }
        
        await pool.query(`
            UPDATE teacher_comment_sheets 
            SET teacher_id = $1, target_topic = $2, vocabulary = $3, mistakes = $4, strengths = $5, comments = $6
            WHERE id = $7
        `, [
            teacher_id,
            target_topic || '',
            vocabulary || '',
            mistakes || '',
            strengths || '',
            comments || '',
            req.params.id
        ]);
        
        const result = await pool.query('SELECT * FROM teacher_comment_sheets WHERE id = $1', [req.params.id]);
        const report = result.rows[0];
        
        if (!report) {
            return res.status(404).json({ error: 'Teacher comment sheet not found' });
        }
        
        console.log('Teacher comment sheet updated successfully:', report.id);
        res.json(report);
    } catch (error) {
        console.error('Error updating teacher comment sheet:', error);
        res.status(500).json({ 
            error: 'Failed to update teacher comment sheet',
            message: error.message 
        });
    }
});

// Delete a teacher comment sheet
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM teacher_comment_sheets WHERE id = $1', [req.params.id]);
        res.json({ message: 'Teacher comment sheet deleted successfully' });
    } catch (error) {
        console.error('Error deleting teacher comment sheet:', error);
        res.status(500).json({ error: 'Failed to delete teacher comment sheet' });
    }
});

module.exports = router;
