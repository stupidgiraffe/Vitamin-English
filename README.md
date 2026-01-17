# Vitamin English School Management System

A beautiful, modern web application for managing student attendance and teacher lesson reports at Vitamin English School.

## Features

- 📊 **Digital Attendance Tracking** - Replace paper sheets with an intuitive spreadsheet-like interface
- 📝 **Lesson Reports** - Complete digital forms for tracking lesson details, vocabulary, mistakes, and homework
- 👥 **Student Management** - Add, edit, and organize students with color-coding support
- 📚 **Class Management** - Manage classes, teachers, and schedules
- 📈 **Dashboard** - Quick overview of today's classes and recent activity
- 💾 **Data Export** - Export attendance and reports to CSV/Excel
- 🔐 **Secure Authentication** - Password-protected access for staff members

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
   - **Students**: Add, edit, or delete students; assign to classes
   - **Classes**: Add, edit, or delete classes; assign teachers
   - **Teachers**: View and manage teacher information
3. All changes are immediately saved to the database

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
2. **Set a strong session secret** - Modify the secret in `server.js`
3. **Configure HTTPS** - Use a reverse proxy like nginx
4. **Set proper file permissions** - Restrict access to `database/school.db`
5. **Regular backups** - Set up automated database backups

### Simple Deployment

The application can be deployed on any platform that supports Node.js:
- Heroku
- DigitalOcean
- AWS
- Railway
- Render

Basic deployment steps:
1. Upload all files to your server
2. Run `npm install --production`
3. Set environment variables (PORT, etc.)
4. Run `npm start`

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