const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const W = 32;
const H = 32;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function pngFromRgba(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[(w * 4 + 1) * y] = 0;
    rgba.copy(raw, (w * 4 + 1) * y + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function roundedRect(px, py, size, radius) {
  const x = Math.min(Math.max(px, 0), size - 1);
  const y = Math.min(Math.max(py, 0), size - 1);
  const r = radius;
  const inside = (cx, cy) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  if (x < r && y < r) return inside(r, r);
  if (x >= size - r && y < r) return inside(size - 1 - r, r);
  if (x < r && y >= size - r) return inside(r, size - 1 - r);
  if (x >= size - r && y >= size - r) return inside(size - 1 - r, size - 1 - r);
  return true;
}

function inFlame(x, y) {
  const dx = x - 16;
  const t = (y - 6.2) / 23.5;
  if (t < 0 || t > 1) return false;
  const width = t < 0.42 ? 1.2 + t * 8.2 : 5.6 - (t - 0.42) * 4.4;
  return Math.abs(dx) <= width * (0.55 + 0.45 * Math.sin(t * Math.PI));
}

const rgba = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!roundedRect(x, y, 32, 7)) {
      rgba[i + 3] = 0;
      continue;
    }
    let r = 0x14;
    let g = 0x00;
    let b = 0x1f;
    const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
    if (Math.abs(d - 11) <= 1.15) {
      r = 0x9e;
      g = 0xec;
      b = 0xff;
    } else if (inFlame(x + 0.5, y + 0.5) && d < 12.2) {
      r = 0xe4;
      g = 0x00;
      b = 0xff;
    }
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = 255;
  }
}

const png = pngFromRgba(rgba, W, H);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header[8] = 0;
header[9] = 0;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);

const ico = Buffer.concat([header, png]);
const destIco = path.join(__dirname, "..", "public", "favicon.ico");
const destPng = path.join(__dirname, "..", "public", "icons", "icon-32.png");
fs.writeFileSync(destIco, ico);
fs.writeFileSync(destPng, png);
console.log(`Wrote ${destIco} (${ico.length} bytes)`);
console.log(`Wrote ${destPng} (${png.length} bytes)`);
