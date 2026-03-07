const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');
const { generateStudentAttendancePDF, generateClassAttendancePDF, generateAttendanceGridPDF, generateEnhancedAttendanceGridPDF, generateStudentAttendanceReportPDF, generateClassSummaryPDF, generateLessonReportPDF, generateMultiClassReportPDF } = require('../utils/pdfGenerator');
const { uploadPDF, getDownloadUrl, listPDFs, isConfigured } = require('../utils/r2Storage');
const { normalizeToISO } = require('../utils/dateUtils');
const { buildAttendanceMatrix } = require('../utils/attendanceDataBuilder');

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
        
        // Fetch student data using DataHub
        const student = await dataHub.students.getProfile(studentId);
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        // Fetch attendance records
        const attendanceRecords = await dataHub.attendance.getStudentHistory(studentId, 1000);
        
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
        const pdfId = await dataHub.pdfHistory.create({
            filename: fileName,
            type: 'student_attendance',
            student_id: studentId,
            r2_key: uploadResult.key,
            r2_url: uploadResult.url,
            file_size: uploadResult.size,
            created_by: req.session.userId
        });
        
        // Generate signed download URL
        const downloadUrl = await getDownloadUrl(uploadResult.key, 3600, fileName);
        
        res.json({
            success: true,
            pdfId: pdfId.id,
            fileName,
            downloadUrl,
            size: uploadResult.size,
            message: 'Student attendance PDF generated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error generating student attendance PDF:', error);
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
        const classData = await dataHub.classes.findById(classId);
        
        if (!classData) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        // Fetch students in class
        const students = await dataHub.students.findAll({
            classId,
            orderBy: 'student_type',
            perPage: 0 // No pagination, get all
        });
        
        // Fetch attendance records for the date
        const attendanceRecords = await dataHub.attendance.getByClassAndDate(classId, date);
        
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
        const pdf = await dataHub.pdfHistory.create({
            filename: fileName,
            type: 'class_attendance',
            class_id: classId,
            r2_key: uploadResult.key,
            r2_url: uploadResult.url,
            file_size: uploadResult.size,
            created_by: req.session.userId
        });
        
        // Generate signed download URL
        const downloadUrl = await getDownloadUrl(uploadResult.key, 3600, fileName);
        
        res.json({
            success: true,
            pdfId: pdf.id,
            fileName,
            downloadUrl,
            size: uploadResult.size,
            message: 'Class attendance PDF generated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error generating class attendance PDF:', error);
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
        
        // Use shared data builder to ensure UI and PDF have identical data
        const matrixData = await buildAttendanceMatrix(dataHub.pool, classId, startDate, endDate);

        // Apply schedule-date filtering so the PDF only shows class days (matching the UI)
        let filteredDates = matrixData.dates;
        if (matrixData.classData.schedule) {
            const sched = matrixData.classData.schedule.toLowerCase();
            const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            const dayAbbr  = ['sun','mon','tue','wed','thu','fri','sat'];
            const scheduledDays = [];
            dayNames.forEach((d, i) => { if (sched.includes(d) || sched.includes(dayAbbr[i])) scheduledDays.push(i); });
            if (scheduledDays.length > 0) {
                const scheduleSet = new Set(
                    matrixData.dates.filter(d => scheduledDays.includes(new Date(d + 'T00:00:00').getDay()))
                );
                // Always include dates that have actual attendance records even if off-schedule
                filteredDates = matrixData.dates.filter(d => {
                    if (scheduleSet.has(d)) return true;
                    return matrixData.students.some(s => matrixData.attendanceMap[`${s.id}-${d}`]);
                });
            }
        }

        // Generate PDF using the same data structure as the UI
        const pdfBuffer = await generateAttendanceGridPDF(
            matrixData.classData,
            matrixData.students,
            filteredDates,
            matrixData.attendanceMap,
            matrixData.startDate,
            matrixData.endDate
        );
        
        // Upload to R2 - sanitize filename (only alphanumeric characters)
        const sanitizedClassName = matrixData.classData.name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `attendance_grid_${sanitizedClassName}_${startDate}_to_${endDate}.pdf`;
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            type: 'attendance_grid',
            classId: classId.toString(),
            className: matrixData.classData.name,
            startDate: startDate,
            endDate: endDate
        });
        
        // Save to pdf_history table
        const pdf = await dataHub.pdfHistory.create({
            filename: fileName,
            type: 'attendance_grid',
            class_id: classId,
            r2_key: uploadResult.key,
            r2_url: uploadResult.url,
            file_size: uploadResult.size,
            created_by: req.session.userId
        });
        
        // Generate signed download URL
        const downloadUrl = await getDownloadUrl(uploadResult.key, 3600, fileName);
        
        res.json({
            success: true,
            pdfId: pdf.id,
            fileName,
            downloadUrl,
            size: uploadResult.size,
            message: 'Attendance grid PDF generated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error generating attendance grid PDF:', error);
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
        const report = await dataHub.teacherCommentSheets.findById(reportId);
        
        if (!report) {
            return res.status(404).json({ error: 'Lesson report not found' });
        }
        
        // Get class data
        const classData = await dataHub.classes.findById(report.class_id);
        
        // Fetch students in the class
        const students = await dataHub.students.findAll({
            classId: report.class_id,
            orderBy: 'student_type',
            perPage: 0 // No pagination, get all
        });
        
        // Generate PDF with students
        const pdfBuffer = await generateLessonReportPDF(report, classData, students);
        
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
        const pdf = await dataHub.pdfHistory.create({
            filename: fileName,
            type: 'lesson_report',
            report_id: reportId,
            class_id: report.class_id,
            r2_key: uploadResult.key,
            r2_url: uploadResult.url,
            file_size: uploadResult.size,
            created_by: req.session.userId
        });
        
        // Generate signed download URL
        const downloadUrl = await getDownloadUrl(uploadResult.key, 3600, fileName);
        
        res.json({
            success: true,
            pdfId: pdf.id,
            fileName,
            downloadUrl,
            size: uploadResult.size,
            message: 'Lesson report PDF generated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error generating lesson report PDF:', error);
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
        
        const options = {
            perPage: parseInt(limit),
            orderBy: 'created_at',
            orderDirection: 'DESC'
        };
        
        if (type) {
            options.type = type;
        }
        
        const pdfs = await dataHub.pdfHistory.findAll(options);
        
        res.json({
            success: true,
            pdfs
        });
        
    } catch (error) {
        console.error('❌ Error fetching PDF history:', error);
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
        const pdf = await dataHub.pdfHistory.findById(pdfId);
        
        if (!pdf) {
            return res.status(404).json({ error: 'PDF not found' });
        }
        
        // Generate signed download URL (valid for 1 hour)
        const downloadUrl = await getDownloadUrl(pdf.r2_key, 3600, pdf.filename);
        
        res.json({
            success: true,
            downloadUrl,
            fileName: pdf.filename,
            type: pdf.type,
            createdAt: pdf.created_at
        });
        
    } catch (error) {
        console.error('❌ Error getting download URL:', error);
        res.status(500).json({ 
            error: 'Failed to get download URL',
            message: error.message
        });
    }
});

