const bcrypt = require('bcrypt');
const pool = require('./connection');
const fs = require('fs');
const path = require('path');
const { seedSchoolData } = require('./seed-school-data');

// Default user credentials
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_TEACHER_PASSWORD = 'teacher123';

/**
 * Create database schema from schema-postgres.sql
 * This ensures tables exist before trying to use them
 */
async function createSchemaIfNeeded() {
    try {
        // Check if users table exists (with retry for Neon cold-start wake-up)
        const tablesCheck = await pool.queryWithRetry(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'users'
        `);
        
        if (tablesCheck.rows.length > 0) {
            console.log('✅ Database schema already exists');
            return;
        }
        
        console.log('📋 Creating database schema from schema-postgres.sql...');
        
        // Read and execute schema file
        const schemaPath = path.join(__dirname, 'schema-postgres.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        await pool.query(schemaSql);
        console.log('✅ Database schema created successfully');
        
    } catch (error) {
        console.error('❌ Error creating schema:', error.message);
        throw error;
    }
}

async function initializeDatabase() {
    try {
        console.log('🔍 Checking database initialization status...');
        
        // First, ensure schema exists
        await createSchemaIfNeeded();
        
        // Check if users exist
        const result = await pool.query('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(result.rows[0].count);
        
        if (userCount > 0) {
            console.log(`✅ Database already initialized (${userCount} users found)`);
            
            // VERIFY admin user exists with correct password
            const adminCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
            if (adminCheck.rows.length > 0) {
                const adminUser = adminCheck.rows[0];
                const testPassword = bcrypt.compareSync(DEFAULT_ADMIN_PASSWORD, adminUser.password_hash);
                if (!testPassword) {
                    console.log('⚠️  Admin user found but password is incorrect - recreating...');
                    await pool.query('DELETE FROM users WHERE username = $1', ['admin']);
                    const adminHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
                    await pool.query(
                        'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
                        ['admin', adminHash, 'Admin User', 'admin']
                    );
                    console.log('✅ Admin user recreated with correct password');
                }
            } else {
                // If admin doesn't exist at all, create it
                console.log('⚠️  Admin user not found - creating...');
                const adminHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
                await pool.query(
                    'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
                    ['admin', adminHash, 'Admin User', 'admin']
                );
                console.log('✅ Admin user created');
            }
            
            // VERIFY teacher user exists with correct password
            const teacherCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['sarah']);
            if (teacherCheck.rows.length > 0) {
                const teacherUser = teacherCheck.rows[0];
                const testPassword = bcrypt.compareSync(DEFAULT_TEACHER_PASSWORD, teacherUser.password_hash);
                if (!testPassword) {
                    console.log('⚠️  Teacher user found but password is incorrect - recreating...');
                    await pool.query('DELETE FROM users WHERE username = $1', ['sarah']);
                    const teacherHash = await bcrypt.hash(DEFAULT_TEACHER_PASSWORD, 10);
                    await pool.query(
                        'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
                        ['sarah', teacherHash, 'Sarah Johnson', 'teacher']
                    );
                    console.log('✅ Teacher user recreated with correct password');
                }
            } else {
                // If teacher doesn't exist at all, create it
                console.log('⚠️  Teacher user not found - creating...');
                const teacherHash = await bcrypt.hash(DEFAULT_TEACHER_PASSWORD, 10);
                await pool.query(
                    'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
                    ['sarah', teacherHash, 'Sarah Johnson', 'teacher']
                );
                console.log('✅ Teacher user created');
            }
            
            // Check if school data needs to be seeded (check if core tables are empty)
            await seedSchoolDataIfNeeded();
            
            return;
        }
        
        console.log('🔄 Initializing database with default users...');
        
        // Create admin user (username: admin, password: admin123)
        const adminHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
        await pool.query(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
            ['admin', adminHash, 'Admin User', 'admin']
        );
        console.log('✅ Admin user created (username: admin, password: admin123)');
        console.log('⚠️  WARNING: Change admin password immediately after first login!');
        
        // Create teacher user (username: sarah, password: teacher123)
        const teacherHash = await bcrypt.hash(DEFAULT_TEACHER_PASSWORD, 10);
        await pool.query(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
            ['sarah', teacherHash, 'Sarah Johnson', 'teacher']
        );
        console.log('✅ Teacher user created (username: sarah, password: teacher123)');
        console.log('⚠️  WARNING: Change teacher password immediately after first login!');
        
        console.log('✅ Database initialization complete!');
        
        // After creating users, check if school data needs to be seeded
        await seedSchoolDataIfNeeded();
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        console.error('   Stack trace:', error.stack);
        // Don't throw - let app continue even if init fails
    }
}

/**
 * Check if core school data tables are empty and seed them if needed
 * This runs automatically unless SEED_ON_STARTUP is set to 'false'
 */
async function seedSchoolDataIfNeeded() {
    try {
        // Skip auto-seeding if SEED_ON_STARTUP is explicitly set to 'false'
        if (process.env.SEED_ON_STARTUP === 'false') {
            console.log('📊 Auto-seeding disabled by SEED_ON_STARTUP=false');
            return;
        }
        
        // Check if core tables (students, classes) are empty
        const studentsResult = await pool.query('SELECT COUNT(*) as count FROM students WHERE active = true');
        const classesResult = await pool.query('SELECT COUNT(*) as count FROM classes WHERE active = true');
        
        const studentCount = parseInt(studentsResult.rows[0].count);
        const classCount = parseInt(classesResult.rows[0].count);
        
        if (studentCount === 0 && classCount === 0) {
            console.log('📊 Core tables are empty, seeding school data...');
            await seedSchoolData();
            console.log('✅ School data seeded successfully');
        } else {
            console.log(`📊 Database has ${classCount} classes and ${studentCount} students, skipping school data seed`);
        }
    } catch (error) {
        console.error('❌ Failed to seed school data:', error);
        console.error('Stack trace:', error.stack);
        // Don't throw - let app continue even if seeding fails
    }
}

async function verifyDatabaseSchema() {
    try {
        console.log('🔍 Verifying database schema...');
        
        // Check students table can accept NULL values
        const studentSchema = await pool.query(`
            SELECT column_name, is_nullable, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'students'
            ORDER BY ordinal_position
        `);
        
        console.log('Students table schema:');
        console.table(studentSchema.rows);
        
        // Check classes table
        const classSchema = await pool.query(`
            SELECT column_name, is_nullable, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'classes'
            ORDER BY ordinal_position
        `);
        
        console.log('Classes table schema:');
        console.table(classSchema.rows);
        
        // Verify foreign key constraints
        const constraints = await pool.query(`
            SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
                   ccu.table_name AS foreign_table_name,
                   ccu.column_name AS foreign_column_name 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name IN ('students', 'classes', 'attendance')
        `);
        
        console.log('Foreign key constraints:');
        console.table(constraints.rows);
        
        console.log('✅ Schema verification complete');
        
    } catch (error) {
        console.error('❌ Schema verification failed:', error);
    }
}

module.exports = { initializeDatabase, verifyDatabaseSchema, createSchemaIfNeeded, seedSchoolDataIfNeeded };
