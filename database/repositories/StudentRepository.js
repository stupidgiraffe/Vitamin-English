const BaseRepository = require('./BaseRepository');
const QueryBuilder = require('../utils/QueryBuilder');

/**
 * StudentRepository - Repository for student entity operations
 * Extends BaseRepository with student-specific methods
 */
class StudentRepository extends BaseRepository {
    constructor(pool) {
        super(pool, 'students');
    }

    /**
     * Get all students with class information
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of students with class details
     */
    async findAll(options = {}) {
        const {
            page = 1,
            perPage = 50,
            orderBy = 'name',
            orderDirection = 'ASC',
            classId = null,
            active = true
        } = options;

        const qb = new QueryBuilder('students s');
        qb.select('s.*', 'c.name as class_name', 'c.color as class_color')
          .join('classes c', 's.class_id = c.id', 'LEFT');

        if (active !== null) {
            qb.where('s.active', '=', active);
        }

        if (classId) {
            qb.where('s.class_id', '=', classId);
        }

        qb.orderBy(`s.${orderBy}`, orderDirection);
        
        if (perPage > 0) {
            qb.paginate(page, perPage);
        }

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Get students by class ID
     * @param {number} classId - Class ID
     * @returns {Promise<Array>} Array of students in the class
     */
    async getByClass(classId) {
        return this.findAll({ classId, perPage: 0 });
    }

    /**
     * Get complete student profile with attendance stats and reports
     * @param {number} studentId - Student ID
     * @returns {Promise<Object|null>} Student profile with related data
     */
    async getProfile(studentId) {
        const student = await this.query(
            `SELECT s.*, c.name as class_name, c.id as class_id, c.color as class_color
             FROM students s 
             LEFT JOIN classes c ON s.class_id = c.id 
             WHERE s.id = $1`,
            [studentId]
        );

        if (!student.rows[0]) {
            return null;
        }

        const profile = student.rows[0];

        // Get attendance stats (last 60 days)
        const attendance = await this.query(
            `SELECT date, status, notes 
             FROM attendance 
             WHERE student_id = $1 
             ORDER BY date DESC 
             LIMIT 60`,
            [studentId]
        );

        // Get makeup lessons
        const makeupLessons = await this.query(
            `SELECT * FROM makeup_lessons 
             WHERE student_id = $1 
             ORDER BY scheduled_date DESC 
             LIMIT 10`,
            [studentId]
        );

        // Calculate attendance statistics
        const stats = await this.query(
            `SELECT 
                COUNT(*) as total_days,
                SUM(CASE WHEN status = 'O' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN status = 'X' THEN 1 ELSE 0 END) as absent_days,
                SUM(CASE WHEN status = '/' THEN 1 ELSE 0 END) as tardy_days
             FROM attendance 
             WHERE student_id = $1`,
            [studentId]
        );

        return {
            ...profile,
            attendance: attendance.rows,
            makeupLessons: makeupLessons.rows,
            stats: stats.rows[0]
        };
    }

    /**
     * Search students by name or email
     * @param {string} searchTerm - Search term
     * @param {Object} options - Additional options (page, perPage, etc.)
     * @returns {Promise<Array>} Matching students
     */
    async search(searchTerm, options = {}) {
        const {
            page = 1,
            perPage = 50
        } = options;

        const qb = new QueryBuilder('students s');
        qb.select('s.*', 'c.name as class_name')
          .join('classes c', 's.class_id = c.id', 'LEFT');
        
        // Only add search filter if searchTerm is not empty
        if (searchTerm && searchTerm.trim()) {
            qb.whereLike('s.name', searchTerm);
        }
        
        qb.where('s.active', '=', true);
        qb.orderBy('s.name', 'ASC');
        qb.paginate(page, perPage);

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Get student with full details by ID
     * @param {number} id - Student ID
     * @returns {Promise<Object|null>} Student with class information
     */
    async findById(id) {
        const result = await this.query(
            `SELECT s.*, c.name as class_name, c.color as class_color
             FROM students s 
             LEFT JOIN classes c ON s.class_id = c.id 
             WHERE s.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = StudentRepository;
