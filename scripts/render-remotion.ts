/**
 * render-remotion.ts
 *
 * Two-stage render (same pattern as ytautomation):
 *   Stage 1: renderFrames() — renders each frame as JPEG
 *   Stage 2: ffmpeg stitch — joins frames + audio into MP4 with h264_vaapi
 *
 * Reads sessions/<slug>/<date>/assets/manifest.json,
 * measures audio durations, builds timeline.
 *
 * Usage:
 *   npx tsx scripts/render-remotion.ts <slug> <date> <title> [16:9|9:16]
 *
 * Output:
 *   sessions/<slug>/<date>/output/<title>.mp4
 */

import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { readFileSync, mkdirSync, existsSync, statSync, createReadStream } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, execSync } from "child_process";
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
  src: "/images/logos/rw_logo.png",  // served by static server
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

// ── Detect GPU for VA-API encoding ───────────────────────────────────────────────
function detectGpuDevice(): string | null {
  try {
    const nodes: string[] = execSync('ls /dev/dri/renderD* 2>/dev/null', { encoding: "utf-8" })
      .trim().split("\n").filter(Boolean);
    for (const node of nodes) {
      try {
        const devpath = execSync(`udevadm info ${node} 2>/dev/null | grep DEVPATH=`, { encoding: "utf-8" });
        if (devpath.includes("0000:01:00.0")) {
          console.log(`[GPU] Selected discrete GPU: RX 560 at ${node}`);
          return node;
        }
      } catch {}
    }
  } catch {}
  return null;
}

// ── Measure audio duration ───────────────────────────────────────────────────────
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

// ── Static server ────────────────────────────────────────────────────────────────
const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
  ".js": "application/javascript",
  ".html": "text/html",
  ".ico": "image/x-icon",
};

