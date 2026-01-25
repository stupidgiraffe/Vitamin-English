const pool = require('./init');

async function seedTestData() {
    const client = await pool.connect();
    
    try {
        console.log('🌱 Starting test data seed...');
        await client.query('BEGIN');
        
        // Check if data already exists
        const existingClasses = await client.query('SELECT COUNT(*) FROM classes WHERE active = true');
        if (parseInt(existingClasses.rows[0].count) > 0) {
            console.log('⚠️  Test data already exists, skipping seed');
            await client.query('ROLLBACK');
            return { success: true, message: 'Data already exists' };
        }
        
        // Get first admin/teacher user
        const userResult = await client.query(
            `SELECT id FROM users WHERE role IN ('admin', 'teacher') ORDER BY id LIMIT 1`
        );
        
        if (userResult.rows.length === 0) {
            throw new Error('No admin or teacher user found. Cannot seed data.');
        }
        
        const teacherId = userResult.rows[0].id;
        console.log(`Using teacher ID: ${teacherId}`);
        
        // Create 3 classes
        const classes = [
            { name: '初級クラス (Beginners)', schedule: 'Mon/Wed 10:00-11:30', color: '#4285f4' },
            { name: '中級クラス (Intermediate)', schedule: 'Tue/Thu 14:00-15:30', color: '#34a853' },
            { name: '上級クラス (Advanced)', schedule: 'Fri 11:00-13:00', color: '#ea4335' }
        ];
        
        const classIds = [];
        for (const cls of classes) {
            const result = await client.query(
                `INSERT INTO classes (name, teacher_id, schedule, color, active) 
                 VALUES ($1, $2, $3, $4, true) 
                 RETURNING id, name`,
                [cls.name, teacherId, cls.schedule, cls.color]
            );
            classIds.push(result.rows[0].id);
            console.log(`✅ Created class: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
        }
        
        // Create 12 students
        const students = [
            { name: '田中 花子', parent: '田中 太郎', phone: '090-1234-5678', email: 'tanaka@example.jp', classIdx: 0 },
            { name: '佐藤 太郎', parent: '佐藤 美咲', phone: '090-2345-6789', email: 'sato@example.jp', classIdx: 0 },
            { name: '鈴木 美咲', parent: '鈴木 健太', phone: '090-3456-7890', email: 'suzuki@example.jp', classIdx: 0 },
            { name: '高橋 健太', parent: '高橋 愛美', phone: '090-4567-8901', email: 'takahashi@example.jp', classIdx: 0 },
            
            { name: '伊藤 愛美', parent: '伊藤 大輔', phone: '090-5678-9012', email: 'ito@example.jp', classIdx: 1 },
            { name: '渡辺 大輔', parent: '渡辺 さくら', phone: '090-6789-0123', email: 'watanabe@example.jp', classIdx: 1 },
            { name: '山本 さくら', parent: '山本 翔太', phone: '090-7890-1234', email: 'yamamoto@example.jp', classIdx: 1 },
            { name: '中村 翔太', parent: '中村 結衣', phone: '090-8901-2345', email: 'nakamura@example.jp', classIdx: 1 },
            
            { name: '小林 結衣', parent: '小林 翼', phone: '090-9012-3456', email: 'kobayashi@example.jp', classIdx: 2 },
            { name: '加藤 翼', parent: '加藤 優花', phone: '090-0123-4567', email: 'kato@example.jp', classIdx: 2 },
            { name: '吉田 優花', parent: '吉田 蓮', phone: '080-1234-5678', email: 'yoshida@example.jp', classIdx: 2 },
            { name: '山田 蓮', parent: '山田 花子', phone: '080-2345-6789', email: 'yamada@example.jp', classIdx: 2 }
        ];
        
        const studentIds = [];
        for (const student of students) {
            const classId = classIds[student.classIdx];
            const result = await client.query(
                `INSERT INTO students (name, class_id, parent_name, parent_phone, parent_email, notes, active) 
                 VALUES ($1, $2, $3, $4, $5, $6, true)
                 RETURNING id, name`,
                [student.name, classId, student.parent, student.phone, student.email, '']
            );
            studentIds.push({ id: result.rows[0].id, classIdx: student.classIdx });
            console.log(`✅ Created student: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
        }
        
        // Create sample attendance for past 3 days
        const today = new Date();
        for (let i = 0; i < 3; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const classIdx = i % classIds.length;
            const classId = classIds[classIdx];
            
            // Get students in this class
            const studentsInClass = studentIds.filter(s => s.classIdx === classIdx);
            
            // Create attendance records for each student
            for (const student of studentsInClass) {
                const isPresent = Math.random() > 0.15; // 85% attendance
                await client.query(
                    `INSERT INTO attendance (student_id, class_id, date, status, notes) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [student.id, classId, dateStr, isPresent ? 'O' : 'X', '']
                );
            }
            console.log(`✅ Created attendance record for ${dateStr} (${studentsInClass.length} students)`);
        }
        
        await client.query('COMMIT');
        console.log('🎉 Test data seed completed successfully!');
        
        return { success: true };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding test data:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    } finally {
        client.release();
    }
}

// Function to clear all data
async function clearAllData() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🗑️  Clearing all data...');
        
        await client.query('DELETE FROM attendance WHERE 1=1');
        await client.query('DELETE FROM students WHERE 1=1');
        await client.query('DELETE FROM classes WHERE 1=1');
        await client.query('DELETE FROM lesson_reports WHERE 1=1');
        await client.query('DELETE FROM makeup_lessons WHERE 1=1');
        
        await client.query('COMMIT');
        console.log('✅ All data cleared');
        
        return { success: true, message: 'All data cleared' };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error clearing data:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { seedTestData, clearAllData };
