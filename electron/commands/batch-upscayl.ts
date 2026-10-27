import fs from "fs";
import path from "path";
import { getMainWindow } from "../main-window";
import {
  childProcesses,
  savedCustomModelsPath,
  setStopped,
  stopped,
} from "../utils/config-variables";
import logit from "../utils/logit";
import { spawnUpscayl } from "../utils/spawn-upscayl";
import { getBatchArguments } from "../utils/get-arguments";
import slash from "../utils/slash";
import { modelsPath } from "../utils/get-resource-paths";
import { ELECTRON_COMMANDS } from "../../common/electron-commands";
import { BatchUpscaylPayload } from "../../common/types/types";
import showNotification from "../utils/show-notification";
import { MODELS } from "../../common/models-list";
import { copyMetadata } from "../utils/copy-metadata";

const batchUpscayl = async (event, payload: BatchUpscaylPayload) => {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;

  const tileSize = payload.tileSize;
  const compression = payload.compression;
  const ttaMode = payload.ttaMode;
  const scale = payload.scale;
  const useCustomWidth = payload.useCustomWidth;
  const customWidth = useCustomWidth ? payload.customWidth : "";
  const model = payload.model;
  const gpuId = payload.gpuId;
  const saveImageAs = payload.saveImageAs;
  // GET THE IMAGE DIRECTORY
  let inputDir = decodeURIComponent(payload.batchFolderPath);
  // GET THE OUTPUT DIRECTORY
  let outputFolderPath = decodeURIComponent(payload.outputPath);

  const isAdaptive =
    model === "auto" ||
    (payload.modelMapping && Object.keys(payload.modelMapping).length > 0);
  const folderModelTag = isAdaptive ? "adaptive" : model;

  const outputFolderName = `upscayl_${saveImageAs}_${folderModelTag}_${
    useCustomWidth ? `${customWidth}px` : `${scale}x`
  }`;
  outputFolderPath += slash + outputFolderName;
  // CREATE THE OUTPUT DIRECTORY
  if (!fs.existsSync(outputFolderPath)) {
    fs.mkdirSync(outputFolderPath, { recursive: true });
  }

  // Handle per-image model mapping for adaptive batch upscaling
  let modelMappingPath = "";
  if (payload.modelMapping && Object.keys(payload.modelMapping).length > 0) {
    modelMappingPath = path.join(outputFolderPath, ".model_mapping.json");
    try {
      fs.writeFileSync(
        modelMappingPath,
        JSON.stringify(payload.modelMapping, null, 2),
        "utf-8",
      );
      logit("✨ Adaptive batch model mapping written to:", modelMappingPath);
    } catch (e) {
      logit("⚠️ Failed to write model mapping file:", e);
    }
  }

  // Handle selected files filter
  let selectedFilesPath = "";
  if (payload.selectedFiles && payload.selectedFiles.length > 0) {
    selectedFilesPath = path.join(outputFolderPath, ".selected_files.json");
    try {
      fs.writeFileSync(
        selectedFilesPath,
        JSON.stringify(payload.selectedFiles, null, 2),
        "utf-8",
      );
      logit(
        `✨ Filtered batch of ${payload.selectedFiles.length} files written to:`,
        selectedFilesPath,
      );
    } catch (e) {
      logit("⚠️ Failed to write selected_files file:", e);
    }
  }

  const isDefaultModel = model in MODELS;

  // UPSCALE
  const upscayl = spawnUpscayl(
    getBatchArguments({
      inputDir,
      outputDir: outputFolderPath,
      modelsPath: isDefaultModel
        ? modelsPath
        : (savedCustomModelsPath ?? modelsPath),
      model,
      modelMappingPath,
      selectedFilesPath,
      gpuId,
      saveImageAs,
      scale,
      customWidth,
      compression,
      tileSize,
      ttaMode,
    }),
    logit,
  );

  childProcesses.push(upscayl);

  setStopped(false);
  let failed = false;
  let encounteredError = false;

  const proc = (upscayl as any).process || upscayl;

  const onData = (data: any) => {
    if (!mainWindow) return;
    const dataStr = data.toString();

    // Check for structured batch current image protocol
    const lines = dataStr.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.includes("BATCH_CURRENT_IMAGE:")) {
        const parts = trimmedLine.split("BATCH_CURRENT_IMAGE:")[1]?.trim().split("|");
        if (parts && parts.length >= 3) {
          mainWindow.webContents.send(ELECTRON_COMMANDS.BATCH_CURRENT_IMAGE, {
            currentImagePath: parts[0],
            currentIndex: parseInt(parts[1], 10),
            totalImages: parseInt(parts[2], 10),
          });
        }
      }
    }

    mainWindow.webContents.send(
      ELECTRON_COMMANDS.FOLDER_UPSCAYL_PROGRESS,
      dataStr,
    );
    if (
      dataStr.includes("Error") ||
      dataStr.includes("failed")
    ) {
      logit("❌ ", dataStr);
      encounteredError = true;
      onError(dataStr);
    } else if (dataStr.includes("Resizing")) {
      mainWindow.webContents.send(ELECTRON_COMMANDS.SCALING_AND_CONVERTING);
    }
  };

  const onError = (data: any) => {
    if (!mainWindow) return;
    mainWindow.setProgressBar(-1);
    mainWindow.webContents.send(
      ELECTRON_COMMANDS.FOLDER_UPSCAYL_PROGRESS,
      data.toString(),
    );
    failed = true;
    upscayl.kill();
    mainWindow &&
      mainWindow.webContents.send(
        ELECTRON_COMMANDS.UPSCAYL_ERROR,
        `Error upscaling images! ${data}`,
      );
    return;
  };

  const onClose = async () => {
    if (!mainWindow) return;
    if (!failed && !stopped) {
      logit("💯 Done upscaling");
      upscayl.kill();
      if (payload.copyMetadata) {
        logit("🏷️ Copying metadata...");
        try {
          const files = fs.readdirSync(outputFolderPath);
          for (const file of files) {
            const outFile = outputFolderPath + slash + file;
            const originalFile = inputDir + slash + file;
            if (fs.existsSync(outFile) && fs.existsSync(originalFile)) {
              try {
                await copyMetadata(inputDir, outFile);
                logit("✅ Metadata copied to: ", outFile);
              } catch (error) {
                logit("❌ Error copying metadata: ", error);
                mainWindow.webContents.send(
                  ELECTRON_COMMANDS.METADATA_ERROR,
                  error,
                );
              }
            }
          }
        } catch (err) {
          logit("❌ Error in batch metadata copy: ", err);
        }
      }
      mainWindow.webContents.send(
        ELECTRON_COMMANDS.FOLDER_UPSCAYL_DONE,
        outputFolderPath,
      );
      if (!encounteredError) {
        showNotification("Upscayled", "Images upscayled successfully!");
      } else {
        showNotification(
          "Upscayled",
          "Images were upscayled but encountered some errors!",
        );
      }
    } else {
      upscayl.kill();
    }
  };

  proc.stderr?.on("data", onData);
  proc.stdout?.on("data", onData);
  proc.on("error", onError);
  proc.on("close", onClose);
};

export default batchUpscayl;
