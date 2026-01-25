const express = require('express');
const router = express.Router();
const pool = require('../database/init');

// Get data from a specific table
router.get('/table/:tableName', async (req, res) => {
    const { tableName } = req.params;
    
    // Whitelist allowed tables
    const allowedTables = ['students', 'classes', 'attendance', 'lesson_reports', 'users', 'makeup_lessons'];
    
    if (!allowedTables.includes(tableName)) {
        return res.status(400).json({ error: 'Invalid table name' });
    }
    
    try {
        let query = '';
        
        switch(tableName) {
            case 'students':
                query = `
                    SELECT s.*, c.name as class_name 
                    FROM students s 
                    LEFT JOIN classes c ON s.class_id = c.id 
                    WHERE s.active = true
                    ORDER BY s.name
                `;
                break;
            case 'classes':
                query = `
                    SELECT c.*, u.full_name as teacher_name 
                    FROM classes c 
                    LEFT JOIN users u ON c.teacher_id = u.id 
                    WHERE c.active = true
                    ORDER BY c.name
                `;
                break;
            case 'attendance':
                query = `
                    SELECT a.*, s.name as student_name, c.name as class_name 
                    FROM attendance a 
                    LEFT JOIN students s ON a.student_id = s.id 
                    LEFT JOIN classes c ON a.class_id = c.id 
                    ORDER BY a.date DESC, s.name 
                    LIMIT 500
                `;
                break;
            case 'lesson_reports':
                query = `
                    SELECT lr.*, c.name as class_name, u.full_name as teacher_name 
                    FROM lesson_reports lr 
                    LEFT JOIN classes c ON lr.class_id = c.id 
                    LEFT JOIN users u ON lr.teacher_id = u.id 
                    ORDER BY lr.date DESC 
                    LIMIT 100
                `;
                break;
            case 'users':
                query = `
                    SELECT id, username, full_name, role, created_at 
                    FROM users 
                    ORDER BY full_name
                `;
                break;
            case 'makeup_lessons':
                query = `
                    SELECT ml.*, s.name as student_name, c.name as class_name 
                    FROM makeup_lessons ml 
                    LEFT JOIN students s ON ml.student_id = s.id 
                    LEFT JOIN classes c ON ml.class_id = c.id 
                    ORDER BY ml.scheduled_date DESC
                `;
                break;
        }
        
        const result = await pool.query(query);
        const data = result.rows;
        res.json({ table: tableName, data });
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Failed to query database' });
    }
});

