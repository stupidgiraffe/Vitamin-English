const PDFDocument = require('pdfkit');
const path = require('path');
const { Readable } = require('stream');

// Month abbreviations for date formatting
const MONTH_ABBR = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

// Regex matching CJK (Japanese/Chinese/Korean) characters
const CJK_REGEX = /[\u3000-\u9FFF\uF900-\uFAFF]/;

// Theme constants for consistent styling across PDFs
const THEME = {
    colors: {
        primaryBlue: '#4472C4',
        secondaryBlue: '#2B5797',
        lightBlue: '#8FAADC',
        accentYellow: '#FFF9E6',
        brightYellow: '#FFB800',
        textDark: '#333333',
        textSecondary: '#6c757d',
        white: '#FFFFFF'
    },
    opacity: {
        cardBackground: 0.3,
        full: 1
    }
};

/**
 * Sanitize text for PDF output to prevent PDF injection attacks
 * @param {String} text - Text to sanitize
 * @returns {String} Sanitized text
 */
function sanitizeForPDF(text) {
    if (!text) return '';
    // Remove control characters EXCEPT newline (\n), carriage return (\r), and tab (\t)
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
               .replace(/[<>]/g, '');
}

/**
 * Generate a PDF for student attendance records
 * @param {Object} studentData - Student information
 * @param {Array} attendanceRecords - Array of attendance records
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateStudentAttendancePDF(studentData, attendanceRecords) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                margin: 50,
                size: 'A4'
            });
            const buffers = [];
            
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Helper function to format dates nicely
            const formatDate = (dateStr) => {
                if (!dateStr) return '';
                try {
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) return dateStr;
                    return date.toLocaleDateString('en-US', { 
                        weekday: 'short',
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                } catch (e) {
                    return dateStr;
                }
            };
            
            // Calculate attendance statistics
            let presentCount = 0;
            let absentCount = 0;
            let lateCount = 0;
            
            if (attendanceRecords && attendanceRecords.length > 0) {
                attendanceRecords.forEach(record => {
                    if (record.status === 'O') presentCount++;
                    else if (record.status === 'X') absentCount++;
                    else if (record.status === '/') lateCount++;
                });
            }
            
            const totalRecords = attendanceRecords?.length || 0;
            const attendanceRate = totalRecords > 0 
                ? ((presentCount / totalRecords) * 100).toFixed(1)
                : 0;
            
            // Page header with branding
            doc.rect(0, 0, doc.page.width, 80)
               .fill(THEME.colors.primaryBlue);
            
            doc.fontSize(28)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.white)
               .text('Vitamin English School', 50, 25, { align: 'center' });
            
            doc.fontSize(14)
               .font('Helvetica')
               .text('Student Profile Report', 50, 55, { align: 'center' });
            
            // Report date in top right
            doc.fontSize(9)
               .text(`Generated: ${formatDate(new Date().toISOString())}`, doc.page.width - 200, 60, { 
                   width: 150,
                   align: 'right'
               });
            
            // Reset to main content
            doc.fillColor(THEME.colors.textDark);
            doc.y = 110;
            
            // Student Information Card - with background
            const studentInfoTop = doc.y;
            doc.rect(50, studentInfoTop, doc.page.width - 100, 110)
               .fill(THEME.colors.accentYellow);
            
            doc.fillColor(THEME.colors.textDark);
            doc.fontSize(16)
               .font('Helvetica-Bold')
               .text('Student Information', 70, studentInfoTop + 15);
            
            doc.fontSize(11)
               .font('Helvetica')
               .text(`Name: ${sanitizeForPDF(studentData.name)}`, 70, studentInfoTop + 40)
               .text(`Class: ${sanitizeForPDF(studentData.class_name || 'N/A')}`, 70, studentInfoTop + 55)
               .text(`Student Type: ${sanitizeForPDF(studentData.student_type || 'Regular')}`, 70, studentInfoTop + 70);
            
            if (studentData.email) {
                doc.text(`Email: ${sanitizeForPDF(studentData.email)}`, 300, studentInfoTop + 40);
            }
            if (studentData.phone) {
                doc.text(`Phone: ${sanitizeForPDF(studentData.phone)}`, 300, studentInfoTop + 55);
            }
            if (studentData.enrollment_date) {
                doc.text(`Enrolled: ${formatDate(studentData.enrollment_date)}`, 300, studentInfoTop + 70);
            }
            
            doc.y = studentInfoTop + 130;
            
            // Attendance Summary Card
            const summaryTop = doc.y;
            doc.rect(50, summaryTop, doc.page.width - 100, 90)
               .fill(THEME.colors.lightBlue)
               .fillOpacity(THEME.opacity.cardBackground);
            
            doc.fillOpacity(THEME.opacity.full);
            doc.fillColor(THEME.colors.textDark);
            doc.fontSize(16)
               .font('Helvetica-Bold')
               .text('Attendance Summary', 70, summaryTop + 15);
            
            doc.fontSize(11)
               .font('Helvetica');
            
            // Summary stats in two columns
            const col1X = 70;
            const col2X = 300;
            const statY = summaryTop + 45;
            
            doc.text(`Total Classes: ${totalRecords}`, col1X, statY)
               .fillColor('#28a745')
               .text(`✓ Present: ${presentCount}`, col1X, statY + 15)
               .fillColor('#dc3545')
               .text(`✗ Absent: ${absentCount}`, col1X, statY + 30);
            
            doc.fillColor('#ffc107')
               .text(`⚠ Late: ${lateCount}`, col2X, statY + 15);
            
            doc.fillColor(THEME.colors.textDark)
               .font('Helvetica-Bold')
               .fontSize(13)
               .text(`Attendance Rate: ${attendanceRate}%`, col2X, statY, {
                   width: 200
               });
            
            doc.y = summaryTop + 110;
            
            // Attendance History Table
            doc.fillColor(THEME.colors.textDark);
            doc.fontSize(16)
               .font('Helvetica-Bold')
               .text('Attendance History', 50, doc.y);
            
            doc.moveDown(0.5);
            
            if (attendanceRecords && attendanceRecords.length > 0) {
                const tableTop = doc.y;
                const rowHeight = 25;
                const dateX = 60;
                const dayX = 160;
                const statusX = 260;
                const notesX = 360;
                const tableWidth = doc.page.width - 100;
                
                // Table header with blue background
                doc.rect(50, tableTop, tableWidth, rowHeight)
                   .fill(THEME.colors.primaryBlue);
                
                doc.fillColor(THEME.colors.white)
                   .font('Helvetica-Bold')
                   .fontSize(10)
                   .text('Date', dateX, tableTop + 8)
                   .text('Day', dayX, tableTop + 8)
                   .text('Status', statusX, tableTop + 8)
                   .text('Notes', notesX, tableTop + 8);
                
                doc.y = tableTop + rowHeight;
                
                // Table rows with alternating colors
                attendanceRecords.forEach((record, index) => {
                    // Check if we need a new page
                    if (doc.y > doc.page.height - 100) {
                        doc.addPage();
                        doc.y = 50;
                    }
                    
                    const rowY = doc.y;
                    
                    // Alternating row background
                    if (index % 2 === 0) {
                        doc.rect(50, rowY, tableWidth, rowHeight)
                           .fill('#f8f9fa');
                    }
                    
                    // Format date nicely
                    const dateStr = formatDate(record.date);
                    
                    // Get day of week
                    let dayOfWeek = '';
                    try {
                        const date = new Date(record.date);
                        if (!isNaN(date.getTime())) {
                            dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                        }
                    } catch (e) {
                        dayOfWeek = '';
                    }
                    
                    // Status with color coding
                    let statusText = 'Not marked';
                    let statusColor = THEME.colors.textSecondary;
                    
                    if (record.status === 'O') {
                        statusText = '✓ Present';
                        statusColor = '#28a745'; // Green
                    } else if (record.status === 'X') {
                        statusText = '✗ Absent';
                        statusColor = '#dc3545'; // Red
                    } else if (record.status === '/') {
                        statusText = '⚠ Late';
                        statusColor = '#ffc107'; // Yellow
                    }
                    
                    // Draw row content
                    doc.fillColor(THEME.colors.textDark)
                       .font('Helvetica')
                       .fontSize(9)
                       .text(dateStr, dateX, rowY + 8, { width: 90 })
                       .text(dayOfWeek, dayX, rowY + 8, { width: 90 });
                    
                    doc.fillColor(statusColor)
                       .font('Helvetica-Bold')
                       .text(statusText, statusX, rowY + 8, { width: 90 });
                    
                    doc.fillColor(THEME.colors.textDark)
                       .font('Helvetica')
                       .text(sanitizeForPDF(record.notes || ''), notesX, rowY + 8, { 
                           width: doc.page.width - notesX - 50,
                           height: rowHeight - 4
                       });
                    
                    // Draw row border
                    doc.strokeColor('#dee2e6')
                       .lineWidth(0.5)
                       .moveTo(50, rowY + rowHeight)
                       .lineTo(doc.page.width - 50, rowY + rowHeight)
                       .stroke();
                    
                    doc.y = rowY + rowHeight;
                });
            } else {
                doc.fillColor(THEME.colors.textSecondary)
                   .font('Helvetica')
                   .fontSize(11)
                   .text('No attendance records found.', 70, doc.y);
            }
            
            // Footer on every page
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);
                
                // Footer line
                doc.strokeColor(THEME.colors.primaryBlue)
                   .lineWidth(2)
                   .moveTo(50, doc.page.height - 40)
                   .lineTo(doc.page.width - 50, doc.page.height - 40)
                   .stroke();
                
                doc.fontSize(8)
                   .fillColor(THEME.colors.textSecondary)
                   .font('Helvetica')
                   .text(`Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 30, {
                       width: doc.page.width - 100,
                       align: 'center'
                   });
            }
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate a PDF for class attendance sheet
 * @param {Object} classData - Class information
 * @param {Array} students - Array of students in the class
 * @param {Array} attendanceRecords - Array of attendance records
 * @param {String} date - Date for the attendance sheet
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateClassAttendancePDF(classData, students, attendanceRecords, date) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
            const buffers = [];
            
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Constants for PDF layout
            const MAX_STUDENT_NAME_LENGTH = 25;
            const MAX_NOTES_LENGTH = 30;
            
            // Header
            doc.fontSize(20)
               .font('Helvetica-Bold')
               .text('Vitamin English School', { align: 'center' });
            
            doc.moveDown(0.3);
            doc.fontSize(16)
               .text('Class Attendance Sheet', { align: 'center' });
            
            doc.moveDown(0.8);
            
            // Class Information
            doc.fontSize(12)
               .font('Helvetica')
               .text(`Class: ${classData.name}`, { indent: 50 })
               .text(`Teacher: ${classData.teacher_name || ''}`, { indent: 50 })
               .text(`Schedule: ${classData.schedule || ''}`, { indent: 50 })
               .text(`Date: ${date || new Date().toLocaleDateString()}`, { indent: 50 });
            
            doc.moveDown(1);
            
            // Attendance Table
            if (students && students.length > 0) {
                const tableTop = doc.y;
                const rowHeight = 20; // Fixed row height to prevent overlap
                const numberX = 60;
                const nameX = 100;
                const typeX = 280;
                const statusX = 380;
                const notesX = 480;
                
                // Blue header background
                doc.rect(50, tableTop - 5, doc.page.width - 100, rowHeight + 2)
                   .fillAndStroke('#4472C4', '#2B5797');
                
                doc.font('Helvetica-Bold')
                   .fontSize(11)
                   .fillColor('white')
                   .text('#', numberX, tableTop, { width: 30 })
                   .text('Student Name', nameX, tableTop, { width: 170 })
                   .text('Type', typeX, tableTop, { width: 90 })
                   .text('Status', statusX, tableTop, { width: 90 })
                   .text('Notes', notesX, tableTop, { width: 200 });
                
                doc.moveDown(1.2);
                
                // Reset fill color for body
                doc.fillColor('black');
                
                // Table rows
                doc.font('Helvetica')
                   .fontSize(10);
                
                students.forEach((student, index) => {
                    // Check for page break
                    if (doc.y > 500) {
                        doc.addPage();
                        doc.y = 50;
                    }
                    
                    const rowY = doc.y;
                    
                    // Alternate row background (yellow striping)
                    if (index % 2 === 1) {
                        doc.rect(50, rowY - 3, doc.page.width - 100, rowHeight)
                           .fill('#FFF9E6');
                        doc.fillColor('black');
                    }
                    
                    const attendance = attendanceRecords.find(a => a.student_id === student.id);
                    const statusText = attendance 
                        ? (attendance.status === 'O' ? 'Present' : 
                           attendance.status === 'X' ? 'Absent' : 
                           attendance.status === '/' ? 'Late' : 'Not marked')
                        : 'Not marked';
                    
                    // Truncate text to prevent overflow
                    const studentName = student.name.length > MAX_STUDENT_NAME_LENGTH 
                        ? student.name.substring(0, MAX_STUDENT_NAME_LENGTH) + '...' 
                        : student.name;
                    const notes = attendance?.notes || '';
                    const notesText = notes.length > MAX_NOTES_LENGTH 
                        ? notes.substring(0, MAX_NOTES_LENGTH) + '...' 
                        : notes;
                    
                    doc.text((index + 1).toString(), numberX, rowY, { width: 30, height: rowHeight })
                       .text(studentName, nameX, rowY, { width: 170, height: rowHeight })
                       .text(student.student_type || 'regular', typeX, rowY, { width: 90, height: rowHeight })
                       .text(statusText, statusX, rowY, { width: 90, height: rowHeight })
                       .text(notesText, notesX, rowY, { width: 200, height: rowHeight });
                    
                    doc.moveDown(1.0); // Consistent spacing between rows
                });
                
                // Summary
                doc.moveDown(1);
                const presentCount = attendanceRecords.filter(a => a.status === 'O').length;
                const absentCount = attendanceRecords.filter(a => a.status === 'X').length;
                const lateCount = attendanceRecords.filter(a => a.status === '/').length;
                
                doc.font('Helvetica-Bold')
                   .fontSize(11)
                   .text(`Total Students: ${students.length}  |  Present: ${presentCount}  |  Absent: ${absentCount}  |  Late: ${lateCount}`, 
                         { indent: 50 });
            } else {
                doc.font('Helvetica')
                   .text('No students found in this class.', { indent: 50 });
            }
            
            // Footer
            doc.fontSize(9)
               .font('Helvetica')
               .text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 
                     50, doc.page.height - 50, { align: 'center' });
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate a PDF for attendance grid (multi-date view with sections)
 * @param {Object} classData - Class information (name, teacher_name, etc.)
 * @param {Array} students - Array of student objects with id, name, student_type, color_code
 * @param {Array} dates - Array of dates in ISO format (YYYY-MM-DD)
 * @param {Object} attendanceMap - Object mapping "studentId-date" to status ('O', 'X', '/', or '')
 * @param {String} startDate - Start date of range in ISO format (YYYY-MM-DD)
 * @param {String} endDate - End date of range in ISO format (YYYY-MM-DD)
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateAttendanceGridPDF(classData, students, dates, attendanceMap, startDate, endDate) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
            const buffers = [];
            
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Separate students by type
            const regularStudents = students.filter(s => s.student_type === 'regular');
            const trialStudents = students.filter(s => s.student_type !== 'regular');
            
            // Layout constants for better maintainability
            const PAGE_MARGIN = 30;
            const NAME_COLUMN_WIDTH = 120;
            const MIN_DATE_COLUMN_WIDTH = 35; // Minimum pixels per date column for readability
            const ROW_HEIGHT = 20;
            
            // Calculate column widths based on number of dates
            const pageWidth = doc.page.width - (PAGE_MARGIN * 2);
            const availableWidth = pageWidth - NAME_COLUMN_WIDTH;
            
            // Auto-split into pages if too many dates (for readability)
            const maxDatesPerPage = Math.floor(availableWidth / MIN_DATE_COLUMN_WIDTH);
            const dateChunks = [];
            
            for (let i = 0; i < dates.length; i += maxDatesPerPage) {
                dateChunks.push(dates.slice(i, i + maxDatesPerPage));
            }
            
            const startX = PAGE_MARGIN;
            
            // Function to draw header on each page
            const drawPageHeader = () => {
                doc.fontSize(18)
                   .font('Helvetica-Bold')
                   .text('Vitamin English School', { align: 'center' });
                
                doc.moveDown(0.3);
                doc.fontSize(14)
                   .text('Attendance Grid', { align: 'center' });
                
                doc.moveDown(0.5);
                
                doc.fontSize(10)
                   .font('Helvetica')
                   .text(`Class: ${sanitizeForPDF(classData.name)}  |  Teacher: ${sanitizeForPDF(classData.teacher_name) || ''}  |  Date Range: ${startDate} to ${endDate}`, 
                         { align: 'center' });
                
                doc.moveDown(0.8);
            };
            
            // Function to draw section with specific date chunk
            const drawSection = (sectionStudents, sectionTitle, dateChunk, currentY) => {
                if (sectionStudents.length === 0) return currentY;
                
                const dateColumnWidth = Math.min(40, availableWidth / dateChunk.length);
                const totalTableWidth = NAME_COLUMN_WIDTH + (dateColumnWidth * dateChunk.length);
                
                // Section header with blue background
                doc.rect(startX, currentY - 3, totalTableWidth, ROW_HEIGHT)
                   .fillAndStroke('#8FAADC', '#4472C4');
                
                doc.font('Helvetica-Bold')
                   .fontSize(10)
                   .fillColor('#1F3A5F')
                   .text(sectionTitle, startX + 5, currentY, { 
                       width: totalTableWidth - 10, 
                       height: ROW_HEIGHT,
                       valign: 'center'
                   });
                
                currentY += ROW_HEIGHT;
                
                // Reset fill color
                doc.fillColor('black');
                
                // Date headers
                doc.font('Helvetica-Bold')
                   .fontSize(7);
                
                // Student name header
                doc.rect(startX, currentY, NAME_COLUMN_WIDTH, ROW_HEIGHT)
                   .lineWidth(2) // Thicker border for header
                   .fillAndStroke('#4472C4', '#2B5797');
                doc.lineWidth(1); // Reset line width
                doc.fillColor('white')
                   .text('Student Name', startX + 3, currentY + 5, { 
                       width: NAME_COLUMN_WIDTH - 6,
                       height: ROW_HEIGHT 
                   });
                
                // Date column headers
                dateChunk.forEach((date, idx) => {
                    const x = startX + NAME_COLUMN_WIDTH + (idx * dateColumnWidth);
                    doc.rect(x, currentY, dateColumnWidth, ROW_HEIGHT)
                       .lineWidth(2)
                       .fillAndStroke('#4472C4', '#2B5797');
                    doc.lineWidth(1);
                    
                    // Format date as M/D
                    const dateObj = new Date(date + 'T00:00:00');
                    const shortDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                    
                    doc.fillColor('white')
                       .text(shortDate, x + 2, currentY + 5, { 
                           width: dateColumnWidth - 4,
                           height: ROW_HEIGHT,
                           align: 'center'
                       });
                });
                
                currentY += ROW_HEIGHT;
                doc.fillColor('black');
                
                // Student rows
                doc.font('Helvetica')
                   .fontSize(9);
                
                sectionStudents.forEach((student, idx) => {
                    // Check for page break
                    if (currentY > doc.page.height - 80) {
                        doc.addPage();
                        currentY = 50;
                        drawPageHeader();
                        currentY = doc.y;
                    }
                    
                    // Row background based on student color_code or alternating pattern
                    let bgColor = null;
                    if (student.color_code === 'yellow') {
                        bgColor = '#FFF9E6';
                    } else if (student.color_code === 'blue') {
                        bgColor = '#E6F3FF';
                    } else if (idx % 2 === 1) {
                        bgColor = '#FFF9E6';
                    }
                    
                    if (bgColor) {
                        doc.rect(startX, currentY, totalTableWidth, ROW_HEIGHT)
                           .fill(bgColor);
                        doc.fillColor('black');
                    }
                    
                    // Student name (truncate if too long and sanitize)
                    const maxNameLength = 18;
                    const sanitizedName = sanitizeForPDF(student.name);
                    const studentName = sanitizedName.length > maxNameLength 
                        ? sanitizedName.substring(0, maxNameLength) + '...' 
                        : sanitizedName;
                    
                    // Draw border around name cell
                    doc.rect(startX, currentY, NAME_COLUMN_WIDTH, ROW_HEIGHT)
                       .stroke('#CCCCCC');
                    
                    doc.text(studentName, startX + 3, currentY + 5, { 
                        width: NAME_COLUMN_WIDTH - 6,
                        height: ROW_HEIGHT 
                    });
                    
                    // Attendance cells
                    dateChunk.forEach((date, dateIdx) => {
                        const x = startX + NAME_COLUMN_WIDTH + (dateIdx * dateColumnWidth);
                        const key = `${student.id}-${date}`;
                        const status = attendanceMap[key] || '';
                        
                        // Apply subtle background color for status
                        let cellBgColor = null;
                        let textColor = 'black';
                        if (status === 'X') {
                            cellBgColor = '#FFE6E6';
                            textColor = '#DC3545';
                        } else if (status === '/') {
                            cellBgColor = '#FFF9E6';
                            textColor = '#FFC107';
                        } else if (status === 'O') {
                            cellBgColor = '#E8F5E9';
                            textColor = '#28A745';
                        }
                        
                        // Draw cell background with color if status exists
                        if (cellBgColor) {
                            doc.rect(x, currentY, dateColumnWidth, ROW_HEIGHT)
                               .fill(cellBgColor);
                        }
                        
                        // Draw cell border (thicker for better printing)
                        doc.rect(x, currentY, dateColumnWidth, ROW_HEIGHT)
                           .lineWidth(1.5)
                           .stroke('#999999');
                        doc.lineWidth(1);
                        
                        doc.fillColor('black');
                        
                        // Draw status symbol
                        if (status) {
                            doc.font('Helvetica-Bold')
                               .fontSize(11)
                               .fillColor(textColor)
                               .text(status, x + 2, currentY + 4, { 
                                   width: dateColumnWidth - 4,
                                   height: ROW_HEIGHT,
                                   align: 'center'
                               });
                            doc.font('Helvetica')
                               .fontSize(9)
                               .fillColor('black');
                        }
                    });
                    
                    currentY += ROW_HEIGHT;
                });
                
                currentY += 10; // Space after section
                return currentY;
            };
            
            // Render each date chunk on separate page(s)
            dateChunks.forEach((dateChunk, chunkIndex) => {
                if (chunkIndex > 0) {
                    doc.addPage();
                }
                
                drawPageHeader();
                let currentY = doc.y;
                
                // Add page indicator if multiple chunks
                if (dateChunks.length > 1) {
                    doc.fontSize(9)
                       .font('Helvetica')
                       .text(`Page ${chunkIndex + 1} of ${dateChunks.length}`, { align: 'right' });
                    currentY = doc.y + 5;
                }
                
                // Draw Regular Students section
                currentY = drawSection(regularStudents, 'Regular Students', dateChunk, currentY);
                
                // Draw Trial/Make-up Students section
                if (trialStudents.length > 0) {
                    currentY = drawSection(trialStudents, 'Make-up / Trial Students', dateChunk, currentY);
                }
                
                // Summary statistics (only on last chunk)
                if (chunkIndex === dateChunks.length - 1) {
                    doc.moveDown(1);
                    currentY = doc.y;
                    
                    let totalPresent = 0;
                    let totalAbsent = 0;
                    let totalPartial = 0;
                    
                    Object.values(attendanceMap).forEach(status => {
                        if (status === 'O') totalPresent++;
                        else if (status === 'X') totalAbsent++;
                        else if (status === '/') totalPartial++;
                    });
                    
                    doc.font('Helvetica-Bold')
                       .fontSize(10)
                       .text(`Summary: Total Students: ${students.length}  |  Total Records: ${Object.keys(attendanceMap).length}  |  Present: ${totalPresent}  |  Absent: ${totalAbsent}  |  Partial: ${totalPartial}`, 
                             startX, currentY);
                }
                
                // Footer
                doc.fontSize(8)
                   .font('Helvetica')
                   .text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 
                         30, doc.page.height - 40, { align: 'center', width: doc.page.width - 60 });
            });
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Format a date for display in PDFs (e.g., "Mar. 4, 2026")
 * @param {string} dateStr - Date string (YYYY-MM-DD or similar)
 * @returns {string} Formatted date
 */
