const pool = require('./init');

async function seedTestData() {
    try {
        console.log('🌱 Seeding test data...');
        
        // Check if data already exists
        const classCheck = await pool.query('SELECT COUNT(*) FROM classes WHERE active = true');
        if (parseInt(classCheck.rows[0].count) > 0) {
            console.log('⚠️  Data already exists, skipping seed');
            return;
        }
        
        // Get teacher ID (use any admin or teacher user)
        const teacherResult = await pool.query('SELECT id FROM users WHERE role IN (\'admin\', \'teacher\') ORDER BY id LIMIT 1');
        const teacherId = teacherResult.rows[0]?.id;
        
        if (!teacherId) {
            console.log('⚠️  No admin or teacher user found, skipping seed');
            return;
        }
        
        // Create 3 test classes
        const classes = [
            { name: 'Beginners Monday/Wednesday', schedule: 'Mon/Wed 10:00-11:30', color: '#4285f4' },
            { name: 'Intermediate Tuesday/Thursday', schedule: 'Tue/Thu 14:00-15:30', color: '#34a853' },
            { name: 'Advanced Friday', schedule: 'Fri 11:00-13:00', color: '#ea4335' }
        ];
        
        const createdClasses = [];
        for (const cls of classes) {
            const result = await pool.query(
                'INSERT INTO classes (name, teacher_id, schedule, color, active) VALUES ($1, $2, $3, $4, true) RETURNING *',
                [cls.name, teacherId, cls.schedule, cls.color]
            );
            createdClasses.push(result.rows[0]);
            console.log(`✅ Created class: ${cls.name}`);
        }
        
        // Create 12 test students
        const studentNames = [
            'Emma Wilson', 'Liam Chen', 'Olivia Garcia', 'Noah Kim',
            'Ava Martinez', 'Ethan Patel', 'Sophia Lee', 'Mason Rodriguez',
            'Isabella Nguyen', 'Lucas Anderson', 'Mia Thompson', 'James Taylor'
        ];
        
        for (let i = 0; i < studentNames.length; i++) {
            const classId = createdClasses[i % createdClasses.length].id;
            await pool.query(
                'INSERT INTO students (name, class_id, parent_name, parent_phone, active) VALUES ($1, $2, $3, $4, true)',
                [studentNames[i], classId, `Parent of ${studentNames[i].split(' ')[0]}`, `555-010${i.toString().padStart(2, '0')}`]
            );
        }
        console.log(`✅ Created ${studentNames.length} students`);
        
        console.log('🎉 Test data seeded successfully!');
        
    } catch (error) {
        console.error('❌ Error seeding test data:', error);
    }
}

module.exports = { seedTestData };
