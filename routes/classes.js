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
    console.log('🔵 Class POST request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Session user:', req.session?.userId);
    
    try {
        const { name, teacher_id, schedule, color } = req.body;
        
        // ONLY validate name
        if (!name || name.trim() === '') {
            console.log('❌ Validation failed: name is empty');
            return res.status(400).json({ 
                error: 'Class name is required',
                hint: 'Give your class a name (e.g., "Beginners Monday 10am")'
            });
        }
        
        // Smart defaults
        const finalTeacherId = teacher_id || req.session?.userId || null;
        const finalSchedule = schedule?.trim() || null;  // Use null for consistency
        const finalColor = color || getRandomColor();
        
        console.log('✅ Validation passed, attempting to insert...');
        console.log('Values:', {
            name: name.trim(),
            teacher_id: finalTeacherId,
            schedule: finalSchedule,
            color: finalColor
        });
        
        const result = await pool.query(
            `INSERT INTO classes (name, teacher_id, schedule, color, active) 
             VALUES ($1, $2, $3, $4, true) 
             RETURNING *`,
            [name.trim(), finalTeacherId, finalSchedule, finalColor]
        );
        
        console.log('✅ Class created successfully:', result.rows[0]);
        res.status(201).json(result.rows[0]);
        
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
        const { name, teacher_id, schedule, color, active } = req.body;
        
        // Validate required field
        if (!name || name.trim() === '') {
            return res.status(400).json({ 
                error: 'Class name is required',
                hint: 'Please enter the class name'
            });
        }
        
        await pool.query(`
            UPDATE classes 
            SET name = $1, teacher_id = $2, schedule = $3, color = $4, active = $5
            WHERE id = $6
        `, [
            name.trim(), 
            teacher_id || null, 
            schedule?.trim() || null,  // Use null for consistency
            color || '#4A90E2',
            active !== undefined ? active : true,
            req.params.id
        ]);
        
        const result = await pool.query('SELECT * FROM classes WHERE id = $1', [req.params.id]);
        const classInfo = result.rows[0];
        
        if (!classInfo) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        res.json(classInfo);
    } catch (error) {
        console.error('Error updating class:', error);
        
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
        await pool.query('UPDATE classes SET active = false WHERE id = $1', [req.params.id]);
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error('Error deleting class:', error);
        res.status(500).json({ error: 'Failed to delete class' });
    }
});

module.exports = router;
