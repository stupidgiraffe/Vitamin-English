// Global state
let currentUser = null;
let classes = [];
let students = [];
let teachers = [];

// Autosave mechanism for attendance
const AttendanceSaveQueue = {
    queue: new Map(), // key: "studentId-classId-date", value: { studentId, classId, date, status, time }
    saveTimeout: null,
    debounceDelay: 1500, // 1.5 seconds
    
    // Add item to queue and schedule save
    add(studentId, classId, date, status, time = null) {
        const key = `${studentId}-${classId}-${date}`;
        this.queue.set(key, { studentId, classId, date, status, time });
        
        // Show saving status
        this.updateSaveStatus('saving');
        
        // Clear existing timeout and set new one
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.processSave();
        }, this.debounceDelay);
    },
    
    // Process all queued saves
    async processSave() {
        if (this.queue.size === 0) return;
        
        const items = Array.from(this.queue.values());
        this.queue.clear();
        
        try {
            // Save all items
            const promises = items.map(item => 
                api('/attendance', {
                    method: 'POST',
                    body: JSON.stringify({
                        student_id: parseInt(item.studentId),
                        class_id: parseInt(item.classId),
                        date: item.date,
                        status: item.status,
                        time: item.time
                    })
                })
            );
            
            await Promise.all(promises);
            
            // Show saved status
            this.updateSaveStatus('saved');
            
            // Hide badge after 2 seconds
            setTimeout(() => {
                this.hideSaveStatus();
            }, 2000);
            
        } catch (error) {
            console.error('Error saving attendance:', error);
            Toast.error('Failed to save some attendance changes');
            // Show error state and keep it visible
            this.updateSaveStatus('error');
            // Hide badge after 4 seconds to give user time to see error
            setTimeout(() => {
                this.hideSaveStatus();
            }, 4000);
        }
    },
    
    // Update save status badge
    updateSaveStatus(status) {
        const badge = document.getElementById('save-status-badge');
        if (!badge) return;
        
        badge.style.display = 'flex';
        badge.className = 'save-status-badge ' + status;
        
        const icon = badge.querySelector('.status-icon');
        const text = badge.querySelector('.status-text');
        
        if (status === 'saving') {
            icon.textContent = '⏳';
            text.textContent = 'Saving...';
        } else if (status === 'saved') {
            icon.textContent = '✓';
            text.textContent = 'Saved';
        } else if (status === 'error') {
            icon.textContent = '✕';
            text.textContent = 'Save Failed';
        }
    },
    
    // Hide save status badge
    hideSaveStatus() {
        const badge = document.getElementById('save-status-badge');
        if (badge) {
            badge.style.display = 'none';
        }
    }
};

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

// Date normalization helper - ensures dates are in ISO format (YYYY-MM-DD)
function normalizeToISO(dateInput) {
    if (!dateInput) {
        return null;
    }

    let date;
    
    // If already a Date object
    if (dateInput instanceof Date) {
        date = dateInput;
    } 
    // If it's a string
    else if (typeof dateInput === 'string') {
        // Remove any time component if present
        const dateOnly = dateInput.split('T')[0].split(' ')[0];
        
        // Check if already in ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
            // Validate it's a real date
            date = new Date(dateOnly + 'T00:00:00');
        }
        // Check for MM/DD/YYYY format
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateOnly)) {
            const [month, day, year] = dateOnly.split('/');
            date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
        }
        // Check for DD-MM-YYYY format (hyphen-separated)
        else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateOnly)) {
            const [day, month, year] = dateOnly.split('-');
            date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
        }
        // Try parsing as-is
        else {
            date = new Date(dateOnly);
        }
    } else {
        return null;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return null;
    }

    // Return in ISO format (YYYY-MM-DD)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Calculate brightness and return appropriate text color for contrast
