// Monthly Reports Functionality

// Helper: format a local Date as YYYY-MM-DD without UTC conversion
function toLocalDateString(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Show new monthly report modal
async function showNewMonthlyReportModal() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultStart = toLocalDateString(monthStart);
    const defaultEnd = toLocalDateString(now);

    // Get currently selected class from filter to pre-select it
    const selectedClassId = document.getElementById('monthly-report-class-filter')?.value || '';

    let classOpts = '<option value="">Select Class</option>';
    classes.forEach(c => {
        const isSelected = c.id == selectedClassId ? 'selected' : '';
        classOpts += `<option value="${c.id}" ${isSelected}>${escapeHtml(c.name)}</option>`;
    });

    const formHtml = `
        <form id="monthly-report-form">
            <div class="form-group">
                <label>Class *</label>
                <select id="mr-class" class="form-control" required>${classOpts}</select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Start Date *</label>
                    <input type="date" id="mr-start-date" class="form-control" value="${defaultStart}" required>
                </div>
                <div class="form-group">
                    <label>End Date *</label>
                    <input type="date" id="mr-end-date" class="form-control" value="${defaultEnd}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Monthly Theme (今月のテーマ)</label>
                <textarea id="mr-theme" class="form-control" rows="3" placeholder="Optional: describe the theme or focus for this period..."></textarea>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="mr-status" class="form-control">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                </select>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Create Report</button>
                <button type="button" class="btn btn-secondary" id="mr-cancel-btn">Cancel</button>
            </div>
        </form>
    `;

    showModal('Create Monthly Report', formHtml);

    document.getElementById('monthly-report-form').addEventListener('submit', handleCreateMonthlyReport);
    document.getElementById('mr-cancel-btn').addEventListener('click', closeModal);
}

// (period type selector removed - using direct date pickers now)

// Add week row to the form
function addWeekRow() {
    const container = document.getElementById('mr-weeks-container');
    const weekRows = container.querySelectorAll('.mr-week-row');
    const nextWeekNumber = weekRows.length + 1;
    
    if (nextWeekNumber > 6) {
        Toast.warning('Maximum 6 weeks allowed');
        return;
    }
    
    const weekRow = document.createElement('div');
    weekRow.className = 'mr-week-row';
    weekRow.dataset.week = nextWeekNumber;
    weekRow.innerHTML = `
        <h5>Week ${nextWeekNumber} <button type="button" class="btn btn-sm btn-danger" onclick="removeWeekRow(${nextWeekNumber})">Remove</button></h5>
        <div class="form-group">
            <label>Date</label>
            <input type="date" class="form-control mr-week-date" data-week="${nextWeekNumber}">
        </div>
        <div class="form-group">
            <label>Target (目標)</label>
            <textarea class="form-control mr-week-target" rows="2" data-week="${nextWeekNumber}"></textarea>
        </div>
        <div class="form-group">
            <label>Vocabulary (単語)</label>
            <textarea class="form-control mr-week-vocabulary" rows="2" data-week="${nextWeekNumber}"></textarea>
        </div>
        <div class="form-group">
            <label>Phrase (文)</label>
            <textarea class="form-control mr-week-phrase" rows="2" data-week="${nextWeekNumber}"></textarea>
        </div>
        <div class="form-group">
            <label>Others (その他)</label>
            <textarea class="form-control mr-week-others" rows="2" data-week="${nextWeekNumber}"></textarea>
        </div>
    `;
    
    container.appendChild(weekRow);
}

// Remove week row
function removeWeekRow(weekNumber) {
    const weekRow = document.querySelector(`.mr-week-row[data-week="${weekNumber}"]`);
    if (weekRow) {
        weekRow.remove();
        // Renumber remaining weeks
        const container = document.getElementById('mr-weeks-container');
        const weekRows = container.querySelectorAll('.mr-week-row');
        weekRows.forEach((row, index) => {
            const newWeekNumber = index + 1;
            row.dataset.week = newWeekNumber;
            row.querySelector('h5').innerHTML = `Week ${newWeekNumber} ${newWeekNumber > 1 ? `<button type="button" class="btn btn-sm btn-danger" onclick="removeWeekRow(${newWeekNumber})">Remove</button>` : ''}`;
            row.querySelectorAll('[data-week]').forEach(el => {
                el.dataset.week = newWeekNumber;
            });
        });
    }
}

