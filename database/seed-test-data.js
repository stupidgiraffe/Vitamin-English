const pool = require('./init');

// Constants for seed data configuration
const ATTENDANCE_ABSENCE_RATE = 0.15; // 15% absence rate (85% attendance)

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
        
        // Create 4 classes with requested names
        const classes = [
            { name: 'Adult beginner', schedule: 'Mon/Wed 10:00-11:30', color: '#4285f4' },
            { name: 'Intermediate', schedule: 'Tue/Thu 14:00-15:30', color: '#34a853' },
            { name: 'Advanced', schedule: 'Fri 11:00-13:00', color: '#ea4335' },
            { name: 'Young elementary', schedule: 'Sat 09:00-10:00', color: '#fbbc04' }
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
        
        // Create students with realistic English names (minimum 4, distributed across classes)
        const students = [
            // Adult beginner class
            { name: 'Emma Wilson', parent: 'Robert Wilson', phone: '555-0101', email: 'emma.wilson@example.com', classIdx: 0 },
            { name: 'James Anderson', parent: 'Mary Anderson', phone: '555-0102', email: 'james.anderson@example.com', classIdx: 0 },
            { name: 'Sophia Martinez', parent: 'Carlos Martinez', phone: '555-0103', email: 'sophia.martinez@example.com', classIdx: 0 },
            
            // Intermediate class
            { name: 'Oliver Taylor', parent: 'Jennifer Taylor', phone: '555-0201', email: 'oliver.taylor@example.com', classIdx: 1 },
            { name: 'Charlotte Brown', parent: 'David Brown', phone: '555-0202', email: 'charlotte.brown@example.com', classIdx: 1 },
            { name: 'Liam Johnson', parent: 'Sarah Johnson', phone: '555-0203', email: 'liam.johnson@example.com', classIdx: 1 },
            
            // Advanced class
            { name: 'Ava Davis', parent: 'Michael Davis', phone: '555-0301', email: 'ava.davis@example.com', classIdx: 2 },
            { name: 'Noah Garcia', parent: 'Patricia Garcia', phone: '555-0302', email: 'noah.garcia@example.com', classIdx: 2 },
            { name: 'Isabella Rodriguez', parent: 'Jose Rodriguez', phone: '555-0303', email: 'isabella.rodriguez@example.com', classIdx: 2 },
            
            // Young elementary class
            { name: 'Ethan Smith', parent: 'Linda Smith', phone: '555-0401', email: 'ethan.smith@example.com', classIdx: 3 },
            { name: 'Mia Lee', parent: 'Kevin Lee', phone: '555-0402', email: 'mia.lee@example.com', classIdx: 3 },
            { name: 'Lucas White', parent: 'Nancy White', phone: '555-0403', email: 'lucas.white@example.com', classIdx: 3 }
        ];
        
        const studentIds = [];
        for (const student of students) {
            const classId = classIds[student.classIdx];
            const result = await client.query(
                `INSERT INTO students (name, class_id, parent_name, parent_contact, parent_email, notes, active) 
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
                const isPresent = Math.random() > ATTENDANCE_ABSENCE_RATE;
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
