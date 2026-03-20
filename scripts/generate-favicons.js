/**
 * Generate orange circle favicon PNG files for Vitamin English School.
 * Produces: favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png (180x180),
 *           orange-logo.png (200x200), and favicon.ico (32x32 PNG-in-ICO).
 *
 * No external dependencies — uses only Node.js built-ins (zlib, fs).
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');

// ── Colours ───────────────────────────────────────────────────────────────────
const ORANGE      = [0xFF, 0x8C, 0x42, 0xFF]; // #FF8C42
const ORANGE_DARK = [0xE0, 0x6A, 0x10, 0xFF]; // #E06A10 (shading)
const ORANGE_LITE = [0xFF, 0xAA, 0x66, 0xFF]; // highlight
const GREEN_STEM  = [0x4A, 0x9E, 0x30, 0xFF]; // leaf/stem green
const GREEN_LEAF  = [0x5C, 0xB8, 0x3A, 0xFF]; // lighter leaf

// ── PNG building helpers ──────────────────────────────────────────────────────

function adler32(buf) {
    let a = 1, b = 0;
    for (let i = 0; i < buf.length; i++) {
        a = (a + buf[i]) % 65521;
        b = (b + a)      % 65521;
    }
    return (b << 16) | a;
}

function crc32(buf) {
    const table = crc32.table || (crc32.table = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c;
        }
        return t;
    })());
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len  = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf));
    return Buffer.concat([len, typeBytes, data, crcVal]);
}

function buildPNG(width, height, rgba) {
    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width,  0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8]  = 8;  // bit depth
    ihdr[9]  = 6;  // colour type: RGBA
    ihdr[10] = 0;  ihdr[11] = 0;  ihdr[12] = 0;

    // Raw scanlines (filter byte 0 = None before each row)
    const raw = Buffer.alloc((1 + width * 4) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (1 + width * 4)] = 0; // filter
        for (let x = 0; x < width; x++) {
            const src  = (y * width + x) * 4;
            const dest = y * (1 + width * 4) + 1 + x * 4;
            raw[dest]   = rgba[src];
            raw[dest+1] = rgba[src+1];
            raw[dest+2] = rgba[src+2];
            raw[dest+3] = rgba[src+3];
        }
    }

    const compressed = zlib.deflateSync(raw, { level: 9 });
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function newCanvas(w, h) {
    // RGBA flat array, initialised to fully transparent
    return new Uint8Array(w * h * 4);
}

function setPixel(buf, w, x, y, [r, g, b, a]) {
    if (x < 0 || y < 0 || x >= w) return;
    const i = (y * w + x) * 4;
    buf[i]   = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
}

/** Blend src colour on top of existing pixel (alpha-compositing). */
function blendPixel(buf, w, x, y, [r, g, b, a]) {
    if (x < 0 || y < 0 || x >= w) return;
    const i  = (y * w + x) * 4;
    const sa = a / 255;
    const da = buf[i+3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa < 0.001) { buf[i] = buf[i+1] = buf[i+2] = buf[i+3] = 0; return; }
    buf[i]   = Math.round((r * sa + buf[i]   * da * (1 - sa)) / oa);
    buf[i+1] = Math.round((g * sa + buf[i+1] * da * (1 - sa)) / oa);
    buf[i+2] = Math.round((b * sa + buf[i+2] * da * (1 - sa)) / oa);
    buf[i+3] = Math.round(oa * 255);
}

/** Anti-aliased disc using super-sampling. */
function fillCircle(buf, w, cx, cy, r, color) {
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
    const h   = buf.length / (w * 4);
    const y0  = Math.max(0, Math.floor(cy - r - 1));
    const y1  = Math.min(h - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            // 4×4 sub-pixel sampling
            let inside = 0;
            for (let sy = 0; sy < 4; sy++) {
                for (let sx = 0; sx < 4; sx++) {
                    const px = x + (sx + 0.5) / 4 - cx;
                    const py = y + (sy + 0.5) / 4 - cy;
                    if (px * px + py * py <= r * r) inside++;
                }
            }
            if (inside > 0) {
                const alpha = Math.round(color[3] * inside / 16);
                blendPixel(buf, w, x, y, [color[0], color[1], color[2], alpha]);
            }
        }
    }
}

/** Anti-aliased ellipse. */
function fillEllipse(buf, w, cx, cy, rx, ry, color) {
    const h   = buf.length / (w * 4);
    const x0  = Math.max(0, Math.floor(cx - rx - 1));
    const x1  = Math.min(w - 1, Math.ceil(cx + rx + 1));
    const y0  = Math.max(0, Math.floor(cy - ry - 1));
    const y1  = Math.min(h - 1, Math.ceil(cy + ry + 1));
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            let inside = 0;
            for (let sy = 0; sy < 4; sy++) {
                for (let sx = 0; sx < 4; sx++) {
                    const px = (x + (sx + 0.5) / 4 - cx) / rx;
                    const py = (y + (sy + 0.5) / 4 - cy) / ry;
                    if (px * px + py * py <= 1) inside++;
                }
            }
            if (inside > 0) {
                const alpha = Math.round(color[3] * inside / 16);
                blendPixel(buf, w, x, y, [color[0], color[1], color[2], alpha]);
            }
        }
    }
}

/** Vertical line segment. */
function vline(buf, w, x, y0, y1, color) {
    for (let y = y0; y <= y1; y++) blendPixel(buf, w, x, y, color);
}

