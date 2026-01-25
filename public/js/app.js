// Global state
let currentUser = null;
let classes = [];
let students = [];
let teachers = [];

// Toast Notification System
const Toast = {
    container: null,
    
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    
    show(message, type = 'info', title = '', duration = 4000) {
        this.init();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ'
        };
        
        const titles = {
            success: title || 'Success',
            error: title || 'Error',
            info: title || 'Info'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type]}</div>
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        this.container.appendChild(toast);
        
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
        
        return toast;
    },
    
    success(message, title) {
        return this.show(message, 'success', title);
    },
    
    error(message, title) {
        return this.show(message, 'error', title);
    },
    
    info(message, title) {
        return this.show(message, 'info', title);
    }
};

// HTML escaping helper to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? String(text).replace(/[&<>"']/g, m => map[m]) : '';
}

// API Helper
async function api(endpoint, options = {}) {
    // Show loading spinner on button if applicable
    const button = document.activeElement;
    if (button && button.tagName === 'BUTTON') {
        button.classList.add('loading');
    }
    
    try {
        const response = await fetch(`/api${endpoint}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const defaultError = `Request failed: ${response.status} ${response.statusText}`;
            const error = await response.json().catch(() => ({ error: defaultError }));
            
            // Show user-friendly error message with hint if available
            const errorMessage = error.hint || error.error || defaultError;
            Toast.error(errorMessage);
            
            throw new Error(error.error || defaultError);
        }

        return response.json();
    } catch (error) {
        // Network error or other issues
        if (!navigator.onLine) {
            Toast.error('No internet connection', 'Offline');
        } else if (!error.message.includes('Request failed')) {
            // Only show toast if we haven't already shown one above
            Toast.error(error.message);
        }
        throw error;
    } finally {
        // Remove loading spinner
        if (button && button.tagName === 'BUTTON') {
            button.classList.remove('loading');
        }
    }
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
        
        // CRITICAL: Load initial data BEFORE showing dashboard
        try {
            console.log('Loading initial data...');
            await loadInitialData();
            console.log('✅ All initial data loaded successfully');
            
            document.getElementById('login-screen').classList.remove('active');
            document.getElementById('app-screen').classList.add('active');
            
            loadDashboard();
            
        } catch (dataError) {
            console.error('Error loading initial data:', dataError);
            errorDiv.textContent = 'Failed to load initial data: ' + dataError.message + '\n\nThis usually means the database is empty. Please check the server logs.';
            // Logout if data loading fails
            await fetch('/api/auth/logout', { 
                method: 'POST', 
                credentials: 'include' 
            });
            currentUser = null;
        }
    } catch (error) {
        console.error('Login error:', error);
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
        console.log('🔄 Loading classes...');
        const classesResponse = await fetch('/api/classes', {
            credentials: 'include'
        });
        
        console.log('Classes response status:', classesResponse.status);
        
        if (!classesResponse.ok) {
            const errorText = await classesResponse.text();
            console.error('Classes error response:', errorText);
            throw new Error(`Failed to load classes (${classesResponse.status}): ${errorText}`);
        }
        
        const classesData = await classesResponse.json();
        console.log('✅ Classes loaded:', classesData.length, 'classes');
        
        if (classesData.length === 0) {
            console.warn('⚠️  WARNING: No classes found in database!');
        }
        
        console.log('🔄 Loading students...');
        const studentsResponse = await fetch('/api/students', {
            credentials: 'include'
        });
        
        console.log('Students response status:', studentsResponse.status);
        
        if (!studentsResponse.ok) {
            const errorText = await studentsResponse.text();
            console.error('Students error response:', errorText);
            throw new Error(`Failed to load students (${studentsResponse.status}): ${errorText}`);
        }
        
        const studentsData = await studentsResponse.json();
        console.log('✅ Students loaded:', studentsData.length, 'students');
        
        classes = classesData;
        students = studentsData;

        // Get unique teachers from classes
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
        console.error('❌ Error loading initial data:', error);
        alert('Failed to load initial data. Error: ' + error.message + '\n\nPlease check the browser console and server logs for details.');
        throw error;
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
    await loadTeachersList();
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
                    ${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
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
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="student-email" class="form-control">
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="tel" id="student-phone" class="form-control">
            </div>
            <div class="form-group">
                <label>Parent Name</label>
                <input type="text" id="student-parent-name" class="form-control">
            </div>
            <div class="form-group">
                <label>Parent Phone</label>
                <input type="tel" id="student-parent-phone" class="form-control">
            </div>
            <div class="form-group">
                <label>Parent Email</label>
                <input type="email" id="student-parent-email" class="form-control">
            </div>
            <div class="form-group">
                <label>Enrollment Date</label>
                <input type="date" id="student-enrollment-date" class="form-control">
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
                    color_code: document.getElementById('student-color').value,
                    email: document.getElementById('student-email').value || null,
                    phone: document.getElementById('student-phone').value || null,
                    parent_name: document.getElementById('student-parent-name').value || null,
                    parent_phone: document.getElementById('student-parent-phone').value || null,
                    parent_email: document.getElementById('student-parent-email').value || null,
                    enrollment_date: document.getElementById('student-enrollment-date').value || null
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
                    <input type="text" id="edit-student-name" value="${escapeHtml(student.name)}" required class="form-control">
                </div>
                <div class="form-group">
                    <label>Class</label>
                    <select id="edit-student-class" class="form-control">
                        <option value="">Unassigned</option>
                        ${classes.map(c => `<option value="${c.id}" ${c.id == student.class_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
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
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="edit-student-email" value="${escapeHtml(student.email || '')}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="edit-student-phone" value="${escapeHtml(student.phone || '')}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Parent Name</label>
                    <input type="text" id="edit-student-parent-name" value="${escapeHtml(student.parent_name || '')}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Parent Phone</label>
                    <input type="tel" id="edit-student-parent-phone" value="${escapeHtml(student.parent_phone || '')}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Parent Email</label>
                    <input type="email" id="edit-student-parent-email" value="${escapeHtml(student.parent_email || '')}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Enrollment Date</label>
                    <input type="date" id="edit-student-enrollment-date" value="${student.enrollment_date || ''}" class="form-control">
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
                        email: document.getElementById('edit-student-email').value || null,
                        phone: document.getElementById('edit-student-phone').value || null,
                        parent_name: document.getElementById('edit-student-parent-name').value || null,
                        parent_phone: document.getElementById('edit-student-parent-phone').value || null,
                        parent_email: document.getElementById('edit-student-parent-email').value || null,
                        enrollment_date: document.getElementById('edit-student-enrollment-date').value || null,
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

// Teacher Management
async function loadTeachersList() {
    try {
        const teachersData = await api('/auth/teachers');
        const container = document.getElementById('teachers-list');
        
        if (teachersData.length === 0) {
            container.innerHTML = '<p class="info-text">No teachers found</p>';
            return;
        }

        let html = '<table><thead><tr><th>Username</th><th>Full Name</th><th>Actions</th></tr></thead><tbody>';
        
        teachersData.forEach(teacher => {
            html += `
                <tr>
                    <td>${escapeHtml(teacher.username)}</td>
                    <td>${escapeHtml(teacher.full_name)}</td>
                    <td class="action-buttons">
                        <button class="btn btn-primary btn-small" onclick="editTeacher(${teacher.id})">Edit</button>
                        <button class="btn btn-danger btn-small" onclick="deleteTeacher(${teacher.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading teachers:', error);
    }
}

document.getElementById('add-teacher-btn').addEventListener('click', () => {
    showModal('Add Teacher', `
        <form id="teacher-form">
            <div class="form-group">
                <label>Username *</label>
                <input type="text" id="teacher-username" required class="form-control">
            </div>
            <div class="form-group">
                <label>Full Name *</label>
                <input type="text" id="teacher-fullname" required class="form-control">
            </div>
            <div class="form-group">
                <label>Password *</label>
                <input type="password" id="teacher-password" required class="form-control" minlength="6">
            </div>
            <div class="form-group">
                <label>Confirm Password *</label>
                <input type="password" id="teacher-password-confirm" required class="form-control" minlength="6">
            </div>
            <button type="submit" class="btn btn-primary">Add Teacher</button>
        </form>
    `);

    document.getElementById('teacher-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const password = document.getElementById('teacher-password').value;
        const confirmPassword = document.getElementById('teacher-password-confirm').value;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        try {
            await api('/auth/teachers', {
                method: 'POST',
                body: JSON.stringify({
                    username: document.getElementById('teacher-username').value,
                    full_name: document.getElementById('teacher-fullname').value,
                    password: password
                })
            });

            closeModal();
            await loadTeachersList();
            alert('Teacher added successfully!');
        } catch (error) {
            alert('Error adding teacher: ' + error.message);
        }
    });
});

async function editTeacher(id) {
    try {
        const teacher = await api(`/auth/teachers/${id}`);
        
        showModal('Edit Teacher', `
            <form id="edit-teacher-form">
                <div class="form-group">
                    <label>Username *</label>
                    <input type="text" id="edit-teacher-username" value="${escapeHtml(teacher.username)}" required class="form-control">
                </div>
                <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="edit-teacher-fullname" value="${escapeHtml(teacher.full_name)}" required class="form-control">
                </div>
                <div class="form-group">
                    <label>New Password (leave blank to keep current)</label>
                    <input type="password" id="edit-teacher-password" class="form-control" minlength="6">
                </div>
                <div class="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" id="edit-teacher-password-confirm" class="form-control" minlength="6">
                </div>
                <button type="submit" class="btn btn-primary">Update Teacher</button>
            </form>
        `);

        document.getElementById('edit-teacher-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = document.getElementById('edit-teacher-password').value;
            const confirmPassword = document.getElementById('edit-teacher-password-confirm').value;
            
            if (password && password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }
            
            try {
                const updateData = {
                    username: document.getElementById('edit-teacher-username').value,
                    full_name: document.getElementById('edit-teacher-fullname').value
                };
                
                if (password) {
                    updateData.password = password;
                }
                
                await api(`/auth/teachers/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });

                closeModal();
                await loadTeachersList();
                alert('Teacher updated successfully!');
            } catch (error) {
                alert('Error updating teacher: ' + error.message);
            }
        });
    } catch (error) {
        alert('Error loading teacher: ' + error.message);
    }
}

async function deleteTeacher(id) {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    
    try {
        await api(`/auth/teachers/${id}`, { method: 'DELETE' });
        await loadTeachersList();
        alert('Teacher deleted successfully!');
    } catch (error) {
        alert('Error deleting teacher: ' + error.message);
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

// Profile Page Functions
document.getElementById('profile-btn')?.addEventListener('click', () => {
    navigateToPage('profile');
    loadProfilePage();
});

async function loadProfilePage() {
    if (!currentUser) return;
    
    document.getElementById('profile-username').textContent = currentUser.username;
    document.getElementById('profile-fullname').textContent = currentUser.fullName;
    document.getElementById('profile-role').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
}

// Change Password
document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageDiv = document.getElementById('password-message');
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        messageDiv.textContent = 'New passwords do not match';
        messageDiv.className = 'message error';
        return;
    }
    
    if (newPassword.length < 6) {
        messageDiv.textContent = 'Password must be at least 6 characters';
        messageDiv.className = 'message error';
        return;
    }
    
    try {
        await api('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        messageDiv.textContent = 'Password updated successfully!';
        messageDiv.className = 'message success';
        
        e.target.reset();
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        messageDiv.textContent = error.message;
        messageDiv.className = 'message error';
    }
});

// Change Username
document.getElementById('change-username-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageDiv = document.getElementById('username-message');
    
    const newUsername = document.getElementById('new-username').value;
    const password = document.getElementById('username-password').value;
    
    if (newUsername.length < 3) {
        messageDiv.textContent = 'Username must be at least 3 characters';
        messageDiv.className = 'message error';
        return;
    }
    
    try {
        const result = await api('/auth/change-username', {
            method: 'POST',
            body: JSON.stringify({ newUsername, password })
        });
        
        currentUser.username = result.username;
        messageDiv.textContent = 'Username updated successfully!';
        messageDiv.className = 'message success';
        
        document.getElementById('profile-username').textContent = result.username;
        e.target.reset();
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        messageDiv.textContent = error.message;
        messageDiv.className = 'message error';
    }
});