function startServer(port: number, bundleDir: string): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "/").split("?")[0].replace(/^\//, "");

      // Serve bundle files
      if (urlPath === "bundle.js" || urlPath === "bundle.js.map" || urlPath === "index.html" || urlPath === "favicon.ico") {
        const filePath = join(bundleDir, urlPath);
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          const ext = filePath.slice(filePath.lastIndexOf("."));
          res.writeHead(200, { "Content-Type": MIME[ext] || "application/javascript" });
          createReadStream(filePath).pipe(res);
          return;
        }
      }

      // Serve project files
      // Try multiple locations: public/ for static assets, root for sessions
      let filePath = join(PROJECT_ROOT, "public", urlPath);
      if (!existsSync(filePath)) {
        filePath = join(PROJECT_ROOT, urlPath);
      }
      if (!existsSync(filePath)) {
        filePath = join(PROJECT_ROOT, "sessions", urlPath);
      }
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

  // Build timeline — convert absolute paths to URL paths for the static server
  const PROJECT_ROOT_URL = "/sessions";
  let cursor = 0;
  const scenes = manifest.scenes.map((s: any, i: number) => {
    const durationInFrames = Math.max(sceneDurations[i], FPS);
    const startFrame = cursor;
    const endFrame = cursor + durationInFrames;
    cursor = endFrame;

    // Convert absolute paths to URL paths: /home/nadim/.../sessions/slug/.../scene_000/image.png
    // → /sessions/slug/.../scene_000/image.png
    const imageUrl = s.imagePath
      ? s.imagePath.replace(/^\/home\/nadim\/projects\/reel-agent-toolkit\//, "/")
      : s.imagePath;
    const audioUrl = s.audioPath
      ? s.audioPath.replace(/^\/home\/nadim\/projects\/reel-agent-toolkit\//, "/")
      : s.audioPath;

    return {
      id: `scene-${i}`,
      imageSrc: imageUrl,
      audioSrc: audioUrl,
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

  // Bundle
  const BUNDLE_OUT = join(PROJECT_ROOT, "build");
  mkdirSync(BUNDLE_OUT, { recursive: true });
  console.log("[render] Bundling Remotion project...");
  const bundleLocation = await bundle(
    join(PROJECT_ROOT, "remotion", "RemotionRoot.tsx"),
    (p: number) => process.stdout.write(` ${Math.round(p * 100)}%`),
    { outDir: BUNDLE_OUT }
  );
  console.log(`\n[render] Bundle dir: ${bundleLocation}`);

  // Start static server
  console.log("[render] Starting server on port 3456...");
  const { server, baseUrl } = await startServer(3456, bundleLocation);
  console.log(`[render] Server URL: ${baseUrl}`);

  const gpuDevice = null; // FORCE software encoding — VAAPI causes hangs on this system
  console.log(`[render] GPU: ${gpuDevice || "software (libx264)"}`);

  try {
    const serveUrl = baseUrl;

    // Select composition
    console.log("[render] Fetching compositions...");
    const composition = await selectComposition({
      serveUrl,
      id: "Video",
      inputProps: renderProps,
    });
    console.log(`[render] Composition: ${composition.width}x${composition.height} @ ${FPS}fps, ${totalFrames} frames`);

    const framesDir = join("/tmp", `remotion-frames-${Date.now()}`);
    mkdirSync(framesDir, { recursive: true });
    console.log(`[render] Stage 1: Rendering frames to ${framesDir}...`);

    // Stage 1: render frames
    await renderFrames({
      composition,
      serveUrl,
      outputDir: framesDir,
      inputProps: renderProps,
      concurrency: 1,        // single-frame-at-a-time to minimize memory pressure
      onFrameUpdate: (frame: number) => {
        if (frame % 300 === 0) process.stdout.write(`\n  frame ${frame}/${totalFrames}`);
      },
      onStart: () => console.log("[render] Frame rendering started"),
    });
    console.log(`\n[render] Stage 1 complete: ${framesDir}`);

    // Stage 2: stitch with ffmpeg
    const outputPath = join(OUTPUT_DIR, `${VIDEO_TITLE}.mp4`);
    console.log(`[render] Stage 2: Stitching with ffmpeg...`);

    // Detect frame padding
    const frameFiles = (await import("node:fs")).readdirSync(framesDir)
      .filter(f => f.startsWith("element-") && f.endsWith(".jpeg")).sort();
    if (frameFiles.length === 0) {
      console.error("[render] FATAL: No frames rendered");
      process.exit(1);
    }
    const lastFrame = frameFiles[frameFiles.length - 1];
    const widthMatch = lastFrame.match(/element-(\d+)\.jpeg$/);
    const paddingWidth = widthMatch ? widthMatch[1].length : 4;
    const framePattern = join(framesDir, `element-%0${paddingWidth}d.jpeg`);
    console.log(`[render] Frame pattern: ${framePattern} (${frameFiles.length} frames)`);

    // Build concat list for audio — use manifest scenes directly by index
    const concatList = join("/tmp", `concat-${Date.now()}.txt`);
    const concatEntries: string[] = [];
    for (let i = 0; i < manifest.scenes.length; i++) {
      const audioPath = manifest.scenes[i]?.audioPath;
      if (audioPath && existsSync(audioPath)) {
        concatEntries.push(`file '${audioPath.replace(/'/g, "'\\''")}'`);
      }
    }

    const hasAudio = concatEntries.length > 0;
    const ffmpegArgs: string[] = ["-y", "-r", String(FPS), "-f", "image2", "-start_number", "0", "-i", framePattern];

    if (hasAudio) {
      (await import("node:fs")).writeFileSync(concatList, concatEntries.join("\n"));
      ffmpegArgs.push("-f", "concat", "-safe", "0", "-i", concatList);
    }

    if (gpuDevice) {
      ffmpegArgs.push(
        "-vaapi_device", gpuDevice,
        "-c:v", "h264_vaapi",
        "-vf", `format=nv12,hwupload`,
        "-pix_fmt", "yuv420p",
        "-b:v", "8M",
      );
    } else {
      ffmpegArgs.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-preset", "fast");
    }

    // -map flags after video codec, before output
    if (hasAudio) {
      ffmpegArgs.push("-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000");
    }

    // -movflags goes after all codec args but before output filename
    ffmpegArgs.push("-movflags", "+faststart", "-y", outputPath);

    console.log(`[render] Running ffmpeg...`);
    execSync(
      `/usr/bin/ffmpeg ${ffmpegArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`,
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    // Cleanup temp files
    execSync(`rm -rf ${framesDir} ${concatList}`, { stdio: "ignore" });

    if (existsSync(outputPath)) {
      const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(1);
      console.log(`[render] DONE: ${outputPath} (${sizeMB} MB)`);
    } else {
      console.error("[render] FATAL: ffmpeg failed to produce output");
      process.exit(1);
    }
  } finally {
    server.close();
    console.log("[render] Server stopped");
  }
}

main().catch((e: Error) => { console.error("[render] FATAL:", e); process.exit(1); });
