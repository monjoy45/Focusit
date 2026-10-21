// One-off generator: soft teal disc with a pale ring and a still centre dot. Pure Node, no deps.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(size) {
  const S = 4, raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) { let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const d = Math.hypot((x + (sx + .5) / S) / size - .5, (y + (sy + .5) / S) / size - .5);
        let px = null;
        if (d < .1) px = [232, 238, 236]; else if (d > .26 && d < .32) px = [232, 238, 236]; else if (d < .47) px = [58, 109, 102];
        if (px) { r += px[0]; g += px[1]; b += px[2]; a += 255; } }
      const n = S * S, i = y * (size * 4 + 1) + 1 + x * 4, cov = a / 255 || 1;
      raw[i] = r / cov; raw[i + 1] = g / cov; raw[i + 2] = b / cov; raw[i + 3] = a / n; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [16, 32, 48, 128]) writeFileSync(`public/icons/icon${s}.png`, png(s));
