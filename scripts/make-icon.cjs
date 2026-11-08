'use strict';

// Draws electron/icon.ico and electron/icon.png without external image tools.
// Run with: node scripts/make-icon.cjs
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 512;
const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);

const color = (hex, alpha = 255) => {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff, alpha];
};

function blend(x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return;
  const i = (y * SIZE + x) * 4;
  const src = a / 255;
  const dst = pixels[i + 3] / 255;
  const out = src + dst * (1 - src);
  if (out <= 0) return;
  pixels[i] = (r * src + pixels[i] * dst * (1 - src)) / out;
  pixels[i + 1] = (g * src + pixels[i + 1] * dst * (1 - src)) / out;
  pixels[i + 2] = (b * src + pixels[i + 2] * dst * (1 - src)) / out;
  pixels[i + 3] = out * 255;
}

function circle(cx, cy, radius, fill) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) blend(x, y, fill);
    }
  }
}

function line(x1, y1, x2, y2, width, fill) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.5);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, fill);
  }
}

function roundedRect(x, y, w, h, radius, fill) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      const cx = Math.min(Math.max(px, x + radius), x + w - radius);
      const cy = Math.min(Math.max(py, y + radius), y + h - radius);
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2) blend(px, py, fill);
    }
  }
}

// Body.
roundedRect(10, 10, 492, 492, 104, color('#22d3ee', 210));
roundedRect(18, 18, 476, 476, 96, color('#0b1220'));

// Scope screen with a graticule and a bright trace.
roundedRect(58, 94, 396, 286, 26, color('#071a1f'));
roundedRect(62, 98, 388, 278, 22, color('#052e2b'));

for (let i = 1; i < 10; i += 1) {
  const x = 62 + (388 / 10) * i;
  line(x, 100, x, 374, 1.6, color('#22d3ee', 55));
}
for (let i = 1; i < 7; i += 1) {
  const y = 98 + (278 / 7) * i;
  line(64, y, 448, y, 1.6, color('#22d3ee', 55));
}

// One and a half cycles of a sine wave.
let prevX = 84;
let prevY = 236;
for (let x = 88; x <= 428; x += 4) {
  const y = 236 - Math.sin(((x - 84) / 344) * Math.PI * 3) * 92;
  line(prevX, prevY, x, y, 11, color('#22d3ee', 70));
  line(prevX, prevY, x, y, 5, color('#67e8f9'));
  prevX = x;
  prevY = y;
}

// Control knobs along the bottom.
for (const [x, shade] of [[100, '#f59e0b'], [176, '#e2e8f0'], [252, '#e2e8f0'], [328, '#38bdf8']]) {
  circle(x, 428, 30, color('#1e293b'));
  circle(x, 428, 22, color(shade, 235));
  circle(x, 428, 8, color('#0b1220'));
}
circle(414, 428, 18, color('#22c55e'));

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc32 = (buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
    return Buffer.concat([length, typeBuffer, data, crc]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function resize(size) {
  const out = new Uint8ClampedArray(size * size * 4);
  const scale = SIZE / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = Math.floor(y * scale); sy < Math.floor((y + 1) * scale); sy += 1) {
        for (let sx = Math.floor(x * scale); sx < Math.floor((x + 1) * scale); sx += 1) {
          const i = (sy * SIZE + sx) * 4;
          const alpha = pixels[i + 3] / 255;
          r += pixels[i] * alpha;
          g += pixels[i + 1] * alpha;
          b += pixels[i + 2] * alpha;
          a += alpha;
          count += 1;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round((a / count) * 255);
      }
    }
  }
  return out;
}

const sizes = [256, 128, 64, 48, 32, 16];
const pngs = sizes.map((size) => encodePng(size, size, resize(size)));

fs.mkdirSync(path.join(__dirname, '..', 'electron'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'electron', 'icon.png'), pngs[0]);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);

const entries = [];
let offset = 6 + pngs.length * 16;
for (let i = 0; i < pngs.length; i += 1) {
  const png = pngs[i];
  const entry = Buffer.alloc(16);
  const size = sizes[i];
  entry[0] = size === 256 ? 0 : size;
  entry[1] = size === 256 ? 0 : size;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  entries.push(entry);
  offset += png.length;
}

fs.writeFileSync(
  path.join(__dirname, '..', 'electron', 'icon.ico'),
  Buffer.concat([header, ...entries, ...pngs])
);
console.log('Wrote electron/icon.ico and electron/icon.png');

// Android launcher icons (legacy + adaptive foreground) when the platform exists.
const androidRes = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(androidRes)) {
  const densities = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
  };
  for (const [density, size] of Object.entries(densities)) {
    const dir = path.join(androidRes, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    const png = encodePng(size, size, resize(size));
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), png);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), png);
    const fg = size * 2.25;
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), encodePng(fg, fg, resize(fg)));
  }
  console.log('Wrote Android launcher icons');
}
