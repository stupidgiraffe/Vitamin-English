const express = require('express');
const router = express.Router();
const pool = require('../database/init');

// Get lesson reports
router.get('/', async (req, res) => {
    try {
        const { classId, teacherId, startDate, endDate } = req.query;
        
        let query = `
            SELECT r.*, c.name as class_name, u.full_name as teacher_name
            FROM lesson_reports r
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
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Get a single report
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, c.name as class_name, u.full_name as teacher_name
            FROM lesson_reports r
            JOIN classes c ON r.class_id = c.id
            JOIN users u ON r.teacher_id = u.id
            WHERE r.id = $1
        `, [req.params.id]);
        const report = result.rows[0];
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        res.json(report);
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Get report by class and date
router.get('/by-date/:classId/:date', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, c.name as class_name, u.full_name as teacher_name
            FROM lesson_reports r
            JOIN classes c ON r.class_id = c.id
            JOIN users u ON r.teacher_id = u.id
            WHERE r.class_id = $1 AND r.date = $2
        `, [req.params.classId, req.params.date]);
        const report = result.rows[0];
        
        res.json(report || null);
    } catch (error) {
        console.error('Error fetching report by date:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Create a new report
router.post('/', async (req, res) => {
    try {
        const { class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments } = req.body;
        
        console.log('Saving report:', { class_id, teacher_id, date }); // Debug logging
        
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
        
        // Check if report already exists
        const existingResult = await pool.query(`
            SELECT id FROM lesson_reports 
            WHERE class_id = $1 AND date = $2
        `, [class_id, date]);
        const existing = existingResult.rows[0];
        
        if (existing) {
            return res.status(400).json({ 
                error: 'Report for this class and date already exists',
                existingReportId: existing.id
            });
        }
        
        const result = await pool.query(`
            INSERT INTO lesson_reports (class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [class_id, teacher_id, date, target_topic || '', vocabulary || '', mistakes || '', strengths || '', comments || '']);
        
        const reportResult = await pool.query('SELECT * FROM lesson_reports WHERE id = $1', [result.rows[0].id]);
        const report = reportResult.rows[0];
        
        console.log('Report created successfully:', report.id); // Debug logging
        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ 
            error: 'Failed to create report',
            message: error.message 
        });
    }
});

// Update a report
router.put('/:id', async (req, res) => {
    try {
        const { teacher_id, target_topic, vocabulary, mistakes, strengths, comments } = req.body;
        
        console.log('Updating report:', req.params.id); // Debug logging
        
        if (!teacher_id) {
            return res.status(400).json({ 
                error: 'Missing required field: teacher_id'
            });
        }
        
        await pool.query(`
            UPDATE lesson_reports 
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
        
        const result = await pool.query('SELECT * FROM lesson_reports WHERE id = $1', [req.params.id]);
        const report = result.rows[0];
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        console.log('Report updated successfully:', report.id); // Debug logging
        res.json(report);
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ 
            error: 'Failed to update report',
            message: error.message 
        });
    }
});

// Delete a report
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM lesson_reports WHERE id = $1', [req.params.id]);
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

module.exports = router;
