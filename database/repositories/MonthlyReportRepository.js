const BaseRepository = require('./BaseRepository');
const QueryBuilder = require('../utils/QueryBuilder');

/**
 * MonthlyReportRepository - Repository for monthly report entity operations
 * Extends BaseRepository with monthly report-specific methods
 */
class MonthlyReportRepository extends BaseRepository {
    constructor(pool) {
        super(pool, 'monthly_reports');
    }

    /**
     * Get all monthly reports with class information
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of monthly reports
     */
    async findAll(options = {}) {
        const {
            page = 1,
            perPage = 50,
            orderBy = 'year',
            orderDirection = 'DESC',
            classId = null,
            status = null
        } = options;

        const qb = new QueryBuilder('monthly_reports mr');
        qb.select('mr.*', 'c.name as class_name', 'u.full_name as created_by_name')
          .join('classes c', 'mr.class_id = c.id', 'LEFT')
          .join('users u', 'mr.created_by = u.id', 'LEFT');

        if (classId) {
            qb.where('mr.class_id', '=', classId);
        }

        if (status) {
            qb.where('mr.status', '=', status);
        }

        qb.orderBy(`mr.${orderBy}`, orderDirection);
        
        if (orderBy !== 'month') {
            qb.orderBy('mr.month', 'DESC');
        }

        if (perPage > 0) {
            qb.paginate(page, perPage);
        }

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Get monthly report with weeks
     * @param {number} reportId - Monthly report ID
     * @returns {Promise<Object|null>} Report with associated weeks
     */
    async getWithWeeks(reportId) {
        const report = await this.query(
            `SELECT mr.*, c.name as class_name, u.full_name as created_by_name
             FROM monthly_reports mr
             LEFT JOIN classes c ON mr.class_id = c.id
             LEFT JOIN users u ON mr.created_by = u.id
             WHERE mr.id = $1`,
            [reportId]
        );

        if (!report.rows[0]) {
            return null;
        }

        const weeks = await this.query(
            `SELECT mrw.*, tcs.target_topic, tcs.vocabulary, tcs.mistakes, tcs.strengths
             FROM monthly_report_weeks mrw
             LEFT JOIN teacher_comment_sheets tcs ON mrw.teacher_comment_sheet_id = tcs.id
             WHERE mrw.monthly_report_id = $1
             ORDER BY mrw.week_number`,
            [reportId]
        );

        return {
            ...report.rows[0],
            weeks: weeks.rows
        };
    }

    /**
     * Get monthly report by class and period
     * @param {number} classId - Class ID
     * @param {number} year - Year
     * @param {number} month - Month
     * @returns {Promise<Object|null>} Monthly report or null
     */
    async getByClassAndPeriod(classId, year, month) {
        const result = await this.query(
            `SELECT mr.*, c.name as class_name, u.full_name as created_by_name
             FROM monthly_reports mr
             LEFT JOIN classes c ON mr.class_id = c.id
             LEFT JOIN users u ON mr.created_by = u.id
             WHERE mr.class_id = $1 AND mr.year = $2 AND mr.month = $3`,
            [classId, year, month]
        );
        return result.rows[0] || null;
    }

    /**
     * Get monthly report by class and date range
     * @param {number} classId - Class ID
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @returns {Promise<Object|null>} Monthly report or null
     */
    async getByClassAndDateRange(classId, startDate, endDate) {
        const result = await this.query(
            `SELECT mr.*, c.name as class_name, u.full_name as created_by_name
             FROM monthly_reports mr
             LEFT JOIN classes c ON mr.class_id = c.id
             LEFT JOIN users u ON mr.created_by = u.id
             WHERE mr.class_id = $1 AND mr.start_date = $2 AND mr.end_date = $3`,
            [classId, startDate, endDate]
        );
        return result.rows[0] || null;
    }

    /**
     * Get monthly report by ID with full details (override base method)
     * @param {number} id - Monthly report ID
     * @returns {Promise<Object|null>} Monthly report with related info
     */
    async findById(id) {
        return this.getWithWeeks(id);
    }

    /**
     * Create monthly report with weeks (transaction)
     * @param {Object} reportData - Report data
     * @param {Array} weeksData - Array of week data
     * @returns {Promise<Object>} Created report with weeks
     */
    async createWithWeeks(reportData, weeksData = []) {
        return this.transaction(async (client) => {
            // Create report
            const reportColumns = Object.keys(reportData);
            const reportValues = Object.values(reportData);
            const reportPlaceholders = reportColumns.map((_, i) => `$${i + 1}`).join(', ');

            const reportResult = await client.query(
                `INSERT INTO monthly_reports (${reportColumns.join(', ')}) 
                 VALUES (${reportPlaceholders}) 
                 RETURNING *`,
                reportValues
            );

            const report = reportResult.rows[0];

            // Create weeks
            const weeks = [];
            for (const weekData of weeksData) {
                const weekColumns = Object.keys({ ...weekData, monthly_report_id: report.id });
                const weekValues = Object.values({ ...weekData, monthly_report_id: report.id });
                const weekPlaceholders = weekColumns.map((_, i) => `$${i + 1}`).join(', ');

                const weekResult = await client.query(
                    `INSERT INTO monthly_report_weeks (${weekColumns.join(', ')}) 
                     VALUES (${weekPlaceholders}) 
                     RETURNING *`,
                    weekValues
                );
                weeks.push(weekResult.rows[0]);
            }

            return {
                ...report,
                weeks
            };
        });
    }

    /**
     * Update monthly report status
     * @param {number} id - Report ID
     * @param {string} status - New status
     * @returns {Promise<Object|null>} Updated report
     */
    async updateStatus(id, status) {
        const result = await this.query(
            `UPDATE monthly_reports 
             SET status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id, status]
        );
        return result.rows[0] || null;
    }
}

module.exports = MonthlyReportRepository;