// Database Viewer Functions
document.getElementById('db-load-btn')?.addEventListener('click', loadDatabaseTable);
document.getElementById('db-export-btn')?.addEventListener('click', exportDatabaseTable);
document.getElementById('db-search-btn')?.addEventListener('click', searchDatabase);

async function searchDatabase() {
    const query = document.getElementById('db-search-input').value.trim();
    const type = document.getElementById('db-search-type').value;
    const startDate = document.getElementById('db-search-start-date').value;
    const endDate = document.getElementById('db-search-end-date').value;
    const container = document.getElementById('db-viewer-container');
    
    if (!query) {
        alert('Please enter a search query');
        return;
    }
    
    try {
        container.innerHTML = '<p class="info-text">Searching...</p>';
        
        const params = new URLSearchParams({ query });
        if (type) params.append('type', type);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        
        const results = await api(`/database/search?${params.toString()}`);
        
        if (!results || Object.keys(results).length === 0) {
            container.innerHTML = '<p class="info-text">No results found</p>';
            return;
        }
        
        let html = '<div class="search-results">';
        
        // Display results grouped by type
        if (results.students && results.students.length > 0) {
            html += `<h3>Students (${results.students.length})</h3>`;
            html += '<table class="db-table"><thead><tr>';
            const studentCols = Object.keys(results.students[0]);
            studentCols.forEach(col => html += `<th>${col}</th>`);
            html += '</tr></thead><tbody>';
            results.students.forEach(row => {
                html += '<tr>';
                studentCols.forEach(col => {
                    let value = row[col];
                    if (value === null) value = '<em>null</em>';
                    else if (typeof value === 'object') value = JSON.stringify(value);
                    html += `<td>${escapeHtml(String(value))}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table><br>';
        }
        
        if (results.teachers && results.teachers.length > 0) {
            html += `<h3>Teachers (${results.teachers.length})</h3>`;
            html += '<table class="db-table"><thead><tr>';
            const teacherCols = Object.keys(results.teachers[0]);
            teacherCols.forEach(col => html += `<th>${col}</th>`);
            html += '</tr></thead><tbody>';
            results.teachers.forEach(row => {
                html += '<tr>';
                teacherCols.forEach(col => {
                    let value = row[col];
                    if (value === null) value = '<em>null</em>';
                    else if (typeof value === 'object') value = JSON.stringify(value);
                    html += `<td>${escapeHtml(String(value))}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table><br>';
        }
        
        if (results.classes && results.classes.length > 0) {
            html += `<h3>Classes (${results.classes.length})</h3>`;
            html += '<table class="db-table"><thead><tr>';
            const classCols = Object.keys(results.classes[0]);
            classCols.forEach(col => html += `<th>${col}</th>`);
            html += '</tr></thead><tbody>';
            results.classes.forEach(row => {
                html += '<tr>';
                classCols.forEach(col => {
                    let value = row[col];
                    if (value === null) value = '<em>null</em>';
                    else if (typeof value === 'object') value = JSON.stringify(value);
                    html += `<td>${escapeHtml(String(value))}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table><br>';
        }
        
        if (results.attendance && results.attendance.length > 0) {
            html += `<h3>Attendance (${results.attendance.length})</h3>`;
            html += '<table class="db-table"><thead><tr>';
            const attendanceCols = Object.keys(results.attendance[0]);
            attendanceCols.forEach(col => html += `<th>${col}</th>`);
            html += '</tr></thead><tbody>';
            results.attendance.forEach(row => {
                html += '<tr>';
                attendanceCols.forEach(col => {
                    let value = row[col];
                    if (value === null) value = '<em>null</em>';
                    else if (typeof value === 'object') value = JSON.stringify(value);
                    html += `<td>${escapeHtml(String(value))}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table><br>';
        }
        
        if (results.reports && results.reports.length > 0) {
            html += `<h3>Lesson Reports (${results.reports.length})</h3>`;
            html += '<table class="db-table"><thead><tr>';
            const reportCols = Object.keys(results.reports[0]);
            reportCols.forEach(col => html += `<th>${col}</th>`);
            html += '</tr></thead><tbody>';
            results.reports.forEach(row => {
                html += '<tr>';
                reportCols.forEach(col => {
                    let value = row[col];
                    if (value === null) value = '<em>null</em>';
                    else if (typeof value === 'object') value = JSON.stringify(value);
                    html += `<td>${escapeHtml(String(value))}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table><br>';
        }
        
        if (results.makeup_lessons && results.makeup_lessons.length > 0) {
            html += `<h3>Make-up Lessons (${results.makeup_lessons.length})</h3>`;
            html += '<table class="db-table"><thead><tr>';
            const makeupCols = Object.keys(results.makeup_lessons[0]);
            makeupCols.forEach(col => html += `<th>${col}</th>`);
            html += '</tr></thead><tbody>';
            results.makeup_lessons.forEach(row => {
                html += '<tr>';
                makeupCols.forEach(col => {
                    let value = row[col];
                    if (value === null) value = '<em>null</em>';
                    else if (typeof value === 'object') value = JSON.stringify(value);
                    html += `<td>${escapeHtml(String(value))}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table><br>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="info-text error">Error: ${error.message}</p>`;
    }
}

async function loadDatabaseTable() {
    const tableName = document.getElementById('db-table-select').value;
    const container = document.getElementById('db-viewer-container');
    
    try {
        container.innerHTML = '<p class="info-text">Loading...</p>';
        const result = await api(`/database/table/${tableName}`);
        
        if (result.data.length === 0) {
            container.innerHTML = '<p class="info-text">No data found</p>';
            return;
        }
        
        const columns = Object.keys(result.data[0]);
        let html = '<table class="db-table"><thead><tr>';
        
        columns.forEach(col => {
            html += `<th>${col}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        result.data.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                let value = row[col];
                if (value === null) value = '<em>null</em>';
                else if (typeof value === 'object') value = JSON.stringify(value);
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="info-text error">Error: ${error.message}</p>`;
    }
}

function exportDatabaseTable() {
    const tableName = document.getElementById('db-table-select').value;
    const table = document.querySelector('.db-table');
    
    if (!table) {
        alert('Please load data first');
        return;
    }
    
    let csv = '';
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        const rowData = Array.from(cells).map(cell => {
            let text = cell.textContent.trim();
            if (text.includes(',') || text.includes('"')) {
                text = '"' + text.replace(/"/g, '""') + '"';
            }
            return text;
        });
        csv += rowData.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Student Profiles Functions
let allStudentsForProfile = [];

async function loadStudentProfiles() {
    try {
        allStudentsForProfile = await api('/students');
        renderStudentProfiles();
    } catch (error) {
        console.error('Error loading student profiles:', error);
    }
}

function renderStudentProfiles(filteredStudents = null) {
    const container = document.getElementById('students-profile-list');
    const studentsToRender = filteredStudents || allStudentsForProfile;
    
    if (studentsToRender.length === 0) {
        container.innerHTML = '<p class="info-text">No students found</p>';
        return;
    }
    
    let html = '';
    studentsToRender.forEach(student => {
        const typeClass = student.student_type === 'trial' ? 'trial' : 'regular';
        const typeName = student.student_type === 'trial' ? 'Trial' : 'Regular';
        const enrollmentDate = student.enrollment_date ? new Date(student.enrollment_date + 'T00:00:00').toLocaleDateString() : 'N/A';
        
        html += `
            <div class="student-card" onclick="showStudentDetail(${student.id})">
                <span class="student-type-badge ${typeClass}">${typeName}</span>
                <h3>${escapeHtml(student.name)}</h3>
                <div class="student-info">
                    ${escapeHtml(student.class_name) || 'No class assigned'}
                </div>
                <div class="student-info" style="font-size: 0.85rem; color: #6c757d; margin-top: 5px;">
                    Enrolled: ${enrollmentDate}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

document.getElementById('student-search')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const classFilter = document.getElementById('student-class-filter').value;
    
    let filtered = allStudentsForProfile.filter(s => 
        s.name.toLowerCase().includes(searchTerm)
    );
    
    if (classFilter) {
        filtered = filtered.filter(s => s.class_id == classFilter);
    }
    
    renderStudentProfiles(filtered);
});

document.getElementById('student-class-filter')?.addEventListener('change', (e) => {
    const classFilter = e.target.value;
    const searchTerm = document.getElementById('student-search').value.toLowerCase();
    
    let filtered = allStudentsForProfile;
    
    if (searchTerm) {
        filtered = filtered.filter(s => s.name.toLowerCase().includes(searchTerm));
    }
    
    if (classFilter) {
        filtered = filtered.filter(s => s.class_id == classFilter);
    }
    
    renderStudentProfiles(filtered);
});

async function showStudentDetail(studentId) {
    try {
        const data = await api(`/students/${studentId}/details`);
        const { student, attendance, reports, stats, makeupLessons } = data;
        
        let attendanceListHtml = '';
        if (attendance.length > 0) {
            attendance.slice(0, 20).forEach(a => {
                const statusText = a.status === 'O' ? 'Present' : a.status === 'X' ? 'Absent' : a.status === '/' ? 'Partial' : 'Unknown';
                const statusClass = a.status === 'O' ? 'present' : a.status === 'X' ? 'absent' : a.status === '/' ? 'partial' : '';
                attendanceListHtml += `
                    <div class="attendance-item">
                        <span class="date">${new Date(a.date + 'T00:00:00').toLocaleDateString()}</span>
                        <span class="status ${statusClass}">${statusText}</span>
                        ${a.notes ? `<div style="font-size: 0.85rem; color: #6c757d; margin-top: 0.25rem;">${escapeHtml(a.notes)}</div>` : ''}
                    </div>
                `;
            });
        } else {
            attendanceListHtml = '<p class="info-text">No attendance records</p>';
        }
        
        let reportsListHtml = '';
        if (reports.length > 0) {
            reports.slice(0, 5).forEach(r => {
                reportsListHtml += `
                    <div class="report-item">
                        <strong>${new Date(r.date + 'T00:00:00').toLocaleDateString()}</strong> - ${escapeHtml(r.teacher_name)}
                        <div style="font-size: 0.85rem; color: #6c757d; margin-top: 0.25rem;">
                            ${escapeHtml(r.target_topic) || 'No topic specified'}
                        </div>
                    </div>
                `;
            });
        } else {
            reportsListHtml = '<p class="info-text">No lesson reports</p>';
        }
        
        let makeupListHtml = '';
        if (makeupLessons && makeupLessons.length > 0) {
            makeupLessons.forEach(m => {
                const statusClass = m.status === 'completed' ? 'present' : m.status === 'cancelled' ? 'absent' : 'partial';
                makeupListHtml += `
                    <div class="makeup-item">
                        <span class="date">${new Date(m.scheduled_date + 'T00:00:00').toLocaleDateString()}</span>
                        <span class="status ${statusClass}">${m.status}</span>
                        ${m.reason ? `<div style="font-size: 0.85rem; color: #6c757d; margin-top: 0.25rem;">${escapeHtml(m.reason)}</div>` : ''}
                    </div>
                `;
            });
        } else {
            makeupListHtml = '<p class="info-text">No makeup lessons</p>';
        }
        
        const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
        const partialRate = stats.total > 0 ? Math.round((stats.partial / stats.total) * 100) : 0;
        
        const content = `
            <div class="student-detail">
                <div class="detail-section">
                    <h4>Student Information</h4>
                    <p><strong>Name:</strong> ${escapeHtml(student.name)}</p>
                    <p><strong>Class:</strong> ${escapeHtml(student.class_name) || 'Not assigned'}</p>
                    <p><strong>Type:</strong> ${student.student_type === 'trial' ? 'Trial/Make-up' : 'Regular'}</p>
                    ${student.email ? `<p><strong>Email:</strong> ${escapeHtml(student.email)}</p>` : ''}
                    ${student.phone ? `<p><strong>Phone:</strong> ${escapeHtml(student.phone)}</p>` : ''}
                    ${student.enrollment_date ? `<p><strong>Enrolled:</strong> ${new Date(student.enrollment_date + 'T00:00:00').toLocaleDateString()}</p>` : ''}
                    ${student.notes ? `<p><strong>Notes:</strong> ${escapeHtml(student.notes)}</p>` : ''}
                </div>
                
                ${student.parent_name || student.parent_phone || student.parent_email ? `
                <div class="detail-section">
                    <h4>Parent/Guardian Information</h4>
                    ${student.parent_name ? `<p><strong>Name:</strong> ${escapeHtml(student.parent_name)}</p>` : ''}
                    ${student.parent_phone ? `<p><strong>Phone:</strong> ${escapeHtml(student.parent_phone)}</p>` : ''}
                    ${student.parent_email ? `<p><strong>Email:</strong> ${escapeHtml(student.parent_email)}</p>` : ''}
                </div>
                ` : ''}
                
                <div class="detail-section">
                    <h4>Attendance Statistics</h4>
                    <div class="attendance-summary">
                        <div class="stat-box">
                            <div class="stat-value">${stats.total || 0}</div>
                            <div class="stat-label">Total</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${stats.present || 0}</div>
                            <div class="stat-label">Present</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${stats.absent || 0}</div>
                            <div class="stat-label">Absent</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${stats.partial || 0}</div>
                            <div class="stat-label">Partial</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${attendanceRate}%</div>
                            <div class="stat-label">Rate</div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Recent Attendance (Last 20)</h4>
                    <div class="attendance-list">
                        ${attendanceListHtml}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Recent Class Reports (Last 5)</h4>
                    <div class="reports-list">
                        ${reportsListHtml}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Make-up Lessons</h4>
                    <div class="makeup-list">
                        ${makeupListHtml}
                    </div>
                </div>
            </div>
        `;
        
        showModal(`${escapeHtml(student.name)} - Profile`, content);
    } catch (error) {
        alert('Error loading student details: ' + error.message);
    }
}

// Make-up Lessons Page Functions
async function loadMakeupPage() {
    // Populate student filter
    const studentFilter = document.getElementById('makeup-student-filter');
    studentFilter.innerHTML = '<option value="">All Students</option>';
    students.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.name;
        studentFilter.appendChild(option);
    });
}

document.getElementById('filter-makeup-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('makeup-status-filter').value;
    const studentId = document.getElementById('makeup-student-filter').value;
    const startDate = document.getElementById('makeup-start-date').value;
    const endDate = document.getElementById('makeup-end-date').value;
    
    try {
        let url = '/makeup';
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (studentId) params.append('student_id', studentId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const lessons = await api(url);
        renderMakeupLessonsTable(lessons);
    } catch (error) {
        document.getElementById('makeup-lessons-container').innerHTML = 
            `<p class="info-text error">Error: ${error.message}</p>`;
    }
});

document.getElementById('new-makeup-btn')?.addEventListener('click', () => {
    showMakeupLessonForm();
});

function renderMakeupLessonsTable(lessons) {
    const container = document.getElementById('makeup-lessons-container');
    
    if (lessons.length === 0) {
        container.innerHTML = '<p class="info-text">No make-up lessons found</p>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    lessons.forEach(lesson => {
        const statusClass = lesson.status === 'completed' ? 'present' : lesson.status === 'cancelled' ? 'absent' : 'partial';
        html += `
            <tr>
                <td>${escapeHtml(lesson.student_name)}</td>
                <td>${escapeHtml(lesson.class_name)}</td>
                <td>${new Date(lesson.scheduled_date + 'T00:00:00').toLocaleDateString()}</td>
                <td>${lesson.scheduled_time || 'N/A'}</td>
                <td>${escapeHtml(lesson.reason) || '-'}</td>
                <td><span class="status ${statusClass}">${lesson.status}</span></td>
                <td class="action-buttons">
                    ${lesson.status === 'scheduled' ? `
                        <button class="btn btn-small btn-primary" onclick="editMakeupLesson(${lesson.id})">Edit</button>
                        <button class="btn btn-small btn-success" onclick="completeMakeupLesson(${lesson.id})">Complete</button>
                        <button class="btn btn-small btn-danger" onclick="cancelMakeupLesson(${lesson.id})">Cancel</button>
                    ` : `
                        <button class="btn btn-small btn-primary" onclick="editMakeupLesson(${lesson.id})">Edit</button>
                        <button class="btn btn-small btn-danger" onclick="deleteMakeupLesson(${lesson.id})">Delete</button>
                    `}
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

async function editMakeupLesson(id) {
    try {
        const lesson = await api(`/makeup/${id}`);
        
        const content = `
            <form id="edit-makeup-lesson-form">
                <div class="form-group">
                    <label>Student *</label>
                    <select id="edit-makeup-student" required class="form-control">
                        ${students.map(s => `<option value="${s.id}" ${s.id === lesson.student_id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Class *</label>
                    <select id="edit-makeup-class" required class="form-control">
                        ${classes.map(c => `<option value="${c.id}" ${c.id === lesson.class_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Scheduled Date *</label>
                    <input type="date" id="edit-makeup-date" value="${lesson.scheduled_date}" required class="form-control">
                </div>
                <div class="form-group">
                    <label>Scheduled Time</label>
                    <input type="time" id="edit-makeup-time" value="${lesson.scheduled_time || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Reason</label>
                    <textarea id="edit-makeup-reason" rows="2" class="form-control">${escapeHtml(lesson.reason || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="edit-makeup-notes" rows="2" class="form-control">${escapeHtml(lesson.notes || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="edit-makeup-status" class="form-control">
                        <option value="scheduled" ${lesson.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                        <option value="completed" ${lesson.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="cancelled" ${lesson.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Update Make-up Lesson</button>
            </form>
        `;
        
        showModal('Edit Make-up Lesson', content);
        
        document.getElementById('edit-makeup-lesson-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const data = {
                student_id: document.getElementById('edit-makeup-student').value,
                class_id: document.getElementById('edit-makeup-class').value,
                scheduled_date: document.getElementById('edit-makeup-date').value,
                scheduled_time: document.getElementById('edit-makeup-time').value,
                reason: document.getElementById('edit-makeup-reason').value,
                notes: document.getElementById('edit-makeup-notes').value,
                status: document.getElementById('edit-makeup-status').value
            };
            
            try {
                await api(`/makeup/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
                
                closeModal();
                document.getElementById('filter-makeup-btn').click();
                alert('Make-up lesson updated successfully!');
            } catch (error) {
                alert('Error: ' + error.message);
            }
        });
    } catch (error) {
        alert('Error loading makeup lesson: ' + error.message);
    }
}

async function deleteMakeupLesson(id) {
    if (!confirm('Are you sure you want to delete this make-up lesson?')) return;
    
    try {
        await api(`/makeup/${id}`, { method: 'DELETE' });
        document.getElementById('filter-makeup-btn').click();
        alert('Make-up lesson deleted successfully!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Make-up Lessons Functions
async function loadMakeupLessons() {
    try {
        const lessons = await api('/makeup/upcoming');
        const container = document.getElementById('makeup-lessons-dashboard');
        
        if (lessons.length === 0) {
            container.innerHTML = '<p class="info-text">No upcoming make-up lessons</p>';
            return;
        }
        
        let html = '';
        lessons.forEach(lesson => {
            html += `
                <div class="makeup-lesson-item">
                    <h4>${escapeHtml(lesson.student_name)}</h4>
                    <div class="lesson-info">📅 ${new Date(lesson.scheduled_date + 'T00:00:00').toLocaleDateString()}</div>
                    <div class="lesson-info">🏫 ${escapeHtml(lesson.class_name)}</div>
                    ${lesson.scheduled_time ? `<div class="lesson-info">🕐 ${escapeHtml(lesson.scheduled_time)}</div>` : ''}
                    ${lesson.reason ? `<div class="lesson-info">📝 ${escapeHtml(lesson.reason)}</div>` : ''}
                    <div class="lesson-actions">
                        <button class="btn btn-small btn-success" onclick="completeMakeupLesson(${lesson.id})">Complete</button>
                        <button class="btn btn-small btn-danger" onclick="cancelMakeupLesson(${lesson.id})">Cancel</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading makeup lessons:', error);
        document.getElementById('makeup-lessons-dashboard').innerHTML = '<p class="info-text error">Error loading make-up lessons</p>';
    }
}

async function showMakeupLessonForm() {
    const content = `
        <form id="makeup-lesson-form">
            <div class="form-group">
                <label>Student *</label>
                <select id="makeup-student" required class="form-control"></select>
            </div>
            <div class="form-group">
                <label>Class *</label>
                <select id="makeup-class" required class="form-control"></select>
            </div>
            <div class="form-group">
                <label>Scheduled Date *</label>
                <input type="date" id="makeup-date" required class="form-control">
            </div>
            <div class="form-group">
                <label>Scheduled Time</label>
                <input type="time" id="makeup-time" class="form-control">
            </div>
            <div class="form-group">
                <label>Reason</label>
                <textarea id="makeup-reason" rows="2" class="form-control"></textarea>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="makeup-notes" rows="2" class="form-control"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Schedule Make-up Lesson</button>
        </form>
    `;
    
    showModal('Schedule Make-up Lesson', content);
    
    // Populate dropdowns
    const studentSelect = document.getElementById('makeup-student');
    const classSelect = document.getElementById('makeup-class');
    
    students.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.name;
        studentSelect.appendChild(option);
    });
    
    classes.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name;
        classSelect.appendChild(option);
    });
    
    document.getElementById('makeup-lesson-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            student_id: document.getElementById('makeup-student').value,
            class_id: document.getElementById('makeup-class').value,
            scheduled_date: document.getElementById('makeup-date').value,
            scheduled_time: document.getElementById('makeup-time').value,
            reason: document.getElementById('makeup-reason').value,
            notes: document.getElementById('makeup-notes').value
        };
        
        try {
            await api('/makeup', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            closeModal();
            loadMakeupLessons();
            alert('Make-up lesson scheduled successfully!');
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
}

async function completeMakeupLesson(id) {
    if (!confirm('Mark this make-up lesson as completed?')) return;
    
    try {
        await api(`/makeup/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'completed' })
        });
        
        loadMakeupLessons();
        // Refresh makeup page if we're on it
        const makeupPage = document.getElementById('makeup-page');
        if (makeupPage && makeupPage.classList.contains('active')) {
            const filterBtn = document.getElementById('filter-makeup-btn');
            if (filterBtn) filterBtn.click();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function cancelMakeupLesson(id) {
    if (!confirm('Cancel this make-up lesson?')) return;
    
    try {
        await api(`/makeup/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'cancelled' })
        });
        
        loadMakeupLessons();
        // Refresh makeup page if we're on it
        const makeupPage = document.getElementById('makeup-page');
        if (makeupPage && makeupPage.classList.contains('active')) {
            const filterBtn = document.getElementById('filter-makeup-btn');
            if (filterBtn) filterBtn.click();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Update loadDashboard to include makeup lessons
const originalLoadDashboard = loadDashboard;
loadDashboard = async function() {
    await originalLoadDashboard();
    await loadMakeupLessons();
};

// Update navigateToPage to handle new pages
const originalNavigateToPage = navigateToPage;
navigateToPage = function(page) {
    originalNavigateToPage(page);
    
    if (page === 'students-profile') {
        loadStudentProfiles();
        // Populate class filter
        const classFilter = document.getElementById('student-class-filter');
        classFilter.innerHTML = '<option value="">All Classes</option>';
        classes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.name;
            classFilter.appendChild(option);
        });
    } else if (page === 'makeup') {
        loadMakeupPage();
    } else if (page === 'database') {
        // Database page loaded on demand
    } else if (page === 'profile') {
        loadProfilePage();
    }
};
