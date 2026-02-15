# Neon Database Access Guide

## Purpose

This guide shows you how to set up Neon database access for **automated migrations** and **CI/CD operations** so that database schema updates can be applied automatically without manual intervention.

## The Problem We're Solving

When code changes require database schema updates (like adding columns, indexes, or triggers), you need a way to:
1. ✅ Apply migrations automatically when deploying
2. ✅ Allow CI/CD tools to access the database securely
3. ✅ Keep database credentials secure (not in code)
4. ✅ Enable Copilot agents to run migrations when needed

## Solution: GitHub Secrets + Automated Workflows

### Step 1: Set Up GitHub Repository Secrets

GitHub Secrets allow you to store sensitive information (like database credentials) securely and make them available to workflows and Copilot agents.

#### 1a. Get Your Neon Connection String

1. Go to [Neon Console](https://console.neon.tech/)
2. Select your project: `vitamin-english`
3. Click on **Connection Details**
4. Copy the **Connection String** (it looks like this):
   ```
   postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```

#### 1b. Add the Secret to GitHub

1. Go to your GitHub repository: `stupidgiraffe/Vitamin-English`
2. Click **Settings** (top menu)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Enter the following:
   - **Name**: `DATABASE_URL`
   - **Secret**: Paste your Neon connection string
6. Click **Add secret**

#### 1c. (Optional) Add for Copilot Access

To allow GitHub Copilot agents to access the database:

1. In the same **Secrets and variables** section
2. Click on **Codespaces** tab (next to Actions)
3. Click **New repository secret**
4. Enter:
   - **Name**: `DATABASE_URL`
   - **Secret**: Same Neon connection string
5. Click **Add secret**

### Step 2: Create Automated Migration Workflow

Create a GitHub Actions workflow that automatically applies database migrations.

#### 2a. Create the Workflow File

The workflow file should already exist at `.github/workflows/apply-migrations.yml`. If not, create it with:

```yaml
name: Apply Database Migrations

on:
  workflow_dispatch: # Manual trigger
  push:
    branches:
      - main
    paths:
      - 'database/migrations/*.sql'
      - 'database/schema-postgres.sql'

jobs:
  migrate:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npm run migrate
      
      - name: Verify migration status
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: node -e "require('./scripts/apply-migrations').checkMigrationStatus(require('./database/connection')).then(s => console.log(JSON.stringify(s, null, 2)))"
```

#### 2b. Test the Workflow

1. Go to **Actions** tab in your GitHub repository
2. Find "Apply Database Migrations" workflow
3. Click **Run workflow** button
4. Select the branch (usually `main`)
5. Click **Run workflow**
6. Watch the logs to ensure migrations apply successfully

### Step 3: Enable Manual Migration Runs

You can also run migrations manually anytime using the workflow:

1. Go to **Actions** tab
2. Click "Apply Database Migrations"
3. Click "Run workflow"
4. Confirm and watch the output

### Step 4: Automatic Migration on Deploy

The workflow is configured to run automatically when:
- You push changes to `main` branch
- Changes include files in `database/migrations/` or `database/schema-postgres.sql`

This means migrations will apply automatically before your app redeploys!

## For Copilot Agents

With the `DATABASE_URL` secret configured in Codespaces/Actions, Copilot agents can now:

1. Access the secret when you explicitly approve it
2. Run migration scripts using `psql` or Node.js
3. Verify data integrity before and after migrations
4. Report results back to you

### How to Grant Access to Copilot

When a Copilot agent requests database access:

1. The agent will ask you to inject the `DATABASE_URL` secret
2. GitHub will prompt you to approve secret access
3. Approve the request (one-time per session)
4. The agent can then run migrations automatically

## Migration Best Practices

### Always Use Safe Patterns

✅ **DO** use these safe SQL patterns:
```sql
-- Add columns safely
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Create indexes safely
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- Recreate triggers safely
DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at ...;

-- Create views safely
CREATE OR REPLACE VIEW database_stats AS ...;
```

❌ **DON'T** use destructive operations:
```sql
-- NEVER do this in production
DROP TABLE students;
ALTER TABLE students DROP COLUMN name;
DELETE FROM students;
TRUNCATE students;
```

### Migration File Naming

Migrations are numbered sequentially:
```
001_add_student_contact_fields.sql
002_normalize_date_formats.sql
003_add_attendance_time_field.sql
...
009_datahub_improvements.sql
010_your_new_migration.sql  ← Next migration
```

### Testing Migrations

Before applying to production:

1. **Test locally first:**
   ```bash
   # With local DATABASE_URL
   npm run migrate
   ```

2. **Check migration status:**
   ```bash
   node scripts/apply-migrations.js
   ```

3. **Verify in Neon SQL Editor:**
   - Go to Neon Console → SQL Editor
   - Run verification queries to confirm changes

## Current Migration Status

Your repository already has these migrations:

| # | Migration | Status |
|---|-----------|--------|
| 001 | Add student contact fields | ✅ Applied |
| 002 | Normalize date formats | ✅ Applied |
| 003 | Add attendance time field | ✅ Applied |
| 004 | Create monthly reports | ✅ Applied |
| 005 | Rename lesson reports | ✅ Applied |
| 006 | Monthly reports unique range | ✅ Applied |
| 007 | Add attendance teacher ID | ✅ Applied |
| 008 | Fix attendance unique constraint | ✅ Applied |
| 009 | DataHub improvements | ⏳ **Pending** |

### To Apply Migration 009

The migration 009 adds important schema updates for the DataHub architecture:
- `updated_at` columns on key tables
- Auto-update triggers
- Performance indexes
- Database statistics view

**To apply it now:**

**Option A - Via GitHub Actions** (Recommended):
1. Ensure `DATABASE_URL` secret is configured (Step 1)
2. Go to Actions → "Apply Database Migrations" → Run workflow
3. Or push a change to trigger it automatically

**Option B - Via Local Script**:
```bash
# Ensure DATABASE_URL is in your .env file
npm run migrate
```

**Option C - Via Copilot Agent**:
1. Ensure `DATABASE_URL` secret is available to Codespaces
2. Ask Copilot: "Apply migration 009 to the Neon database"
3. Approve secret access when prompted
4. Copilot will run the migration and report results

## Security Notes

🔒 **Database credentials are secure:**
- Secrets are encrypted by GitHub
- Only visible to authorized workflows and agents
- Never exposed in logs or code
- Automatically injected as environment variables

🔒 **Access is controlled:**
- Only repository admins can add/edit secrets
- Workflow runs are audited in Actions tab
- Copilot requires explicit approval for secret access

🔒 **Best practices:**
- Use separate databases for production/staging/development
- Rotate credentials periodically
- Use Neon's branching feature for testing migrations
- Always review migration SQL before applying

## Troubleshooting

### "DATABASE_URL is not set" Error

**In GitHub Actions:**
- Verify secret exists: Settings → Secrets → Actions → DATABASE_URL
- Check workflow file uses: `${{ secrets.DATABASE_URL }}`

**For Copilot:**
- Verify secret exists: Settings → Secrets → Codespaces → DATABASE_URL
- Approve secret access when prompted

### "Connection refused" or "Cannot connect"

- Verify Neon project is active (not suspended for inactivity)
- Check connection string is complete (includes `?sslmode=require`)
- Ensure IP allowlist in Neon allows GitHub Actions IPs (usually not needed)

### Migration Fails Midway

Migrations use transactions, so failures rollback automatically:
1. Check error message in workflow logs
2. Fix the migration SQL file
3. Re-run the workflow
4. Migration will skip already-applied changes

### Need to Rollback

Neon doesn't support automatic rollbacks, but you can:
1. Use Neon's **Time Travel** feature (point-in-time recovery)
2. Create a reverse migration (e.g., `DROP COLUMN`, `DROP INDEX`)
3. Restore from Neon backup

## Summary

✅ **What you've set up:**
- Secure database credentials in GitHub Secrets
- Automated migration workflow via GitHub Actions
- Copilot agent access to database (when approved)
- Safe, repeatable migration process

✅ **What happens now:**
- Schema changes apply automatically on deploy
- Migrations can be run manually anytime
- Copilot can help with database tasks
- No more manual SQL Editor copy/paste needed!

✅ **Next steps:**
1. Ensure `DATABASE_URL` secret is configured
2. Run the migration workflow to apply migration 009
3. Verify app works correctly with new schema
4. Future migrations will apply automatically

## Additional Resources

- [Neon Documentation](https://neon.tech/docs)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [PostgreSQL Migrations Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)
- Repository: `DATABASE_SETUP_GUIDE.md` - Initial setup guide
- Repository: `DEPLOYMENT.md` - Full deployment guide
