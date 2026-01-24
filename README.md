# Vitamin English School Management System

A beautiful, modern web application for managing student attendance and teacher lesson reports at Vitamin English School.

## Features

- 📊 **Digital Attendance Tracking** - Replace paper sheets with an intuitive spreadsheet-like interface
- 📝 **Lesson Reports** - Complete digital forms for tracking lesson details, vocabulary, mistakes, and homework
- 👥 **Enhanced Student Profiles** - Comprehensive student information including contact details, parent info, attendance history, and makeup lessons
- 📚 **Class Management** - Manage classes, teachers, and schedules
- 🔄 **Make-up Lessons Management** - Dedicated section for scheduling and tracking makeup lessons
- 🔍 **Advanced Database Search** - Cross-reference search across students, teachers, classes, attendance, and reports
- 📈 **Dashboard** - Quick overview of today's classes, makeup lessons, and recent activity
- 💾 **Data Export** - Export attendance and reports to CSV/Excel
- 🔐 **Secure Authentication** - Password-protected access with production-grade security headers
- 🛡️ **Production-Ready** - Security headers, input validation, error handling, and deployment configs

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js with Express
- **Database**: SQLite (file-based, no setup required)
- **Authentication**: bcrypt password hashing with session management

## Installation & Setup

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/stupidgiraffe/Vitamin-English.git
   cd Vitamin-English
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the application**
   - Open your browser and go to: `http://localhost:3000`
   - The database will be automatically created with sample data on first run

### Default Login Credentials

**Admin Account:**
- Username: `admin`
- Password: `admin123`

**Teacher Account:**
- Username: `sarah`
- Password: `teacher123`

**⚠️ Important:** Change these default passwords in production!

## Usage Guide

### Attendance Management

