const PDFDocument = require('pdfkit');
const path = require('path');
const { formatShortDate } = require('./dateUtils');

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
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateMonthlyReportPDF(reportData, weeklyData, classData) {
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
            
            // Header Section
            const headerLeft = margin;
            const headerRight = pageWidth - margin;
            
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .fillColor('#333333')
               .text('Monthly Report', headerLeft, margin, { align: 'left', width: contentWidth / 2 });
            
            doc.fontSize(12)
               .font('Helvetica')
               .text(`Month: ${formatMonth(reportData.year, reportData.month)}.`, 
                     pageWidth / 2, margin, 
                     { align: 'right', width: contentWidth / 2 });
            
            // Class info centered below
            doc.fontSize(10)
               .fillColor('#666666')
               .text(sanitizeForPDF(classData.name + (classData.schedule ? ', ' + classData.schedule : '')), 
                     margin, margin + 25, 
                     { align: 'center', width: contentWidth });
            
            doc.moveDown(1);
            
            // Table Section - Rows as categories, Columns as dates
            const tableTop = doc.y + 10;
            const numColumns = sortedWeeks.length + 1; // +1 for category column
            const colWidth = contentWidth / numColumns;
            const rowHeight = 60;
            
            // Category labels (bilingual) - use Japanese font
            const categories = [
                { en: 'Date', jp: '日付' },
                { en: 'Target', jp: '目標' },
                { en: 'Vocabulary', jp: '単語' },
                { en: 'Phrase', jp: '文' },
                { en: 'Others', jp: 'その他' }
            ];
            
            let currentY = tableTop;
            
            // Draw header row (dates)
            doc.rect(margin, currentY, contentWidth, rowHeight)
               .fillAndStroke('#FFFFFF', '#333333');
            
            doc.fontSize(8)
               .fillColor('#333333')
               .font('Helvetica-Bold');
            
            // Empty top-left cell
            let xPos = margin + 2;
            doc.text('', xPos, currentY + 5, { width: colWidth - 4, align: 'center' });
            xPos += colWidth;
            
            // Date headers
            sortedWeeks.forEach((week) => {
                const dateText = formatDate(week.lesson_date);
                doc.text(dateText, xPos, currentY + rowHeight / 2 - 5, { 
                    width: colWidth - 4, 
                    align: 'center' 
                });
                xPos += colWidth;
            });
            
            currentY += rowHeight;
            
            // Draw category rows
            categories.forEach((category, catIndex) => {
                const rowY = currentY;
                
                // Draw row background
                if (catIndex % 2 === 0) {
                    doc.rect(margin, rowY, contentWidth, rowHeight)
                       .fillAndStroke('#F5F5F5', '#333333');
                } else {
                    doc.rect(margin, rowY, contentWidth, rowHeight)
                       .stroke('#333333');
                }
                
                doc.fillColor('#333333');
                
                // Category label (bilingual) - use Japanese font for Japanese text
                xPos = margin + 2;
                doc.fontSize(7)
                   .font('Helvetica-Bold')
                   .text(category.en, xPos, rowY + 5, { 
                       width: colWidth - 4, 
                       align: 'center' 
                   });
                // Use Japanese font for Japanese labels
                doc.font('NotoJP')
                   .text(`(${category.jp})`, xPos, rowY + 18, { 
                       width: colWidth - 4, 
                       align: 'center' 
                   });
                
                xPos += colWidth;
                
                // Data cells for this category - use Japanese font for content
                sortedWeeks.forEach((week) => {
                    let cellText = '';
                    
                    if (catIndex === 0) {
                        // Date row - show formatted date
                        cellText = '';
                    } else if (catIndex === 1) {
                        // Target
                        cellText = sanitizeForPDF(week.target);
                    } else if (catIndex === 2) {
                        // Vocabulary
                        cellText = sanitizeForPDF(week.vocabulary);
                    } else if (catIndex === 3) {
                        // Phrase
                        cellText = sanitizeForPDF(week.phrase);
                    } else if (catIndex === 4) {
                        // Others
                        cellText = sanitizeForPDF(week.others);
                    }
                    
                    // Wrap and truncate text
                    const wrappedText = wrapText(cellText, 20);
                    const lines = wrappedText.split('\n').slice(0, 3); // Max 3 lines
                    
                    doc.fontSize(6)
                       .font('NotoJP') // Use Japanese font for all content
                       .text(lines.join('\n'), xPos, rowY + 5, { 
                           width: colWidth - 4,
                           height: rowHeight - 10,
                           align: 'left'
                       });
                    
                    xPos += colWidth;
                });
                
                currentY += rowHeight;
            });
            
            // Monthly Theme Section
            doc.moveDown(2);
            const themeY = currentY + 20;
            
            // Monthly theme header with green background - use Japanese font
            doc.rect(margin, themeY, contentWidth, 25)
               .fillAndStroke('#2E7D32', '#2E7D32');
            
            doc.fontSize(12)
               .fillColor('#FFFFFF')
               .font('NotoJP') // Use Japanese font for Japanese header
               .text('Monthly Theme (今月のテーマ)', margin + 10, themeY + 7);
            
            // Monthly theme content box
            const themeBoxTop = themeY + 25;
            const themeText = sanitizeForPDF(reportData.monthly_theme) || '';
            
            // Calculate height needed for text
            const textHeight = themeText ? doc.heightOfString(themeText, {
                width: contentWidth - 20,
                lineGap: 5
            }) : 20;
            const boxHeight = Math.max(textHeight + 20, 50);
            
            doc.rect(margin, themeBoxTop, contentWidth, boxHeight)
               .stroke('#333333');
            
            if (themeText) {
                doc.fontSize(9)
                   .fillColor('#333333')
                   .font('NotoJP') // Use Japanese font for theme text
                   .text(themeText, margin + 10, themeBoxTop + 10, {
                      width: contentWidth - 20,
                      align: 'left',
                      lineGap: 5
                   });
            }
            
            // Footer
            const footerY = pageHeight - 50;
            
            // Green outline box around footer
            doc.rect(margin, footerY - 5, contentWidth, 30)
               .lineWidth(2)
               .stroke('#2E7D32');
            
            doc.fontSize(12)
               .fillColor('#2E7D32')
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
