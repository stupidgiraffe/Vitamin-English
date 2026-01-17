const express = require('express');
const router = express.Router();
const db = require('../database/init');

// Get lesson reports
router.get('/', (req, res) => {
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
        
        if (classId) {
            query += ' AND r.class_id = ?';
            params.push(classId);
        }
        
        if (teacherId) {
            query += ' AND r.teacher_id = ?';
            params.push(teacherId);
        }
        
        if (startDate) {
            query += ' AND r.date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND r.date <= ?';
            params.push(endDate);
        }
        
        query += ' ORDER BY r.date DESC';
        
        const reports = db.prepare(query).all(...params);
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Get a single report
router.get('/:id', (req, res) => {
    try {
        const report = db.prepare(`
            SELECT r.*, c.name as class_name, u.full_name as teacher_name
            FROM lesson_reports r
            JOIN classes c ON r.class_id = c.id
            JOIN users u ON r.teacher_id = u.id
            WHERE r.id = ?
        `).get(req.params.id);
        
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
router.get('/by-date/:classId/:date', (req, res) => {
    try {
        const report = db.prepare(`
            SELECT r.*, c.name as class_name, u.full_name as teacher_name
            FROM lesson_reports r
            JOIN classes c ON r.class_id = c.id
            JOIN users u ON r.teacher_id = u.id
            WHERE r.class_id = ? AND r.date = ?
        `).get(req.params.classId, req.params.date);
        
        res.json(report || null);
    } catch (error) {
        console.error('Error fetching report by date:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Create a new report
router.post('/', (req, res) => {
    try {
        const { class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments } = req.body;
        
        if (!class_id || !teacher_id || !date) {
            return res.status(400).json({ error: 'class_id, teacher_id, and date are required' });
        }
        
        // Check if report already exists
        const existing = db.prepare(`
            SELECT id FROM lesson_reports 
            WHERE class_id = ? AND date = ?
        `).get(class_id, date);
        
        if (existing) {
            return res.status(400).json({ error: 'Report for this class and date already exists' });
        }
        
        const result = db.prepare(`
            INSERT INTO lesson_reports (class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(class_id, teacher_id, date, target_topic || '', vocabulary || '', mistakes || '', strengths || '', comments || '');
        
        const report = db.prepare('SELECT * FROM lesson_reports WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
});

// Update a report
router.put('/:id', (req, res) => {
    try {
        const { teacher_id, target_topic, vocabulary, mistakes, strengths, comments } = req.body;
        
        db.prepare(`
            UPDATE lesson_reports 
            SET teacher_id = ?, target_topic = ?, vocabulary = ?, mistakes = ?, strengths = ?, comments = ?
            WHERE id = ?
        `).run(
            teacher_id,
            target_topic || '',
            vocabulary || '',
            mistakes || '',
            strengths || '',
            comments || '',
            req.params.id
        );
        
        const report = db.prepare('SELECT * FROM lesson_reports WHERE id = ?').get(req.params.id);
        res.json(report);
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// Delete a report
router.delete('/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM lesson_reports WHERE id = ?').run(req.params.id);
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

module.exports = router;
