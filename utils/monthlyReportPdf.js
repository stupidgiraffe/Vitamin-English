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
 * Format a full date for display (e.g., "Feb. 7, 2026")
 * @param {String} dateStr - Date string
 * @returns {String} Formatted date with year
 */
function formatFullDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const jpDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        const monthAbbr = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June',
                          'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
        return `${monthAbbr[jpDate.getMonth()]} ${jpDate.getDate()}, ${jpDate.getFullYear()}`;
    } catch {
        return '';
    }
}

// A4 portrait dimensions in points
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Minimum space remaining on page before starting theme section on a new page
const MIN_REMAINING_FOR_THEME = 100;

// Category definitions (bilingual)
const CATEGORIES = [
    { en: 'Target', jp: '目標', color: '#E3F2FD', field: 'target' },
    { en: 'Vocabulary', jp: '単語', color: '#F3E5F5', field: 'vocabulary' },
    { en: 'Phrase', jp: '文', color: '#FFF3E0', field: 'phrase' },
    { en: 'Others', jp: 'その他', color: '#E8F5E9', field: 'others' }
];

/**
 * Measure the height of a single lesson block (date header + 4 category rows)
 */
function measureLessonBlock(doc, week, labelColWidth, dataColWidth) {
    const dateHeaderHeight = 28;
    const cellPadding = 10;
    const minRowHeight = 28;
    let totalHeight = dateHeaderHeight;

    for (const cat of CATEGORIES) {
        const cellText = sanitizeForPDF(week[cat.field]) || '';
        // Measure label height
        doc.font('NotoJP').fontSize(9);
        const labelText = `${cat.en}\n(${cat.jp})`;
        const labelHeight = doc.heightOfString(labelText, { width: labelColWidth - 10 });
        // Measure data height
        doc.font('NotoJP').fontSize(10);
        const dataHeight = cellText
            ? doc.heightOfString(cellText, { width: dataColWidth - 10 })
            : 0;
        const rowHeight = Math.max(Math.max(labelHeight, dataHeight) + cellPadding, minRowHeight);
        totalHeight += rowHeight;
    }
    return totalHeight;
}

/**
 * Draw a single lesson block and return the new Y position
 */
