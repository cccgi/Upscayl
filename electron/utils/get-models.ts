import fs from "fs";
import logit from "./logit";
import { MessageBoxOptions, app, dialog } from "electron";
import settings from "electron-settings";
import { FEATURE_FLAGS } from "../../common/feature-flags";

const STANDARD_MODEL_DIRS = [
  "C:\\models\\upscale_models",
  "C:\\models\\SEEDVR2",
  "D:\\_krea2\\models\\SEEDVR2",
  "E:\\models\\upscale_models",
  "E:\\models\\SEEDVR2",
  "D:\\models\\upscale_models",
];

const VALID_EXTENSIONS = [
  ".pth",
  ".pt",
  ".safetensors",
  ".onnx",
  ".param",
  ".bin",
];

const scanDirectoryForModels = (dirPath: string, models: string[]) => {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const lower = file.toLowerCase();
      // Skip VAE, metadata, or hidden files
      if (lower.includes("vae") || lower.startsWith(".") || lower.includes("validation")) continue;

      const hasValidExt = VALID_EXTENSIONS.some((ext) => lower.endsWith(ext));
      if (hasValidExt) {
        const modelName = file.substring(0, file.lastIndexOf(".")) || file;
        if (!models.includes(modelName)) {
          models.push(modelName);
        }
      }
    }
  } catch (err) {
    logit(`⚠️ Error scanning directory ${dirPath}: `, err);
  }
};

const getModelPriority = (name: string): number => {
  const l = name.toLowerCase();
  if (l === "seedvr2_ema_3b_fp16") return 100;
  if (l.includes("seedvr2_ema_7b_fp16") || (l.includes("seedvr2_ema_7b") && !l.includes("sharp"))) return 95;
  if (l.includes("faceupdat")) return 90;
  if (l.includes("realwebphoto") || l.includes("dat2")) return 85;
  if (l.includes("seedvr2_ema_7b_sharp")) return 80;
  if (l.includes("seedvr2_ema_3b_fp8")) return 75;
  if (l.includes("seed")) return 70;
  if (l.includes("dat")) return 60;
  if (l.includes("ultrasharp")) return 50;
  if (l.includes("remacri")) return 45;
  if (l.includes("animesharp")) return 40;
  if (l.includes("nmkd")) return 30;
  if (l.includes("realesrgan")) return 20;
  return 10;
};

const getModels = async (folderPath: string | undefined) => {
  let models: string[] = [];

  // SECURITY SCOPED BOOKMARKS (macOS App Store)
  let closeAccess;
  const customModelsBookmarks = await settings.get("custom-models-bookmarks");
  if (FEATURE_FLAGS.APP_STORE_BUILD && customModelsBookmarks) {
    try {
      closeAccess = app.startAccessingSecurityScopedResource(
        customModelsBookmarks as string,
      );
    } catch (error) {
      logit("📁 Custom Models Bookmarks Error: ", error);
    }
  }

  // Scan user-selected folder if provided
  if (folderPath && fs.existsSync(folderPath)) {
    scanDirectoryForModels(folderPath, models);
  }

  // Always scan standard local AI model repositories
  for (const dir of STANDARD_MODEL_DIRS) {
    scanDirectoryForModels(dir, models);
  }

  // Deduplicate and sort by SOTA priority
  models = Array.from(new Set(models)).sort((a, b) => {
    const pA = getModelPriority(a);
    const pB = getModelPriority(b);
    if (pA !== pB) return pB - pA;
    return a.localeCompare(b);
  });

  if (models.length === 0 && folderPath) {
    logit("❌ No valid models detected in selected folder");
    const options: MessageBoxOptions = {
      type: "error",
      title: "No Models Found",
      message:
        "The selected folder does not contain supported model files (.pth, .safetensors, .pt, .onnx, .bin, .param).",
      buttons: ["OK"],
    };
    dialog.showMessageBoxSync(options);
    return null;
  }

  logit("🔎 Detected Models: ", models);
  return models;
};

export default getModels;
