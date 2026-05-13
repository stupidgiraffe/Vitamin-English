const express = require('express');
const dataHub = require('../database/DataHub');
const requireAdmin = require('../middleware/requireAdmin');
const { normalizeDate } = require('../utils/dateNormalize');

const router = express.Router();

const SORT_OPTIONS = {
    date_desc: (a, b) => compareDates(b.normalized_date || b.date, a.normalized_date || a.date) ||
        compareDates(b.created_at, a.created_at) || (b.id - a.id),
    date_asc: (a, b) => compareDates(a.normalized_date || a.date, b.normalized_date || b.date) ||
        compareDates(a.created_at, b.created_at) || (a.id - b.id),
    created_desc: (a, b) => compareDates(b.created_at, a.created_at) || (b.id - a.id),
    created_asc: (a, b) => compareDates(a.created_at, b.created_at) || (a.id - b.id),
    teacher_asc: (a, b) => compareText(a.teacher_name, b.teacher_name) ||
        compareDates(b.created_at, a.created_at) || (a.id - b.id),
    class_asc: (a, b) => compareText(a.class_name, b.class_name) ||
        compareDates(b.created_at, a.created_at) || (a.id - b.id)
};

router.use(requireAdmin);

function requireSameOriginWrites(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    const secFetchSite = req.get('sec-fetch-site');
    if (secFetchSite === 'same-origin' || secFetchSite === 'none') {
        return next();
    }

    const host = req.get('host');
    const origin = req.get('origin');
    const referer = req.get('referer');
    const allowedOrigins = host ? [`https://${host}`, `http://${host}`] : [];

    if ((origin && allowedOrigins.includes(origin)) ||
        (referer && allowedOrigins.some(allowedOrigin => referer.startsWith(allowedOrigin)))) {
        return next();
    }

    return res.status(403).json({ error: 'Cross-site request blocked' });
}

router.use(requireSameOriginWrites);

