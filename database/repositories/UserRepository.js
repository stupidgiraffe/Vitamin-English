const BaseRepository = require('./BaseRepository');
const QueryBuilder = require('../utils/QueryBuilder');

/**
 * UserRepository - Repository for user entity operations
 * Extends BaseRepository with user-specific methods
 */
class UserRepository extends BaseRepository {
    constructor(pool) {
        super(pool, 'users');
    }

    /**
     * Find all users (excludes password_hash by default)
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of users without password hashes
     */
    async findAll(options = {}) {
        const {
            page = 1,
            perPage = 50,
            orderBy = 'full_name',
            orderDirection = 'ASC',
            role = null
        } = options;

        const qb = new QueryBuilder(this.tableName);
        qb.select('id', 'username', 'full_name', 'role', 'created_at');

        if (role) {
            qb.where('role', '=', role);
        }

        qb.orderBy(orderBy, orderDirection);
        
        if (perPage > 0) {
            qb.paginate(page, perPage);
        }

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Find user by ID (excludes password_hash)
     * @param {number} id - User ID
     * @returns {Promise<Object|null>} User without password hash
     */
    async findById(id) {
        const result = await this.query(
            `SELECT id, username, full_name, role, created_at 
             FROM users 
             WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Find user by username
     * @param {string} username - Username
     * @param {boolean} includePassword - Whether to include password_hash (for authentication)
     * @returns {Promise<Object|null>} User record
     */
    async findByUsername(username, includePassword = false) {
        const columns = includePassword 
            ? 'id, username, password_hash, full_name, role, created_at'
            : 'id, username, full_name, role, created_at';
            
        const result = await this.query(
            `SELECT ${columns} FROM users WHERE username = $1`,
            [username]
        );
        return result.rows[0] || null;
    }

    /**
     * Authenticate user (for login)
     * @param {string} username - Username
     * @returns {Promise<Object|null>} User with password hash for authentication
     */
    async authenticate(username) {
        return this.findByUsername(username, true);
    }

    /**
     * Get all teachers
     * @returns {Promise<Array>} Array of teachers
     */
    async getTeachers() {
        const result = await this.query(
            `SELECT id, username, full_name, role, created_at 
             FROM users 
             WHERE role = 'teacher'
             ORDER BY full_name`
        );
        return result.rows;
    }

    /**
     * Get all admins
     * @returns {Promise<Array>} Array of admins
     */
    async getAdmins() {
        const result = await this.query(
            `SELECT id, username, full_name, role, created_at 
             FROM users 
             WHERE role = 'admin'
             ORDER BY full_name`
        );
        return result.rows;
    }

    /**
     * Create a new user (override to exclude password from return value)
     * @param {Object} data - User data including password_hash
     * @returns {Promise<Object>} Created user without password hash
     */
    async create(data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const result = await this.query(
            `INSERT INTO users (${columns.join(', ')}) 
             VALUES (${placeholders}) 
             RETURNING id, username, full_name, role, created_at`,
            values
        );
        return result.rows[0];
    }

    /**
     * Update user (override to exclude password from return value)
     * @param {number} id - User ID
     * @param {Object} data - User data to update
     * @returns {Promise<Object|null>} Updated user without password hash
     */
    async update(id, data) {
        const entries = Object.entries(data);
        if (entries.length === 0) {
            return this.findById(id);
        }

        const setClause = entries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
        const values = [id, ...entries.map(([, value]) => value)];

        const result = await this.query(
            `UPDATE users 
             SET ${setClause} 
             WHERE id = $1 
             RETURNING id, username, full_name, role, created_at`,
            values
        );
        return result.rows[0] || null;
    }
}

module.exports = UserRepository;
