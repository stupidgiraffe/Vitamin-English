const express = require('express');
const router = express.Router();
const pool = require('../database/init');
const { generateMonthlyReportPDF } = require('../utils/pdfGenerator');
const { uploadPDF, getDownloadUrl, isConfigured } = require('../utils/r2Storage');

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

/**
 * Get list of monthly reports for a class
 */
router.get('/class/:classId', async (req, res) => {
    try {
        const classId = parseInt(req.params.classId);
        
        if (isNaN(classId)) {
            return res.status(400).json({ error: 'Invalid class ID' });
        }
        
        const result = await pool.query(`
            SELECT mr.*, c.name as class_name, u.full_name as generated_by_name
            FROM monthly_reports mr
            JOIN classes c ON mr.class_id = c.id
            LEFT JOIN users u ON mr.generated_by = u.id
            WHERE mr.class_id = $1
            ORDER BY mr.year DESC, mr.month DESC
        `, [classId]);
        
        res.json({
            success: true,
            reports: result.rows
        });
    } catch (error) {
        console.error('Error fetching monthly reports:', error);
        res.status(500).json({ error: 'Failed to fetch monthly reports' });
    }
});

/**
 * Get a specific monthly report
 */
router.get('/:id', async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        
        if (isNaN(reportId)) {
            return res.status(400).json({ error: 'Invalid report ID' });
        }
        
        const result = await pool.query(`
            SELECT mr.*, c.name as class_name, u.full_name as generated_by_name
            FROM monthly_reports mr
            JOIN classes c ON mr.class_id = c.id
            LEFT JOIN users u ON mr.generated_by = u.id
            WHERE mr.id = $1
        `, [reportId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Monthly report not found' });
        }
        
        res.json({
            success: true,
            report: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching monthly report:', error);
        res.status(500).json({ error: 'Failed to fetch monthly report' });
    }
});

/**
 * Get available months for a class (months that have lesson reports)
 */
router.get('/available-months/:classId', async (req, res) => {
    try {
        const classId = parseInt(req.params.classId);
        
        if (isNaN(classId)) {
            return res.status(400).json({ error: 'Invalid class ID' });
        }
        
        // Get all unique year/month combinations from lesson reports
        const result = await pool.query(`
            SELECT DISTINCT 
                EXTRACT(YEAR FROM date::date)::INTEGER as year,
                EXTRACT(MONTH FROM date::date)::INTEGER as month
            FROM lesson_reports
            WHERE class_id = $1
            ORDER BY year DESC, month DESC
        `, [classId]);
        
        res.json({
            success: true,
            months: result.rows
        });
    } catch (error) {
        console.error('Error fetching available months:', error);
        res.status(500).json({ error: 'Failed to fetch available months' });
    }
});

/**
 * Generate monthly report data for a class
 */
router.post('/generate', async (req, res) => {
    try {
        const { classId, year, month } = req.body;
        
        // Validate inputs
        if (!classId || !year || !month) {
            return res.status(400).json({ error: 'classId, year, and month are required' });
        }
        
        const parsedClassId = parseInt(classId);
        const parsedYear = parseInt(year);
        const parsedMonth = parseInt(month);
        
        if (isNaN(parsedClassId) || isNaN(parsedYear) || isNaN(parsedMonth)) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }
        
        if (parsedMonth < 1 || parsedMonth > 12) {
            return res.status(400).json({ error: 'Month must be between 1 and 12' });
        }
        
        // Calculate date range for the month
        const startDate = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();
        const endDate = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${lastDay}`;
        
        // Fetch class data
        const classResult = await pool.query(`
            SELECT c.*, u.full_name as teacher_name
            FROM classes c
            LEFT JOIN users u ON c.teacher_id = u.id
            WHERE c.id = $1
        `, [parsedClassId]);
        
        if (classResult.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        const classData = classResult.rows[0];
        
        // Fetch students in class
        const studentsResult = await pool.query(`
            SELECT id, name, student_type, color_code, email, phone
            FROM students
            WHERE class_id = $1 AND active = true
            ORDER BY student_type, name
        `, [parsedClassId]);
        
        const students = studentsResult.rows;
        
        // Fetch lesson reports for the month
        const reportsResult = await pool.query(`
            SELECT lr.*, u.full_name as teacher_name
            FROM lesson_reports lr
            LEFT JOIN users u ON lr.teacher_id = u.id
            WHERE lr.class_id = $1 AND lr.date >= $2 AND lr.date <= $3
            ORDER BY lr.date ASC
        `, [parsedClassId, startDate, endDate]);
        
        const lessonReports = reportsResult.rows;
        
        // Fetch attendance records for the month
        const attendanceResult = await pool.query(`
            SELECT a.student_id, a.date, a.status, a.time, a.notes
            FROM attendance a
            WHERE a.class_id = $1 AND a.date >= $2 AND a.date <= $3
            ORDER BY a.date ASC
        `, [parsedClassId, startDate, endDate]);
        
        const attendanceRecords = attendanceResult.rows;
        
        // Process and aggregate data
        const reportData = {
            classInfo: {
                id: classData.id,
                name: classData.name,
                teacherName: classData.teacher_name,
                schedule: classData.schedule
            },
            period: {
                year: parsedYear,
                month: parsedMonth,
                monthName: new Date(parsedYear, parsedMonth - 1).toLocaleString('en-US', { month: 'long' }),
                startDate,
                endDate
            },
            students: students.map(s => ({
                id: s.id,
                name: s.name,
                type: s.student_type,
                email: s.email,
                phone: s.phone
            })),
            lessonSummary: {
                totalLessons: lessonReports.length,
                lessons: lessonReports.map(lr => ({
                    id: lr.id,
                    date: lr.date,
                    teacherName: lr.teacher_name,
                    targetTopic: lr.target_topic,
                    vocabulary: lr.vocabulary,
                    mistakes: lr.mistakes,
                    strengths: lr.strengths,
                    comments: lr.comments
                })),
                // Aggregate all topics covered
                topicsCovered: [...new Set(lessonReports.map(lr => lr.target_topic).filter(Boolean))],
                // Aggregate vocabulary (deduplicated by splitting and rejoining)
                allVocabulary: [...new Set(
                    lessonReports
                        .map(lr => lr.vocabulary)
                        .filter(Boolean)
                        .flatMap(v => v.split('\n').map(s => s.trim()))
                        .filter(Boolean)
                )].join('\n'),
                // Aggregate common mistakes (deduplicated by splitting and rejoining)
                commonMistakes: [...new Set(
                    lessonReports
                        .map(lr => lr.mistakes)
                        .filter(Boolean)
                        .flatMap(m => m.split('\n').map(s => s.trim()))
                        .filter(Boolean)
                )].join('\n'),
                // Aggregate strengths (deduplicated by splitting and rejoining)
                overallStrengths: [...new Set(
                    lessonReports
                        .map(lr => lr.strengths)
                        .filter(Boolean)
                        .flatMap(s => s.split('\n').map(str => str.trim()))
                        .filter(Boolean)
                )].join('\n'),
                // Aggregate comments/homework
                teacherComments: lessonReports.map(lr => ({
                    date: lr.date,
                    comment: lr.comments
                })).filter(c => c.comment)
            },
            attendanceSummary: {
                totalDays: [...new Set(attendanceRecords.map(a => a.date))].length,
                records: {}
            }
        };
        
        // Calculate per-student attendance summary
        students.forEach(student => {
            const studentAttendance = attendanceRecords.filter(a => a.student_id === student.id);
            const present = studentAttendance.filter(a => a.status === 'O').length;
            const absent = studentAttendance.filter(a => a.status === 'X').length;
            const late = studentAttendance.filter(a => a.status === '/').length;
            const total = studentAttendance.length;
            
            reportData.attendanceSummary.records[student.id] = {
                studentName: student.name,
                present,
                absent,
                late,
                total,
                rate: total > 0 ? Math.round((present / total) * 100) : 0
            };
        });
        
        // Save or update the monthly report
        const existingResult = await pool.query(`
            SELECT id FROM monthly_reports
            WHERE class_id = $1 AND year = $2 AND month = $3
        `, [parsedClassId, parsedYear, parsedMonth]);
        
        let reportId;
        
        if (existingResult.rows.length > 0) {
            // Update existing report
            await pool.query(`
                UPDATE monthly_reports
                SET report_data = $1, generated_by = $2, updated_at = CURRENT_TIMESTAMP
                WHERE class_id = $3 AND year = $4 AND month = $5
                RETURNING id
            `, [JSON.stringify(reportData), req.session.userId, parsedClassId, parsedYear, parsedMonth]);
            
            reportId = existingResult.rows[0].id;
        } else {
            // Insert new report
            const insertResult = await pool.query(`
                INSERT INTO monthly_reports (class_id, year, month, report_data, generated_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [parsedClassId, parsedYear, parsedMonth, JSON.stringify(reportData), req.session.userId]);
            
            reportId = insertResult.rows[0].id;
        }
        
        res.json({
            success: true,
            reportId,
            reportData
        });
    } catch (error) {
        console.error('Error generating monthly report:', error);
        res.status(500).json({ 
            error: 'Failed to generate monthly report',
            message: error.message 
        });
    }
});

