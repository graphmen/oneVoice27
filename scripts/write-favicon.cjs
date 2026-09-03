const fs = require("fs");
const path = require("path");

const pngPath = path.join(__dirname, "..", "public", "icons", "icon-32.png");
const png = fs.readFileSync(pngPath);
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
const appIco = path.join(__dirname, "..", "src", "app", "favicon.ico");
const publicIco = path.join(__dirname, "..", "public", "favicon.ico");
fs.writeFileSync(appIco, ico);
fs.writeFileSync(publicIco, ico);
console.log(`Wrote favicon.ico (${ico.length} bytes)`);
