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
 * Draw a rounded rectangle path.
 * corners: 'all' (default), 'top' (only top corners rounded), 'bottom' (only bottom corners rounded)
 */
function roundedRect(doc, x, y, w, h, r, corners) {
    const tl = (corners === 'all' || corners === 'top' || !corners) ? r : 0;
    const tr = (corners === 'all' || corners === 'top' || !corners) ? r : 0;
    const br = (corners === 'all' || corners === 'bottom' || !corners) ? r : 0;
    const bl = (corners === 'all' || corners === 'bottom' || !corners) ? r : 0;

    doc.moveTo(x + tl, y);
    if (tr > 0) {
        doc.lineTo(x + w - tr, y).quadraticCurveTo(x + w, y, x + w, y + tr);
    } else {
        doc.lineTo(x + w, y);
    }
    if (br > 0) {
        doc.lineTo(x + w, y + h - br).quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    } else {
        doc.lineTo(x + w, y + h);
    }
    if (bl > 0) {
        doc.lineTo(x + bl, y + h).quadraticCurveTo(x, y + h, x, y + h - bl);
    } else {
        doc.lineTo(x, y + h);
    }
    if (tl > 0) {
        doc.lineTo(x, y + tl).quadraticCurveTo(x, y, x + tl, y);
    } else {
        doc.lineTo(x, y);
    }
}

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
function drawLessonBlock(doc, week, currentY, margin, contentWidth, lessonIndex, totalLessons) {
    const labelColWidth = 120;
    const dataColWidth = contentWidth - labelColWidth;
    const dateHeaderHeight = 28;
    const cellPadding = 10;
    const minRowHeight = 28;

    // Date header bar (rounded top corners only)
    roundedRect(doc, margin, currentY, contentWidth, dateHeaderHeight, 6, 'top');
    doc.fillAndStroke('#3B82F6', '#2563EB');
    const dateText = formatFullDate(week.lesson_date);
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor('#FFFFFF')
       .text(dateText, margin + 10, currentY + 7, {
           width: contentWidth - 20,
           lineBreak: false
       });
    // Lesson badge: right-aligned
    if (lessonIndex !== undefined && totalLessons !== undefined) {
        const badgeText = `Lesson ${lessonIndex + 1} / ${totalLessons}`;
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#FFFFFF')
           .text(badgeText, margin + 10, currentY + 9, {
               width: contentWidth - 20,
               align: 'right',
               lineBreak: false
           });
    }
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
            roundedRect(doc, margin, margin, contentWidth, headerHeight, 8);
            doc.fillAndStroke('#3B82F6', '#2563EB');

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

            // ── Month Focus Summary ──
            const focusTargets = sortedWeeks
                .map(w => sanitizeForPDF(w.target))
                .filter(t => t && t.trim());
            if (focusTargets.length > 0) {
                const focusText = `This month's focus: ${focusTargets.join(', ')}`;
                doc.font('NotoJP').fontSize(10).fillColor('#555555')
                   .text(focusText, margin, currentY, { width: contentWidth, align: 'left' });
                currentY = doc.y + 10;
            }

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
                const totalLessons = sortedWeeks.length;
                for (let i = 0; i < sortedWeeks.length; i++) {
                    const week = sortedWeeks[i];
                    const blockHeight = measureLessonBlock(doc, week, 120, contentWidth - 120);

                    // Page break if block won't fit
                    if (currentY + blockHeight > bottomLimit) {
                        doc.addPage();
                        currentY = margin;
                    }

                    currentY = drawLessonBlock(doc, week, currentY, margin, contentWidth, i, totalLessons);

                    // Divider between blocks (not after the last one)
                    if (i < sortedWeeks.length - 1) {
                        currentY += 6;
                        doc.moveTo(margin + 40, currentY)
                           .lineTo(margin + contentWidth - 40, currentY)
                           .lineWidth(0.5)
                           .strokeColor('#E0E0E0')
                           .stroke();
                        // Reset stroke defaults
                        doc.lineWidth(1).strokeColor('#000000');
                        currentY += 6;
                    } else {
                        currentY += 12;
                    }
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

            // Green header bar (rounded top corners only)
            roundedRect(doc, margin, currentY, contentWidth, themeHeaderHeight, 6, 'top');
            doc.fillAndStroke('#22C55E', '#22C55E');
            doc.fontSize(13)
               .fillColor('#FFFFFF')
               .font('NotoJP')
               .text('Monthly Theme (今月のテーマ)', margin + 10, currentY + 7);
            currentY += themeHeaderHeight;

            // Theme content box (rounded bottom corners only)
            roundedRect(doc, margin, currentY, contentWidth, themeBoxHeight, 6, 'bottom');
            doc.fillAndStroke('#F0FDF4', '#22C55E');

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

            // ── Page Numbers (all pages except last) ──
            const pageRange = doc.bufferedPageRange();
            const pageCount = pageRange.count;
            for (let i = 0; i < pageCount - 1; i++) {
                doc.switchToPage(pageRange.start + i);
                doc.font('Helvetica').fontSize(8).fillColor('#AAAAAA')
                   .text(`Page ${i + 1} of ${pageCount}`, margin, pageHeight - 20, {
                       width: contentWidth,
                       align: 'center',
                       lineBreak: false
                   });
            }

            // ── Footer on last page only ──
            const lastPageIndex = pageCount - 1;
            doc.switchToPage(pageRange.start + lastPageIndex);

            const footerY = pageHeight - 50;
            // Thin horizontal line
            doc.moveTo(margin, footerY)
               .lineTo(margin + contentWidth, footerY)
               .lineWidth(1)
               .strokeColor('#3B82F6')
               .stroke();
            // School name
            doc.fontSize(9)
               .font('Helvetica-Bold')
               .fillColor('#666666')
               .text('Vitamin English School', margin, footerY + 6, {
                   width: contentWidth,
                   align: 'center',
                   lineBreak: false
               });
            // Generation date
            const nowJP = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
            const monthAbbr = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June',
                              'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
            const genDateText = `Generated on ${monthAbbr[nowJP.getMonth()]} ${nowJP.getDate()}, ${nowJP.getFullYear()}`;
            doc.fontSize(8)
               .font('Helvetica')
               .fillColor('#999999')
               .text(genDateText, margin, footerY + 18, {
                   width: contentWidth,
                   align: 'center',
                   lineBreak: false
               });

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
