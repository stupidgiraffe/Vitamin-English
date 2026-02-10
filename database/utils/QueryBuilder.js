/**
 * QueryBuilder - Lightweight fluent query builder for parameterized PostgreSQL queries
 * Helps build safe, parameterized SQL queries without string concatenation
 */
class QueryBuilder {
    /**
     * @param {string} table - The table name to query
     */
    constructor(table) {
        this.table = table;
        this.selectColumns = ['*'];
        this.joins = [];
        this.conditions = [];
        this.orderByClause = [];
        this.limitValue = null;
        this.offsetValue = null;
        this.values = [];
        this.paramCounter = 1;
    }

    /**
     * Specify columns to select
     * @param {...string} columns - Column names to select
     * @returns {QueryBuilder}
     */
    select(...columns) {
        if (columns.length > 0) {
            this.selectColumns = columns;
        }
        return this;
    }

    /**
     * Add a JOIN clause
     * @param {string} table - Table to join
     * @param {string} on - JOIN condition (e.g., "table1.id = table2.fk_id")
     * @param {string} type - JOIN type (INNER, LEFT, RIGHT, FULL)
     * @returns {QueryBuilder}
     */
    join(table, on, type = 'LEFT') {
        this.joins.push({ type, table, on });
        return this;
    }

    /**
     * Add a WHERE condition
     * @param {string} column - Column name
     * @param {string} operator - SQL operator (=, !=, >, <, >=, <=, LIKE, etc.)
     * @param {*} value - Value to compare
     * @returns {QueryBuilder}
     */
    where(column, operator, value) {
        this.conditions.push({
            type: 'WHERE',
            clause: `${column} ${operator} $${this.paramCounter++}`
        });
        this.values.push(value);
        return this;
    }

    /**
     * Add a case-insensitive LIKE condition
     * @param {string} column - Column name
     * @param {string} pattern - Search pattern (% wildcards will be added automatically)
     * @returns {QueryBuilder}
     */
    whereLike(column, pattern) {
        this.conditions.push({
            type: 'WHERE',
            clause: `LOWER(${column}) LIKE LOWER($${this.paramCounter++})`
        });
        this.values.push(`%${pattern}%`);
        return this;
    }

    /**
     * Add a WHERE IN condition
     * @param {string} column - Column name
     * @param {Array} values - Array of values
     * @returns {QueryBuilder}
     */
    whereIn(column, values) {
        if (!Array.isArray(values) || values.length === 0) {
            return this;
        }
        const placeholders = values.map(() => `$${this.paramCounter++}`).join(', ');
        this.conditions.push({
            type: 'WHERE',
            clause: `${column} IN (${placeholders})`
        });
        this.values.push(...values);
        return this;
    }

    /**
     * Add a WHERE BETWEEN condition
     * @param {string} column - Column name
     * @param {*} start - Start value
     * @param {*} end - End value
     * @returns {QueryBuilder}
     */
    whereBetween(column, start, end) {
        this.conditions.push({
            type: 'WHERE',
            clause: `${column} BETWEEN $${this.paramCounter++} AND $${this.paramCounter++}`
        });
        this.values.push(start, end);
        return this;
    }

    /**
     * Add an ORDER BY clause
     * @param {string} column - Column name
     * @param {string} direction - Sort direction (ASC or DESC)
     * @returns {QueryBuilder}
     */
    orderBy(column, direction = 'ASC') {
        this.orderByClause.push(`${column} ${direction.toUpperCase()}`);
        return this;
    }

    /**
     * Set LIMIT
     * @param {number} n - Limit value
     * @returns {QueryBuilder}
     */
    limit(n) {
        this.limitValue = parseInt(n);
        return this;
    }

    /**
     * Set OFFSET
     * @param {number} n - Offset value
     * @returns {QueryBuilder}
     */
    offset(n) {
        this.offsetValue = parseInt(n);
        return this;
    }

    /**
     * Set pagination (convenience method)
     * @param {number} page - Page number (1-indexed)
     * @param {number} perPage - Items per page
     * @returns {QueryBuilder}
     */
    paginate(page, perPage) {
        const pageNum = Math.max(1, parseInt(page));
        const itemsPerPage = parseInt(perPage);
        this.limitValue = itemsPerPage;
        this.offsetValue = (pageNum - 1) * itemsPerPage;
        return this;
    }

    /**
     * Build the final query object
     * @returns {{text: string, values: Array}} Query object for pg pool.query()
     */
    build() {
        let query = `SELECT ${this.selectColumns.join(', ')} FROM ${this.table}`;

        // Add JOINs
        if (this.joins.length > 0) {
            this.joins.forEach(join => {
                query += ` ${join.type} JOIN ${join.table} ON ${join.on}`;
            });
        }

        // Add WHERE conditions
        if (this.conditions.length > 0) {
            const whereClause = this.conditions
                .map(c => c.clause)
                .join(' AND ');
            query += ` WHERE ${whereClause}`;
        }

        // Add ORDER BY
        if (this.orderByClause.length > 0) {
            query += ` ORDER BY ${this.orderByClause.join(', ')}`;
        }

        // Add LIMIT
        if (this.limitValue !== null) {
            query += ` LIMIT ${this.limitValue}`;
        }

        // Add OFFSET
        if (this.offsetValue !== null) {
            query += ` OFFSET ${this.offsetValue}`;
        }

        return {
            text: query,
            values: this.values
        };
    }

    /**
     * Build a COUNT query
     * @returns {{text: string, values: Array}} Query object for counting rows
     */
    buildCount() {
        let query = `SELECT COUNT(*) FROM ${this.table}`;

        // Add JOINs
        if (this.joins.length > 0) {
            this.joins.forEach(join => {
                query += ` ${join.type} JOIN ${join.table} ON ${join.on}`;
            });
        }

        // Add WHERE conditions
        if (this.conditions.length > 0) {
            const whereClause = this.conditions
                .map(c => c.clause)
                .join(' AND ');
            query += ` WHERE ${whereClause}`;
        }

        return {
            text: query,
            values: this.values
        };
    }
}

module.exports = QueryBuilder;