// Auto-generate preview from teacher comment sheets using date range
async function autoGenerateFromLessonReports() {
    const classId = document.getElementById('mr-class').value;
    const startDate = document.getElementById('mr-start-date').value;
    const endDate = document.getElementById('mr-end-date').value;

    if (!classId) {
        Toast.error('Please select a class first');
        return;
    }
    if (!startDate || !endDate) {
        Toast.error('Please select start and end dates');
        return;
    }

    try {
        const response = await api('/monthly-reports/preview-generate', {
            method: 'POST',
            body: JSON.stringify({
                class_id: classId,
                start_date: startDate,
                end_date: endDate
            })
        });

        if (response.weeks.length === 0) {
            Toast.warning('No teacher comment sheets found for this date range');
            return;
        }

        populateWeekFields(response.weeks);
        Toast.success(`Found ${response.lessonCount} lesson(s) - data populated!`);

    } catch (error) {
        console.error('Error generating preview:', error);
        Toast.error(error.message || 'Failed to generate preview');
    }
}

// Populate week fields with data
function populateWeekFields(weeks) {
    const container = document.getElementById('mr-weeks-container');
    container.innerHTML = ''; // Clear existing
    
    weeks.forEach((week, index) => {
        // Create week row with populated data
        const weekRow = document.createElement('div');
        weekRow.className = 'mr-week-row';
        weekRow.dataset.week = week.week_number;
        
        // Create header
        const header = document.createElement('h5');
        header.textContent = `Week ${week.week_number} `;
        
        if (week.week_number > 1) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-sm btn-danger';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => removeWeekRow(week.week_number));
            header.appendChild(removeBtn);
        }
        
        weekRow.appendChild(header);
        
        // Create date field
        const dateGroup = document.createElement('div');
        dateGroup.className = 'form-group';
        const dateLabel = document.createElement('label');
        dateLabel.textContent = 'Date';
        dateGroup.appendChild(dateLabel);
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'form-control mr-week-date';
        dateInput.dataset.week = week.week_number;
        dateInput.value = week.lesson_date ? week.lesson_date.split('T')[0] : '';
        dateGroup.appendChild(dateInput);
        weekRow.appendChild(dateGroup);
        
        // Create target field
        const targetGroup = document.createElement('div');
        targetGroup.className = 'form-group';
        const targetLabel = document.createElement('label');
        targetLabel.textContent = 'Target (目標)';
        targetGroup.appendChild(targetLabel);
        const targetTextarea = document.createElement('textarea');
        targetTextarea.className = 'form-control mr-week-target';
        targetTextarea.rows = 2;
        targetTextarea.dataset.week = week.week_number;
        targetTextarea.value = week.target || '';
        targetGroup.appendChild(targetTextarea);
        weekRow.appendChild(targetGroup);
        
        // Create vocabulary field
        const vocabGroup = document.createElement('div');
        vocabGroup.className = 'form-group';
        const vocabLabel = document.createElement('label');
        vocabLabel.textContent = 'Vocabulary (単語)';
        vocabGroup.appendChild(vocabLabel);
        const vocabTextarea = document.createElement('textarea');
        vocabTextarea.className = 'form-control mr-week-vocabulary';
        vocabTextarea.rows = 2;
        vocabTextarea.dataset.week = week.week_number;
        vocabTextarea.value = week.vocabulary || '';
        vocabGroup.appendChild(vocabTextarea);
        weekRow.appendChild(vocabGroup);
        
        // Create phrase field
        const phraseGroup = document.createElement('div');
        phraseGroup.className = 'form-group';
        const phraseLabel = document.createElement('label');
        phraseLabel.textContent = 'Phrase (文)';
        phraseGroup.appendChild(phraseLabel);
        const phraseTextarea = document.createElement('textarea');
        phraseTextarea.className = 'form-control mr-week-phrase';
        phraseTextarea.rows = 2;
        phraseTextarea.dataset.week = week.week_number;
        phraseTextarea.value = week.phrase || '';
        phraseGroup.appendChild(phraseTextarea);
        weekRow.appendChild(phraseGroup);
        
        // Create others field
        const othersGroup = document.createElement('div');
        othersGroup.className = 'form-group';
        const othersLabel = document.createElement('label');
        othersLabel.textContent = 'Others (その他)';
        othersGroup.appendChild(othersLabel);
        const othersTextarea = document.createElement('textarea');
        othersTextarea.className = 'form-control mr-week-others';
        othersTextarea.rows = 2;
        othersTextarea.dataset.week = week.week_number;
        othersTextarea.value = week.others || '';
        othersGroup.appendChild(othersTextarea);
        weekRow.appendChild(othersGroup);
        
        container.appendChild(weekRow);
    });
}

