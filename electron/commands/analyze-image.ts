import { spawn, ChildProcess } from "child_process";
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

    // Run rapid batch classification through the daemon
    for (const f of files) {
      const fullPath = path.join(folderPath, f);
      try {
        const res = await analyzeImageFile(fullPath);
        items.push({
          path: fullPath,
          filename: f,
          category: res.category,
          label: res.label,
          tag: res.tag,
          suggestedModel: res.suggestedModel,
          modelDisplayName: res.modelDisplayName,
          confidence: res.confidence,
          reason: res.reason,
        });

        modelCounts[res.suggestedModel] =
          (modelCounts[res.suggestedModel] || 0) + 1;
        categoryCounts[res.category] =
          (categoryCounts[res.category] || 0) + 1;
      } catch (err) {
        logit(`⚠️ Error analyzing batch file ${f}:`, err);
      }
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
