const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');

// ── Schedule conflict detection ─────────────────────────────────────────────
// Canonical schedule format expected: "Mon/Wed 10:00-11:30"
// Days are "/" separated day abbreviations; time is HH:MM-HH:MM (24-hour).
const SCHEDULE_RE = /^([A-Za-z]+(?:\/[A-Za-z]+)*)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/;

/**
 * Compare two HH:MM time strings. Returns negative if a < b, positive if a > b.
 * e.g. "09:00" < "10:30"
 */
function cmpTime(a, b) {
    const [ah, am] = a.split(':').map(Number);
    const [bh, bm] = b.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
}

/**
 * Check whether a proposed teacher assignment would double-book the teacher.
 *
 * Returns a conflict descriptor object  { className, schedule }  if there is
 * an overlap with an existing class, or  null  when everything is fine.
 *
 * @param {number|string} teacherId      - The teacher being assigned.
 * @param {string}        schedule       - Proposed canonical schedule string.
 * @param {number|string} [excludeId]    - Class ID to ignore (used when updating).
 */
async function findDoubleBooking(teacherId, schedule, excludeId) {
    // Only check canonical schedules — free-text legacy values are skipped.
    if (!teacherId || !schedule || !schedule.trim()) return null;
    const m = schedule.trim().match(SCHEDULE_RE);
    if (!m) return null;

    const newDays  = m[1].split('/');
    const newStart = m[2];
    const newEnd   = m[3];

    // Fetch all active classes for this teacher.
    const allClasses = await dataHub.classes.findAll({ active: true, perPage: 0 });
    const teacherClasses = allClasses.filter(c =>
        String(c.teacher_id) === String(teacherId) &&
        c.schedule &&
        (!excludeId || String(c.id) !== String(excludeId))
    );

    for (const cls of teacherClasses) {
        const em = cls.schedule.trim().match(SCHEDULE_RE);
        if (!em) continue; // skip legacy schedules

        const existDays  = em[1].split('/');
        const existStart = em[2];
        const existEnd   = em[3];

        // Days overlap?
        const dayOverlap = newDays.some(d => existDays.includes(d));
        if (!dayOverlap) continue;

        // Time ranges overlap? (newStart < existEnd AND newEnd > existStart)
        if (cmpTime(newStart, existEnd) < 0 && cmpTime(newEnd, existStart) > 0) {
            return { className: cls.name, schedule: cls.schedule };
        }
    }
    return null;
}
// ───────────────────────────────────────────────────────────────────────────

