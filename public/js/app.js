// Global state
let currentUser = null;
let classes = [];
let students = [];
let teachers = [];

// Autosave mechanism for attendance
const AttendanceSaveQueue = {
    queue: new Map(), // key: "studentId-classId-date", value: { studentId, classId, date, status, time, teacherId }
    saveTimeout: null,
    debounceDelay: 1500, // 1.5 seconds
    
    // Add item to queue and schedule save
    add(studentId, classId, date, status, time = null, teacherId = null) {
        const key = `${studentId}-${classId}-${date}`;
        // Store teacherId as integer if provided
        const parsedTeacherId = teacherId ? parseInt(teacherId) : null;
        this.queue.set(key, { studentId, classId, date, status, time, teacherId: parsedTeacherId });
        
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
                        time: item.time,
                        teacher_id: item.teacherId // Already parsed to integer in add()
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
    activeToasts: new Map(), // Track active toasts by message+type
    
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    
    show(message, type = 'info', title = '', duration = 4000) {
        this.init();
        
        // Deduplicate: check if same message+type is already showing
        const toastKey = `${type}:${message}`;
        if (this.activeToasts.has(toastKey)) {
            // Don't show duplicate, just return existing toast
            return this.activeToasts.get(toastKey);
        }
        
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
        this.activeToasts.set(toastKey, toast);
        
        // Remove from tracking when toast is removed
        const removeToast = () => {
            this.activeToasts.delete(toastKey);
            toast.remove();
        };
        
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('hiding');
                setTimeout(removeToast, 300);
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
    },

    prompt(message, onYes, onNo) {
        this.init();
        const toast = document.createElement('div');
        toast.className = 'toast info';
        toast.innerHTML = `
            <div class="toast-icon">ℹ</div>
            <div class="toast-content">
                <div class="toast-title">Draft Found</div>
                <div class="toast-message">${escapeHtml(message)}</div>
                <div style="margin-top:8px;display:flex;gap:8px;">
                    <button class="btn btn-small btn-primary" id="toast-yes">Restore</button>
                    <button class="btn btn-small btn-secondary" id="toast-no">Discard</button>
                </div>
            </div>
        `;
        this.container.appendChild(toast);
        const remove = () => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); };
        toast.querySelector('#toast-yes').addEventListener('click', () => { remove(); onYes && onYes(); });
        toast.querySelector('#toast-no').addEventListener('click', () => { remove(); onNo && onNo(); });
        return toast;
    },

    // Part 4A: Undo toast
    undo(message, undoCallback, duration = 5000) {
        this.init();
        // Dismiss any existing undo toasts before showing a new one
        const existingUndos = this.container.querySelectorAll('.undo-toast');
        existingUndos.forEach(t => { t.classList.add('hiding'); setTimeout(() => t.remove(), 150); });
        const toast = document.createElement('div');
        toast.className = 'toast success undo-toast';
        toast.innerHTML = `
            <div class="toast-icon">✓</div>
            <div class="toast-content">
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="toast-undo-btn">Undo</button>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        this.container.appendChild(toast);
        let undone = false;
        const removeToast = () => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        };
        toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
            undone = true;
            removeToast();
            if (undoCallback) undoCallback();
        });
        if (duration > 0) {
            setTimeout(() => { if (!undone) removeToast(); }, duration);
        }
        return toast;
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

// Shared month abbreviations for consistent date formatting
const MONTH_ABBR = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June',
                    'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/**
 * Format a date in a readable format (e.g., "Feb. 7, 2026")
 * Uses Japan timezone to avoid GMT strings
 * @param {string|Date} dateInput - Date to format
 * @param {boolean} includeYear - Whether to include year (default: true)
 * @returns {string} Formatted date
 */
function formatDateReadable(dateInput, includeYear = true) {
    if (!dateInput) return '';
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        
        // Use Japan timezone
        const japanDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        const formatted = `${MONTH_ABBR[japanDate.getMonth()]} ${japanDate.getDate()}`;
        return includeYear ? `${formatted}, ${japanDate.getFullYear()}` : formatted;
    } catch (e) {
        return dateInput.toString().split('T')[0];
    }
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

/**
 * Mount an iro.js inline color wheel into `containerId` with the given initial
 * hex color.  Returns a getter function that always returns the current hex
 * value so the form submit can read it.
 *
 * @param {string} containerId  - id of the empty <div> to mount the wheel into
 * @param {string} initialColor - starting hex color (e.g. "#4285f4")
 * @param {function} onChange   - called with the new hex string whenever the
 *                                user moves the picker
 * @returns {function} getColor – call to get the currently selected hex string
 */
function initClassColorWheel(containerId, initialColor, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return () => initialColor;

    // Ensure the color is a safe hex string (prevents XSS when inserted into DOM/HTML)
    const safeInitialColor = /^#[0-9A-Fa-f]{3,8}$/.test(initialColor) ? initialColor : '#4285f4';

    // iro.js may not be loaded yet (CDN deferred) – fall back to a plain
    // color input so the form is never broken.
    if (typeof iro === 'undefined') {
        const inp = document.createElement('input');
        inp.type = 'color';
        inp.value = safeInitialColor;
        inp.style.cssText = 'width:100%;height:48px;cursor:pointer;border:2px solid #ddd;border-radius:4px;';
        container.appendChild(inp);
        inp.addEventListener('input', e => onChange && onChange(e.target.value));
        return () => inp.value;
    }

    let currentColor = safeInitialColor;

    const picker = new iro.ColorPicker(`#${containerId}`, {
        width: 220,
        color: safeInitialColor,
        borderWidth: 1,
        borderColor: '#ddd',
        layout: [
            { component: iro.ui.Box },    // saturation/brightness gradient box
            { component: iro.ui.Slider, options: { sliderType: 'hue' } }  // hue strip
        ]
    });

    picker.on('color:change', color => {
        currentColor = color.hexString;
        onChange && onChange(currentColor);
    });

    return () => currentColor;
}

// Build a rich display label for a class: "Name (Teacher • Schedule)"
// Falls back gracefully when teacher or schedule are missing.
// Admin users are intentionally excluded from the teacher display.
function getClassDisplayName(cls) {
    if (!cls) return '';
    const name = cls.name || '';
    const teacher = (cls.teacher_name && cls.teacher_name.trim() && cls.teacher_role !== 'admin')
        ? cls.teacher_name.trim() : '';
    const schedule = cls.schedule && cls.schedule.trim() ? cls.schedule.trim() : '';
    if (teacher && schedule) return `${name} (${teacher} \u2022 ${schedule})`;
    if (teacher) return `${name} (${teacher})`;
    if (schedule) return `${name} (${schedule})`;
    return name;
}

// ── Schedule helpers ────────────────────────────────────────────────────────

// Canonical schedule format: "Mon/Wed 10:00-11:30"
// Days joined by "/", single space, HH:MM-HH:MM (24-hour).
const SCHEDULE_DAY_ABBREVS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Parse a canonical schedule string into structured parts.
 * Returns { days: string[], startTime: string, endTime: string } or null if
 * the string doesn't match the canonical format (i.e. it is a legacy value).
 */
function parseScheduleString(schedule) {
    if (!schedule || !schedule.trim()) return null;
    const m = schedule.trim().match(/^([A-Za-z]+(?:\/[A-Za-z]+)*)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!m) return null;
    return { days: m[1].split('/'), startTime: m[2], endTime: m[3] };
}

/**
 * Compile structured inputs back into a canonical schedule string.
 * Returns empty string when no days and no time are provided.
 */
function buildScheduleString(days, startTime, endTime) {
    const hasDays = days && days.length > 0;
    const hasTime = startTime && endTime;
    if (!hasDays && !hasTime) return '';
    const parts = [];
    if (hasDays) parts.push(days.join('/'));
    if (hasTime) parts.push(`${startTime}-${endTime}`);
    return parts.join(' ');
}

/**
 * Return the HTML for the structured schedule picker embedded inside a form.
 * @param {string|null} existingSchedule - Current value from DB (may be legacy free-text).
 * @param {string} prefix               - Unique prefix for element IDs (e.g. "add-cls", "edit-cls").
 */
function buildSchedulePickerHTML(existingSchedule, prefix) {
    const parsed = parseScheduleString(existingSchedule);
    const isLegacy = existingSchedule && existingSchedule.trim() && !parsed;

    const dayCheckboxes = SCHEDULE_DAY_ABBREVS.map(d => {
        const checked = parsed && parsed.days.includes(d) ? 'checked' : '';
        return `<label class="day-checkbox-label" style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;padding:3px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;user-select:none;">
            <input type="checkbox" class="${prefix}-day-cb" value="${d}" ${checked} style="cursor:pointer;"> ${d}
        </label>`;
    }).join('');

    const startVal = parsed ? parsed.startTime : '';
    const endVal   = parsed ? parsed.endTime   : '';

    const legacyWarning = isLegacy ? `
        <div style="margin-top:6px;padding:6px 8px;background:#fff8e1;border:1px solid #ffe082;border-radius:4px;font-size:12px;color:#795548;">
            ⚠️ Legacy schedule: <em>${escapeHtml(existingSchedule)}</em><br>
            Select days/times above to replace it, or leave blank to keep it unchanged.
        </div>` : '';

    return `
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">${dayCheckboxes}</div>
        <div style="display:flex;gap:10px;align-items:flex-end;">
            <div>
                <label style="font-size:12px;display:block;margin-bottom:2px;">Start time</label>
                <input type="time" id="${prefix}-start-time" class="form-control" value="${startVal}" style="width:130px;">
            </div>
            <span style="padding-bottom:6px;font-weight:bold;">–</span>
            <div>
                <label style="font-size:12px;display:block;margin-bottom:2px;">End time</label>
                <input type="time" id="${prefix}-end-time" class="form-control" value="${endVal}" style="width:130px;">
            </div>
        </div>
        ${legacyWarning}`;
}

/**
 * Read back the schedule picker value.
 * @param {string} prefix      - Same prefix used in buildSchedulePickerHTML.
 * @param {string|null} legacy - The legacy schedule string (if any), used when pickers are left blank.
 * @returns {string} Canonical schedule string, or legacy value if no new input was given.
 */
function getScheduleFromPicker(prefix, legacy) {
    const checkedDays = Array.from(document.querySelectorAll(`.${prefix}-day-cb:checked`)).map(cb => cb.value);
    const startTime   = (document.getElementById(`${prefix}-start-time`)?.value || '').trim();
    const endTime     = (document.getElementById(`${prefix}-end-time`)?.value || '').trim();
    const hasNewInput = checkedDays.length > 0 || startTime || endTime;
    if (!hasNewInput && legacy) return legacy; // preserve legacy value unchanged
    return buildScheduleString(checkedDays, startTime, endTime);
}