// ── Orange icon layout constants ──────────────────────────────────────────────
// All values are fractions of the icon side length for easy scaling.
const FRUIT_CENTER_Y    = 0.53;   // vertical centre of orange (slightly below mid to fit stem)
const FRUIT_RADIUS      = 0.44;   // radius of the main orange circle
const SHADE_OFFSET      = 0.22;   // offset for shading circle centre
const SHADE_RADIUS      = 0.70;   // shading circle radius (fraction of FRUIT_RADIUS)
const BODY_OFFSET       = 0.05;   // offset for re-drawn body circle
const BODY_RADIUS       = 0.88;   // body circle radius (fraction of FRUIT_RADIUS)
const HIGHLIGHT_OFFSET  = 0.28;   // offset for specular highlight centre
const HIGHLIGHT_RADIUS  = 0.32;   // highlight radius (fraction of FRUIT_RADIUS)
const HIGHLIGHT_COLOR   = [255, 200, 140, 180]; // warm white-orange highlight
const STEM_WIDTH_RATIO  = 0.045;  // stem width as fraction of size
const STEM_HEIGHT_MULTI = 2.5;    // stem height = stemWidth × this
const STEM_OVERLAP      = 2;      // px the stem overlaps into the fruit body
const LEAF_X_OFFSET     = 0.10;   // leaf centre X offset from fruit centre
const LEAF_Y_OFFSET     = 0.01;   // leaf centre Y offset above fruit top edge
const LEAF_WIDTH        = 0.12;   // leaf ellipse horizontal radius
const LEAF_HEIGHT       = 0.06;   // leaf ellipse vertical radius

// ── Orange icon renderer ──────────────────────────────────────────────────────
/**
 * Draw a stylised orange fruit into a square RGBA buffer of side `size`.
 * Sizes 16/32: simple circle.  Sizes ≥ 64: add highlight, shading, stem, leaf.
 */
function drawOrange(size) {
    const buf  = newCanvas(size, size);
    const cx   = size / 2;
    const cy   = size * FRUIT_CENTER_Y;
    const R    = size * FRUIT_RADIUS;

    // Main orange body
    fillCircle(buf, size, cx, cy, R, ORANGE);

    if (size >= 32) {
        // Darker shading on lower-right
        fillCircle(buf, size, cx + R * SHADE_OFFSET, cy + R * SHADE_OFFSET, R * SHADE_RADIUS, ORANGE_DARK);
        // Re-draw main orange slightly smaller to give shading an edge
        fillCircle(buf, size, cx - R * BODY_OFFSET, cy - R * BODY_OFFSET, R * BODY_RADIUS, ORANGE);
        // Bright highlight (upper-left)
        fillCircle(buf, size, cx - R * HIGHLIGHT_OFFSET, cy - R * HIGHLIGHT_OFFSET, R * HIGHLIGHT_RADIUS, HIGHLIGHT_COLOR);
    }

    if (size >= 64) {
        // Stem — thin vertical rectangle above the fruit
        const stemW  = Math.max(2, Math.round(size * STEM_WIDTH_RATIO));
        const stemX0 = Math.round(cx - stemW / 2);
        const stemY0 = Math.round(cy - R - stemW * STEM_HEIGHT_MULTI);
        const stemY1 = Math.round(cy - R + STEM_OVERLAP);
        for (let sy = stemY0; sy <= stemY1; sy++) {
            for (let sx = stemX0; sx < stemX0 + stemW; sx++) {
                blendPixel(buf, size, sx, sy, GREEN_STEM);
            }
        }

        // Leaf — small ellipse to the right of the stem
        const leafCx = cx + size * LEAF_X_OFFSET;
        const leafCy = cy - R - size * LEAF_Y_OFFSET;
        fillEllipse(buf, size, leafCx, leafCy, size * LEAF_WIDTH, size * LEAF_HEIGHT, GREEN_LEAF);
    }

    return buf;
}

// ── ICO builder (single 32×32 image) ─────────────────────────────────────────
/**
 * Wrap a raw PNG buffer in a minimal .ico container.
 * Most browsers accept PNG-in-ICO natively.
 */
function buildIco(pngBuf, w, h) {
    const headerSize = 6 + 16; // ICONDIR + one ICONDIRENTRY
    const header = Buffer.alloc(headerSize);
    // ICONDIR
    header.writeUInt16LE(0,  0); // reserved
    header.writeUInt16LE(1,  2); // type = 1 (icon)
    header.writeUInt16LE(1,  4); // count = 1
    // ICONDIRENTRY
    header[6]  = w > 255 ? 0 : w;
    header[7]  = h > 255 ? 0 : h;
    header[8]  = 0;   // colour count (0 = not palette)
    header[9]  = 0;   // reserved
    header.writeUInt16LE(1,  10); // planes
    header.writeUInt16LE(32, 12); // bit count
    header.writeUInt32LE(pngBuf.length, 14); // bytes in image
    header.writeUInt32LE(headerSize,    18); // offset to image data
    return Buffer.concat([header, pngBuf]);
}

// ── Generate & save ───────────────────────────────────────────────────────────

const sizes = [
    { name: 'favicon-16x16.png',   size: 16  },
    { name: 'favicon-32x32.png',   size: 32  },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'orange-logo.png',      size: 200 },
];

sizes.forEach(({ name, size }) => {
    const rgba = drawOrange(size);
    const png  = buildPNG(size, size, rgba);
    fs.writeFileSync(path.join(ASSETS_DIR, name), png);
    console.log(`✓ ${name} (${size}×${size}, ${png.length} bytes)`);
});

// favicon.ico — 32×32 PNG-in-ICO
const ico32rgba = drawOrange(32);
const ico32png  = buildPNG(32, 32, ico32rgba);
const ico       = buildIco(ico32png, 32, 32);
fs.writeFileSync(path.join(ASSETS_DIR, 'favicon.ico'), ico);
console.log(`✓ favicon.ico (32×32 PNG-in-ICO, ${ico.length} bytes)`);

console.log('\nAll favicon files generated successfully.');
