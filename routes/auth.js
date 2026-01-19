const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../database/init');

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
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
        console.error('Login error:', error);
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
router.post('/change-password', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;
    
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const validPassword = bcrypt.compareSync(currentPassword, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        const newPasswordHash = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, req.session.userId);
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// Change username
router.post('/change-username', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { newUsername, password } = req.body;
    
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Password is incorrect' });
        }
        
        // Check if username already exists
        const existingUser = db.prepare('SELECT * FROM users WHERE username = ? AND id != ?').get(newUsername, req.session.userId);
        
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, req.session.userId);
        
        // Update session
        req.session.username = newUsername;
        
        res.json({ message: 'Username updated successfully', username: newUsername });
    } catch (error) {
        console.error('Change username error:', error);
        res.status(500).json({ error: 'Failed to update username' });
    }
});

// Get all teachers (for admin)
router.get('/teachers', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const teachers = db.prepare('SELECT id, username, full_name, role FROM users WHERE role = ? ORDER BY full_name').all('teacher');
        res.json(teachers);
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

// Create a new teacher (admin only)
router.post('/teachers', (req, res) => {
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
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const passwordHash = bcrypt.hashSync(password, 10);
        const result = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
            username, passwordHash, full_name, 'teacher'
        );
        
        res.status(201).json({ 
            id: result.lastInsertRowid, 
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
router.put('/teachers/:id', (req, res) => {
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
        // Check if username already exists for another user
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.params.id);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        if (password) {
            // Update with new password
            const passwordHash = bcrypt.hashSync(password, 10);
            db.prepare('UPDATE users SET username = ?, full_name = ?, password_hash = ? WHERE id = ?').run(
                username, full_name, passwordHash, req.params.id
            );
        } else {
            // Update without changing password
            db.prepare('UPDATE users SET username = ?, full_name = ? WHERE id = ?').run(
                username, full_name, req.params.id
            );
        }
        
        const teacher = db.prepare('SELECT id, username, full_name, role FROM users WHERE id = ?').get(req.params.id);
        res.json(teacher);
    } catch (error) {
        console.error('Error updating teacher:', error);
        res.status(500).json({ error: 'Failed to update teacher' });
    }
});

// Delete a teacher (admin only)
router.delete('/teachers/:id', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    try {
        // Check if teacher has any classes
        const classes = db.prepare('SELECT COUNT(*) as count FROM classes WHERE teacher_id = ?').get(req.params.id);
        if (classes.count > 0) {
            return res.status(400).json({ error: 'Cannot delete teacher with assigned classes' });
        }
        
        db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(req.params.id, 'teacher');
        res.json({ message: 'Teacher deleted successfully' });
    } catch (error) {
        console.error('Error deleting teacher:', error);
        res.status(500).json({ error: 'Failed to delete teacher' });
    }
});

module.exports = router;
