import { spawn, ChildProcess } from "child_process";
import { killProcessTree } from "./stop";
import { pythonPath, classifierScriptPath } from "../utils/get-resource-paths";
import logit from "../utils/logit";
import fs from "fs";
import path from "path";

export interface AnalysisResult {
  category: "portrait" | "photo" | "anime" | "compressed" | "graphic";
  tag: string;
  label: string;
  reason: string;
  suggestedModel: string;
  modelDisplayName: string;
  confidence: number;
  width?: number;
  height?: number;
  resolution?: string;
}

export interface BatchAnalysisItem {
  path: string;
  filename: string;
  category: "portrait" | "photo" | "anime" | "compressed" | "graphic";
  label: string;
  tag: string;
  suggestedModel: string;
  modelDisplayName: string;
  confidence: number;
  reason: string;
  width?: number;
  height?: number;
  resolution?: string;
}

export function getImageDimensionsFast(filePath: string): { width: number; height: number } | null {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(4096);
    fs.readSync(fd, buffer, 0, 4096, 0);
    fs.closeSync(fd);

    if (buffer.length >= 24 && buffer.toString("ascii", 12, 16) === "IHDR") {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) { offset++; continue; }
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    }
    if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      if (buffer.toString("ascii", 12, 16) === "VP8X" && buffer.length >= 30) {
        return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
      }
      if (buffer.toString("ascii", 12, 16) === "VP8 " && buffer.length >= 30) {
        return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      }
      if (buffer.toString("ascii", 12, 16) === "VP8L" && buffer.length >= 25) {
        const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
        return {
          width: 1 + (((b2 & 0x3f) << 8) | b1),
          height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
        };
      }
    }
    if (buffer.toString("ascii", 0, 2) === "BM" && buffer.length >= 26) {
      return { width: Math.abs(buffer.readInt32LE(18)), height: Math.abs(buffer.readInt32LE(22)) };
    }
  } catch (_) {}
  return null;
}

export interface BatchAnalysisReport {
  folderPath: string;
  totalImages: number;
  isMixed: boolean;
  dominantModel: string;
  dominantCategory: string;
  dominantCount: number;
  summaryMessage: string;
  items: BatchAnalysisItem[];
  modelCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
}

const defaultResult: AnalysisResult = {
  category: "photo",
  tag: "General Photo",
  label: "Photography / Real-World",
  reason: "DAT-2 transformer provides peak structural fidelity and crystal clear textures.",
  suggestedModel: "4xRealWebPhoto_v4_dat2",
  modelDisplayName: "DAT-2 (RealWebPhoto v4)",
  confidence: 0.85,
};

let daemonProcess: ChildProcess | null = null;
let reqCounter = 0;
const pendingRequests = new Map<number, (res: AnalysisResult) => void>();
let daemonStdoutBuffer = "";

function startDaemon() {
  if (daemonProcess && !daemonProcess.killed) return;
  if (!fs.existsSync(classifierScriptPath)) {
    logit("⚠️ Classifier script not found at:", classifierScriptPath);
    return;
  }

  try {
    logit("🧠 Starting Upscayl Vision AI Classifier Daemon...");
    daemonProcess = spawn(pythonPath, [classifierScriptPath, "--daemon"], {
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    daemonProcess.stdout?.setEncoding("utf-8");
    daemonProcess.stdout?.on("data", (chunk: string) => {
      daemonStdoutBuffer += chunk;
      const lines = daemonStdoutBuffer.split("\n");
      daemonStdoutBuffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "[DAEMON_READY]") continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed.id === "number") {
            const cb = pendingRequests.get(parsed.id);
            if (cb) {
              pendingRequests.delete(parsed.id);
              cb(parsed);
            }
          }
        } catch (e) {
          // ignore non-json log lines
        }
      }
    });

    daemonProcess.stderr?.setEncoding("utf-8");
    daemonProcess.stderr?.on("data", (chunk: string) => {
      // debug logging if needed
    });

    daemonProcess.on("exit", (code) => {
      logit(`🧠 Classifier daemon exited with code ${code}`);
      daemonProcess = null;
    });
  } catch (err) {
    logit("🚨 Failed to spawn classifier daemon:", err);
    daemonProcess = null;
  }
}

export function stopClassifierDaemon() {
  if (daemonProcess) {
    try {
      const pid = daemonProcess.pid;
      if (pid) {
        killProcessTree(pid);
      }
      daemonProcess.kill("SIGKILL");
    } catch (_) {}
    daemonProcess = null;
  }
}

// Start daemon lazily on first call or module load
setTimeout(() => {
  startDaemon();
}, 1000);

export async function analyzeImageFile(imagePath: string): Promise<AnalysisResult> {
  if (!imagePath || !fs.existsSync(imagePath)) {
    return defaultResult;
  }

  // Try daemon if alive
  if (daemonProcess && !daemonProcess.killed && daemonProcess.stdin?.writable) {
    const id = ++reqCounter;
    return new Promise<AnalysisResult>((resolve) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        // Fallback to one-shot if daemon timed out
        runSingleShot(imagePath).then(resolve);
      }, 5000);

      pendingRequests.set(id, (res) => {
        clearTimeout(timer);
        resolve(res);
      });

      try {
        daemonProcess!.stdin!.write(JSON.stringify({ id, path: imagePath }) + "\n");
      } catch (err) {
        clearTimeout(timer);
        pendingRequests.delete(id);
        runSingleShot(imagePath).then(resolve);
      }
    });
  }

  return await runSingleShot(imagePath);
}