function parseInteger(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function parseBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value !== 'string') {
        return false;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function compareDates(a, b) {
    const left = a ? new Date(a).getTime() : Number.NEGATIVE_INFINITY;
    const right = b ? new Date(b).getTime() : Number.NEGATIVE_INFINITY;

    if (Number.isNaN(left) && Number.isNaN(right)) return 0;
    if (Number.isNaN(left)) return -1;
    if (Number.isNaN(right)) return 1;
    return left - right;
}

function compareText(a, b) {
    return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
}

function buildDuplicateMetadata(rows) {
    const counts = new Map();

    rows.forEach(row => {
        if (!row.normalized_date) {
            return;
        }

        const key = `${row.class_id}|${row.normalized_date}`;
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    return counts;
}

function escapeCsv(value) {
    if (value == null) {
        return '';
    }

    const stringValue = String(value);
    if (!/[",\n]/.test(stringValue)) {
        return stringValue;
    }

    return `"${stringValue.replace(/"/g, '""')}"`;
}

function serializeAuditValue(value) {
    return value == null ? null : JSON.stringify(value);
}

async function writeAudit(client, { sheetId = null, action, performedBy, before = null, after = null, notes = null }) {
    await client.query(
        `INSERT INTO teacher_comment_sheet_audit
            (sheet_id, action, performed_by, before_json, after_json, notes)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [sheetId, action, performedBy, serializeAuditValue(before), serializeAuditValue(after), notes]
    );
}

async function fetchTeacherCommentSheets(filters = {}, client = dataHub.pool) {
    const {
        teacherId = null,
        classId = null
    } = filters;

    const whereParts = [];
    const params = [];

    if (teacherId) {
        params.push(teacherId);
        whereParts.push(`tcs.teacher_id = $${params.length}`);
    }

    if (classId) {
        params.push(classId);
        whereParts.push(`tcs.class_id = $${params.length}`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const result = await client.query(
        `SELECT
            tcs.*,
            c.name AS class_name,
            u.full_name AS teacher_name,
            COALESCE(COUNT(mrw.id), 0)::int AS monthly_report_week_refs
         FROM teacher_comment_sheets tcs
         LEFT JOIN classes c ON tcs.class_id = c.id
         LEFT JOIN users u ON tcs.teacher_id = u.id
         LEFT JOIN monthly_report_weeks mrw ON mrw.teacher_comment_sheet_id = tcs.id
         ${whereClause}
         GROUP BY tcs.id, c.name, u.full_name`,
        params
    );

    const normalizedRows = result.rows.map(row => ({
        ...row,
        id: Number(row.id),
        class_id: Number(row.class_id),
        teacher_id: Number(row.teacher_id),
        monthly_report_week_refs: Number(row.monthly_report_week_refs) || 0,
        normalized_date: normalizeDate(row.date)
    }));

    const duplicateCounts = buildDuplicateMetadata(normalizedRows);

    return normalizedRows.map(row => {
        const duplicateGroupKey = row.normalized_date ? `${row.class_id}|${row.normalized_date}` : null;
        const duplicateCount = duplicateGroupKey ? (duplicateCounts.get(duplicateGroupKey) || 0) : 0;

        return {
            ...row,
            duplicate_group_key: duplicateCount > 1 ? duplicateGroupKey : null,
            duplicate_count: duplicateCount > 1 ? duplicateCount : 0
        };
    });
}

function applyManageFilters(rows, query) {
    const startDate = query.start_date ? normalizeDate(query.start_date) : null;
    const endDate = query.end_date ? normalizeDate(query.end_date) : null;
    const duplicatesOnly = parseBoolean(query.has_duplicates);
    const sortKey = SORT_OPTIONS[query.sort] ? query.sort : 'date_desc';

    let filtered = rows.slice();

    if (startDate) {
        filtered = filtered.filter(row => row.normalized_date && row.normalized_date >= startDate);
    }

    if (endDate) {
        filtered = filtered.filter(row => row.normalized_date && row.normalized_date <= endDate);
    }

    if (duplicatesOnly) {
        filtered = filtered.filter(row => row.duplicate_group_key);
    }

    filtered.sort(SORT_OPTIONS[sortKey]);
    return filtered;
}

function getPageArgs(query) {
    const page = Math.max(parseInteger(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(parseInteger(query.page_size) || 50, 1), 200);
    return { page, pageSize };
}

async function getSheetById(client, id, forUpdate = false) {
    const suffix = forUpdate ? ' FOR UPDATE' : '';
    const result = await client.query(
        `SELECT *
         FROM teacher_comment_sheets
         WHERE id = $1${suffix}`,
        [id]
    );

    return result.rows[0] || null;
}

async function countReferences(client, sheetId) {
    const [monthlyWeeksResult, pdfHistoryResult] = await Promise.all([
        client.query(
            'SELECT COUNT(*)::int AS count FROM monthly_report_weeks WHERE teacher_comment_sheet_id = $1',
            [sheetId]
        ),
        client.query(
            'SELECT COUNT(*)::int AS count FROM pdf_history WHERE report_id = $1',
            [sheetId]
        )
    ]);

    return {
        monthly_report_weeks: Number(monthlyWeeksResult.rows[0]?.count) || 0,
        pdf_history: Number(pdfHistoryResult.rows[0]?.count) || 0
    };
}

async function columnIsNullable(client, tableName, columnName) {
    const result = await client.query(
        `SELECT is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2`,
        [tableName, columnName]
    );

    return result.rows[0]?.is_nullable === 'YES';
}

function validateIdArray(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        return null;
    }

    const parsedIds = ids.map(parseInteger);
    if (parsedIds.some(id => id == null)) {
        return null;
    }

    return [...new Set(parsedIds)];
}

function buildDuplicateGroups(rows) {
    const groups = new Map();

    rows.forEach(row => {
        if (!row.duplicate_group_key) {
            return;
        }

        if (!groups.has(row.duplicate_group_key)) {
            groups.set(row.duplicate_group_key, {
                class_id: row.class_id,
                class_name: row.class_name,
                normalized_date: row.normalized_date,
                count: 0,
                sheet_ids: [],
                rows: []
            });
        }

        const group = groups.get(row.duplicate_group_key);
        group.count += 1;
        group.sheet_ids.push(row.id);
        group.rows.push({
            id: row.id,
            class_id: row.class_id,
            class_name: row.class_name,
            teacher_id: row.teacher_id,
            teacher_name: row.teacher_name,
            date: row.date,
            normalized_date: row.normalized_date,
            target_topic: row.target_topic,
            created_at: row.created_at,
            updated_at: row.updated_at,
            monthly_report_week_refs: row.monthly_report_week_refs
        });
    });

    return Array.from(groups.values()).sort((a, b) =>
        (b.count - a.count) ||
        compareDates(b.normalized_date, a.normalized_date) ||
        compareText(a.class_name, b.class_name)
    );
}

router.get('/manage', async (req, res) => {
    try {
        const teacherId = req.query.teacher_id ? parseInteger(req.query.teacher_id) : null;
        const classId = req.query.class_id ? parseInteger(req.query.class_id) : null;

        if ((req.query.teacher_id && teacherId == null) || (req.query.class_id && classId == null)) {
            return res.status(400).json({ error: 'Invalid teacher_id or class_id filter' });
        }

        if (req.query.start_date && !normalizeDate(req.query.start_date)) {
            return res.status(400).json({ error: 'Invalid start_date filter' });
        }

        if (req.query.end_date && !normalizeDate(req.query.end_date)) {
            return res.status(400).json({ error: 'Invalid end_date filter' });
        }

        if (req.query.sort && !SORT_OPTIONS[req.query.sort]) {
            return res.status(400).json({ error: 'Invalid sort option' });
        }

        const rows = await fetchTeacherCommentSheets({ teacherId, classId });
        const filteredRows = applyManageFilters(rows, req.query);
        const { page, pageSize } = getPageArgs(req.query);
        const startIndex = (page - 1) * pageSize;
        const pagedRows = filteredRows.slice(startIndex, startIndex + pageSize);

        return res.json({
            rows: pagedRows.map(row => ({
                ...row,
                target_topic: row.target_topic ?? null
            })),
            total: filteredRows.length,
            page,
            page_size: pageSize
        });
    } catch (error) {
        console.error('❌ Error managing teacher comment sheets:', error);
        return res.status(500).json({ error: 'Failed to load teacher comment sheets' });
    }
});

router.get('/duplicates', async (req, res) => {
    try {
        const rows = await fetchTeacherCommentSheets();
        return res.json(buildDuplicateGroups(rows));
    } catch (error) {
        console.error('❌ Error fetching duplicate teacher comment sheets:', error);
        return res.status(500).json({ error: 'Failed to load duplicate teacher comment sheets' });
    }
});

router.patch('/:id/date', async (req, res) => {
    const id = parseInteger(req.params.id);
    const normalizedDate = normalizeDate(req.body?.new_date);

    if (id == null) {
        return res.status(400).json({ error: 'Invalid teacher comment sheet id' });
    }

    if (!normalizedDate) {
        return res.status(400).json({ error: 'new_date could not be parsed into a valid date' });
    }

    const client = await dataHub.pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await getSheetById(client, id, true);
        if (!existing) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Teacher comment sheet not found' });
        }

        const updatedResult = await client.query(
            `UPDATE teacher_comment_sheets
             SET date = $1
             WHERE id = $2
             RETURNING *`,
            [normalizedDate, id]
        );

        await writeAudit(client, {
            sheetId: id,
            action: 'update_date',
            performedBy: req.session.userId,
            before: existing,
            after: updatedResult.rows[0],
            notes: `Date normalized from "${existing.date}" to "${normalizedDate}"`
        });

        await client.query('COMMIT');

        const managedRows = await fetchTeacherCommentSheets({}, dataHub.pool);
        const updatedRow = managedRows.find(row => row.id === id);
        return res.json(updatedRow || updatedResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error updating teacher comment sheet date:', error);
        return res.status(500).json({ error: 'Failed to update teacher comment sheet date' });
    } finally {
        client.release();
    }
});

router.post('/bulk-update-date', async (req, res) => {
    const ids = validateIdArray(req.body?.ids);
    const normalizedDate = normalizeDate(req.body?.new_date);

    if (!ids) {
        return res.status(400).json({ error: 'ids must be a non-empty array of integers' });
    }

    if (!normalizedDate) {
        return res.status(400).json({ error: 'new_date could not be parsed into a valid date' });
    }

    const client = await dataHub.pool.connect();
    try {
        await client.query('BEGIN');

        const existingResult = await client.query(
            'SELECT * FROM teacher_comment_sheets WHERE id = ANY($1::int[]) FOR UPDATE',
            [ids]
        );

        if (existingResult.rows.length !== ids.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'One or more teacher comment sheets were not found' });
        }

        const beforeById = new Map(existingResult.rows.map(row => [Number(row.id), row]));
        const updatedResult = await client.query(
            `UPDATE teacher_comment_sheets
             SET date = $1
             WHERE id = ANY($2::int[])
             RETURNING *`,
            [normalizedDate, ids]
        );

        for (const updatedRow of updatedResult.rows) {
            await writeAudit(client, {
                sheetId: updatedRow.id,
                action: 'bulk_update_date',
                performedBy: req.session.userId,
                before: beforeById.get(Number(updatedRow.id)),
                after: updatedRow,
                notes: `Bulk date update to "${normalizedDate}"`
            });
        }

        await client.query('COMMIT');
        return res.json({ updated: updatedResult.rowCount, ids });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error bulk updating teacher comment sheet dates:', error);
        return res.status(500).json({ error: 'Failed to bulk update teacher comment sheet dates' });
    } finally {
        client.release();
    }
});

router.post('/merge', async (req, res) => {
    const keepId = parseInteger(req.body?.keep_id);
    const loserIds = validateIdArray(req.body?.loser_ids);
    const dryRun = parseBoolean(req.body?.dry_run);

    if (keepId == null || !loserIds) {
        return res.status(400).json({ error: 'keep_id and loser_ids are required' });
    }

    if (loserIds.includes(keepId)) {
        return res.status(400).json({ error: 'keep_id cannot also appear in loser_ids' });
    }

    const client = await dataHub.pool.connect();
    try {
        await client.query('BEGIN');

        const allIds = [keepId, ...loserIds];
        const sheetsResult = await client.query(
            'SELECT * FROM teacher_comment_sheets WHERE id = ANY($1::int[]) FOR UPDATE',
            [allIds]
        );

        if (sheetsResult.rows.length !== allIds.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'One or more teacher comment sheets were not found' });
        }

        const keepSheet = sheetsResult.rows.find(row => Number(row.id) === keepId);
        const loserSheets = sheetsResult.rows.filter(row => loserIds.includes(Number(row.id)));
        const keepNormalizedDate = normalizeDate(keepSheet.date);
        const allMatchDuplicateGroup = keepNormalizedDate && loserSheets.every(row =>
            Number(row.class_id) === Number(keepSheet.class_id) && normalizeDate(row.date) === keepNormalizedDate
        );

        if (!allMatchDuplicateGroup) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'For safety, merge is only allowed for sheets in the same class and normalized date group'
            });
        }

        const refCountResult = await client.query(
            `SELECT teacher_comment_sheet_id, COUNT(*)::int AS count
             FROM monthly_report_weeks
             WHERE teacher_comment_sheet_id = ANY($1::int[])
             GROUP BY teacher_comment_sheet_id`,
            [loserIds]
        );
        const refCounts = refCountResult.rows.reduce((acc, row) => {
            acc[Number(row.teacher_comment_sheet_id)] = Number(row.count) || 0;
            return acc;
        }, {});
        const totalRefs = Object.values(refCounts).reduce((sum, value) => sum + value, 0);

        if (dryRun) {
            await client.query('ROLLBACK');
            return res.json({
                keep_id: keepId,
                loser_ids: loserIds,
                would_repoint_monthly_report_weeks: totalRefs,
                references_by_loser: refCounts,
                would_delete: loserSheets.map(sheet => ({
                    id: Number(sheet.id),
                    class_id: Number(sheet.class_id),
                    teacher_id: Number(sheet.teacher_id),
                    date: sheet.date,
                    normalized_date: normalizeDate(sheet.date)
                }))
            });
        }

        await client.query(
            `UPDATE monthly_report_weeks
             SET teacher_comment_sheet_id = $1
             WHERE teacher_comment_sheet_id = ANY($2::int[])`,
            [keepId, loserIds]
        );

        await client.query(
            'DELETE FROM teacher_comment_sheets WHERE id = ANY($1::int[])',
            [loserIds]
        );

        for (const loserSheet of loserSheets) {
            await writeAudit(client, {
                sheetId: loserSheet.id,
                action: 'merge',
                performedBy: req.session.userId,
                before: loserSheet,
                after: { kept_sheet_id: keepId },
                notes: `Merged into teacher_comment_sheet ${keepId}; repointed ${refCounts[Number(loserSheet.id)] || 0} monthly_report_weeks`
            });
        }

        await client.query('COMMIT');
        return res.json({
            merged: loserIds.length,
            keep_id: keepId,
            loser_ids: loserIds,
            repointed_monthly_report_weeks: totalRefs
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error merging teacher comment sheets:', error);
        return res.status(500).json({ error: 'Failed to merge teacher comment sheets' });
    } finally {
        client.release();
    }
});

router.delete('/:id', async (req, res) => {
    const id = parseInteger(req.params.id);
    const force = parseBoolean(req.query.force);

    if (id == null) {
        return res.status(400).json({ error: 'Invalid teacher comment sheet id' });
    }

    const client = await dataHub.pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await getSheetById(client, id, true);
        if (!existing) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Teacher comment sheet not found' });
        }

        const references = await countReferences(client, id);
        const hasReferences = references.monthly_report_weeks > 0 || references.pdf_history > 0;

        if (hasReferences && !force) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: 'Teacher comment sheet is still referenced',
                references
            });
        }

        if (references.monthly_report_weeks > 0) {
            const monthlyReportsNullable = await columnIsNullable(client, 'monthly_report_weeks', 'teacher_comment_sheet_id');
            if (!monthlyReportsNullable) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    error: 'monthly_report_weeks.teacher_comment_sheet_id is not nullable; merge instead of deleting',
                    references
                });
            }

            await client.query(
                'UPDATE monthly_report_weeks SET teacher_comment_sheet_id = NULL WHERE teacher_comment_sheet_id = $1',
                [id]
            );
        }

        if (references.pdf_history > 0) {
            const pdfHistoryNullable = await columnIsNullable(client, 'pdf_history', 'report_id');
            if (!pdfHistoryNullable) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    error: 'pdf_history.report_id is not nullable; cannot safely delete this sheet',
                    references
                });
            }

            await client.query(
                'UPDATE pdf_history SET report_id = NULL WHERE report_id = $1',
                [id]
            );
        }

        await client.query('DELETE FROM teacher_comment_sheets WHERE id = $1', [id]);

        await writeAudit(client, {
            sheetId: id,
            action: 'delete',
            performedBy: req.session.userId,
            before: existing,
            after: null,
            notes: force
                ? `Force delete with references cleared: ${JSON.stringify(references)}`
                : 'Deleted without external references'
        });

        await client.query('COMMIT');
        return res.json({ deleted: true, id, references_cleared: force ? references : null });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error deleting teacher comment sheet:', error);
        return res.status(500).json({ error: 'Failed to delete teacher comment sheet' });
    } finally {
        client.release();
    }
});

router.get('/export.csv', async (req, res) => {
    try {
        const teacherId = req.query.teacher_id ? parseInteger(req.query.teacher_id) : null;
        const classId = req.query.class_id ? parseInteger(req.query.class_id) : null;

        if ((req.query.teacher_id && teacherId == null) || (req.query.class_id && classId == null)) {
            return res.status(400).json({ error: 'Invalid teacher_id or class_id filter' });
        }

        const rows = applyManageFilters(await fetchTeacherCommentSheets({ teacherId, classId }), req.query);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="teacher-comment-sheets-cleanup.csv"');

        res.write('id,class_id,class_name,teacher_id,teacher_name,date,normalized_date,target_topic,created_at,updated_at\n');
        rows.forEach(row => {
            const values = [
                row.id,
                row.class_id,
                row.class_name,
                row.teacher_id,
                row.teacher_name,
                row.date,
                row.normalized_date,
                row.target_topic,
                row.created_at,
                row.updated_at
            ].map(escapeCsv);
            res.write(`${values.join(',')}\n`);
        });

        return res.end();
    } catch (error) {
        console.error('❌ Error exporting teacher comment sheets CSV:', error);
        return res.status(500).json({ error: 'Failed to export teacher comment sheets CSV' });
    }
});

router.post('/import-date-csv', async (req, res) => {
    const inputRows = req.body?.rows;

    if (!Array.isArray(inputRows) || inputRows.length === 0) {
        return res.status(400).json({ error: 'rows must be a non-empty array of { id, new_date } objects' });
    }

    const errors = [];
    const normalizedRows = inputRows.map((row, index) => {
        const id = parseInteger(row?.id);
        const normalizedDate = normalizeDate(row?.new_date);

        if (id == null) {
            errors.push({ index, id: row?.id ?? null, error: 'Invalid id' });
        }

        if (!normalizedDate) {
            errors.push({ index, id: row?.id ?? null, error: 'Invalid new_date' });
        }

        return {
            index,
            id,
            new_date: normalizedDate
        };
    });

    const duplicateIds = normalizedRows.reduce((acc, row) => {
        if (row.id == null) {
            return acc;
        }

        acc[row.id] = (acc[row.id] || 0) + 1;
        return acc;
    }, {});

    Object.entries(duplicateIds).forEach(([id, count]) => {
        if (count > 1) {
            errors.push({ id: Number(id), error: 'Duplicate id in import payload' });
        }
    });

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', errors });
    }

    const ids = normalizedRows.map(row => row.id);
    const client = await dataHub.pool.connect();
    try {
        await client.query('BEGIN');

        const existingResult = await client.query(
            'SELECT * FROM teacher_comment_sheets WHERE id = ANY($1::int[]) FOR UPDATE',
            [ids]
        );

        if (existingResult.rows.length !== ids.length) {
            await client.query('ROLLBACK');
            const foundIds = new Set(existingResult.rows.map(row => Number(row.id)));
            return res.status(400).json({
                error: 'Validation failed',
                errors: normalizedRows
                    .filter(row => !foundIds.has(row.id))
                    .map(row => ({ id: row.id, error: 'Teacher comment sheet not found' }))
            });
        }

        const existingById = new Map(existingResult.rows.map(row => [Number(row.id), row]));

        for (const row of normalizedRows) {
            const before = existingById.get(row.id);
            const updatedResult = await client.query(
                `UPDATE teacher_comment_sheets
                 SET date = $1
                 WHERE id = $2
                 RETURNING *`,
                [row.new_date, row.id]
            );

            await writeAudit(client, {
                sheetId: row.id,
                action: 'bulk_update_date',
                performedBy: req.session.userId,
                before,
                after: updatedResult.rows[0],
                notes: 'Imported date cleanup payload'
            });
        }

        await client.query('COMMIT');
        return res.json({ updated: normalizedRows.length, errors: [] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error importing teacher comment sheet dates:', error);
        return res.status(500).json({ error: 'Failed to import teacher comment sheet dates' });
    } finally {
        client.release();
    }
});

module.exports = router;