function formatPDFDate(dateStr) {
    if (!dateStr) return '';
    try {
        // Handle YYYY-MM-DD format directly
        const s = String(dateStr);
        const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const day = parseInt(match[3]);
            return `${MONTH_ABBR[month]} ${day}, ${year}`;
        }
        // Fallback: try parsing as date
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return String(dateStr);
        const jpDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        return `${MONTH_ABBR[jpDate.getMonth()]} ${jpDate.getDate()}, ${jpDate.getFullYear()}`;
    } catch {
        return String(dateStr);
    }
}

/**
 * Generate a PDF for lesson report
 * @param {Object} reportData - Lesson report data
 * @param {Object} classData - Class information
 * @param {Array} students - Optional array of students in the class
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateLessonReportPDF(reportData, classData, students = null) {
    return new Promise((resolve, reject) => {
        try {
            const MARGIN = 40;
            const CONTENT_WIDTH = 595.28 - MARGIN * 2; // A4 width minus margins
            // No footer — removes overflow risk; page numbers shown only on multi-page docs

            const doc = new PDFDocument({
                margin: MARGIN,
                size: 'A4',
                bufferPages: true,
                info: {
                    Title: 'Lesson Report – Vitamin English School',
                    Author: sanitizeForPDF(reportData.teacher_name) || 'Vitamin English',
                    Creator: 'Vitamin English School'
                }
            });
            const buffers = [];

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const PAGE_H     = doc.page.height;
            const SAFE_BOTTOM = PAGE_H - 36; // minimal bottom margin, no footer

            // Register Japanese fonts
            doc.registerFont('NotoJP', path.join(__dirname, '..', 'fonts', 'NotoSansJP-Regular.ttf'));
            doc.registerFont('NotoJP-Bold', path.join(__dirname, '..', 'fonts', 'NotoSansJP-Bold.ttf'));

            // ── Helper: section heading bar ─────────────────────────────────────
            const drawSectionHeading = (title) => {
                if (doc.y > SAFE_BOTTOM - 60) {
                    doc.addPage();
                }
                const y = doc.y;
                doc.rect(MARGIN, y, CONTENT_WIDTH, 22)
                   .fill(THEME.colors.primaryBlue);
                doc.fontSize(10.5)
                   .font('Helvetica-Bold')
                   .fillColor(THEME.colors.white)
                   .text(title, MARGIN + 10, y + 5.5, { width: CONTENT_WIDTH - 20 });
                doc.y = y + 22 + 8;
            };

            // ── Helper: add a detail field (collapsed when empty) ───────────────
            const addField = (label, content) => {
                const text = sanitizeForPDF(content || '').trim();
                if (!text) return; // collapse empty fields

                // Estimate content height for pre-emptive page break
                const contentFont = CJK_REGEX.test(text) ? 'NotoJP' : 'Helvetica';
                const estimatedLines = Math.ceil(doc.heightOfString(text, {
                    width: CONTENT_WIDTH - 12,
                    font: contentFont,
                    size: 10
                }) / 14);
                const neededHeight = 16 + estimatedLines * 14 + 14; // label + content + padding
                if (doc.y + neededHeight > SAFE_BOTTOM) {
                    doc.addPage();
                }

                const fieldY = doc.y;
                const hasJapanese = CJK_REGEX.test(label);

                // Label row (primary-blue text, bold)
                if (hasJapanese) {
                    const parenIdx = label.search(/\([\u3040-\u30FF\u3000-\u9FFF\uF900-\uFAFF]/);
                    if (parenIdx > 0) {
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(THEME.colors.primaryBlue)
                           .text(label.slice(0, parenIdx), MARGIN, fieldY, { continued: true });
                        doc.font('NotoJP-Bold').text(label.slice(parenIdx));
                    } else {
                        doc.fontSize(10).font('NotoJP-Bold').fillColor(THEME.colors.primaryBlue)
                           .text(label, MARGIN, fieldY);
                    }
                } else {
                    doc.fontSize(10).font('Helvetica-Bold').fillColor(THEME.colors.primaryBlue)
                       .text(label, MARGIN, fieldY);
                }

                // Content text with full word-wrap
                doc.fontSize(10).font(contentFont).fillColor(THEME.colors.textDark)
                   .text(text, MARGIN + 6, doc.y, {
                       width: CONTENT_WIDTH - 12,
                       align: 'left',
                       lineBreak: true
                   });

                // Thin separator rule
                doc.moveTo(MARGIN, doc.y + 5)
                   .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 5)
                   .lineWidth(0.4)
                   .strokeColor('#EEEEEE')
                   .stroke();
                doc.y = doc.y + 11;
            };

            // ══════════════════════════════════════════════════════════════════
            // PAGE HEADER — blue bar with school name & report type
            // ══════════════════════════════════════════════════════════════════
            const HDR_H = 80;
            doc.rect(0, 0, doc.page.width, HDR_H)
               .fill(THEME.colors.primaryBlue);

            // Thin accent stripe at bottom of header
            doc.rect(0, HDR_H - 4, doc.page.width, 4)
               .fill(THEME.colors.secondaryBlue);

            doc.fontSize(22).font('Helvetica-Bold').fillColor(THEME.colors.white)
               .text('Vitamin English School', MARGIN, 18, { align: 'center' });

            doc.fontSize(12).fillColor(THEME.colors.accentYellow)
               .text('Lesson Report', MARGIN, 48, { align: 'center' });

            doc.y = HDR_H + 16;

            // ── Class Information — horizontal 3-column card ───────────────────
            const INFO_H  = 52;
            const infoBoxY = doc.y;
            const colW3   = CONTENT_WIDTH / 3;

            doc.rect(MARGIN, infoBoxY, CONTENT_WIDTH, INFO_H)
               .fill(THEME.colors.accentYellow);
            // Left border accent
            doc.rect(MARGIN, infoBoxY, 4, INFO_H)
               .fill(THEME.colors.secondaryBlue);

            const infoItems = [
                { label: 'Class',   value: sanitizeForPDF(classData.name) || '—' },
                { label: 'Teacher', value: sanitizeForPDF(reportData.teacher_name) || '—' },
                { label: 'Date',    value: formatPDFDate(reportData.date) }
            ];

            infoItems.forEach((item, i) => {
                const x = MARGIN + 12 + i * colW3;
                doc.fontSize(8).font('Helvetica-Bold').fillColor(THEME.colors.secondaryBlue)
                   .text(item.label.toUpperCase(), x, infoBoxY + 9, { width: colW3 - 12 });
                doc.fontSize(11).font('Helvetica').fillColor(THEME.colors.textDark)
                   .text(item.value, x, infoBoxY + 21, { width: colW3 - 12, lineBreak: false });
            });

            doc.y = infoBoxY + INFO_H + 14;

            // ── Students in Class (collapsed when none) ────────────────────────
            if (students && students.length > 0) {
                drawSectionHeading('Students in Class');

                const studentStartY = doc.y;
                const leftX  = MARGIN;
                const rightX = MARGIN + CONTENT_WIDTH / 2 + 4;
                const colW   = CONTENT_WIDTH / 2 - 8;
                let maxY     = studentStartY;

                doc.fontSize(10).font('Helvetica').fillColor(THEME.colors.textDark);

                students.forEach((student, index) => {
                    const col  = index % 2;
                    const row  = Math.floor(index / 2);
                    const x    = col === 0 ? leftX : rightX;
                    const y    = studentStartY + row * 17;
                    const name = sanitizeForPDF(student.name || '').substring(0, 35);

                    doc.text(`• ${name}`, x, y, { width: colW, lineBreak: false });
                    if (y + 17 > maxY) maxY = y + 17;
                });

                doc.y = maxY + 12;
            }

            // ── Lesson Details ─────────────────────────────────────────────────
            drawSectionHeading('Lesson Details');

            addField('Target/Topic:',          reportData.target_topic);
            addField('Vocabulary (単語):',      reportData.vocabulary);
            addField('Phrases (文):',            reportData.phrases);
            addField('Mistakes (specific):',     reportData.mistakes);
            addField('Strengths (specific):',    reportData.strengths);
            addField('Comments/Homework:',       reportData.comments);
            addField('Others (その他):',         reportData.others);

            // ── Page numbers (only when multi-page) ───────────────────────────
            const totalPages = doc.bufferedPageRange().count;
            if (totalPages > 1) {
                for (let i = 0; i < totalPages; i++) {
                    doc.switchToPage(i);
                    doc.fontSize(8).font('Helvetica').fillColor('#AAAAAA')
                       .text(`${i + 1} / ${totalPages}`, MARGIN, PAGE_H - 24,
                             { width: CONTENT_WIDTH, align: 'right' });
                }
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate a combined PDF for multiple classes' lesson reports
 * @param {Array} classReportsData - Array of objects with classData, reports, and students
 * @param {String} startDate - Start date for the report range
 * @param {String} endDate - End date for the report range
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateMultiClassReportPDF(classReportsData, startDate, endDate) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Cover Page
            doc.rect(0, 0, doc.page.width, 120)
               .fillAndStroke(THEME.colors.primaryBlue, THEME.colors.secondaryBlue);
            
            doc.fontSize(32)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.white)
               .text('Vitamin English School', 50, 30, { align: 'center' });
            
            doc.fontSize(22)
               .fillColor(THEME.colors.accentYellow)
               .text('Multi-Class Lesson Reports', 50, 75, { align: 'center' });
            
            doc.moveDown(4);
            doc.fillColor(THEME.colors.textDark);
            
            // Summary Section
            const summaryY = doc.y;
            doc.rect(50, summaryY, doc.page.width - 100, 30)
               .fillAndStroke(THEME.colors.lightBlue, THEME.colors.primaryBlue);
            
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.textDark)
               .text('Report Summary', 60, summaryY + 9);
            
            doc.moveDown(2);
            
            // Yellow background for summary details
            const detailsY = doc.y;
            const totalReports = classReportsData.reduce((sum, cr) => sum + cr.reports.length, 0);
            const totalClasses = classReportsData.length;
            
            doc.rect(50, detailsY - 5, doc.page.width - 100, 85)
               .fill(THEME.colors.accentYellow);
            doc.fillColor(THEME.colors.textDark);
            
            doc.fontSize(11)
               .font('Helvetica')
               .text(`Date Range: ${startDate} to ${endDate}`, 60, detailsY)
               .text(`Total Classes: ${totalClasses}`, 60, detailsY + 20)
               .text(`Total Reports: ${totalReports}`, 60, detailsY + 40)
               .text(`Classes Covered:`, 60, detailsY + 60);
            
            const classNames = classReportsData.map(cr => sanitizeForPDF(cr.classData.name)).join(', ');
            doc.fontSize(10)
               .text(classNames, 140, detailsY + 60, { width: doc.page.width - 200 });
            
            doc.moveDown(3);
            
            // Table of Contents
            doc.fontSize(13)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.primaryBlue)
               .text('Table of Contents', 50, doc.y);
            
            doc.moveDown(0.5);
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor(THEME.colors.textDark);
            
            classReportsData.forEach((cr, index) => {
                doc.text(`${index + 1}. ${sanitizeForPDF(cr.classData.name)} - ${cr.reports.length} report(s)`, 
                         60, doc.y);
                doc.moveDown(0.3);
            });
            
            // Loop through each class and add reports
            classReportsData.forEach((classReportData, classIndex) => {
                const { classData, reports, students } = classReportData;
                
                // Start new page for each class
                doc.addPage();
                
                // Class Header
                doc.rect(0, 0, doc.page.width, 80)
                   .fillAndStroke(THEME.colors.primaryBlue, THEME.colors.secondaryBlue);
                
                doc.fontSize(22)
                   .font('Helvetica-Bold')
                   .fillColor(THEME.colors.white)
                   .text(sanitizeForPDF(classData.name), 50, 25, { align: 'center' });
                
                doc.fontSize(12)
                   .fillColor(THEME.colors.accentYellow)
                   .text(`${reports.length} Report${reports.length !== 1 ? 's' : ''}`, 50, 55, { align: 'center' });
                
                doc.moveDown(3);
                doc.fillColor(THEME.colors.textDark);
                
                // Student List for this class
                if (students && students.length > 0) {
                    const studentsY = doc.y;
                    doc.rect(50, studentsY, doc.page.width - 100, 25)
                       .fillAndStroke(THEME.colors.lightBlue, THEME.colors.primaryBlue);
                    
                    doc.fontSize(12)
                       .font('Helvetica-Bold')
                       .fillColor(THEME.colors.textDark)
                       .text(`Students (${students.length})`, 60, studentsY + 7);
                    
                    doc.moveDown(1.5);
                    
                    // Two-column layout for student names
                    const studentStartY = doc.y;
                    const leftColumnX = 60;
                    const rightColumnX = 320;
                    let currentY = studentStartY;
                    
                    doc.fontSize(9)
                       .font('Helvetica');
                    
                    students.forEach((student, index) => {
                        const isLeftColumn = index % 2 === 0;
                        const x = isLeftColumn ? leftColumnX : rightColumnX;
                        
                        if (!isLeftColumn) {
                            currentY = studentStartY + Math.floor(index / 2) * 14;
                        } else if (index > 0) {
                            currentY = studentStartY + Math.floor(index / 2) * 14;
                        }
                        
                        const studentName = sanitizeForPDF(student.name);
                        const displayName = studentName.length > 28 
                            ? studentName.substring(0, 28) + '...' 
                            : studentName;
                        
                        doc.text(`• ${displayName}`, x, currentY);
                    });
                    
                    const rowsNeeded = Math.ceil(students.length / 2);
                    doc.y = studentStartY + (rowsNeeded * 14) + 10;
                    doc.moveDown(1);
                }
                
                // Reports for this class
                if (reports.length === 0) {
                    doc.fontSize(11)
                       .font('Helvetica')
                       .fillColor(THEME.colors.textSecondary)
                       .text('No reports found for this class in the selected date range.', 60, doc.y);
                } else {
                    // Sort reports by date
                    const sortedReports = reports.sort((a, b) => new Date(a.date) - new Date(b.date));
                    
                    sortedReports.forEach((report, reportIndex) => {
                        // Check for page break
                        if (doc.y > doc.page.height - 200) {
                            doc.addPage();
                            doc.y = 50;
                        }
                        
                        // Report divider
                        if (reportIndex > 0) {
                            doc.moveDown(0.5);
                            doc.moveTo(50, doc.y)
                               .lineTo(doc.page.width - 50, doc.y)
                               .stroke('#CCCCCC');
                            doc.moveDown(0.5);
                        }
                        
                        // Report date header
                        const reportHeaderY = doc.y;
                        doc.rect(50, reportHeaderY, doc.page.width - 100, 22)
                           .fill(THEME.colors.accentYellow);
                        
                        doc.fontSize(11)
                           .font('Helvetica-Bold')
                           .fillColor(THEME.colors.textDark)
                           .text(`📅 ${report.date} - ${sanitizeForPDF(report.teacher_name) || ''}`, 
                                 60, reportHeaderY + 6);
                        
                        doc.moveDown(1.2);
                        
                        // Report fields
                        const addField = (label, content) => {
                            if (!content) return;
                            
                            if (doc.y > doc.page.height - 100) {
                                doc.addPage();
                                doc.y = 50;
                            }
                            
                            doc.fontSize(10)
                               .font('Helvetica-Bold')
                               .fillColor(THEME.colors.primaryBlue)
                               .text(label, 60, doc.y);
                            
                            doc.moveDown(0.2);
                            doc.fontSize(9)
                               .font('Helvetica')
                               .fillColor(THEME.colors.textDark)
                               .text(sanitizeForPDF(content), 60, doc.y, { 
                                   width: doc.page.width - 120,
                                   align: 'left'
                               });
                            
                            doc.moveDown(0.5);
                        };
                        
                        addField('Target Topic:', report.target_topic);
                        addField('Vocabulary:', report.vocabulary);
                        addField('Mistakes:', report.mistakes);
                        addField('Strengths:', report.strengths);
                        addField('Comments/Homework:', report.comments);
                        
                        doc.moveDown(0.3);
                    });
                }
            });
            
            // Final footer on last page
            doc.fontSize(9)
               .font('Helvetica')
               .fillColor('#666666')
               .text(`Multi-Class Report | ${classReportsData.length} Classes | ${classReportsData.reduce((sum, cr) => sum + cr.reports.length, 0)} Reports`, 
                     50, doc.page.height - 70, { align: 'center' })
               .text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 
                     50, doc.page.height - 50, { align: 'center' });
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// ─── New PDF generators (Part 3) ──────────────────────────────────────────────

const path_module = require('path');
const NOTO_REG_PATH = path_module.join(__dirname, '..', 'fonts', 'NotoSansJP-Regular.ttf');
const NOTO_BOLD_PATH = path_module.join(__dirname, '..', 'fonts', 'NotoSansJP-Bold.ttf');
const MONTH_JP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

/**
 * Register NotoJP fonts on a PDFKit document (idempotent-safe wrapper).
 */
