const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pool = require('./database/init');
const { initializeDatabase, verifyDatabaseSchema } = require('./database/init-postgres');
const { ensureSchemaColumns } = require('./database/schema-guard');
const { seedTestData } = require('./database/seed-test-data');
const { sanitizeInput } = require('./middleware/sanitize');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind reverse proxies (Vercel, Railway, etc.)
app.set('trust proxy', 1);

// Enhanced security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false, // Allow loading external resources like flatpickr
    crossOriginResourcePolicy: { policy: "same-site" }
}));

// Additional security headers
app.use((req, res, next) => {
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// Rate limiting configuration
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter rate limit for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login attempts per windowMs
    message: { error: 'Too many login attempts, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful logins
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Ensure cookies are sent in responses (for Vercel serverless environment)
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        res.header('Access-Control-Allow-Credentials', 'true');
        // Use configured CORS origin or default to same origin
        const allowedOrigin = process.env.CORS_ORIGIN;
        if (allowedOrigin && allowedOrigin !== 'true') {
            res.header('Access-Control-Allow-Origin', allowedOrigin);
        } else if (req.headers.origin) {
            // In development or when CORS_ORIGIN is 'true', allow request origin
            res.header('Access-Control-Allow-Origin', req.headers.origin);
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
app.use(sanitizeInput); // Input sanitization
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
        sameSite: 'lax', // Use 'lax' for Vercel serverless environment compatibility
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
const teacherCommentSheetsRoutes = require('./routes/teacherCommentSheets');
const databaseRoutes = require('./routes/database');
const makeupRoutes = require('./routes/makeup');
const pdfRoutes = require('./routes/pdf');
const adminRoutes = require('./routes/admin');
const monthlyReportsRoutes = require('./routes/monthlyReports');

// Auto-load test data on startup if database is empty (controlled by SEED_ON_STARTUP env var)
async function initializeTestData() {
    try {
        // Skip auto-seeding if SEED_ON_STARTUP is explicitly set to 'false'
        if (process.env.SEED_ON_STARTUP === 'false') {
            console.log('📊 Auto-seeding disabled by SEED_ON_STARTUP=false');
            return;
        }
        
        // Check if database has any classes
        const classCheck = await pool.query('SELECT COUNT(*) FROM classes WHERE active = true');
        const classCount = parseInt(classCheck.rows[0].count);
        
        if (classCount === 0) {
            console.log('📊 Database is empty, loading test data...');
            await seedTestData();
            console.log('✅ Test data loaded successfully');
        } else {
            console.log(`📊 Database has ${classCount} classes, skipping test data load`);
        }
    } catch (error) {
        console.error('❌ Failed to initialize test data:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Initialize database with default users and ensure schema columns exist
// Note: Errors are caught and logged but don't stop the server
// This allows the app to start even if initialization fails (e.g., DB already has users)
initializeDatabase().then(() => {
    if (pool) {
        // Run schema guard to ensure required columns exist (Postgres only)
        ensureSchemaColumns().then(() => {
            // Verify database schema and auto-load test data
            verifyDatabaseSchema();
            initializeTestData().catch(err => {
                console.error('Test data initialization failed:', err);
            });
        }).catch(err => {
            console.error('Schema guard failed:', err);
        });
    }
}).catch(err => {
    console.error('Failed to initialize database:', err);
});

// Use routes
// Apply stricter rate limiting to authentication endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/classes', requireAuth, classRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/teacher-comment-sheets', requireAuth, teacherCommentSheetsRoutes);
app.use('/api/database', requireAuth, databaseRoutes);
app.use('/api/makeup', requireAuth, makeupRoutes);
app.use('/api/pdf', requireAuth, pdfRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/monthly-reports', requireAuth, monthlyReportsRoutes);

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
        const reportCount = await pool.query('SELECT COUNT(*) as count FROM teacher_comment_sheets');
        
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
