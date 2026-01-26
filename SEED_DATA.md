# Seed Data Guide

This guide explains how to use the seeding functionality to populate your Vitamin English database with test data.

## What is Seed Data?

The seed data provides a starting point for your application with:
- **4 classes**: Adult beginner, Intermediate, Advanced, Young elementary
- **12 students**: 3 students per class with realistic contact information
- **Sample attendance records**: 3 days of attendance history

This data is perfect for:
- Testing the application features
- Training staff on how to use the system
- Demo purposes
- Development and staging environments

## Automatic Seeding on Startup

By default, the application automatically seeds the database **only if it's empty** (no classes exist).

### Control Auto-Seeding

You can control this behavior with the `SEED_ON_STARTUP` environment variable:

**Enable auto-seeding (default):**
```bash
# Don't set SEED_ON_STARTUP, or set it to anything except 'false'
SEED_ON_STARTUP=true
```

**Disable auto-seeding:**
```bash
SEED_ON_STARTUP=false
```

### When to Disable Auto-Seeding

Set `SEED_ON_STARTUP=false` in these scenarios:
- **Production environments** where you'll be entering real student data
- When you want complete control over when seeding happens
- When migrating existing data from another system

## Manual Seeding via Admin Endpoint

Administrators can manually trigger seeding through the API:

### Seed Data

**Endpoint:** `POST /api/admin/seed-data`

**Requirements:**
- Must be logged in as an admin user
- Database should be empty (the endpoint checks for existing data)

**Using curl:**
```bash
curl -X POST https://your-domain.com/api/admin/seed-data \
  -H "Content-Type: application/json" \
  --cookie "vitamin_session=your-session-cookie"
```

**Response (Success):**
```json
{
  "success": true
}
```

**Response (Data Already Exists):**
```json
{
  "success": true,
  "message": "Data already exists"
}
```

### Clear All Data

**⚠️ DANGER:** This endpoint deletes ALL data from your database!

**Endpoint:** `POST /api/admin/clear-data`

**Requirements:**
- Must be logged in as an admin user
- Use with extreme caution!

**Using curl:**
```bash
curl -X POST https://your-domain.com/api/admin/clear-data \
  -H "Content-Type: application/json" \
  --cookie "vitamin_session=your-session-cookie"
```

## Seed Data Contents

### Classes Created

