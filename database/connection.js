const { Pool } = require('pg');

// Check if DATABASE_URL is configured
if (!process.env.DATABASE_URL) {
    console.error('❌ CRITICAL ERROR: DATABASE_URL environment variable is not set!');
    console.error('');
    console.error('To fix this:');
    console.error('1. Create a .env file in the project root (copy from .env.example)');
    console.error('2. Set DATABASE_URL to your PostgreSQL connection string');
    console.error('   Example: DATABASE_URL=postgresql://user:pass@host/database');
    console.error('');
    console.error('For local development, you can use:');
    console.error('  - Neon (free): https://neon.tech');
    console.error('  - Railway (free): https://railway.app');
    console.error('  - Local PostgreSQL: postgresql://localhost:5432/vitamin_english');
    console.error('');
    throw new Error('DATABASE_URL is required but not configured');
}

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
