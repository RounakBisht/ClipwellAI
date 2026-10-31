// Copies the ffmpeg.wasm engine into public/ffmpeg so the browser loads it from our own domain.
// Runs automatically before `npm run build` and `npm run dev`.
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "public", "ffmpeg");
mkdirSync(out, { recursive: true });
const core = join(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "esm");
const lib = join(process.cwd(), "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
for (const f of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) cpSync(join(core, f), join(out, f));
for (const f of ["worker.js", "const.js", "errors.js"]) cpSync(join(lib, f), join(out, f));
console.log("ffmpeg.wasm copied to public/ffmpeg");
