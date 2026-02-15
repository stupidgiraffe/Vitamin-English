const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');

// Get all makeup lessons
router.get('/', async (req, res) => {
    try {
        const { status, studentId } = req.query;
        
        const options = {
            perPage: 0 // No pagination, get all
        };
        
        if (status) {
            options.status = status;
        }
        
        // If studentId is provided, use custom query
        if (studentId) {
            const lessons = await dataHub.makeupLessons.getByStudent(studentId, 1000);
            return res.json(lessons);
        }
        
        const lessons = await dataHub.makeupLessons.findAll(options);
        res.json(lessons);
    } catch (error) {
        console.error('❌ Error fetching makeup lessons:', error);
        res.status(500).json({ error: 'Failed to fetch makeup lessons' });
    }
});

// Get upcoming makeup lessons
router.get('/upcoming', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const lessons = await dataHub.makeupLessons.getUpcoming(today, 10);
        
        res.json(lessons);
    } catch (error) {
        console.error('❌ Error fetching upcoming makeup lessons:', error);
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
        
        const lesson = await dataHub.makeupLessons.create({
            student_id,
            class_id,
            scheduled_date,
            scheduled_time: scheduled_time || '',
            reason: reason || '',
            notes: notes || '',
            status: 'scheduled'
        });
        
        res.status(201).json(lesson);
    } catch (error) {
        console.error('❌ Error creating makeup lesson:', error);
        res.status(500).json({ error: 'Failed to create makeup lesson' });
    }
});

// Update a makeup lesson
router.put('/:id', async (req, res) => {
    try {
        const { scheduled_date, scheduled_time, reason, status, notes } = req.body;
        
        const lesson = await dataHub.makeupLessons.update(req.params.id, {
            scheduled_date,
            scheduled_time: scheduled_time || '',
            reason: reason || '',
            status: status || 'scheduled',
            notes: notes || ''
        });
        
        if (!lesson) {
            return res.status(404).json({ error: 'Makeup lesson not found' });
        }
        
        res.json(lesson);
    } catch (error) {
        console.error('❌ Error updating makeup lesson:', error);
        res.status(500).json({ error: 'Failed to update makeup lesson' });
    }
});

// Delete a makeup lesson
router.delete('/:id', async (req, res) => {
    try {
        await dataHub.makeupLessons.delete(req.params.id);
        res.json({ message: 'Makeup lesson deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting makeup lesson:', error);
        res.status(500).json({ error: 'Failed to delete makeup lesson' });
    }
});

module.exports = router;
