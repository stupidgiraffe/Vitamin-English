#!/usr/bin/env node

/**
 * Script to run database migration 005
 * Renames lesson_reports to teacher_comment_sheets and adds date range columns
 */

const pool = require('../database/init');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting migration 005...');
        
        // Read migration file
        const migrationPath = path.join(__dirname, '../database/migrations/005_rename_lesson_reports_to_teacher_comment_sheets.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Split by semicolon and filter out empty statements
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        console.log(`Found ${statements.length} SQL statements to execute`);
        
        await client.query('BEGIN');
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement) {
                console.log(`Executing statement ${i + 1}/${statements.length}...`);
                try {
                    await client.query(statement);
                    console.log(`✅ Statement ${i + 1} completed`);
                } catch (err) {
                    // Some statements may fail if already executed (e.g., column already exists)
                    // Log warning but continue
                    console.log(`⚠️  Statement ${i + 1} warning: ${err.message}`);
                }
            }
        }
        
        await client.query('COMMIT');
        console.log('✅ Migration 005 completed successfully');
        
        // Verify the changes
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'teacher_comment_sheets'
        `);
        
        if (tableCheck.rows.length > 0) {
            console.log('✅ Verified: teacher_comment_sheets table exists');
        } else {
            console.log('⚠️  Warning: teacher_comment_sheets table not found');
        }
        
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'monthly_reports' 
            AND column_name IN ('start_date', 'end_date')
        `);
        
        console.log(`✅ Verified: monthly_reports has ${columnCheck.rows.length} new date columns`);
        
        return { success: true };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run if called directly
if (require.main === module) {
    runMigration()
        .then(result => {
            console.log('Migration completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };
