// Global state
let currentUser = null;
let classes = [];
let students = [];
let teachers = [];

// API Helper
async function api(endpoint, options = {}) {
    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
}

// Authentication
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const user = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        currentUser = user;
        document.getElementById('user-name').textContent = user.fullName;
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        
        await loadInitialData();
        loadDashboard();
    } catch (error) {
        errorDiv.textContent = error.message;
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await api('/auth/logout', { method: 'POST' });
        currentUser = null;
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('login-form').reset();
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Load initial data
async function loadInitialData() {
    try {
        [classes, students, teachers] = await Promise.all([
            api('/classes'),
            api('/students'),
            api('/auth/me').then(() => api('/classes')).then(c => {
                // Get teachers from users endpoint
                return fetch('/api/auth/me').then(r => r.json()).then(() => {
                    // For now, we'll extract teachers from classes
                    return c.filter(cls => cls.teacher_id).map(cls => ({
                        id: cls.teacher_id,
                        full_name: cls.teacher_name
                    }));
                });
            })
        ]);

        // Get unique teachers
        const teacherMap = new Map();
        classes.forEach(cls => {
            if (cls.teacher_id && cls.teacher_name) {
                teacherMap.set(cls.teacher_id, { id: cls.teacher_id, full_name: cls.teacher_name });
            }
        });
        teachers = Array.from(teacherMap.values());

        populateClassSelects();
        populateTeacherSelects();
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

function populateClassSelects() {
    const selects = [
        document.getElementById('attendance-class-select'),
        document.getElementById('reports-class-select'),
        document.getElementById('report-class')
    ];

    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Select a class...</option>';
        classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.id;
            option.textContent = cls.name;
            select.appendChild(option);
        });
    });
}

function populateTeacherSelects() {
    const selects = [document.getElementById('report-teacher')];
    
    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Select a teacher...</option>';
        teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher.id;
            option.textContent = teacher.full_name;
            select.appendChild(option);
        });
    });
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const page = e.target.dataset.page;
        navigateToPage(page);
    });
});

function navigateToPage(page) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');

    // Load page-specific data
    if (page === 'dashboard') loadDashboard();
    else if (page === 'admin') loadAdminData();
}

// Dashboard
async function loadDashboard() {
    const todayClassesDiv = document.getElementById('today-classes');
    const recentActivityDiv = document.getElementById('recent-activity');

    // Today's classes
    todayClassesDiv.innerHTML = classes.map(cls => `
        <div style="padding: 0.5rem 0; border-bottom: 1px solid #e1e8ed;">
            <strong style="color: ${cls.color}">${cls.name}</strong>
            <br>
            <small>${cls.teacher_name || 'No teacher assigned'}</small>
            <br>
            <small>${cls.schedule || 'No schedule'}</small>
        </div>
    `).join('') || '<p>No classes available</p>';

    // Recent activity
    try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const reports = await api(`/reports?startDate=${weekAgo}&endDate=${today}`);
        
        recentActivityDiv.innerHTML = reports.slice(0, 5).map(report => `
            <div style="padding: 0.5rem 0; border-bottom: 1px solid #e1e8ed;">
                <strong>${report.date}</strong> - ${report.class_name}
                <br>
                <small>${report.teacher_name}</small>
            </div>
        `).join('') || '<p>No recent activity</p>';
    } catch (error) {
        recentActivityDiv.innerHTML = '<p>Unable to load recent activity</p>';
    }
}

// Attendance Management
document.getElementById('load-attendance-btn').addEventListener('click', loadAttendance);
document.getElementById('export-attendance-btn').addEventListener('click', exportAttendance);

async function loadAttendance() {
    const classId = document.getElementById('attendance-class-select').value;
    const startDate = document.getElementById('attendance-start-date').value;
    const endDate = document.getElementById('attendance-end-date').value;
    const container = document.getElementById('attendance-container');

    if (!classId) {
        container.innerHTML = '<p class="info-text">Please select a class</p>';
        return;
    }

    try {
        container.innerHTML = '<div class="spinner"></div>';
        
        const data = await api(`/attendance/matrix?classId=${classId}${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`);
        
        if (data.students.length === 0) {
            container.innerHTML = '<p class="info-text">No students in this class</p>';
            return;
        }

        if (data.dates.length === 0) {
            container.innerHTML = '<p class="info-text">No attendance records found. Click on cells to mark attendance.</p>';
            // Still show the table with students
            data.dates = [new Date().toISOString().split('T')[0]];
        }

        renderAttendanceTable(data, classId);
    } catch (error) {
        container.innerHTML = `<p class="info-text">Error loading attendance: ${error.message}</p>`;
    }
}

function renderAttendanceTable(data, classId) {
    const container = document.getElementById('attendance-container');
    const { students, dates, attendance } = data;

    // Separate regular and trial students
    const regularStudents = students.filter(s => s.student_type === 'regular');
    const trialStudents = students.filter(s => s.student_type !== 'regular');

    let html = '<table class="attendance-table"><thead><tr><th>Student Name</th>';
    
    dates.forEach(date => {
        const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        html += `<th>${formattedDate}</th>`;
    });
    
    html += '</tr></thead><tbody>';

    // Regular students section
    if (regularStudents.length > 0) {
        html += '<tr><td colspan="' + (dates.length + 1) + '" class="student-type-header">Regular Students</td></tr>';
        regularStudents.forEach(student => {
            const rowClass = student.color_code ? `student-row-${student.color_code}` : '';
            html += `<tr class="${rowClass}"><td class="student-name">${student.name}</td>`;
            
            dates.forEach(date => {
                const key = `${student.id}-${date}`;
                const status = attendance[key] || '';
                const statusClass = status === 'O' ? 'present' : status === 'X' ? 'absent' : status === '/' ? 'partial' : '';
                html += `<td class="attendance-cell ${statusClass}" 
                    data-student="${student.id}" 
                    data-class="${classId}" 
                    data-date="${date}"
                    onclick="toggleAttendance(this)">${status}</td>`;
            });
            
            html += '</tr>';
        });
    }

    // Trial/Make-up students section
    if (trialStudents.length > 0) {
        html += '<tr><td colspan="' + (dates.length + 1) + '" class="student-type-header">Make-up / Trial Students</td></tr>';
        trialStudents.forEach(student => {
            html += `<tr class="student-row-trial"><td class="student-name">${student.name}</td>`;
            
            dates.forEach(date => {
                const key = `${student.id}-${date}`;
                const status = attendance[key] || '';
                const statusClass = status === 'O' ? 'present' : status === 'X' ? 'absent' : status === '/' ? 'partial' : '';
                html += `<td class="attendance-cell ${statusClass}" 
                    data-student="${student.id}" 
                    data-class="${classId}" 
                    data-date="${date}"
                    onclick="toggleAttendance(this)">${status}</td>`;
            });
            
            html += '</tr>';
        });
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function toggleAttendance(cell) {
    const studentId = cell.dataset.student;
    const classId = cell.dataset.class;
    const date = cell.dataset.date;
    const currentStatus = cell.textContent.trim();

    // Cycle through: '' -> 'O' -> 'X' -> '/' -> ''
    const statusCycle = ['', 'O', 'X', '/'];
    const currentIndex = statusCycle.indexOf(currentStatus);
    const newStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

    try {
        await api('/attendance', {
            method: 'POST',
            body: JSON.stringify({
                student_id: parseInt(studentId),
                class_id: parseInt(classId),
                date: date,
                status: newStatus
            })
        });

        // Update UI
        cell.textContent = newStatus;
        cell.className = 'attendance-cell';
        if (newStatus === 'O') cell.classList.add('present');
        else if (newStatus === 'X') cell.classList.add('absent');
        else if (newStatus === '/') cell.classList.add('partial');
    } catch (error) {
        console.error('Error updating attendance:', error);
        alert('Failed to update attendance');
    }
}

function exportAttendance() {
    const table = document.querySelector('.attendance-table');
    if (!table) {
        alert('No attendance data to export');
        return;
    }

    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const csvRow = [];
        cols.forEach(col => csvRow.push('"' + col.textContent.trim() + '"'));
        csv.push(csvRow.join(','));
    });

    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Set default dates for attendance
const today = new Date();
const weekAgo = new Date(today);
weekAgo.setDate(weekAgo.getDate() - 7);
document.getElementById('attendance-start-date').value = weekAgo.toISOString().split('T')[0];
document.getElementById('attendance-end-date').value = today.toISOString().split('T')[0];

// Lesson Reports
document.getElementById('new-report-btn').addEventListener('click', () => {
    document.getElementById('report-form-container').style.display = 'block';
    document.getElementById('reports-list-container').style.display = 'none';
    document.getElementById('report-form').reset();
    document.getElementById('report-id').value = '';
    document.getElementById('delete-report-btn').style.display = 'none';
    document.getElementById('report-form-date').value = new Date().toISOString().split('T')[0];
});

document.getElementById('cancel-report-btn').addEventListener('click', () => {
    document.getElementById('report-form-container').style.display = 'none';
    document.getElementById('reports-list-container').style.display = 'block';
});

document.getElementById('load-report-btn').addEventListener('click', async () => {
    const classId = document.getElementById('reports-class-select').value;
    const date = document.getElementById('report-date').value;

    if (!classId || !date) {
        alert('Please select a class and date');
        return;
    }

    try {
        const report = await api(`/reports/by-date/${classId}/${date}`);
        
        if (report) {
            // Load existing report
            document.getElementById('report-id').value = report.id;
            document.getElementById('report-form-date').value = report.date;
            document.getElementById('report-teacher').value = report.teacher_id;
            document.getElementById('report-class').value = report.class_id;
            document.getElementById('report-target').value = report.target_topic || '';
            document.getElementById('report-vocabulary').value = report.vocabulary || '';
            document.getElementById('report-mistakes').value = report.mistakes || '';
            document.getElementById('report-strengths').value = report.strengths || '';
            document.getElementById('report-comments').value = report.comments || '';
            document.getElementById('delete-report-btn').style.display = 'inline-block';
            document.getElementById('report-form-container').style.display = 'block';
            document.getElementById('reports-list-container').style.display = 'none';
        } else {
            // Create new report with pre-filled data
            document.getElementById('report-form').reset();
            document.getElementById('report-id').value = '';
            document.getElementById('report-form-date').value = date;
            document.getElementById('report-class').value = classId;
            document.getElementById('delete-report-btn').style.display = 'none';
            document.getElementById('report-form-container').style.display = 'block';
            document.getElementById('reports-list-container').style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading report:', error);
        alert('Error loading report: ' + error.message);
    }
});

document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const reportId = document.getElementById('report-id').value;
    const data = {
        class_id: parseInt(document.getElementById('report-class').value),
        teacher_id: parseInt(document.getElementById('report-teacher').value),
        date: document.getElementById('report-form-date').value,
        target_topic: document.getElementById('report-target').value,
        vocabulary: document.getElementById('report-vocabulary').value,
        mistakes: document.getElementById('report-mistakes').value,
        strengths: document.getElementById('report-strengths').value,
        comments: document.getElementById('report-comments').value
    };

    try {
        if (reportId) {
            await api(`/reports/${reportId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            await api('/reports', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        alert('Report saved successfully!');
        document.getElementById('report-form-container').style.display = 'none';
        document.getElementById('reports-list-container').style.display = 'block';
        loadReportsList();
    } catch (error) {
        alert('Error saving report: ' + error.message);
    }
});

document.getElementById('delete-report-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    const reportId = document.getElementById('report-id').value;
    
    try {
        await api(`/reports/${reportId}`, { method: 'DELETE' });
        alert('Report deleted successfully!');
        document.getElementById('report-form-container').style.display = 'none';
        document.getElementById('reports-list-container').style.display = 'block';
        loadReportsList();
    } catch (error) {
        alert('Error deleting report: ' + error.message);
    }
});

async function loadReportsList() {
    try {
        const reports = await api('/reports');
        const container = document.getElementById('reports-list');
        
        if (reports.length === 0) {
            container.innerHTML = '<p class="info-text">No reports found</p>';
            return;
        }

        container.innerHTML = reports.map(report => `
            <div class="report-item" onclick="loadReportById(${report.id})">
                <div class="report-header">
                    <span class="report-date">${report.date}</span>
                    <span class="report-class">${report.class_name}</span>
                </div>
                <div><strong>Teacher:</strong> ${report.teacher_name}</div>
                <div><strong>Topic:</strong> ${report.target_topic || 'N/A'}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

async function loadReportById(id) {
    try {
        const report = await api(`/reports/${id}`);
        document.getElementById('report-id').value = report.id;
        document.getElementById('report-form-date').value = report.date;
        document.getElementById('report-teacher').value = report.teacher_id;
        document.getElementById('report-class').value = report.class_id;
        document.getElementById('report-target').value = report.target_topic || '';
        document.getElementById('report-vocabulary').value = report.vocabulary || '';
        document.getElementById('report-mistakes').value = report.mistakes || '';
        document.getElementById('report-strengths').value = report.strengths || '';
        document.getElementById('report-comments').value = report.comments || '';
        document.getElementById('delete-report-btn').style.display = 'inline-block';
        document.getElementById('report-form-container').style.display = 'block';
        document.getElementById('reports-list-container').style.display = 'none';
    } catch (error) {
        alert('Error loading report: ' + error.message);
    }
}

// Initialize reports list
document.getElementById('report-date').value = new Date().toISOString().split('T')[0];

// Admin Section
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(`${tab}-tab`).classList.add('active');
    });
});

async function loadAdminData() {
    await loadStudentsList();
    await loadClassesList();
}

async function loadStudentsList() {
    try {
        const students = await api('/students');
        const container = document.getElementById('students-list');
        
        if (students.length === 0) {
            container.innerHTML = '<p class="info-text">No students found</p>';
            return;
        }

        let html = '<table><thead><tr><th>Name</th><th>Class</th><th>Type</th><th>Actions</th></tr></thead><tbody>';
        
        students.forEach(student => {
            html += `
                <tr>
                    <td>${student.name}</td>
                    <td>${student.class_name || 'Unassigned'}</td>
                    <td>${student.student_type}</td>
                    <td class="action-buttons">
                        <button class="btn btn-primary btn-small" onclick="editStudent(${student.id})">Edit</button>
                        <button class="btn btn-danger btn-small" onclick="deleteStudent(${student.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

async function loadClassesList() {
    try {
        const classes = await api('/classes');
        const container = document.getElementById('classes-list');
        
        if (classes.length === 0) {
            container.innerHTML = '<p class="info-text">No classes found</p>';
            return;
        }

        let html = '<table><thead><tr><th>Name</th><th>Teacher</th><th>Schedule</th><th>Actions</th></tr></thead><tbody>';
        
        classes.forEach(cls => {
            html += `
                <tr>
                    <td><span style="color: ${cls.color}">●</span> ${cls.name}</td>
                    <td>${cls.teacher_name || 'Unassigned'}</td>
                    <td>${cls.schedule || 'N/A'}</td>
                    <td class="action-buttons">
                        <button class="btn btn-primary btn-small" onclick="editClass(${cls.id})">Edit</button>
                        <button class="btn btn-danger btn-small" onclick="deleteClass(${cls.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

// Student Management
document.getElementById('add-student-btn').addEventListener('click', () => {
    showModal('Add Student', `
        <form id="student-form">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" id="student-name" required class="form-control">
            </div>
            <div class="form-group">
                <label>Class</label>
                <select id="student-class" class="form-control">
                    <option value="">Unassigned</option>
                    ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Type</label>
                <select id="student-type" class="form-control">
                    <option value="regular">Regular</option>
                    <option value="trial">Trial/Make-up</option>
                </select>
            </div>
            <div class="form-group">
                <label>Color Code</label>
                <select id="student-color" class="form-control">
                    <option value="">None</option>
                    <option value="yellow">Yellow</option>
                    <option value="blue">Blue</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary">Add Student</button>
        </form>
    `);

    document.getElementById('student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            await api('/students', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('student-name').value,
                    class_id: document.getElementById('student-class').value || null,
                    student_type: document.getElementById('student-type').value,
                    color_code: document.getElementById('student-color').value
                })
            });

            closeModal();
            await loadInitialData();
            await loadStudentsList();
        } catch (error) {
            alert('Error adding student: ' + error.message);
        }
    });
});

async function editStudent(id) {
    try {
        const student = await api(`/students/${id}`);
        
        showModal('Edit Student', `
            <form id="edit-student-form">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="edit-student-name" value="${student.name}" required class="form-control">
                </div>
                <div class="form-group">
                    <label>Class</label>
                    <select id="edit-student-class" class="form-control">
                        <option value="">Unassigned</option>
                        ${classes.map(c => `<option value="${c.id}" ${c.id == student.class_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select id="edit-student-type" class="form-control">
                        <option value="regular" ${student.student_type === 'regular' ? 'selected' : ''}>Regular</option>
                        <option value="trial" ${student.student_type === 'trial' ? 'selected' : ''}>Trial/Make-up</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Color Code</label>
                    <select id="edit-student-color" class="form-control">
                        <option value="">None</option>
                        <option value="yellow" ${student.color_code === 'yellow' ? 'selected' : ''}>Yellow</option>
                        <option value="blue" ${student.color_code === 'blue' ? 'selected' : ''}>Blue</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Update Student</button>
            </form>
        `);

        document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                await api(`/students/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: document.getElementById('edit-student-name').value,
                        class_id: document.getElementById('edit-student-class').value || null,
                        student_type: document.getElementById('edit-student-type').value,
                        color_code: document.getElementById('edit-student-color').value,
                        active: 1
                    })
                });

                closeModal();
                await loadInitialData();
                await loadStudentsList();
            } catch (error) {
                alert('Error updating student: ' + error.message);
            }
        });
    } catch (error) {
        alert('Error loading student: ' + error.message);
    }
}