// Get all classes
router.get('/', async (req, res) => {
    try {
        const classes = await dataHub.classes.findAll({
            active: true,
            orderBy: 'name',
            orderDirection: 'ASC',
            perPage: 0 // No pagination, get all
        });
        
        res.json(classes);
    } catch (error) {
        console.error('❌ Error fetching classes:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
});

// Get a single class
router.get('/:id', async (req, res) => {
    try {
        const classInfo = await dataHub.classes.findById(req.params.id);
        
        if (!classInfo) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        res.json(classInfo);
    } catch (error) {
        console.error('❌ Error fetching class:', error);
        res.status(500).json({ error: 'Failed to fetch class' });
    }
});

// Get students in a class
router.get('/:id/students', async (req, res) => {
    try {
        const students = await dataHub.students.findAll({
            classId: parseInt(req.params.id),
            orderBy: 'student_type',
            perPage: 0 // No pagination, get all
        });
        
        res.json(students);
    } catch (error) {
        console.error('❌ Error fetching class students:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Helper function for random colors
function getRandomColor() {
    const colors = [
        '#4285f4', // Google Blue
        '#ea4335', // Google Red
        '#fbbc04', // Google Yellow
        '#34a853', // Google Green
        '#ff6d00', // Orange
        '#46bdc6', // Teal
        '#9c27b0', // Purple
        '#e91e63', // Pink
        '#00bcd4', // Cyan
        '#8bc34a'  // Light Green
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Create a new class
router.post('/', async (req, res) => {
    console.log('🔵 Class POST request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Session user:', req.session?.userId);
    
    try {
        const { name, teacher_id, schedule, color, location } = req.body;
        
        // ONLY validate name
        if (!name || name.trim() === '') {
            console.log('❌ Validation failed: name is empty');
            return res.status(400).json({ 
                error: 'Class name is required',
                hint: 'Give your class a name (e.g., "Beginners Monday 10am")'
            });
        }

        // Validate optional location value
        const validLocations = ['nanakuma', 'torikai'];
        const finalLocation = (location && validLocations.includes(location)) ? location : null;
        
        // Smart defaults
        const finalTeacherId = teacher_id || req.session?.userId || null;
        const finalSchedule = schedule?.trim() || null;  // Use null for consistency
        const finalColor = color || getRandomColor();
        
        console.log('✅ Validation passed, attempting to insert...');
        console.log('Values:', {
            name: name.trim(),
            teacher_id: finalTeacherId,
            schedule: finalSchedule,
            color: finalColor,
            location: finalLocation
        });
        
        const classData = await dataHub.classes.create({
            name: name.trim(),
            teacher_id: finalTeacherId,
            schedule: finalSchedule,
            color: finalColor,
            location: finalLocation,
            active: true
        });
        
        console.log('✅ Class created successfully:', classData);

        // Check for teacher double-booking (non-blocking: returns a warning, not an error).
        const conflict = await findDoubleBooking(finalTeacherId, finalSchedule, null);
        if (conflict) {
            const teacherName = classData.teacher_name || `Teacher #${finalTeacherId}`;
            return res.status(201).json({
                ...classData,
                warning: `Warning: ${teacherName} is already scheduled to teach "${conflict.className}" at ${conflict.schedule}. Please verify the schedule.`
            });
        }

        res.status(201).json(classData);
        
    } catch (error) {
        console.error('❌❌❌ ERROR CREATING CLASS ❌❌❌');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error detail:', error.detail);
        console.error('Error constraint:', error.constraint);
        console.error('Full error:', JSON.stringify(error, null, 2));
        console.error('Stack trace:', error.stack);
        
        // Provide helpful error messages for common database errors
        let errorMessage = 'Failed to create class';
        let hint = 'Check server logs for detailed error information';
        
        if (error.code === '23503') { // Foreign key violation
            errorMessage = 'Invalid teacher selected';
            hint = 'The selected teacher does not exist. Please choose a valid teacher.';
        } else if (error.code === '23505') { // Unique violation
            errorMessage = 'Duplicate class';
            hint = 'A class with this name already exists.';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message,
            code: error.code,
            hint: hint
        });
    }
});

// Update a class
router.put('/:id', async (req, res) => {
    try {
        const { name, teacher_id, schedule, color, active, location } = req.body;
        
        // Validate required field
        if (!name || name.trim() === '') {
            return res.status(400).json({ 
                error: 'Class name is required',
                hint: 'Please enter the class name'
            });
        }

        // Validate optional location value
        const validLocations = ['nanakuma', 'torikai'];
        const finalLocation = (location && validLocations.includes(location)) ? location : null;
        
        const classInfo = await dataHub.classes.update(req.params.id, {
            name: name.trim(),
            teacher_id: teacher_id || null,
            schedule: schedule?.trim() || null,  // Use null for consistency
            color: color || '#4A90E2',
            location: finalLocation,
            active: active !== undefined ? active : true
        });
        
        if (!classInfo) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Check for teacher double-booking (non-blocking: returns a warning, not an error).
        const finalTeacherId = teacher_id || null;
        const finalSchedule  = schedule?.trim() || null;
        const conflict = await findDoubleBooking(finalTeacherId, finalSchedule, req.params.id);
        if (conflict) {
            const teacherName = classInfo.teacher_name || `Teacher #${finalTeacherId}`;
            return res.json({
                ...classInfo,
                warning: `Warning: ${teacherName} is already scheduled to teach "${conflict.className}" at ${conflict.schedule}. Please verify the schedule.`
            });
        }
        
        res.json(classInfo);
    } catch (error) {
        console.error('❌ Error updating class:', error);
        
        // Provide helpful error messages for common database errors
        let errorMessage = 'Failed to update class';
        let hint = 'Check server logs for detailed error information';
        
        if (error.code === '23503') { // Foreign key violation
            errorMessage = 'Invalid teacher selected';
            hint = 'The selected teacher does not exist. Please choose a valid teacher.';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message,
            hint: hint
        });
    }
});

// Delete a class (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        await dataHub.classes.softDelete(req.params.id);
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting class:', error);
        res.status(500).json({ error: 'Failed to delete class' });
    }
});

module.exports = router;
