const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

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
    }
};

/**
 * Sanitize text for PDF output to prevent PDF injection attacks
 * @param {String} text - Text to sanitize
 * @returns {String} Sanitized text
 */
function sanitizeForPDF(text) {
    if (!text) return '';
    // Remove control characters and special PDF syntax characters
    return text.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
               .replace(/[<>]/g, '')
               .substring(0, 255); // Limit length
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
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Header
            doc.fontSize(24)
               .font('Helvetica-Bold')
               .text('Vitamin English School', { align: 'center' });
            
            doc.moveDown(0.5);
            doc.fontSize(18)
               .text('Student Attendance Report', { align: 'center' });
            
            doc.moveDown(1);
            
            // Student Information
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('Student Information:', { underline: true });
            
            doc.moveDown(0.5);
            doc.font('Helvetica')
               .text(`Name: ${studentData.name}`, { indent: 20 })
               .text(`Class: ${studentData.class_name || ''}`, { indent: 20 })
               .text(`Student Type: ${studentData.student_type || 'regular'}`, { indent: 20 });
            
            if (studentData.email) {
                doc.text(`Email: ${studentData.email}`, { indent: 20 });
            }
            if (studentData.phone) {
                doc.text(`Phone: ${studentData.phone}`, { indent: 20 });
            }
            
            doc.moveDown(1);
            
            // Attendance Records
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('Attendance Records:', { underline: true });
            
            doc.moveDown(0.5);
            
            if (attendanceRecords && attendanceRecords.length > 0) {
                // Table headers
                const tableTop = doc.y;
                const dateX = 70;
                const statusX = 200;
                const notesX = 280;
                
                doc.font('Helvetica-Bold')
                   .text('Date', dateX, tableTop)
                   .text('Status', statusX, tableTop)
                   .text('Notes', notesX, tableTop);
                
                doc.moveDown(0.5);
                
                // Draw line under headers
                doc.moveTo(50, doc.y)
                   .lineTo(550, doc.y)
                   .stroke();
                
                doc.moveDown(0.3);
                
                // Table rows
                doc.font('Helvetica');
                let presentCount = 0;
                let absentCount = 0;
                let lateCount = 0;
                
                attendanceRecords.forEach((record, index) => {
                    if (doc.y > 700) {
                        doc.addPage();
                        doc.y = 50;
                    }
                    
                    const rowY = doc.y;
                    const statusText = record.status === 'O' ? 'Present' : 
                                     record.status === 'X' ? 'Absent' : 
                                     record.status === '/' ? 'Late/Partial' : 'Not marked';
                    
                    if (record.status === 'O') presentCount++;
                    else if (record.status === 'X') absentCount++;
                    else if (record.status === '/') lateCount++;
                    
                    doc.text(record.date || '', dateX, rowY)
                       .text(statusText, statusX, rowY)
                       .text(record.notes || '', notesX, rowY, { width: 250 });
                    
                    doc.moveDown(0.5);
                });
                
                doc.moveDown(1);
                
                // Summary statistics
                doc.font('Helvetica-Bold')
                   .text('Summary:', { underline: true });
                
                doc.moveDown(0.3);
                doc.font('Helvetica')
                   .text(`Total Records: ${attendanceRecords.length}`, { indent: 20 })
                   .text(`Present: ${presentCount}`, { indent: 20 })
                   .text(`Absent: ${absentCount}`, { indent: 20 })
                   .text(`Late/Partial: ${lateCount}`, { indent: 20 });
                
                const attendanceRate = attendanceRecords.length > 0 
                    ? ((presentCount / attendanceRecords.length) * 100).toFixed(1)
                    : 0;
                
                doc.moveDown(0.3);
                doc.font('Helvetica-Bold')
                   .text(`Attendance Rate: ${attendanceRate}%`, { indent: 20 });
            } else {
                doc.font('Helvetica')
                   .text('No attendance records found.', { indent: 20 });
            }
            
            // Footer
            doc.fontSize(10)
               .font('Helvetica')
               .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, doc.page.height - 50, { 
                   align: 'center' 
               });
            
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
                   .fillAndStroke('#8FAADC', '#2B5797'); // Light blue background
                doc.lineWidth(1); // Reset line width
                doc.fillColor('#1F3A5F') // Dark blue text for contrast
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
                       .lineWidth(2)
                       .stroke('#999999');
                    doc.lineWidth(1); // Reset line width
                    
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
                           .lineWidth(2)
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
 * Generate a PDF for lesson report
 * @param {Object} reportData - Lesson report data
 * @param {Object} classData - Class information
 * @param {Array} students - Optional array of students in the class
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateLessonReportPDF(reportData, classData, students = null) {
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
            
            // Professional Header with Branding
            doc.rect(0, 0, doc.page.width, 100)
               .fillAndStroke(THEME.colors.primaryBlue, THEME.colors.secondaryBlue);
            
            doc.fontSize(28)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.white)
               .text('Vitamin English School', 50, 30, { align: 'center' });
            
            doc.fontSize(18)
               .fillColor(THEME.colors.accentYellow)
               .text('Lesson Report', 50, 65, { align: 'center' });
            
            doc.moveDown(3);
            doc.fillColor(THEME.colors.textDark);
            
            // Class Information Section with Blue Header
            const classInfoY = doc.y;
            doc.rect(50, classInfoY, doc.page.width - 100, 25)
               .fillAndStroke(THEME.colors.lightBlue, THEME.colors.primaryBlue);
            
            doc.fontSize(13)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.textDark)
               .text('Class Information', 60, classInfoY + 7);
            
            doc.moveDown(1.5);
            doc.fillColor(THEME.colors.textDark);
            
            // Yellow background for class details
            const detailsY = doc.y;
            doc.rect(50, detailsY - 5, doc.page.width - 100, 65)
               .fill(THEME.colors.accentYellow);
            doc.fillColor(THEME.colors.textDark);
            
            doc.fontSize(11)
               .font('Helvetica')
               .text(`Class: ${sanitizeForPDF(classData.name) || ''}`, 60, detailsY)
               .text(`Teacher: ${sanitizeForPDF(reportData.teacher_name) || ''}`, 60, detailsY + 20)
               .text(`Date: ${reportData.date || ''}`, 60, detailsY + 40);
            
            doc.moveDown(3);
            
            // Student Names Section (if provided)
            if (students && students.length > 0) {
                const studentsY = doc.y;
                doc.rect(50, studentsY, doc.page.width - 100, 25)
                   .fillAndStroke(THEME.colors.lightBlue, THEME.colors.primaryBlue);
                
                doc.fontSize(13)
                   .font('Helvetica-Bold')
                   .fillColor(THEME.colors.textDark)
                   .text('Students in Class', 60, studentsY + 7);
                
                doc.moveDown(1.5);
                
                // Two-column layout for student names
                const studentStartY = doc.y;
                const leftColumnX = 60;
                const rightColumnX = 320;
                const columnWidth = 240;
                let currentY = studentStartY;
                
                doc.fontSize(10)
                   .font('Helvetica');
                
                students.forEach((student, index) => {
                    const isLeftColumn = index % 2 === 0;
                    const x = isLeftColumn ? leftColumnX : rightColumnX;
                    
                    if (!isLeftColumn) {
                        // Right column - same Y as previous left column entry
                        currentY = studentStartY + Math.floor(index / 2) * 18;
                    } else if (index > 0) {
                        // Left column - advance Y
                        currentY = studentStartY + Math.floor(index / 2) * 18;
                    }
                    
                    const studentName = sanitizeForPDF(student.name);
                    const displayName = studentName.length > 30 
                        ? studentName.substring(0, 30) + '...' 
                        : studentName;
                    
                    doc.text(`• ${displayName}`, x, currentY, { width: columnWidth });
                });
                
                // Move down based on number of rows needed
                const rowsNeeded = Math.ceil(students.length / 2);
                doc.y = studentStartY + (rowsNeeded * 18) + 10;
                doc.moveDown(1);
            }
            
            // Lesson Details Section
            const lessonY = doc.y;
            doc.rect(50, lessonY, doc.page.width - 100, 25)
               .fillAndStroke(THEME.colors.lightBlue, THEME.colors.primaryBlue);
            
            doc.fontSize(13)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.textDark)
               .text('Lesson Details', 60, lessonY + 7);
            
            doc.moveDown(1.5);
            
            // Helper function to add a field with proper styling
            const addField = (label, content) => {
                if (!content) return;
                
                // Check for page break
                if (doc.y > doc.page.height - 150) {
                    doc.addPage();
                    doc.y = 50;
                }
                
                const fieldY = doc.y;
                doc.fontSize(11)
                   .font('Helvetica-Bold')
                   .fillColor(THEME.colors.primaryBlue)
                   .text(label, 60, fieldY);
                
                doc.moveDown(0.3);
                doc.fontSize(10)
                   .font('Helvetica')
                   .fillColor(THEME.colors.textDark)
                   .text(sanitizeForPDF(content), 60, doc.y, { 
                       width: doc.page.width - 120,
                       align: 'left'
                   });
                
                doc.moveDown(0.8);
            };
            
            addField('Target Topic:', reportData.target_topic);
            addField('New Vocabulary/Phrases:', reportData.vocabulary);
            addField('Common Mistakes:', reportData.mistakes);
            addField('Student Strengths:', reportData.strengths);
            addField('Comments/Homework:', reportData.comments);
            
            // Footer
            doc.fontSize(9)
               .font('Helvetica')
               .fillColor('#666666')
               .text(`Report ID: ${reportData.id}`, 50, doc.page.height - 70, { align: 'left' })
               .text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 
                     50, doc.page.height - 50, { align: 'center' });
            
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

module.exports = {
    generateStudentAttendancePDF,
    generateClassAttendancePDF,
    generateAttendanceGridPDF,
    generateLessonReportPDF,
    generateMultiClassReportPDF
};
