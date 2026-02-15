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
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING id, name`,
                [cls.name, teacherId, cls.schedule, cls.color, true]
            );
            classIds.push(result.rows[0].id);
            console.log(`✅ Created class: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
        }
        
        // Create 4 students with realistic contact info (one per class as specified)
        const students = [
            // Adult beginner class
            { 
                name: 'Emma Wilson', 
                parent: 'Robert Wilson', 
                phone: '555-0101', 
                parentPhone: '555-0111',
                email: 'emma.wilson@example.com', 
                parentEmail: 'robert.wilson@example.com',
                classIdx: 0 
            },
            
            // Intermediate class
            { 
                name: 'Oliver Taylor', 
                parent: 'Jennifer Taylor', 
                phone: '555-0201', 
                parentPhone: '555-0211',
                email: 'oliver.taylor@example.com', 
                parentEmail: 'jennifer.taylor@example.com',
                classIdx: 1 
            },
            
            // Advanced class
            { 
                name: 'Ava Davis', 
                parent: 'Michael Davis', 
                phone: '555-0301', 
                parentPhone: '555-0311',
                email: 'ava.davis@example.com', 
                parentEmail: 'michael.davis@example.com',
                classIdx: 2 
            },
            
            // Young elementary class
            { 
                name: 'Ethan Smith', 
                parent: 'Linda Smith', 
                phone: '555-0401', 
                parentPhone: '555-0411',
                email: 'ethan.smith@example.com', 
                parentEmail: 'linda.smith@example.com',
                classIdx: 3 
            }
        ];
        
        const studentIds = [];
        for (const student of students) {
            const classId = classIds[student.classIdx];
            const result = await client.query(
                `INSERT INTO students (name, class_id, email, phone, parent_name, parent_phone, parent_email, notes, active) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
        
        // Delete in correct order to respect foreign key constraints
        await client.query('DELETE FROM pdf_history');
        await client.query('DELETE FROM monthly_report_weeks');
        await client.query('DELETE FROM monthly_reports');
        await client.query('DELETE FROM attendance');
        await client.query('DELETE FROM makeup_lessons');
        await client.query('DELETE FROM teacher_comment_sheets');
        await client.query('DELETE FROM students');
        await client.query('DELETE FROM classes');
        
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
