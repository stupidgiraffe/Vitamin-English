const bcrypt = require('bcrypt');
const pool = require('./connection');

// Default user credentials
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_TEACHER_PASSWORD = 'teacher123';

async function initializeDatabase() {
    try {
        console.log('🔍 Checking database initialization status...');
        
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
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        console.error('   Stack trace:', error.stack);
        // Don't throw - let app continue even if init fails
    }
}

module.exports = { initializeDatabase };
