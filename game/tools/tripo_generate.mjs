#!/usr/bin/env node
// Generate a 3D model (GLB) from a text prompt with the Tripo API and save it
// into the game's assets folder, ready for GLTFLoader.
//
// Usage:
//   TRIPO_API_KEY=tsk_... node game/tools/tripo_generate.mjs "a red fire hydrant" --out assets/models/hydrant.glb
//   node game/tools/tripo_generate.mjs --task task_abc123 --out assets/models/hydrant.glb   (resume / re-download)
//
// The key is read from $TRIPO_API_KEY or from ~/.config/tripo/key (one line).
// Needs Node 18+ (built-in fetch). No dependencies.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { homedir } from "node:os";

const BASE_URL = "https://openapi.tripo3d.ai/v3";
const DEFAULT_MODEL = "v3.1-20260211";
const POLL_MS = 3000;
const TIMEOUT_MS = 15 * 60 * 1000;

function usage(code = 0) {
  console.log(`Usage:
  node game/tools/tripo_generate.mjs "<prompt>" [--out <file.glb>] [--model <version>] [--preview]
  node game/tools/tripo_generate.mjs --task <task_id> [--out <file.glb>]

Options:
  --out <path>       Where to save the GLB. Default: assets/models/<slug-from-prompt>.glb
  --model <version>  Tripo model version. Default: ${DEFAULT_MODEL}
  --preview          Also save Tripo's rendered preview PNG next to the GLB
  --task <id>        Skip generation; poll/download an existing task
  -h, --help         Show this help

Key: set TRIPO_API_KEY, or put the key on one line in ~/.config/tripo/key`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { prompt: null, out: null, model: DEFAULT_MODEL, preview: false, task: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") usage(0);
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--model") opts.model = argv[++i];
    else if (a === "--preview") opts.preview = true;
    else if (a === "--task") opts.task = argv[++i];
    else if (a.startsWith("--")) { console.error(`Unknown option ${a}`); usage(1); }
    else if (opts.prompt === null) opts.prompt = a;
    else { console.error(`Unexpected argument ${a}`); usage(1); }
  }
  if (!opts.prompt && !opts.task) usage(1);
  return opts;
}

function loadKey() {
  if (process.env.TRIPO_API_KEY) return process.env.TRIPO_API_KEY.trim();
  const keyFile = resolve(homedir(), ".config/tripo/key");
  if (existsSync(keyFile)) return readFileSync(keyFile, "utf8").trim();
  console.error(`No Tripo API key found.
Create one at https://developers.tripo3d.ai/en/keys, then either:
  export TRIPO_API_KEY=tsk_...
or
  mkdir -p ~/.config/tripo && echo tsk_... > ~/.config/tripo/key`);
  process.exit(2);
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "model";
}

async function api(path, key, init = {}) {
  const res = await fetch(BASE_URL + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(init.headers || {}) },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok || !json || json.code !== 0) {
    const msg = json?.message || json?.msg || text.slice(0, 300);
    throw new Error(`Tripo ${path} -> HTTP ${res.status}: ${msg}`);
  }
  return json.data;
}

async function createTask(key, prompt, model) {
  const data = await api("/generation/text-to-model", key, {
    method: "POST",
    body: JSON.stringify({ prompt, model }),
  });
  return data.task_id;
}

async function waitForTask(key, taskId) {
  const start = Date.now();
  let lastLine = "";
  for (;;) {
    const task = await api(`/tasks/${taskId}`, key);
    const line = `  ${task.status} ${task.progress ?? 0}%`;
    if (line !== lastLine) { console.log(line); lastLine = line; }
    if (task.status === "success") return task;
    if (["failed", "cancelled", "banned", "expired", "unknown"].includes(task.status)) {
      throw new Error(`Task ${taskId} ended with status "${task.status}"`);
    }
    if (Date.now() - start > TIMEOUT_MS) throw new Error(`Timed out waiting for task ${taskId}`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
  return buf.length;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const key = loadKey();

  let taskId = opts.task;
  if (!taskId) {
    console.log(`Creating text-to-model task (${opts.model}): "${opts.prompt}"`);
    taskId = await createTask(key, opts.prompt, opts.model);
    console.log(`Task ${taskId}`);
  } else {
    console.log(`Resuming task ${taskId}`);
  }

  const task = await waitForTask(key, taskId);
  const out = task.output || {};
  const modelUrl = out.pbr_model_url || out.model_url || out.base_model_url;
  if (!modelUrl) throw new Error(`Task succeeded but returned no model URL: ${JSON.stringify(out)}`);

  const outPath = resolve(opts.out || `assets/models/${slug(opts.prompt || taskId)}.glb`);
  const bytes = await download(modelUrl, outPath);
  console.log(`Saved ${basename(outPath)} (${(bytes / 1024).toFixed(0)} KB) -> ${outPath}`);

  if (opts.preview && out.rendered_image_url) {
    const pngPath = outPath.replace(/\.glb$/i, "") + ".preview.png";
    await download(out.rendered_image_url, pngPath);
    console.log(`Saved preview -> ${pngPath}`);
  }

  console.log(`
Load it in the game with:
  import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
  new GLTFLoader().load("${outPath.includes("/assets/") ? "../assets/" + outPath.split("/assets/")[1] : outPath}", (gltf) => scene.add(gltf.scene));`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