async function deleteStudent(id) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    try {
        await api(`/students/${id}`, { method: 'DELETE' });
        await loadInitialData();
        await loadStudentsList();
    } catch (error) {
        alert('Error deleting student: ' + error.message);
    }
}

// Class Management
document.getElementById('add-class-btn').addEventListener('click', () => {
    showModal('Add Class', `
        <form id="class-form">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" id="class-name" required class="form-control">
            </div>
            <div class="form-group">
                <label>Teacher</label>
                <select id="class-teacher" class="form-control">
                    <option value="">Unassigned</option>
                    ${teachers.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Schedule</label>
                <input type="text" id="class-schedule" class="form-control" placeholder="e.g., Mon/Wed 10:00-11:30">
            </div>
            <div class="form-group">
                <label>Color</label>
                <input type="color" id="class-color" value="#4A90E2" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary">Add Class</button>
        </form>
    `);

    document.getElementById('class-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            await api('/classes', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('class-name').value,
                    teacher_id: document.getElementById('class-teacher').value || null,
                    schedule: document.getElementById('class-schedule').value,
                    color: document.getElementById('class-color').value
                })
            });

            closeModal();
            await loadInitialData();
            await loadClassesList();
        } catch (error) {
            alert('Error adding class: ' + error.message);
        }
    });
});

