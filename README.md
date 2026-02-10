# Vitamin English School Management System

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/stupidgiraffe/Vitamin-English)

A beautiful, modern web application for managing student attendance and teacher lesson reports at Vitamin English School. Now with enhanced PDF generation and flexible search capabilities!

## Features

- 📊 **Digital Attendance Tracking** - Replace paper sheets with an intuitive spreadsheet-like interface
- 📝 **Lesson Reports** - Complete digital forms for tracking lesson details, vocabulary, mistakes, and homework
- 👥 **Enhanced Student Profiles** - Comprehensive student information including contact details, parent info, attendance history, and makeup lessons
- 📚 **Class Management** - Manage classes, teachers, and schedules
- 🔄 **Make-up Lessons Management** - Dedicated section for scheduling and tracking makeup lessons
- 🔍 **Advanced Database Search** - Cross-reference search across students, teachers, classes, attendance, and reports
  - **NEW**: Search without keywords - filter by type and date range only
  - **NEW**: Flexible filtering - any combination of query, type, and date filters
- 📈 **Dashboard** - Quick overview of today's classes, makeup lessons, and recent activity
- 💾 **Data Export** - Export attendance and reports to CSV/Excel
- 📄 **PDF Generation** - Generate professional PDFs for:
  - Student attendance reports
  - Class attendance sheets
  - Lesson reports
- ☁️ **Cloud Storage** - PDFs automatically uploaded to Cloudflare R2 with download links
- 🔐 **Secure Authentication** - Password-protected access with production-grade security headers
- 🛡️ **Production-Ready** - Security headers, input validation, error handling, and deployment configs

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js with Express
- **Database**: PostgreSQL (Neon) - Production-grade, scalable database
- **Data Layer**: **DataHub Architecture** - Centralized data access with Repository Pattern
- **PDF Generation**: PDFKit
- **Cloud Storage**: Cloudflare R2 (S3-compatible)
- **Authentication**: bcrypt password hashing with session management
- **Deployment**: Vercel (serverless functions)

## Architecture

### DataHub Pattern

The application uses a centralized **DataHub architecture** with the Repository Pattern for data access:

```
Routes → DataHub → Repositories → Database
```

#### Key Components:

- **DataHub** (`database/DataHub.js`) - Singleton service providing centralized access to all repositories
- **Repositories** (`database/repositories/`) - Entity-specific data access layers
  - `StudentRepository` - Student CRUD operations with attendance stats
  - `ClassRepository` - Class management with teacher joins
  - `AttendanceRepository` - Attendance tracking with upsert and statistics
  - `TeacherCommentSheetRepository` - Lesson reports and teacher comments
  - `MakeupLessonRepository` - Makeup lesson scheduling
  - `MonthlyReportRepository` - Monthly report generation
  - `UserRepository` - User authentication and management
  - `PdfHistoryRepository` - PDF generation history
- **QueryBuilder** (`database/utils/QueryBuilder.js`) - Fluent query builder for parameterized SQL
- **BaseRepository** (`database/repositories/BaseRepository.js`) - Common CRUD operations

#### Benefits:

✅ **Centralized Data Access** - All database operations go through the DataHub layer  
✅ **Code Reusability** - Common operations (CRUD, pagination, filtering) inherited from BaseRepository  
✅ **SQL Injection Prevention** - All queries use parameterized statements via QueryBuilder  
✅ **Testability** - Easy to mock repositories for unit testing  
✅ **Maintainability** - Database logic separated from business logic

#### Usage Example:

```javascript
const dataHub = require('./database/DataHub');

// Get all students in a class
const students = await dataHub.students.findAll({ classId: 1 });

// Get student profile with attendance stats
const profile = await dataHub.students.getProfile(studentId);

// Search across all entities
const results = await dataHub.searchAll('John', { 
    type: 'students', 
    page: 1, 
    perPage: 50 
});

// Database health check
const health = await dataHub.healthCheck();

// Database statistics
const stats = await dataHub.getStats();
```

#### New API Endpoints:

- `GET /api/database/health` - Database health check with latency
- `GET /api/database/stats` - Database statistics (table sizes, row counts, pool stats)
- `GET /api/database/search?query=&type=&startDate=&endDate=&page=&perPage=` - Unified search
- `GET /api/database/table/:tableName?page=&perPage=` - Get table data with pagination

