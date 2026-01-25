const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../database/init');

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log(`🔐 Login attempt for username: ${username}`);
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        
        if (!user) {
            console.log(`❌ User not found: ${username}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log(`✅ User found: ${username} (ID: ${user.id}, Role: ${user.role})`);
        
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        
        if (!validPassword) {
            console.log(`❌ Password mismatch for user: ${username}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log(`✅ Login successful for user: ${username}`);
        
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.fullName = user.full_name;
        req.session.role = user.role;
        
        res.json({
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            role: user.role
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', (req, res) => {
    if (req.session.userId) {
        res.json({
            id: req.session.userId,
            username: req.session.username,
            fullName: req.session.fullName,
            role: req.session.role
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Change password
router.post('/change-password', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
        const user = result.rows[0];
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const validPassword = bcrypt.compareSync(currentPassword, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        const newPasswordHash = bcrypt.hashSync(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, req.session.userId]);
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// Change username
router.post('/change-username', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { newUsername, password } = req.body;
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
        const user = result.rows[0];
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Password is incorrect' });
        }
        
        // Check if username already exists
        const existingResult = await pool.query('SELECT * FROM users WHERE username = $1 AND id != $2', [newUsername, req.session.userId]);
        const existingUser = existingResult.rows[0];
        
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        await pool.query('UPDATE users SET username = $1 WHERE id = $2', [newUsername, req.session.userId]);
        
        // Update session
        req.session.username = newUsername;
        
        res.json({ message: 'Username updated successfully', username: newUsername });
    } catch (error) {
        console.error('Change username error:', error);
        res.status(500).json({ error: 'Failed to update username' });
    }
});

// Get all teachers (for admin)
router.get('/teachers', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    try {
        const result = await pool.query('SELECT id, username, full_name, role FROM users WHERE role = $1 ORDER BY full_name', ['teacher']);
        const teachers = result.rows;
        res.json(teachers);
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

// Get a single teacher by ID (admin only)
router.get('/teachers/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    try {
        const teacherId = parseInt(req.params.id, 10);
        if (isNaN(teacherId)) {
            return res.status(400).json({ error: 'Invalid teacher ID' });
        }
        
        const result = await pool.query('SELECT id, username, full_name, role FROM users WHERE id = $1 AND role = $2', [teacherId, 'teacher']);
        const teacher = result.rows[0];
        
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        
        res.json(teacher);
    } catch (error) {
        console.error('Error fetching teacher:', error);
        res.status(500).json({ error: 'Failed to fetch teacher' });
    }
});

// Create a new teacher (admin only)
router.post('/teachers', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { username, password, full_name } = req.body;
    
    if (!username || !password || !full_name) {
        return res.status(400).json({ error: 'All fields required (username, password, full_name)' });
    }
    
    try {
        // Check if username already exists
        const existingResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        const existingUser = existingResult.rows[0];
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const passwordHash = bcrypt.hashSync(password, 10);
        const result = await pool.query('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id', [username, passwordHash, full_name, 'teacher']);
        
        res.status(201).json({ 
            id: result.rows[0].id, 
            username, 
            full_name, 
            role: 'teacher' 
        });
    } catch (error) {
        console.error('Error creating teacher:', error);
        res.status(500).json({ error: 'Failed to create teacher' });
    }
});

// Update a teacher (admin only)
router.put('/teachers/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { username, full_name, password } = req.body;
    
    if (!username || !full_name) {
        return res.status(400).json({ error: 'Username and full name are required' });
    }
    
    try {
        const teacherId = parseInt(req.params.id, 10);
        if (isNaN(teacherId)) {
            return res.status(400).json({ error: 'Invalid teacher ID' });
        }
        
        // Check if username already exists for another user
        const existingResult = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, teacherId]);
        const existingUser = existingResult.rows[0];
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        if (password) {
            // Update with new password
            const passwordHash = bcrypt.hashSync(password, 10);
            await pool.query('UPDATE users SET username = $1, full_name = $2, password_hash = $3 WHERE id = $4 AND role = $5', [username, full_name, passwordHash, teacherId, 'teacher']);
        } else {
            // Update without changing password
            await pool.query('UPDATE users SET username = $1, full_name = $2 WHERE id = $3 AND role = $4', [username, full_name, teacherId, 'teacher']);
        }
        
        const result = await pool.query('SELECT id, username, full_name, role FROM users WHERE id = $1 AND role = $2', [teacherId, 'teacher']);
        const teacher = result.rows[0];
        
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        
        res.json(teacher);
    } catch (error) {
        console.error('Error updating teacher:', error);
        res.status(500).json({ error: 'Failed to update teacher' });
    }
});

// Delete a teacher (admin only)
router.delete('/teachers/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    try {
        const teacherId = parseInt(req.params.id, 10);
        if (isNaN(teacherId)) {
            return res.status(400).json({ error: 'Invalid teacher ID' });
        }
        
        // Check if teacher has any classes
        const classesResult = await pool.query('SELECT COUNT(*) as count FROM classes WHERE teacher_id = $1', [teacherId]);
        const classes = classesResult.rows[0];
        if (parseInt(classes.count) > 0) {
            return res.status(400).json({ 
                error: `Cannot delete teacher with ${classes.count} assigned class(es). Please reassign or delete their classes first.` 
            });
        }
        
        const result = await pool.query('DELETE FROM users WHERE id = $1 AND role = $2', [teacherId, 'teacher']);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        
        res.json({ message: 'Teacher deleted successfully' });
    } catch (error) {
        console.error('Error deleting teacher:', error);
        res.status(500).json({ error: 'Failed to delete teacher' });
    }
});

// Debug endpoint - Check if default users exist (remove in production)
// Note: This endpoint is restricted to development/staging environments
router.get('/debug/users', async (req, res) => {
    // Restrict to non-production environments
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEBUG_ENDPOINTS) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    try {
        const result = await pool.query('SELECT id, username, full_name, role, created_at FROM users ORDER BY id');
        const users = result.rows;
        
        res.json({
            count: users.length,
            users: users,
            message: users.length === 0 ? 'No users found - initialization may have failed' : 'Users found'
        });
    } catch (error) {
        console.error('Debug users error:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// Emergency endpoint - Manually create admin user (remove after fixing)
// Note: This endpoint is restricted to development/staging environments
router.post('/debug/create-admin', async (req, res) => {
    // Restrict to non-production environments
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEBUG_ENDPOINTS) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    try {
        // Check if admin exists
        const check = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
        
        if (check.rows.length > 0) {
            // Admin exists - delete and recreate
            await pool.query('DELETE FROM users WHERE username = $1', ['admin']);
        }
        
        // Create admin with correct password
        const adminHash = await bcrypt.hash('admin123', 10);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role',
            ['admin', adminHash, 'Admin User', 'admin']
        );
        
        // Test the password immediately
        const testPassword = bcrypt.compareSync('admin123', adminHash);
        
        res.json({
            message: 'Admin user created successfully',
            user: result.rows[0],
            passwordTest: testPassword ? 'Password hash verified ✅' : 'Password hash FAILED ❌'
        });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

module.exports = router;
