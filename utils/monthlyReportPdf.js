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
            const numColumns = sortedWeeks.length + 1; // +1 for category column
            const colWidth = contentWidth / numColumns;
            const rowHeight = 65;
            
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
            
            // Determine font size based on number of columns (fewer columns = larger text)
            let dateHeaderFontSize = 9;
            if (sortedWeeks.length <= 4) {
                dateHeaderFontSize = 11;
            } else if (sortedWeeks.length <= 6) {
                dateHeaderFontSize = 10;
            }
            
            doc.fontSize(dateHeaderFontSize)
               .fillColor('#FFFFFF')
               .font('Helvetica-Bold');
            
            // Empty top-left cell (for category labels column) - draw label for clarity
            let xPos = margin;
            doc.text('Date', xPos + 5, currentY + rowHeight / 2 - 6, { 
                width: colWidth - 10, 
                align: 'center' 
            });
            xPos += colWidth;
            
            // Date headers - aligned with column centers and adaptive formatting
            sortedWeeks.forEach((week) => {
                let dateText = formatDate(week.lesson_date);
                
                // For narrow columns (many dates), use two-line format
                if (sortedWeeks.length > 8) {
                    // Split date into two lines (e.g., "Feb.\n3")
                    const parts = dateText.split(' ');
                    if (parts.length >= 2) {
                        dateText = parts[0] + '\n' + parts[1];
                    }
                }
                
                // Center text in column - calculate exact center position
                const centerX = xPos + (colWidth / 2);
                const textWidth = colWidth - 10;
                const textX = centerX - (textWidth / 2);
                
                doc.text(dateText, textX, currentY + rowHeight / 2 - 6, { 
                    width: textWidth, 
                    align: 'center' 
                });
                xPos += colWidth;
            });
            
            currentY += rowHeight;
            
            // Draw category rows
            categories.forEach((category, catIndex) => {
                const rowY = currentY;
                
                // Draw row background with category-specific colors
                doc.rect(margin, rowY, contentWidth, rowHeight)
                   .fillAndStroke(category.color, '#2C5AA0');
                
                // Category label (bilingual) - use Japanese font for Japanese text
                xPos = margin;
                doc.fontSize(8)
                   .fillColor('#000000')
                   .font('Helvetica-Bold')
                   .text(category.en, xPos + 5, rowY + 10, { 
                       width: colWidth - 10, 
                       align: 'center' 
                   });
                // Use Japanese font for Japanese labels
                doc.font('NotoJP')
                   .fontSize(7)
                   .fillColor('#000000')
                   .text(`(${category.jp})`, xPos + 5, rowY + 25, { 
                       width: colWidth - 10, 
                       align: 'center' 
                   });
                
                xPos += colWidth;
                
                // Data cells for this category - use Japanese font for content
                sortedWeeks.forEach((week) => {
                    let cellText = '';
                    
                    if (catIndex === 0) {
                        // Target
                        cellText = sanitizeForPDF(week.target);
                    } else if (catIndex === 1) {
                        // Vocabulary
                        cellText = sanitizeForPDF(week.vocabulary);
                    } else if (catIndex === 2) {
                        // Phrase
                        cellText = sanitizeForPDF(week.phrase);
                    } else if (catIndex === 3) {
                        // Others
                        cellText = sanitizeForPDF(week.others);
                    }
                    
                    // Calculate max characters per line based on column width
                    // Approximate character width in points (assumes ~5 points per character)
                    const APPROX_CHAR_WIDTH_PX = 5;
                    const charsPerLine = Math.floor(colWidth / APPROX_CHAR_WIDTH_PX);
                    const wrappedText = wrapText(cellText, charsPerLine);
                    const lines = wrappedText.split('\n').slice(0, 4); // Max 4 lines
                    
                    // Use dark text (#000000) for maximum readability
                    // Adjust font size based on column count for better fit
                    let cellFontSize = 8;
                    if (sortedWeeks.length > 8) {
                        cellFontSize = 7;
                    }
                    
                    doc.fontSize(cellFontSize)
                       .fillColor('#000000')
                       .font('NotoJP') // Use Japanese font for all content
                       .text(lines.join('\n'), xPos + 5, rowY + 8, { 
                           width: colWidth - 10,
                           height: rowHeight - 16,
                           align: 'left',
                           ellipsis: true
                       });
                    
                    xPos += colWidth;
                });
                
                currentY += rowHeight;
            });
            
            // Monthly Theme Section
            doc.moveDown(2);
            const themeY = currentY + 20;
            
            // Monthly theme header with green background - use Japanese font
            doc.rect(margin, themeY, contentWidth, 28)
               .fillAndStroke('#4CAF50', '#4CAF50');
            
            doc.fontSize(13)
               .fillColor('#FFFFFF')
               .font('NotoJP') // Use Japanese font for Japanese header
               .text('Monthly Theme (今月のテーマ)', margin + 10, themeY + 8);
            
            // Monthly theme content box with light background
            const themeBoxTop = themeY + 28;
            const themeText = sanitizeForPDF(reportData.monthly_theme) || '';
            
            // Calculate height needed for text
            const textHeight = themeText ? doc.heightOfString(themeText, {
                width: contentWidth - 20,
                lineGap: 5
            }) : 20;
            const boxHeight = Math.max(textHeight + 20, 50);
            
            doc.rect(margin, themeBoxTop, contentWidth, boxHeight)
               .fillAndStroke('#F1F8E9', '#4CAF50');
            
            if (themeText) {
                doc.fontSize(10)
                   .fillColor('#000000')
                   .font('NotoJP') // Use Japanese font for theme text
                   .text(themeText, margin + 10, themeBoxTop + 10, {
                      width: contentWidth - 20,
                      align: 'left',
                      lineGap: 5
                   });
            }
            
            // Footer with colored background and subtle border
            const footerY = pageHeight - 50;
            
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