// Advanced search across all records
router.get('/search', async (req, res) => {
    try {
        const { query, type, startDate, endDate } = req.query;
        
        // Query parameter is now optional - can search by type and/or date only
        const hasQuery = query && query.trim() !== '';
        const searchPattern = hasQuery ? `%${query.toLowerCase()}%` : null;
        
        const results = {
            students: [],
            teachers: [],
            classes: [],
            attendance: [],
            reports: [],
            makeup_lessons: []
        };
        
        // Search students if type is not specified or is 'students'
        if (!type || type === 'students') {
            let studentQuery = `
                SELECT s.*, c.name as class_name 
                FROM students s 
                LEFT JOIN classes c ON s.class_id = c.id 
                WHERE s.active = true
            `;
            const studentParams = [];
            
            if (hasQuery) {
                studentQuery += ` AND (LOWER(s.name) LIKE $1 OR LOWER(s.notes) LIKE $1 OR LOWER(c.name) LIKE $1)`;
                studentParams.push(searchPattern);
            }
            
            studentQuery += ' ORDER BY s.name LIMIT 50';
            const studentsResult = await pool.query(studentQuery, studentParams);
            results.students = studentsResult.rows;
        }
        
        // Search teachers if type is not specified or is 'teachers'
        if (!type || type === 'teachers') {
            let teacherQuery = `
                SELECT id, username, full_name, role, created_at 
                FROM users 
                WHERE role = 'teacher'
            `;
            const teacherParams = [];
            
            if (hasQuery) {
                teacherQuery += ` AND (LOWER(username) LIKE $1 OR LOWER(full_name) LIKE $1)`;
                teacherParams.push(searchPattern);
            }
            
            teacherQuery += ' ORDER BY full_name LIMIT 50';
            const teachersResult = await pool.query(teacherQuery, teacherParams);
            results.teachers = teachersResult.rows;
        }
        
        // Search classes if type is not specified or is 'classes'
        if (!type || type === 'classes') {
            let classQuery = `
                SELECT c.*, u.full_name as teacher_name 
                FROM classes c 
                LEFT JOIN users u ON c.teacher_id = u.id 
                WHERE c.active = true
            `;
            const classParams = [];
            
            if (hasQuery) {
                classQuery += ` AND (LOWER(c.name) LIKE $1 OR LOWER(c.schedule) LIKE $1 OR LOWER(u.full_name) LIKE $1)`;
                classParams.push(searchPattern);
            }
            
            classQuery += ' ORDER BY c.name LIMIT 50';
            const classesResult = await pool.query(classQuery, classParams);
            results.classes = classesResult.rows;
        }
        
        // Search attendance records with date filtering
        if (!type || type === 'attendance') {
            let attendanceQuery = `
                SELECT a.*, s.name as student_name, c.name as class_name 
                FROM attendance a 
                LEFT JOIN students s ON a.student_id = s.id 
                LEFT JOIN classes c ON a.class_id = c.id 
                WHERE 1=1
            `;
            const attendanceParams = [];
            let paramIndex = 1;
            
            if (hasQuery) {
                attendanceQuery += ` AND (LOWER(s.name) LIKE $${paramIndex} OR LOWER(c.name) LIKE $${paramIndex})`;
                attendanceParams.push(searchPattern);
                paramIndex++;
            }
            
            if (startDate) {
                attendanceQuery += ` AND a.date >= $${paramIndex}`;
                attendanceParams.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                attendanceQuery += ` AND a.date <= $${paramIndex}`;
                attendanceParams.push(endDate);
                paramIndex++;
            }
            
            attendanceQuery += ' ORDER BY a.date DESC LIMIT 100';
            const attendanceResult = await pool.query(attendanceQuery, attendanceParams);
            results.attendance = attendanceResult.rows;
        }
        
        // Search lesson reports with date filtering
        if (!type || type === 'reports') {
            let reportsQuery = `
                SELECT lr.*, c.name as class_name, u.full_name as teacher_name 
                FROM lesson_reports lr 
                LEFT JOIN classes c ON lr.class_id = c.id 
                LEFT JOIN users u ON lr.teacher_id = u.id 
                WHERE 1=1
            `;
            const reportsParams = [];
            let paramIndex = 1;
            
            if (hasQuery) {
                reportsQuery += ` AND (LOWER(c.name) LIKE $${paramIndex} OR LOWER(u.full_name) LIKE $${paramIndex} 
                    OR LOWER(lr.target_topic) LIKE $${paramIndex} OR LOWER(lr.vocabulary) LIKE $${paramIndex} 
                    OR LOWER(lr.comments) LIKE $${paramIndex})`;
                reportsParams.push(searchPattern);
                paramIndex++;
            }
            
            if (startDate) {
                reportsQuery += ` AND lr.date >= $${paramIndex}`;
                reportsParams.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                reportsQuery += ` AND lr.date <= $${paramIndex}`;
                reportsParams.push(endDate);
                paramIndex++;
            }
            
            reportsQuery += ' ORDER BY lr.date DESC LIMIT 50';
            const reportsResult = await pool.query(reportsQuery, reportsParams);
            results.reports = reportsResult.rows;
        }
        
        // Search makeup lessons
        if (!type || type === 'makeup_lessons') {
            let makeupQuery = `
                SELECT ml.*, s.name as student_name, c.name as class_name 
                FROM makeup_lessons ml 
                LEFT JOIN students s ON ml.student_id = s.id 
                LEFT JOIN classes c ON ml.class_id = c.id 
                WHERE 1=1
            `;
            const makeupParams = [];
            let paramIndex = 1;
            
            if (hasQuery) {
                makeupQuery += ` AND (LOWER(s.name) LIKE $${paramIndex} OR LOWER(c.name) LIKE $${paramIndex} OR LOWER(ml.reason) LIKE $${paramIndex})`;
                makeupParams.push(searchPattern);
                paramIndex++;
            }
            
            if (startDate) {
                makeupQuery += ` AND ml.scheduled_date >= $${paramIndex}`;
                makeupParams.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                makeupQuery += ` AND ml.scheduled_date <= $${paramIndex}`;
                makeupParams.push(endDate);
                paramIndex++;
            }
            
            makeupQuery += ' ORDER BY ml.scheduled_date DESC LIMIT 50';
            const makeupResult = await pool.query(makeupQuery, makeupParams);
            results.makeup_lessons = makeupResult.rows;
        }
        
        // Calculate total results
        const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
        
        res.json({ 
            query,
            type: type || 'all',
            totalResults,
            results 
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;
