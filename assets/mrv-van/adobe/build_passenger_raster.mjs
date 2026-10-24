// Passenger side of the MRV van, rebuilt from the driver-side vector at the pixel level:
//   node assets/mrv-van/adobe/build_passenger_raster.mjs   ->  v3/mrv-van-02-passenger-side.png
// The passenger side is the driver side mirrored, but the lettering must read forwards. The lettering
// is knocked out of the body panels, so a mirrored copy carries backwards letter-shaped holes; painting
// them over in one colour (the old build) left red inside the letters wherever the body behind is blue.
// Here: (1) mirror the render, (2) erase each lettering block and fill every erased pixel from the
// nearest body-paint pixel (so the red / blue swoosh edge carries straight through), (3) lift the
// forward lettering off the driver side (everything that is neither body colour) and lay it on.
import { createRequire } from "module";
import path from "path"; import os from "os"; import { fileURLToPath } from "url";
const sharp = createRequire(path.join(os.homedir(), ".local/rtr-tools/package.json"))("sharp");
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), K = 2, W = 2000 * K, H = 1339 * K;
const RED = [203, 32, 39], NAVY = [28, 61, 114];
// lettering blocks in driver-side art units (adobe/build_passenger.py)
// copy: the SBA logo and its caption sit on plain blue on both sides, so their whole box is copied across
const BLOCKS = [[[846, 580, 1000, 702], "copy"], [[840, 704, 1012, 756], "copy"], [[1120, 578, 1436, 696]], [[1150, 704, 1412, 752]]];
const { data: D } = await sharp(path.join(DIR, "adobe/reference-vector.svg"), { density: 72 * K }).resize(W, H).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const B = Buffer.alloc(D.length);                                              // (1) mirrored
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) D.copy(B, (y * W + x) * 4, (y * W + (W - 1 - x)) * 4, (y * W + (W - 1 - x)) * 4 + 4);
const dist = (buf, i, c) => Math.hypot(buf[i] - c[0], buf[i + 1] - c[1], buf[i + 2] - c[2]);
const isPanel = (buf, i) => dist(buf, i, RED) < 60 || dist(buf, i, NAVY) < 60;
for (const [[x0, y0, x1, y1], mode] of BLOCKS) {
  if (mode === "copy") {
    // the logo and its caption sit on plain body blue on both sides, with the white stripe at one edge:
    // paint the backwards logo out with body blue (leaving the stripe), then lay on everything of the
    // driver-side logo that isn't body blue (white letters, the bracket, the red bar)
    const dx = W - (x0 + x1) * K, px0 = W - x1 * K, px1 = W - x0 * K, white = (buf, x, y) => { const i = (y * W + x) * 4; return buf[i] > 200 && buf[i + 1] > 200 && buf[i + 2] > 200; };
    for (let y = y0 * K; y < y1 * K; y++) {
      let l = px0; while (l < px1 && white(B, l, y)) l++; if (l > px0) l += 3 * K;          // passenger side: stripe at the left edge
      for (let x = l; x < px1; x++) { const i = (y * W + x) * 4; B[i] = NAVY[0]; B[i + 1] = NAVY[1]; B[i + 2] = NAVY[2]; }
      let r = x1 * K - 1; while (r > x0 * K && white(D, r, y)) r--; if (r < x1 * K - 1) r -= 3 * K;   // driver side: stripe at the right edge
      for (let x = x0 * K; x <= r; x++) {
        const i = (y * W + x) * 4, a = Math.min(1, Math.max(0, (dist(D, i, NAVY) - 30) / 90)); if (a <= 0) continue;
        const j = (y * W + x + dx) * 4; for (let c = 0; c < 3; c++) B[j + c] = Math.round(B[j + c] * (1 - a) + D[i + c] * a);
      }
    }
    continue;
  }
  // (2) erase the mirrored lettering inside its (mirrored) block and fill from the nearest panel pixel
  const pad = 3 * K, mx0 = W - x1 * K - pad, mx1 = W - x0 * K + pad, my0 = y0 * K - pad, my1 = y1 * K + pad;
  const bw = mx1 - mx0, bh = my1 - my0, owner = new Int32Array(bw * bh).fill(-1), queue = [];
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = ((my0 + y) * W + mx0 + x) * 4; if (isPanel(B, i)) { owner[y * bw + x] = i; queue.push(y * bw + x); } }
  for (let q = 0; q < queue.length; q++) {                                    // breadth-first: nearest panel pixel wins
    const c = queue[q], cx = c % bw, cy = (c / bw) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue; const n = ny * bw + nx; if (owner[n] < 0) { owner[n] = owner[c]; queue.push(n); } }
  }
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const o = owner[y * bw + x], i = ((my0 + y) * W + mx0 + x) * 4; if (o >= 0 && o !== i) B.copy(B, i, o, o + 4); }
  // (3) forward lettering from the driver side: alpha from how far each pixel is from the panel colour
  const dx = W - (x0 + x1) * K;                                                // centred where the mirrored block was
  // the letters are white with a thin dark edge; anything dark further than a few pixels from white
  // (the paint seams of the driver side) is not lettering
  const sx0 = x0 * K, sy0 = y0 * K, sw = (x1 - x0) * K, sh = (y1 - y0) * K, near = new Uint8Array(sw * sh), R2 = 3 * K;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const i = ((sy0 + y) * W + sx0 + x) * 4; if (D[i] > 150 && D[i + 1] > 150 && D[i + 2] > 150 && Math.max(D[i], D[i + 1], D[i + 2]) - Math.min(D[i], D[i + 1], D[i + 2]) < 70)
    for (let v = -R2; v <= R2; v++) for (let u = -R2; u <= R2; u++) { const X = x + u, Y = y + v; if (X >= 0 && Y >= 0 && X < sw && Y < sh) near[Y * sw + X] = 1; } }
  for (let y = sy0; y < sy0 + sh; y++) for (let x = sx0; x < sx0 + sw; x++) {
    if (!near[(y - sy0) * sw + x - sx0]) continue;
    const i = (y * W + x) * 4, a = Math.min(1, Math.max(0, (Math.min(dist(D, i, RED), dist(D, i, NAVY)) - 25) / 90)); if (a <= 0) continue;   // neither body colour: lettering
    const j = (y * W + x + dx) * 4; for (let c = 0; c < 3; c++) B[j + c] = Math.round(B[j + c] * (1 - a) + D[i + c] * a);
  }
}
await sharp(B, { raw: { width: W, height: H, channels: 4 } }).resize(2000, 1339).png().toFile(path.join(DIR, "v3/mrv-van-02-passenger-side.png"));
console.log("written v3/mrv-van-02-passenger-side.png");
