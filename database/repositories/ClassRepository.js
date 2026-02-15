const BaseRepository = require('./BaseRepository');
const QueryBuilder = require('../utils/QueryBuilder');

/**
 * ClassRepository - Repository for class entity operations
 * Extends BaseRepository with class-specific methods
 */
class ClassRepository extends BaseRepository {
    constructor(pool) {
        super(pool, 'classes');
    }

    /**
     * Get all classes with teacher information
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of classes with teacher details
     */
    async findAll(options = {}) {
        const {
            page = 1,
            perPage = 50,
            orderBy = 'name',
            orderDirection = 'ASC',
            active = true
        } = options;

        const qb = new QueryBuilder('classes c');
        qb.select('c.*', 'u.full_name as teacher_name', 'u.username as teacher_username')
          .join('users u', 'c.teacher_id = u.id', 'LEFT');

        if (active !== null) {
            qb.where('c.active', '=', active);
        }

        qb.orderBy(`c.${orderBy}`, orderDirection);
        
        if (perPage > 0) {
            qb.paginate(page, perPage);
        }

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Get class with student count
     * @param {number} classId - Class ID
     * @returns {Promise<Object|null>} Class with student count
     */
    async getWithStudentCount(classId) {
        const result = await this.query(
            `SELECT c.*, 
                    u.full_name as teacher_name,
                    COUNT(DISTINCT s.id) FILTER (WHERE s.active = true) as student_count
             FROM classes c
             LEFT JOIN users u ON c.teacher_id = u.id
             LEFT JOIN students s ON c.id = s.class_id
             WHERE c.id = $1
             GROUP BY c.id, u.full_name`,
            [classId]
        );
        return result.rows[0] || null;
    }

    /**
     * Get class with teacher information
     * @param {number} classId - Class ID
     * @returns {Promise<Object|null>} Class with teacher details
     */
    async getWithTeacher(classId) {
        const result = await this.query(
            `SELECT c.*, 
                    u.full_name as teacher_name,
                    u.username as teacher_username,
                    u.role as teacher_role
             FROM classes c
             LEFT JOIN users u ON c.teacher_id = u.id
             WHERE c.id = $1`,
            [classId]
        );
        return result.rows[0] || null;
    }

    /**
     * Get class by ID with full details (override base method)
     * @param {number} id - Class ID
     * @returns {Promise<Object|null>} Class with teacher information
     */
    async findById(id) {
        return this.getWithTeacher(id);
    }

    /**
     * Get all active classes with student counts
     * @returns {Promise<Array>} Array of classes with counts
     */
    async getAllWithCounts() {
        const result = await this.query(
            `SELECT c.*, 
                    u.full_name as teacher_name,
                    COUNT(DISTINCT s.id) FILTER (WHERE s.active = true) as student_count
             FROM classes c
             LEFT JOIN users u ON c.teacher_id = u.id
             LEFT JOIN students s ON c.id = s.class_id
             WHERE c.active = true
             GROUP BY c.id, u.full_name
             ORDER BY c.name`
        );
        return result.rows;
    }
}

module.exports = ClassRepository;
