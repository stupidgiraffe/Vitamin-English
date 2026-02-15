# Quick Start: Enable Neon Database Access

This is the TL;DR version. For full details, see [NEON_DATABASE_ACCESS_GUIDE.md](NEON_DATABASE_ACCESS_GUIDE.md).

## 🎯 Goal

Enable automated database migrations that work with GitHub Actions and Copilot agents.

## ⚡ Quick Setup (5 minutes)

### Step 1: Add DATABASE_URL Secret

1. Get your Neon connection string from [Neon Console](https://console.neon.tech/)
2. Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `DATABASE_URL`
5. Value: Your Neon connection string (e.g., `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require`)
6. Click **Add secret**

### Step 2: Test the Workflow

1. Go to **Actions** tab in GitHub
2. Find "Apply Database Migrations" workflow
3. Click **Run workflow**
4. Watch it apply all pending migrations automatically!

## ✅ What This Enables

- ✅ Automated migrations on every deploy
- ✅ Manual migration runs from GitHub Actions
- ✅ Copilot agents can run migrations (with your approval)
- ✅ Safe, transaction-based updates
- ✅ No more manual SQL copy/paste!

## 📝 Commands Available

```bash
# Apply all pending migrations
npm run migrate:all

# Apply specific older migrations (004-006)
npm run migrate

# Check migration status (dry-run)
# Use GitHub Actions workflow with "dry_run" = true
```

## 🚀 Current Status

**Migration 009 is pending** - adds DataHub improvements:
- `updated_at` columns on all tables
- Auto-update triggers
- Performance indexes
- Database stats view

**To apply it now:**
1. Ensure `DATABASE_URL` secret is configured (Step 1 above)
2. Run the GitHub Actions workflow (Step 2 above)
3. Or run locally: `npm run migrate:all`

## 🔒 Security

- Credentials stored as encrypted GitHub Secrets
- Only visible to authorized workflows
- Transaction-based migrations (rollback on error)
- Audit trail in GitHub Actions logs

## 📚 Files Added

- `.github/workflows/apply-migrations.yml` - Auto-migration workflow
- `scripts/apply-all-migrations.js` - Universal migration runner
- `NEON_DATABASE_ACCESS_GUIDE.md` - Complete documentation

## 💡 For Copilot Users

When Copilot asks to run migrations:
1. It will request access to `DATABASE_URL` secret
2. Approve the request (one-time per session)
3. Copilot runs migrations and reports results
4. All actions are logged and auditable

## ❓ Need Help?

- Full guide: [NEON_DATABASE_ACCESS_GUIDE.md](NEON_DATABASE_ACCESS_GUIDE.md)
- Database setup: [DATABASE_SETUP_GUIDE.md](DATABASE_SETUP_GUIDE.md)
- Deployment: [DEPLOYMENT.md](DEPLOYMENT.md)

---

**That's it!** Once `DATABASE_URL` is configured, migrations run automatically. 🎉
