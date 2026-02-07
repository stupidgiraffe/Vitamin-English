#!/usr/bin/env node

/**
 * Database Migration Runner
 * Applies migrations 004 and 005 to Neon PostgreSQL database
 * 
 * Usage: node scripts/apply-migrations.js
 * 
 * This script:
 * - Checks which migrations have been applied
 * - Applies migration 004 (creates monthly_reports and monthly_report_weeks tables)
 * - Applies migration 005 (renames lesson_reports to teacher_comment_sheets, adds date columns)
 * - Uses transactions for safety
 * - Provides clear console output
 */

const pool = require('../database/connection');
const fs = require('fs');
const path = require('path');

/**
 * Check if a table exists in the database
 */
async function tableExists(client, tableName) {
    const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
    `, [tableName]);
    return result.rows.length > 0;
}

/**
 * Check if a column exists in a table
 */
async function columnExists(client, tableName, columnName) {
    const result = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
    `, [tableName, columnName]);
    return result.rows.length > 0;
}

/**
 * Check migration status
 */
async function checkMigrationStatus(client) {
    console.log('🔍 Checking migration status...\n');
    
    const status = {
        migration_004: {
            applied: false,
            checks: {
                monthly_reports: false,
                monthly_report_weeks: false
            }
        },
        migration_005: {
            applied: false,
            checks: {
                teacher_comment_sheets: false,
                lesson_reports: false,
                start_date_column: false,
                end_date_column: false
            }
        }
    };
    
    // Check migration 004
    status.migration_004.checks.monthly_reports = await tableExists(client, 'monthly_reports');
    status.migration_004.checks.monthly_report_weeks = await tableExists(client, 'monthly_report_weeks');
    status.migration_004.applied = status.migration_004.checks.monthly_reports && 
                                     status.migration_004.checks.monthly_report_weeks;
    
    // Check migration 005
    status.migration_005.checks.teacher_comment_sheets = await tableExists(client, 'teacher_comment_sheets');
    status.migration_005.checks.lesson_reports = await tableExists(client, 'lesson_reports');
    
    if (status.migration_004.checks.monthly_reports) {
        status.migration_005.checks.start_date_column = await columnExists(client, 'monthly_reports', 'start_date');
        status.migration_005.checks.end_date_column = await columnExists(client, 'monthly_reports', 'end_date');
    }
    
    status.migration_005.applied = status.migration_005.checks.teacher_comment_sheets && 
                                     !status.migration_005.checks.lesson_reports &&
                                     status.migration_005.checks.start_date_column &&
                                     status.migration_005.checks.end_date_column;
    
    return status;
}

/**
 * Display migration status
 */
function displayStatus(status) {
    console.log('📊 Migration Status:\n');
    
    // Migration 004
    console.log(`Migration 004 (Monthly Reports): ${status.migration_004.applied ? '✅ Applied' : '❌ Not Applied'}`);
    console.log(`  - monthly_reports table: ${status.migration_004.checks.monthly_reports ? '✓' : '✗'}`);
    console.log(`  - monthly_report_weeks table: ${status.migration_004.checks.monthly_report_weeks ? '✓' : '✗'}`);
    console.log();
    
    // Migration 005
    console.log(`Migration 005 (Table Rename): ${status.migration_005.applied ? '✅ Applied' : '❌ Not Applied'}`);
    console.log(`  - teacher_comment_sheets table: ${status.migration_005.checks.teacher_comment_sheets ? '✓' : '✗'}`);
    console.log(`  - lesson_reports table (old): ${status.migration_005.checks.lesson_reports ? '✗ (should not exist)' : '✓'}`);
    if (status.migration_004.checks.monthly_reports) {
        console.log(`  - start_date column: ${status.migration_005.checks.start_date_column ? '✓' : '✗'}`);
        console.log(`  - end_date column: ${status.migration_005.checks.end_date_column ? '✓' : '✗'}`);
    }
    console.log();
}

/**
 * Apply migration 004
 */
