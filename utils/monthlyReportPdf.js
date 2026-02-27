const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { formatShortDate, formatJapanTime } = require('./dateUtils');

/**
 * Sanitize text for PDF output to prevent PDF injection attacks
 * @param {String} text - Text to sanitize
 * @returns {String} Sanitized text
 */
function sanitizeForPDF(text) {
    if (!text) return '';
    // Remove control characters and special PDF syntax characters
    return text.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
               .replace(/[<>]/g, '');
}

/**
 * Format date for display using Japan timezone (e.g., "Feb. 7")
 * @param {String} dateStr - Date string
 * @returns {String} Formatted date
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    return formatShortDate(dateStr);
}

/**
 * Format month and year for display
 * @param {Number} year - Year
 * @param {Number} month - Month (1-12)
 * @returns {String} Formatted month abbreviation
 */
function formatMonth(year, month) {
    const monthAbbr = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June',
                      'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
    return monthAbbr[month - 1];
}

/**
 * Draw a lesson block with dynamic row heights.
 * Adds a page break before drawing when needed so the block is never split.
 * @param {PDFDocument} doc
 * @param {Object} week
 * @param {Number} currentY
 * @param {Number} margin
 * @param {Number} contentWidth
 * @returns {Number} New Y position after drawing
 */
function drawLessonBlock(doc, week, currentY, margin, contentWidth) {
    const labelColWidth = 120;
    const dataColWidth = contentWidth - labelColWidth;
    const dateHeaderHeight = 30;
    const minRowHeight = 34;
    const rowPaddingY = 12;
    const categories = [
        { label: 'Target (目標)', color: '#E3F2FD', key: 'target' },
        { label: 'Vocabulary (単語)', color: '#F3E5F5', key: 'vocabulary' },
        { label: 'Phrase (文)', color: '#FFF3E0', key: 'phrase' },
        { label: 'Others (その他)', color: '#E8F5E9', key: 'others' }
    ];

    const rowHeights = categories.map((category) => {
        const text = sanitizeForPDF(week[category.key] || '');
        doc.font('NotoJP').fontSize(10);
        const measured = text ? doc.heightOfString(text, { width: dataColWidth - 10 }) : 0;
        return Math.max(measured + rowPaddingY, minRowHeight);
    });

    const blockHeight = dateHeaderHeight + rowHeights.reduce((sum, h) => sum + h, 0);
    const pageHeight = doc.page.height;
    if (currentY + blockHeight > pageHeight - 60) {
        doc.addPage();
        currentY = margin;
    }

    const dateText = formatDate(week.lesson_date);
    doc.rect(margin, currentY, contentWidth, dateHeaderHeight)
       .fillAndStroke('#4A90E2', '#2C5AA0');
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .fillColor('#FFFFFF')
       .text(`📅 ${dateText}`, margin + 10, currentY + 9, { width: contentWidth - 20 });

    let rowY = currentY + dateHeaderHeight;
    categories.forEach((category, index) => {
        const rowHeight = rowHeights[index];
        const value = sanitizeForPDF(week[category.key] || '');

        doc.rect(margin, rowY, labelColWidth, rowHeight)
           .fillAndStroke(category.color, '#D0D7DE');
        doc.rect(margin + labelColWidth, rowY, dataColWidth, rowHeight)
           .fillAndStroke('#FFFFFF', '#D0D7DE');

        doc.font('NotoJP')
           .fontSize(10)
           .fillColor('#111111')
           .text(category.label, margin + 8, rowY + 8, { width: labelColWidth - 16 });

        doc.font('NotoJP')
           .fontSize(10)
           .fillColor('#111111')
           .text(value, margin + labelColWidth + 5, rowY + 6, {
               width: dataColWidth - 10
           });

        rowY += rowHeight;
    });

    return rowY + 12;
}

