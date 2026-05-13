(function () {
    const state = {
        page: 1,
        pageSize: 50,
        total: 0,
        rows: [],
        duplicateGroups: [],
        selectedIds: new Set(),
        importRows: [],
        importErrors: [],
        inspectSession: null
    };
    const TOPIC_PREVIEW_LIMIT = 60;

    function isCleanupAdmin() {
        return currentUser && currentUser.role === 'admin';
    }

    function updateRoleBasedNavigation() {
        const navButton = document.getElementById('comment-sheets-cleanup-nav');
        if (navButton) {
            navButton.style.display = isCleanupAdmin() ? '' : 'none';
        }
    }

    function fillSelect(select, items, getLabel) {
        if (!select) return;

        const currentValue = select.value;
        const firstOption = select.querySelector('option')?.outerHTML || '';
        select.innerHTML = firstOption;

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = getLabel(item);
            select.appendChild(option);
        });

        if (currentValue && Array.from(select.options).some(option => option.value === currentValue)) {
            select.value = currentValue;
        }
    }

    function populateCleanupFilters() {
        fillSelect(
            document.getElementById('cleanup-teacher-filter'),
            teachers || [],
            teacher => teacher.full_name
        );
        fillSelect(
            document.getElementById('cleanup-class-filter'),
            classes || [],
            cls => `${typeof getLocationPrefix === 'function' ? getLocationPrefix(cls) : ''}${typeof getClassDisplayName === 'function' ? getClassDisplayName(cls) : cls.name}`
        );
    }

    function getFilters() {
        return {
            teacher_id: document.getElementById('cleanup-teacher-filter')?.value || '',
            class_id: document.getElementById('cleanup-class-filter')?.value || '',
            start_date: document.getElementById('cleanup-start-date')?.value || '',
            end_date: document.getElementById('cleanup-end-date')?.value || '',
            has_duplicates: document.getElementById('cleanup-duplicates-only')?.checked ? 'true' : '',
            sort: document.getElementById('cleanup-sort')?.value || 'date_desc'
        };
    }

    function escapeAttribute(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function normalizeTopic(topic) {
        return String(topic == null ? '' : topic).trim();
    }

    function truncateText(value, limit) {
        const text = String(value == null ? '' : value);
        if (text.length <= limit) {
            return text;
        }
        return `${text.slice(0, limit - 1).trimEnd()}…`;
    }

    function topicCellHtml(topic) {
        const normalizedTopic = normalizeTopic(topic);
        if (!normalizedTopic) {
            return '<span class="cleanup-muted">—</span>';
        }

        const preview = truncateText(normalizedTopic, TOPIC_PREVIEW_LIMIT);
        return `<span class="cleanup-topic-text" title="${escapeAttribute(normalizedTopic)}">${escapeHtml(preview)}</span>`;
    }

    function isForbiddenError(error) {
        return /403/.test(String(error?.message || ''));
    }

    function showAdminAccessError(action) {
        Toast.error(`Admin access is required to ${action} this comment sheet.`);
    }

    function buildQuery(pageOverride) {
        const params = new URLSearchParams();
        const filters = getFilters();

        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            }
        });

        params.set('page', String(pageOverride || state.page));
        params.set('page_size', String(state.pageSize));
        return params.toString();
    }

    function selectedRows() {
        return state.rows.filter(row => state.selectedIds.has(row.id));
    }

    function updateBulkBar() {
        const bar = document.getElementById('cleanup-bulk-bar');
        const selectedCount = document.getElementById('cleanup-selected-count');
        const count = state.selectedIds.size;

        if (selectedCount) {
            selectedCount.textContent = `${count} selected`;
        }

        if (bar) {
            bar.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    function renderDuplicateGroups() {
        const container = document.getElementById('comment-sheets-duplicate-groups');
        if (!container) return;

        if (!state.duplicateGroups.length) {
            container.innerHTML = '<p class="info-text">No duplicate groups detected.</p>';
            return;
        }

        container.innerHTML = state.duplicateGroups.map(group => `
            <div class="cleanup-duplicate-card">
                <div class="cleanup-duplicate-title">${escapeHtml(group.class_name || `Class #${group.class_id}`)}</div>
                <div class="cleanup-duplicate-meta">${escapeHtml(group.normalized_date || 'Unparseable date')} · ${group.count} sheets</div>
                <div class="cleanup-duplicate-list">IDs: ${group.sheet_ids.map(id => `#${id}`).join(', ')}</div>
                <div class="cleanup-duplicate-rows">
                    ${(group.rows || []).map(row => `
                        <div class="cleanup-duplicate-row-item">
                            <span>#${row.id}</span>
                            <span>${escapeHtml(row.teacher_name || `Teacher #${row.teacher_id}`)}</span>
                            <span>${escapeHtml(row.date || '—')}</span>
                            <span>${topicCellHtml(row.target_topic)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    function renderPagination() {
        const currentPage = state.page;
        const totalPages = Math.max(Math.ceil(state.total / state.pageSize), 1);

        const label = document.getElementById('cleanup-page-label');
        const prevButton = document.getElementById('cleanup-prev-page');
        const nextButton = document.getElementById('cleanup-next-page');

        if (label) {
            label.textContent = `Page ${currentPage} of ${totalPages} (${state.total} rows)`;
        }

        if (prevButton) {
            prevButton.disabled = currentPage <= 1;
        }

        if (nextButton) {
            nextButton.disabled = currentPage >= totalPages;
        }
    }

    function renderTable() {
        const container = document.getElementById('comment-sheets-cleanup-table');
        if (!container) return;

        if (!state.rows.length) {
            container.innerHTML = '<p class="info-text">No comment sheets match the current filters.</p>';
            updateBulkBar();
            renderPagination();
            return;
        }

        const allSelected = state.rows.length > 0 && state.rows.every(row => state.selectedIds.has(row.id));

        container.innerHTML = `
            <div class="cleanup-scroll-hint">Swipe horizontally to see all columns.</div>
            <div class="cleanup-table-scroll">
            <table class="table cleanup-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="cleanup-select-all" class="cleanup-no-row-open" ${allSelected ? 'checked' : ''}></th>
                        <th>ID</th>
                        <th>Class</th>
                        <th>Teacher</th>
                        <th>Topic</th>
                        <th>Date (raw)</th>
                        <th>Normalized date</th>
                        <th>Created</th>
                        <th>Refs</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.rows.map(row => `
                        <tr class="cleanup-data-row ${row.duplicate_group_key ? 'cleanup-duplicate-row' : ''}" data-id="${row.id}" role="button" tabindex="0" aria-label="Inspect comment sheet ${row.id}">
                            <td>
                                <input
                                    type="checkbox"
                                    class="cleanup-row-checkbox cleanup-no-row-open"
                                    data-id="${row.id}"
                                    ${state.selectedIds.has(row.id) ? 'checked' : ''}
                                >
                            </td>
                            <td>#${row.id}</td>
                            <td>
                                <div>${escapeHtml(row.class_name || `Class #${row.class_id}`)}</div>
                                ${row.duplicate_count ? `<span class="cleanup-badge cleanup-badge-warning">Duplicate (${row.duplicate_count})</span>` : ''}
                            </td>
                            <td>${escapeHtml(row.teacher_name || `Teacher #${row.teacher_id}`)}</td>
                            <td class="cleanup-topic-cell">${topicCellHtml(row.target_topic)}</td>
                            <td>${escapeHtml(row.date || '')}</td>
                            <td>${escapeHtml(row.normalized_date || 'Unparseable')}</td>
                            <td>${escapeHtml(typeof formatSavedTimestamp === 'function' ? formatSavedTimestamp(row.created_at) : row.created_at || '—')}</td>
                            <td>${row.monthly_report_week_refs || 0}</td>
                            <td data-no-row-open="true">
                                <div class="cleanup-row-actions">
                                    <input type="date" class="form-control cleanup-date-input cleanup-no-row-open" data-id="${row.id}" value="${escapeHtml(row.normalized_date || '')}">
                                    <button class="btn btn-primary btn-small cleanup-save-date-btn cleanup-no-row-open" data-id="${row.id}">Save date</button>
                                    <button class="btn btn-danger btn-small cleanup-delete-row-btn cleanup-no-row-open" data-id="${row.id}">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;

        const selectAll = document.getElementById('cleanup-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (event) => {
                state.rows.forEach(row => {
                    if (event.target.checked) {
                        state.selectedIds.add(row.id);
                    } else {
                        state.selectedIds.delete(row.id);
                    }
                });
                renderTable();
                updateBulkBar();
            });
        }

        container.querySelectorAll('.cleanup-row-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const id = Number(event.target.dataset.id);
                if (event.target.checked) {
                    state.selectedIds.add(id);
                } else {
                    state.selectedIds.delete(id);
                }
                updateBulkBar();
            });
        });

        container.querySelectorAll('.cleanup-no-row-open').forEach(element => {
            element.addEventListener('click', (event) => event.stopPropagation());
            element.addEventListener('keydown', (event) => event.stopPropagation());
        });

        container.querySelectorAll('.cleanup-data-row').forEach(tableRow => {
            const openInspect = () => openInspectModal(Number(tableRow.dataset.id));
            tableRow.addEventListener('click', (event) => {
                if (event.target.closest('.cleanup-no-row-open, [data-no-row-open="true"]')) {
                    return;
                }
                openInspect();
            });
            tableRow.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }
                event.preventDefault();
                if (event.target.closest('.cleanup-no-row-open, [data-no-row-open="true"]')) {
                    return;
                }
                openInspect();
            });
        });

        container.querySelectorAll('.cleanup-save-date-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const id = Number(event.target.dataset.id);
                const input = container.querySelector(`.cleanup-date-input[data-id="${id}"]`);
                const newDate = input?.value;
                if (!newDate) {
                    Toast.error('Select a date before saving.');
                    return;
                }

                try {
                    await api(`/teacher-comment-sheets/admin/${id}/date`, {
                        method: 'PATCH',
                        body: JSON.stringify({ new_date: newDate })
                    });
                    Toast.success(`Comment sheet #${id} updated.`);
                    await refreshCleanupData();
                } catch (_) {
                    // Toast handled by api()
                }
            });
        });

        container.querySelectorAll('.cleanup-delete-row-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const id = Number(event.target.dataset.id);
                const row = state.rows.find(item => item.id === id);
                await deleteRows([row].filter(Boolean));
            });
        });

        updateBulkBar();
        renderPagination();
    }

    function cleanupInspectSession() {
        const session = state.inspectSession;
        if (!session) {
            return;
        }

        document.querySelector('#modal .modal-content')?.classList.remove('cleanup-inspect-modal');
        if (session.originalCloseModal) {
            window.closeModal = session.originalCloseModal;
        }
        state.inspectSession = null;
    }

    function getInspectValue(id) {
        return document.getElementById(id)?.value || '';
    }

    function inspectPayloadFromForm() {
        return {
            target_topic: getInspectValue('cleanup-inspect-target-topic'),
            vocabulary: getInspectValue('cleanup-inspect-vocabulary'),
            phrases: getInspectValue('cleanup-inspect-phrases'),
            mistakes: getInspectValue('cleanup-inspect-mistakes'),
            strengths: getInspectValue('cleanup-inspect-strengths'),
            comments: getInspectValue('cleanup-inspect-comments'),
            others: getInspectValue('cleanup-inspect-others'),
            normalized_date: getInspectValue('cleanup-inspect-date')
        };
    }

    function hasInspectTextChanges(payload, session) {
        return payload.target_topic !== session.initial.target_topic ||
            payload.vocabulary !== session.initial.vocabulary ||
            payload.phrases !== session.initial.phrases ||
            payload.mistakes !== session.initial.mistakes ||
            payload.strengths !== session.initial.strengths ||
            payload.comments !== session.initial.comments ||
            payload.others !== session.initial.others;
    }

    function isInspectDirty(payload, session) {
        if (!session) {
            return false;
        }
        return hasInspectTextChanges(payload, session) ||
            payload.normalized_date !== session.initial.normalized_date;
    }

    function updateInspectDirtyBadge(session) {
        const badge = document.getElementById('cleanup-inspect-unsaved');
        if (!badge || !session) {
            return;
        }
        badge.textContent = session.dirty ? 'Unsaved changes' : 'Saved';
        badge.className = session.dirty
            ? 'cleanup-inspect-status cleanup-inspect-status-dirty'
            : 'cleanup-inspect-status cleanup-inspect-status-clean';
    }

    function buildInspectFormHtml(row, sheet) {
        const normalizedDate = row.normalized_date || '';
        const createdAt = typeof formatSavedTimestamp === 'function'
            ? formatSavedTimestamp(sheet.created_at || row.created_at)
            : (sheet.created_at || row.created_at || '—');
        const updatedAt = typeof formatSavedTimestamp === 'function'
            ? formatSavedTimestamp(sheet.updated_at || row.updated_at)
            : (sheet.updated_at || row.updated_at || '—');

        return `
            <form id="cleanup-inspect-form">
                <div class="cleanup-inspect-meta">
                    <div class="cleanup-inspect-grid">
                        <div><strong>ID:</strong> #${row.id}</div>
                        <div><strong>Class:</strong> ${escapeHtml(row.class_name || `Class #${row.class_id}`)}</div>
                        <div><strong>Teacher:</strong> ${escapeHtml(row.teacher_name || `Teacher #${row.teacher_id}`)}</div>
                        <div><strong>Date (raw):</strong> ${escapeHtml(sheet.date || row.date || '—')}</div>
                        <div><strong>Normalized date:</strong> ${escapeHtml(normalizedDate || 'Unparseable')}</div>
                        <div><strong>Created:</strong> ${escapeHtml(createdAt || '—')}</div>
                        <div><strong>Updated:</strong> ${escapeHtml(updatedAt || '—')}</div>
                    </div>
                    <span id="cleanup-inspect-unsaved" class="cleanup-inspect-status cleanup-inspect-status-clean">Saved</span>
                </div>

                <div class="form-group">
                    <label for="cleanup-inspect-date">Normalized date</label>
                    <input type="date" id="cleanup-inspect-date" class="form-control" value="${escapeHtml(normalizedDate)}">
                </div>

                <div class="form-group">
                    <label for="cleanup-inspect-target-topic">Topic</label>
                    <textarea id="cleanup-inspect-target-topic" class="form-control" rows="3">${escapeHtml(sheet.target_topic || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="cleanup-inspect-vocabulary">Vocabulary</label>
                    <textarea id="cleanup-inspect-vocabulary" class="form-control" rows="3">${escapeHtml(sheet.vocabulary || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="cleanup-inspect-phrases">Phrases</label>
                    <textarea id="cleanup-inspect-phrases" class="form-control" rows="3">${escapeHtml(sheet.phrases || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="cleanup-inspect-mistakes">Mistakes</label>
                    <textarea id="cleanup-inspect-mistakes" class="form-control" rows="3">${escapeHtml(sheet.mistakes || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="cleanup-inspect-strengths">Strengths</label>
                    <textarea id="cleanup-inspect-strengths" class="form-control" rows="3">${escapeHtml(sheet.strengths || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="cleanup-inspect-comments">Comments</label>
                    <textarea id="cleanup-inspect-comments" class="form-control" rows="3">${escapeHtml(sheet.comments || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="cleanup-inspect-others">Others</label>
                    <textarea id="cleanup-inspect-others" class="form-control" rows="3">${escapeHtml(sheet.others || '')}</textarea>
                </div>

                <div class="modal-actions">
                    <button type="submit" class="btn btn-primary" id="cleanup-inspect-save-btn">Save</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `;
    }

    async function openInspectModal(sheetId) {
        const row = state.rows.find(item => item.id === sheetId);
        if (!row) {
            return;
        }

        try {
            const sheet = await api(`/teacher-comment-sheets/${sheetId}`);
            const originalCloseModal = window.closeModal;
            const session = {
                id: sheetId,
                originalCloseModal,
                dirty: false,
                saving: false,
                initial: {
                    target_topic: sheet.target_topic || '',
                    vocabulary: sheet.vocabulary || '',
                    phrases: sheet.phrases || '',
                    mistakes: sheet.mistakes || '',
                    strengths: sheet.strengths || '',
                    comments: sheet.comments || '',
                    others: sheet.others || '',
                    normalized_date: row.normalized_date || ''
                },
                teacherId: sheet.teacher_id || row.teacher_id
            };
            state.inspectSession = session;

            showModal(`Inspect Comment Sheet #${sheetId}`, buildInspectFormHtml(row, sheet));
            document.querySelector('#modal .modal-content')?.classList.add('cleanup-inspect-modal');

            window.closeModal = function (forceClose) {
                if (state.inspectSession !== session) {
                    return originalCloseModal();
                }

                if (!forceClose) {
                    if (session.saving) {
                        if (!confirm('Save is still in progress. Close anyway?')) {
                            return;
                        }
                    } else if (session.dirty && !confirm('Discard unsaved changes?')) {
                        return;
                    }
                }

                cleanupInspectSession();
                originalCloseModal();
            };

            const inspectForm = document.getElementById('cleanup-inspect-form');
            inspectForm?.addEventListener('input', () => {
                const payload = inspectPayloadFromForm();
                session.dirty = isInspectDirty(payload, session);
                updateInspectDirtyBadge(session);
            });

            inspectForm?.addEventListener('submit', async (event) => {
                event.preventDefault();

                const payload = inspectPayloadFromForm();
                const hasTextChanges = hasInspectTextChanges(payload, session);
                const hasDateChanges = payload.normalized_date !== session.initial.normalized_date;

                if (!hasTextChanges && !hasDateChanges) {
                    Toast.info('No changes to save.');
                    return;
                }

                if (hasDateChanges && !payload.normalized_date) {
                    Toast.error('Select a valid date before saving.');
                    return;
                }

                const saveButton = document.getElementById('cleanup-inspect-save-btn');
                if (saveButton) saveButton.disabled = true;
                session.saving = true;

                try {
                    if (hasTextChanges) {
                        await api(`/teacher-comment-sheets/${sheetId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                teacher_id: session.teacherId,
                                target_topic: payload.target_topic,
                                vocabulary: payload.vocabulary,
                                phrases: payload.phrases,
                                mistakes: payload.mistakes,
                                strengths: payload.strengths,
                                comments: payload.comments,
                                others: payload.others
                            })
                        });
                    }

                    if (hasDateChanges) {
                        await api(`/teacher-comment-sheets/admin/${sheetId}/date`, {
                            method: 'PATCH',
                            body: JSON.stringify({ new_date: payload.normalized_date })
                        });
                    }

                    Toast.success(`Comment sheet #${sheetId} saved.`);
                    await refreshCleanupData(state.page);
                    window.closeModal(true);
                } catch (error) {
                    if (isForbiddenError(error)) {
                        showAdminAccessError('edit');
                    }
                } finally {
                    session.saving = false;
                    if (state.inspectSession === session && saveButton) {
                        saveButton.disabled = false;
                    }
                }
            });
        } catch (error) {
            if (isForbiddenError(error)) {
                showAdminAccessError('inspect');
            }
        }
    }

    async function loadDuplicateGroups() {
        try {
            state.duplicateGroups = await api('/teacher-comment-sheets/admin/duplicates');
        } catch (_) {
            state.duplicateGroups = [];
        }
        renderDuplicateGroups();
    }

    async function refreshCleanupData(pageOverride) {
        if (!isCleanupAdmin()) {
            return;
        }

        const table = document.getElementById('comment-sheets-cleanup-table');
        if (table) {
            table.innerHTML = '<p class="info-text">Loading comment sheets…</p>';
        }

        try {
            const response = await api(`/teacher-comment-sheets/admin/manage?${buildQuery(pageOverride)}`);
            state.page = response.page;
            state.pageSize = response.page_size;
            state.total = response.total;
            state.rows = response.rows || [];

            const currentIds = new Set(state.rows.map(row => row.id));
            state.selectedIds = new Set(Array.from(state.selectedIds).filter(id => currentIds.has(id)));

            renderTable();
        } catch (_) {
            state.rows = [];
            state.total = 0;
            renderTable();
        }

        await loadDuplicateGroups();
    }

    async function loadCommentSheetCleanupPage() {
        updateRoleBasedNavigation();

        const access = document.getElementById('comment-sheets-cleanup-access');
        const content = document.getElementById('comment-sheets-cleanup-content');
        if (!access || !content) return;

        if (!isCleanupAdmin()) {
            access.style.display = 'block';
            content.style.display = 'none';
            return;
        }

        access.style.display = 'none';
        content.style.display = 'block';

        populateCleanupFilters();
        await refreshCleanupData(state.page);
    }

    function openBulkDateModal() {
        if (state.selectedIds.size === 0) {
            Toast.error('Select at least one sheet first.');
            return;
        }

        showModal('Bulk change date', `
            <form id="cleanup-bulk-date-form">
                <div class="form-group">
                    <label>New date</label>
                    <input type="date" id="cleanup-bulk-date-input" class="form-control date-picker" required>
                </div>
                <p class="info-text">This will update ${state.selectedIds.size} selected comment sheets in one transaction.</p>
                <div class="modal-actions">
                    <button type="submit" class="btn btn-primary">Apply</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `);

        document.getElementById('cleanup-bulk-date-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const newDate = document.getElementById('cleanup-bulk-date-input')?.value;
            if (!newDate) {
                Toast.error('Choose a date first.');
                return;
            }

            try {
                await api('/teacher-comment-sheets/admin/bulk-update-date', {
                    method: 'POST',
                    body: JSON.stringify({
                        ids: Array.from(state.selectedIds),
                        new_date: newDate
                    })
                });
                closeModal();
                Toast.success(`Updated ${state.selectedIds.size} comment sheets.`);
                state.selectedIds.clear();
                await refreshCleanupData(1);
            } catch (_) {
                // Toast handled by api()
            }
        });
    }

    function buildMergeSelectionOptions(selected) {
        return selected.map(row => `
            <option value="${row.id}">
                #${row.id} · ${escapeHtml(row.class_name || `Class #${row.class_id}`)} · ${escapeHtml(row.normalized_date || row.date || 'Unparseable')}
            </option>
        `).join('');
    }

    function openMergeModal() {
        const rows = selectedRows();
        if (rows.length < 2) {
            Toast.error('Select at least two sheets to merge.');
            return;
        }

        showModal('Preview merge', `
            <form id="cleanup-merge-form">
                <div class="form-group">
                    <label>Keep this sheet</label>
                    <select id="cleanup-merge-keep-id" class="form-control">
                        ${buildMergeSelectionOptions(rows)}
                    </select>
                </div>
                <p class="info-text">Preview the exact impact before performing the merge.</p>
                <div id="cleanup-merge-preview" class="cleanup-import-preview"></div>
                <div class="modal-actions">
                    <button type="button" id="cleanup-run-merge-preview" class="btn btn-warning">Preview merge</button>
                    <button type="submit" class="btn btn-primary" disabled id="cleanup-confirm-merge-btn">Merge now</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `);

        const previewContainer = document.getElementById('cleanup-merge-preview');
        const keepSelect = document.getElementById('cleanup-merge-keep-id');
        const previewButton = document.getElementById('cleanup-run-merge-preview');
        const confirmButton = document.getElementById('cleanup-confirm-merge-btn');

        async function runPreview() {
            const keepId = Number(keepSelect.value);
            const loserIds = rows.map(row => row.id).filter(id => id !== keepId);

            try {
                const preview = await api('/teacher-comment-sheets/admin/merge', {
                    method: 'POST',
                    body: JSON.stringify({
                        keep_id: keepId,
                        loser_ids: loserIds,
                        dry_run: true
                    })
                });

                previewContainer.innerHTML = `
                    <div class="cleanup-preview-success">
                        <strong>Preview ready.</strong><br>
                        Keep #${preview.keep_id}; delete ${preview.loser_ids.length} sheets; repoint ${preview.would_repoint_monthly_report_weeks} monthly report week references.
                    </div>
                    <ul class="cleanup-impact-list">
                        ${preview.would_delete.map(row => `<li>#${row.id} · ${escapeHtml(row.date || '')} → ${escapeHtml(row.normalized_date || 'Unparseable')}</li>`).join('')}
                    </ul>
                `;
                confirmButton.disabled = false;
            } catch (_) {
                previewContainer.innerHTML = '';
                confirmButton.disabled = true;
            }
        }

        previewButton?.addEventListener('click', runPreview);

        document.getElementById('cleanup-merge-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();

            const keepId = Number(keepSelect.value);
            const loserIds = rows.map(row => row.id).filter(id => id !== keepId);
            if (!confirm(`Merge ${loserIds.length} sheets into #${keepId}? This will repoint monthly report week references and delete the loser sheets.`)) {
                return;
            }

            try {
                await api('/teacher-comment-sheets/admin/merge', {
                    method: 'POST',
                    body: JSON.stringify({
                        keep_id: keepId,
                        loser_ids: loserIds
                    })
                });
                closeModal();
                Toast.success(`Merged ${loserIds.length} sheets into #${keepId}.`);
                state.selectedIds.clear();
                await refreshCleanupData(1);
            } catch (_) {
                // Toast handled by api()
            }
        });
    }

    async function deleteRows(rows) {
        if (!rows.length) {
            Toast.error('Select at least one sheet to delete.');
            return;
        }

        const totalRefs = rows.reduce((sum, row) => sum + (row.monthly_report_week_refs || 0), 0);
        const baseMessage = `Delete ${rows.length} comment sheet${rows.length === 1 ? '' : 's'}?` +
            (totalRefs ? ` These rows currently show ${totalRefs} monthly report week reference(s).` : '');

        if (!confirm(baseMessage)) {
            return;
        }

        let forceDelete = false;
        if (totalRefs > 0) {
            forceDelete = confirm(`Force delete will clear ${totalRefs} monthly report week reference(s) before deleting. Continue?`);
            if (!forceDelete) {
                return;
            }
        }

        let deleted = 0;
        for (const row of rows) {
            try {
                await api(`/teacher-comment-sheets/admin/${row.id}${forceDelete ? '?force=true' : ''}`, {
                    method: 'DELETE'
                });
                deleted += 1;
                state.selectedIds.delete(row.id);
            } catch (_) {
                break;
            }
        }

        if (deleted > 0) {
            Toast.success(`Deleted ${deleted} comment sheet${deleted === 1 ? '' : 's'}.`);
            await refreshCleanupData(1);
        }
    }

    function parseImportText(rawText) {
        const trimmed = (rawText || '').trim();
        if (!trimmed) {
            return { rows: [], errors: ['Paste CSV or JSON content first.'] };
        }

        try {
            const parsed = JSON.parse(trimmed);
            const rows = Array.isArray(parsed) ? parsed : parsed.rows;
            if (!Array.isArray(rows)) {
                return { rows: [], errors: ['JSON must be an array or an object with a rows array.'] };
            }
            return validateImportRows(rows);
        } catch (_) {
            const lines = trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            if (!lines.length) {
                return { rows: [], errors: ['No rows found.'] };
            }

            const startIndex = lines[0].toLowerCase() === 'id,new_date' ? 1 : 0;
            const rows = [];
            const errors = [];

            for (let index = startIndex; index < lines.length; index += 1) {
                const parts = lines[index].split(',').map(part => part.trim());
                if (parts.length < 2) {
                    errors.push(`Line ${index + 1}: expected "id,new_date".`);
                    continue;
                }
                rows.push({ id: parts[0], new_date: parts.slice(1).join(',') });
            }

            const validated = validateImportRows(rows);
            return {
                rows: validated.rows,
                errors: [...errors, ...validated.errors]
            };
        }
    }

    function validateImportRows(rows) {
        const errors = [];
        const normalizedRows = rows.map((row, index) => {
            const id = Number.parseInt(row?.id, 10);
            const newDate = String(row?.new_date || '').trim();

            if (!Number.isInteger(id)) {
                errors.push(`Row ${index + 1}: invalid id.`);
            }

            if (!newDate) {
                errors.push(`Row ${index + 1}: missing new_date.`);
            }

            return {
                id,
                new_date: newDate
            };
        });

        const seen = new Set();
        normalizedRows.forEach((row, index) => {
            if (!Number.isInteger(row.id)) return;
            if (seen.has(row.id)) {
                errors.push(`Row ${index + 1}: duplicate id ${row.id}.`);
            }
            seen.add(row.id);
        });

        return { rows: normalizedRows, errors };
    }

    function renderImportPreview() {
        const container = document.getElementById('cleanup-import-preview');
        if (!container) return;

        if (!state.importErrors.length && !state.importRows.length) {
            container.innerHTML = '';
            return;
        }

        const errorHtml = state.importErrors.length
            ? `<div class="cleanup-preview-errors">${state.importErrors.map(error => `<div>${escapeHtml(error)}</div>`).join('')}</div>`
            : '';
        const summaryHtml = state.importRows.length
            ? `<div class="cleanup-preview-success">Validated ${state.importRows.length} row(s).</div>`
            : '';

        container.innerHTML = `${errorHtml}${summaryHtml}`;
    }

    async function submitImport() {
        if (state.importErrors.length > 0 || state.importRows.length === 0) {
            Toast.error('Resolve validation errors before importing.');
            return;
        }

        if (!confirm(`Apply ${state.importRows.length} imported date fixes in a single transaction?`)) {
            return;
        }

        try {
            await api('/teacher-comment-sheets/admin/import-date-csv', {
                method: 'POST',
                body: JSON.stringify({ rows: state.importRows })
            });
            Toast.success(`Imported ${state.importRows.length} date fixes.`);
            document.getElementById('cleanup-import-input').value = '';
            state.importRows = [];
            state.importErrors = [];
            renderImportPreview();
            await refreshCleanupData(1);
        } catch (_) {
            // Toast handled by api()
        }
    }

    async function exportCleanupCsv() {
        try {
            const response = await fetch(`/api/teacher-comment-sheets/admin/export.csv?${buildQuery(state.page)}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: `Export failed (${response.status})` }));
                Toast.error(error.error || 'Failed to export CSV');
                return;
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `teacher_comment_sheets_cleanup_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            Toast.error(error.message || 'Failed to export CSV');
        }
    }

    function bindCleanupEvents() {
        document.getElementById('cleanup-apply-btn')?.addEventListener('click', async () => {
            state.page = 1;
            await refreshCleanupData(1);
        });

        document.getElementById('cleanup-reset-btn')?.addEventListener('click', async () => {
            document.getElementById('cleanup-teacher-filter').value = '';
            document.getElementById('cleanup-class-filter').value = '';
            document.getElementById('cleanup-start-date').value = '';
            document.getElementById('cleanup-end-date').value = '';
            document.getElementById('cleanup-duplicates-only').checked = false;
            document.getElementById('cleanup-sort').value = 'date_desc';
            state.page = 1;
            state.selectedIds.clear();
            await refreshCleanupData(1);
        });

        document.getElementById('cleanup-prev-page')?.addEventListener('click', async () => {
            if (state.page > 1) {
                state.page -= 1;
                await refreshCleanupData(state.page);
            }
        });

        document.getElementById('cleanup-next-page')?.addEventListener('click', async () => {
            if (state.page * state.pageSize < state.total) {
                state.page += 1;
                await refreshCleanupData(state.page);
            }
        });

        document.getElementById('cleanup-bulk-date-btn')?.addEventListener('click', openBulkDateModal);
        document.getElementById('cleanup-preview-merge-btn')?.addEventListener('click', openMergeModal);
        document.getElementById('cleanup-delete-btn')?.addEventListener('click', async () => {
            await deleteRows(selectedRows());
        });
        document.getElementById('cleanup-export-btn')?.addEventListener('click', exportCleanupCsv);

        document.getElementById('cleanup-parse-import-btn')?.addEventListener('click', () => {
            const parsed = parseImportText(document.getElementById('cleanup-import-input')?.value || '');
            state.importRows = parsed.rows;
            state.importErrors = parsed.errors;
            renderImportPreview();
        });

        document.getElementById('cleanup-submit-import-btn')?.addEventListener('click', submitImport);
    }

    bindCleanupEvents();
    updateRoleBasedNavigation();

    window.updateRoleBasedNavigation = updateRoleBasedNavigation;
    window.loadCommentSheetCleanupPage = loadCommentSheetCleanupPage;
}());
