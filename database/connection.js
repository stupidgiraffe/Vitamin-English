const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        // rejectUnauthorized: false is required for services like Neon, Supabase, etc.
        // These services use self-signed certificates or certificates not in Node's CA bundle
        rejectUnauthorized: false
    } : false,
    // Enhanced pool configuration
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
    maxUses: parseInt(process.env.DB_MAX_USES || '7500', 10),
});

// Test connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

/**
 * Perform a health check on the database connection
 * @returns {Promise<{ok: boolean, latencyMs: number, error?: string}>}
 */
pool.healthCheck = async () => {
    const start = Date.now();
    try {
        await pool.query('SELECT 1');
        return { 
            ok: true, 
            latencyMs: Date.now() - start 
        };
    } catch (error) {
        return { 
            ok: false, 
            latencyMs: Date.now() - start,
            error: error.message 
        };
    }
};

/**
 * Get current pool statistics
 * @returns {Object} Pool statistics
 */
pool.getStats = () => ({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
});

module.exports = pool;
