#!/usr/bin/env node

/**
 * SQLite to PostgreSQL Migration Script
 * 
 * This script exports data from Railway's SQLite database and generates
 * PostgreSQL-compatible SQL statements for import into Neon.
 * 
 * Usage:
 * 1. Run this script on Railway to export data:
 *    node scripts/migrate-to-neon.js
 * 
 * 2. Download the generated migration.sql file
 * 
 * 3. Connect to your Neon database and run:
 *    psql DATABASE_URL < migration.sql
 * 
 * OR use the Neon SQL Editor to paste and execute the SQL
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'school.db');
const outputPath = path.join(__dirname, '..', 'migration.sql');

// Check if SQLite database exists
if (!fs.existsSync(dbPath)) {
    console.error('❌ Error: SQLite database not found at:', dbPath);
    console.error('   Make sure you are running this script on Railway where the SQLite database exists.');
    process.exit(1);
}

console.log('📊 Starting SQLite to PostgreSQL migration...');
console.log(`   Source: ${dbPath}`);
console.log(`   Output: ${outputPath}`);

const db = new Database(dbPath, { readonly: true });
let sql = '';

// Helper function to escape strings for SQL
function escapeSql(value) {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    // Escape single quotes by doubling them
    return `'${String(value).replace(/'/g, "''")}'`;
}

// Add header
sql += '-- Vitamin English - SQLite to PostgreSQL Migration\n';
sql += `-- Generated: ${new Date().toISOString()}\n`;
sql += '-- This file contains data exported from Railway SQLite\n\n';

sql += '-- Disable triggers during import\n';
sql += 'SET session_replication_role = replica;\n\n';

try {
    // Export users
    console.log('📤 Exporting users...');
    const users = db.prepare('SELECT * FROM users ORDER BY id').all();
    if (users.length > 0) {
        sql += '-- Users\n';
        sql += 'INSERT INTO users (id, username, password_hash, full_name, role, created_at) VALUES\n';
        sql += users.map(user => 
            `(${user.id}, ${escapeSql(user.username)}, ${escapeSql(user.password_hash)}, ${escapeSql(user.full_name)}, ${escapeSql(user.role)}, ${escapeSql(user.created_at)})`
        ).join(',\n');
        sql += ';\n\n';
        
        // Update sequence
        sql += `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));\n\n`;
    }
    console.log(`   ✅ Exported ${users.length} users`);

    // Export classes
    console.log('📤 Exporting classes...');
    const classes = db.prepare('SELECT * FROM classes ORDER BY id').all();
    if (classes.length > 0) {
        sql += '-- Classes\n';
        sql += 'INSERT INTO classes (id, name, teacher_id, schedule, color, active, created_at) VALUES\n';
        sql += classes.map(cls => 
            `(${cls.id}, ${escapeSql(cls.name)}, ${cls.teacher_id || 'NULL'}, ${escapeSql(cls.schedule)}, ${escapeSql(cls.color)}, ${cls.active === 1 ? 'true' : 'false'}, ${escapeSql(cls.created_at)})`
        ).join(',\n');
        sql += ';\n\n';
        
        // Update sequence
        sql += `SELECT setval('classes_id_seq', (SELECT MAX(id) FROM classes));\n\n`;
    }
    console.log(`   ✅ Exported ${classes.length} classes`);

    // Export students
    console.log('📤 Exporting students...');
    const students = db.prepare('SELECT * FROM students ORDER BY id').all();
    if (students.length > 0) {
        sql += '-- Students\n';
        sql += 'INSERT INTO students (id, name, class_id, student_type, color_code, active, notes, email, phone, parent_name, parent_phone, parent_email, enrollment_date, created_at) VALUES\n';
        sql += students.map(student => 
            `(${student.id}, ${escapeSql(student.name)}, ${student.class_id || 'NULL'}, ${escapeSql(student.student_type)}, ${escapeSql(student.color_code)}, ${student.active === 1 ? 'true' : 'false'}, ${escapeSql(student.notes)}, ${escapeSql(student.email)}, ${escapeSql(student.phone)}, ${escapeSql(student.parent_name)}, ${escapeSql(student.parent_phone)}, ${escapeSql(student.parent_email)}, ${escapeSql(student.enrollment_date)}, ${escapeSql(student.created_at)})`
        ).join(',\n');
        sql += ';\n\n';
        
        // Update sequence
        sql += `SELECT setval('students_id_seq', (SELECT MAX(id) FROM students));\n\n`;
    }
    console.log(`   ✅ Exported ${students.length} students`);

    // Export attendance
    console.log('📤 Exporting attendance...');
    const attendance = db.prepare('SELECT * FROM attendance ORDER BY id').all();
    if (attendance.length > 0) {
        sql += '-- Attendance\n';
        // Process in chunks to avoid huge SQL statements
        const chunkSize = 500;
        for (let i = 0; i < attendance.length; i += chunkSize) {
            const chunk = attendance.slice(i, i + chunkSize);
            sql += 'INSERT INTO attendance (id, student_id, class_id, date, status, notes, created_at) VALUES\n';
            sql += chunk.map(att => 
                `(${att.id}, ${att.student_id}, ${att.class_id}, ${escapeSql(att.date)}, ${escapeSql(att.status)}, ${escapeSql(att.notes)}, ${escapeSql(att.created_at)})`
            ).join(',\n');
            sql += ';\n\n';
        }
        
        // Update sequence
        sql += `SELECT setval('attendance_id_seq', (SELECT MAX(id) FROM attendance));\n\n`;
    }
    console.log(`   ✅ Exported ${attendance.length} attendance records`);

    // Export lesson reports
    console.log('📤 Exporting lesson reports...');
    const reports = db.prepare('SELECT * FROM lesson_reports ORDER BY id').all();
    if (reports.length > 0) {
        sql += '-- Lesson Reports\n';
        sql += 'INSERT INTO lesson_reports (id, class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments, created_at) VALUES\n';
        sql += reports.map(report => 
            `(${report.id}, ${report.class_id}, ${report.teacher_id}, ${escapeSql(report.date)}, ${escapeSql(report.target_topic)}, ${escapeSql(report.vocabulary)}, ${escapeSql(report.mistakes)}, ${escapeSql(report.strengths)}, ${escapeSql(report.comments)}, ${escapeSql(report.created_at)})`
        ).join(',\n');
        sql += ';\n\n';
        
        // Update sequence
        sql += `SELECT setval('lesson_reports_id_seq', (SELECT MAX(id) FROM lesson_reports));\n\n`;
    }
    console.log(`   ✅ Exported ${reports.length} lesson reports`);

    // Export makeup lessons (if table exists)
    try {
        const makeupLessons = db.prepare('SELECT * FROM makeup_lessons ORDER BY id').all();
        if (makeupLessons.length > 0) {
            console.log('📤 Exporting makeup lessons...');
            sql += '-- Makeup Lessons\n';
            sql += 'INSERT INTO makeup_lessons (id, student_id, class_id, scheduled_date, scheduled_time, reason, status, notes, created_at) VALUES\n';
            sql += makeupLessons.map(lesson => 
                `(${lesson.id}, ${lesson.student_id}, ${lesson.class_id}, ${escapeSql(lesson.scheduled_date)}, ${escapeSql(lesson.scheduled_time)}, ${escapeSql(lesson.reason)}, ${escapeSql(lesson.status)}, ${escapeSql(lesson.notes)}, ${escapeSql(lesson.created_at)})`
            ).join(',\n');
            sql += ';\n\n';
            
            // Update sequence
            sql += `SELECT setval('makeup_lessons_id_seq', (SELECT MAX(id) FROM makeup_lessons));\n\n`;
            console.log(`   ✅ Exported ${makeupLessons.length} makeup lessons`);
        }
    } catch (e) {
        console.log('   ⚠️  Makeup lessons table not found, skipping...');
    }

    // Re-enable triggers
    sql += '-- Re-enable triggers\n';
    sql += 'SET session_replication_role = DEFAULT;\n\n';

    // Add completion message
    sql += '-- Migration complete!\n';
    sql += `-- Total records exported:\n`;
    sql += `--   Users: ${users.length}\n`;
    sql += `--   Classes: ${classes.length}\n`;
    sql += `--   Students: ${students.length}\n`;
    sql += `--   Attendance: ${attendance.length}\n`;
    sql += `--   Lesson Reports: ${reports.length}\n`;

    // Write to file
    fs.writeFileSync(outputPath, sql, 'utf8');
    
    console.log('\n✅ Migration SQL generated successfully!');
    console.log(`   File: ${outputPath}`);
    console.log('\n📋 Next steps:');
    console.log('   1. Download migration.sql from Railway');
    console.log('   2. Connect to your Neon PostgreSQL database');
    console.log('   3. Run: psql DATABASE_URL < migration.sql');
    console.log('   4. OR use Neon SQL Editor to paste and execute the SQL');
    console.log('\n🎉 Done!');

} catch (error) {
    console.error('❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
} finally {
    db.close();
}
