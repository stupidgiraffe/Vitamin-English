#!/usr/bin/env node

/**
 * Universal Database Migration Runner
 * Applies all pending migrations to Neon PostgreSQL database
 * 
 * Usage: node scripts/apply-all-migrations.js
 * 
 * This script:
 * - Detects all migration files in database/migrations/
 * - Checks which have been applied
 * - Applies pending migrations in order
 * - Uses transactions for safety
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
 * Check if a trigger exists
 */
async function triggerExists(client, triggerName, tableName) {
    const result = await client.query(`
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        AND trigger_name = $1
        AND event_object_table = $2
    `, [triggerName, tableName]);
    return result.rows.length > 0;
}

/**
 * Check if an index exists
 */
async function indexExists(client, indexName) {
    const result = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname = $1
    `, [indexName]);
    return result.rows.length > 0;
}

/**
 * Check if a view exists
 */
async function viewExists(client, viewName) {
    const result = await client.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name = $1
    `, [viewName]);
    return result.rows.length > 0;
}

/**
 * Get list of all migration files
 */
function getMigrationFiles() {
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') && /^\d{3}_/.test(f))
        .sort();
    
    return files.map(filename => {
        const match = filename.match(/^(\d{3})_(.+)\.sql$/);
        return {
            number: match[1],
            name: match[2],
            filename: filename,
            path: path.join(migrationsDir, filename)
        };
    });
}

/**
 * Check migration 009 status (DataHub improvements)
 */
async function checkMigration009Status(client) {
    const checks = {
        students_updated_at: await columnExists(client, 'students', 'updated_at'),
        classes_updated_at: await columnExists(client, 'classes', 'updated_at'),
        attendance_updated_at: await columnExists(client, 'attendance', 'updated_at'),
        teacher_comment_sheets_updated_at: await columnExists(client, 'teacher_comment_sheets', 'updated_at'),
        makeup_lessons_updated_at: await columnExists(client, 'makeup_lessons', 'updated_at'),
        trigger_students: await triggerExists(client, 'update_students_updated_at', 'students'),
        trigger_classes: await triggerExists(client, 'update_classes_updated_at', 'classes'),
        database_stats_view: await viewExists(client, 'database_stats')
    };
    
    const applied = checks.students_updated_at &&
                    checks.classes_updated_at &&
                    checks.attendance_updated_at &&
                    checks.trigger_students &&
                    checks.trigger_classes &&
                    checks.database_stats_view;
    
    return { applied, checks };
}

/**
 * Comprehensive migration status check
 */
async function checkAllMigrations(client) {
    console.log('🔍 Checking migration status...\n');
    
    const status = {};
    
    // Migration 004
    const m004_monthly_reports = await tableExists(client, 'monthly_reports');
    const m004_monthly_report_weeks = await tableExists(client, 'monthly_report_weeks');
    status['004'] = {
        name: 'create_monthly_reports',
        applied: m004_monthly_reports && m004_monthly_report_weeks,
        checks: { monthly_reports: m004_monthly_reports, monthly_report_weeks: m004_monthly_report_weeks }
    };
    
    // Migration 005
    const m005_teacher_comment_sheets = await tableExists(client, 'teacher_comment_sheets');
    const m005_no_lesson_reports = !(await tableExists(client, 'lesson_reports'));
    const m005_start_date = await columnExists(client, 'monthly_reports', 'start_date');
    status['005'] = {
        name: 'rename_lesson_reports_to_teacher_comment_sheets',
        applied: m005_teacher_comment_sheets && m005_no_lesson_reports && m005_start_date,
        checks: { teacher_comment_sheets: m005_teacher_comment_sheets, start_date_column: m005_start_date }
    };
    
    // Migration 006
    const m006_constraint = await client.query(`
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'monthly_reports'::regclass 
        AND conname = 'monthly_reports_class_date_range_unique'
    `);
    status['006'] = {
        name: 'monthly_reports_unique_range',
        applied: m006_constraint.rows.length > 0,
        checks: { unique_constraint: m006_constraint.rows.length > 0 }
    };
    
    // Migration 007
    const m007_teacher_id = await columnExists(client, 'attendance', 'teacher_id');
    status['007'] = {
        name: 'add_attendance_teacher_id',
        applied: m007_teacher_id,
        checks: { teacher_id_column: m007_teacher_id }
    };
    
    // Migration 008
    const m008_constraint = await client.query(`
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'attendance'::regclass 
        AND conname = 'attendance_student_class_date_unique'
    `);
    status['008'] = {
        name: 'fix_attendance_unique_constraint',
        applied: m008_constraint.rows.length > 0,
        checks: { unique_constraint: m008_constraint.rows.length > 0 }
    };
    
    // Migration 009
    const m009Status = await checkMigration009Status(client);
    status['009'] = {
        name: 'datahub_improvements',
        applied: m009Status.applied,
        checks: m009Status.checks
    };
    
    return status;
}

