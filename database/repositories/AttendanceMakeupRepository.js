const BaseRepository = require('./BaseRepository');

/**
 * AttendanceMakeupRepository - Repository for attendance makeup student operations
 * Manages the attendance_makeup_students junction table which tracks temporary
 * visitors in a class for attendance purposes without changing their permanent class.
 */
class AttendanceMakeupRepository extends BaseRepository {
    constructor(pool) {
        super(pool, 'attendance_makeup_students');
    }

    /**
     * Get makeup visitors for a class within a date range (inclusive)
     * @param {number} classId - Target class ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise<Array>} Makeup visitor records with student info
     */
    async getByClassAndDateRange(classId, startDate, endDate) {
        const result = await this.query(
            `SELECT ams.*,
                    s.name as student_name,
                    s.student_type,
                    s.color_code,
                    sc.name as source_class_name
             FROM attendance_makeup_students ams
             JOIN students s ON ams.student_id = s.id
             LEFT JOIN classes sc ON ams.source_class_id = sc.id
             WHERE ams.class_id = $1
               AND ams.date >= $2
               AND ams.date <= $3
             ORDER BY ams.date, s.name`,
            [classId, startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Add a makeup student to a class for a specific date
     * @param {number} studentId - Student ID
     * @param {number} classId - Target class ID
     * @param {string} date - Date (YYYY-MM-DD)
     * @param {number|null} sourceClassId - Student's home class ID
     * @param {string|null} reason - Optional reason text
     * @param {number|null} addedBy - User ID of who added them
     * @param {number|null} makeupLessonId - Optional linked makeup lesson ID
     * @returns {Promise<Object>} Created record
     */
    async addMakeupStudent(studentId, classId, date, sourceClassId = null, reason = null, addedBy = null, makeupLessonId = null) {
        const result = await this.query(
            `INSERT INTO attendance_makeup_students
                (student_id, class_id, date, source_class_id, reason, added_by, makeup_lesson_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT ON CONSTRAINT attendance_makeup_unique DO UPDATE
                SET reason = EXCLUDED.reason,
                    added_by = EXCLUDED.added_by,
                    makeup_lesson_id = COALESCE(EXCLUDED.makeup_lesson_id, attendance_makeup_students.makeup_lesson_id)
             RETURNING *`,
            [studentId, classId, date, sourceClassId, reason, addedBy, makeupLessonId]
        );
        return result.rows[0];
    }

    /**
     * Remove a makeup student from a class for a specific date
     * @param {number} studentId - Student ID
     * @param {number} classId - Target class ID
     * @param {string} date - Date (YYYY-MM-DD)
     * @returns {Promise<boolean>} True if a record was deleted
     */
    async removeMakeupStudent(studentId, classId, date) {
        const result = await this.query(
            `DELETE FROM attendance_makeup_students
             WHERE student_id = $1 AND class_id = $2 AND date = $3`,
            [studentId, classId, date]
        );
        return result.rowCount > 0;
    }

    /**
     * Get all makeup visits for a student
     * @param {number} studentId - Student ID
     * @returns {Promise<Array>} All makeup visit records for the student
     */
    async getByStudent(studentId) {
        const result = await this.query(
            `SELECT ams.*,
                    c.name as class_name,
                    sc.name as source_class_name
             FROM attendance_makeup_students ams
             JOIN classes c ON ams.class_id = c.id
             LEFT JOIN classes sc ON ams.source_class_id = sc.id
             WHERE ams.student_id = $1
             ORDER BY ams.date DESC`,
            [studentId]
        );
        return result.rows;
    }

    /**
     * Update the linked makeup_lesson_id for a record
     * @param {number} studentId - Student ID
     * @param {number} classId - Class ID
     * @param {string} date - Date (YYYY-MM-DD)
     * @param {number} makeupLessonId - Makeup lesson ID to link
     * @returns {Promise<Object|null>} Updated record or null
     */
    async linkMakeupLesson(studentId, classId, date, makeupLessonId) {
        const result = await this.query(
            `UPDATE attendance_makeup_students
             SET makeup_lesson_id = $4
             WHERE student_id = $1 AND class_id = $2 AND date = $3
             RETURNING *`,
            [studentId, classId, date, makeupLessonId]
        );
        return result.rows[0] || null;
    }
}

module.exports = AttendanceMakeupRepository;
