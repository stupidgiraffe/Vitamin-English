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
        
        if (!query || query.trim() === '') {
            return res.status(400).json({ error: 'Search query is required' });
        }
        
        const searchPattern = `%${query.toLowerCase()}%`;
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
            const studentsResult = await pool.query(`
                SELECT s.*, c.name as class_name 
                FROM students s 
                LEFT JOIN classes c ON s.class_id = c.id 
                WHERE s.active = true 
                AND (LOWER(s.name) LIKE $1 OR LOWER(s.notes) LIKE $1 OR LOWER(c.name) LIKE $1)
                ORDER BY s.name
                LIMIT 50
            `, [searchPattern]);
            results.students = studentsResult.rows;
        }
        
        // Search teachers if type is not specified or is 'teachers'
        if (!type || type === 'teachers') {
            const teachersResult = await pool.query(`
                SELECT id, username, full_name, role, created_at 
                FROM users 
                WHERE role = 'teacher' 
                AND (LOWER(username) LIKE $1 OR LOWER(full_name) LIKE $1)
                ORDER BY full_name
                LIMIT 50
            `, [searchPattern]);
            results.teachers = teachersResult.rows;
        }
        
        // Search classes if type is not specified or is 'classes'
        if (!type || type === 'classes') {
            const classesResult = await pool.query(`
                SELECT c.*, u.full_name as teacher_name 
                FROM classes c 
                LEFT JOIN users u ON c.teacher_id = u.id 
                WHERE c.active = true 
                AND (LOWER(c.name) LIKE $1 OR LOWER(c.schedule) LIKE $1 OR LOWER(u.full_name) LIKE $1)
                ORDER BY c.name
                LIMIT 50
            `, [searchPattern]);
            results.classes = classesResult.rows;
        }
        
        // Search attendance records with date filtering
        if (!type || type === 'attendance') {
            let attendanceQuery = `
                SELECT a.*, s.name as student_name, c.name as class_name 
                FROM attendance a 
                LEFT JOIN students s ON a.student_id = s.id 
                LEFT JOIN classes c ON a.class_id = c.id 
                WHERE (LOWER(s.name) LIKE $1 OR LOWER(c.name) LIKE $1)
            `;
            const attendanceParams = [searchPattern];
            let paramIndex = 2;
            
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
                WHERE (LOWER(c.name) LIKE $1 OR LOWER(u.full_name) LIKE $1 
                    OR LOWER(lr.target_topic) LIKE $1 OR LOWER(lr.vocabulary) LIKE $1 
                    OR LOWER(lr.comments) LIKE $1)
            `;
            const reportsParams = [searchPattern];
            let paramIndex = 2;
            
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
                WHERE (LOWER(s.name) LIKE $1 OR LOWER(c.name) LIKE $1 OR LOWER(ml.reason) LIKE $1)
            `;
            const makeupParams = [searchPattern];
            let paramIndex = 2;
            
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
