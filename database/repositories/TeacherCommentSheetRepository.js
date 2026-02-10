const BaseRepository = require('./BaseRepository');
const QueryBuilder = require('../utils/QueryBuilder');

/**
 * TeacherCommentSheetRepository - Repository for teacher comment sheets
 * Extends BaseRepository with teacher comment sheet-specific methods
 */
class TeacherCommentSheetRepository extends BaseRepository {
    constructor(pool) {
        super(pool, 'teacher_comment_sheets');
    }

    /**
     * Get all teacher comment sheets with class and teacher information
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of teacher comment sheets
     */
    async findAll(options = {}) {
        const {
            page = 1,
            perPage = 100,
            orderBy = 'date',
            orderDirection = 'DESC',
            classId = null
        } = options;

        const qb = new QueryBuilder('teacher_comment_sheets tcs');
        qb.select('tcs.*', 'c.name as class_name', 'u.full_name as teacher_name')
          .join('classes c', 'tcs.class_id = c.id', 'LEFT')
          .join('users u', 'tcs.teacher_id = u.id', 'LEFT');

        if (classId) {
            qb.where('tcs.class_id', '=', classId);
        }

        qb.orderBy(`tcs.${orderBy}`, orderDirection);
        
        if (perPage > 0) {
            qb.paginate(page, perPage);
        }

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Get teacher comment sheet by class and date
     * @param {number} classId - Class ID
     * @param {string} date - Date
     * @returns {Promise<Object|null>} Teacher comment sheet or null
     */
    async getByClassAndDate(classId, date) {
        const result = await this.query(
            `SELECT tcs.*, c.name as class_name, u.full_name as teacher_name
             FROM teacher_comment_sheets tcs
             LEFT JOIN classes c ON tcs.class_id = c.id
             LEFT JOIN users u ON tcs.teacher_id = u.id
             WHERE tcs.class_id = $1 AND tcs.date = $2`,
            [classId, date]
        );
        return result.rows[0] || null;
    }

    /**
     * Get recent teacher comment sheets
     * @param {number} limit - Max number of records
     * @param {number} classId - Optional class ID filter
     * @returns {Promise<Array>} Recent teacher comment sheets
     */
    async getRecent(limit = 20, classId = null) {
        let query = `
            SELECT tcs.*, c.name as class_name, u.full_name as teacher_name
            FROM teacher_comment_sheets tcs
            LEFT JOIN classes c ON tcs.class_id = c.id
            LEFT JOIN users u ON tcs.teacher_id = u.id
        `;
        const params = [];

        if (classId) {
            query += ' WHERE tcs.class_id = $1';
            params.push(classId);
        }

        query += ' ORDER BY tcs.date DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Get teacher comment sheets by date range
     * @param {number} classId - Class ID
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @returns {Promise<Array>} Teacher comment sheets in date range
     */
    async getByDateRange(classId, startDate, endDate) {
        const result = await this.query(
            `SELECT tcs.*, c.name as class_name, u.full_name as teacher_name
             FROM teacher_comment_sheets tcs
             LEFT JOIN classes c ON tcs.class_id = c.id
             LEFT JOIN users u ON tcs.teacher_id = u.id
             WHERE tcs.class_id = $1 AND tcs.date >= $2 AND tcs.date <= $3
             ORDER BY tcs.date`,
            [classId, startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Upsert teacher comment sheet (insert or update)
     * @param {Object} data - Teacher comment sheet data
     * @returns {Promise<Object>} Upserted record
     */
    async upsert(data) {
        const { class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments } = data;
        
        const result = await this.query(
            `INSERT INTO teacher_comment_sheets 
                (class_id, teacher_id, date, target_topic, vocabulary, mistakes, strengths, comments)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (class_id, date)
             DO UPDATE SET 
                teacher_id = EXCLUDED.teacher_id,
                target_topic = EXCLUDED.target_topic,
                vocabulary = EXCLUDED.vocabulary,
                mistakes = EXCLUDED.mistakes,
                strengths = EXCLUDED.strengths,
                comments = EXCLUDED.comments
             RETURNING *`,
            [class_id, teacher_id, date, target_topic || null, vocabulary || null, 
             mistakes || null, strengths || null, comments || null]
        );
        
        return result.rows[0];
    }

    /**
     * Get teacher comment sheet by ID with full details (override base method)
     * @param {number} id - Teacher comment sheet ID
     * @returns {Promise<Object|null>} Teacher comment sheet with related info
     */
    async findById(id) {
        const result = await this.query(
            `SELECT tcs.*, c.name as class_name, u.full_name as teacher_name
             FROM teacher_comment_sheets tcs
             LEFT JOIN classes c ON tcs.class_id = c.id
             LEFT JOIN users u ON tcs.teacher_id = u.id
             WHERE tcs.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = TeacherCommentSheetRepository;