function getContrastTextColor(hexColor) {
    const r = parseInt(hexColor.substring(1, 3), 16);
    const g = parseInt(hexColor.substring(3, 5), 16);
    const b = parseInt(hexColor.substring(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000' : '#fff';
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
        
        // Load all teachers
        console.log('🔄 Loading teachers...');
        const teachersResponse = await fetch('/api/auth/teachers', {
            credentials: 'include'
        });
        
        let teachersData = [];
        if (teachersResponse.ok) {
            teachersData = await teachersResponse.json();
            console.log('✅ Teachers loaded:', teachersData.length, 'teachers');
        } else {
            console.warn('⚠️ Could not load teachers, falling back to class teachers');
            // Fallback: Get unique teachers from classes
            const teacherMap = new Map();
            classesData.forEach(cls => {
                if (cls.teacher_id && cls.teacher_name) {
                    teacherMap.set(cls.teacher_id, { id: cls.teacher_id, full_name: cls.teacher_name });
                }
            });
            teachersData = Array.from(teacherMap.values());
        }
        
        classes = classesData;
        students = studentsData;
        teachers = teachersData;

        populateClassSelects();
        populateTeacherSelects();
    } catch (error) {
        console.error('❌ Error loading initial data:', error);
        Toast.error('Failed to load initial data. Error: ' + error.message + '\n\nPlease check the browser console and server logs for details.');
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
    const selects = [
        document.getElementById('report-teacher'),
        document.getElementById('attendance-taken-by')
    ];
    
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
    else if (page === 'attendance') initializeAttendancePage();
    else if (page === 'database') initializeDatabasePage();
    else if (page === 'reports') initMultiClassView();
}

// Initialize attendance page with default date range (last 6 months)
function initializeAttendancePage() {
    const startDateInput = document.getElementById('attendance-start-date');
    const endDateInput = document.getElementById('attendance-end-date');
    
    // Only set defaults if inputs are empty
    if (!startDateInput.value || !endDateInput.value) {
        const { startDate, endDate } = getDefaultAttendanceDateRange();
        startDateInput.value = startDate;
        endDateInput.value = endDate;
    }
}

// Helper: Get default date range for attendance (last 6 months)
function getDefaultAttendanceDateRange() {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return {
        startDate: sixMonthsAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
    };
}

// Initialize database page to show recent records by default
async function initializeDatabasePage() {
    const container = document.getElementById('db-viewer-container');
    
    // Check if already loaded
    if (container.querySelector('.db-table')) {
        return;
    }
    
    const DEFAULT_DATABASE_DAYS_BACK = 30;
    
    // Set default date range (last 30 days)
    const today = new Date();
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - DEFAULT_DATABASE_DAYS_BACK);
    
    document.getElementById('db-search-start-date').value = daysAgo.toISOString().split('T')[0];
    document.getElementById('db-search-end-date').value = today.toISOString().split('T')[0];
    
    // Load recent attendance records by default
    try {
        container.innerHTML = '<p class="info-text">Loading recent records...</p>';
        document.getElementById('db-search-type').value = 'attendance';
        await searchDatabase();
    } catch (error) {
        console.error('Error loading initial database view:', error);
    }
}

// Dashboard
async function loadDashboard() {
    const todayClassesDiv = document.getElementById('today-classes');
    const recentActivityDiv = document.getElementById('recent-activity');
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    // Get today's day of week for schedule matching
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayDayName = dayNames[today.getDay()].toLowerCase();
    const todayDayAbbr = dayAbbr[today.getDay()].toLowerCase();
    
    // Helper function to check if class is scheduled for today
    function isScheduledForToday(schedule) {
        if (!schedule) return false;
        const scheduleLower = schedule.toLowerCase();
        return scheduleLower.includes(todayDayName) || scheduleLower.includes(todayDayAbbr);
    }
    
    // Helper function to extract time from schedule string
    function extractTimeFromSchedule(schedule) {
        if (!schedule) return null;
        // Look for time patterns like "10:00", "10:00-11:30", "10am", etc.
        const timeMatch = schedule.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
        if (timeMatch) {
            return timeMatch[0];
        }
        return null;
    }
    
    // Filter and sort classes scheduled for today
    const todayScheduledClasses = classes
        .filter(cls => isScheduledForToday(cls.schedule))
        .sort((a, b) => {
            const timeA = extractTimeFromSchedule(a.schedule) || '';
            const timeB = extractTimeFromSchedule(b.schedule) || '';
            return timeA.localeCompare(timeB);
        });
    
    const otherClasses = classes.filter(cls => !isScheduledForToday(cls.schedule));
    
    // Render today's classes with improved styling
    if (todayScheduledClasses.length > 0) {
        todayClassesDiv.innerHTML = `
            <div class="today-classes-list">
                ${todayScheduledClasses.map(cls => `
                    <div class="today-class-card" style="border-left: 4px solid ${cls.color || '#667eea'}">
                        <div class="today-class-header">
                            <span class="today-class-name" style="color: ${cls.color || '#667eea'}">${escapeHtml(cls.name)}</span>
                            <span class="today-class-time">${extractTimeFromSchedule(cls.schedule) || ''}</span>
                        </div>
                        <div class="today-class-details">
                            <span class="today-class-teacher">👤 ${escapeHtml(cls.teacher_name || 'No teacher')}</span>
                            <span class="today-class-schedule">📅 ${escapeHtml(cls.schedule || 'No schedule')}</span>
                        </div>
                        <div class="today-class-actions">
                            <button class="btn btn-small btn-primary" onclick="quickMarkAttendance(${cls.id}, '${todayISO}')">📊 Attendance</button>
                            <button class="btn btn-small btn-secondary" onclick="quickNewReport(${cls.id}, '${todayISO}')">📝 Report</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${otherClasses.length > 0 ? `
                <details class="other-classes-section">
                    <summary>Other Classes (${otherClasses.length})</summary>
                    <div class="other-classes-list">
                        ${otherClasses.map(cls => `
                            <div class="other-class-item">
                                <span style="color: ${cls.color || '#667eea'}">${escapeHtml(cls.name)}</span>
                                <small>${escapeHtml(cls.schedule || 'No schedule')}</small>
                            </div>
                        `).join('')}
                    </div>
                </details>
            ` : ''}
        `;
    } else {
        todayClassesDiv.innerHTML = `
            <p class="no-classes-today">No classes scheduled for ${dayNames[today.getDay()]}</p>
            ${classes.length > 0 ? `
                <details class="other-classes-section" open>
                    <summary>All Classes (${classes.length})</summary>
                    <div class="other-classes-list">
                        ${classes.map(cls => `
                            <div class="other-class-item">
                                <span style="color: ${cls.color || '#667eea'}">${escapeHtml(cls.name)}</span>
                                <small>${escapeHtml(cls.schedule || 'No schedule')}</small>
                            </div>
                        `).join('')}
                    </div>
                </details>
            ` : '<p>No classes available</p>'}
        `;
    }

    // Load weekly schedule view
    loadWeeklySchedule();

    // Recent activity
    try {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const reports = await api(`/reports?startDate=${weekAgo}&endDate=${todayISO}`);
        
        recentActivityDiv.innerHTML = reports.slice(0, 5).map(report => `
            <div class="recent-activity-item">
                <div class="activity-date">${escapeHtml(report.date)}</div>
                <div class="activity-class">${escapeHtml(report.class_name)}</div>
                <div class="activity-teacher">by ${escapeHtml(report.teacher_name)}</div>
            </div>
        `).join('') || '<p class="info-text">No recent activity</p>';
    } catch (error) {
        recentActivityDiv.innerHTML = '<p class="info-text">Unable to load recent activity</p>';
    }
}

// Load weekly schedule showing classes organized by day
function loadWeeklySchedule() {
    const weeklyScheduleDiv = document.getElementById('weekly-schedule');
    if (!weeklyScheduleDiv) return;
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayAbbr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    
    // Helper function to check if class is scheduled for a specific day
    function isScheduledForDay(schedule, dayIndex) {
        if (!schedule) return false;
        const scheduleLower = schedule.toLowerCase();
        return scheduleLower.includes(dayNames[dayIndex].toLowerCase()) || 
               scheduleLower.includes(dayAbbr[dayIndex]);
    }
    
    // Helper function to extract time from schedule string
    function extractTimeFromSchedule(schedule) {
        if (!schedule) return null;
        const timeMatch = schedule.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
        if (timeMatch) return timeMatch[0];
        return null;
    }
    
    // Organize classes by day
    const classesByDay = {};
    dayNames.forEach((day, index) => {
        classesByDay[day] = classes
            .filter(cls => isScheduledForDay(cls.schedule, index))
            .sort((a, b) => {
                const timeA = extractTimeFromSchedule(a.schedule) || '';
                const timeB = extractTimeFromSchedule(b.schedule) || '';
                return timeA.localeCompare(timeB);
            });
    });
    
    // Only show days with classes
    const daysWithClasses = dayNames.filter(day => classesByDay[day].length > 0);
    
    if (daysWithClasses.length === 0) {
        weeklyScheduleDiv.innerHTML = `
            <p class="info-text">No scheduled classes found. Add schedules to classes in Admin.</p>
            <button class="btn btn-small btn-secondary" onclick="goToClassScheduleAdmin()">
                Edit Class Schedules
            </button>
        `;
        return;
    }
    
    // Get current day for highlighting
    const today = new Date();
    const todayDayName = dayNames[today.getDay()];
    
    weeklyScheduleDiv.innerHTML = `
        <div class="weekly-schedule-container">
            ${daysWithClasses.map(day => `
                <div class="schedule-day ${day === todayDayName ? 'today' : ''}">
                    <div class="day-header ${day === todayDayName ? 'today' : ''}">
                        <span class="day-name">${day.substring(0, 3)}</span>
                        ${day === todayDayName ? '<span class="today-badge">Today</span>' : ''}
                    </div>
                    <div class="day-classes">
                        ${classesByDay[day].map(cls => `
                            <div class="schedule-class-item" style="border-left-color: ${cls.color || '#667eea'}">
                                <span class="schedule-class-name">${escapeHtml(cls.name)}</span>
                                <span class="schedule-class-time">${escapeHtml(extractTimeFromSchedule(cls.schedule) || '')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Helper function to navigate to admin classes tab
function goToClassScheduleAdmin() {
    navigateToPage('admin');
    // Use requestAnimationFrame to ensure page is rendered before clicking tab
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const classesTab = document.querySelector('[data-tab="classes"]');
            if (classesTab) {
                classesTab.click();
            }
        });
    });
}

// Quick action functions for dashboard
function quickMarkAttendance(classId, date) {
    document.getElementById('attendance-class-select').value = classId;
    document.getElementById('attendance-start-date').value = date;
    document.getElementById('attendance-end-date').value = date;
    navigateToPage('attendance');
    // Use requestAnimationFrame to ensure DOM is updated before loading attendance
    requestAnimationFrame(() => {
        requestAnimationFrame(() => loadAttendance());
    });
}

function quickNewReport(classId, date) {
    navigateToPage('reports');
    // Use requestAnimationFrame to ensure page navigation completes before setting values
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const classSelect = document.getElementById('reports-class-select');
            const reportDate = document.getElementById('report-date');
            if (classSelect && reportDate) {
                classSelect.value = classId;
                reportDate.value = date;
                showNewReport();
            }
        });
    });
}

// Attendance Management
document.getElementById('load-attendance-btn').addEventListener('click', loadAttendance);
document.getElementById('export-attendance-btn').addEventListener('click', exportAttendance);
document.getElementById('export-attendance-pdf-btn').addEventListener('click', exportAttendancePDF);
document.getElementById('new-attendance-btn')?.addEventListener('click', showNewAttendanceModal);
document.getElementById('add-date-btn')?.addEventListener('click', showAddDateModal);
document.getElementById('move-attendance-btn')?.addEventListener('click', showMoveAttendanceModal);
document.getElementById('use-schedule-btn')?.addEventListener('click', useScheduleForDates);

// View Toggle for Attendance
let currentAttendanceView = 'list'; // 'list' or 'grid'
let lastAttendanceData = null; // Store last loaded attendance data
let lastAttendanceClassId = null;

document.getElementById('view-list-btn')?.addEventListener('click', () => {
    if (currentAttendanceView !== 'list') {
        currentAttendanceView = 'list';
        document.getElementById('view-list-btn').classList.add('active');
        document.getElementById('view-grid-btn').classList.remove('active');
        if (lastAttendanceData && lastAttendanceClassId) {
            renderAttendanceTable(lastAttendanceData, lastAttendanceClassId);
        }
    }
});

document.getElementById('view-grid-btn')?.addEventListener('click', () => {
    if (currentAttendanceView !== 'grid') {
        currentAttendanceView = 'grid';
        document.getElementById('view-grid-btn').classList.add('active');
        document.getElementById('view-list-btn').classList.remove('active');
        if (lastAttendanceData && lastAttendanceClassId) {
            renderAttendanceGridView(lastAttendanceData, lastAttendanceClassId);
        }
    }
});

// Use class schedule to auto-fill dates
async function useScheduleForDates() {
    const classId = document.getElementById('attendance-class-select').value;
    
    if (!classId) {
        Toast.error('Please select a class first');
        return;
    }
    
    try {
        const startDateInput = document.getElementById('attendance-start-date');
        const endDateInput = document.getElementById('attendance-end-date');
        
        // Get current date range or use defaults
        const { startDate: defaultStart, endDate: defaultEnd } = getDefaultAttendanceDateRange();
        const startDate = startDateInput.value || defaultStart;
        const endDate = endDateInput.value || defaultEnd;
        
        // Fetch schedule-based dates
        const result = await api(`/attendance/schedule-dates?classId=${classId}&startDate=${startDate}&endDate=${endDate}`);
        
        if (result.dates && result.dates.length > 0) {
            Toast.success(`Found ${result.dates.length} dates based on schedule: ${result.schedule || 'N/A'}`);
            
            // Update date range inputs
            startDateInput.value = result.startDate;
            endDateInput.value = result.endDate;
            
            // Reload attendance with the schedule-based dates
            await loadAttendance();
        } else {
            Toast.info(`No schedule found for this class. Using custom date range instead.`);
        }
    } catch (error) {
        console.error('Error using schedule:', error);
        Toast.error('Failed to load schedule-based dates');
    }
}

