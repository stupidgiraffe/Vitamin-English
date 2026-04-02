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
    // Tuned for Neon PostgreSQL on Vercel serverless:
    // - Keep pool small (max 5) to avoid exhausting Neon connection limits across concurrent cold starts
    // - Longer connectionTimeoutMillis to survive Neon auto-suspend wake-up (can take 3-5 s)
    // - min:0 so idle serverless instances don't hold open connections that Neon will terminate
    max: parseInt(process.env.DB_POOL_MAX || '5', 10),
    min: 0,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '10000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '15000', 10),
    maxUses: parseInt(process.env.DB_MAX_USES || '7500', 10),
    // Allow the pool to fully drain when the app is idle (important for serverless/Vercel)
    allowExitOnIdle: true,
});

// Test connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    // Expected during Neon auto-suspend wake-up; stale connections are removed automatically
    console.error('⚠️ Database pool connection error (expected with Neon auto-suspend):', err.message);
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
 * Execute a query with exponential-backoff retry for transient connection errors.
 * This helps survive Neon auto-suspend wake-up timeouts on cold starts.
 * @param {string|Object} text - SQL text or query object
 * @param {Array} [values] - Query parameters
 * @param {number} [maxRetries=3] - Maximum number of retries
 * @returns {Promise<Object>} Query result
 */
const INITIAL_RETRY_DELAY_MS = 200;  // First retry after 200ms; doubles each attempt
const MAX_RETRY_DELAY_MS     = 3000; // Cap at 3s to avoid excessively long waits

pool.queryWithRetry = async (text, values = [], maxRetries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await pool.query(text, values);
        } catch (err) {
            lastError = err;
            const isTransient =
                err.message && (
                    err.message.includes('Connection terminated') ||
                    err.message.includes('connection timeout') ||
                    err.message.includes('ECONNRESET') ||
                    err.message.includes('ETIMEDOUT') ||
                    err.code === 'ECONNRESET' ||
                    err.code === 'ETIMEDOUT'
                );
            if (!isTransient || attempt === maxRetries) {
                throw err;
            }
            const delay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
            console.warn(`⚠️ DB query transient error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
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