// Normalize legacy student color codes to hex values
function normalizeStudentColor(colorCode) {
    if (!colorCode) return { value: '#FFFFFF', cleared: true };
    if (colorCode === 'yellow') return { value: '#FBBC04', cleared: false };
    if (colorCode === 'blue') return { value: '#4285F4', cleared: false };
    if (/^#[0-9A-Fa-f]{3,8}$/.test(colorCode)) return { value: colorCode, cleared: false };
    return { value: '#FFFFFF', cleared: true };
}

// Return a colored dot HTML string for a student, or '' if the student has no color
function getStudentColorDot(colorCode) {
    const c = normalizeStudentColor(colorCode);
    return c.cleared ? '' : `<span style="color: ${c.value}">●</span> `;
}

// Read the effective color value from a student color input (respects data-cleared state)
function getStudentColorInputValue(inputId) {
    const el = document.getElementById(inputId);
    if (!el || el.dataset.cleared === 'true') return '';
    return el.value;
}

// Initialize a student color picker using the iro.js inline color wheel (same UI as class color picker).
// `inputId`   – id of a hidden <input> that stores the current hex value (read by getStudentColorInputValue).
// `previewId` – id of the preview <span>.
// `clearBtnId`– id of the "Clear" button.
// `initialColorCode` – existing color_code value (may be legacy named color or hex).
// The iro.js wheel container is expected to have id = inputId + '-wheel'.
function initStudentColorPicker(inputId, previewId, clearBtnId, initialColorCode) {
    const hiddenInput = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const clearBtn = document.getElementById(clearBtnId);
    if (!hiddenInput || !preview || !clearBtn) return;

    const state = normalizeStudentColor(initialColorCode);
    hiddenInput.value = state.value;
    hiddenInput.dataset.cleared = String(state.cleared);

    // If the color is cleared/none we still need a valid starting color for the wheel.
    const wheelStartColor = state.cleared ? '#4285f4' : state.value;

    // Mount the always-visible iro.js color wheel (same layout as class color picker).
    initClassColorWheel(inputId + '-wheel', wheelStartColor, (hex) => {
        hiddenInput.value = hex;
        hiddenInput.dataset.cleared = 'false';
        preview.style.background = hex;
        preview.style.color = getContrastTextColor(hex);
        preview.textContent = 'Preview';
    });

    // Set the initial preview state.
    if (state.cleared) {
        preview.style.background = 'transparent';
        preview.style.color = '';
        preview.textContent = 'None';
    } else {
        preview.style.background = state.value;
        preview.style.color = getContrastTextColor(state.value);
        preview.textContent = 'Preview';
    }

    clearBtn.addEventListener('click', () => {
        hiddenInput.dataset.cleared = 'true';
        hiddenInput.value = '';
        preview.style.background = 'transparent';
        preview.style.color = '';
        preview.textContent = 'None';
    });
}

// Date formatting helper for display
function formatDisplayDate(isoDate) {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Attendance status display formatter
function formatAttendanceStatus(status) {
    const statusMap = {
        'O': { text: 'Present', class: 'status-present', icon: '✓' },
        'X': { text: 'Absent', class: 'status-absent', icon: '✗' },
        '/': { text: 'Late/Partial', class: 'status-late', icon: '⏰' },
        '': { text: 'Not Marked', class: 'status-unmarked', icon: '—' }
    };
    return statusMap[status] || statusMap[''];
}

// Get all attendance status icons for export filtering
function getAttendanceIcons() {
    const statuses = ['O', 'X', '/', ''];
    return statuses.map(s => formatAttendanceStatus(s).icon);
}

// API Helper
// `api()` is defined in /js/api.js which is loaded before this script.
// See that file for full documentation of the fetch wrapper.

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
            
            const initialPage = getPageFromHash() || 'dashboard';
            history.replaceState({ page: initialPage }, '', `#${initialPage}`);
            navigateToPage(initialPage, false);
            
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
        
        // Deduplicate by id in case the server returns duplicates (defense in depth)
        classes = Array.from(new Map(classesData.map(c => [c.id, c])).values());
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

    // Separate the logged-in teacher's classes from the rest for smart defaulting.
    const myClasses    = classes.filter(c => currentUser && c.teacher_id == currentUser.id);
    const otherClasses = classes.filter(c => !currentUser || c.teacher_id != currentUser.id);

    selects.forEach(select => {
        if (!select) return;
        // Preserve existing selection if possible.
        const prevValue = select.value;
        select.innerHTML = '<option value="">Select a class...</option>';

        if (myClasses.length > 0) {
            const myGroup = document.createElement('optgroup');
            myGroup.label = 'My Classes';
            myClasses.forEach(cls => {
                const opt = document.createElement('option');
                opt.value = cls.id;
                opt.textContent = getClassDisplayName(cls);
                myGroup.appendChild(opt);
            });
            select.appendChild(myGroup);
        }

        if (otherClasses.length > 0) {
            // Use an optgroup only when there are also "my" classes, so other classes
            // are visually grouped separately.
            if (myClasses.length > 0) {
                const otherGroup = document.createElement('optgroup');
                otherGroup.label = 'Other Classes';
                otherClasses.forEach(cls => {
                    const opt = document.createElement('option');
                    opt.value = cls.id;
                    opt.textContent = getClassDisplayName(cls);
                    otherGroup.appendChild(opt);
                });
                select.appendChild(otherGroup);
            } else {
                otherClasses.forEach(cls => {
                    const opt = document.createElement('option');
                    opt.value = cls.id;
                    opt.textContent = getClassDisplayName(cls);
                    select.appendChild(opt);
                });
            }
        }

        // Restore previous selection if it still exists in the new list.
        if (prevValue) select.value = prevValue;
    });
}

function populateTeacherSelects() {
    const selects = [
        document.getElementById('report-teacher'),
        document.getElementById('metadata-teacher')
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

function getPageFromHash() {
    const hash = window.location.hash.replace('#', '');
    const validPages = ['dashboard', 'attendance', 'reports', 'monthly-reports', 'students-profile', 'makeup', 'database', 'admin', 'profile'];
    return validPages.includes(hash) ? hash : null;
}

window.addEventListener('popstate', (event) => {
    const page = event.state?.page || getPageFromHash() || 'dashboard';
    navigateToPage(page, false);
});

// ── QoL: Unsaved changes tracking ──────────────────────────────────────────
let formDirty = false;

function setFormDirty(dirty) {
    formDirty = dirty;
}

window.addEventListener('beforeunload', (e) => {
    if (formDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ── QoL: Auto-save draft to localStorage ───────────────────────────────────
const DRAFT_KEY = 'vitamin_draft_comment_sheet';
let draftSaveTimer = null;

function saveDraft() {
    const reportId = document.getElementById('report-id')?.value;
    if (reportId) return; // Only auto-save new (unsaved) sheets
    const draft = {
        date: document.getElementById('report-form-date')?.value || '',
        class_id: document.getElementById('report-class')?.value || '',
        teacher_id: document.getElementById('report-teacher')?.value || '',
        target_topic: document.getElementById('report-target')?.value || '',
        vocabulary: document.getElementById('report-vocabulary')?.value || '',
        phrases: document.getElementById('report-phrases')?.value || '',
        mistakes: document.getElementById('report-mistakes')?.value || '',
        strengths: document.getElementById('report-strengths')?.value || '',
        comments: document.getElementById('report-comments')?.value || '',
        others: document.getElementById('report-others')?.value || '',
        savedAt: Date.now()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
}

function scheduleDraftSave() {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(saveDraft, 2000);
}

function restoreDraftIfAvailable() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
        const draft = JSON.parse(raw);
        if (!draft.savedAt) return;
        const ageMin = Math.round((Date.now() - draft.savedAt) / 60000);
        Toast.prompt(`Restore unsaved draft from ${ageMin} minute(s) ago?`, () => {
            if (draft.date) document.getElementById('report-form-date').value = draft.date;
            if (draft.class_id) document.getElementById('report-class').value = draft.class_id;
            if (draft.teacher_id) document.getElementById('report-teacher').value = draft.teacher_id;
            if (draft.target_topic) document.getElementById('report-target').value = draft.target_topic;
            if (draft.vocabulary) document.getElementById('report-vocabulary').value = draft.vocabulary;
            if (draft.phrases) document.getElementById('report-phrases').value = draft.phrases;
            if (draft.mistakes) document.getElementById('report-mistakes').value = draft.mistakes;
            if (draft.strengths) document.getElementById('report-strengths').value = draft.strengths;
            if (draft.comments) document.getElementById('report-comments').value = draft.comments;
            if (draft.others) document.getElementById('report-others').value = draft.others;
            setFormDirty(true);
        }, () => {
            clearDraft();
        });
    } catch (_) { /* ignore */ }
}

function navigateToPage(page, pushState = true) {
    // Warn about unsaved changes
    if (formDirty && !confirm('You have unsaved changes. Leave anyway?')) {
        return;
    }

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');

    // Update browser history
    if (pushState) {
        history.pushState({ page }, '', `#${page}`);
    }

    // Load page-specific data
    if (page === 'dashboard') loadDashboard();
    else if (page === 'admin') loadAdminData();
    else if (page === 'attendance') initializeAttendancePage();
    else if (page === 'database') initializeDatabasePage();
    else if (page === 'reports') {
        // Always restore the default "Single Report" tab when navigating to this page
        // (the global tab handler is scoped per-page, but if state was lost for any other
        // reason, this guarantees a clean starting state).
        const reportsPage = document.getElementById('reports-page');
        if (reportsPage) {
            reportsPage.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            reportsPage.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            const defaultBtn = reportsPage.querySelector('[data-tab="single-report"]');
            if (defaultBtn) { defaultBtn.classList.add('active'); defaultBtn.setAttribute('aria-selected', 'true'); }
            const defaultTab = document.getElementById('single-report-tab');
            if (defaultTab) defaultTab.classList.add('active');
        }
        initMultiClassView(); loadReportsList();
    }
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

    // Part 1A: Initialize month display to current month if not already set
    if (!currentAttendanceMonth || !currentAttendanceYear) {
        const now = new Date();
        currentAttendanceMonth = now.getMonth() + 1;
        currentAttendanceYear  = now.getFullYear();
    }
    updateMonthDisplay();

    // Part 1C: sync toggle with current state
    const toggle = document.getElementById('show-schedule-only');
    if (toggle) toggle.checked = showScheduleDatesOnly;

    // Part 4F: check initial online status
    updateOfflineIndicator();
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
    if (container.querySelector('.db-table-clean') || container.querySelector('.db-table')) {
        return;
    }
    
    // Load all data types by default to show an overview
    try {
        container.innerHTML = '<span class="skeleton skeleton-row"></span><span class="skeleton skeleton-row"></span><span class="skeleton skeleton-row"></span>';
        // Set type to empty string which will trigger "all" type search
        document.getElementById('db-search-type').value = '';
        await searchDatabase();
    } catch (error) {
        console.error('Error loading initial database view:', error);
    }
}

// Dashboard
async function loadDashboard() {
    const todayClassesDiv = document.getElementById('today-classes');
    const recentActivityDiv = document.getElementById('recent-activity');

    // Show skeleton placeholders while data loads
    todayClassesDiv.innerHTML = '<span class="skeleton skeleton-card"></span><span class="skeleton skeleton-card"></span>';
    recentActivityDiv.innerHTML = '<span class="skeleton skeleton-row"></span><span class="skeleton skeleton-row"></span><span class="skeleton skeleton-row"></span>';

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
                            <span class="today-class-teacher">👤 ${escapeHtml((cls.teacher_name && cls.teacher_role !== 'admin') ? cls.teacher_name : 'No teacher')}</span>
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
                <div class="activity-date">${formatDateReadable(report.date)}</div>
                <div class="activity-class">${escapeHtml(report.class_name)}</div>
                <div class="activity-teacher">by ${escapeHtml(report.teacher_name)}</div>
            </div>
        `).join('') || '<p class="info-text">No recent activity</p>';
    } catch (error) {
        recentActivityDiv.innerHTML = '<p class="info-text">Unable to load recent activity</p>';
    }

    // Part 2C: Load attendance overview card
    loadAttendanceOverview();
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
document.getElementById('export-attendance-btn').addEventListener('click', exportAttendance);
document.getElementById('export-attendance-pdf-btn').addEventListener('click', exportAttendancePDF);
document.getElementById('new-attendance-btn')?.addEventListener('click', showNewAttendanceModal);
document.getElementById('add-date-btn')?.addEventListener('click', showAddDateModal);
document.getElementById('move-attendance-btn')?.addEventListener('click', showMoveAttendanceModal);

// Debounced auto-load when date inputs change (Part 6)
let attendanceDateChangeTimer = null;
function debouncedAttendanceLoad() {
    const classId = document.getElementById('attendance-class-select').value;
    if (!classId) return;
    if (attendanceDateChangeTimer) clearTimeout(attendanceDateChangeTimer);
    attendanceDateChangeTimer = setTimeout(() => {
        attendanceDateChangeTimer = null;
        loadAttendance();
    }, 500);
}
document.getElementById('attendance-start-date')?.addEventListener('change', debouncedAttendanceLoad);
document.getElementById('attendance-end-date')?.addEventListener('change', debouncedAttendanceLoad);

// Daily Navigation Buttons
document.getElementById('prev-day-btn')?.addEventListener('click', () => loadDailyAttendance(-1));
document.getElementById('today-btn')?.addEventListener('click', () => loadDailyAttendance(0));
document.getElementById('next-day-btn')?.addEventListener('click', () => loadDailyAttendance(1));

/**
 * Navigate to a specific day for attendance viewing
 * @param {number} dayOffset - Day offset: 0 for today, -1 for previous day, 1 for next day
 * Sets both startDate and endDate to a single day, switches to Table view, and loads attendance.
 * Shows error if no class is selected.
 */
function loadDailyAttendance(dayOffset) {
    const classId = document.getElementById('attendance-class-select').value;
    
    if (!classId) {
        Toast.error('Please select a class first');
        return;
    }
    
    // Determine base date: use current startDate if set, otherwise today
    const startDateInput = document.getElementById('attendance-start-date');
    const endDateInput = document.getElementById('attendance-end-date');
    
    let baseDate;
    if (dayOffset === 0) {
        // "Today" button always uses current date
        baseDate = new Date();
    } else {
        // Prev/Next: use current startDate if available, otherwise today
        const currentStartDate = startDateInput.value;
        if (currentStartDate) {
            // Parse as local midnight to avoid timezone shifts
            baseDate = new Date(currentStartDate + 'T00:00:00');
        } else {
            baseDate = new Date();
        }
        // Apply offset
        baseDate.setDate(baseDate.getDate() + dayOffset);
    }
    
    // Format the target date as YYYY-MM-DD using formatDateISO for Asia/Tokyo timezone consistency
    const targetDate = formatDateISO(baseDate);
    
    // Set both start and end date to the same single day
    startDateInput.value = targetDate;
    endDateInput.value = targetDate;
    
    // Ensure we're in Table view for interactive attendance marking
    if (currentAttendanceView !== 'list') {
        currentAttendanceView = 'list';
        document.getElementById('view-list-btn')?.classList.add('active');
        document.getElementById('view-grid-btn')?.classList.remove('active');
    }
    
    // Trigger the existing load attendance function
    loadAttendance();
}

// View Toggle for Attendance
let currentAttendanceView = 'list'; // 'list' or 'grid'
let lastAttendanceData = null; // Store last loaded attendance data
let lastAttendanceClassId = null;

// ── Part 1: Month navigation state ────────────────────────────────────────────
let currentAttendanceMonth = null; // 1-12
let currentAttendanceYear  = null;
let attendanceMonthPickerYear = new Date().getFullYear();
let showScheduleDatesOnly = true; // Part 1C toggle

// ── Part 4A: Undo stack ────────────────────────────────────────────────────────
const undoStack = []; // max 10 entries

// ── Toast batching state for rapid attendance marking ─────────────────────────
let attendanceToastBatch = [];
let attendanceToastTimer = null;
const TOAST_BATCH_WINDOW = 2000; // 2 seconds

function flushAttendanceToastBatch() {
    if (attendanceToastBatch.length === 0) return;
    const batch = attendanceToastBatch.splice(0);
    if (batch.length === 1) {
        Toast.undo(batch[0].message, batch[0].undoCallback);
    } else {
        Toast.undo(`✓ Updated ${batch.length} attendance records`, () => {
            batch.forEach(item => item.undoCallback());
        });
    }
}

// ── Part 4C: Keyboard navigation state ────────────────────────────────────────
let focusedCell = null; // currently focused attendance cell element

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

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: MONTH NAVIGATION (1A, 1B)
// ═══════════════════════════════════════════════════════════════════════════════

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Update the month display button text */
function updateMonthDisplay() {
    const el = document.getElementById('month-display-text');
    if (!el) return;
    if (currentAttendanceMonth && currentAttendanceYear) {
        el.textContent = `${MONTH_NAMES_FULL[currentAttendanceMonth - 1]} ${currentAttendanceYear}`;
    } else {
        el.textContent = 'Select Month';
    }
}

/** Fill the month picker grid with 12 month buttons for attendanceMonthPickerYear */
function renderMonthPickerGrid() {
    const grid = document.getElementById('month-picker-grid');
    if (!grid) return;
    document.getElementById('month-picker-year').textContent = attendanceMonthPickerYear;
    grid.innerHTML = MONTH_NAMES_SHORT.map((m, i) => {
        const isActive = (i + 1 === currentAttendanceMonth && attendanceMonthPickerYear === currentAttendanceYear);
        return `<button class="month-picker-btn${isActive ? ' active' : ''}" data-month="${i+1}" data-year="${attendanceMonthPickerYear}">${m}</button>`;
    }).join('');
    grid.querySelectorAll('.month-picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectMonth(parseInt(btn.dataset.month), parseInt(btn.dataset.year));
            document.getElementById('month-picker-dropdown').style.display = 'none';
        });
    });
}

/** Set the current month/year, auto-fill start/end date inputs */
function selectMonth(month, year) {
    currentAttendanceMonth = month;
    currentAttendanceYear  = year;
    updateMonthDisplay();

    const firstDay = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay  = new Date(year, month, 0).getDate();
    const lastDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

    document.getElementById('attendance-start-date').value = firstDay;
    document.getElementById('attendance-end-date').value   = lastDate;

    // Part 1B: auto-load if class is selected
    const classId = document.getElementById('attendance-class-select').value;
    if (classId) {
        loadAttendance();
    }
}

/** Navigate months: offset = -1 (prev) or +1 (next) */
function navigateMonth(offset) {
    const now = new Date();
    let month = currentAttendanceMonth || (now.getMonth() + 1);
    let year  = currentAttendanceYear  || now.getFullYear();
    month += offset;
    if (month < 1)  { month = 12; year--; }
    if (month > 12) { month = 1;  year++; }
    selectMonth(month, year);
}

// Month nav button listeners
document.getElementById('month-prev-btn')?.addEventListener('click', () => navigateMonth(-1));
document.getElementById('month-next-btn')?.addEventListener('click', () => navigateMonth(+1));
document.getElementById('month-today-btn')?.addEventListener('click', () => {
    const now = new Date();
    selectMonth(now.getMonth() + 1, now.getFullYear());
});

// Month display button opens/closes picker
document.getElementById('month-display-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('month-picker-dropdown');
    if (!dropdown) return;
    attendanceMonthPickerYear = currentAttendanceYear || new Date().getFullYear();
    renderMonthPickerGrid();
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

// Month picker year navigation
document.getElementById('month-picker-prev-year')?.addEventListener('click', () => {
    attendanceMonthPickerYear--;
    renderMonthPickerGrid();
});
document.getElementById('month-picker-next-year')?.addEventListener('click', () => {
    attendanceMonthPickerYear++;
    renderMonthPickerGrid();
});

// Close month picker on outside click
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('month-picker-dropdown');
    const bar = document.getElementById('month-nav-bar');
    if (dropdown && bar && !bar.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// Part 1B: Auto-load when class changes AND a month is selected
document.getElementById('attendance-class-select')?.addEventListener('change', () => {
    if (currentAttendanceMonth && currentAttendanceYear) {
        loadAttendance();
    }
});

// Part 1C: Schedule toggle
document.getElementById('show-schedule-only')?.addEventListener('change', function() {
    showScheduleDatesOnly = this.checked;
    if (lastAttendanceData && lastAttendanceClassId) {
        if (currentAttendanceView === 'grid') {
            renderAttendanceGridView(lastAttendanceData, lastAttendanceClassId);
        } else {
            renderAttendanceTable(lastAttendanceData, lastAttendanceClassId);
        }
    }
});

// Part 4G: PDF preview modal
function showPDFPreviewModal() {
    const classId   = document.getElementById('attendance-class-select').value;
    const startDate = document.getElementById('attendance-start-date').value;
    const endDate   = document.getElementById('attendance-end-date').value;

    if (!classId) { Toast.error('Please select a class first'); return; }
    if (!startDate || !endDate) { Toast.error('Please select both start and end dates'); return; }

    showModal('📄 Export PDF Options', `
        <div class="pdf-preview-modal-body">
            <div class="pdf-option-group">
                <label>Date range: <strong>${escapeHtml(startDate)}</strong> → <strong>${escapeHtml(endDate)}</strong></label>
            </div>
            <div class="pdf-option-group">
                <label>Include Statistics:</label>
                <div class="pdf-option-row">
                    <label><input type="radio" name="pdf-stats" value="yes" checked> Yes</label>
                    <label><input type="radio" name="pdf-stats" value="no"> No</label>
                </div>
            </div>
            <div class="pdf-option-group">
                <label>Teacher Comments Section:</label>
                <div class="pdf-option-row">
                    <label><input type="radio" name="pdf-comments" value="yes" checked> Yes</label>
                    <label><input type="radio" name="pdf-comments" value="no"> No</label>
                </div>
            </div>
            <div style="margin-top:16px;display:flex;gap:10px;">
                <button id="pdf-generate-btn" class="btn btn-primary">📄 Generate PDF</button>
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </div>
    `);

    document.getElementById('pdf-generate-btn')?.addEventListener('click', async () => {
        const inclStats  = document.querySelector('input[name="pdf-stats"]:checked')?.value !== 'no';
        const inclComments = document.querySelector('input[name="pdf-comments"]:checked')?.value !== 'no';
        closeModal();

        const normalizedStart = normalizeToISO(startDate);
        const normalizedEnd   = normalizeToISO(endDate);
        if (!normalizedStart || !normalizedEnd) { Toast.error('Invalid date format'); return; }

        Toast.info('Generating PDF...', 'Please wait');
        try {
            const endpoint = `/pdf/attendance-grid/${classId}`;
            const body = JSON.stringify({ startDate: normalizedStart, endDate: normalizedEnd });
            const response = await api(endpoint, { method: 'POST', body });
            if (response.success && response.downloadUrl) {
                Toast.success('PDF generated successfully!');
                window.open(response.downloadUrl, '_blank');
            } else {
                Toast.error('Failed to generate PDF');
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            if (error.message && error.message.includes('not configured')) {
                Toast.error('PDF export requires Cloudflare R2 configuration.', 'Configuration Required');
            } else {
                Toast.error('Error generating PDF: ' + (error.message || 'Unknown error'));
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4F: OFFLINE INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function updateOfflineIndicator() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    if (!navigator.onLine) {
        banner.style.display = 'block';
        banner.classList.remove('synced');
        document.getElementById('offline-banner-text').textContent = '📴 Offline — changes saved locally';
    } else {
        banner.style.display = 'none';
    }
}

window.addEventListener('offline', () => {
    const banner = document.getElementById('offline-banner');
    if (banner) {
        banner.style.display = 'block';
        banner.classList.remove('synced');
        document.getElementById('offline-banner-text').textContent = '📴 Offline — changes saved locally';
    }
});

window.addEventListener('online', () => {
    const banner = document.getElementById('offline-banner');
    if (banner) {
        banner.style.display = 'block';
        banner.classList.add('synced');
        document.getElementById('offline-banner-text').textContent = '☁️ Synced!';
        // Process any queued attendance saves
        if (AttendanceSaveQueue.queue.size > 0) {
            AttendanceSaveQueue.processSave();
        }
        setTimeout(() => {
            banner.style.display = 'none';
            banner.classList.remove('synced');
        }, 3000);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4B: QUICK MARK ALL PRESENT
// ═══════════════════════════════════════════════════════════════════════════════

document.getElementById('quick-mark-present-btn')?.addEventListener('click', quickMarkAllPresent);

async function quickMarkAllPresent() {
    const startDate = document.getElementById('attendance-start-date').value;
    const endDate   = document.getElementById('attendance-end-date').value;
    // Only active when viewing a single date
    if (!startDate || !endDate || startDate !== endDate) {
        Toast.info('Quick mark is only available when viewing a single date');
        return;
    }

    const cells = document.querySelectorAll(`.attendance-cell[data-date="${startDate}"]`);
    const emptyCells = Array.from(cells).filter(c => !c.textContent.trim());

    if (emptyCells.length === 0) {
        Toast.info('All students already marked for this date');
        return;
    }

    // Store snapshot for undo
    const snapshot = emptyCells.map(c => ({ cell: c, prev: c.textContent.trim() }));

    // Apply optimistic UI update
    emptyCells.forEach(cell => {
        cell.textContent = 'O';
        cell.className = 'attendance-cell present';
        const studentId = cell.dataset.student;
        const classId   = cell.dataset.class;
        const date      = cell.dataset.date;
        const selectedClass = classes.find(c => c.id == classId);
        const teacherId = selectedClass ? selectedClass.teacher_id : null;
        const normalizedDate = normalizeToISO(date) || date;
        AttendanceSaveQueue.add(studentId, classId, normalizedDate, 'O', null, teacherId);
        // Keep in-memory data in sync so getStudentRate() sees the latest status
        if (lastAttendanceData && lastAttendanceData.attendance) {
            lastAttendanceData.attendance[`${studentId}-${normalizedDate}`] = 'O';
        }
    });

    // Update rate cells for all affected rows
    const affectedRows = new Set(emptyCells.map(c => c.closest('tr')).filter(Boolean));
    affectedRows.forEach(r => updateStudentRateCell(r));

    Toast.undo(`Marked ${emptyCells.length} student${emptyCells.length !== 1 ? 's' : ''} present`, () => {
        // Undo: revert all cells and remove from queue
        snapshot.forEach(({ cell, prev }) => {
            const studentId = cell.dataset.student;
            const date      = cell.dataset.date;
            const normalizedDate = normalizeToISO(date) || date;
            AttendanceSaveQueue.queue.delete(`${studentId}-${cell.dataset.class}-${normalizedDate}`);
            cell.textContent = prev;
            cell.className = 'attendance-cell';
            // Revert in-memory data
            if (lastAttendanceData && lastAttendanceData.attendance) {
                lastAttendanceData.attendance[`${studentId}-${normalizedDate}`] = prev;
            }
        });
        // Update rate cells after undo
        affectedRows.forEach(r => updateStudentRateCell(r));
        Toast.info('Quick mark undone');
    });
}

/** Show/hide Quick Mark button based on date range */
function updateQuickMarkButtonVisibility() {
    const btn = document.getElementById('quick-mark-present-btn');
    if (!btn) return;
    const startDate = document.getElementById('attendance-start-date').value;
    const endDate   = document.getElementById('attendance-end-date').value;
    btn.style.display = (startDate && endDate && startDate === endDate) ? 'inline-block' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4C: KEYBOARD NAVIGATION FOR ATTENDANCE GRID
// ═══════════════════════════════════════════════════════════════════════════════

/** Returns all attendance cells in the table in reading order */
function getAllAttendanceCells() {
    return Array.from(document.querySelectorAll('.attendance-table .attendance-cell'));
}

/** Get cell position (row, col) within the table */
function getCellPosition(cell) {
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return null;
    const rows = Array.from(table.querySelectorAll('tbody tr')).filter(r => !r.classList.contains('student-type-header') && r.querySelectorAll('.attendance-cell').length > 0);
    const rowIdx = rows.indexOf(row);
    const cellsInRow = Array.from(row.querySelectorAll('.attendance-cell'));
    const colIdx = cellsInRow.indexOf(cell);
    return { rowIdx, colIdx, rows, cellsInRow };
}

function setFocusedCell(cell) {
    if (focusedCell) {
        focusedCell.removeAttribute('data-focused');
        focusedCell.removeAttribute('tabindex');
    }
    focusedCell = cell;
    if (cell) {
        cell.setAttribute('data-focused', 'true');
        cell.setAttribute('tabindex', '0');
        cell.focus();
    }
}

function announceAttendance(message) {
    const region = document.getElementById('attendance-aria-live');
    if (region) { region.textContent = ''; setTimeout(() => { region.textContent = message; }, 50); }
}

// Delegate keyboard events from attendance container
document.getElementById('attendance-container')?.addEventListener('keydown', (e) => {
    // Don't capture if user is in an input/select/textarea
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;

    const cell = e.target.closest('.attendance-cell');
    if (!cell) return;

    const pos = getCellPosition(cell);
    if (!pos) return;
    const { rowIdx, colIdx, rows } = pos;

    let handled = true;
    if (e.key === 'ArrowDown' && rowIdx + 1 < rows.length) {
        const nextRow = rows[rowIdx + 1];
        const cells = nextRow.querySelectorAll('.attendance-cell');
        if (cells[colIdx]) setFocusedCell(cells[colIdx]);
    } else if (e.key === 'ArrowUp' && rowIdx > 0) {
        const prevRow = rows[rowIdx - 1];
        const cells = prevRow.querySelectorAll('.attendance-cell');
        if (cells[colIdx]) setFocusedCell(cells[colIdx]);
    } else if (e.key === 'ArrowRight') {
        const cells = pos.cellsInRow;
        if (colIdx + 1 < cells.length) setFocusedCell(cells[colIdx + 1]);
    } else if (e.key === 'ArrowLeft') {
        if (colIdx > 0) setFocusedCell(pos.cellsInRow[colIdx - 1]);
    } else if (e.key === 'Tab') {
        // Move to next student (next row, same column)
        if (!e.shiftKey && rowIdx + 1 < rows.length) {
            e.preventDefault();
            const nextRow = rows[rowIdx + 1];
            const cells = nextRow.querySelectorAll('.attendance-cell');
            if (cells[colIdx]) setFocusedCell(cells[colIdx]);
        }
    } else if (e.key === ' ' || e.key === 'Enter') {
        toggleAttendance(cell);
    } else if (e.key === 'o' || e.key === 'O') {
        setAttendanceStatus(cell, 'O');
    } else if (e.key === 'x' || e.key === 'X') {
        setAttendanceStatus(cell, 'X');
    } else if (e.key === '/') {
        setAttendanceStatus(cell, '/');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        setAttendanceStatus(cell, '');
    } else {
        handled = false;
    }
    if (handled) e.preventDefault();
});

function setAttendanceStatus(cell, newStatus) {
    // Get student name for announcement
    const row = cell.closest('tr');
    const nameCell = row ? row.querySelector('.student-name') : null;
    const studentName = nameCell ? nameCell.textContent.trim().replace(/[✏️📊]/g, '').trim() : 'Student';

    cell.textContent = newStatus;
    cell.className = 'attendance-cell';
    if (newStatus === 'O') cell.classList.add('present');
    else if (newStatus === 'X') cell.classList.add('absent');
    else if (newStatus === '/') cell.classList.add('partial');

    const selectedClass = classes.find(c => c.id == cell.dataset.class);
    const teacherId = selectedClass ? selectedClass.teacher_id : null;
    const normalizedDate = normalizeToISO(cell.dataset.date) || cell.dataset.date;
    AttendanceSaveQueue.add(cell.dataset.student, cell.dataset.class, normalizedDate, newStatus, null, teacherId);

    const statusLabel = { 'O': 'Present', 'X': 'Absent', '/': 'Partial', '': 'Cleared' };
    const dateLabel = cell.dataset.date ? new Date(cell.dataset.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    announceAttendance(`Marked ${studentName} as ${statusLabel[newStatus] || newStatus} for ${dateLabel}`);
}

// Make attendance cells keyboard focusable when clicked
document.getElementById('attendance-container')?.addEventListener('click', (e) => {
    const cell = e.target.closest('.attendance-cell');
    if (cell) setFocusedCell(cell);
}, true);

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4D: ATTENDANCE PATTERN DETECTION (client-side)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detects absence patterns in attendance data.
 * Returns array of human-readable pattern strings.
 */
function detectAttendancePatterns(records, studentName) {
    const patterns = [];
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    // Check for day-of-week pattern (absent same day 3+ weeks in a row)
    const absentByDay = {};
    records.filter(r => r.status === 'X').forEach(r => {
        const d = new Date(r.date + 'T00:00:00').getDay();
        if (!absentByDay[d]) absentByDay[d] = [];
        absentByDay[d].push(r.date);
    });
    Object.entries(absentByDay).forEach(([day, dates]) => {
        if (dates.length >= 3) {
            // Check if 3 consecutive weeks
            const sorted = dates.map(d => new Date(d + 'T00:00:00')).sort((a,b) => a-b);
            let consecutive = 1;
            for (let i = 1; i < sorted.length; i++) {
                const diff = (sorted[i] - sorted[i-1]) / (1000 * 60 * 60 * 24);
                if (diff >= 6 && diff <= 8) consecutive++;
                else consecutive = 1;
                if (consecutive >= 3) {
                    patterns.push(`⚠️ ${escapeHtml(studentName)} has been absent every ${dayNames[day]} for the last ${consecutive} ${consecutive === 1 ? 'week' : 'weeks'}`);
                    break;
                }
            }
        }
    });
    return patterns;
}

/**
 * Compare two months: returns '↗️', '↘️', or '→' and delta.
 */
function compareMonthlyRates(rate1, rate2) {
    if (rate1 === null || rate2 === null) return { arrow: '→', delta: null };
    const delta = rate2 - rate1;
    const arrow = delta > 3 ? '↗️' : delta < -3 ? '↘️' : '→';
    return { arrow, delta };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2A: STUDENT INDIVIDUAL ATTENDANCE VIEW (enhanced)
// ═══════════════════════════════════════════════════════════════════════════════

async function viewStudentAttendanceSummary(studentId) {
    try {
        const startDate = document.getElementById('attendance-start-date').value;
        const endDate   = document.getElementById('attendance-end-date').value;
        let url = `/attendance/student-summary/${studentId}`;
        if (startDate && endDate) url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

        const data = await api(url);
        const { student, records, heatmap, stats, streaks } = data;

        // Milestone badges
        const milestones = [
            { n: 5, badge: '🌟', label: '5-class' }, { n: 10, badge: '⭐', label: '10-class' },
            { n: 20, badge: '🏆', label: '20-class' }, { n: 30, badge: '👑', label: '30-class' },
            { n: 50, badge: '💎', label: '50-class' }
        ];
        const earnedBadges = milestones.filter(m => streaks.best >= m.n)
            .map(m => `<span title="${m.label} streak" class="streak-milestones">${m.badge}</span>`).join('');

        // Rate color class
        const rateClass = stats.rate >= 85 ? 'rate-green' : stats.rate >= 65 ? 'rate-yellow' : 'rate-red';

        // Build heatmap SVG
        const heatmapSVG = buildHeatmapSVG(heatmap, startDate, endDate);

        // Absent dates list
        const absentRecords = records.filter(r => r.status === 'X');

        // Patterns
        const patterns = detectAttendancePatterns(records, student.name);

        showModal(`📊 Attendance: ${escapeHtml(student.name)}`, `
            <div class="student-detail-modal">
                <div class="streak-display">
                    <span class="streak-badge">🔥 Current streak: ${streaks.current} classes</span>
                    <span class="streak-badge" style="background:linear-gradient(135deg,#f093fb,#f5576c);">🏆 Best streak: ${streaks.best} classes</span>
                    ${earnedBadges}
                </div>
                <div class="attendance-rate-cell ${rateClass}" style="margin:10px 0;padding:8px;border-radius:8px;font-size:1rem;">
                    Attendance Rate: <strong>${stats.rate}%</strong> (${stats.present} / ${stats.total} classes)
                </div>
                <div class="heatmap-container">
                    ${heatmapSVG}
                </div>
                ${absentRecords.length > 0 ? `
                    <details style="margin-top:10px;">
                        <summary style="cursor:pointer;font-weight:600;margin-bottom:6px;">📅 Absent Dates (${absentRecords.length})</summary>
                        <div class="absent-list">
                            ${absentRecords.slice().reverse().map(r => `
                                <div class="absent-list-item">
                                    <span>${escapeHtml(r.date)}</span>
                                    <span style="color:#888;font-size:0.82em;">${escapeHtml(r.class_name || '')}</span>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                ` : ''}
                ${patterns.length > 0 ? `
                    <div style="margin-top:10px;padding:8px;background:#fff3cd;border-radius:6px;font-size:0.85rem;">
                        ${patterns.map(p => `<div>${p}</div>`).join('')}
                    </div>
                ` : ''}
                <div style="margin-top:12px;display:flex;gap:8px;">
                    <button class="btn btn-small btn-secondary" onclick="exportStudentAttendancePDF(${student.id})">📄 Export PDF</button>
                </div>
            </div>
        `);
    } catch (error) {
        console.error('Error loading student summary:', error);
        Toast.error('Failed to load student attendance summary');
    }
}

/**
 * Build an SVG heatmap (GitHub contribution graph style)
 * heatmap: { "YYYY-MM-DD": { status, classes } }
 */
function buildHeatmapSVG(heatmap, startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) {
        // Derive range from heatmap keys
        const keys = Object.keys(heatmap).sort();
        if (keys.length === 0) return '<p class="info-text">No data</p>';
        startDateStr = keys[0];
        endDateStr   = keys[keys.length - 1];
    }

    const CELL = 12, GAP = 2, STEP = CELL + GAP;
    const start = new Date(startDateStr + 'T00:00:00');
    const end   = new Date(endDateStr   + 'T00:00:00');

    // Align to Sunday
    const startSunday = new Date(start);
    startSunday.setDate(startSunday.getDate() - startSunday.getDay());

    const colorMap = {
        'O': 'var(--heatmap-present)',
        'X': 'var(--heatmap-absent)',
        '/': 'var(--heatmap-partial)',
        '': 'var(--heatmap-noclass)'
    };

    const LABEL_W = 22, TOP_PAD = 20;
    const cells = [];
    const cur = new Date(startSunday);
    let col = 0;

    while (cur <= end) {
        for (let row = 0; row < 7; row++) {
            const iso = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
            const isInRange = cur >= start && cur <= end;
            const hd = heatmap[iso];
            const status = isInRange && hd ? hd.status : (isInRange ? '' : null);
            if (status !== null) {
                const x = LABEL_W + col * STEP;
                const y = TOP_PAD + row * STEP;
                const color = colorMap[status] || 'var(--heatmap-noclass)';
                const tooltip = isInRange && hd
                    ? `${iso}: ${hd.status === 'O' ? 'Present' : hd.status === 'X' ? 'Absent' : hd.status === '/' ? 'Partial' : 'No record'} — ${(hd.classes || []).map(c => escapeHtml(c.class_name)).join(', ')}`
                    : `${iso}: No class`;
                cells.push(`<rect class="heatmap-cell" x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${color}" rx="2" ry="2" aria-label="${escapeHtml(tooltip)}"><title>${escapeHtml(tooltip)}</title></rect>`);
            }
            cur.setDate(cur.getDate() + 1);
            if (cur > end) break;
        }
        col++;
        if (cur > end) break;
    }

    const svgWidth  = Math.max(300, LABEL_W + (col + 1) * STEP + 10);
    const svgHeight = TOP_PAD + 7 * STEP + 20;

    // Day labels
    const dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) =>
        `<text x="${LABEL_W - 4}" y="${TOP_PAD + i * STEP + CELL - 1}" font-size="8" fill="#888" text-anchor="end">${d}</text>`
    ).join('');

    // Legend
    const legend = [['O','Present'],['X','Absent'],['/','Partial'],['','No class']].map(([s, l], i) =>
        `<rect x="${LABEL_W + i * 70}" y="${svgHeight - 16}" width="${CELL}" height="${CELL}" fill="${colorMap[s]}" rx="2"/>
         <text x="${LABEL_W + i * 70 + CELL + 3}" y="${svgHeight - 6}" font-size="9" fill="#666">${escapeHtml(l)}</text>`
    ).join('');

    return `<svg class="heatmap-svg" width="${svgWidth}" height="${svgHeight + 20}" viewBox="0 0 ${svgWidth} ${svgHeight + 20}" role="img" aria-label="Attendance heatmap">
        <title>Attendance heatmap</title>
        ${dayLabels}
        ${cells.join('')}
        ${legend}
    </svg>`;
}

async function exportStudentAttendancePDF(studentId) {
    try {
        const startDate = document.getElementById('attendance-start-date').value;
        const endDate   = document.getElementById('attendance-end-date').value;
        Toast.info('Generating PDF...', 'Please wait');
        const response = await api(`/pdf/student-attendance-report/${studentId}`, {
            method: 'POST',
            body: JSON.stringify({ startDate: normalizeToISO(startDate), endDate: normalizeToISO(endDate) })
        });
        if (response.success && response.downloadUrl) {
            Toast.success('PDF generated!');
            window.open(response.downloadUrl, '_blank');
        } else {
            Toast.error('Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error exporting student PDF:', error);
        if (error.message && error.message.includes('not configured')) {
            Toast.error('PDF export requires Cloudflare R2 configuration.', 'Configuration Required');
        } else {
            Toast.error('Error generating PDF: ' + (error.message || ''));
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2B: CLASS SUMMARY VIEW
// ═══════════════════════════════════════════════════════════════════════════════

async function showClassSummary(classId) {
    if (!classId) {
        classId = document.getElementById('attendance-class-select').value;
        if (!classId) { Toast.error('Please select a class first'); return; }
    }
    try {
        const year = currentAttendanceYear || new Date().getFullYear();
        const data = await api(`/attendance/class-summary/${classId}?year=${year}`);
        const { class: cls, monthlyStats, studentStats, lowestPerformers, overallRate } = data;

        const rateClass = overallRate >= 85 ? 'rate-green' : overallRate >= 65 ? 'rate-yellow' : 'rate-red';

        // Monthly chips
        const monthChips = Object.entries(monthlyStats)
            .filter(([, ms]) => ms.rate !== null)
            .map(([m, ms]) => {
                const rc = ms.rate >= 85 ? 'rate-green' : ms.rate >= 65 ? 'rate-yellow' : 'rate-red';
                return `<span class="monthly-rate-chip ${rc}">${MONTH_NAMES_SHORT[parseInt(m)-1]}: ${ms.rate}%</span>`;
            }).join('');

        // Trend analysis (last 2 months with data)
        const withData = Object.entries(monthlyStats).filter(([, ms]) => ms.rate !== null);
        let trendHtml = '';
        if (withData.length >= 2) {
            const last = withData[withData.length - 1];
            const prev = withData[withData.length - 2];
            const { arrow, delta } = compareMonthlyRates(prev[1].rate, last[1].rate);
            const mn1 = MONTH_NAMES_SHORT[parseInt(prev[0])-1], mn2 = MONTH_NAMES_SHORT[parseInt(last[0])-1];
            trendHtml = `<div style="margin-top:8px;font-size:0.88rem;color:var(--text-secondary);">
                ${arrow} ${mn2}: ${last[1].rate}% vs ${mn1}: ${prev[1].rate}% (${delta >= 0 ? '+' : ''}${delta}%)
            </div>`;
        }

        // Pattern detection
        const patterns = [];
        studentStats.forEach(ss => {
            const recs = []; // We don't have full records here, skip day-pattern detection
            // Just flag low attendance
            if (ss.total > 0 && ss.rate < 65) {
                patterns.push(`⚠️ ${escapeHtml(ss.name)}: ${ss.rate}% attendance`);
            }
        });

        showModal(`📊 Class Summary: ${escapeHtml(cls.name)}`, `
            <div>
                ${overallRate !== null ? `<div class="attendance-rate-cell ${rateClass}" style="padding:8px;border-radius:8px;font-size:1rem;margin-bottom:10px;">Overall ${year}: <strong>${overallRate}%</strong></div>` : ''}
                <h4 style="margin-bottom:6px;">Monthly Rates:</h4>
                <div class="class-summary-monthly">${monthChips || '<em>No data yet</em>'}</div>
                ${trendHtml}
                ${lowestPerformers.length > 0 ? `
                    <h4 style="margin:12px 0 6px;">Lowest Attendance (Bottom 3):</h4>
                    <ul class="lowest-performers-list">
                        ${lowestPerformers.map(lp => `<li><span>${escapeHtml(lp.name)}</span><span>${lp.rate}%</span></li>`).join('')}
                    </ul>
                ` : ''}
                ${patterns.length > 0 ? `
                    <div style="margin-top:10px;padding:8px;background:#fff3cd;border-radius:6px;font-size:0.84rem;">
                        ${patterns.map(p => `<div>${p}</div>`).join('')}
                    </div>
                ` : ''}
                <div style="margin-top:12px;display:flex;gap:8px;">
                    <button class="btn btn-small btn-secondary" onclick="exportClassSummaryPDF(${cls.id})">📄 Export PDF</button>
                </div>
            </div>
        `);
    } catch (error) {
        console.error('Error loading class summary:', error);
        Toast.error('Failed to load class summary');
    }
}

async function exportClassSummaryPDF(classId) {
    try {
        const year = currentAttendanceYear || new Date().getFullYear();
        Toast.info('Generating PDF...', 'Please wait');
        const response = await api(`/pdf/class-summary/${classId}`, {
            method: 'POST',
            body: JSON.stringify({ year })
        });
        if (response.success && response.downloadUrl) {
            Toast.success('PDF generated!');
            window.open(response.downloadUrl, '_blank');
        } else {
            Toast.error('Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error exporting class summary PDF:', error);
        if (error.message && error.message.includes('not configured')) {
            Toast.error('PDF export requires Cloudflare R2 configuration.', 'Configuration Required');
        } else {
            Toast.error('Error generating PDF: ' + (error.message || ''));
        }
    }
}

// Database viewer PDF export helpers (Bug 8 — analytics detail view)
async function dbExportClassSummaryPDF(classId) {
    try {
        const year = new Date().getFullYear();
        Toast.info('Generating PDF...', 'Please wait');
        const response = await api(`/pdf/class-summary/${classId}`, {
            method: 'POST',
            body: JSON.stringify({ year })
        });
        if (response.success && response.downloadUrl) {
            Toast.success('PDF generated!');
            window.open(response.downloadUrl, '_blank');
        } else {
            Toast.error('Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error exporting class summary PDF:', error);
        Toast.error('Error generating PDF: ' + (error.message || ''));
    }
}

async function dbExportAttendanceGridPDF(classId) {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
        Toast.info('Generating PDF...', 'Please wait');
        const response = await api(`/pdf/attendance-grid-enhanced/${classId}`, {
            method: 'POST',
            body: JSON.stringify({ startDate, endDate })
        });
        if (response.success && response.downloadUrl) {
            Toast.success('PDF generated!');
            window.open(response.downloadUrl, '_blank');
        } else {
            Toast.error('Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error exporting attendance grid PDF:', error);
        Toast.error('Error generating PDF: ' + (error.message || ''));
    }
}

async function dbExportStudentAttendancePDF(studentId, year) {
    try {
        const startDate = `${year}-01-01`;
        const endDate   = `${year}-12-31`;
        Toast.info('Generating PDF...', 'Please wait');
        const response = await api(`/pdf/student-attendance-report/${studentId}`, {
            method: 'POST',
            body: JSON.stringify({ startDate, endDate })
        });
        if (response.success && response.downloadUrl) {
            Toast.success('PDF generated!');
            window.open(response.downloadUrl, '_blank');
        } else {
            Toast.error('Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error exporting student attendance PDF:', error);
        Toast.error('Error generating PDF: ' + (error.message || ''));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2C: ENHANCED TEACHER DASHBOARD ATTENDANCE OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

async function loadAttendanceOverview() {
    const container = document.getElementById('attendance-overview-container');
    const monthLabel = document.getElementById('attendance-overview-month');
    if (!container) return;
    try {
        const data = await api('/attendance/teacher-dashboard');
        if (monthLabel) monthLabel.textContent = `— ${data.monthLabel}`;
        if (!data.classes || data.classes.length === 0) {
            container.innerHTML = '<p class="info-text">No classes found</p>';
            return;
        }
        const rateClass = (r) => r >= 85 ? 'rate-green' : r >= 65 ? 'rate-yellow' : 'rate-red';
        container.innerHTML = `<div class="attendance-overview-grid">
            ${data.classes.map(cls => `
                <div class="attendance-overview-class-card" onclick="quickAttendanceLink(${cls.id})" title="Click to view attendance for ${escapeHtml(cls.name)}" style="border-left: 4px solid ${escapeHtml(cls.color || '#667eea')}">
                    <div class="attendance-overview-class-name" style="color:${cls.color || '#667eea'}">${escapeHtml(cls.name)}</div>
                    ${cls.monthlyRate !== null
                        ? `<div class="attendance-overview-rate attendance-rate-cell ${rateClass(cls.monthlyRate)}" style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:1rem;">${cls.monthlyRate}%</div>`
                        : `<div class="attendance-overview-no-data">No data this month</div>`}
                    ${cls.flaggedStudents && cls.flaggedStudents.length > 0
                        ? `<div class="attendance-overview-flagged">⚠️ ${cls.flaggedStudents.map(s => `${escapeHtml(s.name)} (${s.rate}%)`).join(', ')}</div>`
                        : ''}
                </div>
            `).join('')}
        </div>`;
    } catch (error) {
        console.error('Error loading attendance overview:', error);
        if (container) container.innerHTML = '<p class="info-text">Unable to load attendance overview</p>';
    }
}

function quickAttendanceLink(classId) {
    const now = new Date();
    const month = currentAttendanceMonth || (now.getMonth() + 1);
    const year  = currentAttendanceYear  || now.getFullYear();
    selectMonth(month, year);
    document.getElementById('attendance-class-select').value = classId;
    navigateToPage('attendance');
    requestAnimationFrame(() => loadAttendance());
}

async function showNewAttendanceModal() {
    try {
        // Get list of classes
        const allClasses = await api('/classes');
        
        const classOptions = allClasses
            .map(c => `<option value="${c.id}">${escapeHtml(getClassDisplayName(c))}</option>`)
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
                    <textarea id="attendance-notes" class="form-control" rows="3" placeholder="Add notes for this attendance sheet (applies to all students)"></textarea>
                </div>
                <button type="submit" id="create-attendance-submit-btn" class="btn btn-primary">Create Attendance Sheet</button>
            </form>
        `);
        
        const form = document.getElementById('new-attendance-form');
        const submitBtn = document.getElementById('create-attendance-submit-btn');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Prevent duplicate submissions
            if (submitBtn.disabled) {
                return;
            }
            
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
                
                // Disable submit button during request
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating...';
                
                // Get teacher_id from the selected class
                const selectedClass = classes.find(c => c.id == classId);
                const teacherId = selectedClass ? selectedClass.teacher_id : null;
                
                // Get all students in the class
                const studentsInClass = await api(`/students?classId=${classId}`);
                
                if (studentsInClass.length === 0) {
                    Toast.error('No students in this class. Add students first.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Attendance Sheet';
                    return;
                }
                
                // Create attendance records for all students
                // Use sequential creation to better handle errors
                const results = [];
                const errors = [];
                
                for (const student of studentsInClass) {
                    try {
                        const result = await api('/attendance', {
                            method: 'POST',
                            body: JSON.stringify({ 
                                student_id: student.id,
                                class_id: classId, 
                                date: normalizedDate, 
                                status: '', // Empty status - to be filled in
                                notes: notes || '',
                                teacher_id: teacherId
                            })
                        });
                        results.push(result);
                    } catch (error) {
                        // Collect errors but continue creating for other students
                        errors.push({ student: student.name, error: error.message });
                    }
                }
                
                // Show appropriate success/error message
                if (errors.length === 0) {
                    Toast.success(`Attendance sheet created for ${studentsInClass.length} students!`);
                    closeModal();
                } else if (results.length > 0) {
                    Toast.error(`Created for ${results.length} students, but ${errors.length} failed. Some records may already exist.`);
                } else {
                    Toast.error('Failed to create attendance sheet. Records may already exist for this date.');
                }
                
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
            // Apply class color accent to metadata section (Part 4)
            const accentColor = selectedClass.color || '#4472C4';
            metadataDiv.style.borderLeftColor = accentColor;
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

        // Part 4B: Update Quick Mark button visibility
        updateQuickMarkButtonVisibility();

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
    const { students, dates: allDates, attendance } = data;

    // ── Part 1C: Schedule-filtered dates ────────────────────────────────────────
    // Get schedule dates for the class
    const selectedClass = classes.find(c => c.id == classId);
    let scheduleDatesSet = new Set();
    if (selectedClass && selectedClass.schedule) {
        const sched = selectedClass.schedule.toLowerCase();
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        const dayAbbr  = ['sun','mon','tue','wed','thu','fri','sat'];
        const scheduledDays = [];
        dayNames.forEach((d, i) => { if (sched.includes(d) || sched.includes(dayAbbr[i])) scheduledDays.push(i); });
        allDates.forEach(date => {
            const d = new Date(date + 'T00:00:00').getDay();
            if (scheduledDays.includes(d)) scheduleDatesSet.add(date);
        });
    }

    // Filter dates based on toggle
    let dates;
    if (showScheduleDatesOnly && scheduleDatesSet.size > 0) {
        dates = allDates.filter(d => scheduleDatesSet.has(d));
    } else {
        dates = allDates;
    }

    // Update quick mark button visibility
    updateQuickMarkButtonVisibility();

    // Separate regular and trial students
    const regularStudents = students.filter(s => s.student_type === 'regular');
    const trialStudents = students.filter(s => s.student_type !== 'regular');

    // ── Part 1D: Per-student rate calculation ─────────────────────────────────
    const getStudentRate = (student) => {
        let present = 0, total = 0;
        dates.forEach(date => {
            const key = `${student.id}-${date}`;
            const status = attendance[key] || '';
            if (status) { total++; if (status === 'O') present++; }
        });
        return { present, total, rate: total > 0 ? Math.round((present / total) * 100) : null };
    };

    const colSpan = dates.length + 2; // +2 for name + rate columns

    let html = `<table class="attendance-table" role="grid" aria-label="Attendance table">
<thead><tr>
    <th>Student Name</th>`;
    
    dates.forEach(date => {
        const normalizedDate = normalizeToISO(date) || date;
        let formattedDate;
        try {
            const dateObj = new Date(normalizedDate + 'T00:00:00');
            formattedDate = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : normalizedDate;
        } catch (e) { formattedDate = normalizedDate; }

        // ── Makeup/extra date detection (★ badge) ────────────────────────
        const isMakeup = scheduleDatesSet.size > 0 && !scheduleDatesSet.has(date);
        const headerClass = isMakeup ? ' class="makeup-date-header"' : '';
        const star = isMakeup ? '<span class="makeup-star" title="Extra/makeup date">★</span>' : '';
        html += `<th${headerClass}>${formattedDate}${star}</th>`;
    });
    html += '<th style="min-width:70px;">Rate</th></tr></thead><tbody>';

    // ── Render a section of students ────────────────────────────────────────
    const renderSection = (sectionStudents, sectionTitle) => {
        if (sectionStudents.length === 0) return '';
        let s = `<tr><td colspan="${colSpan}" class="student-type-header">${sectionTitle}</td></tr>`;
        sectionStudents.forEach(student => {
            const rowClass = (student.color_code && !student.color_code.startsWith('#')) ? `student-row-${student.color_code}` : '';
            const rowStyle = (student.color_code && student.color_code.startsWith('#')) ? ` style="background: ${student.color_code}"` : '';
            const colorDot = getStudentColorDot(student.color_code);
            s += `<tr class="${rowClass}"${rowStyle}><td class="student-name">
                <div class="student-name-cell">
                    <span>${colorDot}${escapeHtml(student.name)}</span>
                    <button class="edit-student-btn" onclick="editStudentFromAttendance(${student.id})" title="Edit student" aria-label="Edit ${escapeHtml(student.name)}">✏️</button>
                    <button class="edit-student-btn" onclick="viewStudentAttendanceSummary(${student.id})" title="View attendance summary" aria-label="View attendance for ${escapeHtml(student.name)}">📊</button>
                </div>
            </td>`;
            
            dates.forEach(date => {
                const key = `${student.id}-${date}`;
                const status = attendance[key] || '';
                const statusClass = status === 'O' ? 'present' : status === 'X' ? 'absent' : status === '/' ? 'partial' : '';
                s += `<td class="attendance-cell ${statusClass}" 
                    data-student="${student.id}" 
                    data-class="${classId}" 
                    data-date="${date}"
                    role="gridcell"
                    tabindex="-1"
                    onclick="toggleAttendance(this)">${status}</td>`;
            });

            // ── Part 1D: Summary column ───────────────────────────────────
            const { present, total, rate } = getStudentRate(student);
            const rateClass = rate === null ? '' : rate >= 85 ? 'rate-green' : rate >= 65 ? 'rate-yellow' : 'rate-red';
            s += `<td class="attendance-rate-cell ${rateClass}" title="${present} present out of ${total}">`;
            if (rate !== null) s += `${present}/${total}<br><small>${rate}%</small>`;
            else s += '—';
            s += '</td></tr>';
        });
        return s;
    };

    html += renderSection(regularStudents, 'Regular Students');
    html += renderSection(trialStudents, 'Make-up / Trial Students');

    // ── Part 1D: Summary row (present count per column) ──────────────────────
    if (dates.length > 0) {
        html += `<tr class="attendance-summary-row"><td class="summary-label-cell">Present / Total</td>`;
        dates.forEach(date => {
            const presentCount = students.filter(s => (attendance[`${s.id}-${date}`] || '') === 'O').length;
            const totalCount   = students.length;
            html += `<td title="${date}: ${presentCount} present">${presentCount}/${totalCount}</td>`;
        });
        html += '<td></td></tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Render attendance data in a compact grid view optimized for multi-date display
function renderAttendanceGridView(data, classId) {
    const container = document.getElementById('attendance-container');
    const { students, dates: allDates, attendance } = data;

    // ── Schedule-filtered dates (mirrors renderAttendanceTable Part 1C) ─────────
    const selectedClass = classes.find(c => c.id == classId);
    let scheduleDatesSet = new Set();
    if (selectedClass && selectedClass.schedule) {
        const sched = selectedClass.schedule.toLowerCase();
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        const dayAbbr  = ['sun','mon','tue','wed','thu','fri','sat'];
        const scheduledDays = [];
        dayNames.forEach((d, i) => { if (sched.includes(d) || sched.includes(dayAbbr[i])) scheduledDays.push(i); });
        allDates.forEach(date => {
            const d = new Date(date + 'T00:00:00').getDay();
            if (scheduledDays.includes(d)) scheduleDatesSet.add(date);
        });
    }

    let dates;
    if (showScheduleDatesOnly && scheduleDatesSet.size > 0) {
        dates = allDates.filter(d => scheduleDatesSet.has(d));
    } else {
        dates = allDates;
    }

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
                <div class="student-grid-card ${student.color_code && !student.color_code.startsWith('#') ? `student-card-${student.color_code}` : ''}" ${student.color_code && student.color_code.startsWith('#') ? `style="background: ${student.color_code}"` : ''}>
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
                            return `<span class="date-cell ${statusClass} attendance-cell" 
                                data-student="${student.id}" 
                                data-class="${classId}" 
                                data-date="${date}"
                                onclick="toggleAttendance(this)" 
                                title="${shortDate}: Click to mark attendance">${status || ''}</span>`;
                        }).join('')}
                        ${dates.length > 10 ? `<span class="more-dates">+${dates.length - 10}</span>` : ''}
                    </div>
                    <div class="student-card-actions">
                        <button class="btn btn-small btn-secondary" onclick="navigateToStudentProfile(${student.id})" title="View student profile">📊</button>
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
// Part 2A: Replaced with enhanced summary view that uses the new API endpoint
async function viewStudentDetail(studentId, classId) {
    // Use the new enhanced student summary view
    await viewStudentAttendanceSummary(studentId);
}

// Navigate to the Students Profile page and auto-select the given student
function navigateToStudentProfile(studentId) {
    navigateToPage('students-profile');
    // Show student detail immediately; the page activation is synchronous
    showStudentDetail(studentId);
}

// Recalculate and update the rate cell for the student row in the DOM.
// Uses the visible attendance cells to determine the current date set,
// and reads statuses from the in-memory lastAttendanceData.attendance map.
function updateStudentRateCell(row) {
    if (!row || !lastAttendanceData || !lastAttendanceData.attendance) return;
    const firstCell = row.querySelector('.attendance-cell');
    if (!firstCell) return;
    const studentId = firstCell.dataset.student;
    const cells = row.querySelectorAll('.attendance-cell');
    let present = 0, total = 0;
    cells.forEach(c => {
        const date = c.dataset.date;
        const status = lastAttendanceData.attendance[`${studentId}-${date}`] || '';
        if (status) { total++; if (status === 'O') present++; }
    });
    const rate = total > 0 ? Math.round((present / total) * 100) : null;
    const rateClass = rate === null ? '' : rate >= 85 ? 'rate-green' : rate >= 65 ? 'rate-yellow' : 'rate-red';
    const rateCell = row.querySelector('.attendance-rate-cell');
    if (!rateCell) return;
    rateCell.className = `attendance-rate-cell ${rateClass}`;
    rateCell.title = `${present} present out of ${total}`;
    rateCell.innerHTML = rate !== null ? `${present}/${total}<br><small>${rate}%</small>` : '—';
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

    // Get teacher_id from the selected class
    const selectedClass = classes.find(c => c.id == classId);
    const teacherId = selectedClass ? selectedClass.teacher_id : null;

    // Get student name for undo toast
    const row = cell.closest('tr');
    const nameCell = row ? row.querySelector('.student-name') : null;
    const studentName = nameCell ? nameCell.textContent.replace(/[✏️📊]/g, '').trim() : 'Student';

    // Snapshot for undo (Part 4A)
    const prevStatus   = currentStatus;
    const prevClass    = cell.className;

    // Optimistic UI update - update immediately without waiting for server
    cell.textContent = newStatus;
    cell.className = 'attendance-cell';
    if (newStatus === 'O') cell.classList.add('present');
    else if (newStatus === 'X') cell.classList.add('absent');
    else if (newStatus === '/') cell.classList.add('partial');

    try {
        // Normalize date to ISO format before queueing
        const normalizedDate = normalizeToISO(date) || date;

        // Keep in-memory data in sync so getStudentRate() sees the latest status
        if (lastAttendanceData && lastAttendanceData.attendance) {
            lastAttendanceData.attendance[`${studentId}-${normalizedDate}`] = newStatus;
        }

        // Update the rate cell in the DOM immediately
        updateStudentRateCell(row);

        // Add to save queue with debouncing, including teacher_id
        AttendanceSaveQueue.add(studentId, classId, normalizedDate, newStatus, null, teacherId);

        // Batch undo toasts to avoid spam when marking rapidly
        const statusLabel = { 'O': 'Present', 'X': 'Absent', '/': 'Partial', '': 'Cleared' };
        const dateLabel = date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const undoCallback = () => {
            // Undo: remove from queue and revert UI
            const key = `${studentId}-${classId}-${normalizeToISO(date) || date}`;
            AttendanceSaveQueue.queue.delete(key);
            // Re-queue the previous status
            AttendanceSaveQueue.add(studentId, classId, normalizeToISO(date) || date, prevStatus, null, teacherId);
            // Revert in-memory data
            if (lastAttendanceData && lastAttendanceData.attendance) {
                lastAttendanceData.attendance[`${studentId}-${normalizeToISO(date) || date}`] = prevStatus;
            }
            // Revert UI
            cell.textContent = prevStatus;
            cell.className = prevClass;
            // Update rate cell after undo
            updateStudentRateCell(row);
        };
        attendanceToastBatch.push({
            message: `✓ Marked ${studentName} as ${statusLabel[newStatus] || newStatus}${dateLabel ? ' for ' + dateLabel : ''}`,
            undoCallback
        });
        if (attendanceToastTimer) clearTimeout(attendanceToastTimer);
        attendanceToastTimer = setTimeout(() => {
            attendanceToastTimer = null;
            flushAttendanceToastBatch();
        }, TOAST_BATCH_WINDOW);
        
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
                        ${classes.map(c => `<option value="${c.id}" ${c.id == student.class_id ? 'selected' : ''}>${escapeHtml(getClassDisplayName(c))}</option>`).join('')}
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
                    <input type="hidden" id="edit-student-color">
                    <div id="edit-student-color-wheel" style="margin-bottom:8px;"></div>
                    <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
                        <span id="edit-student-color-preview" style="padding:8px 16px;border-radius:4px;font-size:12px;">Preview</span>
                        <button type="button" class="btn btn-small btn-secondary" id="edit-student-color-clear">Clear</button>
                    </div>
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

        initStudentColorPicker('edit-student-color', 'edit-student-color-preview', 'edit-student-color-clear', student.color_code);

        document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                await api(`/students/${studentId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: document.getElementById('edit-student-name').value,
                        class_id: document.getElementById('edit-student-class').value || null,
                        student_type: document.getElementById('edit-student-type').value,
                        color_code: getStudentColorInputValue('edit-student-color'),
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
    // Part 4G: Show PDF preview modal instead of directly exporting
    showPDFPreviewModal();
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
            document.getElementById('report-form-date').value = normalizeToISO(report.date) || report.date;
            document.getElementById('report-teacher').value = report.teacher_id;
            document.getElementById('report-class').value = report.class_id;
            document.getElementById('report-target').value = report.target_topic || '';
            document.getElementById('report-vocabulary').value = report.vocabulary || '';
            document.getElementById('report-phrases').value = report.phrases || '';
            document.getElementById('report-mistakes').value = report.mistakes || '';
            document.getElementById('report-strengths').value = report.strengths || '';
            document.getElementById('report-comments').value = report.comments || '';
            document.getElementById('report-others').value = report.others || '';
            document.getElementById('delete-report-btn').style.display = 'inline-block';
            document.getElementById('export-report-pdf-btn').style.display = 'inline-block';
            document.getElementById('report-form-container').style.display = 'block';
            document.getElementById('reports-list-container').style.display = 'none';
            setFormDirty(false);
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
            setFormDirty(false);
            restoreDraftIfAvailable();
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
        phrases: document.getElementById('report-phrases').value,
        mistakes: document.getElementById('report-mistakes').value,
        strengths: document.getElementById('report-strengths').value,
        comments: document.getElementById('report-comments').value,
        others: document.getElementById('report-others').value
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

        setFormDirty(false);
        clearDraft();
        Toast.success('Report saved successfully!');
        document.getElementById('report-form-container').style.display = 'none';
        document.getElementById('reports-list-container').style.display = 'block';
        loadReportsList();
    } catch (error) {
        Toast.error('Error saving report: ' + error.message);
    }
});

// Track dirty state and auto-save for comment sheet form
['report-form-date', 'report-class', 'report-teacher', 'report-target',
 'report-vocabulary', 'report-phrases', 'report-mistakes', 'report-strengths', 'report-comments', 'report-others'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        setFormDirty(true);
        scheduleDraftSave();
    });
});

document.getElementById('delete-report-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this comment sheet?')) return;

    const reportId = document.getElementById('report-id').value;
    
    try {
        await api(`/teacher-comment-sheets/${reportId}`, { method: 'DELETE' });
        Toast.success('Comment sheet deleted successfully!');
        document.getElementById('report-form-container').style.display = 'none';
        document.getElementById('reports-list-container').style.display = 'block';
        loadReportsList();
    } catch (error) {
        Toast.error('Error deleting comment sheet: ' + error.message);
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
    const container = document.getElementById('reports-list');
    container.innerHTML = '<span class="skeleton skeleton-row"></span><span class="skeleton skeleton-row"></span><span class="skeleton skeleton-row"></span>';
    try {
        const reports = await api('/teacher-comment-sheets');
        
        if (reports.length === 0) {
            container.innerHTML = '<p class="info-text">No reports found</p>';
            return;
        }

        container.innerHTML = reports.map(report => {
            const classColorStyle = report.class_color 
                ? `border-left: 4px solid ${escapeHtml(report.class_color)}; padding-left: 10px;` 
                : '';
            const classColorAttr = report.class_color 
                ? ` style="color: ${escapeHtml(report.class_color)}; font-weight: 600;"` 
                : '';
            return `
            <div class="report-item" style="${classColorStyle}">
                <div class="report-header">
                    <span class="report-date">${formatDisplayDate(report.date)}</span>
                    <span class="report-class"${classColorAttr}>${escapeHtml(report.class_name)}</span>
                </div>
                <div><strong>Teacher:</strong> ${escapeHtml(report.teacher_name)}</div>
                <div><strong>Topic:</strong> ${escapeHtml(report.target_topic || 'N/A')}</div>
                <div class="report-item-actions" style="margin-top:6px;">
                    <button class="btn btn-small btn-primary" onclick="loadReportById(${report.id})">✏️ Edit</button>
                    <button class="btn btn-small btn-secondary" onclick="exportSinglePDF('teacher_comment_sheets', ${report.id})">📄 PDF</button>
                    <button class="btn btn-small btn-danger" onclick="deleteTeacherCommentSheetInline(${report.id})">🗑️ Delete</button>
                </div>
            </div>
        `}).join('');
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

async function deleteTeacherCommentSheetInline(id) {
    if (!confirm('Are you sure you want to delete this comment sheet?')) return;
    try {
        await api(`/teacher-comment-sheets/${id}`, { method: 'DELETE' });
        Toast.success('Comment sheet deleted successfully!');
        loadReportsList();
    } catch (error) {
        Toast.error('Error deleting comment sheet: ' + error.message);
    }
}

async function loadReportById(id) {
    try {
        const report = await api(`/reports/${id}`);
        document.getElementById('report-id').value = report.id;
        document.getElementById('report-form-date').value = normalizeToISO(report.date) || report.date;
        document.getElementById('report-teacher').value = report.teacher_id;
        document.getElementById('report-class').value = report.class_id;
        document.getElementById('report-target').value = report.target_topic || '';
        document.getElementById('report-vocabulary').value = report.vocabulary || '';
        document.getElementById('report-phrases').value = report.phrases || '';
        document.getElementById('report-mistakes').value = report.mistakes || '';
        document.getElementById('report-strengths').value = report.strengths || '';
        document.getElementById('report-comments').value = report.comments || '';
        document.getElementById('report-others').value = report.others || '';
        document.getElementById('delete-report-btn').style.display = 'inline-block';
        document.getElementById('export-report-pdf-btn').style.display = 'inline-block';
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
                <label for="class-${cls.id}">${escapeHtml(getClassDisplayName(cls))}</label>
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
        grid.innerHTML = '<span class="skeleton skeleton-card"></span><span class="skeleton skeleton-card"></span><span class="skeleton skeleton-card"></span>';
        
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
    
    // Flatten all reports from all classes into a single list
    const allReports = [];
    classReports.forEach(({ classInfo, reports }) => {
        reports.forEach(report => {
            allReports.push({
                ...report,
                className: classInfo.name,
                classColor: classInfo.color
            });
        });
    });
    
    // Sort by date (newest first)
    allReports.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Render as a clean table/list view
    grid.innerHTML = `
        <div class="all-reports-header">
            <h3>All Reports (${allReports.length})</h3>
        </div>
        <div class="all-reports-list">
            <table class="reports-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Class</th>
                        <th>Teacher</th>
                        <th>Topic</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allReports.map(report => `
                        <tr class="report-row">
                            <td class="report-date">${formatDisplayDate(report.date)}</td>
                            <td class="report-class">
                                <span class="class-badge ${report.classColor}">${escapeHtml(report.className)}</span>
                            </td>
                            <td class="report-teacher">${escapeHtml(report.teacher_name)}</td>
                            <td class="report-topic">${escapeHtml(report.target_topic || 'No topic specified')}</td>
                            <td class="report-actions">
                                <button class="btn btn-small btn-primary" onclick="viewReportDetails(${report.id})" title="Edit Report">
                                    ✏️ Edit
                                </button>
                                <button class="btn btn-small btn-secondary" onclick="exportSinglePDF('teacher_comment_sheets', ${report.id})" title="Export PDF">
                                    📄 PDF
                                </button>
                                <button class="btn btn-small btn-danger" onclick="deleteTeacherCommentSheetInline(${report.id})" title="Delete">
                                    🗑️
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
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

// Tab navigation - scoped to the containing .page so that clicking a tab on one page
// (e.g. Admin "Classes") does not deactivate tabs on a different page (e.g. Reports "Single Report").
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        const page = e.target.closest('.page') || document;

        // Update tab buttons within the same page only
        page.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
        });

        // Update tab content within the same page only
        page.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

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
            const colorDot = getStudentColorDot(student.color_code);
            html += `
                <tr>
                    <td>${colorDot}${student.name}</td>
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
                    <td>${(cls.teacher_name && cls.teacher_role !== 'admin') ? cls.teacher_name : 'Unassigned'}</td>
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
                    ${classes.map(c => `<option value="${c.id}">${escapeHtml(getClassDisplayName(c))}</option>`).join('')}
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
                <input type="hidden" id="student-color" data-cleared="true">
                <div id="student-color-wheel" style="margin-bottom:8px;"></div>
                <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
                    <span id="student-color-preview" style="padding:8px 16px;border-radius:4px;background:transparent;font-size:12px;">None</span>
                    <button type="button" class="btn btn-small btn-secondary" id="student-color-clear">Clear</button>
                </div>
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

    initStudentColorPicker('student-color', 'student-color-preview', 'student-color-clear', null);

    document.getElementById('student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            await api('/students', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('student-name').value,
                    class_id: document.getElementById('student-class').value || null,
                    student_type: document.getElementById('student-type').value,
                    color_code: getStudentColorInputValue('student-color'),
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
                        ${classes.map(c => `<option value="${c.id}" ${c.id == student.class_id ? 'selected' : ''}>${escapeHtml(getClassDisplayName(c))}</option>`).join('')}
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
                    <input type="hidden" id="edit-student-color">
                    <div id="edit-student-color-wheel" style="margin-bottom:8px;"></div>
                    <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
                        <span id="edit-student-color-preview" style="padding:8px 16px;border-radius:4px;font-size:12px;">Preview</span>
                        <button type="button" class="btn btn-small btn-secondary" id="edit-student-color-clear">Clear</button>
                    </div>
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

        initStudentColorPicker('edit-student-color', 'edit-student-color-preview', 'edit-student-color-clear', student.color_code);

        document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                await api(`/students/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: document.getElementById('edit-student-name').value,
                        class_id: document.getElementById('edit-student-class').value || null,
                        student_type: document.getElementById('edit-student-type').value,
                        color_code: getStudentColorInputValue('edit-student-color'),
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
                       placeholder="e.g., Adult Beginners" autofocus>
                <small class="form-hint">Give your class a descriptive name</small>
            </div>
            <div class="form-group">
                <label>Teacher (Optional)</label>
                <select id="class-teacher" class="form-control">
                    <option value="">Current user (default)</option>
                    ${teachers.map(t => `<option value="${t.id}">${escapeHtml(t.full_name)}</option>`).join('')}
                </select>
                <small class="form-hint">Defaults to you if not selected</small>
            </div>
            <div class="form-group">
                <label>Schedule (Optional)</label>
                <div id="add-cls-schedule-picker">
                    ${buildSchedulePickerHTML(null, 'add-cls')}
                </div>
                <small class="form-hint">Select days and times, or leave blank to add later</small>
            </div>
            <div class="form-group">
                <label>Color (Optional)</label>
                <div id="class-color-wheel" style="margin-bottom:8px;"></div>
                <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
                    <span id="color-preview" style="padding:8px 16px;border-radius:4px;background:#4285f4;color:white;font-size:12px;">Preview</span>
                </div>
                <small class="form-hint">Drag the wheel or slider to pick any color</small>
            </div>
            <button type="submit" class="btn btn-primary">Add Class</button>
        </form>
    `);

    // Mount the always-visible color wheel
    const getAddColor = initClassColorWheel('class-color-wheel', '#4285f4', (hex) => {
        const preview = document.getElementById('color-preview');
        if (preview) {
            preview.style.background = hex;
            preview.style.color = getContrastTextColor(hex);
        }
    });

    document.getElementById('class-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const schedule = getScheduleFromPicker('add-cls', null);
            const result = await api('/classes', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('class-name').value,
                    teacher_id: document.getElementById('class-teacher').value || null,
                    schedule: schedule,
                    color: getAddColor()
                })
            });

            // Surface any double-booking warning returned by the server
            if (result && result.warning) {
                Toast.warning(result.warning);
            } else {
                Toast.success('Class created successfully!');
            }
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
        const legacySchedule = cls.schedule || null;
        
        showModal('Edit Class', `
            <form id="edit-class-form">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="edit-class-name" value="${escapeHtml(cls.name)}" required class="form-control">
                </div>
                <div class="form-group">
                    <label>Teacher</label>
                    <select id="edit-class-teacher" class="form-control">
                        <option value="">Unassigned</option>
                        ${teachers.map(t => `<option value="${t.id}" ${t.id == cls.teacher_id ? 'selected' : ''}>${escapeHtml(t.full_name)}</option>`).join('')}
                    </select>
                    <small class="form-hint">Changing teacher does not affect past attendance or reports</small>
                </div>
                <div class="form-group">
                    <label>Schedule</label>
                    <div id="edit-cls-schedule-picker">
                        ${buildSchedulePickerHTML(legacySchedule, 'edit-cls')}
                    </div>
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <div id="edit-class-color-wheel" style="margin-bottom:8px;"></div>
                    <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
                        <span id="edit-color-preview" style="padding:8px 16px;border-radius:4px;background:${escapeHtml(cls.color || '#4285f4')};color:white;font-size:12px;">Preview</span>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Update Class</button>
            </form>
        `);

        const initialEditColor = cls.color || '#4285f4';

        // Mount the always-visible color wheel with the class's current color
        const getEditColor = initClassColorWheel('edit-class-color-wheel', initialEditColor, (hex) => {
            const prev = document.getElementById('edit-color-preview');
            if (prev) {
                prev.style.background = hex;
                prev.style.color = getContrastTextColor(hex);
            }
        });

        // Set initial preview text color
        const editPreview = document.getElementById('edit-color-preview');
        if (editPreview) editPreview.style.color = getContrastTextColor(initialEditColor);

        document.getElementById('edit-class-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const schedule = getScheduleFromPicker('edit-cls', legacySchedule);
                const result = await api(`/classes/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: document.getElementById('edit-class-name').value,
                        teacher_id: document.getElementById('edit-class-teacher').value || null,
                        schedule: schedule,
                        color: getEditColor(),
                        active: 1
                    })
                });

                // Surface any double-booking warning returned by the server
                if (result && result.warning) {
                    Toast.warning(result.warning);
                }
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
document.getElementById('db-export-csv-btn')?.addEventListener('click', exportDatabaseTable);

// Store current search results globally for PDF export
let currentSearchResults = null;
let searchAbortController = null;

// Auto-search with debounce
let searchTimeout;
document.getElementById('db-search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchDatabase();
    }, 300); // 300ms debounce
});

// Filter pill functionality
document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', function() {
        // Remove active class from all pills
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        // Add active class to clicked pill
        this.classList.add('active');
        // Update hidden type field
        const type = this.getAttribute('data-type');
        document.getElementById('db-search-type').value = type;
        // Analytics tab has its own loader
        if (type === 'analytics') {
            loadAttendanceAnalytics();
        } else {
            searchDatabase();
        }
    });
});

