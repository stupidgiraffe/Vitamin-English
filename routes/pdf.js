const express = require('express');
const router = express.Router();
const pool = require('../database/init');
const { generateStudentAttendancePDF, generateClassAttendancePDF, generateAttendanceGridPDF, generateLessonReportPDF } = require('../utils/pdfGenerator');
const { uploadPDF, getDownloadUrl, listPDFs, isConfigured } = require('../utils/r2Storage');

// Middleware to check if R2 is configured
const checkR2Config = (req, res, next) => {
    if (!isConfigured()) {
        return res.status(503).json({ 
            error: 'PDF storage not configured',
            message: 'Cloudflare R2 credentials are not set. Please configure R2_* environment variables.'
        });
    }
    next();
};

// Generate student attendance PDF
router.post('/student-attendance/:studentId', checkR2Config, async (req, res) => {
    try {
        const studentId = parseInt(req.params.studentId);
        
        // Fetch student data
        const studentResult = await pool.query(`
            SELECT s.*, c.name as class_name
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.id = $1
        `, [studentId]);
        
        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        const student = studentResult.rows[0];
        
        // Fetch attendance records
        const attendanceResult = await pool.query(`
            SELECT a.*, c.name as class_name
            FROM attendance a
            LEFT JOIN classes c ON a.class_id = c.id
            WHERE a.student_id = $1
            ORDER BY a.date DESC
        `, [studentId]);
        
        const attendanceRecords = attendanceResult.rows;
        
        // Generate PDF
        const pdfBuffer = await generateStudentAttendancePDF(student, attendanceRecords);
        
        // Upload to R2 - sanitize filename
        const sanitizedName = student.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `student_attendance_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            type: 'student_attendance',
            studentId: studentId.toString(),
            studentName: student.name
        });
        
        // Save to pdf_history table
        const historyResult = await pool.query(`
            INSERT INTO pdf_history (filename, type, student_id, r2_key, r2_url, file_size, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            fileName,
            'student_attendance',
            studentId,
            uploadResult.key,
            uploadResult.url,
            uploadResult.size,
            req.session.userId
        ]);
        
        const pdfId = historyResult.rows[0].id;
        
        // Generate signed download URL
        const downloadUrl = await getDownloadUrl(uploadResult.key);
        
        res.json({
            success: true,
            pdfId,
            fileName,
            downloadUrl,
            size: uploadResult.size,
            message: 'Student attendance PDF generated successfully'
        });
        
    } catch (error) {
        console.error('Error generating student attendance PDF:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

// Generate class attendance PDF
router.post('/class-attendance/:classId', checkR2Config, async (req, res) => {
    try {
        const classId = parseInt(req.params.classId);
        const { date } = req.body;
        
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        
        // Fetch class data
        const classResult = await pool.query(`
            SELECT c.*, u.full_name as teacher_name
            FROM classes c
            LEFT JOIN users u ON c.teacher_id = u.id
            WHERE c.id = $1
        `, [classId]);
        
        if (classResult.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        const classData = classResult.rows[0];
        
        // Fetch students in class
        const studentsResult = await pool.query(`
            SELECT * FROM students
            WHERE class_id = $1 AND active = true
            ORDER BY student_type, name
        `, [classId]);
        
        const students = studentsResult.rows;
        
        // Fetch attendance records for the date
        const attendanceResult = await pool.query(`
            SELECT * FROM attendance
            WHERE class_id = $1 AND date = $2
        `, [classId, date]);
        
        const attendanceRecords = attendanceResult.rows;
        
        // Generate PDF
        const pdfBuffer = await generateClassAttendancePDF(classData, students, attendanceRecords, date);
        
        // Upload to R2 - sanitize filename
        const sanitizedClassName = classData.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `class_attendance_${sanitizedClassName}_${date}.pdf`;
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            type: 'class_attendance',
            classId: classId.toString(),
            className: classData.name,
            date: date
        });
        
        // Save to pdf_history table
        const historyResult = await pool.query(`
            INSERT INTO pdf_history (filename, type, class_id, r2_key, r2_url, file_size, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            fileName,
            'class_attendance',
            classId,
            uploadResult.key,
            uploadResult.url,
            uploadResult.size,
            req.session.userId
        ]);
        
        const pdfId = historyResult.rows[0].id;
        
        // Generate signed download URL
        const downloadUrl = await getDownloadUrl(uploadResult.key);
        
        res.json({
            success: true,
            pdfId,
            fileName,
            downloadUrl,
            size: uploadResult.size,
            message: 'Class attendance PDF generated successfully'
        });
        
    } catch (error) {
        console.error('Error generating class attendance PDF:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

// Generate attendance grid PDF (multi-date view)
router.post('/attendance-grid/:classId', checkR2Config, async (req, res) => {
    try {
        const classId = parseInt(req.params.classId);
        const { startDate, endDate } = req.body;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
        
        // Validate date range
        if (startDate > endDate) {
            return res.status(400).json({ error: 'Start date must be before or equal to end date' });
        }
        
        // Check max date range (90 days to prevent performance issues)
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date values' });
        }
        
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (daysDiff > 90) {
            return res.status(400).json({ error: 'Date range cannot exceed 90 days' });
        }
        
        // Fetch class data
        const classResult = await pool.query(`
            SELECT c.*, u.full_name as teacher_name
            FROM classes c
            LEFT JOIN users u ON c.teacher_id = u.id
            WHERE c.id = $1
        `, [classId]);
        
        if (classResult.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        const classData = classResult.rows[0];
        
        // Fetch students in class
        const studentsResult = await pool.query(`
            SELECT * FROM students
            WHERE class_id = $1 AND active = true
            ORDER BY student_type, name
        `, [classId]);
        
        const students = studentsResult.rows;
        
        // Generate date range
        const dates = [];
        const current = new Date(start);
        
        while (current <= end) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            dates.push(`${year}-${month}-${day}`);
            current.setDate(current.getDate() + 1);
        }
        
        // Fetch attendance records for the date range
        const attendanceResult = await pool.query(`
            SELECT student_id, date, status 
            FROM attendance
            WHERE class_id = $1 AND date >= $2 AND date <= $3
        `, [classId, startDate, endDate]);
        
        // Create attendance map
        const attendanceMap = {};
        attendanceResult.rows.forEach(record => {
            const key = `${record.student_id}-${record.date}`;
            attendanceMap[key] = record.status;
        });
        
        // Generate PDF
        const pdfBuffer = await generateAttendanceGridPDF(
            classData, 
            students, 
            dates, 
            attendanceMap, 
            startDate, 
            endDate
        );
        
        // Upload to R2 - sanitize filename (only alphanumeric characters)
        const sanitizedClassName = classData.name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `attendance_grid_${sanitizedClassName}_${startDate}_to_${endDate}.pdf`;
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            type: 'attendance_grid',
            classId: classId.toString(),
            className: classData.name,
            startDate: startDate,
            endDate: endDate
        });
        
        // Save to pdf_history table
        const historyResult = await pool.query(`
            INSERT INTO pdf_history (filename, type, class_id, r2_key, r2_url, file_size, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            fileName,
            'attendance_grid',
            classId,
            uploadResult.key,
            uploadResult.url,
            uploadResult.size,
            req.session.userId
        ]);
        
        const pdfId = historyResult.rows[0].id;
        
        // Generate signed download URL
        const downloadUrl = await getDownloadUrl(uploadResult.key);
        
        res.json({
            success: true,
            pdfId,
            fileName,
            downloadUrl,
            size: uploadResult.size,
            message: 'Attendance grid PDF generated successfully'
        });
        
    } catch (error) {
        console.error('Error generating attendance grid PDF:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

// Generate lesson report PDF
router.post('/lesson-report/:reportId', checkR2Config, async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        
        // Fetch report data
        const reportResult = await pool.query(`
            SELECT lr.*, c.name as class_name, u.full_name as teacher_name
            FROM lesson_reports lr
            LEFT JOIN classes c ON lr.class_id = c.id
            LEFT JOIN users u ON lr.teacher_id = u.id
            WHERE lr.id = $1
        `, [reportId]);
        
        if (reportResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lesson report not found' });
        }
        
        const report = reportResult.rows[0];
        
        // Get class data
        const classResult = await pool.query(`
            SELECT * FROM classes WHERE id = $1
        `, [report.class_id]);
        
        const classData = classResult.rows[0];
        
        // Generate PDF
        const pdfBuffer = await generateLessonReportPDF(report, classData);
        
        // Upload to R2 - sanitize filename
        const sanitizedClassName = report.class_name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `lesson_report_${sanitizedClassName}_${report.date}.pdf`;
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            type: 'lesson_report',
            reportId: reportId.toString(),
            className: report.class_name,
            date: report.date
        });
        
        // Save to pdf_history table
        const historyResult = await pool.query(`
            INSERT INTO pdf_history (filename, type, report_id, class_id, r2_key, r2_url, file_size, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [
            fileName,
            'lesson_report',
            reportId,
            report.class_id,
            uploadResult.key,
            uploadResult.url,
            uploadResult.size,
            req.session.userId
        ]);
        
        const pdfId = historyResult.rows[0].id;
        
        // Generate signed download URL
        const downloadUrl = await getDownloadUrl(uploadResult.key);
        
        res.json({
            success: true,
            pdfId,
            fileName,
            downloadUrl,
            size: uploadResult.size,
            message: 'Lesson report PDF generated successfully'
        });
        
    } catch (error) {
        console.error('Error generating lesson report PDF:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

// Get PDF history
router.get('/history', async (req, res) => {
    try {
        const { type, limit = 50 } = req.query;
        
        let query = `
            SELECT ph.*, 
                   s.name as student_name,
                   c.name as class_name,
                   u.full_name as created_by_name
            FROM pdf_history ph
            LEFT JOIN students s ON ph.student_id = s.id
            LEFT JOIN classes c ON ph.class_id = c.id
            LEFT JOIN users u ON ph.created_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (type) {
            query += ` AND ph.type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }
        
        query += ` ORDER BY ph.created_at DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit));
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            pdfs: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching PDF history:', error);
        res.status(500).json({ 
            error: 'Failed to fetch PDF history',
            message: error.message
        });
    }
});

// Get download URL for a PDF
router.get('/download/:pdfId', async (req, res) => {
    try {
        const pdfId = parseInt(req.params.pdfId);
        
        // Fetch PDF record
        const result = await pool.query(`
            SELECT * FROM pdf_history WHERE id = $1
        `, [pdfId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'PDF not found' });
        }
        
        const pdf = result.rows[0];
        
        // Generate signed download URL (valid for 1 hour)
        const downloadUrl = await getDownloadUrl(pdf.r2_key, 3600);
        
        res.json({
            success: true,
            downloadUrl,
            fileName: pdf.filename,
            type: pdf.type,
            createdAt: pdf.created_at
        });
        
    } catch (error) {
        console.error('Error getting download URL:', error);
        res.status(500).json({ 
            error: 'Failed to get download URL',
            message: error.message
        });
    }
});

module.exports = router;
