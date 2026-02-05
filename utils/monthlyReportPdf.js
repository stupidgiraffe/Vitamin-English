const PDFDocument = require('pdfkit');

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
 * Format date for display
 * @param {String} dateStr - Date string
 * @returns {String} Formatted date
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
    } catch (error) {
        return dateStr;
    }
}

/**
 * Format month and year for display
 * @param {Number} year - Year
 * @param {Number} month - Month (1-12)
 * @returns {String} Formatted month/year
 */
function formatMonthYear(year, month) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[month - 1]} ${year}`;
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
            
            // Constants for layout
            const pageWidth = doc.page.width;
            const margin = 40;
            const contentWidth = pageWidth - (margin * 2);
            
            // Header Section
            doc.fontSize(26)
               .font('Helvetica-Bold')
               .fillColor('#2E7D32')
               .text('Monthly Report', margin, margin, { align: 'center' });
            
            doc.moveDown(0.3);
            
            // Month/Year and Class Info
            doc.fontSize(14)
               .fillColor('#333333')
               .text(formatMonthYear(reportData.year, reportData.month), { align: 'center' });
            
            doc.moveDown(0.3);
            
            doc.fontSize(12)
               .fillColor('#666666')
               .text(sanitizeForPDF(classData.name + (classData.schedule ? ', ' + classData.schedule : '')), { align: 'center' });
            
            doc.moveDown(1.5);
            
            // Weekly Progress Table
            const tableTop = doc.y;
            const colWidth = contentWidth / 6;
            
            // Draw table header with green background
            doc.rect(margin, tableTop, contentWidth, 30)
               .fillAndStroke('#2E7D32', '#2E7D32');
            
            // Table headers
            const headers = [
                'Date (日付)',
                'Target (目標)',
                'Vocabulary (単語)',
                'Phrase (文)',
                'Others (その他)',
            ];
            
            doc.fontSize(10)
               .fillColor('#FFFFFF')
               .font('Helvetica-Bold');
            
            let xPos = margin + 5;
            const headerY = tableTop + 10;
            
            // Week # column (narrower)
            doc.text('Week', xPos, headerY, { width: colWidth * 0.6 - 10, align: 'center' });
            xPos += colWidth * 0.6;
            
            // Other columns
            headers.forEach((header, i) => {
                const width = i === 0 ? colWidth * 0.8 : colWidth;
                doc.text(header, xPos, headerY, { width: width - 10, align: 'center' });
                xPos += width;
            });
            
            // Draw table rows
            let yPos = tableTop + 30;
            doc.font('Helvetica')
               .fillColor('#333333');
            
            // Sort weeks by week_number
            const sortedWeeks = [...weeklyData].sort((a, b) => a.week_number - b.week_number);
            
            sortedWeeks.forEach((week, index) => {
                const rowHeight = 40;
                
                // Alternate row colors
                if (index % 2 === 0) {
                    doc.rect(margin, yPos, contentWidth, rowHeight)
                       .fillAndStroke('#F5F5F5', '#CCCCCC');
                } else {
                    doc.rect(margin, yPos, contentWidth, rowHeight)
                       .stroke('#CCCCCC');
                }
                
                // Reset fill color for text
                doc.fillColor('#333333');
                
                xPos = margin + 5;
                const textY = yPos + 5;
                
                // Week number
                doc.fontSize(9)
                   .text(week.week_number || '', xPos, textY, { 
                       width: colWidth * 0.6 - 10, 
                       align: 'center',
                       height: rowHeight - 10
                   });
                xPos += colWidth * 0.6;
                
                // Date
                doc.fontSize(8)
                   .text(formatDate(week.lesson_date), xPos, textY, { 
                       width: colWidth * 0.8 - 10,
                       height: rowHeight - 10
                   });
                xPos += colWidth * 0.8;
                
                // Target
                doc.text(sanitizeForPDF(week.target) || '', xPos, textY, { 
                    width: colWidth - 10,
                    height: rowHeight - 10
                });
                xPos += colWidth;
                
                // Vocabulary
                doc.text(sanitizeForPDF(week.vocabulary) || '', xPos, textY, { 
                    width: colWidth - 10,
                    height: rowHeight - 10
                });
                xPos += colWidth;
                
                // Phrase
                doc.text(sanitizeForPDF(week.phrase) || '', xPos, textY, { 
                    width: colWidth - 10,
                    height: rowHeight - 10
                });
                xPos += colWidth;
                
                // Others
                doc.text(sanitizeForPDF(week.others) || '', xPos, textY, { 
                    width: colWidth - 10,
                    height: rowHeight - 10
                });
                
                yPos += rowHeight;
            });
            
            // Monthly Theme Section
            doc.moveDown(2);
            yPos = doc.y;
            
            // Monthly theme header with green background
            doc.rect(margin, yPos, contentWidth, 25)
               .fillAndStroke('#2E7D32', '#2E7D32');
            
            doc.fontSize(12)
               .fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .text('Monthly Theme (今月のテーマ)', margin + 10, yPos + 7);
            
            doc.moveDown(0.5);
            
            // Monthly theme content box
            const themeBoxTop = doc.y;
            const themeText = sanitizeForPDF(reportData.monthly_theme) || 'No theme provided.';
            
            // Calculate height needed for text
            const textHeight = doc.heightOfString(themeText, {
                width: contentWidth - 20,
                lineGap: 5
            });
            const boxHeight = Math.max(textHeight + 20, 60);
            
            doc.rect(margin, themeBoxTop, contentWidth, boxHeight)
               .stroke('#CCCCCC');
            
            doc.fontSize(10)
               .fillColor('#333333')
               .font('Helvetica')
               .text(themeText, margin + 10, themeBoxTop + 10, {
                   width: contentWidth - 20,
                   align: 'left',
                   lineGap: 5
               });
            
            // Footer
            const footerY = doc.page.height - 60;
            
            doc.fontSize(10)
               .fillColor('#2E7D32')
               .font('Helvetica-Bold')
               .text('Vitamin English School', margin, footerY, { align: 'center' });
            
            // Green outline box around footer
            doc.rect(margin, footerY - 10, contentWidth, 35)
               .lineWidth(2)
               .stroke('#2E7D32');
            
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
