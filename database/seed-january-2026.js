const pool = require('./init');

/**
 * Seed January 2026 test data for monthly reports
 * Creates teacher comment sheets and a monthly report for class_id=1
 */
async function seedJanuary2026Data() {
    const client = await pool.connect();
    
    try {
        console.log('🌱 Starting January 2026 test data seed...');
        await client.query('BEGIN');
        
        // Get class ID 1 and teacher
        const classResult = await client.query(
            'SELECT id, teacher_id, name FROM classes WHERE id = 1 LIMIT 1'
        );
        
        if (classResult.rows.length === 0) {
            throw new Error('Class ID 1 not found. Please run main seed first.');
        }
        
        const classData = classResult.rows[0];
        console.log(`Using class: ${classData.name} (ID: ${classData.id})`);
        
        // Check if January 2026 data already exists
        const existingSheets = await client.query(
            `SELECT COUNT(*) FROM teacher_comment_sheets 
             WHERE class_id = $1 AND date >= '2026-01-01' AND date <= '2026-01-31'`,
            [classData.id]
        );
        
        if (parseInt(existingSheets.rows[0].count) > 0) {
            console.log('⚠️  January 2026 data already exists, skipping');
            await client.query('ROLLBACK');
            return { success: true, message: 'January 2026 data already exists' };
        }
        
        // Create 5 teacher comment sheets for January 2026
        const teacherCommentSheets = [
            {
                date: '2026-01-05',
                target_topic: 'Time expressions and daily schedule',
                vocabulary: 'one, two, three, four, five, six, seven, eight, nine, ten',
                mistakes: 'What is the time?',
                comments: 'CVC reading practice'
            },
            {
                date: '2026-01-12',
                target_topic: 'Time questions and answers',
                vocabulary: 'What time do you wake up? What time do you go to bed?',
                mistakes: 'What time do you get up?',
                comments: 'CVC reading practice'
            },
            {
                date: '2026-01-19',
                target_topic: 'Daily routine vocabulary',
                vocabulary: 'What time do you eat breakfast? What time do you leave home?',
                mistakes: 'What time do you (eat breakfast)?',
                comments: 'CVC reading practice'
            },
            {
                date: '2026-01-26',
                target_topic: 'Review time expressions',
                vocabulary: 'What time do you have lunch? What time do you come home?',
                mistakes: 'What time do you (come home)?',
                comments: 'CVC reading practice'
            },
            {
                date: '2026-01-30',
                target_topic: 'Monthly review and assessment',
                vocabulary: 'one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve',
                mistakes: 'What time do you (go to sleep)?',
                comments: 'Make up lesson - comprehensive review'
            }
        ];
        
        const sheetIds = [];
        for (const sheet of teacherCommentSheets) {
            const result = await client.query(
                `INSERT INTO teacher_comment_sheets 
                 (class_id, teacher_id, date, target_topic, vocabulary, mistakes, comments)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [
                    classData.id,
                    classData.teacher_id,
                    sheet.date,
                    sheet.target_topic,
                    sheet.vocabulary,
                    sheet.mistakes,
                    sheet.comments
                ]
            );
            sheetIds.push(result.rows[0].id);
            console.log(`✅ Created teacher comment sheet for ${sheet.date}`);
        }
        
        // Create monthly report for January 2026
        const reportResult = await client.query(
            `INSERT INTO monthly_reports 
             (class_id, year, month, start_date, end_date, monthly_theme, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                classData.id,
                2026,
                1,
                '2026-01-01',
                '2026-01-31',
                'Time and Daily Routines - Students learned to ask and answer questions about time, developed vocabulary for daily activities, and practiced CVC reading skills.',
                'published',
                classData.teacher_id
            ]
        );
        
        const reportId = reportResult.rows[0].id;
        console.log(`✅ Created monthly report for January 2026 (ID: ${reportId})`);
        
        // Create weekly entries linking to teacher comment sheets
        for (let i = 0; i < teacherCommentSheets.length; i++) {
            const sheet = teacherCommentSheets[i];
            await client.query(
                `INSERT INTO monthly_report_weeks 
                 (monthly_report_id, week_number, lesson_date, target, vocabulary, phrase, others, teacher_comment_sheet_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    reportId,
                    i + 1,
                    sheet.date,
                    sheet.target_topic,
                    sheet.vocabulary,
                    sheet.mistakes,
                    sheet.comments,
                    sheetIds[i]
                ]
            );
            console.log(`✅ Created week ${i + 1} entry for monthly report`);
        }
        
        await client.query('COMMIT');
        console.log('✅ January 2026 test data seed completed successfully');
        
        return {
            success: true,
            message: 'January 2026 data created',
            reportId: reportId,
            sheetCount: sheetIds.length
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding January 2026 data:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run if called directly
if (require.main === module) {
    seedJanuary2026Data()
        .then(result => {
            console.log('Seed result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Seed failed:', error);
            process.exit(1);
        });
}

module.exports = { seedJanuary2026Data };