// Attendance Analytics dashboard for the Database page
// Render per-class attendance view for the Data Hub search results
function renderAttendanceClassView(results) {
    const records = results.attendance || [];
    if (records.length === 0) return '';

    // Group records by class_id (fall back to class_name only for display)
    const classMap = new Map();
    records.forEach(r => {
        const key = r.class_id != null ? r.class_id : `name:${r.class_name}`;
        if (!classMap.has(key)) {
            classMap.set(key, { id: r.class_id, name: r.class_name, teacher_name: r.teacher_name, records: [] });
        }
        classMap.get(key).records.push(r);
    });

    let html = `<h3>Attendance by Class (${classMap.size} class${classMap.size !== 1 ? 'es' : ''}, ${records.length} records)</h3>`;
    html += '<div class="datahub-class-card-grid">';

    classMap.forEach((cls) => {
        const present = cls.records.filter(r => r.status === 'O').length;
        const total = cls.records.length;
        const rate = total > 0 ? Math.round((present / total) * 100) : null;
        const rateLabel = rate !== null ? `${rate}%` : '—';
        const rateClass = rate === null ? '' : rate >= 85 ? 'rate-green' : rate >= 65 ? 'rate-yellow' : 'rate-red';

        // Get class metadata (color, schedule) from global classes array
        const classInfo = classes.find(c => c.id === cls.id) || {};
        const accentColor = classInfo.color || '#667eea';
        const schedule = classInfo.schedule || '';
        const scheduleDisplay = schedule ? schedule : '';

        // Per-student attendance rates for flagged students (<75%)
        const studentMap = new Map();
        cls.records.forEach(r => {
            if (r.student_id == null) return;
            if (!studentMap.has(r.student_id)) studentMap.set(r.student_id, { name: r.student_name || '', present: 0, total: 0 });
            const s = studentMap.get(r.student_id);
            s.total++;
            if (r.status === 'O') s.present++;
        });
        const studentCount = studentMap.size;
        const flagged = [...studentMap.values()].filter(s => s.total > 0 && Math.round((s.present / s.total) * 100) < 75);

        html += `
            <div class="datahub-class-card" style="border-left: 4px solid ${escapeHtml(accentColor)};" data-class-id="${cls.id}">
                <div class="datahub-card-header" onclick="toggleDataHubClassExpand(${cls.id}, this)">
                    <div>
                        <div class="datahub-card-name">${escapeHtml(cls.name || '—')}</div>
                        <div class="datahub-card-teacher">${escapeHtml(cls.teacher_name || classInfo.teacher_name || '')}</div>
                        ${scheduleDisplay ? `<div class="datahub-card-schedule">${escapeHtml(scheduleDisplay)}</div>` : ''}
                    </div>
                    <div class="datahub-card-stats">
                        <span class="datahub-card-rate ${rateClass}">${rateLabel}</span>
                        <span class="datahub-card-student-count">${studentCount} student${studentCount !== 1 ? 's' : ''}</span>
                        ${flagged.length > 0 ? `<span class="datahub-card-flagged">⚠️ ${flagged.length} low attendance</span>` : ''}
                    </div>
                </div>
                <div class="datahub-card-actions">
                    <button class="btn btn-small btn-primary" onclick="event.stopPropagation();quickAttendanceLink(${cls.id})" title="View/Edit attendance">📊 View</button>
                    <button class="btn btn-small btn-secondary" onclick="event.stopPropagation();dbDataHubPDFMonthPicker(${cls.id}, this)" title="Export PDF">📄 PDF</button>
                    <button class="btn btn-small btn-secondary" onclick="event.stopPropagation();quickAttendanceLink(${cls.id})" title="Edit attendance">✏️ Edit</button>
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation();dbBulkDeleteAttendance(${cls.id})" title="Delete attendance records">🗑️ Delete</button>
                </div>
                <div class="datahub-card-expanded" id="datahub-expand-${cls.id}" style="display:none;">
                    <div class="datahub-student-list">
                        ${[...studentMap.entries()].sort((a, b) => {
                            const ra = a[1].total > 0 ? Math.round((a[1].present / a[1].total) * 100) : 0;
                            const rb = b[1].total > 0 ? Math.round((b[1].present / b[1].total) * 100) : 0;
                            return ra - rb;
                        }).map(([sid, s]) => {
                            const sRate = s.total > 0 ? Math.round((s.present / s.total) * 100) : null;
                            const sCls = sRate === null ? '' : sRate >= 85 ? 'rate-green' : sRate >= 65 ? 'rate-yellow' : 'rate-red';
                            return `<div class="datahub-student-row">
                                <span class="datahub-student-name">${escapeHtml(s.name)}</span>
                                <span class="datahub-student-rate ${sCls}">${sRate !== null ? sRate + '%' : '—'}</span>
                                <span class="datahub-student-detail">${s.present}/${s.total}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
    });

    html += '</div><br>';
    return html;
}