function runSingleShot(imagePath: string): Promise<AnalysisResult> {
  return new Promise((resolve) => {
    if (!fs.existsSync(classifierScriptPath)) {
      return resolve(defaultResult);
    }

    try {
      const child = spawn(
        pythonPath,
        [classifierScriptPath, "--image", imagePath],
        {
          env: {
            ...process.env,
            PYTHONIOENCODING: "utf-8",
            PYTHONUTF8: "1",
          },
        }
      );

      let stdout = "";
      child.stdout?.setEncoding("utf-8");
      child.stdout?.on("data", (data) => {
        stdout += data;
      });

      child.on("close", (code) => {
        if (code === 0 && stdout) {
          try {
            // Find JSON portion
            const firstBrace = stdout.indexOf("{");
            const lastBrace = stdout.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
              const parsed = JSON.parse(stdout.slice(firstBrace, lastBrace + 1));
              return resolve(parsed);
            }
          } catch (e) {
            logit("🚨 Classifier parse error:", e);
          }
        }
        resolve(defaultResult);
      });

      child.on("error", (err) => {
        logit("🚨 Classifier process error:", err);
        resolve(defaultResult);
      });
    } catch (err) {
      resolve(defaultResult);
    }
  });
}

export async function analyzeBatchFolder(
  folderPath: string,
): Promise<BatchAnalysisReport> {
  const emptyReport: BatchAnalysisReport = {
    folderPath,
    totalImages: 0,
    isMixed: false,
    dominantModel: "4xRealWebPhoto_v4_dat2",
    dominantCategory: "photo",
    dominantCount: 0,
    summaryMessage: "No valid images detected in folder.",
    items: [],
    modelCounts: {},
    categoryCounts: {},
  };

  if (!folderPath || !fs.existsSync(folderPath)) {
    return emptyReport;
  }

  try {
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      return emptyReport;
    }

    const VALID_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => VALID_EXTS.has(path.extname(f).toLowerCase()))
      .sort();

    if (files.length === 0) {
      return emptyReport;
    }

    const items: BatchAnalysisItem[] = [];
    const modelCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    // Run parallel batch classification through the daemon
    const results = await Promise.all(
      files.map(async (f) => {
        const fullPath = path.join(folderPath, f);
        const dims = getImageDimensionsFast(fullPath);
        const resolution = dims ? `${dims.width} x ${dims.height}` : undefined;

        try {
          const res = await analyzeImageFile(fullPath);
          return {
            path: fullPath,
            filename: f,
            category: res.category,
            label: res.label,
            tag: res.tag,
            suggestedModel: res.suggestedModel,
            modelDisplayName: res.modelDisplayName,
            confidence: res.confidence,
            reason: res.reason,
            width: dims?.width || res.width,
            height: dims?.height || res.height,
            resolution: resolution || res.resolution,
          };
        } catch (err) {
          logit(`⚠️ Error analyzing batch file ${f}:`, err);
          return {
            path: fullPath,
            filename: f,
            category: "photo" as const,
            label: "Photography / Real-World",
            tag: "General Photo",
            suggestedModel: "4xRealWebPhoto_v4_dat2",
            modelDisplayName: "DAT-2 (RealWebPhoto v4)",
            confidence: 0.85,
            reason: "Default recommendation",
            width: dims?.width,
            height: dims?.height,
            resolution,
          };
        }
      })
    );

    for (const item of results) {
      items.push(item);
      modelCounts[item.suggestedModel] =
        (modelCounts[item.suggestedModel] || 0) + 1;
      categoryCounts[item.category] =
        (categoryCounts[item.category] || 0) + 1;
    }

    const sortedModels = Object.entries(modelCounts).sort(
      (a, b) => b[1] - a[1],
    );
    const dominantModel = sortedModels[0]?.[0] || "4xRealWebPhoto_v4_dat2";
    const dominantCount = sortedModels[0]?.[1] || 0;

    const sortedCats = Object.entries(categoryCounts).sort(
      (a, b) => b[1] - a[1],
    );
    const dominantCategory = sortedCats[0]?.[0] || "photo";

    // Mixed if more than 1 distinct model is recommended across images
    const isMixed = items.length > 1 && sortedModels.length > 1;

    let summaryMessage = "";
    if (!isMixed) {
      summaryMessage = `✨ Uniform Content: All ${items.length} images detected as ${items[0]?.tag || dominantCategory}. Recommended model: ${dominantModel}.`;
    } else {
      const parts = sortedCats.map(([cat, count]) => {
        const catName =
          cat === "portrait"
            ? "Portraits"
            : cat === "anime"
            ? "Anime Art"
            : cat === "graphic"
            ? "UI/Diagrams"
            : "Photos";
        return `${count} ${catName}`;
      });
      summaryMessage = `⚡ Mixed Content Detected (${items.length} files: ${parts.join(", ")}). Adaptive per-image models available.`;
    }

    return {
      folderPath,
      totalImages: items.length,
      isMixed,
      dominantModel,
      dominantCategory,
      dominantCount,
      summaryMessage,
      items,
      modelCounts,
      categoryCounts,
    };
  } catch (err) {
    logit("🚨 Batch folder analysis error:", err);
    return emptyReport;
  }
}
