const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');

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
        
        const result = await dataHub.query(query, params);
        const reports = result.rows;
        res.json(reports);
    } catch (error) {
        console.error('❌ Error fetching teacher comment sheets:', error);
        res.status(500).json({ error: 'Failed to fetch teacher comment sheets' });
    }
});

// Get teacher comment sheet by class and date
// NOTE: Must be defined before /:id to avoid Express matching 'by-date' as :id
router.get('/by-date/:classId/:date', async (req, res) => {
    try {
        const report = await dataHub.teacherCommentSheets.getByClassAndDate(
            req.params.classId,
            req.params.date
        );
        
        res.json(report || null);
    } catch (error) {
        console.error('❌ Error fetching teacher comment sheet by date:', error);
        res.status(500).json({ error: 'Failed to fetch teacher comment sheet' });
    }
});

// Get a single teacher comment sheet
router.get('/:id', async (req, res) => {
    try {
        const report = await dataHub.teacherCommentSheets.findById(req.params.id);
        
        if (!report) {
            return res.status(404).json({ error: 'Teacher comment sheet not found' });
        }
        
        res.json(report);
    } catch (error) {
        console.error('❌ Error fetching teacher comment sheet:', error);
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
        
        const existing = await dataHub.teacherCommentSheets.getByClassAndDate(class_id, date);
        
        if (existing) {
            return res.status(400).json({ 
                error: 'Teacher comment sheet for this class and date already exists',
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
        
        console.log('Teacher comment sheet created successfully:', report.id);
        res.status(201).json(report);
    } catch (error) {
        console.error('❌ Error creating teacher comment sheet:', error);
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
        
        const report = await dataHub.teacherCommentSheets.update(req.params.id, {
            teacher_id,
            target_topic: target_topic || '',
            vocabulary: vocabulary || '',
            mistakes: mistakes || '',
            strengths: strengths || '',
            comments: comments || ''
        });
        
        if (!report) {
            return res.status(404).json({ error: 'Teacher comment sheet not found' });
        }
        
        console.log('Teacher comment sheet updated successfully:', report.id);
        res.json(report);
    } catch (error) {
        console.error('❌ Error updating teacher comment sheet:', error);
        res.status(500).json({ 
            error: 'Failed to update teacher comment sheet',
            message: error.message 
        });
    }
});

// Delete a teacher comment sheet
router.delete('/:id', async (req, res) => {
    try {
        await dataHub.teacherCommentSheets.delete(req.params.id);
        res.json({ message: 'Teacher comment sheet deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting teacher comment sheet:', error);
        res.status(500).json({ error: 'Failed to delete teacher comment sheet' });
    }
});

module.exports = router;
