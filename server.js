const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // Specific origin for dev, configurable for production
    credentials: true
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'vitamin-english-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

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

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/classes', requireAuth, classRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/database', requireAuth, databaseRoutes);
app.use('/api/makeup', requireAuth, makeupRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// TESTING ONLY - Database reset endpoint (admin only)
app.post('/api/reset-database', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
    }
    
    try {
        const dbPath = path.join(__dirname, 'database', 'school.db');
        
        // Delete existing database
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            console.log('🗑️  Old database deleted');
        }
        
        // Reinitialize
        delete require.cache[require.resolve('./database/init')];
        require('./database/init');
        
        console.log('✅ Database reset complete');
        res.json({ message: 'Database reset successfully' });
    } catch (error) {
        console.error('Error resetting database:', error);
        res.status(500).json({ error: error.message });
    }
});

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

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Login credentials:');
    console.log('  Admin - username: admin, password: admin123');
    console.log('  Teacher - username: sarah, password: teacher123');
});

module.exports = app;
