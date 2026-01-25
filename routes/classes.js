const express = require('express');
const router = express.Router();
const pool = require('../database/init');

// Get all classes
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, u.full_name as teacher_name 
            FROM classes c 
            LEFT JOIN users u ON c.teacher_id = u.id 
            WHERE c.active = true
            ORDER BY c.name
        `);
        const classes = result.rows;
        
        res.json(classes);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
});

// Get a single class
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, u.full_name as teacher_name 
            FROM classes c 
            LEFT JOIN users u ON c.teacher_id = u.id 
            WHERE c.id = $1
        `, [req.params.id]);
        const classInfo = result.rows[0];
        
        if (!classInfo) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        res.json(classInfo);
    } catch (error) {
        console.error('Error fetching class:', error);
        res.status(500).json({ error: 'Failed to fetch class' });
    }
});

// Get students in a class
router.get('/:id/students', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM students 
            WHERE class_id = $1 AND active = true
            ORDER BY student_type, name
        `, [req.params.id]);
        const students = result.rows;
        
        res.json(students);
    } catch (error) {
        console.error('Error fetching class students:', error);
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
    try {
        const { name, teacher_id, schedule, color } = req.body;
        
        // Only validate name
        if (!name || !name.trim()) {
            return res.status(400).json({ 
                error: 'Class name is required',
                hint: 'Give your class a name (e.g., "Beginners Monday 10am")'
            });
        }
        
        // Smart defaults
        const finalTeacherId = teacher_id || req.session?.userId || null; // Default to current user
        const finalSchedule = schedule || ''; // Empty schedule ok
        const finalColor = color || getRandomColor(); // Auto-assign if not provided
        
        const result = await pool.query(`
            INSERT INTO classes (name, teacher_id, schedule, color) 
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [name.trim(), finalTeacherId, finalSchedule, finalColor]);
        
        const classResult = await pool.query('SELECT * FROM classes WHERE id = $1', [result.rows[0].id]);
        const classInfo = classResult.rows[0];
        res.status(201).json(classInfo);
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).json({ 
            error: 'Could not create class',
            hint: 'Please try again or contact support'
        });
    }
});

// Update a class
router.put('/:id', async (req, res) => {
    try {
        const { name, teacher_id, schedule, color, active } = req.body;
        
        await pool.query(`
            UPDATE classes 
            SET name = $1, teacher_id = $2, schedule = $3, color = $4, active = $5
            WHERE id = $6
        `, [
            name, 
            teacher_id || null, 
            schedule || '', 
            color || '#4A90E2',
            active !== undefined ? active : true,
            req.params.id
        ]);
        
        const result = await pool.query('SELECT * FROM classes WHERE id = $1', [req.params.id]);
        const classInfo = result.rows[0];
        res.json(classInfo);
    } catch (error) {
        console.error('Error updating class:', error);
        res.status(500).json({ error: 'Failed to update class' });
    }
});

// Delete a class (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('UPDATE classes SET active = false WHERE id = $1', [req.params.id]);
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error('Error deleting class:', error);
        res.status(500).json({ error: 'Failed to delete class' });
    }
});

module.exports = router;
