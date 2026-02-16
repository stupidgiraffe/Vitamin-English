const pool = require('./connection');

/**
 * Seed comprehensive school data for Japanese English school
 * This includes classes, students, attendance, teacher comment sheets, and makeup lessons
 */
async function seedSchoolData() {
    const client = await pool.connect();
    
    try {
        console.log('🌱 Starting school data seed...');
        await client.query('BEGIN');
        
        // Get first admin/teacher user
        const userResult = await client.query(
            `SELECT id FROM users WHERE role IN ('admin', 'teacher') ORDER BY id LIMIT 1`
        );
        
        if (userResult.rows.length === 0) {
            throw new Error('No admin or teacher user found. Cannot seed data.');
        }
        
        const teacherId = userResult.rows[0].id;
        console.log(`Using teacher ID: ${teacherId}`);
        
        // Create 3 classes: Elementary A, Elementary B, Intermediate
        const classes = [
            { name: 'Elementary A', schedule: 'Mon/Wed 15:30-16:30', color: '#4285f4' },
            { name: 'Elementary B', schedule: 'Tue/Thu 15:30-16:30', color: '#34a853' },
            { name: 'Intermediate', schedule: 'Fri 16:00-17:30', color: '#ea4335' }
        ];
        
        const classIds = {};
        for (const cls of classes) {
            const result = await client.query(
                `INSERT INTO classes (name, teacher_id, schedule, color, active) 
                 VALUES ($1, $2, $3, $4, $5) 
                 ON CONFLICT DO NOTHING
                 RETURNING id, name`,
                [cls.name, teacherId, cls.schedule, cls.color, true]
            );
            if (result.rows.length > 0) {
                classIds[cls.name] = result.rows[0].id;
                console.log(`✅ Created class: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
            } else {
                // If ON CONFLICT occurred, try to fetch existing
                const existing = await client.query(
                    'SELECT id FROM classes WHERE name = $1 AND active = true',
                    [cls.name]
                );
                if (existing.rows.length > 0) {
                    classIds[cls.name] = existing.rows[0].id;
                    console.log(`⚠️  Class ${cls.name} already exists (ID: ${existing.rows[0].id})`);
                }
            }
        }
        
        // Create 12 Japanese students distributed across classes
        const students = [
            // Elementary A (4 students)
            { 
                name: 'Sakura Tanaka', 
                parent: 'Yuki Tanaka', 
                phone: '090-1234-5678', 
                parentPhone: '090-1234-5679',
                email: 'sakura.tanaka@example.jp', 
                parentEmail: 'yuki.tanaka@example.jp',
                class: 'Elementary A'
            },
            { 
                name: 'Haruto Yamamoto', 
                parent: 'Kenji Yamamoto', 
                phone: '090-2345-6789', 
                parentPhone: '090-2345-6790',
                email: 'haruto.yamamoto@example.jp', 
                parentEmail: 'kenji.yamamoto@example.jp',
                class: 'Elementary A'
            },
            { 
                name: 'Yui Nakamura', 
                parent: 'Akiko Nakamura', 
                phone: '090-3456-7890', 
                parentPhone: '090-3456-7891',
                email: 'yui.nakamura@example.jp', 
                parentEmail: 'akiko.nakamura@example.jp',
                class: 'Elementary A'
            },
            { 
                name: 'Ren Kobayashi', 
                parent: 'Takeshi Kobayashi', 
                phone: '090-4567-8901', 
                parentPhone: '090-4567-8902',
                email: 'ren.kobayashi@example.jp', 
                parentEmail: 'takeshi.kobayashi@example.jp',
                class: 'Elementary A'
            },
            
            // Elementary B (4 students)
            { 
                name: 'Aoi Suzuki', 
                parent: 'Hiroshi Suzuki', 
                phone: '090-5678-9012', 
                parentPhone: '090-5678-9013',
                email: 'aoi.suzuki@example.jp', 
                parentEmail: 'hiroshi.suzuki@example.jp',
                class: 'Elementary B'
            },
            { 
                name: 'Kaito Watanabe', 
                parent: 'Miyuki Watanabe', 
                phone: '090-6789-0123', 
                parentPhone: '090-6789-0124',
                email: 'kaito.watanabe@example.jp', 
                parentEmail: 'miyuki.watanabe@example.jp',
                class: 'Elementary B'
            },
            { 
                name: 'Hina Ito', 
                parent: 'Naoki Ito', 
                phone: '090-7890-1234', 
                parentPhone: '090-7890-1235',
                email: 'hina.ito@example.jp', 
                parentEmail: 'naoki.ito@example.jp',
                class: 'Elementary B'
            },
            { 
                name: 'Sora Saito', 
                parent: 'Eri Saito', 
                phone: '090-8901-2345', 
                parentPhone: '090-8901-2346',
                email: 'sora.saito@example.jp', 
                parentEmail: 'eri.saito@example.jp',
                class: 'Elementary B'
            },
            
            // Intermediate (4 students)
            { 
                name: 'Ayaka Takahashi', 
                parent: 'Satoshi Takahashi', 
                phone: '090-9012-3456', 
                parentPhone: '090-9012-3457',
                email: 'ayaka.takahashi@example.jp', 
                parentEmail: 'satoshi.takahashi@example.jp',
                class: 'Intermediate'
            },
            { 
                name: 'Daiki Matsumoto', 
                parent: 'Chie Matsumoto', 
                phone: '090-0123-4567', 
                parentPhone: '090-0123-4568',
                email: 'daiki.matsumoto@example.jp', 
                parentEmail: 'chie.matsumoto@example.jp',
                class: 'Intermediate'
            },
            { 
                name: 'Mio Inoue', 
                parent: 'Kazuo Inoue', 
                phone: '090-1111-2222', 
                parentPhone: '090-1111-2223',
                email: 'mio.inoue@example.jp', 
                parentEmail: 'kazuo.inoue@example.jp',
                class: 'Intermediate'
            },
            { 
                name: 'Riku Kimura', 
                parent: 'Mai Kimura', 
                phone: '090-3333-4444', 
                parentPhone: '090-3333-4445',
                email: 'riku.kimura@example.jp', 
                parentEmail: 'mai.kimura@example.jp',
                class: 'Intermediate'
            }
        ];
        
        const studentIds = {};
        for (const student of students) {
            const classId = classIds[student.class];
            if (!classId) {
                console.warn(`⚠️  Class ${student.class} not found, skipping student ${student.name}`);
                continue;
            }
            
            const result = await client.query(
                `INSERT INTO students (name, class_id, email, phone, parent_name, parent_phone, parent_email, notes, active) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT DO NOTHING
                 RETURNING id, name`,
                [
                    student.name, 
                    classId, 
                    student.email, 
                    student.phone, 
                    student.parent, 
                    student.parentPhone, 
                    student.parentEmail, 
                    '',
                    true
                ]
            );
            if (result.rows.length > 0) {
                studentIds[student.name] = { id: result.rows[0].id, classId: classId, className: student.class };
                console.log(`✅ Created student: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
            }
        }
        
        // Create sample attendance records for the past 2 weeks (10 weekdays)
        const today = new Date();
        let attendanceCount = 0;
        
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // Skip weekends
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            
            const dateStr = date.toISOString().split('T')[0];
            
            // Create attendance for each class based on schedule
            // Mon/Wed: Elementary A
            // Tue/Thu: Elementary B
            // Fri: Intermediate
            let targetClass = null;
            if (dayOfWeek === 1 || dayOfWeek === 3) { // Mon/Wed
                targetClass = 'Elementary A';
            } else if (dayOfWeek === 2 || dayOfWeek === 4) { // Tue/Thu
                targetClass = 'Elementary B';
            } else if (dayOfWeek === 5) { // Fri
                targetClass = 'Intermediate';
            }
            
            if (!targetClass) continue;
            
            const classId = classIds[targetClass];
            if (!classId) continue;
            
            // Get students in this class
            const studentsInClass = Object.values(studentIds).filter(s => s.className === targetClass);
            
            // Create attendance records for each student (85% attendance rate)
            for (const student of studentsInClass) {
                const isPresent = Math.random() > 0.15; // 15% absence rate
                await client.query(
                    `INSERT INTO attendance (student_id, class_id, date, status, notes, teacher_id) 
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (student_id, class_id, date) DO NOTHING`,
                    [student.id, classId, dateStr, isPresent ? 'O' : 'X', '', teacherId]
                );
                attendanceCount++;
            }
        }
        console.log(`✅ Created ${attendanceCount} attendance records`);
        
        // Create sample teacher comment sheets for the past 2 weeks
        let commentSheetCount = 0;
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            
            const dateStr = date.toISOString().split('T')[0];
            
            let targetClass = null;
            if (dayOfWeek === 1 || dayOfWeek === 3) {
                targetClass = 'Elementary A';
            } else if (dayOfWeek === 2 || dayOfWeek === 4) {
                targetClass = 'Elementary B';
            } else if (dayOfWeek === 5) {
                targetClass = 'Intermediate';
            }
            
            if (!targetClass) continue;
            
            const classId = classIds[targetClass];
            if (!classId) continue;
            
            // Sample topics and comments
            const topics = [
                'Colors and Shapes',
                'Numbers 1-20',
                'Family Members',
                'Daily Routines',
                'Food and Drinks',
                'Weather and Seasons',
                'Animals and Pets',
                'School Subjects'
            ];
            
            const topic = topics[i % topics.length];
            
            await client.query(
                `INSERT INTO teacher_comment_sheets (class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (class_id, date) DO NOTHING`,
                [
                    classId,
                    teacherId,
                    dateStr,
                    topic,
                    `New words: ${topic.toLowerCase()} related vocabulary`,
                    'Some pronunciation issues with "th" sounds',
                    'Good participation and enthusiasm',
                    `Students engaged well with ${topic} lesson. Need more practice with pronunciation.`
                ]
            );
            commentSheetCount++;
        }
        console.log(`✅ Created ${commentSheetCount} teacher comment sheets`);
        
        // Create sample makeup lessons
        const studentList = Object.entries(studentIds);
        if (studentList.length >= 2) {
            // Create 2 sample makeup lessons
            const futureDate1 = new Date(today);
            futureDate1.setDate(futureDate1.getDate() + 7);
            const futureDate1Str = futureDate1.toISOString().split('T')[0];
            
            const futureDate2 = new Date(today);
            futureDate2.setDate(futureDate2.getDate() + 14);
            const futureDate2Str = futureDate2.toISOString().split('T')[0];
            
            const [name1, student1] = studentList[0];
            const [name2, student2] = studentList[1];
            
            await client.query(
                `INSERT INTO makeup_lessons (student_id, class_id, scheduled_date, scheduled_time, reason, status, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT DO NOTHING`,
                [
                    student1.id,
                    student1.classId,
                    futureDate1Str,
                    '15:00',
                    'Missed class due to illness',
                    'scheduled',
                    'Parent confirmed availability'
                ]
            );
            
            await client.query(
                `INSERT INTO makeup_lessons (student_id, class_id, scheduled_date, scheduled_time, reason, status, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT DO NOTHING`,
                [
                    student2.id,
                    student2.classId,
                    futureDate2Str,
                    '16:00',
                    'Family vacation',
                    'scheduled',
                    'Rescheduled for next week'
                ]
            );
            
            console.log('✅ Created 2 makeup lessons');
        }
        
        await client.query('COMMIT');
        console.log('🎉 School data seed completed successfully!');
        
        return { success: true };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding school data:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { seedSchoolData };