async function showNewAttendanceModal() {
    try {
        // Get list of classes
        const allClasses = await api('/classes');
        
        const classOptions = allClasses
            .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
            .join('');
        
        const today = new Date().toISOString().split('T')[0];
        
        showModal('New Attendance Sheet', `
            <form id="new-attendance-form">
                <div class="form-group">
                    <label for="attendance-class">Class *</label>
                    <select id="attendance-class" class="form-control" required>
                        <option value="">Select a class...</option>
                        ${classOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="attendance-date">Date *</label>
                    <input type="date" id="attendance-date" class="form-control" value="${today}" required>
                </div>
                <div class="form-group">
                    <label for="attendance-notes">Notes (Optional)</label>
                    <textarea id="attendance-notes" class="form-control" rows="3"></textarea>
                </div>
                <button type="submit" class="btn btn-primary">Create Attendance Sheet</button>
            </form>
        `);
        
        document.getElementById('new-attendance-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const classId = document.getElementById('attendance-class').value;
                const date = document.getElementById('attendance-date').value;
                const notes = document.getElementById('attendance-notes').value;
                
                if (!classId || !date) {
                    Toast.error('Please select a class and date');
                    return;
                }
                
                // Normalize date to ISO format
                const normalizedDate = normalizeToISO(date);
                if (!normalizedDate) {
                    Toast.error('Invalid date format');
                    return;
                }
                
                // Get all students in the class
                const studentsInClass = await api(`/students?classId=${classId}`);
                
                if (studentsInClass.length === 0) {
                    Toast.error('No students in this class. Add students first.');
                    return;
                }
                
                // Create attendance records for all students in parallel
                const attendancePromises = studentsInClass.map(student => 
                    api('/attendance', {
                        method: 'POST',
                        body: JSON.stringify({ 
                            student_id: student.id,
                            class_id: classId, 
                            date: normalizedDate, 
                            status: '', // Empty status - to be filled in
                            notes: notes || ''
                        })
                    })
                );
                
                await Promise.all(attendancePromises);
                
                Toast.success(`Attendance sheet created for ${studentsInClass.length} students!`);
                closeModal();
                
                // Reload attendance if the same class is selected
                const currentClassId = document.getElementById('attendance-class-select').value;
                if (currentClassId === classId) {
                    await loadAttendance();
                }
            } catch (error) {
                console.error('Error creating attendance:', error);
                Toast.error('Failed to create attendance sheet');
            }
        });
    } catch (error) {
        console.error('Error showing new attendance modal:', error);
        Toast.error('Failed to load classes');
    }
}

