const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require('./database/init');
const { initializeDatabase } = require('./database/init-postgres');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers middleware
app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Content Security Policy
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// Ensure cookies are sent in responses (for Vercel serverless environment)
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        res.header('Access-Control-Allow-Credentials', 'true');
        const origin = req.headers.origin;
        if (origin) {
            res.header('Access-Control-Allow-Origin', origin);
        }
    }
    next();
});

// Middleware
// CORS configuration - allow all origins for now, but can be restricted via environment variable
const corsOptions = {
    origin: process.env.CORS_ORIGIN || true, // Specific origin in production, all origins in development
    credentials: true
};
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Session configuration with PostgreSQL store for Vercel
const pgSession = require('connect-pg-simple')(session);

const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'vitamin-english-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'vitamin_session', // Explicit cookie name
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax', // Changed from 'strict' to 'lax' for Vercel compatibility
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined // Allow override via env var
    },
    proxy: process.env.NODE_ENV === 'production' // Trust proxy in production (Vercel)
};

// Use PostgreSQL session store in production (Vercel)
if (process.env.DATABASE_URL) {
    sessionConfig.store = new pgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: true
    });
    console.log('✅ Using PostgreSQL session store');
} else {
    console.log('⚠️  Using memory session store (development only)');
}

app.use(session(sessionConfig));

// Session debugging middleware (conditional on DEBUG_SESSIONS env var)
if (process.env.DEBUG_SESSIONS === 'true') {
    app.use((req, res, next) => {
        console.log('📍 Session Debug:', {
            path: req.path,
            method: req.method,
            sessionID: req.sessionID,
            hasSession: !!req.session,
            userId: req.session?.userId,
            cookieHeader: req.headers.cookie ? 'present' : 'missing'
        });
        next();
    });
}

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Import routes
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const classRoutes = require('./routes/classes');
const attendanceRoutes = require('./routes/attendance');
const reportRoutes = require('./routes/reports');
const databaseRoutes = require('./routes/database');
const makeupRoutes = require('./routes/makeup');
const pdfRoutes = require('./routes/pdf');

// Initialize database with default users
// Note: Errors are caught and logged but don't stop the server
// This allows the app to start even if initialization fails (e.g., DB already has users)
initializeDatabase().catch(err => {
    console.error('Failed to initialize database:', err);
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/classes', requireAuth, classRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/database', requireAuth, databaseRoutes);
app.use('/api/makeup', requireAuth, makeupRoutes);
app.use('/api/pdf', requireAuth, pdfRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Debug endpoint to check database status
app.get('/api/debug/database-status', requireAuth, async (req, res) => {
    try {
        const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
        const classCount = await pool.query('SELECT COUNT(*) as count FROM classes');
        const studentCount = await pool.query('SELECT COUNT(*) as count FROM students');
        const attendanceCount = await pool.query('SELECT COUNT(*) as count FROM attendance');
        const reportCount = await pool.query('SELECT COUNT(*) as count FROM lesson_reports');
        
        const users = await pool.query('SELECT username, full_name, role FROM users');
        const classes = await pool.query('SELECT id, name, teacher_id FROM classes');
        
        res.json({
            status: 'ok',
            counts: {
                users: parseInt(userCount.rows[0].count),
                classes: parseInt(classCount.rows[0].count),
                students: parseInt(studentCount.rows[0].count),
                attendance: parseInt(attendanceCount.rows[0].count),
                reports: parseInt(reportCount.rows[0].count)
            },
            sampleData: {
                users: users.rows,
                classes: classes.rows
            }
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({ 
            error: error.message,
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
        });
    }
});

// Note: Database reset not available for PostgreSQL
// To reset the database, use: DROP DATABASE and CREATE DATABASE on Neon/PostgreSQL

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    const timestamp = new Date().toISOString();
    console.error(`❌ ERROR [${timestamp}]:`, err.stack);
    
    // Log request details in production (excluding sensitive data)
    if (process.env.NODE_ENV === 'production') {
        console.error(`Request: ${req.method} ${req.path}`);
    }
    
    res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Start server (only in development, Vercel handles this in production)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('Login credentials:');
        console.log('  Admin - username: admin, password: admin123');
        console.log('  Teacher - username: sarah, password: teacher123');
    });
}

// Export for Vercel serverless
module.exports = app;
