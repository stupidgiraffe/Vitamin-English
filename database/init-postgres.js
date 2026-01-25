const bcrypt = require('bcrypt');
const pool = require('./connection');

async function initializeDatabase() {
    try {
        console.log('🔍 Checking database initialization status...');
        
        // Check if users exist
        const result = await pool.query('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(result.rows[0].count);
        
        if (userCount > 0) {
            console.log(`✅ Database already initialized (${userCount} users found)`);
            return;
        }
        
        console.log('🔄 Initializing database with default users...');
        
        // Create admin user (username: admin, password: admin123)
        const adminHash = await bcrypt.hash('admin123', 10);
        await pool.query(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
            ['admin', adminHash, 'Admin User', 'admin']
        );
        console.log('✅ Admin user created (username: admin, password: admin123)');
        
        // Create teacher user (username: sarah, password: teacher123)
        const teacherHash = await bcrypt.hash('teacher123', 10);
        await pool.query(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
            ['sarah', teacherHash, 'Sarah Johnson', 'teacher']
        );
        console.log('✅ Teacher user created (username: sarah, password: teacher123)');
        
        console.log('✅ Database initialization complete!');
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        // Don't throw - let app continue even if init fails
    }
}

module.exports = { initializeDatabase };