async function loadAttendance() {
    const classId = document.getElementById('attendance-class-select').value;
    const startDate = document.getElementById('attendance-start-date').value;
    const endDate = document.getElementById('attendance-end-date').value;
    const container = document.getElementById('attendance-container');
    const metadataDiv = document.getElementById('attendance-metadata');
    const controlsDiv = document.getElementById('attendance-controls');

    if (!classId) {
        container.innerHTML = '<p class="info-text">Please select a class</p>';
        metadataDiv.style.display = 'none';
        controlsDiv.style.display = 'none';
        return;
    }

    try {
        container.innerHTML = '<div class="spinner"></div>';
        
        // Normalize dates to ISO format before sending to API
        const normalizedStartDate = startDate ? normalizeToISO(startDate) : '';
        const normalizedEndDate = endDate ? normalizeToISO(endDate) : '';
        
        // Validate date range
        if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
            Toast.error('Start date must be before or equal to end date');
            container.innerHTML = '<p class="info-text">Please select a valid date range</p>';
            metadataDiv.style.display = 'none';
            controlsDiv.style.display = 'none';
            return;
        }
        
        const data = await api(`/attendance/matrix?classId=${classId}${normalizedStartDate ? `&startDate=${normalizedStartDate}` : ''}${normalizedEndDate ? `&endDate=${normalizedEndDate}` : ''}`);
        
        if (data.students.length === 0) {
            container.innerHTML = '<p class="info-text">No students in this class</p>';
            metadataDiv.style.display = 'none';
            controlsDiv.style.display = 'none';
            return;
        }

        if (data.dates.length === 0) {
            container.innerHTML = '<p class="info-text">No attendance records found. Click on cells to mark attendance.</p>';
            // Still show the table with students
            data.dates = [new Date().toISOString().split('T')[0]];
        }

        // Update metadata display
        const selectedClass = classes.find(c => c.id == classId);
        if (selectedClass) {
            document.getElementById('metadata-class-name').textContent = selectedClass.name;
            document.getElementById('metadata-teacher').textContent = selectedClass.teacher_name || 'N/A';
        }
        
        const dateRangeText = normalizedStartDate && normalizedEndDate 
            ? `${normalizedStartDate} to ${normalizedEndDate}`
            : normalizedStartDate 
                ? `From ${normalizedStartDate}`
                : normalizedEndDate
                    ? `Until ${normalizedEndDate}`
                    : 'All dates';
        document.getElementById('metadata-date-range').textContent = dateRangeText;
        
        // Update student count metadata
        const regularCount = data.students.filter(s => s.student_type === 'regular').length;
        const trialCount = data.students.filter(s => s.student_type !== 'regular').length;
        const studentCountText = trialCount > 0 
            ? `${data.students.length} (${regularCount} regular, ${trialCount} trial/makeup)`
            : `${data.students.length}`;
        document.getElementById('metadata-student-count').textContent = studentCountText;
        
        metadataDiv.style.display = 'grid';
        controlsDiv.style.display = 'flex';

        // Store data for view switching
        lastAttendanceData = data;
        lastAttendanceClassId = classId;

        // Render based on current view mode
        if (currentAttendanceView === 'grid') {
            renderAttendanceGridView(data, classId);
        } else {
            renderAttendanceTable(data, classId);
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        container.innerHTML = '<p class="info-text">Unable to load attendance. Please try again.</p>';
        metadataDiv.style.display = 'none';
        controlsDiv.style.display = 'none';
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
        // Normalize date to ensure it's in ISO format
        const normalizedDate = normalizeToISO(date) || date;
        
        // Safely parse date for display - handle invalid dates gracefully
        let formattedDate;
        try {
            const dateObj = new Date(normalizedDate + 'T00:00:00');
            if (!isNaN(dateObj.getTime())) {
                formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                // Fallback: display raw date string if invalid
                formattedDate = normalizedDate;
                console.warn('Invalid date encountered:', date, '-> normalized to:', normalizedDate);
            }
        } catch (e) {
            // Fallback: display raw date string if parsing fails
            formattedDate = normalizedDate;
            console.error('Error parsing date:', date, e);
        }
        
        html += `<th>${formattedDate}</th>`;
    });
    
    html += '</tr></thead><tbody>';

    // Regular students section
    if (regularStudents.length > 0) {
        html += '<tr><td colspan="' + (dates.length + 1) + '" class="student-type-header">Regular Students</td></tr>';
        regularStudents.forEach(student => {
            const rowClass = student.color_code ? `student-row-${student.color_code}` : '';
            html += `<tr class="${rowClass}"><td class="student-name">
                <div class="student-name-cell">
                    <span>${escapeHtml(student.name)}</span>
                    <button class="edit-student-btn" onclick="editStudentFromAttendance(${student.id})" title="Edit student" aria-label="Edit ${escapeHtml(student.name)}">✏️</button>
                </div>
            </td>`;
            
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
            html += `<tr class="student-row-trial"><td class="student-name">
                <div class="student-name-cell">
                    <span>${escapeHtml(student.name)}</span>
                    <button class="edit-student-btn" onclick="editStudentFromAttendance(${student.id})" title="Edit student" aria-label="Edit ${escapeHtml(student.name)}">✏️</button>
                </div>
            </td>`;
            
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

// Render attendance data in a compact grid view optimized for multi-date display
function renderAttendanceGridView(data, classId) {
    const container = document.getElementById('attendance-container');
    const { students, dates, attendance } = data;

    // Separate regular and trial students
    const regularStudents = students.filter(s => s.student_type === 'regular');
    const trialStudents = students.filter(s => s.student_type !== 'regular');

    // Calculate attendance statistics
    const getStats = (studentList) => {
        return studentList.map(student => {
            let present = 0, absent = 0, partial = 0, unmarked = 0;
            dates.forEach(date => {
                const key = `${student.id}-${date}`;
                const status = attendance[key] || '';
                if (status === 'O') present++;
                else if (status === 'X') absent++;
                else if (status === '/') partial++;
                else unmarked++;
            });
            const total = dates.length;
            const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
            return { ...student, present, absent, partial, unmarked, total, attendanceRate };
        });
    };

    const regularWithStats = getStats(regularStudents);
    const trialWithStats = getStats(trialStudents);

    let html = `
        <div class="attendance-grid-view">
            <div class="grid-legend">
                <span class="legend-item"><span class="legend-color present">O</span> Present</span>
                <span class="legend-item"><span class="legend-color absent">X</span> Absent</span>
                <span class="legend-item"><span class="legend-color partial">/</span> Partial</span>
            </div>
            <div class="grid-container">
    `;

    // Function to render student grid cards
    const renderStudentCards = (studentList, sectionTitle) => {
        if (studentList.length === 0) return '';
        
        let sectionHtml = `
            <div class="grid-section">
                <h4 class="grid-section-title">${sectionTitle}</h4>
                <div class="grid-cards">
        `;
        
        studentList.forEach(student => {
            const rateClass = student.attendanceRate >= 80 ? 'good' : student.attendanceRate >= 60 ? 'warning' : 'poor';
            
            sectionHtml += `
                <div class="student-grid-card ${student.color_code ? `student-card-${student.color_code}` : ''}">
                    <div class="student-card-header">
                        <span class="student-card-name">${escapeHtml(student.name)}</span>
                        <span class="student-card-rate ${rateClass}">${student.attendanceRate}%</span>
                    </div>
                    <div class="student-card-stats">
                        <span class="stat present" title="Present">${student.present} ✓</span>
                        <span class="stat absent" title="Absent">${student.absent} ✗</span>
                        <span class="stat partial" title="Partial">${student.partial} ~</span>
                    </div>
                    <div class="student-card-dates">
                        ${dates.slice(0, 10).map(date => {
                            const key = `${student.id}-${date}`;
                            const status = attendance[key] || '';
                            const statusClass = status === 'O' ? 'present' : status === 'X' ? 'absent' : status === '/' ? 'partial' : 'empty';
                            // Append 'T00:00:00' to parse date as local midnight, avoiding timezone shifts
                            const dateObj = new Date(date + 'T00:00:00');
                            const shortDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                            return `<span class="date-cell ${statusClass}" title="${shortDate}: ${status || 'N/A'}">${status || '·'}</span>`;
                        }).join('')}
                        ${dates.length > 10 ? `<span class="more-dates">+${dates.length - 10}</span>` : ''}
                    </div>
                    <div class="student-card-actions">
                        <button class="btn btn-small btn-secondary" onclick="viewStudentDetail(${student.id}, '${classId}')" title="View details">📊</button>
                        <button class="btn btn-small btn-secondary" onclick="editStudentFromAttendance(${student.id})" title="Edit student">✏️</button>
                    </div>
                </div>
            `;
        });
        
        sectionHtml += '</div></div>';
        return sectionHtml;
    };

    html += renderStudentCards(regularWithStats, 'Regular Students');
    html += renderStudentCards(trialWithStats, 'Make-up / Trial Students');

    // Summary section
    const totalPresent = [...regularWithStats, ...trialWithStats].reduce((sum, s) => sum + s.present, 0);
    const totalAbsent = [...regularWithStats, ...trialWithStats].reduce((sum, s) => sum + s.absent, 0);
    const totalPartial = [...regularWithStats, ...trialWithStats].reduce((sum, s) => sum + s.partial, 0);

    html += `
            </div>
            <div class="grid-summary">
                <div class="summary-stat">
                    <span class="summary-label">Total Students</span>
                    <span class="summary-value">${students.length}</span>
                </div>
                <div class="summary-stat">
                    <span class="summary-label">Date Range</span>
                    <span class="summary-value">${dates.length} days</span>
                </div>
                <div class="summary-stat present">
                    <span class="summary-label">Present Records</span>
                    <span class="summary-value">${totalPresent}</span>
                </div>
                <div class="summary-stat absent">
                    <span class="summary-label">Absent Records</span>
                    <span class="summary-value">${totalAbsent}</span>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// View student attendance detail (popup with full history)
async function viewStudentDetail(studentId, classId) {
    try {
        const student = students.find(s => s.id == studentId) || await api(`/students/${studentId}`);
        const attendanceData = await api(`/attendance?studentId=${studentId}&classId=${classId}`);
        
        const sortedAttendance = attendanceData.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        showModal(`Attendance History: ${escapeHtml(student.name)}`, `
            <div class="student-detail-modal">
                <div class="student-info-summary">
                    <p><strong>Class:</strong> ${escapeHtml(student.class_name || 'N/A')}</p>
                    <p><strong>Type:</strong> ${escapeHtml(student.student_type || 'regular')}</p>
                </div>
                <div class="attendance-history-list">
                    ${sortedAttendance.length > 0 ? sortedAttendance.map(record => `
                        <div class="history-item ${record.status === 'O' ? 'present' : record.status === 'X' ? 'absent' : record.status === '/' ? 'partial' : ''}">
                            <span class="history-date">${escapeHtml(record.date)}</span>
                            <span class="history-status">${record.status === 'O' ? 'Present' : record.status === 'X' ? 'Absent' : record.status === '/' ? 'Partial' : 'N/A'}</span>
                        </div>
                    `).join('') : '<p class="info-text">No attendance records found</p>'}
                </div>
            </div>
        `);
    } catch (error) {
        console.error('Error loading student detail:', error);
        Toast.error('Failed to load student details');
    }
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

    // Get time from metadata field if available
    const timeInput = document.getElementById('attendance-time');
    let time = timeInput ? timeInput.value.trim() : null;
    
    // Validate time format if provided (HH:MM or H:MM)
    if (time) {
        const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timePattern.test(time)) {
            Toast.error('Invalid time format. Please use HH:MM format (e.g., 14:00)');
            return;
        }
    }

    // Optimistic UI update - update immediately without waiting for server
    cell.textContent = newStatus;
    cell.className = 'attendance-cell';
    if (newStatus === 'O') cell.classList.add('present');
    else if (newStatus === 'X') cell.classList.add('absent');
    else if (newStatus === '/') cell.classList.add('partial');

    try {
        // Normalize date to ISO format before queueing
        const normalizedDate = normalizeToISO(date) || date;
        
        // Add to save queue with debouncing
        AttendanceSaveQueue.add(studentId, classId, normalizedDate, newStatus, time);
        
    } catch (error) {
        console.error('Error updating attendance:', error);
        Toast.error('Failed to update attendance');
    }
}

// Edit student from attendance sheet - opens modal and reloads attendance after save
async function editStudentFromAttendance(studentId) {
    try {
        const student = await api(`/students/${studentId}`);
        
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
                <button type="submit" class="btn btn-primary">Update Student</button>
            </form>
        `);

        document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                await api(`/students/${studentId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: document.getElementById('edit-student-name').value,
                        class_id: document.getElementById('edit-student-class').value || null,
                        student_type: document.getElementById('edit-student-type').value,
                        color_code: document.getElementById('edit-student-color').value,
                        email: document.getElementById('edit-student-email').value || null,
                        phone: document.getElementById('edit-student-phone').value || null,
                        active: 1
                    })
                });

                Toast.success('Student updated successfully');
                closeModal();
                
                // Reload attendance table to reflect changes
                await loadInitialData();
                await loadAttendance();
            } catch (error) {
                console.error('Error updating student:', error);
                Toast.error('Failed to update student');
            }
        });
    } catch (error) {
        console.error('Error loading student:', error);
        Toast.error('Failed to load student');
    }
}

function exportAttendance() {
    const table = document.querySelector('.attendance-table');
    if (!table) {
        Toast.error('No attendance data to export');
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

async function exportAttendancePDF() {
    const classId = document.getElementById('attendance-class-select').value;
    const startDate = document.getElementById('attendance-start-date').value;
    const endDate = document.getElementById('attendance-end-date').value;
    
    if (!classId) {
        Toast.error('Please select a class first');
        return;
    }
    
    if (!startDate || !endDate) {
        Toast.error('Please select both start and end dates');
        return;
    }
    
    try {
        // Normalize dates to ISO format before sending to API
        const normalizedStartDate = normalizeToISO(startDate);
        const normalizedEndDate = normalizeToISO(endDate);
        
        if (!normalizedStartDate || !normalizedEndDate) {
            Toast.error('Invalid date format');
            return;
        }
        
        Toast.info('Generating PDF...', 'Please wait');
        
        const response = await api(`/pdf/attendance-grid/${classId}`, {
            method: 'POST',
            body: JSON.stringify({ 
                startDate: normalizedStartDate, 
                endDate: normalizedEndDate 
            })
        });
        
        if (response.success && response.downloadUrl) {
            Toast.success('PDF generated successfully!');
            
            // Open download URL in new tab
            window.open(response.downloadUrl, '_blank');
        } else {
            Toast.error('Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error generating attendance PDF:', error);
        if (error.message.includes('not configured')) {
            Toast.error('PDF export requires Cloudflare R2 configuration. Please contact administrator.', 'Configuration Required');
        } else {
            Toast.error('Error generating PDF: ' + error.message);
        }
    }
}

// Add a new date column to attendance sheet
function showAddDateModal() {
    const classId = document.getElementById('attendance-class-select').value;
    
    if (!classId) {
        Toast.error('Please select a class first');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    showModal('Add New Date', `
        <form id="add-date-form">
            <div class="form-group">
                <label>Select Date *</label>
                <input type="date" id="new-date-input" class="form-control" value="${today}" required>
            </div>
            <p class="info-text">This will add a new date column to the attendance sheet. You can then mark attendance for this date.</p>
            <button type="submit" class="btn btn-primary">Add Date</button>
        </form>
    `);
    
    document.getElementById('add-date-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newDate = document.getElementById('new-date-input').value;
        const normalizedDate = normalizeToISO(newDate);
        
        if (!normalizedDate) {
            Toast.error('Invalid date format');
            return;
        }
        
        try {
            // Just reload with the new date in the range
            const currentStartDate = document.getElementById('attendance-start-date').value;
            const currentEndDate = document.getElementById('attendance-end-date').value;
            
            // Expand the date range to include the new date
            const newDateObj = new Date(normalizedDate);
            const startDateObj = currentStartDate ? new Date(currentStartDate) : newDateObj;
            const endDateObj = currentEndDate ? new Date(currentEndDate) : newDateObj;
            
            if (newDateObj < startDateObj) {
                document.getElementById('attendance-start-date').value = normalizedDate;
            }
            if (newDateObj > endDateObj) {
                document.getElementById('attendance-end-date').value = normalizedDate;
            }
            
            closeModal();
            await loadAttendance();
            Toast.success(`Date ${normalizedDate} added to attendance sheet`);
        } catch (error) {
            console.error('Error adding date:', error);
            Toast.error('Failed to add date');
        }
    });
}

// Move attendance records from one date to another
function showMoveAttendanceModal() {
    const classId = document.getElementById('attendance-class-select').value;
    
    if (!classId) {
        Toast.error('Please select a class first');
        return;
    }
    
    showModal('Move Attendance Records', `
        <form id="move-attendance-form">
            <div class="form-group">
                <label>From Date *</label>
                <input type="date" id="move-from-date" class="form-control" required>
            </div>
            <div class="form-group">
                <label>To Date *</label>
                <input type="date" id="move-to-date" class="form-control" required>
            </div>
            <div class="warning-box">
                <strong>⚠️ Warning:</strong> This will move ALL attendance records from the source date to the target date for this class. The source date records will be deleted. This action cannot be undone.
            </div>
            <button type="submit" class="btn btn-primary">Move Attendance</button>
        </form>
    `);
    
    document.getElementById('move-attendance-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fromDate = document.getElementById('move-from-date').value;
        const toDate = document.getElementById('move-to-date').value;
        
        const normalizedFromDate = normalizeToISO(fromDate);
        const normalizedToDate = normalizeToISO(toDate);
        
        if (!normalizedFromDate || !normalizedToDate) {
            Toast.error('Invalid date format');
            return;
        }
        
        if (normalizedFromDate === normalizedToDate) {
            Toast.error('Source and target dates must be different');
            return;
        }
        
        try {
            await api('/attendance/move', {
                method: 'POST',
                body: JSON.stringify({
                    class_id: parseInt(classId),
                    from_date: normalizedFromDate,
                    to_date: normalizedToDate
                })
            });
            
            closeModal();
            await loadAttendance();
            Toast.success(`Attendance records moved from ${normalizedFromDate} to ${normalizedToDate}`);
        } catch (error) {
            console.error('Error moving attendance:', error);
            Toast.error('Failed to move attendance: ' + error.message);
        }
    });
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
    document.getElementById('export-report-pdf-btn').style.display = 'none';
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
        Toast.error('Please select a class and date');
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
            document.getElementById('export-report-pdf-btn').style.display = 'inline-block';
            document.getElementById('report-form-container').style.display = 'block';
            document.getElementById('reports-list-container').style.display = 'none';
        } else {
            // Create new report with pre-filled data
            document.getElementById('report-form').reset();
            document.getElementById('report-id').value = '';
            document.getElementById('report-form-date').value = date;
            document.getElementById('report-class').value = classId;
            document.getElementById('delete-report-btn').style.display = 'none';
            document.getElementById('export-report-pdf-btn').style.display = 'none';
            document.getElementById('report-form-container').style.display = 'block';
            document.getElementById('reports-list-container').style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading report:', error);
        Toast.error('Error loading report: ' + error.message);
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

        Toast.success('Report saved successfully!');
        document.getElementById('report-form-container').style.display = 'none';
        document.getElementById('reports-list-container').style.display = 'block';
        loadReportsList();
    } catch (error) {
        Toast.error('Error saving report: ' + error.message);
    }
});

document.getElementById('delete-report-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    const reportId = document.getElementById('report-id').value;
    
    try {
        await api(`/reports/${reportId}`, { method: 'DELETE' });
        Toast.success('Report deleted successfully!');
        document.getElementById('report-form-container').style.display = 'none';
        document.getElementById('reports-list-container').style.display = 'block';
        loadReportsList();
    } catch (error) {
        Toast.error('Error deleting report: ' + error.message);
    }
});

document.getElementById('export-report-pdf-btn').addEventListener('click', async () => {
    const reportId = document.getElementById('report-id').value;
    
    if (!reportId) {
        Toast.error('Please save the report first before exporting to PDF');
        return;
    }
    
    try {
        Toast.info('Generating PDF...', 'Please wait');
        
        const response = await api(`/pdf/lesson-report/${reportId}`, {
            method: 'POST'
        });
        
        if (response.success && response.downloadUrl) {
            Toast.success('PDF generated successfully!');
            
            // Open download URL in new tab
            window.open(response.downloadUrl, '_blank');
        } else {
            Toast.error('Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error generating lesson report PDF:', error);
        if (error.message.includes('not configured')) {
            Toast.error('PDF export requires Cloudflare R2 configuration. Please contact administrator.', 'Configuration Required');
        } else {
            Toast.error('Error generating PDF: ' + error.message);
        }
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
        Toast.error('Error loading report: ' + error.message);
    }
}

// Multi-Class Report View Functions
let selectedClasses = [];
let multiClassReports = [];

async function initMultiClassView() {
    try {
        const classes = await api('/classes');
        const container = document.getElementById('multi-class-selector');
        
        const colors = ['blue', 'green', 'purple', 'orange', 'teal'];
        
        container.innerHTML = classes.map((cls, index) => `
            <div class="multi-select-item" data-class-id="${cls.id}" data-color="${colors[index % colors.length]}">
                <input type="checkbox" id="class-${cls.id}" value="${cls.id}">
                <label for="class-${cls.id}">${cls.name}</label>
            </div>
        `).join('');
        
        // Add event listeners to checkboxes
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const classId = parseInt(this.value);
                const item = this.closest('.multi-select-item');
                
                if (this.checked) {
                    selectedClasses.push({
                        id: classId,
                        name: this.nextElementSibling.textContent,
                        color: item.dataset.color
                    });
                    item.classList.add('selected');
                } else {
                    selectedClasses = selectedClasses.filter(c => c.id !== classId);
                    item.classList.remove('selected');
                }
            });
        });
        
        // Set default date range (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        document.getElementById('multi-start-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('multi-end-date').value = endDate.toISOString().split('T')[0];
        
    } catch (error) {
        console.error('Error initializing multi-class view:', error);
        Toast.error('Error loading classes: ' + error.message);
    }
}

async function loadMultiClassReports() {
    if (selectedClasses.length === 0) {
        Toast.warning('Please select at least one class');
        return;
    }
    
    const startDate = document.getElementById('multi-start-date').value;
    const endDate = document.getElementById('multi-end-date').value;
    
    if (!startDate || !endDate) {
        Toast.warning('Please select date range');
        return;
    }
    
    try {
        const grid = document.getElementById('multi-class-grid');
        grid.innerHTML = '<p class="info-text">Loading reports...</p>';
        
        // Fetch reports for all selected classes
        const reportsPromises = selectedClasses.map(cls => 
            api(`/reports?class_id=${cls.id}&start_date=${startDate}&end_date=${endDate}`)
                .then(reports => ({ classInfo: cls, reports }))
        );
        
        const classReports = await Promise.all(reportsPromises);
        multiClassReports = classReports;
        
        renderMultiClassGrid(classReports);
        
        // Show export button if we have reports
        const hasReports = classReports.some(cr => cr.reports.length > 0);
        document.getElementById('export-multi-pdf-btn').style.display = hasReports ? 'inline-block' : 'none';
        
    } catch (error) {
        console.error('Error loading multi-class reports:', error);
        Toast.error('Error loading reports: ' + error.message);
        document.getElementById('multi-class-grid').innerHTML = 
            '<p class="info-text">Error loading reports. Please try again.</p>';
    }
}

function renderMultiClassGrid(classReports) {
    const grid = document.getElementById('multi-class-grid');
    
    if (classReports.length === 0 || classReports.every(cr => cr.reports.length === 0)) {
        grid.innerHTML = '<p class="info-text">No reports found for selected classes in this date range</p>';
        return;
    }
    
    grid.innerHTML = classReports.map(({ classInfo, reports }) => {
        const sortedReports = reports.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentReports = sortedReports.slice(0, 5);
        
        return `
            <div class="class-card">
                <div class="class-card-header ${classInfo.color}">
                    <span class="class-name">${classInfo.name}</span>
                    <span class="report-count">${reports.length} report${reports.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="class-card-body">
                    <h4>Recent Reports:</h4>
                    <ul class="report-mini-list">
                        ${recentReports.length > 0 ? recentReports.map(report => `
                            <li class="report-mini-item ${!report.target_topic ? 'no-topic' : ''}" 
                                onclick="viewReportDetails(${report.id})">
                                <div class="report-mini-date">📅 ${report.date}</div>
                                <div class="report-mini-topic">
                                    ${report.target_topic || 'No topic specified'}
                                </div>
                            </li>
                        `).join('') : '<li class="info-text">No recent reports</li>'}
                    </ul>
                </div>
                <div class="class-card-footer">
                    <span style="font-size: 12px; color: var(--text-secondary);">
                        Teacher: ${reports[0]?.teacher_name || 'N/A'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function viewReportDetails(reportId) {
    // Switch to single report tab and load the report
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    
    document.querySelector('[data-tab="single-report"]').classList.add('active');
    document.getElementById('single-report-tab').classList.add('active');
    
    loadReportById(reportId);
}

async function exportMultiClassPDF() {
    if (multiClassReports.length === 0) {
        Toast.warning('No reports to export');
        return;
    }
    
    const startDate = document.getElementById('multi-start-date').value;
    const endDate = document.getElementById('multi-end-date').value;
    
    try {
        const btn = document.getElementById('export-multi-pdf-btn');
        btn.disabled = true;
        btn.textContent = '⏳ Generating PDF...';
        
        const response = await api('/pdf/multi-class-reports', {
            method: 'POST',
            body: JSON.stringify({
                classes: selectedClasses.map(c => c.id),
                startDate,
                endDate
            })
        });
        
        if (response.downloadUrl) {
            window.open(response.downloadUrl, '_blank');
            Toast.success(`PDF generated successfully! (${(response.size / 1024).toFixed(2)} KB)`);
        }
    } catch (error) {
        console.error('Error exporting multi-class PDF:', error);
        if (error.message.includes('not configured')) {
            Toast.error('PDF export requires Cloudflare R2 configuration. Please contact administrator.', 'Configuration Required');
        } else {
            Toast.error('Error generating PDF: ' + error.message);
        }
    } finally {
        const btn = document.getElementById('export-multi-pdf-btn');
        btn.disabled = false;
        btn.textContent = '📄 Export All as PDF';
    }
}

// Event listeners for multi-class view
document.getElementById('load-multi-reports-btn')?.addEventListener('click', loadMultiClassReports);
document.getElementById('export-multi-pdf-btn')?.addEventListener('click', exportMultiClassPDF);

// Initialize reports list
document.getElementById('report-date').value = new Date().toISOString().split('T')[0];

// Admin Section
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        // Activate selected tab
        e.target.classList.add('active');
        e.target.setAttribute('aria-selected', 'true');
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
                <label>Student Name *</label>
                <input type="text" id="student-name" required class="form-control" 
                       placeholder="Enter student's name" autofocus>
                <small class="form-hint">This is the only required field</small>
            </div>
            <div class="form-group">
                <label>Class (Optional)</label>
                <select id="student-class" class="form-control">
                    <option value="">Unassigned (can assign later)</option>
                    ${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
                </select>
                <small class="form-hint">You can assign the student to a class later</small>
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
                <label>Email (Optional)</label>
                <input type="email" id="student-email" class="form-control" 
                       placeholder="student@example.com">
            </div>
            <div class="form-group">
                <label>Phone (Optional)</label>
                <input type="tel" id="student-phone" class="form-control" 
                       placeholder="555-1234">
            </div>
            <div class="form-group">
                <label>Parent Name (Optional)</label>
                <input type="text" id="student-parent-name" class="form-control" 
                       placeholder="Parent's name">
                <small class="form-hint">All parent info is optional</small>
            </div>
            <div class="form-group">
                <label>Parent Phone (Optional)</label>
                <input type="tel" id="student-parent-phone" class="form-control" 
                       placeholder="555-5678">
            </div>
            <div class="form-group">
                <label>Parent Email (Optional)</label>
                <input type="email" id="student-parent-email" class="form-control" 
                       placeholder="parent@example.com">
            </div>
            <div class="form-group">
                <label>Enrollment Date (Optional)</label>
                <input type="date" id="student-enrollment-date" class="form-control date-picker">
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

            Toast.success('Student added successfully!');
            closeModal();
            await loadInitialData();
            await loadStudentsList();
        } catch (error) {
            // Error already shown by api() function
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
                Toast.error('Error updating student: ' + error.message);
            }
        });
    } catch (error) {
        Toast.error('Error loading student: ' + error.message);
    }
}

async function deleteStudent(id) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    try {
        await api(`/students/${id}`, { method: 'DELETE' });
        await loadInitialData();
        await loadStudentsList();
    } catch (error) {
        Toast.error('Error deleting student: ' + error.message);
    }
}

// Class Management
document.getElementById('add-class-btn').addEventListener('click', () => {
    showModal('Add Class', `
        <form id="class-form">
            <div class="form-group">
                <label>Class Name *</label>
                <input type="text" id="class-name" required class="form-control" 
                       placeholder="e.g., Beginners Monday 10am" autofocus>
                <small class="form-hint">Give your class a descriptive name</small>
            </div>
            <div class="form-group">
                <label>Teacher (Optional)</label>
                <select id="class-teacher" class="form-control">
                    <option value="">Current user (default)</option>
                    ${teachers.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('')}
                </select>
                <small class="form-hint">Defaults to you if not selected</small>
            </div>
            <div class="form-group">
                <label>Schedule (Optional)</label>
                <input type="text" id="class-schedule" class="form-control schedule-picker" 
                       placeholder="e.g., Mon/Wed 10:00-11:30 or Tuesday 2pm">
                <small class="form-hint">Can be updated anytime</small>
            </div>
            <div class="form-group">
                <label>Color (Optional)</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="color" id="class-color" value="#4285f4" class="form-control" 
                           style="width: 80px; height: 40px; cursor: pointer; border: 2px solid #ddd; border-radius: 4px;">
                    <span id="color-preview" style="padding: 8px 16px; border-radius: 4px; background: #4285f4; color: white; font-size: 12px;">Preview</span>
                </div>
                <small class="form-hint">Pick any color or leave default</small>
            </div>
            <button type="submit" class="btn btn-primary">Add Class</button>
        </form>
    `);

    // Add color picker preview update
    document.getElementById('class-color').addEventListener('input', (e) => {
        const color = e.target.value;
        const preview = document.getElementById('color-preview');
        preview.style.background = color;
        preview.style.color = getContrastTextColor(color);
    });

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

            Toast.success('Class created successfully!');
            closeModal();
            await loadInitialData();
            await loadClassesList();
        } catch (error) {
            // Error already shown by api() function
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
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="color" id="edit-class-color" value="${cls.color}" class="form-control"
                               style="width: 80px; height: 40px; cursor: pointer; border: 2px solid #ddd; border-radius: 4px;">
                        <span id="edit-color-preview" style="padding: 8px 16px; border-radius: 4px; background: ${cls.color}; color: white; font-size: 12px;">Preview</span>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Update Class</button>
            </form>
        `);

        // Add color picker preview update for edit form
        const editColorInput = document.getElementById('edit-class-color');
        const editPreview = document.getElementById('edit-color-preview');
        
        // Set initial text color based on brightness
        editPreview.style.color = getContrastTextColor(editColorInput.value);
        
        editColorInput.addEventListener('input', (e) => {
            const color = e.target.value;
            editPreview.style.background = color;
            editPreview.style.color = getContrastTextColor(color);
        });

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
                Toast.error('Error updating class: ' + error.message);
            }
        });
    } catch (error) {
        Toast.error('Error loading class: ' + error.message);
    }
}

async function deleteClass(id) {
    if (!confirm('Are you sure you want to delete this class?')) return;
    
    try {
        await api(`/classes/${id}`, { method: 'DELETE' });
        await loadInitialData();
        await loadClassesList();
    } catch (error) {
        Toast.error('Error deleting class: ' + error.message);
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
            Toast.error('Passwords do not match');
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
            Toast.success('Teacher added successfully!');
        } catch (error) {
            Toast.error('Error adding teacher: ' + error.message);
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
                Toast.error('Passwords do not match');
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
                Toast.success('Teacher updated successfully!');
            } catch (error) {
                Toast.error('Error updating teacher: ' + error.message);
            }
        });
    } catch (error) {
        Toast.error('Error loading teacher: ' + error.message);
    }
}

async function deleteTeacher(id) {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    
    try {
        await api(`/auth/teachers/${id}`, { method: 'DELETE' });
        await loadTeachersList();
        Toast.success('Teacher deleted successfully!');
    } catch (error) {
        Toast.error('Error deleting teacher: ' + error.message);
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

// Store current search state for pagination
let currentSearchState = {
    query: '',
    type: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 25
};

// Configuration for which entity types support actions
// Note: Database IDs start at 1 in this system (auto-increment primary keys)
const ENTITY_ACTION_CONFIG = {
    student: true,   // Supports view details and PDF export (student attendance)
    teacher: false,  // Teachers don't have individual PDFs
    class: true,     // Supports class attendance PDFs
    attendance: false, // Individual attendance records don't have PDFs
    report: true,    // Supports lesson report PDFs
    makeup: false    // Make-up lessons don't have individual PDFs
};

async function searchDatabase(page = 1) {
    const query = document.getElementById('db-search-input').value.trim();
    const type = document.getElementById('db-search-type').value;
    const startDate = document.getElementById('db-search-start-date').value;
    const endDate = document.getElementById('db-search-end-date').value;
    const container = document.getElementById('db-viewer-container');
    
    // Update search state
    currentSearchState = { query, type, startDate, endDate, page, limit: 25 };
    
    try {
        // Disable search button during request
        const searchBtn = document.getElementById('db-search-btn');
        const originalText = searchBtn ? searchBtn.textContent : '';
        if (searchBtn) {
            searchBtn.disabled = true;
            searchBtn.textContent = 'Searching...';
        }
        
        container.innerHTML = '<p class="info-text">Searching...</p>';
        
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (type) params.append('type', type);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('page', page);
        params.append('limit', currentSearchState.limit);
        
        const data = await api(`/database/search?${params.toString()}`);
        
        // Re-enable search button
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.textContent = originalText;
        }
        
        if (!data || !data.results || Object.keys(data.results).length === 0) {
            container.innerHTML = '<p class="info-text">No results found. Try adjusting your search criteria.</p>';
            return;
        }
        
        let html = '<div class="search-results">';
        
        // Display results grouped by type
        const results = data.results;
        
        // Helper function to render a table with clickable rows and actions
        function renderTable(title, rows, entityType, showActions = true) {
            if (!rows || rows.length === 0) return '';
            
            // Override showActions based on entity config
            showActions = ENTITY_ACTION_CONFIG[entityType] !== false && showActions;
            
            let html = `<h3>${title} (${rows.length})</h3>`;
            html += '<table class="db-table clickable-table"><thead><tr>';
            const cols = Object.keys(rows[0]);
            cols.forEach(col => html += `<th>${escapeHtml(col)}</th>`);
            if (showActions) {
                html += '<th class="actions-header">Actions</th>';
            }
            html += '</tr></thead><tbody>';
            
            rows.forEach(row => {
                const rowId = parseInt(row.id);
                // Skip rows without valid IDs
                if (isNaN(rowId) || rowId < 1) return;
                
                // Use data attributes instead of inline onclick for security
                html += `<tr class="clickable-row" data-type="${escapeHtml(entityType)}" data-id="${rowId}">`;
                cols.forEach(col => {
                    let value = row[col];
                    if (value === null) value = '<em>null</em>';
                    else if (typeof value === 'object') value = JSON.stringify(value);
                    html += `<td>${escapeHtml(String(value))}</td>`;
                });
                
                if (showActions) {
                    html += `<td class="table-actions">
                        <button class="btn btn-sm btn-primary detail-btn" data-type="${escapeHtml(entityType)}" data-id="${rowId}" title="View Details">👁️ View</button>
                        <button class="btn btn-sm btn-secondary pdf-btn" data-type="${escapeHtml(entityType)}" data-id="${rowId}" title="Export as PDF">📄 PDF</button>
                    </td>`;
                }
                html += '</tr>';
            });
            html += '</tbody></table><br>';
            return html;
        }
        
        // Render each entity type
        if (results.students && results.students.length > 0) {
            html += renderTable('Students', results.students, 'student');
        }
        
        if (results.teachers && results.teachers.length > 0) {
            html += renderTable('Teachers', results.teachers, 'teacher');
        }
        
        if (results.classes && results.classes.length > 0) {
            html += renderTable('Classes', results.classes, 'class');
        }
        
        if (results.attendance && results.attendance.length > 0) {
            html += renderTable('Attendance', results.attendance, 'attendance');
        }
        
        if (results.reports && results.reports.length > 0) {
            html += renderTable('Lesson Reports', results.reports, 'report');
        }
        
        if (results.makeup_lessons && results.makeup_lessons.length > 0) {
            html += renderTable('Make-up Lessons', results.makeup_lessons, 'makeup');
        }
        
        // Add pagination controls if available
        if (data.pagination) {
            const { page, totalPages, total, counts } = data.pagination;
            
            html += '<div class="pagination-info">';
            html += `<p>Showing page ${page} of ${totalPages} (${total} total results)</p>`;
            if (counts) {
                const countDetails = [];
                if (counts.students > 0) countDetails.push(`Students: ${counts.students}`);
                if (counts.teachers > 0) countDetails.push(`Teachers: ${counts.teachers}`);
                if (counts.classes > 0) countDetails.push(`Classes: ${counts.classes}`);
                if (counts.attendance > 0) countDetails.push(`Attendance: ${counts.attendance}`);
                if (counts.reports > 0) countDetails.push(`Reports: ${counts.reports}`);
                if (counts.makeup_lessons > 0) countDetails.push(`Make-up: ${counts.makeup_lessons}`);
                if (countDetails.length > 0) {
                    html += `<p class="count-details">${countDetails.join(' • ')}</p>`;
                }
            }
            html += '</div>';
            
            // Pagination controls
            if (totalPages > 1) {
                html += '<div class="pagination">';
                
                // Previous button
                html += `<button class="pagination-btn pagination-prev" ${page <= 1 ? 'disabled' : ''} 
                    data-page="${page - 1}">« Previous</button>`;
                
                // Page numbers
                const maxPageButtons = 5;
                let startPage = Math.max(1, page - Math.floor(maxPageButtons / 2));
                let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
                
                // Adjust start if we're near the end
                if (endPage - startPage < maxPageButtons - 1) {
                    startPage = Math.max(1, endPage - maxPageButtons + 1);
                }
                
                if (startPage > 1) {
                    html += `<button class="pagination-btn pagination-number" data-page="1">1</button>`;
                    if (startPage > 2) {
                        html += '<span class="pagination-ellipsis">...</span>';
                    }
                }
                
                for (let i = startPage; i <= endPage; i++) {
                    html += `<button class="pagination-btn pagination-number ${i === page ? 'active' : ''}" 
                        ${i === page ? 'disabled' : ''} 
                        data-page="${i}">${i}</button>`;
                }
                
                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                        html += '<span class="pagination-ellipsis">...</span>';
                    }
                    html += `<button class="pagination-btn pagination-number" data-page="${totalPages}">${totalPages}</button>`;
                }
                
                // Next button
                html += `<button class="pagination-btn pagination-next" ${page >= totalPages ? 'disabled' : ''} 
                    data-page="${page + 1}">Next »</button>`;
                
                html += '</div>';
            }
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Attach event listeners to clickable rows and action buttons
        // This is more secure than inline onclick handlers
        const clickableRows = container.querySelectorAll('.clickable-row');
        clickableRows.forEach(row => {
            row.addEventListener('click', (e) => {
                // Don't trigger row click if clicking on action buttons
                if (e.target.closest('.table-actions')) return;
                
                const type = row.getAttribute('data-type');
                const id = parseInt(row.getAttribute('data-id'));
                // Only proceed with valid positive integers
                if (type && !isNaN(id) && id > 0) {
                    openDetailModal(type, id);
                }
            });
        });
        
        // Attach event listeners to detail buttons
        const detailBtns = container.querySelectorAll('.detail-btn');
        detailBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.getAttribute('data-type');
                const id = parseInt(btn.getAttribute('data-id'));
                // Only proceed with valid positive integers
                if (type && !isNaN(id) && id > 0) {
                    openDetailModal(type, id);
                }
            });
        });
        
        // Attach event listeners to PDF export buttons
        const pdfBtns = container.querySelectorAll('.pdf-btn');
        pdfBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.getAttribute('data-type');
                const id = parseInt(btn.getAttribute('data-id'));
                // Only proceed with valid positive integers
                if (type && !isNaN(id) && id > 0) {
                    exportToPDF(type, id);
                }
            });
        });
        
        // Attach event listeners to pagination buttons
        const paginationBtns = container.querySelectorAll('.pagination-number, .pagination-prev, .pagination-next');
        paginationBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pageNum = parseInt(btn.getAttribute('data-page'));
                // Only proceed with valid page numbers
                if (!isNaN(pageNum) && pageNum > 0 && !btn.disabled) {
                    searchDatabase(pageNum);
                }
            });
        });
        
    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `<p class="info-text error">Error: ${escapeHtml(error.message)}</p>`;
        
        // Re-enable search button on error
        const searchBtn = document.getElementById('db-search-btn');
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.textContent = 'Search';
        }
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
        const hasActions = tableName === 'lesson_reports';
        
        let html = '<table class="db-table"><thead><tr>';
        
        columns.forEach(col => {
            html += `<th>${col}</th>`;
        });
        if (hasActions) {
            html += '<th>Actions</th>';
        }
        html += '</tr></thead><tbody>';
        
        result.data.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                let value = row[col];
                if (value === null) value = '<em>null</em>';
                else if (typeof value === 'object') value = JSON.stringify(value);
                html += `<td>${value}</td>`;
            });
            if (hasActions) {
                // Sanitize ID to prevent XSS
                const sanitizedId = parseInt(row.id);
                if (isNaN(sanitizedId)) {
                    console.error('Invalid row ID:', row.id);
                    html += '<td class="actions-cell">Invalid ID</td>';
                } else {
                    html += `<td class="actions-cell">
                        <button class="btn btn-small btn-primary" onclick="editReportFromDatabase(${sanitizedId})">Edit</button>
                        <button class="btn btn-small btn-danger" onclick="deleteReportFromDatabase(${sanitizedId})">Delete</button>
                    </td>`;
                }
            }
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="info-text error">Error: ${error.message}</p>`;
    }
}

// Edit report from database viewer - navigate to reports page and load the report
async function editReportFromDatabase(reportId) {
    try {
        // Navigate to reports page
        navigateToPage('reports');
        
        // Load the report
        await loadReportById(reportId);
        
        Toast.success('Report loaded for editing');
    } catch (error) {
        Toast.error('Failed to load report: ' + error.message);
    }
}

// Delete report from database viewer
async function deleteReportFromDatabase(reportId) {
    if (!confirm('Are you sure you want to delete this lesson report? This action cannot be undone.')) {
        return;
    }
    
    try {
        await api(`/reports/${reportId}`, { method: 'DELETE' });
        Toast.success('Report deleted successfully');
        
        // Reload the database table
        await loadDatabaseTable();
    } catch (error) {
        Toast.error('Failed to delete report: ' + error.message);
    }
}

function exportDatabaseTable() {
    const tableName = document.getElementById('db-table-select').value;
    const table = document.querySelector('.db-table');
    
    if (!table) {
        Toast.error('Please load data first');
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

// Detail Modal Functions
async function openDetailModal(type, id) {
    try {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        if (!modal || !modalTitle || !modalBody) {
            console.error('Modal elements not found');
            return;
        }
        
        // Show loading state
        modalTitle.textContent = 'Loading...';
        modalBody.innerHTML = '<p class="info-text">Loading details...</p>';
        modal.classList.add('active');
        
        // Fetch details based on type
        let data = null;
        let title = '';
        
        switch(type) {
            case 'student':
                data = await api(`/students/${id}`);
                title = `Student: ${data.name || 'Unknown'}`;
                modalBody.innerHTML = renderStudentDetails(data);
                break;
            case 'class':
                data = await api(`/classes/${id}`);
                title = `Class: ${data.name || 'Unknown'}`;
                modalBody.innerHTML = renderClassDetails(data);
                break;
            case 'report':
                data = await api(`/reports/${id}`);
                title = `Lesson Report - ${data.date || 'Unknown'}`;
                modalBody.innerHTML = renderReportDetails(data);
                break;
            default:
                modalBody.innerHTML = `<p class="info-text">Details not available for ${type}</p>`;
                title = 'Details';
        }
        
        modalTitle.textContent = title;
        
        // Add export PDF button for supported types
        if (['student', 'class', 'report'].includes(type)) {
            const exportBtn = document.createElement('button');
            exportBtn.className = 'btn btn-secondary';
            exportBtn.textContent = '📄 Export as PDF';
            exportBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                exportToPDF(type, id);
            });
            modalBody.appendChild(exportBtn);
        }
        
    } catch (error) {
        console.error('Error opening detail modal:', error);
        const modalBody = document.getElementById('modal-body');
        if (modalBody) {
            modalBody.innerHTML = `<p class="info-text error">Error loading details: ${escapeHtml(error.message)}</p>`;
        }
    }
}

// Helper functions to render entity details
function renderStudentDetails(student) {
    return `
        <div class="detail-view">
            <div class="detail-row"><strong>Name:</strong> ${escapeHtml(student.name || 'N/A')}</div>
            <div class="detail-row"><strong>Class:</strong> ${escapeHtml(student.class_name || 'N/A')}</div>
            <div class="detail-row"><strong>Active:</strong> ${student.active ? 'Yes' : 'No'}</div>
            <div class="detail-row"><strong>Type:</strong> ${escapeHtml(student.student_type || 'Regular')}</div>
            <div class="detail-row"><strong>Color:</strong> ${escapeHtml(student.color || 'None')}</div>
            ${student.notes ? `<div class="detail-row"><strong>Notes:</strong> ${escapeHtml(student.notes)}</div>` : ''}
            ${student.parent_name ? `<div class="detail-row"><strong>Parent:</strong> ${escapeHtml(student.parent_name)}</div>` : ''}
            ${student.contact_email ? `<div class="detail-row"><strong>Email:</strong> ${escapeHtml(student.contact_email)}</div>` : ''}
            ${student.contact_phone ? `<div class="detail-row"><strong>Phone:</strong> ${escapeHtml(student.contact_phone)}</div>` : ''}
        </div>
    `;
}

function renderClassDetails(classData) {
    return `
        <div class="detail-view">
            <div class="detail-row"><strong>Name:</strong> ${escapeHtml(classData.name || 'N/A')}</div>
            <div class="detail-row"><strong>Teacher:</strong> ${escapeHtml(classData.teacher_name || 'N/A')}</div>
            <div class="detail-row"><strong>Schedule:</strong> ${escapeHtml(classData.schedule || 'N/A')}</div>
            <div class="detail-row"><strong>Active:</strong> ${classData.active ? 'Yes' : 'No'}</div>
            ${classData.description ? `<div class="detail-row"><strong>Description:</strong> ${escapeHtml(classData.description)}</div>` : ''}
        </div>
    `;
}

function renderReportDetails(report) {
    return `
        <div class="detail-view">
            <div class="detail-row"><strong>Date:</strong> ${escapeHtml(report.date || 'N/A')}</div>
            <div class="detail-row"><strong>Class:</strong> ${escapeHtml(report.class_name || 'N/A')}</div>
            <div class="detail-row"><strong>Teacher:</strong> ${escapeHtml(report.teacher_name || 'N/A')}</div>
            ${report.target_topic ? `<div class="detail-row"><strong>Target/Topic:</strong> ${escapeHtml(report.target_topic)}</div>` : ''}
            ${report.vocabulary ? `<div class="detail-row"><strong>Vocabulary:</strong> ${escapeHtml(report.vocabulary)}</div>` : ''}
            ${report.mistakes ? `<div class="detail-row"><strong>Mistakes:</strong> ${escapeHtml(report.mistakes)}</div>` : ''}
            ${report.strengths ? `<div class="detail-row"><strong>Strengths:</strong> ${escapeHtml(report.strengths)}</div>` : ''}
            ${report.comments ? `<div class="detail-row"><strong>Comments:</strong> ${escapeHtml(report.comments)}</div>` : ''}
        </div>
    `;
}

// PDF Export Function
async function exportToPDF(type, id) {
    try {
        let endpoint = '';
        
        // Map entity types to PDF endpoints
        switch(type) {
            case 'student':
                endpoint = `/api/pdf/student-attendance/${id}`;
                break;
            case 'class':
                endpoint = `/api/pdf/class-attendance/${id}`;
                break;
            case 'report':
                endpoint = `/api/pdf/lesson-report/${id}`;
                break;
            default:
                Toast.error(`PDF export not available for ${type}`);
                return;
        }
        
        // Show loading toast
        Toast.info('Generating PDF...');
        
        // Open PDF in new tab
        window.open(endpoint, '_blank');
        
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        Toast.error('Failed to export PDF: ' + error.message);
    }
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
        Toast.error('Error loading student details: ' + error.message);
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
                Toast.success('Make-up lesson updated successfully!');
            } catch (error) {
                Toast.error('Error: ' + error.message);
            }
        });
    } catch (error) {
        Toast.error('Error loading makeup lesson: ' + error.message);
    }
}

