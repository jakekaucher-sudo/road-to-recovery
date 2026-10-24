// Photo detail textures for the 3D road and verges, from the generated photos in art/tex/src/.
//   node game/tools/make_textures.mjs
// Each photo is made to tile (its edges cross-faded with a half-offset copy), then saved as a 1024 px
// JPEG colour map plus a normal map (relief from brightness) and, for asphalt, a roughness map
// (dark tar and polished tyre tracks are a little glossier than the bare aggregate).
import { createRequire } from "module";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
const req = createRequire(path.join(os.homedir(), ".local/rtr-tools/package.json")), sharp = req("sharp");
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "art", "tex"), SIZE = 1024;
const lum = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
for (const [name, relief] of [["asphalt", 2.6], ["grass", 2.0]]) {
  const { data: px } = await sharp(path.join(DIR, "src", name + ".png")).resize(SIZE, SIZE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = SIZE, H = SIZE, out = Buffer.alloc(px.length), band = SIZE * 0.22;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y), t = Math.min(1, e / band), k = t * t * (3 - 2 * t);
    const i = (y * W + x) * 3, j = (((y + H / 2) % H) * W + ((x + W / 2) % W)) * 3;
    for (let c = 0; c < 3; c++) out[i + c] = px[i + c] * k + px[j + c] * (1 - k);
  }
  // even out big brightness swings (the photo's lighting) so the tiling doesn't show
  const L = new Float32Array(W * H); let mean = 0; for (let i = 0; i < W * H; i++) { L[i] = lum(out, i * 3); mean += L[i]; } mean /= W * H;
  const nrm = Buffer.alloc(W * H * 3), rough = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, hx = L[y * W + (x + 1) % W] - L[y * W + (x + W - 1) % W], hy = L[((y + 1) % H) * W + x] - L[((y + H - 1) % H) * W + x];
    let nx = -hx * relief, ny = hy * relief, nz = 1; const l = Math.hypot(nx, ny, nz);
    nrm[i * 3] = (nx / l * 0.5 + 0.5) * 255; nrm[i * 3 + 1] = (ny / l * 0.5 + 0.5) * 255; nrm[i * 3 + 2] = (nz / l * 0.5 + 0.5) * 255;
    rough[i] = Math.max(60, Math.min(255, (0.86 + (L[i] - mean) * 0.6) * 255));
  }
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 84 }).toFile(path.join(DIR, name + ".jpg"));
  await sharp(nrm, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90 }).toFile(path.join(DIR, name + "-normal.jpg"));
  if (name === "asphalt") await sharp(rough, { raw: { width: W, height: H, channels: 1 } }).jpeg({ quality: 88 }).toFile(path.join(DIR, name + "-rough.jpg"));
  console.log(name, "mean", mean.toFixed(3));
}
