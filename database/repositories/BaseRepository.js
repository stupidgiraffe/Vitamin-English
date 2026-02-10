const QueryBuilder = require('../utils/QueryBuilder');

/**
 * BaseRepository - Base class for all entity repositories
 * Provides common CRUD operations with parameterized queries
 */
class BaseRepository {
    /**
     * @param {Pool} pool - PostgreSQL connection pool
     * @param {string} tableName - Name of the database table
     */
    constructor(pool, tableName) {
        this.pool = pool;
        this.tableName = tableName;
    }

    /**
     * Find all records with optional filtering, pagination, and ordering
     * @param {Object} options - Query options
     * @param {number} options.page - Page number (1-indexed)
     * @param {number} options.perPage - Items per page
     * @param {string} options.orderBy - Column to order by
     * @param {string} options.orderDirection - Order direction (ASC/DESC)
     * @param {Object} options.where - WHERE conditions as key-value pairs
     * @returns {Promise<Array>} Array of records
     */
    async findAll(options = {}) {
        const {
            page = 1,
            perPage = 50,
            orderBy = 'id',
            orderDirection = 'ASC',
            where = {}
        } = options;

        const qb = new QueryBuilder(this.tableName);

        // Add WHERE conditions
        Object.entries(where).forEach(([column, value]) => {
            if (value !== undefined && value !== null) {
                qb.where(column, '=', value);
            }
        });

        // Add ordering and pagination
        qb.orderBy(orderBy, orderDirection);
        
        if (perPage > 0) {
            qb.paginate(page, perPage);
        }

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Find a single record by ID
     * @param {number} id - Record ID
     * @returns {Promise<Object|null>} Record or null if not found
     */
    async findById(id) {
        const query = {
            text: `SELECT * FROM ${this.tableName} WHERE id = $1`,
            values: [id]
        };
        const result = await this.pool.query(query.text, query.values);
        return result.rows[0] || null;
    }

    /**
     * Find a single record by custom condition
     * @param {Object} where - WHERE conditions as key-value pairs
     * @returns {Promise<Object|null>} Record or null if not found
     */
    async findOne(where = {}) {
        const qb = new QueryBuilder(this.tableName);
        
        Object.entries(where).forEach(([column, value]) => {
            if (value !== undefined && value !== null) {
                qb.where(column, '=', value);
            }
        });

        qb.limit(1);
        
        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows[0] || null;
    }

    /**
     * Create a new record
     * @param {Object} data - Record data as key-value pairs
     * @returns {Promise<Object>} Created record with all fields
     */
    async create(data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const query = {
            text: `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            values: values
        };

        const result = await this.pool.query(query.text, query.values);
        return result.rows[0];
    }

    /**
     * Update a record by ID
     * @param {number} id - Record ID
     * @param {Object} data - Fields to update as key-value pairs
     * @returns {Promise<Object|null>} Updated record or null if not found
     */
    async update(id, data) {
        const entries = Object.entries(data);
        if (entries.length === 0) {
            return this.findById(id);
        }

        const setClause = entries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
        const values = [id, ...entries.map(([, value]) => value)];

        const query = {
            text: `UPDATE ${this.tableName} SET ${setClause} WHERE id = $1 RETURNING *`,
            values: values
        };

        const result = await this.pool.query(query.text, query.values);
        return result.rows[0] || null;
    }

    /**
     * Soft delete a record (set active = false)
     * @param {number} id - Record ID
     * @returns {Promise<Object|null>} Updated record or null if not found
     */
    async softDelete(id) {
        const query = {
            text: `UPDATE ${this.tableName} SET active = false WHERE id = $1 RETURNING *`,
            values: [id]
        };

        const result = await this.pool.query(query.text, query.values);
        return result.rows[0] || null;
    }

    /**
     * Hard delete a record (permanent removal)
     * @param {number} id - Record ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async hardDelete(id) {
        const query = {
            text: `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING id`,
            values: [id]
        };

        const result = await this.pool.query(query.text, query.values);
        return result.rowCount > 0;
    }

    /**
     * Count records with optional WHERE conditions
     * @param {Object} where - WHERE conditions as key-value pairs
     * @returns {Promise<number>} Count of matching records
     */
    async count(where = {}) {
        const qb = new QueryBuilder(this.tableName);

        Object.entries(where).forEach(([column, value]) => {
            if (value !== undefined && value !== null) {
                qb.where(column, '=', value);
            }
        });

        const query = qb.buildCount();
        const result = await this.pool.query(query.text, query.values);
        return parseInt(result.rows[0].count);
    }

    /**
     * Check if a record exists by ID
     * @param {number} id - Record ID
     * @returns {Promise<boolean>} True if exists, false otherwise
     */
    async exists(id) {
        const query = {
            text: `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE id = $1)`,
            values: [id]
        };

        const result = await this.pool.query(query.text, query.values);
        return result.rows[0].exists;
    }

    /**
     * Execute a callback within a transaction
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
     * Execute a raw SQL query
     * @param {string} text - SQL query text
     * @param {Array} values - Query parameters
     * @returns {Promise<Object>} Query result
     */
    async query(text, values = []) {
        return this.pool.query(text, values);
    }
}

module.exports = BaseRepository;
