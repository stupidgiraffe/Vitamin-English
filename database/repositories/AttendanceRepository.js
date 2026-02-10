const BaseRepository = require('./BaseRepository');
const QueryBuilder = require('../utils/QueryBuilder');

/**
 * AttendanceRepository - Repository for attendance entity operations
 * Extends BaseRepository with attendance-specific methods
 */
class AttendanceRepository extends BaseRepository {
    constructor(pool) {
        super(pool, 'attendance');
    }

    /**
     * Get all attendance records with student and class information
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of attendance records
     */
    async findAll(options = {}) {
        const {
            page = 1,
            perPage = 500,
            orderBy = 'date',
            orderDirection = 'DESC'
        } = options;

        const qb = new QueryBuilder('attendance a');
        qb.select('a.*', 's.name as student_name', 'c.name as class_name', 'u.full_name as teacher_name')
          .join('students s', 'a.student_id = s.id', 'LEFT')
          .join('classes c', 'a.class_id = c.id', 'LEFT')
          .join('users u', 'a.teacher_id = u.id', 'LEFT');

        qb.orderBy(`a.${orderBy}`, orderDirection);
        
        if (perPage > 0) {
            qb.paginate(page, perPage);
        }

        const query = qb.build();
        const result = await this.pool.query(query.text, query.values);
        return result.rows;
    }

    /**
     * Get attendance records by class and date range
     * @param {number} classId - Class ID
     * @param {string} startDate - Start date (YYYY-MM-DD format or VARCHAR)
     * @param {string} endDate - End date (YYYY-MM-DD format or VARCHAR)
     * @returns {Promise<Array>} Attendance records
     */
    async getByClassAndDateRange(classId, startDate, endDate) {
        const result = await this.query(
            `SELECT a.*, s.name as student_name, s.id as student_id
             FROM attendance a
             LEFT JOIN students s ON a.student_id = s.id
             WHERE a.class_id = $1 AND a.date >= $2 AND a.date <= $3
             ORDER BY a.date, s.name`,
            [classId, startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Upsert attendance record (insert or update)
     * @param {Object} data - Attendance data
     * @returns {Promise<Object>} Upserted attendance record
     */
    async upsert(data) {
        const { student_id, class_id, date, status, notes, time, teacher_id } = data;
        
        const result = await this.query(
            `INSERT INTO attendance (student_id, class_id, date, status, notes, time, teacher_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (student_id, class_id, date)
             DO UPDATE SET 
                status = EXCLUDED.status,
                notes = EXCLUDED.notes,
                time = EXCLUDED.time,
                teacher_id = EXCLUDED.teacher_id
             RETURNING *`,
            [student_id, class_id, date, status || '', notes || null, time || null, teacher_id || null]
        );
        
        return result.rows[0];
    }

    /**
     * Get attendance history for a student
     * @param {number} studentId - Student ID
     * @param {number} limit - Max number of records to return
     * @returns {Promise<Array>} Student attendance history
     */
    async getStudentHistory(studentId, limit = 60) {
        const result = await this.query(
            `SELECT a.*, c.name as class_name
             FROM attendance a
             LEFT JOIN classes c ON a.class_id = c.id
             WHERE a.student_id = $1
             ORDER BY a.date DESC
             LIMIT $2`,
            [studentId, limit]
        );
        return result.rows;
    }

    /**
     * Get attendance statistics for a student
     * @param {number} studentId - Student ID
     * @param {string} startDate - Optional start date filter
     * @param {string} endDate - Optional end date filter
     * @returns {Promise<Object>} Attendance statistics
     */
    async getStatistics(studentId, startDate = null, endDate = null) {
        let query = `
            SELECT 
                COUNT(*) as total_days,
                SUM(CASE WHEN status = 'O' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN status = 'X' THEN 1 ELSE 0 END) as absent_days,
                SUM(CASE WHEN status = '/' THEN 1 ELSE 0 END) as tardy_days,
                ROUND(
                    (SUM(CASE WHEN status = 'O' THEN 1 ELSE 0 END)::numeric / 
                     NULLIF(COUNT(*), 0) * 100), 2
                ) as attendance_rate
            FROM attendance 
            WHERE student_id = $1
        `;
        
        const params = [studentId];
        
        if (startDate && endDate) {
            query += ' AND date >= $2 AND date <= $3';
            params.push(startDate, endDate);
        }

        const result = await this.query(query, params);
        return result.rows[0];
    }

    /**
     * Get attendance for a specific class on a specific date
     * @param {number} classId - Class ID
     * @param {string} date - Date
     * @returns {Promise<Array>} Attendance records for that class and date
     */
    async getByClassAndDate(classId, date) {
        const result = await this.query(
            `SELECT a.*, s.name as student_name, s.id as student_id
             FROM attendance a
             LEFT JOIN students s ON a.student_id = s.id
             WHERE a.class_id = $1 AND a.date = $2
             ORDER BY s.name`,
            [classId, date]
        );
        return result.rows;
    }

    /**
     * Bulk upsert attendance records
     * @param {Array} records - Array of attendance records
     * @returns {Promise<Array>} Upserted records
     */
    async bulkUpsert(records) {
        const results = [];
        for (const record of records) {
            const result = await this.upsert(record);
            results.push(result);
        }
        return results;
    }
}

module.exports = AttendanceRepository;
