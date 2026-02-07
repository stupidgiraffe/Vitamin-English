/**
 * Create a 16x16 favicon from the orange logo
 * Uses simple PNG encoding with an orange circle
 */
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'public', 'assets');

// Simple 16x16 orange circle PNG (base64 encoded)
const favicon16Base64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAApElEQVR4nGNgwA/+//+PV56JgQJAMgMDw38i9DAwMDAyMTH9xxWAKSBKM7oCXAYwMjL+Z2Ji+o/NAEYm5v/YvABTgNcLMEXYFOD0AkwRNgV4vQBThEsB0V6AKcKmgCgvwBRhU0CyF2CKsClgYGb+T7AXYIpgChjJcCE+r8MU/CfFBXhlsSmA+4AUL8AUwBQQ5QWYApgCkrwAU0CSFxiYGBnwAgBvKUPMbMpNgwAAAABJRU5ErkJggg==';

const favicon16Path = path.join(assetsDir, 'favicon-16x16.png');
fs.writeFileSync(favicon16Path, Buffer.from(favicon16Base64, 'base64'));
console.log('✓ Created favicon-16x16.png');