1. Navigate to the **Attendance** page
2. Select a class from the dropdown
3. Choose a date range (defaults to the last 7 days)
4. Click **Load Attendance** to view the attendance sheet
5. Click on any cell to cycle through attendance markers:
   - Empty → **O** (Present) → **X** (Absent) → **/** (Partial/Late) → Empty
6. Changes are automatically saved
7. Export to CSV using the **Export CSV** button

### Lesson Reports

1. Navigate to the **Lesson Reports** page
2. Select a class and date
3. Click **Load Report** to view/edit an existing report or **New Report** to create one
4. Fill in the form fields:
   - Target/Topic
   - New Vocabulary/Phrases
   - Mistakes (specific)
   - Strengths (specific)
   - Comments/Homework
5. Click **Save Report** to save your changes

### Administration

1. Navigate to the **Admin** page
2. Use the tabs to manage:
   - **Students**: Add, edit, or delete students with comprehensive information:
     - Basic info (name, class, type)
     - Contact information (email, phone)
     - Parent/guardian information (name, phone, email)
     - Enrollment date
     - Notes
   - **Classes**: Add, edit, or delete classes; assign teachers
   - **Teachers**: Add, edit, or delete teacher accounts
3. All changes are immediately saved to the database

### Student Profiles

1. Navigate to the **Students** page
2. Search for students by name or filter by class
3. Click on a student card to view detailed profile including:
   - Contact and parent information
   - Attendance statistics and history
   - Recent class reports
   - Scheduled makeup lessons
4. Edit student information directly from the profile view

### Make-up Lessons

1. Navigate to the **Make-up Lessons** page
2. View all scheduled, completed, and cancelled makeup lessons
3. Filter by:
   - Status (scheduled, completed, cancelled)
   - Student name
   - Date range
4. Schedule new makeup lessons with student, class, date, time, and reason
5. Edit, complete, or cancel existing makeup lessons
6. All makeup lessons are linked to student profiles

### Database Viewer & Search

1. Navigate to the **Database** page
2. Use the table selector to view data from different tables
3. **Advanced Search**:
   - Enter search terms to find records across all tables
   - Filter by type (students, teachers, classes, attendance, reports, makeup lessons)
   - Apply date range filters for time-sensitive data
   - Results are grouped by type with counts
4. Export any table or search results to CSV

## Project Structure

```
Vitamin-English/
├── server.js              # Express server and API routes configuration
├── package.json           # Node.js dependencies and scripts
├── database/
│   ├── schema.sql        # SQLite database schema
│   ├── init.js           # Database initialization with sample data
│   └── school.db         # SQLite database file (auto-generated)
├── routes/
│   ├── auth.js           # Authentication endpoints
│   ├── students.js       # Student CRUD operations
│   ├── classes.js        # Class CRUD operations
│   ├── attendance.js     # Attendance tracking endpoints
│   └── reports.js        # Lesson report endpoints
└── public/
    ├── index.html        # Main application HTML
    ├── css/
    │   └── styles.css    # Modern, responsive styling
    └── js/
        └── app.js        # Frontend application logic
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get a specific student
- `POST /api/students` - Create a new student
- `PUT /api/students/:id` - Update a student
- `DELETE /api/students/:id` - Delete a student (soft delete)

### Classes
- `GET /api/classes` - Get all classes
- `GET /api/classes/:id` - Get a specific class
- `POST /api/classes` - Create a new class
- `PUT /api/classes/:id` - Update a class
- `DELETE /api/classes/:id` - Delete a class (soft delete)

### Attendance
- `GET /api/attendance` - Get attendance records (with filters)
- `GET /api/attendance/matrix` - Get attendance in matrix format
- `POST /api/attendance` - Create or update attendance record
- `PUT /api/attendance/:id` - Update attendance record
- `DELETE /api/attendance/:id` - Delete attendance record

### Lesson Reports
- `GET /api/reports` - Get all lesson reports (with filters)
- `GET /api/reports/:id` - Get a specific report
- `GET /api/reports/by-date/:classId/:date` - Get report by class and date
- `POST /api/reports` - Create a new report
- `PUT /api/reports/:id` - Update a report
- `DELETE /api/reports/:id` - Delete a report

## Development

To run in development mode with auto-reload:

```bash
npm run dev
```

This uses nodemon to automatically restart the server when files change.

## Data Backup

The SQLite database is stored as a single file: `database/school.db`

To backup your data:
1. Stop the server
2. Copy `database/school.db` to a safe location
3. Restart the server

To restore:
1. Stop the server
2. Replace `database/school.db` with your backup
3. Restart the server

## Security Features

- Password hashing using bcrypt
- Session-based authentication
- HTTP-only session cookies
- Input validation on all forms
- SQL injection prevention using prepared statements
- Soft deletes to preserve data integrity

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (responsive design)

## Production Deployment

### Important: Before deploying to production

1. **Change default passwords** - Update or remove the sample users
2. **Set a strong session secret** - Use the `SESSION_SECRET` environment variable (minimum 32 characters)
3. **Configure HTTPS** - Use a reverse proxy like nginx or deploy on platforms with automatic HTTPS
4. **Set proper file permissions** - Restrict access to `database/school.db`
5. **Regular backups** - Set up automated database backups
6. **Update CORS origin** - Set `CORS_ORIGIN` to your production domain

### Deploy to Vercel (Recommended for New Deployments)

Vercel provides seamless deployment with automatic HTTPS, zero-config, and excellent performance.

#### Quick Deploy to Vercel

1. **Install Vercel CLI** (optional):
   ```bash
   npm install -g vercel
   ```

2. **Fork this repository** to your GitHub account

3. **Deploy via Vercel Dashboard**:
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click "Add New Project"
   - Import your forked repository
   - Vercel will automatically detect the Node.js configuration
   - Click "Deploy"

4. **Or deploy via CLI**:
   ```bash
   vercel
   ```
   Follow the prompts to link your project

5. **Set environment variables** in Vercel dashboard (Settings → Environment Variables):
   ```
   SESSION_SECRET=your-strong-random-secret-key-min-32-chars
   NODE_ENV=production
   CORS_ORIGIN=https://your-app.vercel.app
   ```

6. **Important: Database Persistence on Vercel**
   
   ⚠️ **Note**: Vercel's serverless functions are stateless, so SQLite database changes won't persist between deployments. For Vercel deployment, you should either:
   
   **Option A: Use Vercel Postgres (Recommended for Production)**
   - Add Vercel Postgres to your project
   - Update the database connection to use PostgreSQL instead of SQLite
   - This provides a persistent, production-grade database
   
   **Option B: Keep using Railway for Production Database**
   - Keep your existing Railway deployment as the production instance (as requested)
   - Use Vercel deployment as a preview/staging environment
   - Both can run simultaneously

7. **Access your app**:
   - Vercel provides a URL like `your-app.vercel.app`
   - Custom domains can be configured in project settings
   - The health check endpoint will be available at `/health`

#### Custom Domain Setup (Vercel)

1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `school.yourdomain.com`)
3. Configure DNS records as instructed by Vercel
4. SSL certificate is automatically provisioned

### Deploy to Railway (Current Production - Leave As-Is)

Railway provides a simple one-click deployment with automatic HTTPS and persistent storage.

**Note**: As requested, your existing Railway deployment should remain untouched as a preview for stakeholders.

#### Quick Deploy

1. **Fork this repository** to your GitHub account

2. **Create a Railway account** at [railway.app](https://railway.app)

3. **Deploy from GitHub**:
   - Click "New Project" in Railway
   - Select "Deploy from GitHub repo"
   - Choose your forked repository
   - Railway will auto-detect the configuration from `railway.json`

4. **Set environment variables** in Railway dashboard:
   ```
   SESSION_SECRET=your-strong-random-secret-key
   NODE_ENV=production
   CORS_ORIGIN=https://your-app.up.railway.app
   ```

5. **Access your app**:
   - Railway will provide a public URL (e.g., `your-app.up.railway.app`)
   - The health check endpoint will be available at `/health`

#### Database Persistence on Railway

Railway automatically persists the SQLite database file (`database/school.db`):
- The database is stored in the project volume
- Data persists across deployments
- **Important**: To backup your database, use Railway's volume backup feature

#### Database Backup Instructions

**Manual Backup:**
1. Connect to your Railway service via CLI: `railway run bash`
2. Copy the database: `cp database/school.db /tmp/backup.db`
3. Download the backup file from the Railway dashboard

**Automated Backups:**
- Enable Railway's volume snapshots feature
- Configure daily snapshots in the Railway project settings
- Snapshots are stored for 7 days by default

### Deploy to Other Platforms

The application can be deployed on any platform that supports Node.js:
- Heroku
- DigitalOcean
- AWS
- Render

Basic deployment steps:
1. Upload all files to your server
2. Run `npm install --production`
3. Set environment variables (see `.env.example`)
4. Run `npm start`

### Post-Deployment Checklist

After deploying to any platform:

- [ ] Verify health endpoint works: `https://your-domain.com/health`
- [ ] Test login with default credentials
- [ ] **Immediately change default passwords** for admin and teacher accounts
- [ ] Test all major features (attendance, reports, students, database search, makeup lessons)
- [ ] Set up automated database backups
- [ ] Configure monitoring/alerting
- [ ] Test mobile responsiveness
- [ ] Update CORS_ORIGIN to match your production domain

## Troubleshooting

**Database not found:**
- The database is auto-created on first run
- Check that you have write permissions in the `database/` folder

**Port already in use:**
- Change the port in `server.js` or set the PORT environment variable
- `PORT=3001 npm start`

**Login not working:**
- Clear your browser cookies and cache
- Check the console for error messages

## License

MIT License - feel free to use this for your school or organization.

## Support

For issues or questions, please open an issue on GitHub.