## Installation & Setup

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)
- PostgreSQL database (use [Neon](https://neon.tech) for free hosted PostgreSQL)
- Cloudflare R2 account (optional, for PDF storage features)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/stupidgiraffe/Vitamin-English.git
   cd Vitamin-English
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   DATABASE_URL=postgresql://localhost:5432/vitamin_english
   SESSION_SECRET=your-random-secret-key-here
   NODE_ENV=development
   
   # Optional: For PDF features
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret-key
   R2_BUCKET_NAME=vitamin-english-pdfs
   R2_ENDPOINT=https://account-id.r2.cloudflarestorage.com
   ```

4. **Initialize the database**
   
   The application will automatically create tables and seed with test data on first run.
   - Includes 4 classes: Adult beginner, Intermediate, Advanced, Young elementary
   - Includes 12 sample students with realistic contact information
   - See [SEED_DATA.md](SEED_DATA.md) for details on seed data and customization

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the application**
   - Open your browser and go to: `http://localhost:3000`
   - The database will be automatically initialized with sample data
   - Login with default credentials (see below)

### Production Deployment to Vercel

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Quick Deploy:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/stupidgiraffe/Vitamin-English)

**Manual Steps:**

1. Set up [Neon PostgreSQL](https://neon.tech) database
2. Set up [Cloudflare R2](https://cloudflare.com/r2) bucket (optional)
3. Deploy to [Vercel](https://vercel.com)
4. Configure environment variables in Vercel
5. Import your data using `scripts/migrate-to-neon.js`

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete step-by-step instructions.

### Default Login Credentials

**Admin Account:**
- Username: `admin`
- Password: `admin123`

**Teacher Account:**
- Username: `sarah`
- Password: `teacher123`

**⚠️ Important:** Change these default passwords immediately after deployment!

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

### Database Viewer & Advanced Search

1. Navigate to the **Database** page
2. Use the table selector to view data from different tables
3. **Advanced Search** (Enhanced!):
   - **Flexible filtering** - No longer requires a search query!
   - **Search by type only**: Select type (e.g., "students") to see all records of that type
   - **Search by date range only**: Set start/end dates to filter time-sensitive data
   - **Search with keywords**: Enter search terms to find records across all tables
   - **Combine filters**: Use any combination of query, type, and date filters
   
   **Examples:**
   - `?type=students` → View all students
   - `?startDate=2026-01-01&endDate=2026-01-31&type=attendance` → All attendance in January
   - `?query=John&type=students` → Search for students named "John"
   - `?query=English&type=reports&startDate=2026-01-01` → Reports about "English" since Jan 1

4. Results are grouped by type with counts
5. Export any table or search results to CSV

### PDF Generation (NEW!)

Generate professional PDF reports with automatic cloud storage:

#### Student Attendance Reports

1. Navigate to a student's profile or the Students page
2. Click **"Generate PDF"** button
3. PDF includes:
   - Student information
   - Complete attendance history
   - Attendance statistics and rate
4. PDF is automatically uploaded to cloud storage
5. Download link provided immediately

#### Class Attendance Sheets

1. Navigate to the Attendance page
2. Select a class and date
3. Click **"Generate PDF"** button
4. PDF includes:
   - Class and teacher information
   - All students in the class
   - Attendance status for the selected date
   - Summary statistics
5. Perfect for printing or emailing to administration

#### Lesson Report PDFs

1. Navigate to the Lesson Reports page
2. View a specific report
3. Click **"Generate PDF"** button
4. PDF includes:
   - Class and teacher information
   - Lesson topic and vocabulary
   - Student strengths and mistakes
   - Comments and homework
5. Professional formatting for sharing with parents or administration

#### PDF History

1. Navigate to the Database page → PDF History tab
2. View all generated PDFs with:
   - Filename and type
   - Creation date and creator
   - Student/class associated
   - File size
3. Click **"Download"** to get a secure download link
4. Links are valid for 1 hour

**Note:** PDF generation requires Cloudflare R2 configuration. If not configured, the feature will show an appropriate message.

## Project Structure

```
Vitamin-English/
├── server.js                   # Express server and API routes configuration
├── package.json                # Node.js dependencies and scripts
├── DEPLOYMENT.md               # Detailed deployment guide
├── database/
│   ├── schema-postgres.sql    # PostgreSQL database schema
│   ├── schema.sql             # Original SQLite schema (legacy)
│   └── init.js                # Database initialization with sample data
├── routes/
│   ├── auth.js                # Authentication endpoints
│   ├── students.js            # Student CRUD operations
│   ├── classes.js             # Class CRUD operations
│   ├── attendance.js          # Attendance tracking endpoints
│   ├── reports.js             # Lesson report endpoints
│   ├── database.js            # Database viewer and search
│   ├── makeup.js              # Makeup lessons management
│   └── pdf.js                 # PDF generation endpoints (NEW)
├── utils/
│   ├── pdfGenerator.js        # PDF generation utilities (NEW)
│   └── r2Storage.js           # Cloudflare R2 storage utilities (NEW)
├── scripts/
│   └── migrate-to-neon.js     # SQLite to PostgreSQL migration script
└── public/
    ├── index.html             # Main application HTML
    ├── css/
    │   └── styles.css         # Modern, responsive styling
    └── js/
        └── app.js             # Frontend application logic
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

### Database & Search
- `GET /api/database/table/:tableName` - Get data from a specific table
- `GET /api/database/search` - Advanced search (enhanced - query parameter now optional!)
  - Query parameters: `query` (optional), `type`, `startDate`, `endDate`
  - Examples:
    - `/api/database/search?type=students` - All students
    - `/api/database/search?startDate=2026-01-01&endDate=2026-01-31&type=attendance` - Attendance in date range
    - `/api/database/search?query=John&type=students` - Search students for "John"

### PDF Generation (NEW)
- `POST /api/pdf/student-attendance/:studentId` - Generate student attendance PDF
- `POST /api/pdf/class-attendance/:classId` - Generate class attendance PDF (requires `date` in body)
- `POST /api/pdf/lesson-report/:reportId` - Generate lesson report PDF
- `GET /api/pdf/history` - List all generated PDFs (with optional `type` filter)
- `GET /api/pdf/download/:pdfId` - Get download URL for a PDF

### Make-up Lessons
- `GET /api/makeup` - Get all makeup lessons (with filters)
- `POST /api/makeup` - Schedule a new makeup lesson
- `PUT /api/makeup/:id` - Update a makeup lesson
- `DELETE /api/makeup/:id` - Delete a makeup lesson

## Development

To run in development mode with auto-reload:

```bash
npm run dev
```

This uses nodemon to automatically restart the server when files change.

## Data Backup

### PostgreSQL (Neon) Backups

**Automatic backups:**
- Neon provides automatic backups (7-30 days retention depending on plan)
- Point-in-time recovery available

**Manual backup:**
```bash
pg_dump "postgresql://username:password@host/database" > backup.sql
```

**Restore:**
```bash
psql "postgresql://username:password@host/database" < backup.sql
```

### PDF Storage Backups

PDFs are stored in Cloudflare R2:
- List all PDFs via `/api/pdf/history`
- Download PDFs individually
- Consider R2 bucket replication for redundancy

## Security Features

- Password hashing using bcrypt
- Session-based authentication
- HTTP-only session cookies
- Secure session secrets
- Input validation on all forms
- SQL injection prevention using parameterized queries
- Soft deletes to preserve data integrity
- HTTPS enforced in production
- CORS protection
- Security headers (CSP, X-Frame-Options, etc.)

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (fully responsive design)

## Production Deployment

For complete deployment instructions, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/stupidgiraffe/Vitamin-English)

### Prerequisites

1. **Neon PostgreSQL** - Sign up at [neon.tech](https://neon.tech)
2. **Cloudflare R2** (optional) - Set up at [cloudflare.com](https://cloudflare.com/r2)
3. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)

### Deployment Steps

1. **Set up Neon Database**
   - Create a new Neon project
   - Copy connection string
   - Run `database/schema-postgres.sql` in Neon SQL Editor

2. **Configure Cloudflare R2** (optional, for PDF features)
   - Create R2 bucket
   - Generate API tokens
   - Save credentials

3. **Deploy to Vercel**
   - Import repository
   - Configure environment variables
   - Deploy!

4. **Migrate Data** (if coming from Railway)
   - Run `node scripts/migrate-to-neon.js` on Railway
   - Import generated SQL to Neon

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed step-by-step instructions.

### Important: Before deploying to production

1. **Change default passwords** - Update or remove the sample users
2. **Set a strong session secret** - Use the `SESSION_SECRET` environment variable (minimum 32 characters)
3. **Configure environment variables** - Set all required variables in Vercel
4. **Update CORS origin** - Set `CORS_ORIGIN` to your production domain
5. **Test all features** - Verify login, attendance, reports, search, and PDF generation
6. **Set up monitoring** - Use Vercel Analytics and Neon monitoring

### Environment Variables

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete environment variable documentation.

**Required variables:**
- `DATABASE_URL` - Neon PostgreSQL connection string
- `SESSION_SECRET` - Random secret key (32+ characters)
- `NODE_ENV` - Set to `production`

**Optional (for PDF features):**
- `R2_ACCOUNT_ID` - Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_ENDPOINT` - R2 endpoint URL

**Optional (for seed data control):**
- `SEED_ON_STARTUP` - Set to `false` to disable automatic seeding on startup (default: enabled if database is empty)
  - See [SEED_DATA.md](SEED_DATA.md) for complete seed data documentation

**Optional (for debugging):**
- `DEBUG_SESSIONS` - Set to `true` to enable session debugging logs
- `CORS_ORIGIN` - Set to your domain in production (e.g., `https://yourdomain.com`)

### Post-Deployment Checklist

After deploying:

- [ ] Verify health endpoint: `https://your-domain.com/health`
- [ ] Test login with default credentials
- [ ] **Immediately change default passwords**
- [ ] Test all features (attendance, reports, search, PDFs)
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Test mobile responsiveness
- [ ] Update `CORS_ORIGIN` to match your domain

## Troubleshooting

**Database connection issues:**
- Verify `DATABASE_URL` is correct in environment variables
- Ensure URL includes `?sslmode=require`
- Check Neon project is active

**PDF generation not working:**
- Verify all R2 environment variables are set
- Check R2 credentials and bucket name
- App works without R2, but PDFs won't generate

**Search not returning results:**
- Query parameter is now optional
- Try: `/api/database/search?type=students`

For more troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md).

## License

MIT License - feel free to use this for your school or organization.

## Support

For issues or questions:
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
- Open an issue on GitHub
- Review API endpoints documentation above

---

**Ready to deploy?** Check out [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions! 🚀