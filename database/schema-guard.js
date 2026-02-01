const pool = require('./connection');

/**
 * Schema Guard - Ensures required columns exist in Postgres database
 * This module detects missing columns and adds them with safe defaults
 * Only runs for PostgreSQL (not SQLite)
 */

async function ensureSchemaColumns() {
    try {
        // Skip if not using Postgres (e.g., SQLite in development)
        if (!process.env.DATABASE_URL) {
            console.log('ℹ️  Skipping schema guard (DATABASE_URL not set - using SQLite)');
            return;
        }

        console.log('🔒 Running schema guard to ensure required columns...');

        const client = await pool.connect();
        
        try {
            // Check and add missing columns in students table
            await ensureStudentColumns(client);
            
            // Check and add missing columns in classes table
            await ensureClassColumns(client);
            
            console.log('✅ Schema guard completed successfully');
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('❌ Schema guard error:', error);
        console.error('Stack trace:', error.stack);
        // Don't throw - allow app to continue even if schema guard fails
    }
}

async function ensureStudentColumns(client) {
    const requiredColumns = [
        { name: 'parent_phone', type: 'VARCHAR(50)', default: null },
        { name: 'color_code', type: 'VARCHAR(50)', default: null },
        { name: 'email', type: 'VARCHAR(255)', default: null },
        { name: 'phone', type: 'VARCHAR(50)', default: null },
        { name: 'parent_name', type: 'VARCHAR(255)', default: null },
        { name: 'parent_email', type: 'VARCHAR(255)', default: null },
        { name: 'enrollment_date', type: 'VARCHAR(50)', default: null }
    ];

    for (const column of requiredColumns) {
        await ensureColumnExists(client, 'students', column.name, column.type, column.default);
    }
}

async function ensureClassColumns(client) {
    const requiredColumns = [
        { name: 'color', type: 'VARCHAR(50)', default: "'#4A90E2'" }
    ];

    for (const column of requiredColumns) {
        await ensureColumnExists(client, 'classes', column.name, column.type, column.default);
    }
}

async function ensureColumnExists(client, tableName, columnName, columnType, defaultValue) {
    try {
        // Check if column exists
        const checkResult = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
        `, [tableName, columnName]);

        if (checkResult.rows.length === 0) {
            // Column doesn't exist, add it
            console.log(`⚠️  Column ${tableName}.${columnName} missing - adding...`);
            
            const defaultClause = defaultValue !== null ? `DEFAULT ${defaultValue}` : '';
            const alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType} ${defaultClause}`;
            
            await client.query(alterSQL);
            console.log(`✅ Added column ${tableName}.${columnName}`);
        } else {
            console.log(`✓ Column ${tableName}.${columnName} exists`);
        }
    } catch (error) {
        console.error(`❌ Error ensuring column ${tableName}.${columnName}:`, error.message);
        // Continue to next column even if one fails
    }
}

module.exports = { ensureSchemaColumns };
