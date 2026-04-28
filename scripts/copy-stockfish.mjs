/**
 * Copies the single-threaded Stockfish 18 WASM engine into `public/stockfish/`
 * so it's served as a static asset by Next.js / Vercel.
 *
 * We use the `lite-single` variant: smaller NNUE (~7MB), single-threaded,
 * doesn't require SharedArrayBuffer / COOP+COEP headers.
 *
 * Runs as `postinstall` so engine files appear after `npm install` everywhere
 * (local dev + Vercel build).
 */

import { copyFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SRC_DIR = resolve(ROOT, "node_modules/stockfish/bin");
const DEST_DIR = resolve(ROOT, "public/stockfish");

const FILES = [
  "stockfish-18-lite-single.js",
  "stockfish-18-lite-single.wasm",
];

async function main() {
  try {
    await access(SRC_DIR);
  } catch {
    console.warn(
      "[copy-stockfish] node_modules/stockfish not found — skipping. " +
        "(This is OK if running before npm install.)"
    );
    return;
  }

  await mkdir(DEST_DIR, { recursive: true });
  for (const file of FILES) {
    const src = resolve(SRC_DIR, file);
    const dest = resolve(DEST_DIR, file);
    await copyFile(src, dest);
    console.log(`[copy-stockfish] ${file}`);
  }
  console.log(`[copy-stockfish] done → public/stockfish/`);
}

main().catch((err) => {
  console.error("[copy-stockfish] failed:", err);
  process.exit(1);
});