1. **Adult beginner**
   - Schedule: Mon/Wed 10:00-11:30
   - Color: Blue (#4285f4)

2. **Intermediate**
   - Schedule: Tue/Thu 14:00-15:30
   - Color: Green (#34a853)

3. **Advanced**
   - Schedule: Fri 11:00-13:00
   - Color: Red (#ea4335)

4. **Young elementary**
   - Schedule: Sat 09:00-10:00
   - Color: Yellow (#fbbc04)

### Students Created

Each class gets 3 students with realistic information:

**Adult beginner:**
- Emma Wilson (parent: Robert Wilson)
- James Anderson (parent: Mary Anderson)
- Sophia Martinez (parent: Carlos Martinez)

**Intermediate:**
- Oliver Taylor (parent: Jennifer Taylor)
- Charlotte Brown (parent: David Brown)
- Liam Johnson (parent: Sarah Johnson)

**Advanced:**
- Ava Davis (parent: Michael Davis)
- Noah Garcia (parent: Patricia Garcia)
- Isabella Rodriguez (parent: Jose Rodriguez)

**Young elementary:**
- Ethan Smith (parent: Linda Smith)
- Mia Lee (parent: Kevin Lee)
- Lucas White (parent: Nancy White)

Each student includes:
- Full name
- Parent/guardian name
- Contact phone number (555-xxxx format)
- Email address

### Attendance Records

The seed creates 3 days of attendance history with:
- Realistic attendance patterns (85% attendance rate)
- Distributed across the past 3 days
- Records for all students in each class

## Development Workflow

### First-Time Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/stupidgiraffe/Vitamin-English.git
   cd Vitamin-English
   npm install
   ```

2. **Configure database:**
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

4. **Seed data loads automatically!**
   The application detects the empty database and loads test data.

### Testing with Fresh Data

1. **Login as admin:**
   - Username: `admin`
   - Password: `admin123`

2. **Clear existing data:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/clear-data \
     --cookie "vitamin_session=your-session-cookie"
   ```

3. **Reload seed data:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/seed-data \
     --cookie "vitamin_session=your-session-cookie"
   ```

## Production Deployment

### Recommended Approach

For production deployments to Vercel:

1. **Disable auto-seeding:**
   ```bash
   # In Vercel environment variables
   SEED_ON_STARTUP=false
   ```

2. **Seed once manually:**
   - Deploy the application
   - Login as admin
   - Use the admin endpoint to seed data once
   - This creates the initial classes and test students

3. **Replace test data with real data:**
   - Edit the test students to add real student information
   - Add additional classes as needed
   - Test students can be deleted or deactivated

### Migration from Existing System

If you're migrating from another system:

1. **Set `SEED_ON_STARTUP=false`**
2. **Don't use the seed endpoints**
3. **Import your existing data:**
   - Use the migration script in `scripts/migrate-to-neon.js`
   - Or manually add students/classes through the UI
   - Or write a custom import script

## Customizing Seed Data

To customize the seed data (e.g., different class names, more students):

1. **Edit the seed file:**
   ```bash
   # Edit database/seed-test-data.js
   vi database/seed-test-data.js
   ```

2. **Modify the classes array:**
   ```javascript
   const classes = [
       { name: 'Your Class Name', schedule: 'Mon 10:00', color: '#4285f4' },
       // Add more classes...
   ];
   ```

3. **Modify the students array:**
   ```javascript
   const students = [
       { name: 'Student Name', parent: 'Parent Name', phone: '555-0000', email: 'email@example.com', classIdx: 0 },
       // Add more students...
   ];
   ```

4. **Deploy or restart the application**

## Troubleshooting

### Seed data not loading on startup

**Check:**
1. Is `SEED_ON_STARTUP` set to `false`?
2. Does the database already have classes?
3. Check server logs for errors

**Solution:**
- Remove `SEED_ON_STARTUP=false` or set it to `true`
- Use the manual seed endpoint
- Check database connection

### "Data already exists" error

**Cause:** The database already has classes.

**Solutions:**
1. **Keep existing data:** No action needed, your data is safe
2. **Reset and seed:** Use the clear-data endpoint first (⚠️ DANGER)
3. **Manual management:** Add classes/students through the UI

### Seed endpoint returns 403 Forbidden

**Cause:** Not logged in as an admin.

**Solution:**
1. Login with admin credentials (username: `admin`, password: `admin123`)
2. Ensure you're passing the session cookie
3. Check that the user has the `admin` role

### Classes created but no students

**Check:**
- Server logs for errors during student creation
- Database foreign key constraints
- Teacher/user exists in the database

**Solution:**
- Ensure the teacher user is created before seeding
- Check the `initializeDatabase()` function ran successfully

## Security Considerations

### Production Security

1. **Change default admin password:**
   ```sql
   -- After deployment, immediately change the password
   UPDATE users SET password_hash = 'new-bcrypt-hash' WHERE username = 'admin';
   ```

2. **Limit admin endpoint access:**
   - The seed/clear endpoints require admin authentication
   - Only expose these endpoints in development/staging
   - Consider removing them in production builds

3. **Disable auto-seeding in production:**
   ```bash
   SEED_ON_STARTUP=false
   ```

4. **Monitor seed endpoint usage:**
   - Log all calls to seed/clear endpoints
   - Alert on unexpected usage

### Development Security

Even in development:
- Don't commit real student data
- Use fake names and contact information
- Don't use real email addresses in seed data

## Summary

- **Auto-seeding**: Enabled by default, controlled by `SEED_ON_STARTUP`
- **Manual seeding**: Available via admin endpoint
- **Production**: Disable auto-seeding, use manual endpoint once
- **Safety**: Seed checks for existing data before inserting
- **Customization**: Edit `database/seed-test-data.js`

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).