function toggleDataHubClassExpand(classId, headerEl) {
    const expandEl = document.getElementById(`datahub-expand-${classId}`);
    if (!expandEl) return;
    const isOpen = expandEl.style.display !== 'none';
    expandEl.style.display = isOpen ? 'none' : 'block';
    const card = expandEl.closest('.datahub-class-card');
    if (card) card.classList.toggle('expanded', !isOpen);
}

function dbDataHubPDFMonthPicker(classId, btn) {
    // Toggle an inline month/year select + Go button for PDF generation
    const existing = btn.parentNode.querySelector('.datahub-pdf-month-select');
    if (existing) {
        const existingGo = btn.parentNode.querySelector('.datahub-pdf-go-btn');
        if (existingGo) existingGo.remove();
        existing.remove();
        return;
    }
    const now = new Date();
    const select = document.createElement('select');
    select.className = 'form-control datahub-pdf-month-select';
    select.style.cssText = 'width:145px;display:inline-block;margin-left:4px;';
    select.setAttribute('title', 'Select month for PDF');
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), i, 1);
        const opt = document.createElement('option');
        opt.value = `${d.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
        opt.textContent = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (i === now.getMonth()) opt.selected = true;
        select.appendChild(opt);
    }

    const goBtn = document.createElement('button');
    goBtn.className = 'btn btn-small btn-primary datahub-pdf-go-btn';
    goBtn.textContent = '📥 Go';
    goBtn.title = 'Generate PDF for selected month';

    const generatePdf = async () => {
        const [yr, mo] = select.value.split('-');
        const startDate = `${yr}-${mo}-01`;
        const lastDay = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const endDate = `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`;
        select.remove();
        goBtn.remove();
        try {
            Toast.info('Generating PDF...', 'Please wait');
            const response = await api(`/pdf/attendance-grid-enhanced/${classId}`, {
                method: 'POST',
                body: JSON.stringify({ startDate, endDate })
            });
            if (response.success && response.downloadUrl) {
                Toast.success('PDF generated!');
                window.open(response.downloadUrl, '_blank');
            } else {
                Toast.error('Failed to generate PDF');
            }
        } catch (error) {
            Toast.error('Error generating PDF: ' + (error.message || ''));
        }
    };

    goBtn.addEventListener('click', generatePdf);

    btn.parentNode.insertBefore(select, btn.nextSibling);
    btn.parentNode.insertBefore(goBtn, select.nextSibling);
    select.focus();
}

async function dbBulkDeleteAttendance(classId) {
    const classInfo = classes.find(c => c.id === classId) || {};
    const className = classInfo.name || `Class ${classId}`;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    if (!confirm(`Delete all attendance records for "${className}" in ${monthName} ${year}? This cannot be undone.`)) return;

    try {
        Toast.info('Deleting...', 'Please wait');
        const response = await api('/attendance/bulk-delete', {
            method: 'DELETE',
            body: JSON.stringify({ classId, startDate, endDate, confirm: true })
        });
        Toast.success(`Deleted ${response.deletedCount} record${response.deletedCount !== 1 ? 's' : ''} for ${className}`);
        searchDatabase();
    } catch (error) {
        console.error('Error bulk deleting attendance:', error);
        Toast.error('Failed to delete records: ' + (error.message || ''));
    }
}

async function loadAttendanceAnalytics() {
    const container = document.getElementById('db-viewer-container');
    container.innerHTML = '<p class="info-text">Loading analytics...</p>';
    try {
        const dashboard = await api('/attendance/teacher-dashboard');
        const classRows = dashboard.classes || [];

        if (classRows.length === 0) {
            container.innerHTML = '<p class="info-text">No attendance data found.</p>';
            return;
        }

        let html = '<div class="attendance-analytics">';
        html += '<h3 style="margin-bottom:12px;">📊 Attendance Analytics</h3>';
        html += '<div class="analytics-class-grid">';

        classRows.forEach(cls => {
            const rate = cls.monthlyRate;
            const rateLabel = rate !== null ? `${rate}%` : '—';
            const rateClass = rate === null ? '' : rate >= 85 ? 'rate-green' : rate >= 65 ? 'rate-yellow' : 'rate-red';
            html += `
                <div class="analytics-class-card" onclick="loadClassAnalyticsDetail(${cls.id})" style="cursor:pointer;">
                    <div class="analytics-class-name">${escapeHtml(cls.name)}</div>
                    <div class="analytics-class-teacher">${escapeHtml(cls.teacher_name || '')}</div>
                    <div class="analytics-class-rate ${rateClass}">${rateLabel} <small>this month</small></div>
                    ${cls.flaggedStudents && cls.flaggedStudents.length > 0 ? `<div class="analytics-class-flagged">⚠️ ${cls.flaggedStudents.length} low attendance</div>` : ''}
                </div>`;
        });

        html += '</div>';
        html += '<p class="info-text" style="margin-top:10px;">Click a class card to see per-student attendance rates.</p>';
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="info-text error">Error loading analytics: ${error.message}</p>`;
    }
}

