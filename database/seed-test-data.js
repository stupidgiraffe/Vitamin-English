const pool = require('./init');

async function seedTestData() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🌱 Starting test data seed...');
        
        // Check if data already exists
        const existingClasses = await client.query('SELECT COUNT(*) FROM classes WHERE active = true');
        if (parseInt(existingClasses.rows[0].count) > 0) {
            console.log('⚠️  Test data already exists, skipping seed');
            await client.query('ROLLBACK');
            return { success: true, message: 'Data already exists' };
        }
        
        // Get teacher ID (use Sarah or first available user)
        const teacherResult = await client.query(
            `SELECT id FROM users WHERE role = 'teacher' OR role = 'admin' ORDER BY id LIMIT 1`
        );
        const teacherId = teacherResult.rows[0]?.id;
        
        if (!teacherId) {
            throw new Error('No teacher or admin user found. Please create a user first.');
        }
        
        // Create 3 classes with Japanese names
        const classes = [
            { name: '初級クラス (Beginners)', schedule: 'Mon/Wed 10:00-11:30', color: '#4285f4' },
            { name: '中級クラス (Intermediate)', schedule: 'Tue/Thu 14:00-15:30', color: '#34a853' },
            { name: '上級クラス (Advanced)', schedule: 'Fri 11:00-13:00', color: '#ea4335' }
        ];
        
        const createdClasses = [];
        for (const cls of classes) {
            const result = await client.query(
                `INSERT INTO classes (name, teacher_id, schedule, color, active) 
                 VALUES ($1, $2, $3, $4, true) 
                 RETURNING *`,
                [cls.name, teacherId, cls.schedule, cls.color]
            );
            createdClasses.push(result.rows[0]);
            console.log(`✅ Created class: ${cls.name}`);
        }
        
        // Create 12 students with Japanese names and realistic info
        const students = [
            { name: '田中 花子', reading: 'Tanaka Hanako', parent: '田中 太郎', phone: '090-1234-5678', email: 'tanaka@example.jp' },
            { name: '佐藤 太郎', reading: 'Sato Taro', parent: '佐藤 美咲', phone: '090-2345-6789', email: 'sato@example.jp' },
            { name: '鈴木 美咲', reading: 'Suzuki Misaki', parent: '鈴木 健太', phone: '090-3456-7890', email: 'suzuki@example.jp' },
            { name: '高橋 健太', reading: 'Takahashi Kenta', parent: '高橋 愛美', phone: '090-4567-8901', email: 'takahashi@example.jp' },
            { name: '伊藤 愛美', reading: 'Ito Aimi', parent: '伊藤 大輔', phone: '090-5678-9012', email: 'ito@example.jp' },
            { name: '渡辺 大輔', reading: 'Watanabe Daisuke', parent: '渡辺 さくら', phone: '090-6789-0123', email: 'watanabe@example.jp' },
            { name: '山本 さくら', reading: 'Yamamoto Sakura', parent: '山本 翔太', phone: '090-7890-1234', email: 'yamamoto@example.jp' },
            { name: '中村 翔太', reading: 'Nakamura Shota', parent: '中村 結衣', phone: '090-8901-2345', email: 'nakamura@example.jp' },
            { name: '小林 結衣', reading: 'Kobayashi Yui', parent: '小林 翼', phone: '090-9012-3456', email: 'kobayashi@example.jp' },
            { name: '加藤 翼', reading: 'Kato Tsubasa', parent: '加藤 優花', phone: '090-0123-4567', email: 'kato@example.jp' },
            { name: '吉田 優花', reading: 'Yoshida Yuka', parent: '吉田 蓮', phone: '080-1234-5678', email: 'yoshida@example.jp' },
            { name: '山田 蓮', reading: 'Yamada Ren', parent: '山田 花子', phone: '080-2345-6789', email: 'yamada@example.jp' }
        ];
        
        // Distribute students across classes
        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const classId = createdClasses[i % createdClasses.length].id;
            
            await client.query(
                `INSERT INTO students (name, class_id, parent_name, parent_phone, parent_email, notes, active) 
                 VALUES ($1, $2, $3, $4, $5, $6, true)`,
                [
                    student.name,
                    classId,
                    student.parent,
                    student.phone,
                    student.email,
                    `Reading: ${student.reading}`
                ]
            );
        }
        console.log(`✅ Created ${students.length} students`);
        
        await client.query('COMMIT');
        console.log('🎉 Test data seed completed successfully!');
        
        return { 
            success: true, 
            message: 'Test data created',
            stats: {
                classes: createdClasses.length,
                students: students.length
            }
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding test data:', error);
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