async function deleteMakeupLesson(id) {
    if (!confirm('Are you sure you want to delete this make-up lesson?')) return;
    
    try {
        await api(`/makeup/${id}`, { method: 'DELETE' });
        document.getElementById('filter-makeup-btn').click();
        Toast.success('Make-up lesson deleted successfully!');
    } catch (error) {
        Toast.error('Error: ' + error.message);
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
            Toast.success('Make-up lesson scheduled successfully!');
        } catch (error) {
            Toast.error('Error: ' + error.message);
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
        Toast.error('Error: ' + error.message);
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
        Toast.error('Error: ' + error.message);
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

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Escape - Close modal
    if (e.key === 'Escape') {
        closeModal();
    }
    
    // Don't handle shortcuts when typing in inputs
    if (e.target.matches('input, textarea, select')) {
        return;
    }
    
    // N - New item (context-aware)
    if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const currentPage = getCurrentPage();
        if (currentPage === 'admin') {
            // Check if on classes or students subtab
            const classesTab = document.getElementById('admin-classes-tab');
            const studentsTab = document.getElementById('admin-students-tab');
            if (classesTab && classesTab.classList.contains('active')) {
                document.querySelector('[onclick*="showAddClassModal"]')?.click();
            } else if (studentsTab && studentsTab.classList.contains('active')) {
                document.querySelector('[onclick*="showAddStudentModal"]')?.click();
            }
        }
    }
});

