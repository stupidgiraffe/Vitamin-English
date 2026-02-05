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
               .text(`Class: ${studentData.class_name || 'N/A'}`, { indent: 20 })
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
                    
                    doc.text(record.date || 'N/A', dateX, rowY)
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
               .text(`Teacher: ${classData.teacher_name || 'N/A'}`, { indent: 50 })
               .text(`Schedule: ${classData.schedule || 'N/A'}`, { indent: 50 })
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
            
            // Header
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .text('Vitamin English School', { align: 'center' });
            
            doc.moveDown(0.3);
            doc.fontSize(14)
               .text('Attendance Grid', { align: 'center' });
            
            doc.moveDown(0.5);
            
            // Class Information
            doc.fontSize(10)
               .font('Helvetica')
               .text(`Class: ${sanitizeForPDF(classData.name)}  |  Teacher: ${sanitizeForPDF(classData.teacher_name) || 'N/A'}  |  Date Range: ${startDate} to ${endDate}`, 
                     { align: 'center' });
            
            doc.moveDown(0.8);
            
            // Separate students by type
            const regularStudents = students.filter(s => s.student_type === 'regular');
            const trialStudents = students.filter(s => s.student_type !== 'regular');
            
            // Calculate column widths based on number of dates
            const pageWidth = doc.page.width - 60; // 30px margin on each side
            const nameColumnWidth = 120;
            const availableWidth = pageWidth - nameColumnWidth;
            const dateColumnWidth = Math.min(40, availableWidth / dates.length);
            const totalTableWidth = nameColumnWidth + (dateColumnWidth * dates.length);
            
            const startX = 30;
            const rowHeight = 18;
            
            let currentY = doc.y;
            
            // Function to draw section
            const drawSection = (sectionStudents, sectionTitle, sectionColor) => {
                if (sectionStudents.length === 0) return;
                
                // Section header with blue background
                doc.rect(startX, currentY - 3, totalTableWidth, rowHeight)
                   .fillAndStroke('#8FAADC', '#4472C4');
                
                doc.font('Helvetica-Bold')
                   .fontSize(10)
                   .fillColor('#1F3A5F')
                   .text(sectionTitle, startX + 5, currentY, { 
                       width: totalTableWidth - 10, 
                       height: rowHeight,
                       valign: 'center'
                   });
                
                currentY += rowHeight;
                
                // Reset fill color
                doc.fillColor('black');
                
                // Date headers (only show month/day to save space)
                doc.font('Helvetica-Bold')
                   .fontSize(7);
                
                // Student name header
                doc.rect(startX, currentY, nameColumnWidth, rowHeight)
                   .fillAndStroke('#4472C4', '#2B5797');
                doc.fillColor('white')
                   .text('Student Name', startX + 3, currentY + 4, { 
                       width: nameColumnWidth - 6,
                       height: rowHeight 
                   });
                
                // Date column headers
                dates.forEach((date, idx) => {
                    const x = startX + nameColumnWidth + (idx * dateColumnWidth);
                    doc.rect(x, currentY, dateColumnWidth, rowHeight)
                       .fillAndStroke('#4472C4', '#2B5797');
                    
                    // Format date as M/D
                    const dateObj = new Date(date + 'T00:00:00');
                    const shortDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                    
                    doc.fillColor('white')
                       .text(shortDate, x + 2, currentY + 4, { 
                           width: dateColumnWidth - 4,
                           height: rowHeight,
                           align: 'center'
                       });
                });
                
                currentY += rowHeight;
                doc.fillColor('black');
                
                // Student rows
                doc.font('Helvetica')
                   .fontSize(9);
                
                sectionStudents.forEach((student, idx) => {
                    // Check for page break
                    if (currentY > doc.page.height - 80) {
                        doc.addPage();
                        currentY = 50;
                    }
                    
                    // Row background based on student color_code or alternating pattern
                    let bgColor = null;
                    if (student.color_code === 'yellow') {
                        bgColor = '#FFF9E6';
                    } else if (student.color_code === 'blue') {
                        bgColor = '#E6F3FF';
                    } else if (idx % 2 === 1) {
                        // Alternating yellow for non-colored students
                        bgColor = '#FFF9E6';
                    }
                    
                    if (bgColor) {
                        doc.rect(startX, currentY, totalTableWidth, rowHeight)
                           .fill(bgColor);
                        doc.fillColor('black');
                    }
                    
                    // Student name (truncate if too long and sanitize)
                    const maxNameLength = 18;
                    const sanitizedName = sanitizeForPDF(student.name);
                    const studentName = sanitizedName.length > maxNameLength 
                        ? sanitizedName.substring(0, maxNameLength) + '...' 
                        : sanitizedName;
                    
                    doc.text(studentName, startX + 3, currentY + 4, { 
                        width: nameColumnWidth - 6,
                        height: rowHeight 
                    });
                    
                    // Attendance cells
                    dates.forEach((date, dateIdx) => {
                        const x = startX + nameColumnWidth + (dateIdx * dateColumnWidth);
                        const key = `${student.id}-${date}`;
                        const status = attendanceMap[key] || '';
                        
                        // Apply subtle background color for status
                        let cellBgColor = null;
                        let textColor = 'black';
                        if (status === 'X') {
                            // Absent - subtle red/pink
                            cellBgColor = '#FFE6E6';
                            textColor = '#DC3545';
                        } else if (status === '/') {
                            // Late/Partial - subtle yellow
                            cellBgColor = '#FFF9E6';
                            textColor = '#FFC107';
                        } else if (status === 'O') {
                            // Present - subtle green
                            cellBgColor = '#F0FFF4';
                            textColor = '#28A745';
                        }
                        
                        // Draw cell background with color if status exists
                        if (cellBgColor) {
                            doc.rect(x, currentY, dateColumnWidth, rowHeight)
                               .fill(cellBgColor);
                        }
                        
                        // Draw cell border
                        doc.rect(x, currentY, dateColumnWidth, rowHeight)
                           .stroke('#CCCCCC');
                        
                        // Reset fill color after stroke to ensure text renders correctly
                        doc.fillColor('black');
                        
                        // Draw status symbol
                        if (status) {
                            doc.font('Helvetica-Bold')
                               .fontSize(10)
                               .fillColor(textColor)
                               .text(status, x + 2, currentY + 3, { 
                                   width: dateColumnWidth - 4,
                                   height: rowHeight,
                                   align: 'center'
                               });
                            doc.font('Helvetica')
                               .fontSize(9)
                               .fillColor('black');
                        }
                    });
                    
                    currentY += rowHeight;
                });
                
                currentY += 5; // Space after section
            };
            
            // Draw Regular Students section
            drawSection(regularStudents, 'Regular Students', '#8FAADC');
            
            // Draw Trial/Make-up Students section
            if (trialStudents.length > 0) {
                drawSection(trialStudents, 'Make-up / Trial Students', '#8FAADC');
            }
            
            // Summary statistics
            doc.moveDown(1);
            currentY = doc.y;
            
            // Calculate totals
            let totalPresent = 0;
            let totalAbsent = 0;
            let totalPartial = 0;
            
            Object.values(attendanceMap).forEach(status => {
                if (status === 'O') totalPresent++;
                else if (status === 'X') totalAbsent++;
                else if (status === '/') totalPartial++;
            });
            
            doc.font('Helvetica-Bold')
               .fontSize(9)
               .text(`Summary: Total Students: ${students.length}  |  Total Records: ${Object.keys(attendanceMap).length}  |  Present: ${totalPresent}  |  Absent: ${totalAbsent}  |  Partial: ${totalPartial}`, 
                     startX, currentY, { width: totalTableWidth });
            
            // Footer
            doc.fontSize(8)
               .font('Helvetica')
               .text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 
                     30, doc.page.height - 40, { align: 'center', width: doc.page.width - 60 });
            
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
               .text('🍊 Vitamin English School', 50, 30, { align: 'center' });
            
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
               .text(`Class: ${sanitizeForPDF(classData.name) || 'N/A'}`, 60, detailsY)
               .text(`Teacher: ${sanitizeForPDF(reportData.teacher_name) || 'N/A'}`, 60, detailsY + 20)
               .text(`Date: ${reportData.date || 'N/A'}`, 60, detailsY + 40);
            
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
               .text('🍊 Vitamin English School', 50, 30, { align: 'center' });
            
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
                           .text(`📅 ${report.date} - ${sanitizeForPDF(report.teacher_name) || 'N/A'}`, 
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

/**
 * Generate a comprehensive Monthly Report PDF for a class
 * @param {Object} reportData - Monthly report data containing:
 *   - classInfo: { id, name, teacherName, schedule }
 *   - period: { year, month, monthName, startDate, endDate }
 *   - students: Array of { id, name, type, email, phone }
 *   - lessonSummary: { totalLessons, lessons, topicsCovered, allVocabulary, commonMistakes, overallStrengths, teacherComments }
 *   - attendanceSummary: { totalDays, records: { [studentId]: { studentName, present, absent, late, total, rate } } }
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateMonthlyReportPDF(reportData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];
            
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            const { classInfo, period, students, lessonSummary, attendanceSummary } = reportData;
            
            // ==================== COVER PAGE ====================
            // Professional header with branding
            doc.rect(0, 0, doc.page.width, 140)
               .fillAndStroke(THEME.colors.primaryBlue, THEME.colors.secondaryBlue);
            
            doc.fontSize(32)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.white)
               .text('🍊 Vitamin English School', 0, 35, { align: 'center', width: doc.page.width });
            
            doc.fontSize(24)
               .fillColor(THEME.colors.accentYellow)
               .text('Monthly Class Report', 0, 80, { align: 'center', width: doc.page.width });
            
            doc.moveDown(5);
            doc.fillColor(THEME.colors.textDark);
            
            // Report Info Box
            const infoBoxY = doc.y;
            doc.rect(50, infoBoxY, doc.page.width - 100, 120)
               .fillAndStroke(THEME.colors.accentYellow, THEME.colors.brightYellow);
            
            doc.fontSize(20)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.textDark)
               .text(sanitizeForPDF(classInfo.name), 0, infoBoxY + 20, { align: 'center', width: doc.page.width });
            
            doc.fontSize(16)
               .font('Helvetica')
               .text(`${period.monthName} ${period.year}`, 0, infoBoxY + 55, { align: 'center', width: doc.page.width });
            
            doc.fontSize(12)
               .fillColor(THEME.colors.textSecondary)
               .text(`Report Period: ${period.startDate} to ${period.endDate}`, 0, infoBoxY + 85, { align: 'center', width: doc.page.width });
            
            doc.moveDown(5);
            
            // Quick Stats Summary
            const statsY = doc.y;
            doc.rect(50, statsY, doc.page.width - 100, 30)
               .fillAndStroke(THEME.colors.lightBlue, THEME.colors.primaryBlue);
            
            doc.fontSize(13)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.textDark)
               .text('Report Overview', 60, statsY + 9);
            
            doc.moveDown(2);
            
            // Stats grid
            const statsGridY = doc.y;
            const statBoxWidth = (doc.page.width - 120) / 4;
            
            const stats = [
                { label: 'Students', value: students.length.toString() },
                { label: 'Lessons', value: lessonSummary.totalLessons.toString() },
                { label: 'Topics', value: lessonSummary.topicsCovered.length.toString() },
                { label: 'Class Days', value: attendanceSummary.totalDays.toString() }
            ];
            
            stats.forEach((stat, index) => {
                const x = 60 + (index * statBoxWidth);
                doc.rect(x, statsGridY, statBoxWidth - 10, 50)
                   .fill('#F8F9FA');
                
                doc.fontSize(22)
                   .font('Helvetica-Bold')
                   .fillColor(THEME.colors.primaryBlue)
                   .text(stat.value, x, statsGridY + 8, { width: statBoxWidth - 10, align: 'center' });
                
                doc.fontSize(10)
                   .font('Helvetica')
                   .fillColor(THEME.colors.textSecondary)
                   .text(stat.label, x, statsGridY + 34, { width: statBoxWidth - 10, align: 'center' });
            });
            
            doc.moveDown(4);
            
            // Class Information
            doc.fontSize(12)
               .font('Helvetica')
               .fillColor(THEME.colors.textDark)
               .text(`Teacher: ${sanitizeForPDF(classInfo.teacherName) || 'N/A'}`, 60, doc.y)
               .text(`Schedule: ${sanitizeForPDF(classInfo.schedule) || 'N/A'}`, 60, doc.y + 20);
            
            // ==================== STUDENT ROSTER PAGE ====================
            doc.addPage();
            
            // Header
            doc.rect(0, 0, doc.page.width, 60)
               .fillAndStroke(THEME.colors.primaryBlue, THEME.colors.secondaryBlue);
            
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.white)
               .text(`${sanitizeForPDF(classInfo.name)} - Student Roster`, 0, 22, { align: 'center', width: doc.page.width });
            
            doc.moveDown(3);
            doc.fillColor(THEME.colors.textDark);
            
            // Attendance Summary Table
            const tableStartY = doc.y;
            const colWidths = { num: 30, name: 180, type: 70, present: 55, absent: 55, late: 50, rate: 60 };
            const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);
            const tableStartX = (doc.page.width - tableWidth) / 2;
            
            // Table header
            doc.rect(tableStartX, tableStartY, tableWidth, 25)
               .fillAndStroke(THEME.colors.lightBlue, THEME.colors.primaryBlue);
            
            let currentX = tableStartX + 5;
            doc.fontSize(9)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.textDark);
            
            doc.text('#', currentX, tableStartY + 8, { width: colWidths.num - 5 });
            currentX += colWidths.num;
            doc.text('Student Name', currentX, tableStartY + 8, { width: colWidths.name - 5 });
            currentX += colWidths.name;
            doc.text('Type', currentX, tableStartY + 8, { width: colWidths.type - 5 });
            currentX += colWidths.type;
            doc.text('Present', currentX, tableStartY + 8, { width: colWidths.present - 5 });
            currentX += colWidths.present;
            doc.text('Absent', currentX, tableStartY + 8, { width: colWidths.absent - 5 });
            currentX += colWidths.absent;
            doc.text('Late', currentX, tableStartY + 8, { width: colWidths.late - 5 });
            currentX += colWidths.late;
            doc.text('Rate', currentX, tableStartY + 8, { width: colWidths.rate - 5 });
            
            let rowY = tableStartY + 25;
            
            // Table rows
            students.forEach((student, index) => {
                // Check for page break
                if (rowY > doc.page.height - 80) {
                    doc.addPage();
                    rowY = 50;
                }
                
                // Alternate row background
                if (index % 2 === 1) {
                    doc.rect(tableStartX, rowY, tableWidth, 20)
                       .fill(THEME.colors.accentYellow);
                }
                
                const attendance = attendanceSummary.records[student.id] || { present: 0, absent: 0, late: 0, rate: 0 };
                
                currentX = tableStartX + 5;
                doc.fontSize(9)
                   .font('Helvetica')
                   .fillColor(THEME.colors.textDark);
                
                doc.text((index + 1).toString(), currentX, rowY + 5, { width: colWidths.num - 5 });
                currentX += colWidths.num;
                
                const displayName = sanitizeForPDF(student.name).length > 25 
                    ? sanitizeForPDF(student.name).substring(0, 25) + '...' 
                    : sanitizeForPDF(student.name);
                doc.text(displayName, currentX, rowY + 5, { width: colWidths.name - 5 });
                currentX += colWidths.name;
                
                doc.text(student.type || 'regular', currentX, rowY + 5, { width: colWidths.type - 5 });
                currentX += colWidths.type;
                
                doc.text(attendance.present.toString(), currentX, rowY + 5, { width: colWidths.present - 5 });
                currentX += colWidths.present;
                
                doc.text(attendance.absent.toString(), currentX, rowY + 5, { width: colWidths.absent - 5 });
                currentX += colWidths.absent;
                
                doc.text(attendance.late.toString(), currentX, rowY + 5, { width: colWidths.late - 5 });
                currentX += colWidths.late;
                
                // Color code attendance rate
                const rateColor = attendance.rate >= 80 ? '#28a745' : attendance.rate >= 60 ? '#ffc107' : '#dc3545';
                doc.fillColor(rateColor)
                   .text(`${attendance.rate}%`, currentX, rowY + 5, { width: colWidths.rate - 5 });
                
                rowY += 20;
            });
            
            // ==================== LESSON SUMMARY PAGE ====================
            doc.addPage();
            
            // Header
            doc.rect(0, 0, doc.page.width, 60)
               .fillAndStroke(THEME.colors.primaryBlue, THEME.colors.secondaryBlue);
            
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .fillColor(THEME.colors.white)
               .text(`${sanitizeForPDF(classInfo.name)} - Lesson Summary`, 0, 22, { align: 'center', width: doc.page.width });
            
            doc.moveDown(3);
            doc.fillColor(THEME.colors.textDark);
            
            // Topics Covered Section
            const addSection = (title, content, icon = '📌') => {
                if (!content || (Array.isArray(content) && content.length === 0)) return;
                
                // Check for page break
                if (doc.y > doc.page.height - 150) {
                    doc.addPage();
                    doc.y = 50;
                }
                
                const sectionY = doc.y;
                doc.rect(40, sectionY, doc.page.width - 80, 25)
                   .fillAndStroke(THEME.colors.lightBlue, THEME.colors.primaryBlue);
                
                doc.fontSize(12)
                   .font('Helvetica-Bold')
                   .fillColor(THEME.colors.textDark)
                   .text(`${icon} ${title}`, 50, sectionY + 7);
                
                doc.moveDown(1.5);
                
                doc.fontSize(10)
                   .font('Helvetica')
                   .fillColor(THEME.colors.textDark);
                
                if (Array.isArray(content)) {
                    content.forEach((item, i) => {
                        if (doc.y > doc.page.height - 50) {
                            doc.addPage();
                            doc.y = 50;
                        }
                        doc.text(`• ${sanitizeForPDF(item)}`, 50, doc.y, { width: doc.page.width - 100 });
                        doc.moveDown(0.3);
                    });
                } else {
                    doc.text(sanitizeForPDF(content), 50, doc.y, { width: doc.page.width - 100 });
                }
                
                doc.moveDown(1);
            };
            
            addSection('Topics Covered This Month', lessonSummary.topicsCovered, '📚');
            addSection('New Vocabulary & Phrases', lessonSummary.allVocabulary, '📝');
            addSection('Common Mistakes to Address', lessonSummary.commonMistakes, '⚠️');
            addSection('Overall Strengths', lessonSummary.overallStrengths, '⭐');
            
            // ==================== INDIVIDUAL LESSONS PAGE ====================
            if (lessonSummary.lessons && lessonSummary.lessons.length > 0) {
                doc.addPage();
                
                // Header
                doc.rect(0, 0, doc.page.width, 60)
                   .fillAndStroke(THEME.colors.primaryBlue, THEME.colors.secondaryBlue);
                
                doc.fontSize(18)
                   .font('Helvetica-Bold')
                   .fillColor(THEME.colors.white)
                   .text(`${sanitizeForPDF(classInfo.name)} - Lesson Details`, 0, 22, { align: 'center', width: doc.page.width });
                
                doc.moveDown(3);
                doc.fillColor(THEME.colors.textDark);
                
                // Individual lesson entries
                lessonSummary.lessons.forEach((lesson, index) => {
                    // Check for page break
                    if (doc.y > doc.page.height - 200) {
                        doc.addPage();
                        doc.y = 50;
                    }
                    
                    // Lesson date header
                    const lessonHeaderY = doc.y;
                    doc.rect(40, lessonHeaderY, doc.page.width - 80, 25)
                       .fill(THEME.colors.accentYellow);
                    
                    doc.fontSize(11)
                       .font('Helvetica-Bold')
                       .fillColor(THEME.colors.textDark)
                       .text(`📅 ${lesson.date} - ${sanitizeForPDF(lesson.teacherName) || 'N/A'}`, 50, lessonHeaderY + 7);
                    
                    doc.moveDown(1.5);
                    
                    // Lesson details
                    const addLessonField = (label, content) => {
                        if (!content) return;
                        
                        doc.fontSize(10)
                           .font('Helvetica-Bold')
                           .fillColor(THEME.colors.primaryBlue)
                           .text(label, 50, doc.y);
                        
                        doc.moveDown(0.2);
                        doc.fontSize(9)
                           .font('Helvetica')
                           .fillColor(THEME.colors.textDark)
                           .text(sanitizeForPDF(content), 50, doc.y, { width: doc.page.width - 100 });
                        
                        doc.moveDown(0.5);
                    };
                    
                    addLessonField('Topic:', lesson.targetTopic);
                    addLessonField('Vocabulary:', lesson.vocabulary);
                    addLessonField('Mistakes:', lesson.mistakes);
                    addLessonField('Strengths:', lesson.strengths);
                    addLessonField('Comments/Homework:', lesson.comments);
                    
                    doc.moveDown(0.5);
                    
                    // Divider between lessons
                    if (index < lessonSummary.lessons.length - 1) {
                        doc.moveTo(50, doc.y)
                           .lineTo(doc.page.width - 50, doc.y)
                           .stroke('#CCCCCC');
                        doc.moveDown(0.5);
                    }
                });
            }
            
            // ==================== TEACHER COMMENTS PAGE ====================
            if (lessonSummary.teacherComments && lessonSummary.teacherComments.length > 0) {
                doc.addPage();
                
                // Header
                doc.rect(0, 0, doc.page.width, 60)
                   .fillAndStroke(THEME.colors.primaryBlue, THEME.colors.secondaryBlue);
                
                doc.fontSize(18)
                   .font('Helvetica-Bold')
                   .fillColor(THEME.colors.white)
                   .text(`${sanitizeForPDF(classInfo.name)} - Teacher Comments & Homework`, 0, 22, { align: 'center', width: doc.page.width });
                
                doc.moveDown(3);
                doc.fillColor(THEME.colors.textDark);
                
                lessonSummary.teacherComments.forEach((comment, index) => {
                    if (doc.y > doc.page.height - 100) {
                        doc.addPage();
                        doc.y = 50;
                    }
                    
                    doc.fontSize(10)
                       .font('Helvetica-Bold')
                       .fillColor(THEME.colors.primaryBlue)
                       .text(`📅 ${comment.date}`, 50, doc.y);
                    
                    doc.moveDown(0.3);
                    doc.fontSize(10)
                       .font('Helvetica')
                       .fillColor(THEME.colors.textDark)
                       .text(sanitizeForPDF(comment.comment), 50, doc.y, { width: doc.page.width - 100 });
                    
                    doc.moveDown(1);
                });
            }
            
            // ==================== FOOTER ON ALL PAGES ====================
            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                
                // Footer line
                doc.moveTo(40, doc.page.height - 50)
                   .lineTo(doc.page.width - 40, doc.page.height - 50)
                   .stroke('#CCCCCC');
                
                doc.fontSize(8)
                   .font('Helvetica')
                   .fillColor('#666666')
                   .text(
                       `${sanitizeForPDF(classInfo.name)} | ${period.monthName} ${period.year} Monthly Report`,
                       40, doc.page.height - 40,
                       { align: 'left', width: 200 }
                   )
                   .text(
                       `Page ${i + 1} of ${pages.count}`,
                       doc.page.width - 140, doc.page.height - 40,
                       { align: 'right', width: 100 }
                   );
            }
            
            // Add generation timestamp on last page
            doc.switchToPage(pages.count - 1);
            doc.fontSize(8)
               .fillColor('#999999')
               .text(
                   `Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
                   0, doc.page.height - 25,
                   { align: 'center', width: doc.page.width }
               );
            
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
    generateMultiClassReportPDF,
    generateMonthlyReportPDF
};