// Handle create monthly report - uses auto-generate to pull teacher comment sheets
async function handleCreateMonthlyReport(e) {
    e.preventDefault();

    const classId = document.getElementById('mr-class').value;
    const startDate = document.getElementById('mr-start-date').value;
    const endDate = document.getElementById('mr-end-date').value;
    const theme = document.getElementById('mr-theme').value;
    const status = document.getElementById('mr-status').value;

    if (!classId || !startDate || !endDate) {
        Toast.error('Please fill in class, start date, and end date');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        Toast.error('Start date must be before end date');
        return;
    }

    try {
        const response = await api('/monthly-reports/auto-generate', {
            method: 'POST',
            body: JSON.stringify({
                class_id: classId,
                start_date: startDate,
                end_date: endDate,
                monthly_theme: theme,
                status: status
            })
        });

        Toast.success('Monthly report created successfully!');
        closeModal();
        loadMonthlyReports();
    } catch (error) {
        console.error('Error creating monthly report:', error);
        Toast.error(error.message || 'Failed to create monthly report');
    }
}

// View monthly report
async function viewMonthlyReport(reportId) {
    try {
        const report = await api(`/monthly-reports/${reportId}`);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        let weeksHtml = '';
        if (report.weeks && report.weeks.length > 0) {
            report.weeks.forEach((week, index) => {
                // Use ASCII-safe date formatter for lesson dates
                let dateLabel = 'Lesson';
                if (week.lesson_date) {
                    dateLabel = formatDateReadableEN(week.lesson_date) || `Lesson ${index + 1}`;
                } else {
                    dateLabel = `Lesson ${index + 1}`;
                }
                
                weeksHtml += `
                    <div class="week-view">
                        <h4>${escapeHtml(dateLabel)}</h4>
                        <p><strong>Target (目標):</strong> ${escapeHtml(week.target || 'N/A')}</p>
                        <p><strong>Vocabulary (単語):</strong> ${escapeHtml(week.vocabulary || 'N/A')}</p>
                        <p><strong>Phrase (文):</strong> ${escapeHtml(week.phrase || 'N/A')}</p>
                        <p><strong>Others (その他):</strong> ${escapeHtml(week.others || 'N/A')}</p>
                    </div>
                `;
            });
        } else {
            weeksHtml = '<p>No weekly data available.</p>';
        }
        
        // Format date range using smart formatter
        const startDateFormatted = report.start_date ? formatDateReadableEN(report.start_date) : 'N/A';
        const endDateFormatted = report.end_date ? formatDateReadableEN(report.end_date) : 'N/A';
        
        const content = `
            <div class="monthly-report-view">
                <h3>${escapeHtml(report.class_name)} - ${monthNames[report.month - 1]} ${report.year}</h3>
                <p><strong>Date Range:</strong> ${startDateFormatted} — ${endDateFormatted}</p>
                <p><strong>Status:</strong> ${report.status === 'published' ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-warning">Draft</span>'}</p>
                <hr>
                <h4>Weekly Lessons</h4>
                ${weeksHtml}
                <hr>
                <h4>Monthly Theme (今月のテーマ)</h4>
                <p>${escapeHtml(report.monthly_theme || 'No theme provided.')}</p>
            </div>
        `;
        
        showModal('Monthly Report', content);
    } catch (error) {
        console.error('Error viewing monthly report:', error);
        Toast.error('Failed to load monthly report');
    }
}

