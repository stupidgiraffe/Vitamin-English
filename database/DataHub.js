const pool = require('./connection');
const StudentRepository = require('./repositories/StudentRepository');
const ClassRepository = require('./repositories/ClassRepository');
const AttendanceRepository = require('./repositories/AttendanceRepository');
const TeacherCommentSheetRepository = require('./repositories/TeacherCommentSheetRepository');
const MakeupLessonRepository = require('./repositories/MakeupLessonRepository');
const MonthlyReportRepository = require('./repositories/MonthlyReportRepository');
const UserRepository = require('./repositories/UserRepository');
const PdfHistoryRepository = require('./repositories/PdfHistoryRepository');
const QueryBuilder = require('./utils/QueryBuilder');

/**
 * DataHub - Centralized data access layer
 * Singleton service that provides access to all repositories and cross-entity operations
 */
class DataHub {
    constructor() {
        this.pool = pool;
        
        // Initialize all repositories
        this.students = new StudentRepository(pool);
        this.classes = new ClassRepository(pool);
        this.attendance = new AttendanceRepository(pool);
        this.teacherCommentSheets = new TeacherCommentSheetRepository(pool);
        this.makeupLessons = new MakeupLessonRepository(pool);
        this.monthlyReports = new MonthlyReportRepository(pool);
        this.users = new UserRepository(pool);
        this.pdfHistory = new PdfHistoryRepository(pool);
        
        // Map of table names to repositories for dynamic access
        this.repositories = {
            'students': this.students,
            'classes': this.classes,
            'attendance': this.attendance,
            'teacher_comment_sheets': this.teacherCommentSheets,
            'makeup_lessons': this.makeupLessons,
            'monthly_reports': this.monthlyReports,
            'users': this.users,
            'pdf_history': this.pdfHistory
        };
    }

    /**
     * Get repository by table name
     * @param {string} tableName - Name of the table
     * @returns {BaseRepository|null} Repository instance or null
     */
    getRepository(tableName) {
        return this.repositories[tableName] || null;
    }

    /**
     * Get complete student profile with all related data
     * @param {number} studentId - Student ID
     * @returns {Promise<Object|null>} Complete student profile
     */
    async getStudentFullProfile(studentId) {
        return this.students.getProfile(studentId);
    }

    /**
     * Get dashboard data (today's classes, upcoming makeup lessons, recent activity)
     * @returns {Promise<Object>} Dashboard data
     */
    async getDashboardData() {
        const today = new Date().toISOString().split('T')[0];
        
        // Get active classes with student counts
        const classes = await this.classes.getAllWithCounts();
        
        // Get upcoming makeup lessons
        const upcomingMakeupLessons = await this.makeupLessons.getUpcoming(today, 10);
        
        // Get recent teacher comment sheets
        const recentCommentSheets = await this.teacherCommentSheets.getRecent(5);
        
        // Get recent PDF exports
        const recentPdfs = await this.pdfHistory.getRecent(5);
        
        return {
            classes,
            upcomingMakeupLessons,
            recentCommentSheets,
            recentPdfs,
            date: today
        };
    }

    /**
     * Helper to check if a query string is valid (non-empty after trimming)
     * @param {string} query - Query string to validate
     * @returns {boolean} True if query is valid
     */
    static hasValidQuery(query) {
        return query && query.trim().length > 0;
    }

