/**
 * render-remotion.ts
 *
 * Reads sessions/<slug>/<date>/assets/manifest.json,
 * measures audio durations, builds timeline, renders via Remotion.
 *
 * Usage:
 *   npx tsx scripts/render-remotion.ts <slug> <date> <title> [16:9|9:16]
 *
 * Output:
 *   sessions/<slug>/<date>/output/<title>.mp4
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFileSync, mkdirSync, existsSync, statSync, createReadStream } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "child_process";
import http from "http";
import "dotenv/config";

// ── CLI Args ────────────────────────────────────────────────────────────────────
const SLUG = process.argv[2];
const DATE = process.argv[3];
const VIDEO_TITLE = process.argv[4];
const RATIO = (process.argv[5] || "16:9") as "16:9" | "9:16";

if (!SLUG || !DATE || !VIDEO_TITLE) {
  console.error("Usage: npx tsx scripts/render-remotion.ts <slug> <date> <title> [16:9|9:16]");
  process.exit(1);
}

const PROJECT_ROOT = resolve(process.cwd());
const ASSETS_DIR = join(PROJECT_ROOT, "sessions", SLUG, DATE, "assets");
const OUTPUT_DIR = join(PROJECT_ROOT, "sessions", SLUG, DATE, "output");
const MANIFEST_PATH = join(ASSETS_DIR, "manifest.json");

// ── Logo config (one-time per niche — update here) ──────────────────────────────
const LOGO_CONFIG = {
  src: "/images/logos/rw_logo.png",   // served by static server
  position: "top-left" as const,
  sizePx: 60,
  marginPx: 15,
};

// ── Video dimensions ─────────────────────────────────────────────────────────────
const DIM = RATIO === "16:9"
  ? { width: 1920, height: 1080 }
  : { width: 1080, height: 1920 };
const FPS = 30;
const BACKGROUND_COLOR = "#000000";

// ── Measure audio duration with ffprobe ────────────────────────────────────────
function measureAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", filePath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const sec = parseFloat(out.trim()) || 0;
      resolve(Math.round(sec * FPS));
    });
    proc.on("error", () => resolve(0));
  });
}

// ── Static HTTP server ──────────────────────────────────────────────────────────
const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
};

function startServer(port: number): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "").replace(/^\//, "");
      const filePath = join(PROJECT_ROOT, urlPath);

      const range = req.headers.range;
      if (range && existsSync(filePath) && statSync(filePath).isFile()) {
        const stat = statSync(filePath);
        const parts = range.match(/bytes=(\d+)-(\d*)/);
        const start = parts ? parseInt(parts[1]) : 0;
        const end = parts[2] ? parseInt(parts[2]) : stat.size - 1;
        const ext = filePath.slice(filePath.lastIndexOf("."));
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Content-Type": MIME[ext] || "application/octet-stream",
        });
        createReadStream(filePath, { start, end }).pipe(res);
        return;
      }

      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = filePath.slice(filePath.lastIndexOf("."));
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404); res.end("Not found: " + urlPath);
      }
    });
    server.listen(port, () => resolve({ server, baseUrl: `http://localhost:${port}` }));
  });
}

// ── Animation cycler ────────────────────────────────────────────────────────────
const ANIMATIONS = ["ken-burns", "slow-zoom", "zoom-in", "zoom-out", "pan-left", "pan-right"] as const;
function getAnimation(index: number) {
  return ANIMATIONS[index % ANIMATIONS.length];
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  if (!existsSync(MANIFEST_PATH)) {
    console.error(`[render] ERROR: Manifest not found: ${MANIFEST_PATH}`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  console.log(`[render] Manifest: ${manifest.scenes.length} scenes (${RATIO})`);

  // Measure audio durations
  console.log("[render] Measuring audio durations with ffprobe...");
  const sceneDurations: number[] = [];
  for (const scene of manifest.scenes) {
    const audioPath = scene.audioPath;
    if (!audioPath || !existsSync(audioPath)) {
      sceneDurations.push(Math.round((scene.estimatedDurationSec || 8) * FPS));
      process.stdout.write("e");
      continue;
    }
    const frames = await measureAudioDuration(audioPath);
    sceneDurations.push(frames || Math.round((scene.estimatedDurationSec || 8) * FPS));
    process.stdout.write(".");
  }
  console.log("\n[render] Durations measured");

  // Build timeline
  let cursor = 0;
  const scenes = manifest.scenes.map((s: any, i: number) => {
    const durationInFrames = Math.max(sceneDurations[i], FPS);
    const startFrame = cursor;
    const endFrame = cursor + durationInFrames;
    cursor = endFrame;
    return {
      id: `scene-${i}`,
      imageSrc: s.imagePath,
      audioSrc: s.audioPath,
      narration: s.narration,
      startFrame,
      durationInFrames,
      endFrame,
      animationType: getAnimation(i),
    };
  });

  const totalFrames = cursor;
  const totalSec = totalFrames / FPS;
  console.log(`[render] Timeline: ${totalFrames} frames @ ${FPS}fps = ${totalSec.toFixed(1)}s`);

  const renderProps = {
    scenes,
    config: {
      title: VIDEO_TITLE,
      logoSrc: LOGO_CONFIG.src,
      logoPosition: LOGO_CONFIG.position,
      logoSizePx: LOGO_CONFIG.sizePx,
      logoMarginPx: LOGO_CONFIG.marginPx,
      subtitleEnabled: true,
      subtitlePosition: "bottom" as const,
      musicSrc: undefined as string | undefined,
      outputFilename: `${VIDEO_TITLE}.mp4`,
      fps: FPS,
      width: DIM.width,
      height: DIM.height,
      backgroundColor: BACKGROUND_COLOR,
    },
  };

  console.log("[render] Starting file server on port 3456...");
  const { server } = await startServer(3456);

  try {
    console.log("[render] Bundling Remotion project...");
    const bundleLocation = await bundle(
      join(PROJECT_ROOT, "remotion", "index.ts"),
      (p: number) => process.stdout.write(` ${Math.round(p * 100)}%`),
      { outDir: join(PROJECT_ROOT, ".remotion", "bundles") }
    );
    console.log("\n[render] Selecting composition...");

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "Video",
      inputProps: renderProps,
    });
    console.log(`[render] Composition: ${composition.width}x${composition.height} @ ${FPS}fps`);

    const outputPath = join(OUTPUT_DIR, `${VIDEO_TITLE}.mp4`);
    console.log(`[render] Rendering -> ${outputPath}`);
    console.log(`[render] Estimated time: ~${Math.ceil(totalSec * 2 / 60)} minutes...`);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: renderProps,
      pixelFormat: "yuv420p",
      crf: 23,
    });

    const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`[render] DONE: ${outputPath} (${sizeMB} MB)`);
  } finally {
    server.close();
    console.log("[render] Server stopped");
  }
}

main().catch((e: Error) => { console.error("[render] FATAL:", e); process.exit(1); });
