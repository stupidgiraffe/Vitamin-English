const express = require('express');
const router = express.Router();
const pool = require('../database/init');
const { generateMonthlyReportPDF } = require('../utils/monthlyReportPdf');
const { uploadPDF, getDownloadUrl } = require('../utils/r2Storage');

/**
 * GET /api/monthly-reports
 * List all monthly reports with filtering
 */
router.get('/', async (req, res) => {
    try {
        const { classId, year, month, start_date, end_date, status } = req.query;
        
        // Check if monthly_reports table exists
        const client = await pool.connect();
        try {
            const tableCheck = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'monthly_reports'
            `);
            
            if (tableCheck.rows.length === 0) {
                console.warn('⚠️  monthly_reports table does not exist (migration 004 not applied)');
                return res.status(503).json({ 
                    error: 'Monthly reports feature not available',
                    message: 'Database migration 004 is required. Please run: node scripts/apply-migrations.js',
                    needsMigration: true
                });
            }
        } finally {
            client.release();
        }
        
        let query = `
            SELECT mr.*, c.name as class_name, c.schedule, u.full_name as created_by_name
            FROM monthly_reports mr
            JOIN classes c ON mr.class_id = c.id
            LEFT JOIN users u ON mr.created_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (classId) {
            query += ` AND mr.class_id = $${paramIndex}`;
            params.push(classId);
            paramIndex++;
        }
        
        // Support both year/month (for backward compatibility) and date range filtering
        if (year) {
            query += ` AND mr.year = $${paramIndex}`;
            params.push(year);
            paramIndex++;
        }
        
        if (month) {
            query += ` AND mr.month = $${paramIndex}`;
            params.push(month);
            paramIndex++;
        }
        
        if (start_date) {
            query += ` AND COALESCE(mr.start_date, mr.created_at::date) >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }
        
        if (end_date) {
            query += ` AND COALESCE(mr.end_date, mr.created_at::date) <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }
        
        if (status) {
            query += ` AND mr.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        query += ' ORDER BY mr.year DESC, mr.month DESC, mr.created_at DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching monthly reports:', error);
        
        // Check if error is because table doesn't exist
        if (error.message && error.message.includes('does not exist') && error.message.includes('monthly_reports')) {
            return res.status(503).json({ 
                error: 'Monthly reports feature not available',
                message: 'Database migration 004 is required. Please run: node scripts/apply-migrations.js',
                needsMigration: true
            });
        }
        
        res.status(500).json({ error: 'Failed to fetch monthly reports' });
    }
});

/**
 * POST /api/monthly-reports/preview-generate
 * Preview monthly report data from lesson reports without creating the report
 * NOTE: Must be defined before /:id routes to avoid Express matching 'preview-generate' as :id
 */
router.post('/preview-generate', async (req, res) => {
    try {
        const { class_id, start_date, end_date, year, month } = req.body;
        
        if (!class_id) {
            return res.status(400).json({ 
                error: 'Missing required field: class_id' 
            });
        }
        
        // Calculate date range based on inputs
        let startDate, endDate;
        if (start_date && end_date) {
            // Custom range
            startDate = start_date;
            endDate = end_date;
        } else if (year && month) {
            // Monthly
            startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        } else {
            return res.status(400).json({ 
                error: 'Either (year and month) or (start_date and end_date) must be provided' 
            });
        }
        
        // Query lesson reports - try teacher_comment_sheets first, fallback to lesson_reports
        let lessonsResult;
        try {
            lessonsResult = await pool.query(`
                SELECT * FROM teacher_comment_sheets
                WHERE class_id = $1 AND date >= $2 AND date <= $3
                ORDER BY date
            `, [class_id, startDate, endDate]);
        } catch (tableError) {
            if (tableError.message && tableError.message.includes('does not exist')) {
                console.warn('⚠️  teacher_comment_sheets table not found, falling back to lesson_reports');
                lessonsResult = await pool.query(`
                    SELECT * FROM lesson_reports
                    WHERE class_id = $1 AND date >= $2 AND date <= $3
                    ORDER BY date
                `, [class_id, startDate, endDate]);
            } else {
                throw tableError;
            }
        }
        
        const lessons = lessonsResult.rows;
        
        // Map to weekly format, combining strengths+comments into others
        const weeks = lessons.map((lesson, index) => ({
            week_number: index + 1,
            lesson_date: lesson.date,
            target: lesson.target_topic || '',
            vocabulary: lesson.vocabulary || '',
            phrase: lesson.mistakes || '',
            others: [lesson.strengths, lesson.comments].filter(Boolean).join(' | '),
            teacher_comment_sheet_id: lesson.id
        }));
        
        res.json({ 
            success: true, 
            weeks: weeks,
            lessonCount: weeks.length 
        });
    } catch (error) {
        console.error('Error previewing monthly report:', error);
        res.status(500).json({ 
            error: 'Failed to preview monthly report',
            message: error.message 
        });
    }
});

/**
 * POST /api/monthly-reports/auto-generate
 * Auto-generate monthly report from existing teacher comment sheets
 * NOTE: Must be defined before /:id routes to avoid Express matching 'auto-generate' as :id
 */
router.post('/auto-generate', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { class_id, start_date, end_date, year, month, monthly_theme, status } = req.body;
        
        if (!class_id) {
            return res.status(400).json({ 
                error: 'Missing required field: class_id' 
            });
        }
        
        // Calculate date range based on inputs
        // Precedence: start_date/end_date takes priority over year/month if both are provided
        let startDate, endDate, reportYear, reportMonth;
        if (start_date && end_date) {
            // Custom range
            startDate = start_date;
            endDate = end_date;
            // Extract year and month from start_date for the report
            const startDateObj = new Date(start_date);
            reportYear = startDateObj.getFullYear();
            reportMonth = startDateObj.getMonth() + 1;
        } else if (year && month) {
            // Monthly (backwards compatibility)
            reportYear = year;
            reportMonth = month;
            startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        } else {
            return res.status(400).json({ 
                error: 'Either (year and month) or (start_date and end_date) must be provided' 
            });
        }
        
        await client.query('BEGIN');
        
        // Check for existing report by exact date range (matches new UNIQUE constraint)
        const existingResult = await client.query(`
            SELECT id FROM monthly_reports 
            WHERE class_id = $1 AND start_date = $2 AND end_date = $3
        `, [class_id, startDate, endDate]);
        
        if (existingResult.rows.length > 0) {
            await client.query('ROLLBACK');
            const existingId = existingResult.rows[0].id;
            
            // Fetch the complete existing report
            const completeResult = await pool.query(`
                SELECT mr.*, c.name as class_name, c.schedule
                FROM monthly_reports mr
                JOIN classes c ON mr.class_id = c.id
                WHERE mr.id = $1
            `, [existingId]);
            
            const report = completeResult.rows[0];
            
            // Get weeks
            const weeksResult = await pool.query(`
                SELECT * FROM monthly_report_weeks
                WHERE monthly_report_id = $1
                ORDER BY week_number
            `, [existingId]);
            
            report.weeks = weeksResult.rows;
            
            // Return existing report with a flag indicating it already existed
            return res.status(200).json({ 
                ...report,
                alreadyExists: true,
                message: 'A monthly report with this exact date range already exists'
            });
        }
        
        // Get teacher comment sheets for this date range - try teacher_comment_sheets first
        let lessonsResult;
        try {
            lessonsResult = await client.query(`
                SELECT * FROM teacher_comment_sheets
                WHERE class_id = $1 AND date >= $2 AND date <= $3
                ORDER BY date
            `, [class_id, startDate, endDate]);
        } catch (tableError) {
            if (tableError.message && tableError.message.includes('does not exist')) {
                console.warn('⚠️  teacher_comment_sheets table not found, falling back to lesson_reports');
                lessonsResult = await client.query(`
                    SELECT * FROM lesson_reports
                    WHERE class_id = $1 AND date >= $2 AND date <= $3
                    ORDER BY date
                `, [class_id, startDate, endDate]);
            } else {
                throw tableError;
            }
        }
        
        const lessons = lessonsResult.rows;
        
        if (lessons.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'No teacher comment sheets found for this class and date range' 
            });
        }
        
        // Create monthly report - try with start_date/end_date first, fall back without them
        let reportResult;
        try {
            reportResult = await client.query(`
                INSERT INTO monthly_reports (class_id, year, month, start_date, end_date, monthly_theme, status, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [class_id, reportYear, reportMonth, startDate, endDate, monthly_theme || '', status || 'draft', req.session.userId]);
        } catch (insertErr) {
            // If start_date/end_date columns don't exist yet, fall back to basic insert
            if (insertErr.code === '42703' || insertErr.message.includes('start_date') || insertErr.message.includes('end_date')) {
                console.warn('monthly_reports missing start_date/end_date columns, using fallback INSERT');
                reportResult = await client.query(`
                    INSERT INTO monthly_reports (class_id, year, month, monthly_theme, status, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `, [class_id, reportYear, reportMonth, monthly_theme || '', status || 'draft', req.session.userId]);
            } else {
                throw insertErr;
            }
        }
        
        const reportId = reportResult.rows[0].id;
        
        // Create weekly entries from teacher comment sheets
        for (let index = 0; index < lessons.length; index++) {
            const lesson = lessons[index];
            // Combine strengths and comments into 'others' since weekly schema has no strengths column
            const othersContent = [lesson.strengths, lesson.comments].filter(Boolean).join(' | ');
            await client.query(`
                INSERT INTO monthly_report_weeks 
                (monthly_report_id, week_number, lesson_date, target, vocabulary, phrase, others, teacher_comment_sheet_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                reportId,
                index + 1,
                lesson.date,
                lesson.target_topic || '',
                lesson.vocabulary || '',
                lesson.mistakes || '',
                othersContent,
                lesson.id
            ]);
        }
        
        await client.query('COMMIT');
        
        // Fetch complete report
        const completeResult = await pool.query(`
            SELECT mr.*, c.name as class_name, c.schedule
            FROM monthly_reports mr
            JOIN classes c ON mr.class_id = c.id
            WHERE mr.id = $1
        `, [reportId]);
        
        const report = completeResult.rows[0];
        
        // Get weeks
        const weeksResult = await pool.query(`
            SELECT * FROM monthly_report_weeks
            WHERE monthly_report_id = $1
            ORDER BY week_number
        `, [reportId]);
        
        report.weeks = weeksResult.rows;
        
        res.status(201).json(report);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error auto-generating monthly report:', error);
        res.status(500).json({ 
            error: 'Failed to auto-generate monthly report',
            message: error.message 
        });
    } finally {
        client.release();
    }
});

/**
 * GET /api/monthly-reports/available-months/:classId
 * Get months that have teacher comment sheet data for a class
 * NOTE: Must be defined before /:id routes to avoid Express matching 'available-months' as :id
 */
router.get('/available-months/:classId', async (req, res) => {
    try {
        // Try teacher_comment_sheets first, fallback to lesson_reports
        let result;
        try {
            result = await pool.query(`
                SELECT DISTINCT 
                    EXTRACT(YEAR FROM CAST(date AS DATE)) as year,
                    EXTRACT(MONTH FROM CAST(date AS DATE)) as month,
                    COUNT(*) as lesson_count
                FROM teacher_comment_sheets
                WHERE class_id = $1
                GROUP BY year, month
                ORDER BY year DESC, month DESC
            `, [req.params.classId]);
        } catch (tableError) {
            if (tableError.message && tableError.message.includes('does not exist')) {
                console.warn('⚠️  teacher_comment_sheets table not found, falling back to lesson_reports');
                result = await pool.query(`
                    SELECT DISTINCT 
                        EXTRACT(YEAR FROM CAST(date AS DATE)) as year,
                        EXTRACT(MONTH FROM CAST(date AS DATE)) as month,
                        COUNT(*) as lesson_count
                    FROM lesson_reports
                    WHERE class_id = $1
                    GROUP BY year, month
                    ORDER BY year DESC, month DESC
                `, [req.params.classId]);
            } else {
                throw tableError;
            }
        }
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching available months:', error);
        res.status(500).json({ error: 'Failed to fetch available months' });
    }
});

/**
 * GET /api/monthly-reports/:id
 * Get single monthly report with all weeks
 */
router.get('/:id', async (req, res) => {
    try {
        const reportResult = await pool.query(`
            SELECT mr.*, c.name as class_name, c.schedule, u.full_name as created_by_name
            FROM monthly_reports mr
            JOIN classes c ON mr.class_id = c.id
            LEFT JOIN users u ON mr.created_by = u.id
            WHERE mr.id = $1
        `, [req.params.id]);
        
        const report = reportResult.rows[0];
        if (!report) {
            return res.status(404).json({ error: 'Monthly report not found' });
        }
        
        // Get weekly data
        const weeksResult = await pool.query(`
            SELECT * FROM monthly_report_weeks
            WHERE monthly_report_id = $1
            ORDER BY week_number
        `, [req.params.id]);
        
        report.weeks = weeksResult.rows;
        
        res.json(report);
    } catch (error) {
        console.error('Error fetching monthly report:', error);
        res.status(500).json({ error: 'Failed to fetch monthly report' });
    }
});

/**
 * POST /api/monthly-reports
 * Create new monthly report
 */
router.post('/', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { class_id, year, month, monthly_theme, status, weeks } = req.body;
        
        // Validation
        if (!class_id || !year || !month) {
            return res.status(400).json({ 
                error: 'Missing required fields: class_id, year, month' 
            });
        }
        
        if (month < 1 || month > 12) {
            return res.status(400).json({ error: 'Month must be between 1 and 12' });
        }
        
        await client.query('BEGIN');
        
        // Check for existing report
        const existingResult = await client.query(`
            SELECT id FROM monthly_reports 
            WHERE class_id = $1 AND year = $2 AND month = $3
        `, [class_id, year, month]);
        
        if (existingResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'A monthly report for this class and month already exists' 
            });
        }
        
        // Insert monthly report
        const reportResult = await client.query(`
            INSERT INTO monthly_reports (class_id, year, month, monthly_theme, status, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [
            class_id, 
            year, 
            month, 
            monthly_theme || '', 
            status || 'draft',
            req.session.userId
        ]);
        
        const reportId = reportResult.rows[0].id;
        
        // Insert weekly data if provided
        if (weeks && Array.isArray(weeks) && weeks.length > 0) {
            for (const week of weeks) {
                if (week.week_number) {
                    await client.query(`
                        INSERT INTO monthly_report_weeks 
                        (monthly_report_id, week_number, lesson_date, target, vocabulary, phrase, others, teacher_comment_sheet_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        reportId,
                        week.week_number,
                        week.lesson_date || null,
                        week.target || '',
                        week.vocabulary || '',
                        week.phrase || '',
                        week.others || '',
                        week.teacher_comment_sheet_id || null
                    ]);
                }
            }
        }
        
        await client.query('COMMIT');
        
        // Fetch complete report
        const completeResult = await pool.query(`
            SELECT mr.*, c.name as class_name, c.schedule
            FROM monthly_reports mr
            JOIN classes c ON mr.class_id = c.id
            WHERE mr.id = $1
        `, [reportId]);
        
        const report = completeResult.rows[0];
        
        // Get weeks
        const weeksResult = await pool.query(`
            SELECT * FROM monthly_report_weeks
            WHERE monthly_report_id = $1
            ORDER BY week_number
        `, [reportId]);
        
        report.weeks = weeksResult.rows;
        
        res.status(201).json(report);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating monthly report:', error);
        res.status(500).json({ 
            error: 'Failed to create monthly report',
            message: error.message 
        });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/monthly-reports/:id
 * Update monthly report
 */
router.put('/:id', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { monthly_theme, status, weeks } = req.body;
        
        await client.query('BEGIN');
        
        // Update main report
        await client.query(`
            UPDATE monthly_reports
            SET monthly_theme = $1, status = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [monthly_theme || '', status || 'draft', req.params.id]);
        
        // Delete existing weeks
        await client.query(`
            DELETE FROM monthly_report_weeks
            WHERE monthly_report_id = $1
        `, [req.params.id]);
        
        // Insert updated weeks
        if (weeks && Array.isArray(weeks) && weeks.length > 0) {
            for (const week of weeks) {
                if (week.week_number) {
                    await client.query(`
                        INSERT INTO monthly_report_weeks 
                        (monthly_report_id, week_number, lesson_date, target, vocabulary, phrase, others, teacher_comment_sheet_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        req.params.id,
                        week.week_number,
                        week.lesson_date || null,
                        week.target || '',
                        week.vocabulary || '',
                        week.phrase || '',
                        week.others || '',
                        week.teacher_comment_sheet_id || null
                    ]);
                }
            }
        }
        
        await client.query('COMMIT');
        
        // Fetch updated report
        const completeResult = await pool.query(`
            SELECT mr.*, c.name as class_name, c.schedule
            FROM monthly_reports mr
            JOIN classes c ON mr.class_id = c.id
            WHERE mr.id = $1
        `, [req.params.id]);
        
        const report = completeResult.rows[0];
        
        if (!report) {
            return res.status(404).json({ error: 'Monthly report not found' });
        }
        
        // Get weeks
        const weeksResult = await pool.query(`
            SELECT * FROM monthly_report_weeks
            WHERE monthly_report_id = $1
            ORDER BY week_number
        `, [req.params.id]);
        
        report.weeks = weeksResult.rows;
        
        res.json(report);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating monthly report:', error);
        res.status(500).json({ 
            error: 'Failed to update monthly report',
            message: error.message 
        });
    } finally {
        client.release();
    }
});

/**
 * DELETE /api/monthly-reports/:id
 * Delete monthly report
 */
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM monthly_reports WHERE id = $1 RETURNING id', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Monthly report not found' });
        }
        
        res.json({ message: 'Monthly report deleted successfully' });
    } catch (error) {
        console.error('Error deleting monthly report:', error);
        res.status(500).json({ error: 'Failed to delete monthly report' });
    }
});

/**
 * POST /api/monthly-reports/:id/generate-pdf
 * Generate PDF for monthly report
 */
router.post('/:id/generate-pdf', async (req, res) => {
    try {
        // Get report data
        const reportResult = await pool.query(`
            SELECT mr.*, c.name as class_name, c.schedule
            FROM monthly_reports mr
            JOIN classes c ON mr.class_id = c.id
            WHERE mr.id = $1
        `, [req.params.id]);
        
        const report = reportResult.rows[0];
        if (!report) {
            return res.status(404).json({ error: 'Monthly report not found' });
        }
        
        // Get weekly data
        const weeksResult = await pool.query(`
            SELECT * FROM monthly_report_weeks
            WHERE monthly_report_id = $1
            ORDER BY week_number
        `, [req.params.id]);
        
        const weeks = weeksResult.rows;
        
        // Defensive logging for empty weeks
        if (weeks.length === 0) {
            console.warn(`⚠️  No weekly data found for monthly report ${req.params.id}`);
        } else {
            console.log(`✓ Generating PDF for report ${req.params.id} with ${weeks.length} week(s)`);
        }
        
        // Get unique teachers for this monthly report
        // Join through teacher_comment_sheets to get teacher names
        const teachersResult = await pool.query(`
            SELECT DISTINCT u.full_name
            FROM monthly_report_weeks mrw
            JOIN teacher_comment_sheets tcs ON mrw.teacher_comment_sheet_id = tcs.id
            JOIN users u ON tcs.teacher_id = u.id
            WHERE mrw.monthly_report_id = $1 AND u.full_name IS NOT NULL
            ORDER BY u.full_name
        `, [req.params.id]);
        
        const teachers = teachersResult.rows.map(t => t.full_name);
        
        // Generate PDF with teacher information
        const pdfBuffer = await generateMonthlyReportPDF(report, weeks, {
            name: report.class_name,
            schedule: report.schedule
        }, teachers);
        
        // Upload to R2
        const fileName = `monthly_report_${report.class_id}_${report.year}_${report.month}.pdf`;
        const uploadResult = await uploadPDF(pdfBuffer, fileName, {
            reportId: report.id.toString(),
            classId: report.class_id.toString(),
            year: report.year.toString(),
            month: report.month.toString()
        });
        
        // Get signed URL
        const pdfUrl = await getDownloadUrl(uploadResult.key);
        
        // Update report with PDF URL
        await pool.query(`
            UPDATE monthly_reports
            SET pdf_url = $1
            WHERE id = $2
        `, [uploadResult.key, req.params.id]);
        
        // Store in PDF history
        await pool.query(`
            INSERT INTO pdf_history (filename, type, class_id, r2_key, r2_url, file_size, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            fileName,
            'monthly_report',
            report.class_id,
            uploadResult.key,
            pdfUrl,
            uploadResult.size,
            req.session.userId
        ]);
        
        res.json({ 
            success: true,
            pdfUrl: pdfUrl,
            key: uploadResult.key
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF',
            message: error.message 
        });
    }
});

/**
 * GET /api/monthly-reports/:id/pdf
 * Get PDF URL for monthly report
 */
router.get('/:id/pdf', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT pdf_url FROM monthly_reports WHERE id = $1
        `, [req.params.id]);
        
        const report = result.rows[0];
        if (!report) {
            return res.status(404).json({ error: 'Monthly report not found' });
        }
        
        if (!report.pdf_url) {
            return res.status(404).json({ error: 'PDF not generated yet' });
        }
        
        // Generate new signed URL
        const signedUrl = await getDownloadUrl(report.pdf_url);
        
        res.json({ pdfUrl: signedUrl });
    } catch (error) {
        console.error('Error getting PDF URL:', error);
        res.status(500).json({ error: 'Failed to get PDF URL' });
    }
});

/**
 * POST /api/monthly-reports/generate-test-data
 * Generate test data for January 2024 (admin only, safe - doesn't overwrite existing data)
 */
router.post('/generate-test-data', async (req, res) => {
    const client = await pool.connect();
    
    try {
        // Admin-only check (if session userId is set, check if user is admin)
        if (req.session.userId) {
            const userCheck = await client.query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
            if (userCheck.rows.length === 0 || userCheck.rows[0].role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
        }
        
        const { class_id, teacher_id } = req.body;
        
        if (!class_id || !teacher_id) {
            return res.status(400).json({ 
                error: 'class_id and teacher_id are required' 
            });
        }
        
        // Check if January 2024 report already exists using the new date range constraint
        const existingCheck = await client.query(`
            SELECT id FROM monthly_reports 
            WHERE class_id = $1 AND start_date = $2 AND end_date = $3
        `, [class_id, '2024-01-01', '2024-01-31']);
        
        if (existingCheck.rows.length > 0) {
            // Report already exists - return it instead of erroring
            const existingId = existingCheck.rows[0].id;
            
            // Fetch the complete existing report
            const completeResult = await pool.query(`
                SELECT mr.*, c.name as class_name, c.schedule
                FROM monthly_reports mr
                JOIN classes c ON mr.class_id = c.id
                WHERE mr.id = $1
            `, [existingId]);
            
            const report = completeResult.rows[0];
            
            // Get weeks
            const weeksResult = await pool.query(`
                SELECT * FROM monthly_report_weeks
                WHERE monthly_report_id = $1
                ORDER BY week_number
            `, [existingId]);
            
            report.weeks = weeksResult.rows;
            
            // Return existing report with a flag indicating it already existed
            return res.status(200).json({ 
                success: true,
                message: 'January 2024 test report already exists - returning existing report',
                reportId: existingId,
                sheetsCreated: weeksResult.rows.length,
                alreadyExists: true,
                ...report
            });
        }
        
        await client.query('BEGIN');
        
        // Generate 4 sample teacher comment sheets for January 2024
        const sampleDates = ['2024-01-08', '2024-01-15', '2024-01-22', '2024-01-29'];
        const sampleTopics = [
            'Past Simple Tense',
            'Food & Restaurants Vocabulary',
            'Comparative Adjectives',
            'Daily Routines Discussion'
        ];
        const sampleVocab = [
            'went, saw, ate, visited, enjoyed',
            'delicious, spicy, menu, order, waiter',
            'bigger, smaller, more expensive, better, worse',
            'wake up, get ready, commute, exercise, relax'
        ];
        
        const createdSheets = [];
        
        for (let i = 0; i < sampleDates.length; i++) {
            // Check if sheet already exists for this date
            const sheetCheck = await client.query(`
                SELECT id FROM teacher_comment_sheets
                WHERE class_id = $1 AND date = $2
            `, [class_id, sampleDates[i]]);
            
            if (sheetCheck.rows.length === 0) {
                const sheetResult = await client.query(`
                    INSERT INTO teacher_comment_sheets 
                    (class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id
                `, [
                    class_id,
                    teacher_id,
                    sampleDates[i],
                    sampleTopics[i],
                    sampleVocab[i],
                    'Some minor pronunciation issues with past tense endings',
                    'Students actively participated and showed good comprehension',
                    'Practice exercises for homework assigned'
                ]);
                createdSheets.push(sheetResult.rows[0].id);
            } else {
                createdSheets.push(sheetCheck.rows[0].id);
            }
        }
        
        // Create monthly report
        const reportResult = await client.query(`
            INSERT INTO monthly_reports (class_id, year, month, start_date, end_date, monthly_theme, status, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [
            class_id,
            2024,
            1,
            '2024-01-01',
            '2024-01-31',
            'Winter Communication Skills',
            'draft',
            req.session.userId || null
        ]);
        
        const reportId = reportResult.rows[0].id;
        
        // Create monthly report weeks
        for (let i = 0; i < createdSheets.length; i++) {
            await client.query(`
                INSERT INTO monthly_report_weeks 
                (monthly_report_id, week_number, lesson_date, target, vocabulary, phrase, others, teacher_comment_sheet_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                reportId,
                i + 1,
                sampleDates[i],
                sampleTopics[i],
                sampleVocab[i],
                'Common mistakes noted',
                'Good participation and engagement',
                createdSheets[i]
            ]);
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'January 2024 test data generated successfully',
            reportId: reportId,
            sheetsCreated: createdSheets.length
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error generating test data:', error);
        res.status(500).json({ 
            error: 'Failed to generate test data',
            message: error.message 
        });
    } finally {
        client.release();
    }
});

module.exports = router;
