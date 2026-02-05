// Monthly Reports Functionality

// Show new monthly report modal
async function showNewMonthlyReportModal() {
    // Calculate default dates: first day of current month and today
    const today = new Date();
    const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const defaultEndDate = today.toISOString().split('T')[0];
    
    let classOptions = '<option value="">Select Class</option>';
    classes.forEach(c => {
        classOptions += `<option value="${c.id}">${c.name}</option>`;
    });
    
    const content = `
        <form id="monthly-report-form">
            <div class="form-group">
                <label>Class *</label>
                <select id="mr-class" class="form-control" required>${classOptions}</select>
            </div>
            <div class="form-group">
                <label>Start Date *</label>
                <input type="date" id="mr-start-date" class="form-control" required value="${defaultStartDate}">
            </div>
            <div class="form-group">
                <label>End Date *</label>
                <input type="date" id="mr-end-date" class="form-control" required value="${defaultEndDate}">
            </div>
            <div class="form-group">
                <button type="button" class="btn btn-primary btn-lg btn-block" id="mr-load-lessons-btn">
                    <i class="fas fa-sync"></i> Load Lessons from Date Range
                </button>
                <small class="form-text text-muted">Select a class and date range, then click here to load lesson data. You can review and edit before saving.</small>
            </div>
            <hr>
            <div id="mr-lessons-section" style="display:none;">
                <h4>Lessons</h4>
                <div id="mr-lessons-container"></div>
                <hr>
                <div class="form-group">
                    <label>Monthly Theme (今月のテーマ)</label>
                    <textarea id="mr-theme" class="form-control" rows="4" placeholder="Describe the monthly theme and overall progress..."></textarea>
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
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </div>
        </form>
    `;
    
    showModal('Create Monthly Report', content);
    
    // Add event listeners
    document.getElementById('monthly-report-form').addEventListener('submit', handleCreateMonthlyReport);
    document.getElementById('mr-load-lessons-btn').addEventListener('click', loadLessonsForReport);
}

// Load lessons for the report based on class and date range
async function loadLessonsForReport() {
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
            Toast.warning('No lesson reports found for this period. You can still create the report and add lessons manually later.');
            document.getElementById('mr-lessons-section').style.display = 'block';
            document.getElementById('mr-lessons-container').innerHTML = '<p class="info-text">No lessons found. The report will be created with empty lesson data.</p>';
            return;
        }
        
        // Populate the lessons
        populateLessonFields(response.weeks);
        document.getElementById('mr-lessons-section').style.display = 'block';
        Toast.success(`Found ${response.lessonCount} lesson${response.lessonCount > 1 ? 's' : ''} - data loaded successfully!`);
        
    } catch (error) {
        console.error('Error loading lessons:', error);
        Toast.error(error.message || 'Failed to load lessons');
    }
}

// Populate lesson fields with data
function populateLessonFields(weeks) {
    const container = document.getElementById('mr-lessons-container');
    container.innerHTML = ''; // Clear existing
    
    weeks.forEach((week, index) => {
        // Create lesson row with populated data
        const lessonRow = document.createElement('div');
        lessonRow.className = 'mr-lesson-row';
        lessonRow.dataset.lesson = week.week_number;
        
        // Create header
        const header = document.createElement('h5');
        header.textContent = `Lesson ${week.week_number}`;
        lessonRow.appendChild(header);
        
        // Create date field
        const dateGroup = document.createElement('div');
        dateGroup.className = 'form-group';
        const dateLabel = document.createElement('label');
        dateLabel.textContent = 'Date';
        dateGroup.appendChild(dateLabel);
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'form-control mr-lesson-date';
        dateInput.dataset.lesson = week.week_number;
        dateInput.value = week.lesson_date ? week.lesson_date.split('T')[0] : '';
        dateGroup.appendChild(dateInput);
        lessonRow.appendChild(dateGroup);
        
        // Create target field
        const targetGroup = document.createElement('div');
        targetGroup.className = 'form-group';
        const targetLabel = document.createElement('label');
        targetLabel.textContent = 'Target (目標)';
        targetGroup.appendChild(targetLabel);
        const targetTextarea = document.createElement('textarea');
        targetTextarea.className = 'form-control mr-lesson-target';
        targetTextarea.rows = 2;
        targetTextarea.dataset.lesson = week.week_number;
        targetTextarea.value = week.target || '';
        targetGroup.appendChild(targetTextarea);
        lessonRow.appendChild(targetGroup);
        
        // Create vocabulary field
        const vocabGroup = document.createElement('div');
        vocabGroup.className = 'form-group';
        const vocabLabel = document.createElement('label');
        vocabLabel.textContent = 'Vocabulary (単語)';
        vocabGroup.appendChild(vocabLabel);
        const vocabTextarea = document.createElement('textarea');
        vocabTextarea.className = 'form-control mr-lesson-vocabulary';
        vocabTextarea.rows = 2;
        vocabTextarea.dataset.lesson = week.week_number;
        vocabTextarea.value = week.vocabulary || '';
        vocabGroup.appendChild(vocabTextarea);
        lessonRow.appendChild(vocabGroup);
        
        // Create phrase field
        const phraseGroup = document.createElement('div');
        phraseGroup.className = 'form-group';
        const phraseLabel = document.createElement('label');
        phraseLabel.textContent = 'Phrase (文)';
        phraseGroup.appendChild(phraseLabel);
        const phraseTextarea = document.createElement('textarea');
        phraseTextarea.className = 'form-control mr-lesson-phrase';
        phraseTextarea.rows = 2;
        phraseTextarea.dataset.lesson = week.week_number;
        phraseTextarea.value = week.phrase || '';
        phraseGroup.appendChild(phraseTextarea);
        lessonRow.appendChild(phraseGroup);
        
        // Create others field
        const othersGroup = document.createElement('div');
        othersGroup.className = 'form-group';
        const othersLabel = document.createElement('label');
        othersLabel.textContent = 'Others (その他)';
        othersGroup.appendChild(othersLabel);
        const othersTextarea = document.createElement('textarea');
        othersTextarea.className = 'form-control mr-lesson-others';
        othersTextarea.rows = 2;
        othersTextarea.dataset.lesson = week.week_number;
        othersTextarea.value = week.others || '';
        othersGroup.appendChild(othersTextarea);
        lessonRow.appendChild(othersGroup);
        
        container.appendChild(lessonRow);
    });
}

