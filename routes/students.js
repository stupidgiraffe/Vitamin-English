const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');

// Get all students
router.get('/', async (req, res) => {
    try {
        const { classId } = req.query;
        const students = await dataHub.students.findAll({ 
            classId: classId ? parseInt(classId) : null,
            orderBy: 'student_type',
            perPage: 0 // No pagination, get all
        });
        res.json(students);
    } catch (error) {
        console.error('❌ Error fetching students:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Get a single student
router.get('/:id', async (req, res) => {
    try {
        const student = await dataHub.students.findById(req.params.id);
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json(student);
    } catch (error) {
        console.error('❌ Error fetching student:', error);
        res.status(500).json({ error: 'Failed to fetch student' });
    }
});

// Get student details with attendance and reports
router.get('/:id/details', async (req, res) => {
    try {
        const profile = await dataHub.students.getProfile(req.params.id);
        
        if (!profile) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        // Get teacher comment sheets for the student's class
        const reports = await dataHub.teacherCommentSheets.getRecent(20, profile.class_id);
        
        res.json({
            student: {
                id: profile.id,
                name: profile.name,
                class_id: profile.class_id,
                class_name: profile.class_name,
                class_color: profile.class_color,
                student_type: profile.student_type,
                color_code: profile.color_code,
                email: profile.email,
                phone: profile.phone,
                parent_name: profile.parent_name,
                parent_phone: profile.parent_phone,
                parent_email: profile.parent_email,
                enrollment_date: profile.enrollment_date,
                notes: profile.notes,
                active: profile.active,
                created_at: profile.created_at,
                updated_at: profile.updated_at
            },
            attendance: profile.attendance,
            reports,
            stats: {
                total: profile.stats.total_days,
                present: profile.stats.present_days,
                absent: profile.stats.absent_days,
                partial: profile.stats.tardy_days
            },
            makeupLessons: profile.makeupLessons
        });
    } catch (error) {
        console.error('❌ Error fetching student details:', error);
        res.status(500).json({ error: 'Failed to fetch student details' });
    }
});

// Create a new student
router.post('/', async (req, res) => {
    console.log('🔵 Student POST request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Session user:', req.session?.userId);
    
    try {
        const { name, class_id, student_type, color_code, email, phone, parent_name, parent_phone, parent_email, enrollment_date, notes } = req.body;
        
        // Validate name
        if (!name || name.trim() === '') {
            console.log('❌ Validation failed: name is empty');
            return res.status(400).json({ 
                error: 'Student name is required',
                hint: 'Please enter the student\'s name'
            });
        }
        
        console.log('✅ Validation passed, attempting to insert...');
        
        const student = await dataHub.students.create({
            name: name.trim(),
            class_id: class_id || null,
            student_type: student_type || 'regular',
            color_code: color_code?.trim() || null,
            email: email?.trim() || null,
            phone: phone?.trim() || null,
            parent_name: parent_name?.trim() || null,
            parent_phone: parent_phone?.trim() || null,
            parent_email: parent_email?.trim() || null,
            enrollment_date: enrollment_date?.trim() || null,
            notes: notes?.trim() || null,
            active: true
        });
        
        console.log('✅ Student created successfully:', student);
        res.status(201).json(student);
        
    } catch (error) {
        console.error('❌❌❌ ERROR CREATING STUDENT ❌❌❌');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Full error:', error);
        
        let errorMessage = 'Failed to create student';
        let hint = 'Check server logs for detailed error information';
        
        if (error.code === '23503') {
            errorMessage = 'Invalid class selected';
            hint = 'The selected class does not exist. Please choose a valid class.';
        } else if (error.code === '23505') {
            errorMessage = 'Duplicate student';
            hint = 'A student with this information already exists.';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message,
            code: error.code,
            hint: hint
        });
    }
});

// Update a student
router.put('/:id', async (req, res) => {
    try {
        const { 
            name, class_id, student_type, color_code, notes, active,
            email, phone, parent_name, parent_phone, parent_email, enrollment_date
        } = req.body;
        
        // Validate required field
        if (!name || name.trim() === '') {
            return res.status(400).json({ 
                error: 'Student name is required',
                hint: 'Please enter the student\'s name'
            });
        }
        
        const student = await dataHub.students.update(req.params.id, {
            name: name.trim(),
            class_id: class_id || null,
            student_type: student_type || 'regular',
            color_code: color_code?.trim() || null,
            notes: notes?.trim() || null,
            active: active !== undefined ? active : true,
            email: email?.trim() || null,
            phone: phone?.trim() || null,
            parent_name: parent_name?.trim() || null,
            parent_phone: parent_phone?.trim() || null,
            parent_email: parent_email?.trim() || null,
            enrollment_date: enrollment_date?.trim() || null
        });
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json(student);
    } catch (error) {
        console.error('❌ Error updating student:', error);
        
        let errorMessage = 'Failed to update student';
        let hint = 'Check server logs for detailed error information';
        
        if (error.code === '23503') {
            errorMessage = 'Invalid class selected';
            hint = 'The selected class does not exist. Please choose a valid class.';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message,
            hint: hint
        });
    }
});

// Delete a student (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        await dataHub.students.softDelete(req.params.id);
        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting student:', error);
        res.status(500).json({ error: 'Failed to delete student' });
    }
});

module.exports = router;
