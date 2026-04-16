const express = require('express');
const router = express.Router();
const dataHub = require('../database/DataHub');
const { listPDFs, isConfigured } = require('../utils/r2Storage');

function formatBytes(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;

    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = size / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function getUsagePercent(usedBytes, limitBytes) {
    const used = Number(usedBytes) || 0;
    const limit = Number(limitBytes) || 0;
    if (limit <= 0) return 0;
    return Number(((used / limit) * 100).toFixed(1));
}

function getR2ListMaxKeysFromEnv() {
    const rawValue = process.env.R2_STORAGE_LIST_MAX_KEYS;
    if (rawValue === undefined) {
        return 1000;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        console.warn(`⚠️ Invalid R2_STORAGE_LIST_MAX_KEYS value "${rawValue}", using default 1000`);
        return 1000;
    }

    return Math.floor(parsed);
}

function getEnvNumberWithDefault(name, defaultValue) {
    const rawValue = process.env[name];
    if (rawValue === undefined) {
        return defaultValue;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        console.warn(`⚠️ Invalid ${name} value "${rawValue}", using default ${defaultValue}`);
        return defaultValue;
    }

    return parsed;
}

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

// Comprehensive storage usage overview
router.get('/storage', async (req, res) => {
    try {
        const storageInfo = await dataHub.getStorageInfo();

        const dbLimitMb = getEnvNumberWithDefault('DB_STORAGE_LIMIT_MB', 512);
        const r2LimitGb = getEnvNumberWithDefault('R2_STORAGE_LIMIT_GB', 10);
        const dbLimitBytes = Math.max(0, Math.floor(dbLimitMb * 1024 * 1024));
        const r2LimitBytes = Math.max(0, Math.floor(r2LimitGb * 1024 * 1024 * 1024));

        const r2Configured = isConfigured();
        let r2ActualCount = storageInfo.pdfHistory.totalFiles;
        if (r2Configured) {
            try {
                const r2ListMaxKeys = getR2ListMaxKeysFromEnv();
                const r2Files = await listPDFs('pdfs/', r2ListMaxKeys);
                r2ActualCount = r2Files.length;
            } catch (r2Error) {
                console.warn('⚠️ Failed to fetch R2 file list for storage meter:', r2Error.message);
            }
        }

        const dbUsagePercent = getUsagePercent(storageInfo.database.totalSizeBytes, dbLimitBytes);
        const r2UsagePercent = getUsagePercent(storageInfo.pdfHistory.totalSizeBytes, r2LimitBytes);

        const usageValues = [dbUsagePercent];
        if (r2Configured) {
            usageValues.push(r2UsagePercent);
        }

        const maxUsage = Math.max(...usageValues);
        let healthStatus = 'healthy';
        if (maxUsage > 90) {
            healthStatus = 'critical';
        } else if (maxUsage >= 70) {
            healthStatus = 'warning';
        }

        const combinedBytes = storageInfo.database.totalSizeBytes + storageInfo.pdfHistory.totalSizeBytes;

        res.json({
            database: {
                totalSize: storageInfo.database.totalSize,
                totalSizeBytes: storageInfo.database.totalSizeBytes,
                tables: storageInfo.database.tables,
                limit: formatBytes(dbLimitBytes),
                limitBytes: dbLimitBytes,
                usagePercent: dbUsagePercent
            },
            r2: {
                configured: r2Configured,
                totalFiles: r2ActualCount,
                totalSize: formatBytes(storageInfo.pdfHistory.totalSizeBytes),
                totalSizeBytes: storageInfo.pdfHistory.totalSizeBytes,
                filesByType: storageInfo.pdfHistory.filesByType,
                limit: formatBytes(r2LimitBytes),
                limitBytes: r2LimitBytes,
                usagePercent: r2UsagePercent
            },
            combined: {
                totalSizeBytes: combinedBytes,
                totalSizeFormatted: formatBytes(combinedBytes),
                healthStatus
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Storage overview error:', error);
        res.status(500).json({ error: 'Failed to retrieve storage overview' });
    }
});

module.exports = router;