function findLargestTextChunk(doc, text, width, maxHeight, lineGap) {
    doc.font('NotoJP').fontSize(11);
    if (doc.heightOfString(text, { width, lineGap }) <= maxHeight) {
        return text.length;
    }

    let low = 1;
    let high = text.length;
    let best = 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = text.slice(0, mid);
        const h = doc.heightOfString(candidate, { width, lineGap });
        if (h <= maxHeight) {
            best = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    const breakAt = Math.max(
        text.lastIndexOf('\n', best),
        text.lastIndexOf(' ', best)
    );
    return breakAt > 0 ? breakAt + 1 : best;
}

/**
 * Generate a PDF for monthly report
 * @param {Object} reportData - Monthly report data
 * @param {Array} weeklyData - Array of weekly lesson data
 * @param {Object} classData - Class information
 * @param {Array} teachers - Array of unique teacher names (optional)
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateMonthlyReportPDF(reportData, weeklyData, classData, teachers = []) {
    return new Promise((resolve, reject) => {
        try {
            // Path to Japanese font
            const fontPath = path.join(__dirname, '..', 'fonts', 'NotoSansJP-Regular.ttf');
            
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'portrait',
                margin: 40,
                bufferPages: true,
            });
            const buffers = [];
            
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Register Japanese font
            doc.registerFont('NotoJP', fontPath);
            
            // Constants for layout
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const margin = 40;
            const contentWidth = pageWidth - (margin * 2);
            
            // Sort weeks by date
            const sortedWeeks = [...weeklyData].sort((a, b) => {
                const dateA = new Date(a.lesson_date);
                const dateB = new Date(b.lesson_date);
                return dateA - dateB;
            });
            
            // Log if no weeks data for debugging
            if (sortedWeeks.length === 0) {
                console.warn('⚠️  No weekly data found for PDF generation');
            }
            
            // Calculate period from sorted weeks
            let periodText = '';
            if (reportData.start_date && reportData.end_date) {
                periodText = `Period: ${formatJapanTime(reportData.start_date)} to ${formatJapanTime(reportData.end_date)}`;
            } else if (sortedWeeks.length > 0) {
                const firstDate = sortedWeeks[0].lesson_date;
                const lastDate = sortedWeeks[sortedWeeks.length - 1].lesson_date;
                periodText = `Period: ${formatJapanTime(firstDate)} to ${formatJapanTime(lastDate)}`;
            }
            
            // Header Section
            const headerHeight = 70;
            doc.rect(margin, margin, contentWidth, headerHeight)
               .fillAndStroke('#4A90E2', '#2C5AA0');
            
            // Add logo to header if available
            const logoPath = path.join(__dirname, '..', 'public', 'assets', 'orange-logo.png');
            let logoAdded = false;
            
            // Try PNG logo
            if (fs.existsSync(logoPath)) {
                try {
                    const logoSize = 45;
                    const logoX = margin + 10;
                    const logoY = margin + 12;
                    doc.image(logoPath, logoX, logoY, { 
                        width: logoSize, 
                        height: logoSize 
                    });
                    logoAdded = true;
                } catch (err) {
                    // Logo failed to load - continue without logo
                    console.warn('⚠️  Failed to add logo to PDF:', err.message);
                    console.warn('    PDF will be generated without logo.');
                    console.warn('    Replace placeholder logo with actual Vitamin English logo.');
                }
            }
            
            // Adjust title position if logo was added
            const titleX = logoAdded ? margin + 65 : margin + 12;
            doc.fontSize(20)
               .font('Helvetica-Bold')
               .fillColor('#FFFFFF')
               .text('Monthly Report', titleX, margin + 8);

            let headerTextY = margin + 34;
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#FFFFFF');

            if (periodText) {
                doc.text(periodText, titleX, headerTextY, { width: contentWidth - (titleX - margin) - 10 });
                headerTextY += 14;
            }

            let infoText = sanitizeForPDF(classData.name + (classData.schedule ? ', ' + classData.schedule : ''));
            if (teachers && teachers.length > 0) {
                const teacherNames = teachers.filter(t => t && t.trim()).join(', ');
                if (teacherNames) {
                    infoText += ` | Teachers: ${sanitizeForPDF(teacherNames)}`;
                }
            }
            doc.fontSize(9)
               .fillColor('#FFFFFF')
               .text(infoText, titleX, headerTextY, { width: contentWidth - (titleX - margin) - 10 });

            let currentY = margin + headerHeight + 14;

            if (sortedWeeks.length === 0) {
                if (currentY + 30 > pageHeight - 60) {
                    doc.addPage();
                    currentY = margin;
                }
                doc.font('Helvetica')
                   .fontSize(11)
                   .fillColor('#444444')
                   .text('No lesson data available for this period', margin, currentY, { width: contentWidth });
                currentY += 34;
            } else {
                sortedWeeks.forEach((week) => {
                    currentY = drawLessonBlock(doc, week, currentY, margin, contentWidth);
                });
            }

            // Monthly Theme Section
            if (pageHeight - 60 - currentY < 100) {
                doc.addPage();
                currentY = margin;
            }
            if (currentY + 28 > pageHeight - 60) {
                doc.addPage();
                currentY = margin;
            }

            doc.rect(margin, currentY, contentWidth, 28)
               .fillAndStroke('#4CAF50', '#4CAF50');
            doc.fontSize(13)
               .fillColor('#FFFFFF')
               .font('NotoJP')
               .text('Monthly Theme (今月のテーマ)', margin + 10, currentY + 7);

            let themeY = currentY + 28;
            const themeText = sanitizeForPDF(reportData.monthly_theme) || '';

            if (!themeText) {
                if (themeY + 50 > pageHeight - 60) {
                    doc.addPage();
                    themeY = margin;
                }
                doc.rect(margin, themeY, contentWidth, 50)
                   .fillAndStroke('#F1F8E9', '#4CAF50');
                currentY = themeY + 62;
            } else {
                let remaining = themeText;
                const textWidth = contentWidth - 20;
                const lineGap = 5;

                while (remaining.length > 0) {
                    if (themeY + 24 > pageHeight - 60) {
                        doc.addPage();
                        themeY = margin;
                    }

                    const maxTextHeight = pageHeight - 60 - themeY - 10;
                    const chunkLength = findLargestTextChunk(doc, remaining, textWidth, maxTextHeight, lineGap);
                    const chunk = remaining.slice(0, chunkLength);

                    doc.font('NotoJP').fontSize(11);
                    const chunkHeight = doc.heightOfString(chunk, { width: textWidth, lineGap });
                    const boxHeight = Math.max(chunkHeight + 20, 50);

                    doc.rect(margin, themeY, contentWidth, boxHeight)
                       .fillAndStroke('#F1F8E9', '#4CAF50');

                    doc.fontSize(11)
                       .fillColor('#111111')
                       .font('NotoJP')
                       .text(chunk, margin + 10, themeY + 10, {
                           width: textWidth,
                           lineGap
                       });

                    themeY += boxHeight + 8;
                    remaining = remaining.slice(chunkLength).replace(/^\s+/, '');
                }
                currentY = themeY;
            }

            // Footer on last page only (current page is last after content flow)
            const footerY = doc.page.height - 50;
            doc.rect(margin, footerY - 5, contentWidth, 35)
               .fillAndStroke('#4A90E2', '#2C5AA0');
            doc.fontSize(12)
               .fillColor('#FFFFFF')
               .font('Helvetica-Bold');
            const footerText = 'VitaminEnglishSchool';
            const footerTextWidth = doc.widthOfString(footerText);
            const footerTextX = margin + ((contentWidth - footerTextWidth) / 2);
            doc.text(footerText, footerTextX, footerY + 6, { lineBreak: false });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateMonthlyReportPDF,
    sanitizeForPDF
};
