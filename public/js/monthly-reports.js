// Monthly Reports Functionality

// Show new monthly report modal
async function showNewMonthlyReportModal() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = today.toISOString().split('T')[0];
    
    let opts = '<option value="">Select Class *</option>';
    classes.forEach(c => {
        opts += `<option value="${c.id}">${c.name}</option>`;
    });
    
    const html = `
        <form id="monthly-report-form">
            <div class="form-group">
                <label>Class *</label>
                <select id="mr-class" class="form-control" required>${opts}</select>
            </div>
            <div class="form-group">
                <label>Start Date *</label>
                <input type="date" id="mr-start-date" class="form-control" required value="${firstDay}">
            </div>
            <div class="form-group">
                <label>End Date *</label>
                <input type="date" id="mr-end-date" class="form-control" required value="${lastDay}">
            </div>
            <div class="form-group">
                <label>Monthly Theme (今月のテーマ)</label>
                <textarea id="mr-theme" class="form-control" rows="3" placeholder="Optional: Add a theme or summary..."></textarea>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="mr-status" class="form-control">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                </select>
            </div>
            <p class="info-text"><i class="fas fa-info-circle"></i> This will automatically include all teacher comment sheets between the selected dates.</p>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Create Report</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    showModal('Create Monthly Report', html);
    
    document.getElementById('monthly-report-form').addEventListener('submit', handleCreateMonthlyReport);
}

// Load lessons for the report based on class and date range

// Handle create monthly report
async function handleCreateMonthlyReport(e) {
    e.preventDefault();
    
    const cid = document.getElementById('mr-class').value;
    const sd = document.getElementById('mr-start-date').value;
    const ed = document.getElementById('mr-end-date').value;
    const thm = document.getElementById('mr-theme').value;
    const sts = document.getElementById('mr-status').value;
    
    if (!sd || !ed) {
        Toast.error('Please select start and end dates');
        return;
    }
    
    const dt = new Date(sd);
    if (isNaN(dt.getTime())) {
        Toast.error('Invalid start date');
        return;
    }
    
    try {
        // Use auto-generate endpoint to create report with all teacher comment sheets
        const result = await api('/monthly-reports/auto-generate', {
            method: 'POST',
            body: JSON.stringify({
                class_id: cid,
                start_date: sd,
                end_date: ed,
                monthly_theme: thm,
                status: sts
            })
        });
        
        Toast.success('Monthly report created successfully!');
        closeModal();
        loadMonthlyReports();
    } catch (err) {
        console.error('Error creating monthly report:', err);
        Toast.error(err.message || 'Failed to create monthly report');
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
