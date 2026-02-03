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
        const { query, type, startDate, endDate, page = '1', limit = '25' } = req.query;
        
        // Validate type parameter (whitelist)
        const VALID_TYPES = ['students', 'teachers', 'classes', 'attendance', 'reports', 'makeup_lessons'];
        if (type && !VALID_TYPES.includes(type)) {
            return res.status(400).json({ error: 'Invalid type parameter' });
        }
        
        // Validate date formats
        const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
        if (startDate && !DATE_REGEX.test(startDate)) {
            return res.status(400).json({ error: 'Invalid startDate format. Use YYYY-MM-DD' });
        }
        if (endDate && !DATE_REGEX.test(endDate)) {
            return res.status(400).json({ error: 'Invalid endDate format. Use YYYY-MM-DD' });
        }
        
        // Validate that dates are actually valid dates
        if (startDate && isNaN(Date.parse(startDate))) {
            return res.status(400).json({ error: 'Invalid startDate value' });
        }
        if (endDate && isNaN(Date.parse(endDate))) {
            return res.status(400).json({ error: 'Invalid endDate value' });
        }
        
        // Validate and sanitize pagination parameters
        let pageNum = 1;
        let limitNum = 25;
        
        // Validate page parameter
        if (page) {
            const parsedPage = parseInt(page);
            if (!isNaN(parsedPage) && parsedPage > 0) {
                pageNum = parsedPage;
            }
        }
        
        // Validate limit parameter
        if (limit) {
            const parsedLimit = parseInt(limit);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                limitNum = Math.min(100, parsedLimit); // Max 100 records
            }
        }
        
        const offset = (pageNum - 1) * limitNum;
        
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
        
        const counts = {
            students: 0,
            teachers: 0,
            classes: 0,
            attendance: 0,
            reports: 0,
            makeup_lessons: 0
        };
        
        // Search students if type is not specified or is 'students'
        if (!type || type === 'students') {
            let studentQuery = `
                SELECT s.*, c.name as class_name 
                FROM students s 
                LEFT JOIN classes c ON s.class_id = c.id 
                WHERE s.active = true
            `;
            let countQuery = `
                SELECT COUNT(*) as total
                FROM students s 
                LEFT JOIN classes c ON s.class_id = c.id 
                WHERE s.active = true
            `;
            const studentParams = [];
            
            if (hasQuery) {
                const condition = ` AND (LOWER(s.name) LIKE $1 OR LOWER(COALESCE(s.notes, '')) LIKE $1 OR LOWER(COALESCE(c.name, '')) LIKE $1)`;
                studentQuery += condition;
                countQuery += condition;
                studentParams.push(searchPattern);
            }
            
            // Get total count
            const countResult = await pool.query(countQuery, studentParams);
            counts.students = parseInt(countResult.rows[0].total);
            
            // Get paginated results
            studentQuery += ` ORDER BY s.name LIMIT $${studentParams.length + 1} OFFSET $${studentParams.length + 2}`;
            const studentsResult = await pool.query(studentQuery, [...studentParams, limitNum, offset]);
            results.students = studentsResult.rows;
        }
        
        // Search teachers if type is not specified or is 'teachers'
        if (!type || type === 'teachers') {
            let teacherQuery = `
                SELECT id, username, full_name, role, created_at 
                FROM users 
                WHERE role = 'teacher'
            `;
            let countQuery = `
                SELECT COUNT(*) as total
                FROM users 
                WHERE role = 'teacher'
            `;
            const teacherParams = [];
            
            if (hasQuery) {
                const condition = ` AND (LOWER(username) LIKE $1 OR LOWER(full_name) LIKE $1)`;
                teacherQuery += condition;
                countQuery += condition;
                teacherParams.push(searchPattern);
            }
            
            // Get total count
            const countResult = await pool.query(countQuery, teacherParams);
            counts.teachers = parseInt(countResult.rows[0].total);
            
            // Get paginated results
            teacherQuery += ` ORDER BY full_name LIMIT $${teacherParams.length + 1} OFFSET $${teacherParams.length + 2}`;
            const teachersResult = await pool.query(teacherQuery, [...teacherParams, limitNum, offset]);
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
            let countQuery = `
                SELECT COUNT(*) as total
                FROM classes c 
                LEFT JOIN users u ON c.teacher_id = u.id 
                WHERE c.active = true
            `;
            const classParams = [];
            
            if (hasQuery) {
                const condition = ` AND (LOWER(c.name) LIKE $1 OR LOWER(COALESCE(c.schedule, '')) LIKE $1 OR LOWER(COALESCE(u.full_name, '')) LIKE $1)`;
                classQuery += condition;
                countQuery += condition;
                classParams.push(searchPattern);
            }
            
            // Get total count
            const countResult = await pool.query(countQuery, classParams);
            counts.classes = parseInt(countResult.rows[0].total);
            
            // Get paginated results
            classQuery += ` ORDER BY c.name LIMIT $${classParams.length + 1} OFFSET $${classParams.length + 2}`;
            const classesResult = await pool.query(classQuery, [...classParams, limitNum, offset]);
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
            let countQuery = `
                SELECT COUNT(*) as total
                FROM attendance a 
                LEFT JOIN students s ON a.student_id = s.id 
                LEFT JOIN classes c ON a.class_id = c.id 
                WHERE 1=1
            `;
            const attendanceParams = [];
            let paramIndex = 1;
            
            if (hasQuery) {
                const condition = ` AND (LOWER(COALESCE(s.name, '')) LIKE $${paramIndex} OR LOWER(COALESCE(c.name, '')) LIKE $${paramIndex})`;
                attendanceQuery += condition;
                countQuery += condition;
                attendanceParams.push(searchPattern);
                paramIndex++;
            }
            
            if (startDate) {
                const condition = ` AND a.date >= $${paramIndex}`;
                attendanceQuery += condition;
                countQuery += condition;
                attendanceParams.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                const condition = ` AND a.date <= $${paramIndex}`;
                attendanceQuery += condition;
                countQuery += condition;
                attendanceParams.push(endDate);
                paramIndex++;
            }
            
            // Get total count
            const countResult = await pool.query(countQuery, attendanceParams);
            counts.attendance = parseInt(countResult.rows[0].total);
            
            // Get paginated results
            attendanceQuery += ` ORDER BY a.date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            const attendanceResult = await pool.query(attendanceQuery, [...attendanceParams, limitNum, offset]);
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
            let countQuery = `
                SELECT COUNT(*) as total
                FROM lesson_reports lr 
                LEFT JOIN classes c ON lr.class_id = c.id 
                LEFT JOIN users u ON lr.teacher_id = u.id 
                WHERE 1=1
            `;
            const reportsParams = [];
            let paramIndex = 1;
            
            if (hasQuery) {
                const condition = ` AND (LOWER(COALESCE(c.name, '')) LIKE $${paramIndex} OR LOWER(COALESCE(u.full_name, '')) LIKE $${paramIndex} 
                    OR LOWER(COALESCE(lr.target_topic, '')) LIKE $${paramIndex} OR LOWER(COALESCE(lr.vocabulary, '')) LIKE $${paramIndex} 
                    OR LOWER(COALESCE(lr.comments, '')) LIKE $${paramIndex})`;
                reportsQuery += condition;
                countQuery += condition;
                reportsParams.push(searchPattern);
                paramIndex++;
            }
            
            if (startDate) {
                const condition = ` AND lr.date >= $${paramIndex}`;
                reportsQuery += condition;
                countQuery += condition;
                reportsParams.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                const condition = ` AND lr.date <= $${paramIndex}`;
                reportsQuery += condition;
                countQuery += condition;
                reportsParams.push(endDate);
                paramIndex++;
            }
            
            // Get total count
            const countResult = await pool.query(countQuery, reportsParams);
            counts.reports = parseInt(countResult.rows[0].total);
            
            // Get paginated results
            reportsQuery += ` ORDER BY lr.date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            const reportsResult = await pool.query(reportsQuery, [...reportsParams, limitNum, offset]);
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
            let countQuery = `
                SELECT COUNT(*) as total
                FROM makeup_lessons ml 
                LEFT JOIN students s ON ml.student_id = s.id 
                LEFT JOIN classes c ON ml.class_id = c.id 
                WHERE 1=1
            `;
            const makeupParams = [];
            let paramIndex = 1;
            
            if (hasQuery) {
                const condition = ` AND (LOWER(COALESCE(s.name, '')) LIKE $${paramIndex} OR LOWER(COALESCE(c.name, '')) LIKE $${paramIndex} OR LOWER(COALESCE(ml.reason, '')) LIKE $${paramIndex})`;
                makeupQuery += condition;
                countQuery += condition;
                makeupParams.push(searchPattern);
                paramIndex++;
            }
            
            if (startDate) {
                const condition = ` AND ml.scheduled_date >= $${paramIndex}`;
                makeupQuery += condition;
                countQuery += condition;
                makeupParams.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                const condition = ` AND ml.scheduled_date <= $${paramIndex}`;
                makeupQuery += condition;
                countQuery += condition;
                makeupParams.push(endDate);
                paramIndex++;
            }
            
            // Get total count
            const countResult = await pool.query(countQuery, makeupParams);
            counts.makeup_lessons = parseInt(countResult.rows[0].total);
            
            // Get paginated results
            makeupQuery += ` ORDER BY ml.scheduled_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            const makeupResult = await pool.query(makeupQuery, [...makeupParams, limitNum, offset]);
            results.makeup_lessons = makeupResult.rows;
        }
        
        // Calculate total results
        const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
        const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
        const totalPages = Math.ceil(totalCount / limitNum);
        
        res.json({ 
            query,
            type: type || 'all',
            totalResults,
            results,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalCount,
                totalPages: totalPages,
                counts: counts
            }
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;
