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
 * Wrap text to fit within a width
 * @param {String} text - Text to wrap
 * @param {Number} maxLength - Maximum characters per line
 * @returns {String} Wrapped text with line breaks
 */
function wrapText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (testLine.length <= maxLength) {
            currentLine = testLine;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word.length > maxLength ? word.substring(0, maxLength - 3) + '...' : word;
        }
    }
    if (currentLine) lines.push(currentLine);
    
    return lines.join('\n');
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
                margin: 30,
                bufferPages: true,
                layout: 'landscape'
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
            const margin = 30;
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
            
            // Header Section with colored background
            const headerLeft = margin;
            
            // Add a colored header background with subtle border
            doc.rect(margin, margin - 5, contentWidth, 75)
               .fillAndStroke('#4A90E2', '#2C5AA0');
            
            // Add logo to header if available
            const logoPath = path.join(__dirname, '..', 'public', 'assets', 'orange-logo.png');
            let logoAdded = false;
            
            // Try PNG logo
            if (fs.existsSync(logoPath)) {
                try {
                    const logoSize = 50;
                    const logoX = margin + 10;
                    const logoY = margin;
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
            const titleX = logoAdded ? headerLeft + 70 : headerLeft + 10;
            doc.fontSize(20)
               .font('Helvetica-Bold')
               .fillColor('#FFFFFF')
               .text('Monthly Report', titleX, margin + 8, { align: 'left' });
            
            // Period and Month info
            let currentY = margin + 33;
            doc.fontSize(11)
               .font('Helvetica')
               .fillColor('#FFFFFF');
            
            if (periodText) {
                doc.text(periodText, margin + 10, currentY, { align: 'left' });
                currentY += 15;
            }
            
            // Class info and Teachers on same line
            let infoText = sanitizeForPDF(classData.name + (classData.schedule ? ', ' + classData.schedule : ''));
            if (teachers && teachers.length > 0) {
                const teacherNames = teachers.filter(t => t && t.trim()).join(', ');
                if (teacherNames) {
                    infoText += ` | Teachers: ${sanitizeForPDF(teacherNames)}`;
                }
            }
            
            doc.fontSize(10)
               .fillColor('#FFFFFF')
               .text(infoText, margin + 10, currentY, { align: 'left', width: contentWidth - 20 });
            
            currentY = margin + 80;
            
            // Table Section - Rows as categories, Columns as dates
            const tableTop = currentY + 10;
            const numDates = sortedWeeks.length;

            // Adaptive column widths based on number of dates
            let categoryColWidth, dateColWidth;
            if (numDates <= 3) {
                categoryColWidth = 140;
                dateColWidth = numDates > 0 ? (contentWidth - 140) / numDates : contentWidth - 140;
            } else if (numDates <= 5) {
                categoryColWidth = 120;
                dateColWidth = (contentWidth - 120) / numDates;
            } else {
                // Equal distribution for many dates
                categoryColWidth = contentWidth / (numDates + 1);
                dateColWidth = categoryColWidth;
            }

            // Adaptive font sizes and row height based on number of dates
            let dateHeaderFontSize, cellFontSize, rowHeight, maxLines;
            if (numDates <= 4) {
                dateHeaderFontSize = 11;
                cellFontSize = 10;
                rowHeight = 70;
                maxLines = 4;
            } else if (numDates <= 6) {
                dateHeaderFontSize = 10;
                cellFontSize = 9;
                rowHeight = 65;
                maxLines = 4;
            } else {
                dateHeaderFontSize = 9;
                cellFontSize = 9;
                rowHeight = 60;
                maxLines = 3;
            }

            // Calculate text wrap limit from actual column width
            // 4.5pt is a conservative approximation of character width at typical cell font sizes (8-9pt)
            const APPROX_CHAR_WIDTH_PT = 4.5;
            // Minimum 12 chars per line ensures text remains readable even in very narrow columns
            const MIN_CHARS_PER_LINE = 12;
            const charsPerLine = Math.max(MIN_CHARS_PER_LINE, Math.floor((dateColWidth - 10) / APPROX_CHAR_WIDTH_PT));

            // Category labels (bilingual)
            const categories = [
                { en: 'Target', jp: '目標', color: '#E3F2FD' },
                { en: 'Vocabulary', jp: '単語', color: '#F3E5F5' },
                { en: 'Phrase', jp: '文', color: '#FFF3E0' },
                { en: 'Others', jp: 'その他', color: '#E8F5E9' }
            ];
            
            currentY = tableTop;
            
            // Draw header row (dates) with colored background
            doc.rect(margin, currentY, contentWidth, rowHeight)
               .fillAndStroke('#4A90E2', '#2C5AA0');
            
            doc.fontSize(dateHeaderFontSize)
               .fillColor('#FFFFFF')
               .font('Helvetica-Bold');
            
            // Date headers - use absolute X positions to ensure alignment with data cells below
            sortedWeeks.forEach((week, i) => {
                const dateText = formatDate(week.lesson_date);
                const cellX = margin + categoryColWidth + i * dateColWidth;
                doc.text(dateText, cellX + 5, currentY + rowHeight / 2 - dateHeaderFontSize / 2, { 
                    width: dateColWidth - 10, 
                    align: 'left',
                    lineBreak: false
                });
            });
            
            currentY += rowHeight;
            
            // Draw category rows
            categories.forEach((category, catIndex) => {
                const rowY = currentY;
                
                // Draw row background with category-specific colors
                doc.rect(margin, rowY, contentWidth, rowHeight)
                   .fillAndStroke(category.color, '#2C5AA0');
                
                // Category label (bilingual) - use Japanese font for Japanese text
                doc.fontSize(cellFontSize)
                   .fillColor('#000000')
                   .font('Helvetica-Bold')
                   .text(category.en, margin + 5, rowY + 10, { 
                       width: categoryColWidth - 10, 
                       align: 'center',
                       lineBreak: false
                   });
                doc.font('NotoJP')
                   .fontSize(cellFontSize - 1)
                   .fillColor('#000000')
                   .text(`(${category.jp})`, margin + 5, rowY + 10 + cellFontSize + 4, { 
                       width: categoryColWidth - 10, 
                       align: 'center',
                       lineBreak: false
                   });
                
                // Data cells for this category - use absolute X positions
                sortedWeeks.forEach((week, i) => {
                    let cellText = '';
                    
                    if (catIndex === 0) {
                        cellText = sanitizeForPDF(week.target);
                    } else if (catIndex === 1) {
                        cellText = sanitizeForPDF(week.vocabulary);
                    } else if (catIndex === 2) {
                        cellText = sanitizeForPDF(week.phrase);
                    } else if (catIndex === 3) {
                        cellText = sanitizeForPDF(week.others);
                    }
                    
                    // Wrap and truncate text based on actual column width
                    const wrappedText = wrapText(cellText, charsPerLine);
                    const lines = wrappedText.split('\n').slice(0, maxLines);
                    
                    const cellX = margin + categoryColWidth + i * dateColWidth;
                    doc.fontSize(cellFontSize)
                       .fillColor('#000000')
                       .font('NotoJP')
                       .text(lines.join('\n'), cellX + 5, rowY + 8, { 
                           width: dateColWidth - 10,
                           height: rowHeight - 16,
                           align: 'left',
                           lineBreak: false
                       });
                });
                
                currentY += rowHeight;
            });
            
            // Monthly Theme Section — keep header + content box together as one unit
            const themeText = sanitizeForPDF(reportData.monthly_theme) || '';
            const textHeight = themeText ? doc.heightOfString(themeText, {
                width: contentWidth - 20,
                lineGap: 5
            }) : 20;
            const boxHeight = Math.max(textHeight + 20, 50);
            const totalThemeHeight = 28 + boxHeight; // header (28pt) + content box

            // Check if the entire section fits in the remaining space on this page
            const remainingSpace = pageHeight - (currentY + 12) - margin;
            let themeY;
            if (totalThemeHeight <= remainingSpace) {
                themeY = currentY + 12;
            } else {
                doc.addPage();
                themeY = margin;
            }

            // Draw green header
            doc.rect(margin, themeY, contentWidth, 28)
               .fillAndStroke('#4CAF50', '#4CAF50');
            doc.fontSize(13)
               .fillColor('#FFFFFF')
               .font('NotoJP')
               .text('Monthly Theme (今月のテーマ)', margin + 10, themeY + 8);

            // Draw light-green content box
            const themeBoxTop = themeY + 28;
            doc.rect(margin, themeBoxTop, contentWidth, boxHeight)
               .fillAndStroke('#F1F8E9', '#4CAF50');

            if (themeText) {
                doc.fontSize(11)
                   .fillColor('#111111')
                   .font('NotoJP')
                   .text(themeText, margin + 10, themeBoxTop + 10, {
                       width: contentWidth - 20,
                       align: 'left',
                       lineGap: 5
                   });
            }

            // Footer at the bottom of the last page
            const footerY = doc.page.height - 50;

            // Colored footer background with border matching header
            doc.rect(margin, footerY - 5, contentWidth, 35)
               .fillAndStroke('#4A90E2', '#2C5AA0');
            
            doc.fontSize(14)
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
