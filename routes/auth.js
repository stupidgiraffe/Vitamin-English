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

module.exports = router;
