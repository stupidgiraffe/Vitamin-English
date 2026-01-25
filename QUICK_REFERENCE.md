# Quick Reference - Toast Notification Examples

## How to Use Toast Notifications in the App

### Success Messages
```javascript
// Simple success
Toast.success('Class created successfully!');

// Success with custom title
Toast.success('All changes saved', 'Great!');
```

### Error Messages  
```javascript
// Simple error
Toast.error('Failed to save changes');

// Error with custom title
Toast.error('Please check your input', 'Validation Error');

// Error from backend (automatically shown by api() function)
try {
    await api('/classes', { method: 'POST', body: JSON.stringify({}) });
} catch (error) {
    // Error toast already shown automatically!
}
```

### Info Messages
```javascript
// Info message
Toast.info('Remember to save your work');

// Info with custom title
Toast.info('New features available!', 'Update');
```

### Advanced Usage
```javascript
// Show toast and keep reference
const toast = Toast.success('Processing...');

// Remove it manually later
toast.remove();

// Custom duration (0 = never auto-dismiss)
Toast.show('This stays forever', 'info', '', 0);
```

## Examples from the Codebase

### Form Submission Success
```javascript
// From Add Class form (line ~983)
await api('/classes', {
    method: 'POST',
    body: JSON.stringify({ name, teacher_id, schedule, color })
});
Toast.success('Class created successfully!');
closeModal();
```

### Form Validation Error
```javascript
// From Add Teacher form (line ~1195)
if (password !== confirmPassword) {
    Toast.error('Passwords do not match');
    return;
}
```

### API Error (Automatic)
```javascript
// api() function automatically shows errors (line ~108)
if (!response.ok) {
    const error = await response.json();
    const errorMessage = error.hint || error.error || defaultError;
    Toast.error(errorMessage); // Shown automatically!
    throw new Error(error.error);
}
```

### Backend Hint Messages
```javascript
// From routes/classes.js (line ~75)
return res.status(400).json({ 
    error: 'Class name is required',
    hint: 'Give your class a name (e.g., "Beginners Monday 10am")'
});

// Frontend automatically shows the hint in the toast!
```

## Toast Styling

### CSS Classes
```css
.toast           /* Base toast container */
.toast.success   /* Green left border */
.toast.error     /* Red left border */
.toast.info      /* Blue left border */
.toast-icon      /* Icon (✓, ✕, ℹ) */
.toast-title     /* Bold title text */
.toast-message   /* Regular message text */
.toast-close     /* Close button (×) */
```

### Animations
```css
/* Slide in from right */
@keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

/* Slide out to right */
@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
}
```

## Migration Guide: Alert → Toast

### Before (Bad ❌)
```javascript
alert('Class added successfully!');
alert('Error: ' + error.message);
if (confirm('Are you sure?')) {
    // delete
}
```

### After (Good ✅)
```javascript
Toast.success('Class added successfully!');
Toast.error('Error: ' + error.message);
// For confirm, keep using confirm() or create custom modal
if (confirm('Are you sure?')) {
    // delete
}
```

## Testing Toast Notifications

### Manual Test in Browser Console
```javascript
// Open browser console on the app
Toast.success('Test success message');
Toast.error('Test error message');
Toast.info('Test info message');

// Test auto-dismiss
Toast.success('This will disappear in 4 seconds');

// Test manual dismiss
const t = Toast.error('Click the X to close', '', 0);
// Click the X button or run: t.remove();
```

### Common Issues

**Toast doesn't appear:**
- Check if Toast.init() was called (automatic on first use)
- Check browser console for errors
- Verify styles.css is loaded

**Toast appears but no animation:**
- Check if CSS animations are supported
- Check if styles.css has the @keyframes

**Toast appears under other elements:**
- Check z-index (should be 10000)
- Check if toast-container is at body level

**Multiple toasts overlap:**
- They shouldn't! Check CSS for flex-direction: column
- Check gap: 10px in toast-container

## Keyboard Shortcuts Reference

### Active Shortcuts
```javascript
// Escape - Close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// N - New item (context-aware)
if (e.key === 'n' || e.key === 'N') {
    // Opens add class/student modal based on current tab
}
```

### Future Shortcuts (Ready to Implement)
```javascript
// Ctrl+K or Cmd+K - Quick search
if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    // Open search modal
}

// Ctrl+S - Save
if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    // Save current form
}
```

## Date Picker Usage

