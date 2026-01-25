const express = require('express');
const router = express.Router();
const { seedTestData, clearAllData } = require('../database/seed-test-data');

// Middleware to require admin role
const requireAdmin = (req, res, next) => {
    if (req.session.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
};

// Seed test data
router.post('/seed-data', requireAdmin, async (req, res) => {
    try {
        const result = await seedTestData();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear all data
router.post('/clear-data', requireAdmin, async (req, res) => {
    try {
        const result = await clearAllData();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