    /**
     * Unified cross-entity search
     * @param {string} query - Search query
     * @param {Object} options - Search options (type, startDate, endDate, page, perPage)
     * @returns {Promise<Object>} Search results with pagination
     */
    async searchAll(query, options = {}) {
        const {
            type = 'all',
            startDate = null,
            endDate = null,
            page = 1,
            perPage = 50
        } = options;

        const results = {
            query,
            type,
            students: [],
            classes: [],
            attendance: [],
            teacherCommentSheets: [],
            makeupLessons: [],
            total: 0,
            pagination: { page: parseInt(page), perPage: parseInt(perPage) }
        };

        try {
            // Search students (if type is 'all' or 'students')
            if (type === 'all' || type === 'students') {
                const students = await this.students.search(query, { page, perPage: 50 });
                results.students = students;
                results.total += students.length;
            }

            // Search classes (if type is 'all' or 'classes')
            if (type === 'all' || type === 'classes') {
                const qb = new QueryBuilder('classes c');
                qb.select('c.*', 'u.full_name as teacher_name')
                  .join('users u', 'c.teacher_id = u.id', 'LEFT');
                
                // Only add search filter if query is not empty
                if (DataHub.hasValidQuery(query)) {
                    qb.whereLike('c.name', query);
                }
                
                qb.where('c.active', '=', true);
                qb.orderBy('c.name', 'ASC');
                qb.paginate(page, 50);

                const classQuery = qb.build();
                const classResult = await this.pool.query(classQuery.text, classQuery.values);
                results.classes = classResult.rows;
                results.total += classResult.rows.length;
            }

            // Search teacher comment sheets (if type is 'all' or 'teacher_comments' or 'teacher_comment_sheets')
            if (type === 'all' || type === 'teacher_comments' || type === 'teacher_comment_sheets') {
                const qb = new QueryBuilder('teacher_comment_sheets tcs');
                qb.select('tcs.*', 'c.name as class_name', 'u.full_name as teacher_name')
                  .join('classes c', 'tcs.class_id = c.id', 'LEFT')
                  .join('users u', 'tcs.teacher_id = u.id', 'LEFT');

                if (startDate && endDate) {
                    qb.whereBetween('tcs.date', startDate, endDate);
                } else if (DataHub.hasValidQuery(query)) {
                    qb.whereLike('tcs.target_topic', query);
                }

                qb.orderBy('tcs.date', 'DESC');
                qb.paginate(page, 50);

                const tcsQuery = qb.build();
                const tcsResult = await this.pool.query(tcsQuery.text, tcsQuery.values);
                results.teacherCommentSheets = tcsResult.rows;
                results.total += tcsResult.rows.length;
            }

            // Search makeup lessons (if type is 'all' or 'makeup_lessons')
            if (type === 'all' || type === 'makeup_lessons') {
                const qb = new QueryBuilder('makeup_lessons ml');
                qb.select('ml.*', 's.name as student_name', 'c.name as class_name')
                  .join('students s', 'ml.student_id = s.id', 'LEFT')
                  .join('classes c', 'ml.class_id = c.id', 'LEFT');

                if (startDate && endDate) {
                    qb.whereBetween('ml.scheduled_date', startDate, endDate);
                } else if (DataHub.hasValidQuery(query)) {
                    // Search by student or class name when there's a query
                    qb.whereLike('s.name', query);
                }

                qb.orderBy('ml.scheduled_date', 'DESC');
                qb.paginate(page, 50);

                const mlQuery = qb.build();
                const mlResult = await this.pool.query(mlQuery.text, mlQuery.values);
                results.makeupLessons = mlResult.rows;
                results.total += mlResult.rows.length;
            }
            
            // Search attendance (if type is 'all' or 'attendance')
            if (type === 'all' || type === 'attendance') {
                const qb = new QueryBuilder('attendance a');
                qb.select('a.*', 's.name as student_name', 'c.name as class_name')
                  .join('students s', 'a.student_id = s.id', 'LEFT')
                  .join('classes c', 'a.class_id = c.id', 'LEFT');

                if (startDate && endDate) {
                    qb.whereBetween('a.date', startDate, endDate);
                } else if (DataHub.hasValidQuery(query)) {
                    // Search by student or class name when there's a query
                    qb.whereLike('s.name', query);
                }

                qb.orderBy('a.date', 'DESC');
                qb.paginate(page, 50);

                const attendanceQuery = qb.build();
                const attendanceResult = await this.pool.query(attendanceQuery.text, attendanceQuery.values);
                results.attendance = attendanceResult.rows;
                results.total += attendanceResult.rows.length;
            }

            return results;
        } catch (error) {
            console.error('❌ Search error:', error);
            throw error;
        }
    }

    /**
     * Get database statistics
     * @returns {Promise<Object>} Database statistics
     */
    async getStats() {
        try {
            // Get row counts for all tables
            const counts = await this.pool.query(`
                SELECT 
                    schemaname,
                    relname as table_name,
                    n_live_tup as row_count,
                    pg_size_pretty(pg_total_relation_size(relid)) as total_size
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
                ORDER BY n_live_tup DESC
            `);

            // Get database size
            const dbSize = await this.pool.query(`
                SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
            `);

            // Get connection pool stats
            const poolStats = this.pool.getStats();

            return {
                tables: counts.rows,
                databaseSize: dbSize.rows[0].database_size,
                connectionPool: poolStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Stats error:', error);
            throw error;
        }
    }

    /**
     * Perform database health check
     * @returns {Promise<Object>} Health check result
     */
    async healthCheck() {
        try {
            const health = await this.pool.healthCheck();
            return {
                ...health,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Health check error:', error);
            return {
                ok: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Execute a callback within a transaction across multiple repositories
     * @param {Function} callback - Async function that receives a client
     * @returns {Promise<*>} Result from the callback
     */
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Execute a raw SQL query (use with caution)
     * @param {string} text - SQL query text
     * @param {Array} values - Query parameters
     * @returns {Promise<Object>} Query result
     */
    async query(text, values = []) {
        return this.pool.query(text, values);
    }
}

// Export singleton instance
module.exports = new DataHub();
