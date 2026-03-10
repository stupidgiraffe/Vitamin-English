const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');

/**
 * Extract a time string (HH:MM) from a class schedule string.
 * Examples: "Monday 10:00", "Tue/Thu 14:30-15:30", "10am", "09:00AM"
 * Returns null if no time is found.
 */
function extractTimeFromSchedule(schedule) {
    if (!schedule) return null;
    // Match HH:MM patterns (24-hour or 12-hour with optional am/pm)
    const match = schedule.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const meridiem = (match[3] || '').toLowerCase();
        if (meridiem === 'pm' && hours !== 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
    return null;
}

// Get all makeup lessons
router.get('/', async (req, res) => {
    try {
        const { status, studentId, startDate, endDate } = req.query;
        
        const options = {
            perPage: 0 // No pagination, get all
        };
        
        if (status) {
            options.status = status;
        }
        
        // If studentId is provided, use custom query
        if (studentId) {
            let lessons = await dataHub.makeupLessons.getByStudent(studentId, 1000);
            // Apply additional filters
            if (status) {
                lessons = lessons.filter(l => l.status === status);
            }
            if (startDate) {
                lessons = lessons.filter(l => l.scheduled_date >= startDate);
            }
            if (endDate) {
                lessons = lessons.filter(l => l.scheduled_date <= endDate);
            }
            return res.json(lessons);
        }
        
        let lessons = await dataHub.makeupLessons.findAll(options);
        
        // Apply date range filtering if provided
        if (startDate) {
            lessons = lessons.filter(l => l.scheduled_date >= startDate);
        }
        if (endDate) {
            lessons = lessons.filter(l => l.scheduled_date <= endDate);
        }
        
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

// Get a single makeup lesson by ID
router.get('/:id', async (req, res) => {
    try {
        const lesson = await dataHub.makeupLessons.findById(req.params.id);
        if (!lesson) {
            return res.status(404).json({ error: 'Makeup lesson not found' });
        }
        res.json(lesson);
    } catch (error) {
        console.error('❌ Error fetching makeup lesson:', error);
        res.status(500).json({ error: 'Failed to fetch makeup lesson' });
    }
});

// Create a new makeup lesson
router.post('/', async (req, res) => {
    try {
        const { student_id, class_id, scheduled_date, reason, notes } = req.body;
        
        if (!student_id || !class_id || !scheduled_date) {
            return res.status(400).json({ error: 'Student, class, and date are required' });
        }
        
        // Auto-derive scheduled_time from the class schedule
        const classData = await dataHub.classes.findById(class_id);
        const scheduled_time = classData ? (extractTimeFromSchedule(classData.schedule) || '') : '';
        
        const lesson = await dataHub.makeupLessons.create({
            student_id,
            class_id,
            scheduled_date,
            scheduled_time,
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
        const { student_id, class_id, scheduled_date, reason, status, notes } = req.body;

        // Re-derive scheduled_time from the class schedule when class changes
        let scheduled_time;
        if (class_id) {
            const classData = await dataHub.classes.findById(class_id);
            scheduled_time = classData ? (extractTimeFromSchedule(classData.schedule) || '') : '';
        } else {
            const existing = await dataHub.makeupLessons.findById(req.params.id);
            scheduled_time = existing ? (existing.scheduled_time || '') : '';
        }

        const updateData = {
            scheduled_date,
            scheduled_time,
            reason: reason || '',
            status: status || 'scheduled',
            notes: notes || ''
        };

        if (student_id) updateData.student_id = student_id;
        if (class_id) updateData.class_id = class_id;
        
        const lesson = await dataHub.makeupLessons.update(req.params.id, updateData);
        
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
        const deleted = await dataHub.makeupLessons.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Makeup lesson not found' });
        }
        res.json({ message: 'Makeup lesson deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting makeup lesson:', error);
        res.status(500).json({ error: 'Failed to delete makeup lesson' });
    }
});

module.exports = router;