async function loadClassAnalyticsDetail(classId) {
    const container = document.getElementById('db-viewer-container');
    container.innerHTML = '<p class="info-text">Loading class analytics...</p>';
    try {
        const year = new Date().getFullYear();
        const data = await api(`/attendance/class-summary/${classId}?year=${year}`);
        const cls = data.class || {};
        const studentStats = data.studentStats || [];
        const monthlyStats = data.monthlyStats || {};

        let html = '<div class="attendance-analytics">';
        html += `<button class="btn btn-secondary btn-small" onclick="loadAttendanceAnalytics()" style="margin-bottom:12px;">← Back to All Classes</button>`;
        html += `<h3 style="margin-bottom:4px;">📊 ${escapeHtml(cls.name)} — ${year}</h3>`;
        html += `<p style="color:#666;margin-bottom:8px;">Teacher: ${escapeHtml(cls.teacher_name || '—')} &nbsp;|&nbsp; Overall rate: <strong>${data.overallRate !== null ? data.overallRate + '%' : '—'}</strong></p>`;

        // PDF export buttons
        html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
            <button class="btn btn-small btn-primary" onclick="dbExportClassSummaryPDF(${classId})">📄 Class Summary PDF</button>
            <button class="btn btn-small btn-secondary" onclick="dbExportAttendanceGridPDF(${classId})">📋 Attendance Grid PDF</button>
        </div>`;

        // Monthly summary row with trend arrows
        html += '<h4>Monthly Attendance Rates</h4>';
        html += '<div class="analytics-monthly-row">';
        for (let m = 1; m <= 12; m++) {
            const ms = monthlyStats[m] || { rate: null, total: 0 };
            const prevMs = monthlyStats[m - 1] || { rate: null };
            const rateLabel = ms.rate !== null ? `${ms.rate}%` : '—';
            const monthRateClass = ms.rate === null ? 'month-rate-none' : ms.rate >= 85 ? 'month-rate-green' : ms.rate >= 65 ? 'month-rate-yellow' : 'month-rate-red';
            let trend = '';
            if (ms.rate !== null && prevMs.rate !== null) {
                if (ms.rate > prevMs.rate) trend = '<span style="color:#28a745;font-size:10px;">▲</span>';
                else if (ms.rate < prevMs.rate) trend = '<span style="color:#dc3545;font-size:10px;">▼</span>';
            }
            html += `<div class="analytics-month-cell ${monthRateClass}" title="${MONTH_ABBR[m-1]}: ${ms.present||0}/${ms.total} (${rateLabel})">
                <div class="analytics-month-label">${MONTH_ABBR[m-1]}</div>
                <div class="analytics-month-rate">${rateLabel}${trend}</div>
            </div>`;
        }
        html += '</div>';

        // Per-student table
        if (studentStats.length > 0) {
            html += '<h4 style="margin-top:14px;">Per-Student Attendance Rates</h4>';
            html += '<table class="db-table-clean" style="width:100%"><thead><tr><th>Student</th><th>Type</th><th>Present</th><th>Total</th><th>Rate</th><th>Report</th></tr></thead><tbody>';
            // Sort descending by rate (best first); at-risk students shown with red class
            studentStats.slice().sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)).forEach(s => {
                const rateClass = s.rate >= 85 ? 'rate-green' : s.rate >= 65 ? 'rate-yellow' : 'rate-red';
                html += `<tr>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${escapeHtml(s.student_type || 'regular')}</td>
                    <td>${s.present}</td>
                    <td>${s.total}</td>
                    <td class="${rateClass}">${s.total > 0 ? s.rate + '%' : '—'}</td>
                    <td><button class="btn btn-small btn-secondary" onclick="dbExportStudentAttendancePDF(${s.id}, ${year})" title="Export PDF report for ${escapeHtml(s.name)}">📄</button></td>
                </tr>`;
            });
            html += '</tbody></table>';
        }

        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="info-text error">Error: ${error.message}</p>`;
    }
}

