const pool = require('./connection');

/**
 * Schema Guard - Ensures required columns exist in Postgres database
 * This module detects missing columns and adds them with safe defaults
 * Also checks for missing migrations and provides warnings
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
            // Check for missing migrations first
            await checkMigrationStatus(client);
            
            // Check and add missing columns in students table
            await ensureStudentColumns(client);
            
            // Check and add missing columns in classes table
            await ensureClassColumns(client);
            
            // Ensure monthly_reports has start_date and end_date columns (added in migration 005)
            await ensureMonthlyReportsColumns(client);
            
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

/**
 * Check if migrations are needed and log warnings
 */
async function checkMigrationStatus(client) {
    try {
        const hasTeacherCommentSheets = await tableExists(client, 'teacher_comment_sheets');
        const hasLessonReports = await tableExists(client, 'lesson_reports');
        const hasMonthlyReports = await tableExists(client, 'monthly_reports');
        const hasMonthlyReportWeeks = await tableExists(client, 'monthly_report_weeks');
        
        let needsMigration = false;
        
        // Check migration 004
        if (!hasMonthlyReports || !hasMonthlyReportWeeks) {
            console.log('⚠️  WARNING: Migration 004 not applied');
            console.log('   Missing tables: monthly_reports and/or monthly_report_weeks');
            console.log('   Run: node scripts/apply-migrations.js');
            needsMigration = true;
        }
        
        // Check migration 005
        if (hasLessonReports && !hasTeacherCommentSheets) {
            console.log('⚠️  WARNING: Migration 005 not applied');
            console.log('   Table "lesson_reports" should be renamed to "teacher_comment_sheets"');
            console.log('   Run: node scripts/apply-migrations.js');
            needsMigration = true;
        }
        
        if (needsMigration) {
            console.log('\n🚨 DATABASE SCHEMA IS OUTDATED');
            console.log('   Application may not work correctly until migrations are applied.');
            console.log('   See MIGRATION_INSTRUCTIONS.md for details.\n');
        }
        
    } catch (error) {
        console.error('Error checking migration status:', error.message);
    }
}

/**
 * Check if a table exists
 */
async function tableExists(client, tableName) {
    const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
    `, [tableName]);
    return result.rows.length > 0;
}

async function ensureStudentColumns(client) {
    const requiredColumns = [
        { name: 'parent_phone', type: 'VARCHAR(50)', default: 'NULL' },
        { name: 'color_code', type: 'VARCHAR(50)', default: 'NULL' },
        { name: 'email', type: 'VARCHAR(255)', default: 'NULL' },
        { name: 'phone', type: 'VARCHAR(50)', default: 'NULL' },
        { name: 'parent_name', type: 'VARCHAR(255)', default: 'NULL' },
        { name: 'parent_email', type: 'VARCHAR(255)', default: 'NULL' },
        { name: 'enrollment_date', type: 'VARCHAR(50)', default: 'NULL' }
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

async function ensureMonthlyReportsColumns(client) {
    // Check if monthly_reports table exists first
    const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'monthly_reports'
    `);
    
    if (tableCheck.rows.length === 0) {
        console.log('ℹ️  monthly_reports table does not exist yet, skipping column check');
        return;
    }
    
    const requiredColumns = [
        { name: 'start_date', type: 'DATE', default: 'NULL' },
        { name: 'end_date', type: 'DATE', default: 'NULL' }
    ];

    for (const column of requiredColumns) {
        await ensureColumnExists(client, 'monthly_reports', column.name, column.type, column.default);
    }
}

async function ensureColumnExists(client, tableName, columnName, columnType, defaultValue) {
    try {
        // Validate table and column names against allowlist to prevent SQL injection
        const allowedTables = ['students', 'classes', 'monthly_reports'];
        const allowedColumns = {
            students: ['parent_phone', 'color_code', 'email', 'phone', 'parent_name', 'parent_email', 'enrollment_date'],
            classes: ['color'],
            monthly_reports: ['start_date', 'end_date']
        };
        
        if (!allowedTables.includes(tableName)) {
            console.error(`❌ Invalid table name: ${tableName}`);
            return;
        }
        
        if (!allowedColumns[tableName] || !allowedColumns[tableName].includes(columnName)) {
            console.error(`❌ Invalid column name: ${columnName} for table ${tableName}`);
            return;
        }
        
        // Validate default value against allowlist (only allow NULL or specific safe values)
        // Use != null to catch both null and undefined
        const allowedDefaults = ['NULL', "'#4A90E2'"];
        if (defaultValue != null && !allowedDefaults.includes(defaultValue)) {
            console.error(`❌ Invalid default value: ${defaultValue}`);
            return;
        }
        
        // Check if column exists
        const checkResult = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
        `, [tableName, columnName]);

        if (checkResult.rows.length === 0) {
            // Column doesn't exist, add it
            console.log(`⚠️  Column ${tableName}.${columnName} missing - adding...`);
            
            // Safe to use validated table/column names and default values in SQL
            // Use != null to catch both null and undefined
            const defaultClause = (defaultValue != null) ? `DEFAULT ${defaultValue}` : '';
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