/**
 * Export monthly report as PDF
 */
router.post('/export-pdf/:id', checkR2Config, async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        
        if (isNaN(reportId)) {
            return res.status(400).json({ error: 'Invalid report ID' });
        }
        
        // Fetch the monthly report
        const result = await pool.query(`
            SELECT mr.*, c.name as class_name
            FROM monthly_reports mr
            JOIN classes c ON mr.class_id = c.id
            WHERE mr.id = $1
        `, [reportId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Monthly report not found' });
        }
        
        const report = result.rows[0];
        const reportData = report.report_data;
        
        // Generate PDF
        const pdfBuffer = await generateMonthlyReportPDF(reportData);
        
        // Upload to R2
        const sanitizedClassName = report.class_name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `monthly_report_${sanitizedClassName}_${report.year}_${String(report.month).padStart(2, '0')}.pdf`;
        
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            type: 'monthly_report',
            reportId: reportId.toString(),
            className: report.class_name,
            year: report.year.toString(),
            month: report.month.toString()
        });
        
        // Save to pdf_history table
        const historyResult = await pool.query(`
            INSERT INTO pdf_history (filename, type, class_id, r2_key, r2_url, file_size, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            fileName,
            'monthly_report',
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
            message: 'Monthly report PDF generated successfully'
        });
    } catch (error) {
        console.error('Error exporting monthly report PDF:', error);
        res.status(500).json({ 
            error: 'Failed to export PDF',
            message: error.message 
        });
    }
});

/**
 * Generate and export PDF directly (without saving report first)
 */
router.post('/quick-export', checkR2Config, async (req, res) => {
    try {
        const { classId, year, month } = req.body;
        
        // Validate inputs
        if (!classId || !year || !month) {
            return res.status(400).json({ error: 'classId, year, and month are required' });
        }
        
        const parsedClassId = parseInt(classId);
        const parsedYear = parseInt(year);
        const parsedMonth = parseInt(month);
        
        if (isNaN(parsedClassId) || isNaN(parsedYear) || isNaN(parsedMonth)) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }
        
        // Calculate date range for the month
        const startDate = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();
        const endDate = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${lastDay}`;
        
        // Fetch class data
        const classResult = await pool.query(`
            SELECT c.*, u.full_name as teacher_name
            FROM classes c
            LEFT JOIN users u ON c.teacher_id = u.id
            WHERE c.id = $1
        `, [parsedClassId]);
        
        if (classResult.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        const classData = classResult.rows[0];
        
        // Fetch students in class
        const studentsResult = await pool.query(`
            SELECT id, name, student_type, color_code, email, phone
            FROM students
            WHERE class_id = $1 AND active = true
            ORDER BY student_type, name
        `, [parsedClassId]);
        
        const students = studentsResult.rows;
        
        // Fetch lesson reports for the month
        const reportsResult = await pool.query(`
            SELECT lr.*, u.full_name as teacher_name
            FROM lesson_reports lr
            LEFT JOIN users u ON lr.teacher_id = u.id
            WHERE lr.class_id = $1 AND lr.date >= $2 AND lr.date <= $3
            ORDER BY lr.date ASC
        `, [parsedClassId, startDate, endDate]);
        
        const lessonReports = reportsResult.rows;
        
        // Fetch attendance records for the month
        const attendanceResult = await pool.query(`
            SELECT a.student_id, a.date, a.status, a.time, a.notes
            FROM attendance a
            WHERE a.class_id = $1 AND a.date >= $2 AND a.date <= $3
            ORDER BY a.date ASC
        `, [parsedClassId, startDate, endDate]);
        
        const attendanceRecords = attendanceResult.rows;
        
        // Build report data
        const reportData = {
            classInfo: {
                id: classData.id,
                name: classData.name,
                teacherName: classData.teacher_name,
                schedule: classData.schedule
            },
            period: {
                year: parsedYear,
                month: parsedMonth,
                monthName: new Date(parsedYear, parsedMonth - 1).toLocaleString('en-US', { month: 'long' }),
                startDate,
                endDate
            },
            students: students.map(s => ({
                id: s.id,
                name: s.name,
                type: s.student_type,
                email: s.email,
                phone: s.phone
            })),
            lessonSummary: {
                totalLessons: lessonReports.length,
                lessons: lessonReports.map(lr => ({
                    id: lr.id,
                    date: lr.date,
                    teacherName: lr.teacher_name,
                    targetTopic: lr.target_topic,
                    vocabulary: lr.vocabulary,
                    mistakes: lr.mistakes,
                    strengths: lr.strengths,
                    comments: lr.comments
                })),
                topicsCovered: [...new Set(lessonReports.map(lr => lr.target_topic).filter(Boolean))],
                // Aggregate vocabulary (deduplicated)
                allVocabulary: [...new Set(
                    lessonReports
                        .map(lr => lr.vocabulary)
                        .filter(Boolean)
                        .flatMap(v => v.split('\n').map(s => s.trim()))
                        .filter(Boolean)
                )].join('\n'),
                // Aggregate common mistakes (deduplicated)
                commonMistakes: [...new Set(
                    lessonReports
                        .map(lr => lr.mistakes)
                        .filter(Boolean)
                        .flatMap(m => m.split('\n').map(s => s.trim()))
                        .filter(Boolean)
                )].join('\n'),
                // Aggregate strengths (deduplicated)
                overallStrengths: [...new Set(
                    lessonReports
                        .map(lr => lr.strengths)
                        .filter(Boolean)
                        .flatMap(s => s.split('\n').map(str => str.trim()))
                        .filter(Boolean)
                )].join('\n'),
                teacherComments: lessonReports.map(lr => ({
                    date: lr.date,
                    comment: lr.comments
                })).filter(c => c.comment)
            },
            attendanceSummary: {
                totalDays: [...new Set(attendanceRecords.map(a => a.date))].length,
                records: {}
            }
        };
        
        // Calculate per-student attendance summary
        students.forEach(student => {
            const studentAttendance = attendanceRecords.filter(a => a.student_id === student.id);
            const present = studentAttendance.filter(a => a.status === 'O').length;
            const absent = studentAttendance.filter(a => a.status === 'X').length;
            const late = studentAttendance.filter(a => a.status === '/').length;
            const total = studentAttendance.length;
            
            reportData.attendanceSummary.records[student.id] = {
                studentName: student.name,
                present,
                absent,
                late,
                total,
                rate: total > 0 ? Math.round((present / total) * 100) : 0
            };
        });
        
        // Generate PDF
        const pdfBuffer = await generateMonthlyReportPDF(reportData);
        
        // Upload to R2
        const sanitizedClassName = classData.name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `monthly_report_${sanitizedClassName}_${parsedYear}_${String(parsedMonth).padStart(2, '0')}.pdf`;
        
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            type: 'monthly_report',
            className: classData.name,
            year: parsedYear.toString(),
            month: parsedMonth.toString()
        });
        
        // Save to pdf_history table
        const historyResult = await pool.query(`
            INSERT INTO pdf_history (filename, type, class_id, r2_key, r2_url, file_size, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            fileName,
            'monthly_report',
            parsedClassId,
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
            reportData,
            message: 'Monthly report PDF generated successfully'
        });
    } catch (error) {
        console.error('Error in quick export:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF',
            message: error.message 
        });
    }
});

/**
 * Delete a monthly report
 */
router.delete('/:id', async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        
        if (isNaN(reportId)) {
            return res.status(400).json({ error: 'Invalid report ID' });
        }
        
        await pool.query('DELETE FROM monthly_reports WHERE id = $1', [reportId]);
        
        res.json({
            success: true,
            message: 'Monthly report deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting monthly report:', error);
        res.status(500).json({ error: 'Failed to delete monthly report' });
    }
});

module.exports = router;
