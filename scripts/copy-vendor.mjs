// Copies the large runtime files (ffmpeg wasm, pdf.js worker) into public/vendor so they
// are served from our own origin (no third-party requests). Runs before dev and build.
import { cpSync, mkdirSync, rmSync } from "node:fs";

const out = "public/vendor";
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/ffmpeg`, { recursive: true });

cpSync("node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js", `${out}/ffmpeg/ffmpeg-core.js`);
cpSync("node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm", `${out}/ffmpeg/ffmpeg-core.wasm`);
cpSync("node_modules/@ffmpeg/ffmpeg/dist/esm", `${out}/ffmpeg/lib`, { recursive: true, filter: (src) => !src.endsWith(".d.ts") && !src.endsWith(".d.mts") });
cpSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", `${out}/pdf.worker.min.mjs`);
console.log("vendor files copied to", out);