function registerNotoFonts(doc) {
    try {
        doc.registerFont('NotoJP', NOTO_REG_PATH);
        doc.registerFont('NotoJP-Bold', NOTO_BOLD_PATH);
    } catch (err) {
        // Fonts may already be registered on this document instance
        if (process.env.NODE_ENV === 'development') {
            console.debug('[PDF] Font registration skipped:', err.message);
        }
    }
}

/**
 * Enhanced Attendance Grid PDF — schedule-aware, bilingual JP/EN, summary stats.
 * Used by the upgraded POST /pdf/attendance-grid/:classId endpoint.
 *
 * @param {Object} classData      – class row including teacher_name, schedule
 * @param {Array}  students       – student rows
 * @param {Array}  dates          – array of ISO date strings to display
 * @param {Object} attendanceMap  – "studentId-date" => status
 * @param {String} startDate      – ISO start date
 * @param {String} endDate        – ISO end date
 * @param {Array}  scheduleDates  – dates that match the class schedule (for ★ detection)
 * @param {Object} options        – { includeStats, includeComments, orientation }
 * @returns {Promise<Buffer>}
 */
async function generateEnhancedAttendanceGridPDF(classData, students, dates, attendanceMap, startDate, endDate, scheduleDates = [], options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const { includeStats = true, includeComments = true } = options;
            const scheduleSet = new Set(scheduleDates);

            // ── Filter dates to only those matching the class schedule ─────────
            // This eliminates irrelevant columns and avoids blank pages
            let filteredDates = dates;
            if (scheduleDates.length > 0) {
                filteredDates = dates.filter(d => scheduleSet.has(d));
                // Fallback: if schedule filtering removes all dates, use original list
                if (filteredDates.length === 0) filteredDates = dates;
            }

            // Margins: 15mm top/bottom, 10mm sides (in points: 1mm ≈ 2.835pt)
            const MARGIN_SIDE = 28; // ~10mm
            const MARGIN_TOP  = 43; // ~15mm
            const MARGIN_BOT  = 43;
            const ROW_H = 20;
            const NAME_COL = 130;

            const doc = new PDFDocument({ margin: MARGIN_SIDE, size: 'A4', layout: 'landscape' });
            registerNotoFonts(doc);

            const buffers = [];
            doc.on('data', c => buffers.push(c));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const PAGE_W = doc.page.width;
            const PAGE_H = doc.page.height;
            const CONTENT_W = PAGE_W - MARGIN_SIDE * 2;

            // ── Date chunk calculation ──────────────────────────────────────
            const MIN_DATE_COL = 32;
            const maxPerPage = Math.floor((CONTENT_W - NAME_COL - 55) / MIN_DATE_COL); // 55 = rate col
            const RATE_COL = 55;
            const chunks = [];
            for (let i = 0; i < filteredDates.length; i += maxPerPage) chunks.push(filteredDates.slice(i, i + maxPerPage));
            if (chunks.length === 0) chunks.push([]);

            const regularStudents = students.filter(s => s.student_type === 'regular');
            const trialStudents   = students.filter(s => s.student_type !== 'regular');

            // ── Month/year for bilingual header ────────────────────────────
            const startObj = new Date((startDate || new Date().toISOString().split('T')[0]) + 'T00:00:00');
            const monthLabel = MONTH_JP[startObj.getMonth()] + ' / ' + MONTH_ABBR[startObj.getMonth()];
            const yearLabel  = startObj.getFullYear();

            // ── Draw one chunk per page ────────────────────────────────────
            chunks.forEach((chunk, chunkIdx) => {
                if (chunkIdx > 0) doc.addPage();

                const dateColW = chunk.length > 0 ? Math.min(45, Math.floor((CONTENT_W - NAME_COL - RATE_COL) / chunk.length)) : 40;
                const tableW   = NAME_COL + dateColW * chunk.length + RATE_COL;

                // ── Page header ─────────────────────────────────────────
                let y = MARGIN_TOP;
                doc.fontSize(16).font('NotoJP-Bold')
                   .fillColor('#333333')
                   .text('Vitamin English', MARGIN_SIDE, y, { align: 'center', width: CONTENT_W });
                y += 22;
                doc.fontSize(10).font('NotoJP')
                   .fillColor('#555555')
                   .text(`クラス / Class: ${sanitizeForPDF(classData.name)}   先生 / Teacher: ${sanitizeForPDF(classData.teacher_name || '')}   月 / Month: ${monthLabel} ${yearLabel}`,
                         MARGIN_SIDE, y, { align: 'center', width: CONTENT_W });
                y += 16;

                if (chunks.length > 1) {
                    doc.fontSize(8).font('NotoJP').fillColor('#888888')
                       .text(`(${chunkIdx + 1} / ${chunks.length})`, MARGIN_SIDE, y, { align: 'right', width: CONTENT_W });
                    y += 12;
                }
                y += 4; // separator gap

                // ── Column header row ───────────────────────────────────
                doc.rect(MARGIN_SIDE, y, NAME_COL, ROW_H).fillAndStroke('#4472C4', '#2B5797');
                doc.fillColor('white').font('NotoJP-Bold').fontSize(8)
                   .text('氏名 / Student', MARGIN_SIDE + 3, y + 5, { width: NAME_COL - 6 });

                chunk.forEach((date, di) => {
                    const x = MARGIN_SIDE + NAME_COL + di * dateColW;
                    const isMakeup = date && scheduleSet.size > 0 && !scheduleSet.has(date);
                    doc.rect(x, y, dateColW, ROW_H).fillAndStroke(isMakeup ? '#7B68EE' : '#4472C4', '#2B5797');
                    const d = new Date(date + 'T00:00:00');
                    const label = `${d.getMonth()+1}/${d.getDate()}${isMakeup ? '★' : ''}`;
                    doc.fillColor('white').font('NotoJP-Bold').fontSize(7)
                       .text(label, x + 1, y + 5, { width: dateColW - 2, align: 'center' });
                });

                // Rate column header
                const rateX = MARGIN_SIDE + NAME_COL + chunk.length * dateColW;
                doc.rect(rateX, y, RATE_COL, ROW_H).fillAndStroke('#2B5797', '#1a3d6b');
                doc.fillColor('white').font('NotoJP-Bold').fontSize(7)
                   .text('出席率 / Rate', rateX + 2, y + 5, { width: RATE_COL - 4, align: 'center' });
                y += ROW_H;

                // Helper to draw both sections (captures y from outer scope via ref trick)
                const drawStudentRows = (sectionStudents, sectionTitle) => {
                    if (sectionStudents.length === 0) return;

                    // Section header
                    doc.rect(MARGIN_SIDE, y, tableW, ROW_H).fillAndStroke('#8FAADC', '#4472C4');
                    doc.fillColor('#1F3A5F').font('NotoJP-Bold').fontSize(8)
                       .text(sectionTitle, MARGIN_SIDE + 4, y + 5, { width: tableW - 8, height: ROW_H });
                    y += ROW_H;
                    doc.fillColor('black');

                    sectionStudents.forEach((student, rowIdx) => {
                        if (y + ROW_H > PAGE_H - MARGIN_BOT - (includeStats ? 30 : 0)) {
                            doc.addPage();
                            y = MARGIN_TOP;
                        }

                        const bgColor = rowIdx % 2 === 0 ? '#FFFFFF' : '#F8F8FA';
                        doc.rect(MARGIN_SIDE, y, tableW, ROW_H).fill(bgColor).fillColor('black');

                        // Name
                        doc.rect(MARGIN_SIDE, y, NAME_COL, ROW_H).lineWidth(0.5).stroke('#CCCCCC');
                        const sName = sanitizeForPDF(student.name);
                        doc.font('NotoJP').fontSize(8).fillColor('#333333')
                           .text(sName.length > 20 ? sName.substring(0, 20) + '…' : sName, MARGIN_SIDE + 3, y + 5, { width: NAME_COL - 6 });

                        // Attendance cells
                        let sPresent = 0, sTotal = 0;
                        chunk.forEach((date, di) => {
                            const x = MARGIN_SIDE + NAME_COL + di * dateColW;
                            const key = `${student.id}-${date}`;
                            const status = attendanceMap[key] || '';
                            const bgMap = { 'O': '#E8F5E9', 'X': '#FFE6E6', '/': '#FFF9E6' };
                            const colMap = { 'O': '#28A745', 'X': '#DC3545', '/': '#FFC107' };
                            if (bgMap[status]) doc.rect(x, y, dateColW, ROW_H).fill(bgMap[status]).fillColor('black');
                            doc.rect(x, y, dateColW, ROW_H).lineWidth(0.5).stroke('#CCCCCC');
                            if (status) {
                                doc.font('NotoJP-Bold').fontSize(10).fillColor(colMap[status] || '#333')
                                   .text(status, x + 1, y + 4, { width: dateColW - 2, align: 'center' });
                                doc.fillColor('black');
                            }
                            if (status) { sTotal++; if (status === 'O') sPresent++; }
                        });

                        // Rate cell
                        const rateXr = MARGIN_SIDE + NAME_COL + chunk.length * dateColW;
                        const rate = sTotal > 0 ? Math.round((sPresent / sTotal) * 100) : null;
                        const rateBg = rate === null ? '#eeeeee' : rate >= 85 ? '#d4edda' : rate >= 65 ? '#fff3cd' : '#f8d7da';
                        doc.rect(rateXr, y, RATE_COL, ROW_H).fill(rateBg).fillColor('black');
                        doc.rect(rateXr, y, RATE_COL, ROW_H).lineWidth(0.5).stroke('#AAAAAA');
                        doc.font('NotoJP-Bold').fontSize(8).fillColor('#333333')
                           .text(rate !== null ? `${sPresent}/${sTotal} = ${rate}%` : '—', rateXr + 2, y + 5, { width: RATE_COL - 4, align: 'center' });
                        y += ROW_H;
                    });

                    y += 6; // gap after section
                };

                drawStudentRows(regularStudents, 'Regular Students / レギュラー生徒');
                if (trialStudents.length > 0) drawStudentRows(trialStudents, 'Make-up / Trial / 補講・体験');

                // ── Summary row: present count per column ──────────────
                if (includeStats && chunk.length > 0) {
                    if (y + ROW_H > PAGE_H - MARGIN_BOT) { doc.addPage(); y = MARGIN_TOP; }
                    doc.rect(MARGIN_SIDE, y, tableW, ROW_H).fill('#E8EAF6').fillColor('black');
                    doc.lineWidth(1).rect(MARGIN_SIDE, y, tableW, ROW_H).stroke('#4472C4');
                    doc.font('NotoJP-Bold').fontSize(8).fillColor('#333333')
                       .text('出席数 / Present', MARGIN_SIDE + 3, y + 5, { width: NAME_COL - 6 });
                    chunk.forEach((date, di) => {
                        const x = MARGIN_SIDE + NAME_COL + di * dateColW;
                        const presentCount = students.filter(s => (attendanceMap[`${s.id}-${date}`] || '') === 'O').length;
                        const totalCount = students.length;
                        doc.rect(x, y, dateColW, ROW_H).lineWidth(0.5).stroke('#4472C4');
                        doc.font('NotoJP-Bold').fontSize(8).fillColor('#2B5797')
                           .text(`${presentCount}/${totalCount}`, x + 1, y + 5, { width: dateColW - 2, align: 'center' });
                    });
                    y += ROW_H + 8;
                }

                // ── Teacher comment section ────────────────────────────
                if (includeComments && chunkIdx === chunks.length - 1) {
                    if (y + 50 > PAGE_H - MARGIN_BOT) { doc.addPage(); y = MARGIN_TOP; }
                    doc.rect(MARGIN_SIDE, y, CONTENT_W, 50).lineWidth(0.5).stroke('#AAAAAA');
                    doc.font('NotoJP').fontSize(9).fillColor('#555555')
                       .text('教員コメント / Teacher\'s Comments:', MARGIN_SIDE + 5, y + 6);
                    y += 55;
                }

                // ── Footer ────────────────────────────────────────────
                doc.fontSize(7).font('NotoJP').fillColor('#888888')
                   .text(`Generated: ${new Date().toLocaleDateString()}   |   Vitamin English`,
                         MARGIN_SIDE, PAGE_H - 25, { align: 'center', width: CONTENT_W });
            });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Student Attendance Report PDF — individual student across all classes.
 * Portrait A4, bilingual headers.
 */
async function generateStudentAttendanceReportPDF(student, records, stats, streaks) {
    return new Promise((resolve, reject) => {
        try {
            const MARGIN = 40;
            const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
            registerNotoFonts(doc);

            const buffers = [];
            doc.on('data', c => buffers.push(c));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const PAGE_W = doc.page.width;
            const CONTENT_W = PAGE_W - MARGIN * 2;

            // Header
            doc.fontSize(18).font('NotoJP-Bold').fillColor('#333333')
               .text('Vitamin English', MARGIN, MARGIN, { align: 'center', width: CONTENT_W });
            doc.fontSize(12).font('NotoJP').fillColor('#555555')
               .text('出席レポート / Attendance Report', MARGIN, MARGIN + 26, { align: 'center', width: CONTENT_W });
            doc.moveDown(0.5);
            doc.lineWidth(1).moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).stroke('#4472C4');
            doc.moveDown(0.5);

            // Student info
            doc.fontSize(11).font('NotoJP-Bold').fillColor('#333333')
               .text(`氏名 / Name: ${sanitizeForPDF(student.name)}`, { continued: true });
            doc.font('NotoJP').fillColor('#666666')
               .text(`   タイプ / Type: ${sanitizeForPDF(student.student_type || 'regular')}`);
            doc.moveDown(0.5);

            // Summary stats
            const { total, present, absent, partial, rate } = stats;
            const rateBg = rate >= 85 ? '#d4edda' : rate >= 65 ? '#fff3cd' : '#f8d7da';
            const rateColor = rate >= 85 ? '#155724' : rate >= 65 ? '#856404' : '#721c24';

            const rateBoxY = doc.y;
            doc.rect(MARGIN, rateBoxY, CONTENT_W, 30).fill(rateBg).fillColor('black');
            doc.font('NotoJP-Bold').fontSize(11).fillColor(rateColor)
               .text(`出席率 / Attendance Rate: ${rate}%   (${present}/${total} classes)`, MARGIN + 8, rateBoxY + 8, { width: CONTENT_W - 16 });
            doc.y = rateBoxY + 30;
            doc.x = MARGIN;
            doc.moveDown(0.5);

            // Streaks
            const milestones = [
                { n: 5, badge: '🌟' }, { n: 10, badge: '⭐' },
                { n: 20, badge: '🏆' }, { n: 30, badge: '👑' }, { n: 50, badge: '💎' }
            ];
            const earned = milestones.filter(m => streaks.best >= m.n).map(m => m.badge).join(' ');
            doc.font('NotoJP').fontSize(10).fillColor('#333333')
               .text(`🔥 現在の連続出席 / Current Streak: ${streaks.current}  🏆 最長連続 / Best Streak: ${streaks.best}  ${earned}`, MARGIN, doc.y);
            doc.moveDown(0.8);

            // Attendance history table
            doc.font('NotoJP-Bold').fontSize(10).fillColor('#333333')
               .text('出席履歴 / Attendance History', MARGIN, doc.y);
            doc.moveDown(0.3);

            const ROW_H = 18;
            const COL_DATE = 90, COL_STATUS = 55, COL_CLASS = CONTENT_W - COL_DATE - COL_STATUS;

            // Table header
            let y = doc.y;
            [['日付 / Date', COL_DATE, '#4472C4'], ['状態 / Status', COL_STATUS, '#4472C4'], ['クラス / Class', COL_CLASS, '#4472C4']]
                .reduce((x, [label, w, bg]) => {
                    doc.rect(MARGIN + x, y, w, ROW_H).fill(bg).fillColor('white')
                       .font('NotoJP-Bold').fontSize(8)
                       .text(label, MARGIN + x + 2, y + 4, { width: w - 4 });
                    return x + w;
                }, 0);
            y += ROW_H;

            const statusLabel = { 'O': 'Present / 出席', 'X': 'Absent / 欠席', '/': 'Partial / 遅刻', '': 'N/A' };
            const statusColor = { 'O': '#28A745', 'X': '#DC3545', '/': '#FFC107', '': '#888' };
            const statusBg    = { 'O': '#E8F5E9', 'X': '#FFE6E6', '/': '#FFF9E6', '': '#f5f5f5' };

            records.slice().reverse().forEach((rec, idx) => {
                if (y + ROW_H > doc.page.height - 60) { doc.addPage(); y = MARGIN; }
                const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8F8FA';
                doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(bg);
                let x = 0;
                const cells = [
                    [rec.date, COL_DATE, '#333333', bg],
                    [statusLabel[rec.status] || rec.status, COL_STATUS, statusColor[rec.status] || '#333', statusBg[rec.status] || bg],
                    [sanitizeForPDF(rec.class_name || ''), COL_CLASS, '#333333', bg]
                ];
                cells.forEach(([text, w, color, cbg]) => {
                    doc.rect(MARGIN + x, y, w, ROW_H).lineWidth(0.5).stroke('#CCCCCC');
                    doc.font('NotoJP').fontSize(8).fillColor(color)
                       .text(text, MARGIN + x + 2, y + 4, { width: w - 4 });
                    x += w;
                });
                y += ROW_H;
                doc.y = y; // keep doc.y in sync
            });

            doc.moveDown(1);
            doc.fontSize(7).font('NotoJP').fillColor('#888')
               .text(`Generated: ${new Date().toLocaleDateString()}`, MARGIN, doc.page.height - 30, { align: 'center', width: CONTENT_W });
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Class Attendance Summary PDF — monthly trends, per-student rates, flagged students.
 * Portrait A4.
 */
async function generateClassSummaryPDF(classData, year, monthlyStats, studentStats, lowestPerformers) {
    return new Promise((resolve, reject) => {
        try {
            const MARGIN = 40;
            const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
            registerNotoFonts(doc);

            const buffers = [];
            doc.on('data', c => buffers.push(c));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const PAGE_W = doc.page.width;
            const CONTENT_W = PAGE_W - MARGIN * 2;

            // Header
            doc.fontSize(18).font('NotoJP-Bold').fillColor('#333333')
               .text('Vitamin English', MARGIN, MARGIN, { align: 'center', width: CONTENT_W });
            doc.fontSize(12).font('NotoJP').fillColor('#555555')
               .text('クラス出席サマリー / Class Attendance Summary', MARGIN, MARGIN + 26, { align: 'center', width: CONTENT_W });
            doc.moveDown(0.5);
            doc.lineWidth(1).moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).stroke('#4472C4');
            doc.moveDown(0.5);

            doc.font('NotoJP-Bold').fontSize(11).fillColor('#333333')
               .text(`クラス / Class: ${sanitizeForPDF(classData.name)}   先生 / Teacher: ${sanitizeForPDF(classData.teacher_name || '')}   年 / Year: ${year}`);
            doc.moveDown(0.8);

            // Monthly stats bar chart (text-based)
            doc.font('NotoJP-Bold').fontSize(10).fillColor('#333333').text('月別出席率 / Monthly Attendance Rates');
            doc.moveDown(0.3);

            const ROW_H = 18;
            let y = doc.y;
            const BAR_MAX_W = CONTENT_W - 120;
            for (let m = 1; m <= 12; m++) {
                const ms = monthlyStats[m];
                if (!ms || ms.rate === null) continue;
                if (y + ROW_H > doc.page.height - 60) { doc.addPage(); y = MARGIN; }
                const barColor = ms.rate >= 85 ? '#28A745' : ms.rate >= 65 ? '#FFC107' : '#DC3545';
                const barW = Math.round((ms.rate / 100) * BAR_MAX_W);
                doc.font('NotoJP').fontSize(9).fillColor('#333').text(`${MONTH_JP[m-1]} ${MONTH_ABBR[m-1]}`, MARGIN, y + 3, { width: 60 });
                doc.rect(MARGIN + 65, y, barW, ROW_H - 4).fill(barColor).fillColor('black');
                doc.font('NotoJP-Bold').fontSize(9).fillColor('#333')
                   .text(`${ms.rate}%`, MARGIN + 70 + barW, y + 3);
                y += ROW_H + 2;
            }

            doc.moveDown(0.8);

            // Per-student rates table
            doc.font('NotoJP-Bold').fontSize(10).fillColor('#333333').text('生徒別出席率 / Per-Student Rates', MARGIN, doc.y);
            doc.moveDown(0.3);
            y = doc.y;

            const COL_NAME = 160, COL_RATE = 80, COL_COUNT = CONTENT_W - COL_NAME - COL_RATE;
            // header
            [['氏名 / Name', COL_NAME], ['出席率 / Rate', COL_RATE], ['記録 / Records', COL_COUNT]]
                .reduce((x, [label, w]) => {
                    doc.rect(MARGIN + x, y, w, ROW_H).fill('#4472C4').fillColor('white')
                       .font('NotoJP-Bold').fontSize(8)
                       .text(label, MARGIN + x + 2, y + 4, { width: w - 4 });
                    return x + w;
                }, 0);
            y += ROW_H;

            studentStats.sort((a, b) => b.rate - a.rate).forEach((ss, idx) => {
                if (y + ROW_H > doc.page.height - 60) { doc.addPage(); y = MARGIN; }
                const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8F8FA';
                const rateBg = ss.rate >= 85 ? '#d4edda' : ss.rate >= 65 ? '#fff3cd' : '#f8d7da';
                const rateCol = ss.rate >= 85 ? '#155724' : ss.rate >= 65 ? '#856404' : '#721c24';
                doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(bg);
                let x = 0;
                [[sanitizeForPDF(ss.name), COL_NAME, '#333', bg],
                 [`${ss.rate}%${ss.rate < 75 ? ' ⚠️' : ''}`, COL_RATE, rateCol, rateBg],
                 [`${ss.present} / ${ss.total}`, COL_COUNT, '#555', bg]
                ].forEach(([text, w, color, cbg]) => {
                    doc.rect(MARGIN + x, y, w, ROW_H).lineWidth(0.5).stroke('#CCCCCC');
                    doc.font('NotoJP').fontSize(8).fillColor(color)
                       .text(text, MARGIN + x + 2, y + 4, { width: w - 4 });
                    x += w;
                });
                y += ROW_H;
            });

            // Flagged students section
            if (lowestPerformers.length > 0) {
                if (y + 60 > doc.page.height - 60) { doc.addPage(); y = MARGIN; }
                y += 10;
                doc.font('NotoJP-Bold').fontSize(10).fillColor('#DC3545')
                   .text('⚠️ 要注意生徒 / Students Below 75%:', MARGIN, y);
                y += 18;
                lowestPerformers.forEach(lp => {
                    doc.font('NotoJP').fontSize(9).fillColor('#721c24')
                       .text(`  • ${sanitizeForPDF(lp.name)} — ${lp.rate}%`, MARGIN, y);
                    y += 15;
                });
            }

            doc.fontSize(7).font('NotoJP').fillColor('#888')
               .text(`Generated: ${new Date().toLocaleDateString()}`, MARGIN, doc.page.height - 30, { align: 'center', width: CONTENT_W });
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateStudentAttendancePDF,
    generateClassAttendancePDF,
    generateAttendanceGridPDF,
    generateEnhancedAttendanceGridPDF,
    generateStudentAttendanceReportPDF,
    generateClassSummaryPDF,
    generateLessonReportPDF,
    generateMultiClassReportPDF
};