/**
 * Display migration status
 */
function displayStatus(status) {
    console.log('📊 Migration Status:\n');
    
    Object.keys(status).sort().forEach(num => {
        const m = status[num];
        const icon = m.applied ? '✅' : '❌';
        console.log(`Migration ${num} (${m.name}): ${icon} ${m.applied ? 'Applied' : 'Not Applied'}`);
        
        if (!m.applied && m.checks) {
            Object.entries(m.checks).forEach(([key, value]) => {
                console.log(`  - ${key}: ${value ? '✓' : '✗'}`);
            });
        }
    });
    console.log();
}

/**
 * Apply a single migration file
 */
async function applyMigration(client, migration) {
    console.log(`🔄 Applying migration ${migration.number} (${migration.name})...\n`);
    
    if (!fs.existsSync(migration.path)) {
        throw new Error(`Migration file not found: ${migration.path}`);
    }
    
    const migrationSQL = fs.readFileSync(migration.path, 'utf8');
    
    try {
        await client.query(migrationSQL);
        console.log(`✅ Migration ${migration.number} applied successfully\n`);
        return true;
    } catch (error) {
        // Some errors are okay (IF NOT EXISTS clauses)
        if (error.code === '42P07' || error.code === '42701') {
            console.log(`⚠️  Migration ${migration.number} partially applied (some objects already exist)\n`);
            return true;
        }
        console.error(`❌ Error applying migration ${migration.number}:`, error.message);
        throw error;
    }
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
        
        // Get all migration files
        const allMigrations = getMigrationFiles();
        console.log(`Found ${allMigrations.length} migration files\n`);
        
        // Check status
        const status = await checkAllMigrations(client);
        displayStatus(status);
        
        // Find pending migrations
        const pendingMigrations = allMigrations.filter(m => !status[m.number]?.applied);
        
        if (pendingMigrations.length === 0) {
            console.log('✅ All migrations are already applied. Nothing to do.\n');
            return { success: true, message: 'All migrations already applied' };
        }
        
        console.log(`📝 ${pendingMigrations.length} migration(s) pending:\n`);
        pendingMigrations.forEach(m => {
            console.log(`  - ${m.number}_${m.name}`);
        });
        console.log();
        
        // Apply pending migrations in transaction
        await client.query('BEGIN');
        
        try {
            for (const migration of pendingMigrations) {
                await applyMigration(client, migration);
            }
            
            await client.query('COMMIT');
            console.log('✅ Transaction committed successfully\n');
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Transaction rolled back due to error\n');
            throw error;
        }
        
        // Verify final status
        console.log('🔍 Verifying migration results...\n');
        const finalStatus = await checkAllMigrations(client);
        displayStatus(finalStatus);
        
        const allApplied = Object.values(finalStatus).every(m => m.applied);
        
        if (allApplied) {
            console.log('🎉 All migrations completed successfully!\n');
            return { success: true, message: 'All migrations completed successfully' };
        } else {
            console.log('⚠️  Warning: Some migrations may not have been fully applied.\n');
            return { success: false, message: 'Some migrations may not have been fully applied' };
        }
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nStack trace:', error.stack);
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
                process.exit(0);
            } else {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Migration process failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigrations, checkAllMigrations, getMigrationFiles };
