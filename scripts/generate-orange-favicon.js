#!/usr/bin/env node
/**
 * generate-orange-favicon.js
 * Generates orange-fruit-themed favicon PNG files using pure Node.js (no canvas/sharp).
 * Writes: public/assets/favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png
 *
 * Usage: node scripts/generate-orange-favicon.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimal PNG encoder (pure JS, no dependencies)
// ---------------------------------------------------------------------------

function crc32(buf) {
    const table = crc32.table || (crc32.table = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            t[i] = c;
        }
        return t;
    })());
    let c = 0xFFFFFFFF;
    for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function adler32(data) {
    let s1 = 1, s2 = 0;
    for (const b of data) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521; }
    return (s2 << 16) | s1;
}

function deflateUncompressed(data) {
    const chunks = [];
    const BSIZE  = 65535;
    for (let i = 0; i < data.length; i += BSIZE) {
        const chunk = data.slice(i, i + BSIZE);
        const last  = i + BSIZE >= data.length ? 1 : 0;
        chunks.push(new Uint8Array([last, chunk.length & 0xFF, (chunk.length >> 8) & 0xFF,
                                    (~chunk.length) & 0xFF, ((~chunk.length) >> 8) & 0xFF]));
        chunks.push(chunk);
    }
    const body    = concat(chunks);
    const checksum = adler32(data);
    const zlib    = new Uint8Array(2 + body.length + 4);
    zlib[0] = 0x78; zlib[1] = 0x01;
    zlib.set(body, 2);
    zlib[zlib.length - 4] = (checksum >>> 24) & 0xFF;
    zlib[zlib.length - 3] = (checksum >>> 16) & 0xFF;
    zlib[zlib.length - 2] = (checksum >>>  8) & 0xFF;
    zlib[zlib.length - 1] = (checksum       ) & 0xFF;
    return zlib;
}

function concat(arrays) {
    const total = arrays.reduce((n, a) => n + a.length, 0);
    const out   = new Uint8Array(total);
    let offset  = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    return out;
}

function uint32BE(n) {
    return new Uint8Array([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
}

function pngChunk(type, data) {
    const typeBytes = new TextEncoder().encode(type);
    const crcBuf    = concat([typeBytes, data]);
    return concat([uint32BE(data.length), typeBytes, data, uint32BE(crc32(crcBuf))]);
}

function encodePNG(width, height, rgba) {
    // Build raw image data (filter byte 0x00 = None, before each row)
    const rows = new Uint8Array(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
        rows[y * (1 + width * 4)] = 0; // filter type = None
        for (let x = 0; x < width; x++) {
            const src = (y * width + x) * 4;
            const dst = y * (1 + width * 4) + 1 + x * 4;
            rows.set(rgba.slice(src, src + 4), dst);
        }
    }
    const ihdrData = concat([uint32BE(width), uint32BE(height),
                              new Uint8Array([8, 6, 0, 0, 0])]); // 8-bit RGBA (color type 6)
    const idat     = deflateUncompressed(rows);
    const sig      = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    return Buffer.from(concat([sig,
                               pngChunk('IHDR', ihdrData),
                               pngChunk('IDAT', idat),
                               pngChunk('IEND', new Uint8Array(0))]));
}

// ---------------------------------------------------------------------------
// Orange-fruit pixel renderer
// ---------------------------------------------------------------------------

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function renderOrange(size) {
    const rgba = new Uint8Array(size * size * 4);
    const cx   = size / 2;
    const cy   = size * 0.57;   // fruit centre (slightly below mid to leave room for stem)
    const r    = size * 0.41;   // fruit radius

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i  = (y * size + x) * 4;
            const dx = x - cx;
            const dy = y - cy;
            const d  = Math.sqrt(dx * dx + dy * dy);

            // --- fruit body ---
            if (d <= r) {
                // radial gradient: inner highlight → deep orange
                const t  = d / r;
                // highlight offset towards top-left
                const hx = x - (cx - r * 0.25);
                const hy = y - (cy - r * 0.30);
                const hd = Math.sqrt(hx * hx + hy * hy) / (r * 0.85);
                const ht = clamp(hd, 0, 1);
                const rC = Math.round(lerp(255, 220, ht));
                const gC = Math.round(lerp(185, 95,  ht));
                const bC = Math.round(lerp(50,  10,  ht));

                // soft anti-alias edge
                const aa = clamp(1 - (d - (r - 1.2)) / 1.2, 0, 1);
                rgba[i]   = rC;
                rgba[i+1] = gC;
                rgba[i+2] = bC;
                rgba[i+3] = Math.round(aa * 255);
                continue;
            }

            // --- stem (thin rect above fruit) ---
            const stemW  = size * 0.07;
            const stemH  = size * 0.12;
            const stemX1 = cx - stemW / 2;
            const stemX2 = cx + stemW / 2;
            const stemY1 = cy - r - stemH + size * 0.02;
            const stemY2 = cy - r + size * 0.02;
            if (x >= stemX1 && x <= stemX2 && y >= stemY1 && y <= stemY2) {
                rgba[i]   = 80;
                rgba[i+1] = 120;
                rgba[i+2] = 30;
                rgba[i+3] = 255;
                continue;
            }

            // --- leaf (ellipse, rotated ~-30°) ---
            const leafCX = cx + size * 0.10;
            const leafCY = cy - r - size * 0.05;
            const leafRX = size * 0.14;
            const leafRY = size * 0.07;
            const angle  = -30 * Math.PI / 180;
            const lx     = (x - leafCX) * Math.cos(-angle) - (y - leafCY) * Math.sin(-angle);
            const ly     = (x - leafCX) * Math.sin(-angle) + (y - leafCY) * Math.cos(-angle);
            if ((lx / leafRX) ** 2 + (ly / leafRY) ** 2 <= 1) {
                rgba[i]   = 60;
                rgba[i+1] = 160;
                rgba[i+2] = 50;
                rgba[i+3] = 255;
                continue;
            }

            // transparent background
            rgba[i+3] = 0;
        }
    }
    return rgba;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const assetsDir = path.join(__dirname, '..', 'public', 'assets');

const sizes = [
    { name: 'favicon-16x16.png',    size: 16  },
    { name: 'favicon-32x32.png',    size: 32  },
    { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of sizes) {
    const rgba   = renderOrange(size);
    const pngBuf = encodePNG(size, size, rgba);
    const dest   = path.join(assetsDir, name);
    fs.writeFileSync(dest, pngBuf);
    console.log(`Written ${dest} (${size}x${size})`);
}

console.log('Done. Orange favicons generated successfully.');
