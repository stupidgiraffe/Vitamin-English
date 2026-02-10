const BaseRepository = require('./BaseRepository');
const QueryBuilder = require('../utils/QueryBuilder');

/**
 * PdfHistoryRepository - Repository for PDF history entity operations
 * Extends BaseRepository with PDF history-specific methods
 */
class PdfHistoryRepository extends BaseRepository {
    constructor(pool) {
        super(pool, 'pdf_history');
    }

    /**
     * Get all PDF history records with related information
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of PDF history records
     */
    async findAll(options = {}) {
        const {
            page = 1,
            perPage = 50,
            orderBy = 'created_at',
            orderDirection = 'DESC',
            type = null
        } = options;

        const qb = new QueryBuilder('pdf_history ph');
        qb.select(
            'ph.*',
            's.name as student_name',
            'c.name as class_name',
            'u.full_name as created_by_name'
        )
          .join('students s', 'ph.student_id = s.id', 'LEFT')
          .join('classes c', 'ph.class_id = c.id', 'LEFT')
          .join('users u', 'ph.created_by = u.id', 'LEFT');

        if (type) {
            qb.where('ph.type', '=', type);
        }

        qb.orderBy(`ph.${orderBy}`, orderDirection);
        
        if (perPage > 0) {
            qb.paginate(page, perPage);
        }

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Get PDF history by type
     * @param {string} type - PDF type (e.g., 'attendance', 'lesson_report', 'monthly_report')
     * @param {number} limit - Max number of records
     * @returns {Promise<Array>} PDF history records
     */
    async getByType(type, limit = 50) {
        const result = await this.query(
            `SELECT ph.*, 
                    s.name as student_name,
                    c.name as class_name,
                    u.full_name as created_by_name
             FROM pdf_history ph
             LEFT JOIN students s ON ph.student_id = s.id
             LEFT JOIN classes c ON ph.class_id = c.id
             LEFT JOIN users u ON ph.created_by = u.id
             WHERE ph.type = $1
             ORDER BY ph.created_at DESC
             LIMIT $2`,
            [type, limit]
        );
        return result.rows;
    }

    /**
     * Get recent PDF history
     * @param {number} limit - Max number of records
     * @returns {Promise<Array>} Recent PDF history records
     */
    async getRecent(limit = 20) {
        const result = await this.query(
            `SELECT ph.*, 
                    s.name as student_name,
                    c.name as class_name,
                    u.full_name as created_by_name
             FROM pdf_history ph
             LEFT JOIN students s ON ph.student_id = s.id
             LEFT JOIN classes c ON ph.class_id = c.id
             LEFT JOIN users u ON ph.created_by = u.id
             ORDER BY ph.created_at DESC
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    }

    /**
     * Get PDF history by student
     * @param {number} studentId - Student ID
     * @param {number} limit - Max number of records
     * @returns {Promise<Array>} Student's PDF history
     */
    async getByStudent(studentId, limit = 20) {
        const result = await this.query(
            `SELECT ph.*, 
                    c.name as class_name,
                    u.full_name as created_by_name
             FROM pdf_history ph
             LEFT JOIN classes c ON ph.class_id = c.id
             LEFT JOIN users u ON ph.created_by = u.id
             WHERE ph.student_id = $1
             ORDER BY ph.created_at DESC
             LIMIT $2`,
            [studentId, limit]
        );
        return result.rows;
    }

    /**
     * Get PDF history by class
     * @param {number} classId - Class ID
     * @param {number} limit - Max number of records
     * @returns {Promise<Array>} Class's PDF history
     */
    async getByClass(classId, limit = 20) {
        const result = await this.query(
            `SELECT ph.*, 
                    s.name as student_name,
                    u.full_name as created_by_name
             FROM pdf_history ph
             LEFT JOIN students s ON ph.student_id = s.id
             LEFT JOIN users u ON ph.created_by = u.id
             WHERE ph.class_id = $1
             ORDER BY ph.created_at DESC
             LIMIT $2`,
            [classId, limit]
        );
        return result.rows;
    }

    /**
     * Get PDF history by ID with full details (override base method)
     * @param {number} id - PDF history ID
     * @returns {Promise<Object|null>} PDF history with related info
     */
    async findById(id) {
        const result = await this.query(
            `SELECT ph.*, 
                    s.name as student_name,
                    c.name as class_name,
                    u.full_name as created_by_name
             FROM pdf_history ph
             LEFT JOIN students s ON ph.student_id = s.id
             LEFT JOIN classes c ON ph.class_id = c.id
             LEFT JOIN users u ON ph.created_by = u.id
             WHERE ph.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = PdfHistoryRepository;