// Edit monthly report
async function editMonthlyReport(reportId) {
    try {
        const report = await api(`/monthly-reports/${reportId}`);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        let weeksHtml = '';
        if (report.weeks && report.weeks.length > 0) {
            report.weeks.forEach(week => {
                weeksHtml += `
                    <div class="mr-week-row" data-week="${week.week_number}">
                        <h5>Week ${week.week_number}</h5>
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" class="form-control mr-week-date" data-week="${week.week_number}" value="${week.lesson_date ? week.lesson_date.split('T')[0] : ''}">
                        </div>
                        <div class="form-group">
                            <label>Target (目標)</label>
                            <textarea class="form-control mr-week-target" rows="2" data-week="${week.week_number}">${week.target || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Vocabulary (単語)</label>
                            <textarea class="form-control mr-week-vocabulary" rows="2" data-week="${week.week_number}">${week.vocabulary || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Phrase (文)</label>
                            <textarea class="form-control mr-week-phrase" rows="2" data-week="${week.week_number}">${week.phrase || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Others (その他)</label>
                            <textarea class="form-control mr-week-others" rows="2" data-week="${week.week_number}">${week.others || ''}</textarea>
                        </div>
                    </div>
                `;
            });
        }
        
        const content = `
            <form id="monthly-report-edit-form">
                <input type="hidden" id="mr-edit-id" value="${report.id}">
                <div class="form-group">
                    <label>Class</label>
                    <input type="text" class="form-control" value="${report.class_name}" disabled>
                </div>
                <div class="form-group">
                    <label>Month/Year</label>
                    <input type="text" class="form-control" value="${monthNames[report.month - 1]} ${report.year}" disabled>
                </div>
                <hr>
                <h4>Weekly Lessons</h4>
                <div id="mr-weeks-container">
                    ${weeksHtml}
                </div>
                <button type="button" class="btn btn-secondary" id="mr-add-week-btn">+ Add Week</button>
                <hr>
                <div class="form-group">
                    <label>Monthly Theme (今月のテーマ)</label>
                    <textarea id="mr-theme" class="form-control" rows="4">${report.monthly_theme || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="mr-status" class="form-control">
                        <option value="draft" ${report.status === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="published" ${report.status === 'published' ? 'selected' : ''}>Published</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Update Report</button>
                    <button type="button" class="btn btn-secondary" id="mr-edit-cancel-btn">Cancel</button>
                </div>
            </form>
        `;
        
        showModal('Edit Monthly Report', content);
        
        document.getElementById('monthly-report-edit-form').addEventListener('submit', handleUpdateMonthlyReport);
        document.getElementById('mr-add-week-btn').addEventListener('click', addWeekRow);
        document.getElementById('mr-edit-cancel-btn').addEventListener('click', closeModal);
    } catch (error) {
        console.error('Error loading monthly report for edit:', error);
        Toast.error('Failed to load monthly report');
    }
}

// Handle update monthly report
async function handleUpdateMonthlyReport(e) {
    e.preventDefault();
    
    const reportId = document.getElementById('mr-edit-id').value;
    const theme = document.getElementById('mr-theme').value;
    const status = document.getElementById('mr-status').value;
    
    // Collect week data
    const weeks = [];
    const weekRows = document.querySelectorAll('.mr-week-row');
    weekRows.forEach((row) => {
        const weekNumber = parseInt(row.dataset.week);
        const date = row.querySelector('.mr-week-date').value;
        const target = row.querySelector('.mr-week-target').value;
        const vocabulary = row.querySelector('.mr-week-vocabulary').value;
        const phrase = row.querySelector('.mr-week-phrase').value;
        const others = row.querySelector('.mr-week-others').value;
        
        weeks.push({
            week_number: weekNumber,
            lesson_date: date || null,
            target: target,
            vocabulary: vocabulary,
            phrase: phrase,
            others: others
        });
    });
    
    try {
        await api(`/monthly-reports/${reportId}`, {
            method: 'PUT',
            body: JSON.stringify({
                monthly_theme: theme,
                status: status,
                weeks: weeks
            })
        });
        
        Toast.success('Monthly report updated successfully!');
        closeModal();
        loadMonthlyReports();
    } catch (error) {
        console.error('Error updating monthly report:', error);
        Toast.error(error.message || 'Failed to update monthly report');
    }
}

// Generate PDF for monthly report
async function generateMonthlyReportPDF(reportId) {
    try {
        Toast.info('Generating PDF...');
        
        const response = await api(`/monthly-reports/${reportId}/generate-pdf`, {
            method: 'POST'
        });
        
        Toast.success('PDF generated successfully!');
        
        // Open PDF in new tab
        if (response.pdfUrl) {
            window.open(response.pdfUrl, '_blank');
        }
        
        loadMonthlyReports();
    } catch (error) {
        console.error('Error generating PDF:', error);
        Toast.error(error.message || 'Failed to generate PDF');
    }
}

// View PDF for monthly report (always regenerate to avoid stale cached versions)
async function viewMonthlyReportPDF(reportId) {
    return generateMonthlyReportPDF(reportId);
}

// Backward-compatible alias for existing inline handlers
async function downloadMonthlyReportPDF(reportId) {
    return viewMonthlyReportPDF(reportId);
}

// Delete monthly report
async function deleteMonthlyReport(reportId) {
    if (!confirm('Are you sure you want to delete this monthly report? This action cannot be undone.')) {
        return;
    }
    
    try {
        await api(`/monthly-reports/${reportId}`, {
            method: 'DELETE'
        });
        
        Toast.success('Monthly report deleted successfully!');
        loadMonthlyReports();
    } catch (error) {
        console.error('Error deleting monthly report:', error);
        Toast.error('Failed to delete monthly report');
    }
}