function drawLessonBlock(doc, week, currentY, margin, contentWidth) {
    const labelColWidth = 120;
    const dataColWidth = contentWidth - labelColWidth;
    const dateHeaderHeight = 28;
    const cellPadding = 10;
    const minRowHeight = 28;

    // Date header bar
    doc.rect(margin, currentY, contentWidth, dateHeaderHeight)
       .fillAndStroke('#4A90E2', '#2C5AA0');
    const dateText = formatFullDate(week.lesson_date);
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor('#FFFFFF')
       .text(`📅 ${dateText}`, margin + 10, currentY + 7, {
           width: contentWidth - 20,
           lineBreak: false
       });
    currentY += dateHeaderHeight;

    // Category rows
    for (const cat of CATEGORIES) {
        const cellText = sanitizeForPDF(week[cat.field]) || '';
        // Measure heights
        doc.font('NotoJP').fontSize(9);
        const labelText = `${cat.en}\n(${cat.jp})`;
        const labelHeight = doc.heightOfString(labelText, { width: labelColWidth - 10 });
        doc.font('NotoJP').fontSize(10);
        const dataHeight = cellText
            ? doc.heightOfString(cellText, { width: dataColWidth - 10 })
            : 0;
        const rowHeight = Math.max(Math.max(labelHeight, dataHeight) + cellPadding, minRowHeight);

        // Label cell background
        doc.rect(margin, currentY, labelColWidth, rowHeight)
           .fillAndStroke(cat.color, '#CCCCCC');
        // Data cell background
        doc.rect(margin + labelColWidth, currentY, dataColWidth, rowHeight)
           .fillAndStroke('#FFFFFF', '#CCCCCC');

        // Label text
        const labelY = currentY + (rowHeight - labelHeight) / 2;
        doc.fontSize(9)
           .font('NotoJP')
           .fillColor('#333333')
           .text(labelText, margin + 5, labelY, {
               width: labelColWidth - 10,
               align: 'center'
           });

        // Data text
        if (cellText) {
            doc.fontSize(10)
               .font('NotoJP')
               .fillColor('#000000')
               .text(cellText, margin + labelColWidth + 5, currentY + 5, {
                   width: dataColWidth - 10,
                   align: 'left'
               });
        }

        currentY += rowHeight;
    }

    return currentY;
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
                margin: 40,
                bufferPages: true
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
            const pageWidth = A4_WIDTH;
            const pageHeight = A4_HEIGHT;
            const margin = 40;
            const contentWidth = pageWidth - (margin * 2);
            const bottomLimit = pageHeight - 60;

            // Sort weeks by date
            const sortedWeeks = [...weeklyData].sort((a, b) => {
                const dateA = new Date(a.lesson_date);
                const dateB = new Date(b.lesson_date);
                return dateA - dateB;
            });

            // Calculate period text
            let periodText = '';
            if (reportData.start_date && reportData.end_date) {
                periodText = `Period: ${formatFullDate(reportData.start_date)} to ${formatFullDate(reportData.end_date)}`;
            } else if (sortedWeeks.length > 0) {
                const firstDate = sortedWeeks[0].lesson_date;
                const lastDate = sortedWeeks[sortedWeeks.length - 1].lesson_date;
                periodText = `Period: ${formatFullDate(firstDate)} to ${formatFullDate(lastDate)}`;
            }

            // ── Page 1: Header ──
            const headerHeight = 70;
            doc.rect(margin, margin, contentWidth, headerHeight)
               .fillAndStroke('#4A90E2', '#2C5AA0');

            // Logo
            const logoPath = path.join(__dirname, '..', 'public', 'assets', 'orange-logo.png');
            let logoAdded = false;
            if (fs.existsSync(logoPath)) {
                try {
                    doc.image(logoPath, margin + 10, margin + 12, { width: 45, height: 45 });
                    logoAdded = true;
                } catch (err) {
                    console.warn('⚠️  Failed to add logo to PDF:', err.message);
                }
            }

            const titleX = logoAdded ? margin + 65 : margin + 10;
            doc.fontSize(20)
               .font('Helvetica-Bold')
               .fillColor('#FFFFFF')
               .text('Monthly Report', titleX, margin + 10, { lineBreak: false });

            if (periodText) {
                doc.fontSize(10)
                   .font('Helvetica')
                   .fillColor('#FFFFFF')
                   .text(periodText, titleX, margin + 32, { lineBreak: false });
            }

            // Class info line
            let infoText = sanitizeForPDF(classData.name + (classData.schedule ? ', ' + classData.schedule : ''));
            if (teachers && teachers.length > 0) {
                const teacherNames = teachers.filter(t => t && t.trim()).join(', ');
                if (teacherNames) {
                    infoText += ` | Teachers: ${sanitizeForPDF(teacherNames)}`;
                }
            }
            doc.fontSize(9)
               .font('Helvetica')
               .fillColor('#FFFFFF')
               .text(infoText, titleX, margin + 46, { width: contentWidth - (titleX - margin) - 10, lineBreak: false });

            let currentY = margin + headerHeight + 15;

            // ── Lesson Blocks ──
            if (sortedWeeks.length === 0) {
                // No lessons message
                doc.fontSize(12)
                   .font('NotoJP')
                   .fillColor('#666666')
                   .text('No lesson data available for this period', margin, currentY, {
                       width: contentWidth,
                       align: 'center'
                   });
                currentY += 40;
            } else {
                for (const week of sortedWeeks) {
                    const blockHeight = measureLessonBlock(doc, week, 120, contentWidth - 120);

                    // Page break if block won't fit
                    if (currentY + blockHeight > bottomLimit) {
                        doc.addPage();
                        currentY = margin;
                    }

                    currentY = drawLessonBlock(doc, week, currentY, margin, contentWidth);
                    currentY += 12; // spacing between blocks
                }
            }

            // ── Monthly Theme Section ──
            const themeText = sanitizeForPDF(reportData.monthly_theme) || '';
            const themeHeaderHeight = 28;
            doc.font('NotoJP').fontSize(11);
            const themeTextHeight = themeText
                ? doc.heightOfString(themeText, { width: contentWidth - 20, lineGap: 5 })
                : 20;
            const themeBoxHeight = Math.max(themeTextHeight + 20, 50);
            const totalThemeHeight = themeHeaderHeight + themeBoxHeight;

            // If less than MIN_REMAINING_FOR_THEME remaining or theme won't fit, start new page
            if (currentY + totalThemeHeight > bottomLimit || pageHeight - currentY < MIN_REMAINING_FOR_THEME) {
                doc.addPage();
                currentY = margin;
            }

            // Green header bar
            doc.rect(margin, currentY, contentWidth, themeHeaderHeight)
               .fillAndStroke('#4CAF50', '#4CAF50');
            doc.fontSize(13)
               .fillColor('#FFFFFF')
               .font('NotoJP')
               .text('Monthly Theme (今月のテーマ)', margin + 10, currentY + 7);
            currentY += themeHeaderHeight;

            // Theme content box
            doc.rect(margin, currentY, contentWidth, themeBoxHeight)
               .fillAndStroke('#F1F8E9', '#4CAF50');

            if (themeText) {
                doc.fontSize(11)
                   .fillColor('#111111')
                   .font('NotoJP')
                   .text(themeText, margin + 10, currentY + 10, {
                       width: contentWidth - 20,
                       align: 'left',
                       lineGap: 5
                   });
            }

            // ── Footer on last page only ──
            const pageCount = doc.bufferedPageRange().count;
            const lastPageIndex = pageCount - 1;
            doc.switchToPage(lastPageIndex);

            const footerY = pageHeight - 50;
            doc.rect(margin, footerY - 5, contentWidth, 35)
               .fillAndStroke('#4A90E2', '#2C5AA0');
            doc.fontSize(12)
               .fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .text('VitaminEnglishSchool', margin, footerY + 5, { align: 'center', width: contentWidth });

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
