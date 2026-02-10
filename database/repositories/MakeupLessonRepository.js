const BaseRepository = require('./BaseRepository');
const QueryBuilder = require('../utils/QueryBuilder');

/**
 * MakeupLessonRepository - Repository for makeup lesson entity operations
 * Extends BaseRepository with makeup lesson-specific methods
 */
class MakeupLessonRepository extends BaseRepository {
    constructor(pool) {
        super(pool, 'makeup_lessons');
    }

    /**
     * Get all makeup lessons with student and class information
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of makeup lessons
     */
    async findAll(options = {}) {
        const {
            page = 1,
            perPage = 50,
            orderBy = 'scheduled_date',
            orderDirection = 'DESC',
            status = null
        } = options;

        const qb = new QueryBuilder('makeup_lessons ml');
        qb.select('ml.*', 's.name as student_name', 'c.name as class_name')
          .join('students s', 'ml.student_id = s.id', 'LEFT')
          .join('classes c', 'ml.class_id = c.id', 'LEFT');

        if (status) {
            qb.where('ml.status', '=', status);
        }

        qb.orderBy(`ml.${orderBy}`, orderDirection);
        
        if (perPage > 0) {
            qb.paginate(page, perPage);
        }

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Get makeup lessons by student
     * @param {number} studentId - Student ID
     * @param {number} limit - Max number of records
     * @returns {Promise<Array>} Student's makeup lessons
     */
    async getByStudent(studentId, limit = 20) {
        const result = await this.query(
            `SELECT ml.*, c.name as class_name
             FROM makeup_lessons ml
             LEFT JOIN classes c ON ml.class_id = c.id
             WHERE ml.student_id = $1
             ORDER BY ml.scheduled_date DESC
             LIMIT $2`,
            [studentId, limit]
        );
        return result.rows;
    }

    /**
     * Get upcoming makeup lessons
     * @param {string} fromDate - Starting date (defaults to today)
     * @param {number} limit - Max number of records
     * @returns {Promise<Array>} Upcoming makeup lessons
     */
    async getUpcoming(fromDate = null, limit = 50) {
        const date = fromDate || new Date().toISOString().split('T')[0];
        
        const result = await this.query(
            `SELECT ml.*, s.name as student_name, c.name as class_name
             FROM makeup_lessons ml
             LEFT JOIN students s ON ml.student_id = s.id
             LEFT JOIN classes c ON ml.class_id = c.id
             WHERE ml.scheduled_date >= $1 AND ml.status = 'scheduled'
             ORDER BY ml.scheduled_date, ml.scheduled_time
             LIMIT $2`,
            [date, limit]
        );
        return result.rows;
    }

    /**
     * Get makeup lessons by status
     * @param {string} status - Status (scheduled, completed, cancelled)
     * @param {number} limit - Max number of records
     * @returns {Promise<Array>} Makeup lessons with the given status
     */
    async getByStatus(status, limit = 50) {
        const result = await this.query(
            `SELECT ml.*, s.name as student_name, c.name as class_name
             FROM makeup_lessons ml
             LEFT JOIN students s ON ml.student_id = s.id
             LEFT JOIN classes c ON ml.class_id = c.id
             WHERE ml.status = $1
             ORDER BY ml.scheduled_date DESC
             LIMIT $2`,
            [status, limit]
        );
        return result.rows;
    }

    /**
     * Get makeup lesson by ID with full details (override base method)
     * @param {number} id - Makeup lesson ID
     * @returns {Promise<Object|null>} Makeup lesson with related info
     */
    async findById(id) {
        const result = await this.query(
            `SELECT ml.*, s.name as student_name, c.name as class_name
             FROM makeup_lessons ml
             LEFT JOIN students s ON ml.student_id = s.id
             LEFT JOIN classes c ON ml.class_id = c.id
             WHERE ml.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Update makeup lesson status
     * @param {number} id - Makeup lesson ID
     * @param {string} status - New status
     * @returns {Promise<Object|null>} Updated makeup lesson
     */
    async updateStatus(id, status) {
        const result = await this.query(
            `UPDATE makeup_lessons 
             SET status = $2
             WHERE id = $1
             RETURNING *`,
            [id, status]
        );
        return result.rows[0] || null;
    }
}

module.exports = MakeupLessonRepository;