async function editClass(id) {
    try {
        const cls = await api(`/classes/${id}`);
        
        showModal('Edit Class', `
            <form id="edit-class-form">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="edit-class-name" value="${cls.name}" required class="form-control">
                </div>
                <div class="form-group">
                    <label>Teacher</label>
                    <select id="edit-class-teacher" class="form-control">
                        <option value="">Unassigned</option>
                        ${teachers.map(t => `<option value="${t.id}" ${t.id == cls.teacher_id ? 'selected' : ''}>${t.full_name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Schedule</label>
                    <input type="text" id="edit-class-schedule" value="${cls.schedule || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <input type="color" id="edit-class-color" value="${cls.color}" class="form-control">
                </div>
                <button type="submit" class="btn btn-primary">Update Class</button>
            </form>
        `);

        document.getElementById('edit-class-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                await api(`/classes/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: document.getElementById('edit-class-name').value,
                        teacher_id: document.getElementById('edit-class-teacher').value || null,
                        schedule: document.getElementById('edit-class-schedule').value,
                        color: document.getElementById('edit-class-color').value,
                        active: 1
                    })
                });

                closeModal();
                await loadInitialData();
                await loadClassesList();
            } catch (error) {
                alert('Error updating class: ' + error.message);
            }
        });
    } catch (error) {
        alert('Error loading class: ' + error.message);
    }
}

async function deleteClass(id) {
    if (!confirm('Are you sure you want to delete this class?')) return;
    
    try {
        await api(`/classes/${id}`, { method: 'DELETE' });
        await loadInitialData();
        await loadClassesList();
    } catch (error) {
        alert('Error deleting class: ' + error.message);
    }
}

// Modal Management
function showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

document.querySelector('.modal-close').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) {
        closeModal();
    }
});
