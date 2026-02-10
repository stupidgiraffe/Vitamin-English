const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');

// Get data from a specific table with pagination
router.get('/table/:tableName', async (req, res) => {
    const { tableName } = req.params;
    const { page = 1, perPage = 50 } = req.query;
    
    try {
        const repo = dataHub.getRepository(tableName);
        if (!repo) {
            return res.status(400).json({ error: 'Invalid table name' });
        }
        
        const data = await repo.findAll({ 
            page: parseInt(page), 
            perPage: parseInt(perPage) 
        });
        const total = await repo.count();
        
        res.json({ 
            table: tableName, 
            data, 
            pagination: { 
                page: parseInt(page), 
                perPage: parseInt(perPage), 
                total 
            } 
        });
    } catch (error) {
        console.error('❌ Database query error:', error);
        res.status(500).json({ error: 'Failed to query database' });
    }
});

// Unified search across all tables
router.get('/search', async (req, res) => {
    try {
        const { query, type = 'all', startDate, endDate, page = 1, perPage = 50 } = req.query;
        
        const results = await dataHub.searchAll(query || '', {
            type,
            startDate,
            endDate,
            page: parseInt(page),
            perPage: parseInt(perPage)
        });
        
        res.json(results);
    } catch (error) {
        console.error('❌ Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Database health check
router.get('/health', async (req, res) => {
    try {
        const health = await dataHub.healthCheck();
        res.json(health);
    } catch (error) {
        console.error('❌ Health check error:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Database statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await dataHub.getStats();
        res.json(stats);
    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
});

module.exports = router;
