const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'school.db');
const db = new Database(dbPath);

// Initialize database with schema
const initDatabase = () => {
    try {
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        db.exec(schema);
        console.log('✅ Database schema initialized successfully');
    } catch (error) {
        console.error('❌ Database schema initialization failed:', error);
        throw error;
    }
};

// CRITICAL: Add sample data - MUST RUN ON FIRST START
const addSampleData = () => {
    try {
        // Check if data already exists
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
        if (userCount.count > 0) {
            console.log('ℹ️  Sample data already exists, skipping initialization');
            return;
        }

        console.log('🔄 Creating sample data...');

        // Add admin user (username: admin, password: admin123)
        const adminHash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
            'admin', adminHash, 'Admin User', 'admin'
        );
        console.log('✅ Admin user created');

        // Add teacher: sarah (password: teacher123)
        const teacherHash = bcrypt.hashSync('teacher123', 10);
        const teacher1 = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
            'sarah', teacherHash, 'Sarah Johnson', 'teacher'
        );
        
        // Add teacher: mike (password: teacher123)
        const teacher2 = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
            'mike', teacherHash, 'Mike Chen', 'teacher'
        );
        console.log('✅ Teachers created');

        // Add 3 classes
        const class1 = db.prepare('INSERT INTO classes (name, teacher_id, schedule, color) VALUES (?, ?, ?, ?)').run(
            'Beginner A', teacher1.lastInsertRowid, 'Mon/Wed 10:00-11:30', '#4A90E2'
        );
        const class2 = db.prepare('INSERT INTO classes (name, teacher_id, schedule, color) VALUES (?, ?, ?, ?)').run(
            'Intermediate B', teacher2.lastInsertRowid, 'Tue/Thu 14:00-15:30', '#E94B3C'
        );
        const class3 = db.prepare('INSERT INTO classes (name, teacher_id, schedule, color) VALUES (?, ?, ?, ?)').run(
            'Advanced C', teacher1.lastInsertRowid, 'Wed/Fri 16:00-17:30', '#6BCF7A'
        );
        console.log('✅ Classes created');

        // Add regular students for Class 1 (Beginner A)
        const regularStudents1 = [
            'Emma Wilson', 'Liam Brown', 'Olivia Davis', 'Noah Martinez',
            'Ava Anderson', 'Sophia Taylor', 'Isabella Moore', 'Mia Jackson'
        ];
        
        regularStudents1.forEach(name => {
            db.prepare('INSERT INTO students (name, class_id, student_type, color_code) VALUES (?, ?, ?, ?)').run(
                name, class1.lastInsertRowid, 'regular', name.includes('Emma') || name.includes('Liam') ? 'yellow' : ''
            );
        });

        // Add trial/make-up students for Class 1
        const trialStudents1 = ['Trial Student A', 'Trial Student B', 'Makeup Student C'];
        trialStudents1.forEach(name => {
            db.prepare('INSERT INTO students (name, class_id, student_type, color_code) VALUES (?, ?, ?, ?)').run(
                name, class1.lastInsertRowid, 'trial', 'blue'
            );
        });

        // Add regular students for Class 2 (Intermediate B)
        const regularStudents2 = [
            'James Wilson', 'Charlotte Lee', 'Benjamin Harris', 'Amelia Clark',
            'Lucas Lewis', 'Harper Walker', 'Henry Hall', 'Evelyn Allen'
        ];
        
        regularStudents2.forEach(name => {
            db.prepare('INSERT INTO students (name, class_id, student_type, color_code) VALUES (?, ?, ?, ?)').run(
                name, class2.lastInsertRowid, 'regular', ''
            );
        });

        // Add regular students for Class 3 (Advanced C)
        const regularStudents3 = [
            'Alexander Young', 'Abigail King', 'Daniel Wright', 'Emily Lopez',
            'Matthew Hill', 'Elizabeth Scott', 'Joseph Green', 'Sofia Adams'
        ];
        
        regularStudents3.forEach(name => {
            db.prepare('INSERT INTO students (name, class_id, student_type, color_code) VALUES (?, ?, ?, ?)').run(
                name, class3.lastInsertRowid, 'regular', ''
            );
        });
        
        console.log('✅ Students created');

        // Add sample attendance for the past 7 days
        const today = new Date();
        const dates = [];
        for (let i = 7; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }

        const students = db.prepare('SELECT id, class_id FROM students WHERE student_type = "regular"').all();
        const statuses = ['O', 'O', 'O', 'X', '/'];
        
        students.forEach(student => {
            dates.forEach(date => {
                const status = statuses[Math.floor(Math.random() * statuses.length)];
                db.prepare('INSERT INTO attendance (student_id, class_id, date, status) VALUES (?, ?, ?, ?)').run(
                    student.id, student.class_id, date, status
                );
            });
        });
        
        console.log('✅ Attendance records created');

        // Add sample lesson reports
        dates.slice(0, 3).forEach(date => {
            db.prepare(`
                INSERT INTO lesson_reports (class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                class1.lastInsertRowid,
                teacher1.lastInsertRowid,
                date,
                'Introduction to English',
                'hello, goodbye, thank you',
                'pronunciation of "th"',
                'good listening skills',
                'Students are progressing well'
            );
        });
        
        console.log('✅ Lesson reports created');
        console.log('✅✅✅ ALL SAMPLE DATA CREATED SUCCESSFULLY ✅✅✅');
        
    } catch (error) {
        console.error('❌❌❌ CRITICAL ERROR creating sample data:', error);
        throw error;
    }
};

// CRITICAL: Initialize database and add sample data on module load
try {
    initDatabase();
    addSampleData();
} catch (error) {
    console.error('❌ FATAL: Database initialization failed:', error);
    process.exit(1);
}

module.exports = db;