### HTML
```html
<!-- Add class 'date-picker' to any date input -->
<input type="date" class="date-picker" id="enrollment-date">
```

### JavaScript
```javascript
// Automatically initialized when modal opens
// Manual initialization:
initializeDateTimePickers();

// Custom configuration:
flatpickr('.my-date', {
    dateFormat: 'Y-m-d',
    minDate: 'today',
    maxDate: new Date().fp_incr(30) // 30 days from now
});
```

## Loading States

### Automatic (via api() function)
```javascript
// Just use api() - loading state is automatic!
const button = document.querySelector('#save-btn');
button.click(); // User clicks button
await api('/save', { method: 'POST' }); // Button shows spinner automatically
// Spinner removed when request completes
```

### Manual (for custom buttons)
```javascript
const button = document.querySelector('#my-btn');
button.classList.add('loading'); // Shows spinner
// ... do work ...
button.classList.remove('loading'); // Hides spinner
```

### CSS
```css
/* Button with loading class shows spinner */
.btn.loading {
    color: transparent; /* Hide text */
    pointer-events: none; /* Disable clicks */
}

.btn.loading::after {
    content: '';
    /* Spinner animation */
}
```

## Empty State Examples

### HTML Structure
```html
<div class="empty-state">
    <div class="empty-state-icon">📚</div>
    <h3>No classes yet</h3>
    <p>Create your first class to get started</p>
    <button class="btn btn-primary" onclick="addNewClass()">
        Add Class
    </button>
</div>
```

### JavaScript (Dynamic)
```javascript
function showEmptyState(container, type) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📚</div>
            <h3>No ${type} yet</h3>
            <p>Create your first ${type} to get started</p>
            <button class="btn btn-primary">Add ${type}</button>
        </div>
    `;
}

// Usage
if (classes.length === 0) {
    showEmptyState(container, 'class');
}
```

## Form Hints

### HTML
```html
<div class="form-group">
    <label>Class Name *</label>
    <input type="text" placeholder="e.g., Beginners Monday 10am">
    <small class="form-hint">Give your class a descriptive name</small>
</div>
```

### CSS
```css
.form-hint {
    display: block;
    font-size: 12px;
    color: #666;
    margin-top: 4px;
}
```

## Inline Editing (Ready to Use)

### JavaScript
```javascript
// Make any element editable
const classNameElement = document.querySelector('.class-name');
makeEditable(classNameElement, async (newName) => {
    // This function is called when user saves
    await api(`/classes/${classId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName })
    });
});

// User can now:
// 1. Click element to edit
// 2. Type new value
// 3. Press Enter to save (or click outside)
// 4. Press Escape to cancel
```

### HTML
```html
<!-- Add class for cursor hint -->
<span class="class-name" style="cursor: pointer" title="Click to edit">
    My Class Name
</span>
```

## Best Practices

### Do ✅
```javascript
// Use specific success messages
Toast.success('Class "Beginners" created successfully!');

// Use helpful error messages
Toast.error('Class name is required. Please enter a name.');

// Show loading states for slow operations
button.classList.add('loading');
await slowOperation();
button.classList.remove('loading');

// Use keyboard shortcuts
document.addEventListener('keydown', handleShortcuts);
```

### Don't ❌
```javascript
// Don't use generic messages
Toast.success('Success'); // Too vague

// Don't use alert()
alert('Class created'); // Use Toast instead

// Don't forget to remove loading state
button.classList.add('loading');
await operation();
// ❌ Forgot to remove loading class!

// Don't block keyboard shortcuts in inputs
// ✅ Already handled - shortcuts disabled in inputs
```

## Debugging Tips

### Check Toast System
```javascript
// In browser console:
console.log(Toast); // Should show object with methods
Toast.success('Test'); // Should show toast
```

### Check Flatpickr
```javascript
// Check if loaded:
console.log(typeof flatpickr); // Should be 'function'

// Check if initialized on element:
const input = document.querySelector('.date-picker');
console.log(input._flatpickr); // Should be object
```

### Check Keyboard Shortcuts
```javascript
// Add debug logging:
document.addEventListener('keydown', (e) => {
    console.log('Key pressed:', e.key, 'Target:', e.target.tagName);
});
```

### Check Loading States
```javascript
// Check button state:
const btn = document.querySelector('#my-btn');
console.log('Has loading class:', btn.classList.contains('loading'));
```

This quick reference should help developers and testers work with all the new UX features!
