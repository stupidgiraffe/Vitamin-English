const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

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
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateLessonReportPDF(reportData, classData) {
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
               .text('Lesson Report', { align: 'center' });
            
            doc.moveDown(1);
            
            // Class and Report Information
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('Class Information:', { underline: true });
            
            doc.moveDown(0.5);
            doc.font('Helvetica')
               .text(`Class: ${classData.name || 'N/A'}`, { indent: 20 })
               .text(`Teacher: ${reportData.teacher_name || 'N/A'}`, { indent: 20 })
               .text(`Date: ${reportData.date || 'N/A'}`, { indent: 20 });
            
            doc.moveDown(1);
            
            // Lesson Details
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('Lesson Details:', { underline: true });
            
            doc.moveDown(0.5);
            
            if (reportData.target_topic) {
                doc.font('Helvetica-Bold')
                   .text('Target Topic:', { indent: 20 });
                doc.font('Helvetica')
                   .text(reportData.target_topic, { indent: 40 });
                doc.moveDown(0.5);
            }
            
            if (reportData.vocabulary) {
                doc.font('Helvetica-Bold')
                   .text('New Vocabulary/Phrases:', { indent: 20 });
                doc.font('Helvetica')
                   .text(reportData.vocabulary, { indent: 40 });
                doc.moveDown(0.5);
            }
            
            if (reportData.mistakes) {
                doc.font('Helvetica-Bold')
                   .text('Common Mistakes:', { indent: 20 });
                doc.font('Helvetica')
                   .text(reportData.mistakes, { indent: 40 });
                doc.moveDown(0.5);
            }
            
            if (reportData.strengths) {
                doc.font('Helvetica-Bold')
                   .text('Student Strengths:', { indent: 20 });
                doc.font('Helvetica')
                   .text(reportData.strengths, { indent: 40 });
                doc.moveDown(0.5);
            }
            
            if (reportData.comments) {
                doc.font('Helvetica-Bold')
                   .text('Comments/Homework:', { indent: 20 });
                doc.font('Helvetica')
                   .text(reportData.comments, { indent: 40 });
                doc.moveDown(0.5);
            }
            
            // Footer
            doc.fontSize(10)
               .font('Helvetica')
               .text(`Report ID: ${reportData.id}`, 50, doc.page.height - 70, { align: 'left' })
               .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, doc.page.height - 50, { 
                   align: 'center' 
               });
            
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
    generateLessonReportPDF
};