// Get current active page
function getCurrentPage() {
    const pages = ['dashboard', 'attendance', 'reports', 'students-profile', 'makeup', 'database', 'admin', 'profile'];
    for (const page of pages) {
        const pageElement = document.getElementById(`${page}-page`);
        if (pageElement && pageElement.classList.contains('active')) {
            return page;
        }
    }
    return null;
}

// Inline Editing Helper
function makeEditable(element, saveCallback) {
    element.style.cursor = 'pointer';
    element.title = 'Click to edit';
    
    element.addEventListener('click', function(e) {
        e.stopPropagation();
        const originalValue = this.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalValue;
        input.className = 'inline-edit-input';
        
        // Replace text with input
        this.textContent = '';
        this.appendChild(input);
        input.focus();
        input.select();
        
        // Save on blur or enter
        const save = async () => {
            const newValue = input.value.trim();
            if (newValue && newValue !== originalValue) {
                try {
                    await saveCallback(newValue);
                    element.textContent = newValue;
                    Toast.success('Updated successfully');
                } catch (error) {
                    element.textContent = originalValue;
                    Toast.error('Failed to update');
                }
            } else {
                element.textContent = originalValue;
            }
        };
        
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                save();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                element.textContent = originalValue;
            }
        });
    });
}

// Initialize date/time pickers when modals are shown
function initializeDateTimePickers() {
    // Date pickers
    document.querySelectorAll('.date-picker').forEach(input => {
        if (!input._flatpickr) { // Don't reinitialize
            flatpickr(input, {
                dateFormat: 'Y-m-d',
                allowInput: true
            });
        }
    });
    
    // Time pickers
    document.querySelectorAll('.time-picker').forEach(input => {
        if (!input._flatpickr) {
            flatpickr(input, {
                enableTime: true,
                noCalendar: true,
                dateFormat: 'H:i',
                time_24hr: false,
                allowInput: true
            });
        }
    });
}

// Override showModal to initialize date pickers
const originalShowModal = showModal;
showModal = function(title, content) {
    originalShowModal(title, content);
    // Initialize date pickers after modal content is loaded
    // Use requestAnimationFrame for reliable DOM ready detection
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            initializeDateTimePickers();
        });
    });
};