// Handle create monthly report
async function handleCreateMonthlyReport(e) {
    e.preventDefault();
    
    const classId = document.getElementById('mr-class').value;
    const startDate = document.getElementById('mr-start-date').value;
    const endDate = document.getElementById('mr-end-date').value;
    const theme = document.getElementById('mr-theme').value;
    const status = document.getElementById('mr-status').value;
    
    if (!startDate || !endDate) {
        Toast.error('Please select start and end dates');
        return;
    }
    
    // Calculate year and month from start date for backend compatibility
    const startDateObj = new Date(startDate);
    
    // Validate the date is valid
    if (isNaN(startDateObj.getTime())) {
        Toast.error('Invalid start date');
        return;
    }
    
    const year = startDateObj.getFullYear();
    const month = startDateObj.getMonth() + 1;
    
    // Collect lesson data
    const weeks = [];
    const lessonRows = document.querySelectorAll('.mr-lesson-row');
    lessonRows.forEach((row, index) => {
        const lessonNumber = parseInt(row.dataset.lesson);
        const date = row.querySelector('.mr-lesson-date').value;
        const target = row.querySelector('.mr-lesson-target').value;
        const vocabulary = row.querySelector('.mr-lesson-vocabulary').value;
        const phrase = row.querySelector('.mr-lesson-phrase').value;
        const others = row.querySelector('.mr-lesson-others').value;
        
        weeks.push({
            week_number: lessonNumber,
            lesson_date: date || null,
            target: target,
            vocabulary: vocabulary,
            phrase: phrase,
            others: others
        });
    });
    
    try {
        const response = await api('/monthly-reports', {
            method: 'POST',
            body: JSON.stringify({
                class_id: classId,
                year: year,
                month: month,
                start_date: startDate,
                end_date: endDate,
                monthly_theme: theme,
                status: status,
                weeks: weeks
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
            report.weeks.forEach(week => {
                const date = week.lesson_date ? new Date(week.lesson_date).toLocaleDateString() : 'N/A';
                weeksHtml += `
                    <div class="week-view">
                        <h4>Week ${week.week_number}</h4>
                        <p><strong>Date:</strong> ${date}</p>
                        <p><strong>Target (目標):</strong> ${week.target || 'N/A'}</p>
                        <p><strong>Vocabulary (単語):</strong> ${week.vocabulary || 'N/A'}</p>
                        <p><strong>Phrase (文):</strong> ${week.phrase || 'N/A'}</p>
                        <p><strong>Others (その他):</strong> ${week.others || 'N/A'}</p>
                    </div>
                `;
            });
        } else {
            weeksHtml = '<p>No weekly data available.</p>';
        }
        
        const content = `
            <div class="monthly-report-view">
                <h3>${report.class_name} - ${monthNames[report.month - 1]} ${report.year}</h3>
                <p><strong>Status:</strong> ${report.status === 'published' ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-warning">Draft</span>'}</p>
                <hr>
                <h4>Weekly Lessons</h4>
                ${weeksHtml}
                <hr>
                <h4>Monthly Theme (今月のテーマ)</h4>
                <p>${report.monthly_theme || 'No theme provided.'}</p>
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
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `;
        
        showModal('Edit Monthly Report', content);
        
        document.getElementById('monthly-report-edit-form').addEventListener('submit', handleUpdateMonthlyReport);
        document.getElementById('mr-add-week-btn').addEventListener('click', addWeekRow);
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

// Download PDF for monthly report
async function downloadMonthlyReportPDF(reportId) {
    try {
        const response = await api(`/monthly-reports/${reportId}/pdf`);
        
        if (response.pdfUrl) {
            window.open(response.pdfUrl, '_blank');
        } else {
            Toast.error('PDF not available. Please generate it first.');
        }
    } catch (error) {
        console.error('Error downloading PDF:', error);
        Toast.error('Failed to download PDF');
    }
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
