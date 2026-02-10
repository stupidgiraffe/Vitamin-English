const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');

// Get lesson reports
router.get('/', async (req, res) => {
    try {
        const { classId, teacherId, startDate, endDate } = req.query;
        
        // Determine which table name to use
        const client = await dataHub.pool.connect();
        let tableName = 'teacher_comment_sheets';
        try {
            const tableCheck = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'teacher_comment_sheets'
            `);
            
            if (tableCheck.rows.length === 0) {
                // Check if old table exists
                const oldTableCheck = await client.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'lesson_reports'
                `);
                
                if (oldTableCheck.rows.length > 0) {
                    console.warn('⚠️  teacher_comment_sheets table not found, falling back to lesson_reports (migration 005 not applied)');
                    tableName = 'lesson_reports';
                }
            }
        } finally {
            client.release();
        }
        
        let query = `
            SELECT r.*, c.name as class_name, u.full_name as teacher_name
            FROM ${tableName} r
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
        
        const result = await dataHub.query(query, params);
        const reports = result.rows;
        res.json(reports);
    } catch (error) {
        console.error('❌ Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Get report by class and date
// NOTE: Must be defined before /:id to avoid Express matching 'by-date' as :id
router.get('/by-date/:classId/:date', async (req, res) => {
    try {
        const report = await dataHub.teacherCommentSheets.getByClassAndDate(
            req.params.classId, 
            req.params.date
        );
        
        res.json(report || null);
    } catch (error) {
        console.error('❌ Error fetching report by date:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Get a single report
router.get('/:id', async (req, res) => {
    try {
        const report = await dataHub.teacherCommentSheets.findById(req.params.id);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        res.json(report);
    } catch (error) {
        console.error('❌ Error fetching report:', error);
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
        const existing = await dataHub.teacherCommentSheets.getByClassAndDate(class_id, date);
        
        if (existing) {
            return res.status(400).json({ 
                error: 'Report for this class and date already exists',
                existingReportId: existing.id
            });
        }
        
        const report = await dataHub.teacherCommentSheets.create({
            class_id,
            teacher_id,
            date,
            target_topic: target_topic || '',
            vocabulary: vocabulary || '',
            mistakes: mistakes || '',
            strengths: strengths || '',
            comments: comments || ''
        });
        
        console.log('Report created successfully:', report.id); // Debug logging
        res.status(201).json(report);
    } catch (error) {
        console.error('❌ Error creating report:', error);
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
        
        const report = await dataHub.teacherCommentSheets.update(req.params.id, {
            teacher_id,
            target_topic: target_topic || '',
            vocabulary: vocabulary || '',
            mistakes: mistakes || '',
            strengths: strengths || '',
            comments: comments || ''
        });
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        console.log('Report updated successfully:', report.id); // Debug logging
        res.json(report);
    } catch (error) {
        console.error('❌ Error updating report:', error);
        res.status(500).json({ 
            error: 'Failed to update report',
            message: error.message 
        });
    }
});

// Delete a report
router.delete('/:id', async (req, res) => {
    try {
        await dataHub.teacherCommentSheets.delete(req.params.id);
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

module.exports = router;