// Advanced options toggle
document.getElementById('db-advanced-toggle')?.addEventListener('click', function() {
    const advancedOptions = document.getElementById('db-advanced-options');
    advancedOptions.classList.toggle('show');
    this.textContent = advancedOptions.classList.contains('show') ? 'Advanced ▲' : 'Advanced ▼';
});

// PDF Export functionality
document.getElementById('db-export-pdf-btn')?.addEventListener('click', exportDatabasePDF);

// Helper function to strip timestamp prefix from PDF filenames
function cleanPdfFilename(filename) {
    if (!filename) return '';
    return filename.replace(/^\d{13,}_/, '');
}

// Helper function to render clean database tables
function renderCleanTable(data, type, options = {}) {
    if (!data || data.length === 0) return '';
    
    const { includeActions = false, includeSelection = false } = options;
    
    // Define column configurations for each type
    const columnConfig = {
        attendance: {
            columns: ['date', 'student_name', 'class_name', 'status'],
            headers: ['Date', 'Student', 'Class', 'Status'],
            formatters: {
                date: formatDisplayDate,
                student_name: (val, row) => getStudentColorDot(row && row.color_code) + escapeHtml(val || ''),
                class_name: (val, row) => {
                    if (row && row.class_color) {
                        return `<span style="color: ${escapeHtml(row.class_color)}; font-weight: 600;">${escapeHtml(val || '')}</span>`;
                    }
                    return escapeHtml(val || '');
                },
                status: (val) => {
                    const s = formatAttendanceStatus(val);
                    return `<span class="${s.class}">${s.icon} ${s.text}</span>`;
                }
            }
        },
        students: {
            columns: ['name', 'class_name', 'student_type', 'email'],
            headers: ['Name', 'Class', 'Type', 'Email'],
            formatters: {
                name: (val, row) => getStudentColorDot(row && row.color_code) + escapeHtml(val || '')
            }
        },
        teachers: {
            columns: ['full_name', 'username', 'role', 'created_at'],
            headers: ['Name', 'Username', 'Role', 'Created'],
            formatters: {
                created_at: formatDisplayDate
            }
        },
        classes: {
            columns: ['name', 'teacher_name', 'schedule', 'active'],
            headers: ['Class Name', 'Teacher', 'Schedule', 'Active'],
            formatters: {
                active: (val) => val ? 'Yes' : 'No'
            }
        },
        teacher_comment_sheets: {
            columns: ['date', 'class_name', 'teacher_name', 'target_topic'],
            headers: ['Date', 'Class', 'Teacher', 'Topic'],
            formatters: {
                date: formatDisplayDate,
                class_name: (val, row) => {
                    if (row && row.class_color) {
                        return `<span style="border-left: 3px solid ${escapeHtml(row.class_color)}; padding-left: 6px; font-weight: 600;">${escapeHtml(val || '')}</span>`;
                    }
                    return escapeHtml(val || '');
                }
            }
        },
        monthly_reports: {
            columns: ['year', 'month', 'class_name', 'status'],
            headers: ['Year', 'Month', 'Class', 'Status'],
            formatters: {
                month: (val) => {
                    // Month values are 1-indexed (1-12) but array indices are 0-indexed
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return months[val - 1] || val;
                }
            }
        },
        reports: {
            columns: ['date', 'class_name', 'teacher_name', 'target_topic'],
            headers: ['Date', 'Class', 'Teacher', 'Topic'],
            formatters: {
                date: formatDisplayDate
            }
        },
        makeup_lessons: {
            columns: ['scheduled_date', 'student_name', 'class_name', 'reason', 'status'],
            headers: ['Date', 'Student', 'Class', 'Reason', 'Status'],
            formatters: {
                scheduled_date: formatDisplayDate,
                status: (val) => {
                    const cls = val === 'completed' ? 'present' : val === 'cancelled' ? 'absent' : 'partial';
                    return `<span class="status ${cls}">${escapeHtml(val || '')}</span>`;
                }
            }
        },
        pdf_history: {
            columns: ['filename', 'type', 'created_at'],
            headers: ['Filename', 'Type', 'Created'],
            formatters: {
                filename: cleanPdfFilename,
                created_at: formatDisplayDate
            }
        }
    };
    
    const config = columnConfig[type];
    if (!config) {
        // Fallback: use all columns
        const allCols = Object.keys(data[0]);
        config = {
            columns: allCols,
            headers: allCols.map(c => toTitleCase(c.replace(/_/g, ' '))),
            formatters: {}
        };
    }
    
    let html = '<table class="db-table-clean"><thead><tr>';
    
    // Add select-all checkbox in header
    if (includeSelection) {
        html += '<th><input type="checkbox" class="select-all-checkbox" data-type="' + type + '" onchange="toggleSelectAll(this, \'' + type + '\')"></th>';
    }
    
    config.headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    
    // Add Actions header for students and reports
    if (includeActions || type === 'students' || type === 'teacher_comment_sheets' || type === 'monthly_reports' || type === 'makeup_lessons') {
        html += '<th>Actions</th>';
    }
    
    html += '</tr></thead><tbody>';
    
    data.forEach(row => {
        const sanitizedId = parseInt(row.id);
        const rowClass = (type === 'students' || type === 'teacher_comment_sheets' || type === 'monthly_reports' || type === 'attendance' || type === 'makeup_lessons') ? 'clickable-row' : '';
        const rowAttrs = (type === 'students' || type === 'teacher_comment_sheets' || type === 'monthly_reports' || type === 'attendance' || type === 'makeup_lessons') 
            ? `data-type="${type}" data-id="${sanitizedId}"` 
            : '';
        
        html += `<tr class="${rowClass}" ${rowAttrs} onclick="handleRowClick(event, '${type}', ${sanitizedId})">`;
        
        // Add individual checkbox
        if (includeSelection) {
            html += `<td onclick="event.stopPropagation();"><input type="checkbox" class="row-checkbox" data-type="${type}" data-id="${sanitizedId}"></td>`;
        }
        
        config.columns.forEach((col, idx) => {
            let value = row[col];
            
            // Apply formatter if exists
            if (config.formatters[col]) {
                value = config.formatters[col](value, row);
            } else {
                // Default formatting
                if (value === null || value === undefined) {
                    value = '<em style="color: #999;">N/A</em>';
                } else if (typeof value === 'object') {
                    value = JSON.stringify(value);
                } else if (typeof value === 'boolean') {
                    value = value ? 'Yes' : 'No';
                } else if (col.includes('date') && !config.formatters[col]) {
                    // Auto-format dates
                    value = formatDisplayDate(value);
                } else {
                    value = escapeHtml(String(value));
                }
            }
            
            html += `<td>${value}</td>`;
        });
        
        // Add actions column - either original edit/delete or new view/pdf buttons
        if (includeActions) {
            // DataHub table view for teacher_comment_sheets - full action set
            if (!isNaN(sanitizedId)) {
                html += `<td class="actions-cell">
                    <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); viewSearchResult('teacher_comment_sheets', ${sanitizedId})" title="View Details">👁️</button>
                    <button class="btn btn-small btn-warning" onclick="event.stopPropagation(); editReportFromDatabase(${sanitizedId})" title="Edit">✏️</button>
                    <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); exportSinglePDF('teacher_comment_sheets', ${sanitizedId})" title="Export PDF">📄</button>
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteReportFromDatabase(${sanitizedId})" title="Delete">🗑️</button>
                </td>`;
            } else {
                html += '<td class="actions-cell">Invalid ID</td>';
            }
        } else if (type === 'makeup_lessons') {
            if (!isNaN(sanitizedId)) {
                html += `<td class="actions-cell">
                    <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); viewMakeupLessonDetail(${sanitizedId})" title="View Details">👁️</button>
                    <button class="btn btn-small btn-warning" onclick="event.stopPropagation(); editMakeupLesson(${sanitizedId})" title="Edit">✏️</button>
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteMakeupLessonFromDatabase(${sanitizedId})" title="Delete">🗑️</button>
                </td>`;
            } else {
                html += '<td class="actions-cell"></td>';
            }
        } else if (type === 'students' || type === 'teacher_comment_sheets' || type === 'monthly_reports') {
            // View/PDF/Edit/Delete buttons for search results
            if (!isNaN(sanitizedId)) {
                html += `<td class="actions-cell">
                    <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); viewSearchResult('${type}', ${sanitizedId})" title="View Details">👁️</button>`;
                if (type === 'students' || type === 'teacher_comment_sheets') {
                    html += `<button class="btn btn-small btn-primary" onclick="event.stopPropagation(); exportSinglePDF('${type}', ${sanitizedId})" title="Export PDF">📄</button>`;
                }
                if (type === 'teacher_comment_sheets') {
                    html += `<button class="btn btn-small btn-warning" onclick="event.stopPropagation(); editReportFromDatabase(${sanitizedId})" title="Edit">✏️</button>
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteReportFromDatabase(${sanitizedId})" title="Delete">🗑️</button>`;
                }
                if (type === 'monthly_reports') {
                    html += `<button class="btn btn-small btn-warning" onclick="event.stopPropagation(); editMonthlyReport(${sanitizedId})" title="Edit">✏️</button>
                    <button class="btn btn-small btn-success" onclick="event.stopPropagation(); generateMonthlyReportPDF(${sanitizedId})" title="Generate PDF">
                        📄 ${row.pdf_url ? 'Regenerate' : 'Generate'} PDF
                    </button>`;
                    if (row.pdf_url) {
                        html += `<button class="btn btn-small btn-info" onclick="event.stopPropagation(); downloadMonthlyReportPDF(${sanitizedId})" title="View PDF">📥 View PDF</button>`;
                    }
                    html += `<button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteMonthlyReport(${sanitizedId})" title="Delete">🗑️</button>`;
                }
                html += `</td>`;
            } else {
                html += '<td class="actions-cell"></td>';
            }
        }
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
}

// Helper function to convert text to title case
function toTitleCase(text) {
    return text.replace(/\b\w/g, l => l.toUpperCase());
}

async function searchDatabase() {
    const query = document.getElementById('db-search-input').value.trim();
    const type = document.getElementById('db-search-type').value;
    const startDate = document.getElementById('db-search-start-date').value;
    const endDate = document.getElementById('db-search-end-date').value;
    const container = document.getElementById('db-viewer-container');
    
    // If no query, no type, and no date filters, show placeholder
    // This allows the "Load Table" button in advanced options to work
    if (!query && !type && !startDate && !endDate) {
        container.innerHTML = '<p class="info-text">Start typing to search or use advanced options...</p>';
        currentSearchResults = null;
        return;
    }
    
    // Abort previous search if still running
    if (searchAbortController) {
        searchAbortController.abort();
    }
    searchAbortController = new AbortController();
    
    try {
        container.innerHTML = '<p class="info-text">Searching...</p>';
        
        const params = new URLSearchParams();
        
        // Add query only if it exists
        if (query) {
            params.append('query', query);
        }
        
        // Add type - can be empty string for "All" filter
        if (type) {
            params.append('type', type);
        }
        
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const results = await api(`/database/search?${params.toString()}`, {
            signal: searchAbortController.signal
        });
        
        // Store results for PDF export
        currentSearchResults = results || null;
        
        if (!results || results.total === 0) {
            container.innerHTML = '<p class="info-text">No results found</p>';
            return;
        }
        
        let html = '<div class="search-results">';
        let totalResults = 0;
        
        // Display results grouped by type using clean table rendering
        if (results.students && results.students.length > 0) {
            totalResults += results.students.length;
            html += `<h3>Students (${results.students.length})</h3>`;
            html += renderCleanTable(results.students, 'students', { includeSelection: true });
            html += '<br>';
        }
        
        if (results.teachers && results.teachers.length > 0) {
            totalResults += results.teachers.length;
            html += `<h3>Teachers (${results.teachers.length})</h3>`;
            html += renderCleanTable(results.teachers, 'teachers');
            html += '<br>';
        }
        
        if (results.classes && results.classes.length > 0) {
            totalResults += results.classes.length;
            html += `<h3>Classes (${results.classes.length})</h3>`;
            html += renderCleanTable(results.classes, 'classes');
            html += '<br>';
        }
        
        if (results.attendance && results.attendance.length > 0) {
            totalResults += results.attendance.length;
            html += renderAttendanceClassView(results);
        }
        
        if (results.teacherCommentSheets && results.teacherCommentSheets.length > 0) {
            totalResults += results.teacherCommentSheets.length;
            html += `<h3>Comment Sheets (${results.teacherCommentSheets.length})</h3>`;
            html += renderCleanTable(results.teacherCommentSheets, 'teacher_comment_sheets');
            html += '<br>';
        }
        
        if (results.monthly_reports && results.monthly_reports.length > 0) {
            totalResults += results.monthly_reports.length;
            html += `<h3>Monthly Reports (${results.monthly_reports.length})</h3>`;
            html += renderCleanTable(results.monthly_reports, 'monthly_reports');
            html += '<br>';
        }
        
        if (results.makeupLessons && results.makeupLessons.length > 0) {
            totalResults += results.makeupLessons.length;
            html += `<h3>Make-up Lessons (${results.makeupLessons.length})</h3>`;
            html += renderCleanTable(results.makeupLessons, 'makeup_lessons');
            html += '<br>';
        }
        
        // Add clean results summary at the bottom
        if (totalResults > 0) {
            html += `<div class="results-summary">${totalResults} total result${totalResults !== 1 ? 's' : ''}</div>`;
        } else {
            container.innerHTML = '<p class="info-text">No results found</p>';
            return;
        }
        
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        // Ignore abort errors from rapid typing
        if (error.name === 'AbortError') {
            return;
        }
        container.innerHTML = `<p class="info-text error">Error: ${error.message}</p>`;
        currentSearchResults = null;
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
        
        const hasActions = tableName === 'teacher_comment_sheets';
        
        // Use clean table rendering with optional actions
        let html = renderCleanTable(result.data, tableName, { includeActions: hasActions });
        
        // Add results summary
        html += `<div class="results-summary">${result.data.length} record${result.data.length !== 1 ? 's' : ''}</div>`;
        
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
    if (!confirm('Are you sure you want to delete this comment sheet? This action cannot be undone.')) {
        return;
    }
    
    try {
        await api(`/teacher-comment-sheets/${reportId}`, { method: 'DELETE' });
        Toast.success('Comment sheet deleted successfully');
        
        // Reload the database table
        await loadDatabaseTable();
    } catch (error) {
        Toast.error('Failed to delete comment sheet: ' + error.message);
    }
}

function exportDatabaseTable() {
    const tableName = document.getElementById('db-table-select').value;
    const table = document.querySelector('.db-table-clean') || document.querySelector('.db-table');
    
    if (!table) {
        Toast.error('Please load data first');
        return;
    }
    
    const attendanceIcons = getAttendanceIcons();
    const iconRegex = new RegExp(`[${attendanceIcons.join('')}]`, 'g');
    
    let csv = '';
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        const rowData = Array.from(cells).map(cell => {
            let text = cell.textContent.trim();
            // Remove emoji icons for cleaner export
            text = text.replace(iconRegex, '').trim();
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

async function exportDatabasePDF() {
    const activeType = document.querySelector('.filter-pill.active')?.dataset.type || '';
    
    // Check if we have search results
    if (!currentSearchResults) {
        Toast.error('Please perform a search first before exporting to PDF');
        return;
    }
    
    // Get selected items (if any checkboxes are checked)
    const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.id));
    
    // If items are selected, export them
    if (selectedIds.length > 0) {
        const selectedType = selectedCheckboxes[0]?.dataset.type || activeType;
        await exportSelectedItems(selectedType, selectedIds);
        return;
    }
    
    // If nothing selected, show options for the active type or first available type
    let exportType = activeType;
    if (!exportType) {
        // Find the first type with results
        if (currentSearchResults.students?.length > 0) exportType = 'students';
        else if (currentSearchResults.teacher_comments?.length > 0) exportType = 'teacher_comments';
        else if (currentSearchResults.monthly_reports?.length > 0) exportType = 'monthly_reports';
    }
    
    if (exportType) {
        showExportOptionsModal(exportType);
    } else {
        Toast.error('No items to export');
    }
}

// Toggle select all checkboxes
function toggleSelectAll(checkbox, type) {
    const checkboxes = document.querySelectorAll(`.row-checkbox[data-type="${type}"]`);
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
}

// Handle row click to view details
function handleRowClick(event, type, id) {
    // Don't trigger if clicking on a button or checkbox
    if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT') {
        return;
    }
    viewSearchResult(type, id);
}

// View search result detail
async function viewSearchResult(type, id) {
    switch(type) {
        case 'students':
            await showStudentDetail(id);
            break;
        case 'reports':
        case 'teacher_comment_sheets':
            await viewReportDetail(id);
            break;
        case 'monthly_reports':
            await viewMonthlyReportDetail(id);
            break;
        case 'attendance':
            await viewAttendanceDetail(id);
            break;
        case 'makeup_lessons':
            await viewMakeupLessonDetail(id);
            break;
        default:
            Toast.info('Detail view not available for this type');
    }
}

// View makeup lesson detail modal
async function viewMakeupLessonDetail(id) {
    const safeId = parseInt(id, 10);
    if (isNaN(safeId)) {
        Toast.error('Invalid makeup lesson ID');
        return;
    }
    try {
        const lesson = await api(`/makeup/${safeId}`);
        const statusClass = lesson.status === 'completed' ? 'present' : lesson.status === 'cancelled' ? 'absent' : 'partial';
        showModal(`Make-up Lesson - ${escapeHtml(lesson.student_name || '')}`, `
            <div class="report-detail">
                <p><strong>Student:</strong> ${escapeHtml(lesson.student_name || 'N/A')}</p>
                <p><strong>Class:</strong> ${escapeHtml(lesson.class_name || 'N/A')}</p>
                <p><strong>Date:</strong> ${formatDisplayDate(lesson.scheduled_date)}</p>
                <p><strong>Status:</strong> <span class="status ${statusClass}">${escapeHtml(lesson.status || '')}</span></p>
                ${lesson.reason ? `<p><strong>Reason:</strong> ${escapeHtml(lesson.reason)}</p>` : ''}
                ${lesson.notes ? `<p><strong>Notes:</strong> ${escapeHtml(lesson.notes)}</p>` : ''}
                <div class="modal-actions" style="margin-top: 20px;">
                    <button class="btn btn-warning" onclick="closeModal(); editMakeupLesson(${safeId})">✏️ Edit</button>
                    <button class="btn btn-danger" onclick="closeModal(); deleteMakeupLessonFromDatabase(${safeId})">🗑️ Delete</button>
                    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                </div>
            </div>
        `);
    } catch (error) {
        Toast.error('Failed to load make-up lesson: ' + error.message);
    }
}

// Delete makeup lesson from database viewer
async function deleteMakeupLessonFromDatabase(id) {
    if (!confirm('Are you sure you want to delete this make-up lesson? This action cannot be undone.')) {
        return;
    }
    try {
        await api(`/makeup/${id}`, { method: 'DELETE' });
        Toast.success('Make-up lesson deleted successfully');
        searchDatabase();
    } catch (error) {
        Toast.error('Failed to delete make-up lesson: ' + error.message);
    }
}

// View report detail modal
async function viewReportDetail(reportId) {
    try {
        const report = await api(`/reports/${reportId}`);
        
        showModal(`Lesson Report - ${report.class_name}`, `
            <div class="report-detail">
                <p><strong>Date:</strong> ${formatDisplayDate(report.date)}</p>
                <p><strong>Class:</strong> ${report.class_name}</p>
                <p><strong>Teacher:</strong> ${report.teacher_name}</p>
                <p><strong>Topic:</strong> ${report.target_topic || 'N/A'}</p>
                <p><strong>Vocabulary:</strong> ${report.vocabulary || 'N/A'}</p>
                <p><strong>Mistakes:</strong> ${report.mistakes || 'N/A'}</p>
                <p><strong>Strengths:</strong> ${report.strengths || 'N/A'}</p>
                <p><strong>Comments:</strong> ${report.comments || 'N/A'}</p>
                
                <div class="modal-actions" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="exportSingleReportPDF(${reportId})">
                        📄 Export as PDF
                    </button>
                    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                </div>
            </div>
        `);
    } catch (error) {
        Toast.error('Failed to load report: ' + error.message);
    }
}

// View attendance detail modal
async function viewAttendanceDetail(attendanceId) {
    try {
        // Fetch the attendance record
        const result = await api(`/database/table/attendance`);
        const record = result.data.find(r => r.id === attendanceId);
        
        if (!record) {
            Toast.error('Attendance record not found');
            return;
        }
        
        // Format status for display
        const statusInfo = formatAttendanceStatus(record.status);
        
        showModal(`Attendance Record - ${record.student_name}`, `
            <div class="attendance-detail">
                <p><strong>Date:</strong> ${formatDisplayDate(record.date)}</p>
                <p><strong>Student:</strong> ${escapeHtml(record.student_name)}</p>
                <p><strong>Class:</strong> ${escapeHtml(record.class_name)}</p>
                <p><strong>Status:</strong> <span class="${statusInfo.class}">${statusInfo.icon} ${statusInfo.text}</span></p>
                ${record.time ? `<p><strong>Time:</strong> ${escapeHtml(record.time)}</p>` : ''}
                ${record.notes ? `<p><strong>Notes:</strong> ${escapeHtml(record.notes)}</p>` : ''}
                
                <div class="modal-actions" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="openAttendanceGrid(${record.class_id}, '${record.date}')">
                        📊 Open in Attendance Grid
                    </button>
                    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                </div>
            </div>
        `);
    } catch (error) {
        Toast.error('Failed to load attendance: ' + error.message);
    }
}

// Open attendance grid for a specific class and date
function openAttendanceGrid(classId, date) {
    // Navigate to attendance page
    navigateToPage('attendance');
    
    // Close modal first
    closeModal();
    
    // Wait for page to render, then configure the filters
    // Using requestAnimationFrame for smoother DOM updates
    requestAnimationFrame(() => {
        const classSelect = document.getElementById('class-select');
        if (classSelect) {
            classSelect.value = classId;
            // Trigger change event to load students
            classSelect.dispatchEvent(new Event('change'));
        }
        
        // Set the start and end date to focus on the specific date
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        if (startDateInput && endDateInput) {
            startDateInput.value = date;
            endDateInput.value = date;
        }
        
        // Wait for next frame to ensure change event has processed
        requestAnimationFrame(() => {
            loadAttendance();
        });
    });
}

// View monthly report detail modal
async function viewMonthlyReportDetail(reportId) {
    try {
        const report = await api(`/monthly-reports/${reportId}`);
        
        let weeksHtml = '';
        if (report.weeks && report.weeks.length > 0) {
            // Sort weeks by lesson_date (nulls last)
            const sortedWeeks = report.weeks.slice().sort((a, b) => {
                if (!a.lesson_date && !b.lesson_date) return 0;
                if (!a.lesson_date) return 1;
                if (!b.lesson_date) return -1;
                return new Date(a.lesson_date) - new Date(b.lesson_date);
            });
            sortedWeeks.forEach((week, index) => {
                weeksHtml += `
                    <div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                        <strong>Class ${index + 1}</strong> ${week.lesson_date ? `- ${formatDisplayDate(week.lesson_date)}` : ''}
                        <p style="margin: 5px 0;"><strong>Target:</strong> ${week.target || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Vocabulary:</strong> ${week.vocabulary || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Phrase:</strong> ${week.phrase || 'N/A'}</p>
                    </div>
                `;
            });
        } else {
            weeksHtml = '<p>No weekly data available</p>';
        }
        
        showModal(`Monthly Report - ${report.class_name}`, `
            <div class="report-detail">
                <p><strong>Class:</strong> ${report.class_name}</p>
                <p><strong>Year:</strong> ${report.year}</p>
                <p><strong>Month:</strong> ${report.month}</p>
                <p><strong>Status:</strong> ${report.status}</p>
                <p><strong>Theme:</strong> ${report.monthly_theme || 'N/A'}</p>
                
                <h4 style="margin-top: 20px;">Lessons:</h4>
                ${weeksHtml}
                
                <div class="modal-actions" style="margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                </div>
            </div>
        `);
    } catch (error) {
        Toast.error('Failed to load monthly report: ' + error.message);
    }
}

// Export single PDF
async function exportSinglePDF(type, id) {
    Toast.info('Generating PDF...');
    
    try {
        let endpoint;
        if (type === 'students') {
            endpoint = `/pdf/student-attendance/${id}`;
        } else if (type === 'reports' || type === 'teacher_comment_sheets') {
            endpoint = `/pdf/lesson-report/${id}`;
        } else {
            Toast.error('PDF export not available for this type');
            return;
        }
        
        const response = await api(endpoint, { method: 'POST' });
        
        if (response.downloadUrl) {
            window.open(response.downloadUrl, '_blank');
            Toast.success('PDF generated!');
        }
    } catch (error) {
        if (error.message.includes('PDF storage not configured')) {
            Toast.error('PDF export requires Cloudflare R2 configuration. Please contact administrator.', 'Configuration Required');
        } else {
            Toast.error('Failed to generate PDF: ' + error.message);
        }
    }
}

// Export single report PDF (from modal)
async function exportSingleReportPDF(reportId) {
    closeModal();
    await exportSinglePDF('reports', reportId);
}

// Export selected items
async function exportSelectedItems(type, selectedIds) {
    if (selectedIds.length === 0) {
        Toast.error('No items selected');
        return;
    }
    
    Toast.info(`Exporting ${selectedIds.length} PDFs...`);
    
    let successCount = 0;
    for (const id of selectedIds) {
        try {
            if (type === 'students') {
                const response = await api(`/pdf/student-attendance/${id}`, { method: 'POST' });
                if (response.downloadUrl) {
                    window.open(response.downloadUrl, '_blank');
                    successCount++;
                    // Small delay to avoid popup blockers
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } else if (type === 'reports' || type === 'teacher_comment_sheets') {
                const response = await api(`/pdf/lesson-report/${id}`, { method: 'POST' });
                if (response.downloadUrl) {
                    window.open(response.downloadUrl, '_blank');
                    successCount++;
                    // Small delay to avoid popup blockers
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error(`Failed to export ${type} ${id}:`, error);
        }
    }
    
    Toast.success(`Exported ${successCount} of ${selectedIds.length} PDFs`);
}

// Show export options modal
function showExportOptionsModal(type) {
    const results = currentSearchResults?.results || currentSearchResults;
    const items = results[type] || results.students || [];
    
    if (items.length === 0) {
        Toast.error('No items to export');
        return;
    }
    
    const typeLabel = type === 'students' ? 'students' : 'reports';
    
    showModal('Export Options', `
        <div class="export-options">
            <p>Found ${items.length} ${typeLabel} to export:</p>
            
            <div class="export-option">
                <button class="btn btn-primary" onclick="exportAllAsSeparate('${type}')">
                    📄 Export Each Separately (${items.length} PDFs)
                </button>
                <p class="option-desc">Download each item as a separate PDF file</p>
            </div>
            
            ${type === 'reports' || type === 'teacher_comment_sheets' ? `
            <div class="export-option">
                <button class="btn btn-secondary" onclick="exportAllAsCombined('${type}')">
                    📑 Export All as One Combined PDF
                </button>
                <p class="option-desc">Combine all ${items.length} reports into a single PDF document</p>
            </div>
            ` : ''}
            
            <div class="export-option">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            </div>
        </div>
    `);
}

// Export all items separately
async function exportAllAsSeparate(type) {
    closeModal();
    const results = currentSearchResults?.results || currentSearchResults;
    const items = results[type] || [];
    
    if (items.length === 0) {
        Toast.error('No items to export');
        return;
    }
    
    Toast.info(`Exporting ${items.length} PDFs...`);
    
    let successCount = 0;
    for (const item of items) {
        try {
            if (type === 'students') {
                const response = await api(`/pdf/student-attendance/${item.id}`, { method: 'POST' });
                if (response.downloadUrl) {
                    window.open(response.downloadUrl, '_blank');
                    successCount++;
                    // Small delay to avoid popup blockers
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } else if (type === 'reports' || type === 'teacher_comment_sheets') {
                const response = await api(`/pdf/lesson-report/${item.id}`, { method: 'POST' });
                if (response.downloadUrl) {
                    window.open(response.downloadUrl, '_blank');
                    successCount++;
                    // Small delay to avoid popup blockers
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error(`Failed to export ${type} ${item.id}:`, error);
        }
    }
    
    Toast.success(`Exported ${successCount} of ${items.length} PDFs`);
}

// Export all reports as one combined PDF
async function exportAllAsCombined(type) {
    closeModal();
    
    if (type !== 'reports' && type !== 'teacher_comment_sheets') {
        Toast.error('Combined export only available for comment sheets');
        return;
    }
    
    const results = currentSearchResults?.results || currentSearchResults;
    const reports = results.reports || [];
    
    if (reports.length === 0) {
        Toast.error('No reports to export');
        return;
    }
    
    // Get date range from search params or use report dates
    const startDate = document.getElementById('db-search-start-date')?.value || 
                      (reports.length > 0 && reports[0].date ? reports.reduce((min, r) => (r.date && r.date < min ? r.date : min), reports[0].date) : null);
    const endDate = document.getElementById('db-search-end-date')?.value ||
                    (reports.length > 0 && reports[0].date ? reports.reduce((max, r) => (r.date && r.date > max ? r.date : max), reports[0].date) : null);
    
    // Get unique class IDs from the reports
    const classIds = [...new Set(reports.map(r => r.class_id))];
    
    Toast.info('Generating combined PDF...');
    
    try {
        // Use existing multi-class report endpoint
        const response = await api('/pdf/multi-class-reports', {
            method: 'POST',
            body: JSON.stringify({
                classIds,
                startDate,
                endDate
            })
        });
        
        if (response.downloadUrl) {
            window.open(response.downloadUrl, '_blank');
            Toast.success('Combined PDF generated!');
        }
    } catch (error) {
        if (error.message.includes('PDF storage not configured')) {
            Toast.error('PDF export requires Cloudflare R2 configuration. Please contact administrator.', 'Configuration Required');
        } else {
            Toast.error('Failed to generate combined PDF: ' + error.message);
        }
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
        const colorDot = getStudentColorDot(student.color_code);
        
        html += `
            <div class="student-card" onclick="showStudentDetail(${student.id})">
                <span class="student-type-badge ${typeClass}">${typeName}</span>
                <h3>${colorDot}${escapeHtml(student.name)}</h3>
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
        if (studentId) params.append('studentId', studentId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
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
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    lessons.forEach(lesson => {
        const lessonId = parseInt(lesson.id, 10);
        const statusClass = lesson.status === 'completed' ? 'present' : lesson.status === 'cancelled' ? 'absent' : 'partial';
        html += `
            <tr>
                <td>${escapeHtml(lesson.student_name)}</td>
                <td>${escapeHtml(lesson.class_name)}</td>
                <td>${new Date(lesson.scheduled_date + 'T00:00:00').toLocaleDateString()}</td>
                <td>${escapeHtml(lesson.reason) || '-'}</td>
                <td><span class="status ${statusClass}">${lesson.status}</span></td>
                <td class="action-buttons">
                    <button class="btn btn-small btn-primary" onclick="editMakeupLesson(${lessonId})">Edit</button>
                    ${lesson.status === 'scheduled' ? `
                        <button class="btn btn-small btn-success" onclick="completeMakeupLesson(${lessonId})">Complete</button>
                        <button class="btn btn-small btn-warning" onclick="cancelMakeupLesson(${lessonId})">Cancel</button>
                    ` : ''}
                    <button class="btn btn-small btn-danger" onclick="deleteMakeupLesson(${lessonId})">Delete</button>
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
                        ${classes.map(c => `<option value="${c.id}" ${c.id === lesson.class_id ? 'selected' : ''}>${escapeHtml(getClassDisplayName(c))}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Scheduled Date *</label>
                    <input type="date" id="edit-makeup-date" value="${lesson.scheduled_date}" required class="form-control">
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
        option.textContent = getClassDisplayName(c);
        classSelect.appendChild(option);
    });
    
    document.getElementById('makeup-lesson-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            student_id: document.getElementById('makeup-student').value,
            class_id: document.getElementById('makeup-class').value,
            scheduled_date: document.getElementById('makeup-date').value,
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
            // Refresh the makeup page table if on that page
            const makeupPage = document.getElementById('makeup-page');
            if (makeupPage && makeupPage.classList.contains('active')) {
                const filterBtn = document.getElementById('filter-makeup-btn');
                if (filterBtn) filterBtn.click();
            }
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
    try {
        await originalLoadDashboard();
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
    try {
        await loadMakeupLessons();
    } catch (err) {
        console.error('Makeup lessons load error:', err);
    }
};

// Update navigateToPage to handle new pages
const originalNavigateToPage = navigateToPage;
navigateToPage = function(page, pushState = true) {
    originalNavigateToPage(page, pushState);
    
    if (page === 'students-profile') {
        loadStudentProfiles();
        // Populate class filter
        const classFilter = document.getElementById('student-class-filter');
        classFilter.innerHTML = '<option value="">All Classes</option>';
        classes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = getClassDisplayName(c);
            classFilter.appendChild(option);
        });
    } else if (page === 'makeup') {
        loadMakeupPage();
    } else if (page === 'database') {
        // Database page loaded on demand
    } else if (page === 'profile') {
        loadProfilePage();
    } else if (page === 'monthly-reports') {
        initializeMonthlyReportsPage();
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
    const pages = ['dashboard', 'attendance', 'reports', 'monthly-reports', 'students-profile', 'makeup', 'database', 'admin', 'profile'];
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

// ===== Monthly Reports Section =====

// Global state for monthly reports
let monthlyReports = [];
let currentMonthlyReport = null;

// Initialize monthly reports page
async function initializeMonthlyReportsPage() {
    // Populate class filter
    const classFilter = document.getElementById('monthly-report-class-filter');
    classFilter.innerHTML = '<option value="">All Classes</option>';
    classes.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = getClassDisplayName(c);
        classFilter.appendChild(option);
    });
    
    // Clear date filters on initial load so all reports are visible
    document.getElementById('monthly-report-start-date').value = '';
    document.getElementById('monthly-report-end-date').value = '';
    
    // Set up event listeners (remove existing ones first to prevent duplicates)
    const filterBtn = document.getElementById('filter-monthly-reports-btn');
    const newBtn = document.getElementById('new-monthly-report-btn');
    const testBtn = document.getElementById('generate-test-report-btn');
    
    // Clone and replace to remove old listeners
    const newFilterBtn = filterBtn.cloneNode(true);
    const newNewBtn = newBtn.cloneNode(true);
    const newTestBtn = testBtn.cloneNode(true);
    
    filterBtn.parentNode.replaceChild(newFilterBtn, filterBtn);
    newBtn.parentNode.replaceChild(newNewBtn, newBtn);
    testBtn.parentNode.replaceChild(newTestBtn, testBtn);
    
    newFilterBtn.addEventListener('click', loadMonthlyReports);
    newNewBtn.addEventListener('click', showNewMonthlyReportModal);
    newTestBtn.addEventListener('click', generateTestMonthlyReport);

    // Auto-load reports on page open
    try {
        await loadMonthlyReports();
    } catch (err) {
        console.error('Auto-load monthly reports failed:', err);
    }
}

// Load monthly reports with filters
async function loadMonthlyReports() {
    const classId = document.getElementById('monthly-report-class-filter').value;
    const startDate = document.getElementById('monthly-report-start-date').value;
    const endDate = document.getElementById('monthly-report-end-date').value;
    const status = document.getElementById('monthly-report-status-filter').value;
    
    try {
        const params = new URLSearchParams();
        if (classId) params.append('classId', classId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (status) params.append('status', status);
        
        const response = await api(`/monthly-reports?${params.toString()}`);
        monthlyReports = response;
        
        renderMonthlyReportsList();
    } catch (error) {
        console.error('Error loading monthly reports:', error);
        Toast.error('Failed to load monthly reports');
    }
}

// Render monthly reports list
function renderMonthlyReportsList() {
    const container = document.getElementById('monthly-reports-list');
    
    if (monthlyReports.length === 0) {
        container.innerHTML = '<p class="info-text">No monthly reports found. Create one to get started!</p>';
        return;
    }
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Class</th>
                    <th>Period</th>
                    <th>Date Range</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    monthlyReports.forEach(report => {
        const monthYear = `${monthNames[report.month - 1]} ${report.year}`;
        // Use the new date formatter for date range display
        const dateRange = (report.start_date && report.end_date) 
            ? `${formatDateISO(report.start_date)} — ${formatDateISO(report.end_date)}` 
            : 'N/A';
        const statusBadge = report.status === 'published' 
            ? '<span class="badge badge-success">Published</span>' 
            : '<span class="badge badge-warning">Draft</span>';
        
        html += `
            <tr>
                <td>${escapeHtml(report.class_name || 'N/A')}</td>
                <td>${monthYear}</td>
                <td>${dateRange}</td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="viewMonthlyReport(${report.id})">View</button>
                    <button class="btn btn-sm btn-secondary" onclick="editMonthlyReport(${report.id})">Edit</button>
                    <button class="btn btn-sm btn-success" onclick="generateMonthlyReportPDF(${report.id})">${report.pdf_url ? 'Regenerate PDF' : 'Generate PDF'}</button>
                    <button class="btn btn-sm btn-info" onclick="downloadMonthlyReportPDF(${report.id})" ${report.pdf_url ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}>View PDF</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteMonthlyReport(${report.id})">Delete</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Generate test monthly report (admin only)
async function generateTestMonthlyReport() {
    // Get first class and first teacher for test data
    if (classes.length === 0) {
        Toast.error('No classes found. Please create a class first.');
        return;
    }
    
    if (teachers.length === 0) {
        Toast.error('No teachers found. Please create a teacher first.');
        return;
    }
    
    const classId = classes[0].id;
    const teacherId = teachers[0].id;
    
    try {
        Toast.info('Generating test report...');
        
        const response = await api('/monthly-reports/generate-test-data', {
            method: 'POST',
            body: JSON.stringify({
                class_id: classId,
                teacher_id: teacherId
            })
        });
        
        if (response.alreadyExists) {
            Toast.info(`Test report already exists! Report ID: ${response.reportId} - Opening existing report...`);
        } else {
            Toast.success(`Test report created! Report ID: ${response.reportId}`);
        }
        
        // Clear filters to show all reports (so test report for Jan 2024 is visible)
        document.getElementById('monthly-report-class-filter').value = '';
        document.getElementById('monthly-report-start-date').value = '';
        document.getElementById('monthly-report-end-date').value = '';
        document.getElementById('monthly-report-status-filter').value = '';
        
        // Reload the list
        await loadMonthlyReports();
        
        // Auto-open the created report after a brief delay
        setTimeout(() => {
            viewMonthlyReport(response.reportId);
        }, 500);
        
    } catch (error) {
        console.error('Error generating test report:', error);
        Toast.error(error.message || 'Failed to generate test report');
    }
}

// On page load and BFCache restores, check for an existing valid session so that
// refresh/back-button navigation don't log the user out.
let sessionRestoreInProgress = false;
async function restoreSessionIfAvailable() {
    if (sessionRestoreInProgress || currentUser) return;
    sessionRestoreInProgress = true;
    try {
        const user = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        if (user.ok) {
            const userData = await user.json();
            currentUser = userData;
            document.getElementById('user-name').textContent = userData.fullName;
            document.getElementById('splash-screen').classList.remove('active');
            document.getElementById('login-screen').classList.remove('active');
            document.getElementById('app-screen').classList.add('active');
            try {
                await loadInitialData();
                loadDashboard();
            } catch (dataError) {
                console.error('Error loading initial data during session restore:', dataError);
                if (typeof Toast !== 'undefined') {
                    Toast.error('Failed to load some data. Please try refreshing again.');
                }
            }
        } else {
            // No valid session – hide splash and show login screen
            document.getElementById('splash-screen').classList.remove('active');
            document.getElementById('login-screen').classList.add('active');
        }
    } catch (error) {
        // Network error or no valid session – hide splash and show login screen
        console.log('No active session found, showing login screen.');
        document.getElementById('splash-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
    } finally {
        sessionRestoreInProgress = false;
    }
}

restoreSessionIfAvailable();
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        restoreSessionIfAvailable();
    }
});