// Generate multi-class reports PDF
router.post('/multi-class-reports', checkR2Config, async (req, res) => {
    try {
        const { classes, startDate, endDate } = req.body;
        
        if (!classes || !Array.isArray(classes) || classes.length === 0) {
            return res.status(400).json({ error: 'At least one class must be selected' });
        }
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
        
        // Fetch data for each class
        const classReportsData = [];
        
        for (const classId of classes) {
            // Get class data
            const classData = await dataHub.classes.findById(classId);
            
            if (!classData) {
                continue; // Skip if class not found
            }
            
            // Get students for this class
            const students = await dataHub.students.findAll({
                classId,
                orderBy: 'student_type',
                perPage: 0 // No pagination, get all
            });
            
            // Get reports for this class within date range
            const reports = await dataHub.teacherCommentSheets.getByDateRange(classId, startDate, endDate);
            
            classReportsData.push({
                classData,
                students,
                reports
            });
        }
        
        if (classReportsData.length === 0) {
            return res.status(404).json({ error: 'No classes found' });
        }
        
        // Generate PDF
        const pdfBuffer = await generateMultiClassReportPDF(classReportsData, startDate, endDate);
        
        // Create filename
        const classCount = classReportsData.length;
        const fileName = `multi_class_reports_${classCount}_classes_${startDate}_to_${endDate}.pdf`;
        
        // Upload to R2
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            type: 'multi_class_reports',
            classCount: classCount.toString(),
            startDate: startDate,
            endDate: endDate
        });
        
        // Save to pdf_history table
        const pdf = await dataHub.pdfHistory.create({
            filename: fileName,
            type: 'multi_class_reports',
            r2_key: uploadResult.key,
            r2_url: uploadResult.url,
            file_size: uploadResult.size,
            created_by: req.session.userId
        });
        
        // Generate signed download URL
        const downloadUrl = await getDownloadUrl(uploadResult.key, 3600, fileName);
        
        res.json({
            success: true,
            pdfId: pdf.id,
            fileName,
            downloadUrl,
            size: uploadResult.size,
            classCount: classReportsData.length,
            totalReports: classReportsData.reduce((sum, cr) => sum + cr.reports.length, 0),
            message: 'Multi-class reports PDF generated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error generating multi-class reports PDF:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

// ─── Part 3: New & enhanced PDF endpoints ─────────────────────────────────────

// Enhanced attendance-grid PDF (schedule-aware, bilingual)
// POST /api/pdf/attendance-grid-enhanced/:classId
router.post('/attendance-grid-enhanced/:classId', checkR2Config, async (req, res) => {
    try {
        const classId = parseInt(req.params.classId);
        const { startDate, endDate, includeStats = true, includeComments = true } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
        if (startDate > endDate) {
            return res.status(400).json({ error: 'Start date must be before or equal to end date' });
        }

        const matrixData = await buildAttendanceMatrix(dataHub.pool, classId, startDate, endDate);

        // Get schedule dates for this range
        let scheduleDates = [];
        if (matrixData.classData.schedule) {
            const sched = matrixData.classData.schedule.toLowerCase();
            const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            const dayAbbr  = ['sun','mon','tue','wed','thu','fri','sat'];
            const scheduledDays = [];
            dayNames.forEach((d, i) => { if (sched.includes(d) || sched.includes(dayAbbr[i])) scheduledDays.push(i); });
            if (scheduledDays.length > 0) {
                const start = new Date(startDate + 'T00:00:00');
                const end   = new Date(endDate + 'T00:00:00');
                const cur   = new Date(start);
                while (cur <= end) {
                    if (scheduledDays.includes(cur.getDay())) {
                        scheduleDates.push(cur.toISOString().split('T')[0]);
                    }
                    cur.setDate(cur.getDate() + 1);
                }
            }
        }

        const pdfBuffer = await generateEnhancedAttendanceGridPDF(
            matrixData.classData,
            matrixData.students,
            matrixData.dates,
            matrixData.attendanceMap,
            matrixData.startDate,
            matrixData.endDate,
            scheduleDates,
            { includeStats, includeComments }
        );

        const sanitizedClassName = matrixData.classData.name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `attendance_grid_enhanced_${sanitizedClassName}_${startDate}_to_${endDate}.pdf`;
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            type: 'attendance_grid_enhanced',
            classId: classId.toString(),
            className: matrixData.classData.name,
            startDate,
            endDate
        });

        const pdf = await dataHub.pdfHistory.create({
            filename: fileName,
            type: 'attendance_grid_enhanced',
            class_id: classId,
            r2_key: uploadResult.key,
            r2_url: uploadResult.url,
            file_size: uploadResult.size,
            created_by: req.session.userId
        });

        const downloadUrl = await getDownloadUrl(uploadResult.key, 3600, fileName);
        res.json({ success: true, pdfId: pdf.id, fileName, downloadUrl, size: uploadResult.size, message: 'Enhanced attendance grid PDF generated successfully' });
    } catch (error) {
        console.error('❌ Error generating enhanced attendance grid PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
    }
});

// Student attendance report PDF (across all classes)
// POST /api/pdf/student-attendance-report/:studentId
router.post('/student-attendance-report/:studentId', checkR2Config, async (req, res) => {
    try {
        const studentId = parseInt(req.params.studentId);
        const { startDate, endDate } = req.body;

        const normalizedStart = startDate ? normalizeToISO(startDate) : null;
        const normalizedEnd   = endDate   ? normalizeToISO(endDate)   : null;

        const studentResult = await dataHub.query('SELECT * FROM students WHERE id = $1', [studentId]);
        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const student = studentResult.rows[0];

        let q = `
            SELECT a.date, a.status, a.class_id, c.name as class_name
            FROM attendance a JOIN classes c ON a.class_id = c.id
            WHERE a.student_id = $1
        `;
        const params = [studentId];
        let idx = 2;
        if (normalizedStart) { q += ` AND a.date >= $${idx++}`; params.push(normalizedStart); }
        if (normalizedEnd)   { q += ` AND a.date <= $${idx++}`; params.push(normalizedEnd); }
        q += ' ORDER BY a.date ASC';

        const attResult = await dataHub.query(q, params);
        const records = attResult.rows.map(r => ({
            date: normalizeToISO(r.date) || r.date,
            status: r.status,
            class_id: r.class_id,
            class_name: r.class_name
        }));

        const total   = records.length;
        const present = records.filter(r => r.status === 'O').length;
        const absent  = records.filter(r => r.status === 'X').length;
        const partial = records.filter(r => r.status === '/').length;
        const rate    = total > 0 ? Math.round((present / total) * 100) : 0;

        let cStreak = 0, bStreak = 0, tempStreak = 0;
        for (const r of records) {
            if (r.status === 'O') { tempStreak++; if (tempStreak > bStreak) bStreak = tempStreak; }
            else if (r.status !== '/') { tempStreak = 0; }
        }
        cStreak = tempStreak;

        const pdfBuffer = await generateStudentAttendanceReportPDF(
            student, records, { total, present, absent, partial, rate },
            { current: cStreak, best: Math.max(bStreak, cStreak) }
        );

        const sanitizedName = student.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `student_attendance_report_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;
        const uploadResult = await uploadPDF(pdfBuffer, fileName, { type: 'student_attendance_report', studentId: studentId.toString(), studentName: student.name });

        const pdf = await dataHub.pdfHistory.create({
            filename: fileName, type: 'student_attendance_report',
            student_id: studentId, r2_key: uploadResult.key, r2_url: uploadResult.url,
            file_size: uploadResult.size, created_by: req.session.userId
        });

        const downloadUrl = await getDownloadUrl(uploadResult.key, 3600, fileName);
        res.json({ success: true, pdfId: pdf.id, fileName, downloadUrl, size: uploadResult.size, message: 'Student attendance report PDF generated successfully' });
    } catch (error) {
        console.error('❌ Error generating student attendance report PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
    }
});

// Class attendance summary PDF
// POST /api/pdf/class-summary/:classId
router.post('/class-summary/:classId', checkR2Config, async (req, res) => {
    try {
        const classId = parseInt(req.params.classId);
        const year = parseInt(req.body.year) || new Date().getFullYear();

        const classResult = await dataHub.query(
            'SELECT c.*, u.full_name as teacher_name FROM classes c LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = $1',
            [classId]
        );
        if (classResult.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        const classData = classResult.rows[0];

        const studentsResult = await dataHub.query(
            'SELECT id, name, student_type FROM students WHERE class_id = $1 AND active = true ORDER BY student_type, name',
            [classId]
        );
        const students = studentsResult.rows;

        const attResult = await dataHub.query(`
            SELECT a.student_id, a.date, a.status
            FROM attendance a
            WHERE a.class_id = $1 AND EXTRACT(YEAR FROM a.date::date) = $2
            ORDER BY a.date
        `, [classId, year]);

        const monthlyStats = {};
        for (let m = 1; m <= 12; m++) monthlyStats[m] = { total: 0, present: 0, rate: null };
        const studentMap = {};
        students.forEach(s => { studentMap[s.id] = { ...s, total: 0, present: 0, rate: 0 }; });

        attResult.rows.forEach(r => {
            const month = parseInt((normalizeToISO(r.date) || r.date).split('-')[1]);
            monthlyStats[month].total++;
            if (r.status === 'O') monthlyStats[month].present++;
            if (studentMap[r.student_id]) {
                studentMap[r.student_id].total++;
                if (r.status === 'O') studentMap[r.student_id].present++;
            }
        });
        Object.keys(monthlyStats).forEach(m => {
            const ms = monthlyStats[m];
            ms.rate = ms.total > 0 ? Math.round((ms.present / ms.total) * 100) : null;
        });
        const studentStats = Object.values(studentMap).map(ss => ({
            ...ss, rate: ss.total > 0 ? Math.round((ss.present / ss.total) * 100) : 0
        }));
        const lowestPerformers = [...studentStats].filter(s => s.total > 0).sort((a, b) => a.rate - b.rate).slice(0, 3);

        const pdfBuffer = await generateClassSummaryPDF(classData, year, monthlyStats, studentStats, lowestPerformers);

        const sanitizedClassName = classData.name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `class_summary_${sanitizedClassName}_${year}.pdf`;
        const uploadResult = await uploadPDF(pdfBuffer, fileName, { type: 'class_summary', classId: classId.toString(), className: classData.name, year: String(year) });

        const pdf = await dataHub.pdfHistory.create({
            filename: fileName, type: 'class_summary', class_id: classId,
            r2_key: uploadResult.key, r2_url: uploadResult.url,
            file_size: uploadResult.size, created_by: req.session.userId
        });

        const downloadUrl = await getDownloadUrl(uploadResult.key, 3600, fileName);
        res.json({ success: true, pdfId: pdf.id, fileName, downloadUrl, size: uploadResult.size, message: 'Class summary PDF generated successfully' });
    } catch (error) {
        console.error('❌ Error generating class summary PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
    }
});

module.exports = router;