async function applyMigration004(client) {
    console.log('🔄 Applying migration 004 (Create monthly reports tables)...\n');
    
    const migrationPath = path.join(__dirname, '../database/migrations/004_create_monthly_reports.sql');
    
    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration SQL
    // PostgreSQL will handle IF NOT EXISTS clauses
    try {
        await client.query(migrationSQL);
        console.log('✅ Migration 004 applied successfully\n');
        return true;
    } catch (error) {
        console.error('❌ Error applying migration 004:', error.message);
        throw error;
    }
}

/**
 * Apply migration 005
 */
async function applyMigration005(client) {
    console.log('🔄 Applying migration 005 (Rename lesson_reports to teacher_comment_sheets)...\n');
    
    const migrationPath = path.join(__dirname, '../database/migrations/005_rename_lesson_reports_to_teacher_comment_sheets.sql');
    
    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and filter out empty statements and comments
    const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute\n`);
    
    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement) {
            console.log(`Executing statement ${i + 1}/${statements.length}...`);
            try {
                await client.query(statement);
                console.log(`✅ Statement ${i + 1} completed`);
            } catch (err) {
                // Some statements may fail if already executed (e.g., column already exists)
                // This is okay for idempotency
                if (err.message.includes('already exists') || 
                    err.message.includes('does not exist') ||
                    err.message.includes('duplicate')) {
                    console.log(`⚠️  Statement ${i + 1} skipped (already applied): ${err.message}`);
                } else {
                    console.error(`❌ Statement ${i + 1} failed: ${err.message}`);
                    throw err;
                }
            }
        }
    }
    
    console.log('\n✅ Migration 005 applied successfully\n');
    return true;
}

/**
 * Main migration function
 */
async function runMigrations() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting database migration process...\n');
        console.log('📍 Database: ' + (process.env.DATABASE_URL ? 'PostgreSQL (Neon)' : 'Not configured') + '\n');
        
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set');
        }
        
        // Check initial status
        let status = await checkMigrationStatus(client);
        displayStatus(status);
        
        if (status.migration_004.applied && status.migration_005.applied) {
            console.log('✅ All migrations are already applied. Nothing to do.\n');
            return { success: true, message: 'All migrations already applied' };
        }
        
        // Start transaction
        await client.query('BEGIN');
        
        try {
            // Apply migration 004 if needed
            if (!status.migration_004.applied) {
                await applyMigration004(client);
            } else {
                console.log('ℹ️  Migration 004 already applied, skipping...\n');
            }
            
            // Apply migration 005 if needed
            if (!status.migration_005.applied) {
                await applyMigration005(client);
            } else {
                console.log('ℹ️  Migration 005 already applied, skipping...\n');
            }
            
            // Commit transaction
            await client.query('COMMIT');
            console.log('✅ Transaction committed successfully\n');
            
        } catch (error) {
            // Rollback on error
            await client.query('ROLLBACK');
            console.error('❌ Transaction rolled back due to error\n');
            throw error;
        }
        
        // Verify final status
        console.log('🔍 Verifying migration results...\n');
        status = await checkMigrationStatus(client);
        displayStatus(status);
        
        if (status.migration_004.applied && status.migration_005.applied) {
            console.log('🎉 All migrations completed successfully!\n');
            console.log('Next steps:');
            console.log('  1. Restart your application server');
            console.log('  2. Test the following features:');
            console.log('     - Login and fetch reports');
            console.log('     - Save teacher comment sheets');
            console.log('     - Create and save monthly reports');
            console.log();
            return { success: true, message: 'All migrations completed successfully' };
        } else {
            console.log('⚠️  Warning: Some migrations may not have been fully applied.\n');
            console.log('Please check the status above and verify manually.\n');
            return { success: false, message: 'Some migrations may not have been fully applied' };
        }
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nStack trace:', error.stack);
        console.error('\nTroubleshooting:');
        console.error('  1. Check that DATABASE_URL is correctly set');
        console.error('  2. Verify database connection is working');
        console.error('  3. Ensure you have proper database permissions');
        console.error('  4. Check migration files exist in database/migrations/');
        console.error();
        return { success: false, message: error.message };
    } finally {
        client.release();
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    runMigrations()
        .then(result => {
            if (result.success) {
                console.log('Migration process completed successfully');
                process.exit(0);
            } else {
                console.error('Migration process completed with errors');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Migration process failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigrations, checkMigrationStatus };
