import { app, dialog } from "electron";
import fs from "fs";
import path from "path";
import {
  savedBatchUpscaylFolderPath,
  setSavedBatchUpscaylFolderPath,
  savedImagePath,
} from "../utils/config-variables";
import logit from "../utils/logit";
import settings from "electron-settings";
import { FEATURE_FLAGS } from "../../common/feature-flags";

interface SelectFolderOptions {
  mode?: "directory" | "images" | "batchInput" | "output";
}

const selectFolder = async (event, options?: SelectFolderOptions | string) => {
  let closeAccess;
  const folderBookmarks = await settings.get("folder-bookmarks");
  if (FEATURE_FLAGS.APP_STORE_BUILD && folderBookmarks) {
    logit("🚨 Folder Bookmarks: ", folderBookmarks);
    try {
      closeAccess = app.startAccessingSecurityScopedResource(
        folderBookmarks as string,
      );
    } catch (error) {
      logit("📁 Folder Bookmarks Error: ", error);
    }
  }

  const isImagesMode = typeof options === "object" && options?.mode === "images";
  const isOutputMode = typeof options === "object" && options?.mode === "output";

  // Use openDirectory for standard folder picking so users can select directories naturally on Windows
  const dialogProperties: Array<"openFile" | "openDirectory" | "multiSelections"> = isImagesMode
    ? ["openFile", "multiSelections"]
    : ["openDirectory"];

  const dialogFilters = isImagesMode
    ? [
        {
          name: "Images",
          extensions: [
            "png", "jpg", "jpeg", "jfif", "webp", "bmp",
            "PNG", "JPG", "JPEG", "JFIF", "WEBP", "BMP",
          ],
        },
        { name: "All Files", extensions: ["*"] },
      ]
    : undefined;

  const defaultDir =
    savedBatchUpscaylFolderPath ||
    (savedImagePath ? path.dirname(savedImagePath) : undefined);

  const { canceled, filePaths, bookmarks } = await dialog.showOpenDialog({
    properties: dialogProperties,
    defaultPath: defaultDir,
    securityScopedBookmarks: true,
    title: isOutputMode
      ? "Select Output Folder"
      : isImagesMode
      ? "Select Images for Batch Upscale"
      : "Select Folder for Batch Upscale",
    message: isOutputMode
      ? "Select output folder for upscaled images"
      : "Select the folder containing images to batch upscale",
    filters: dialogFilters,
  });

  if (FEATURE_FLAGS.APP_STORE_BUILD && bookmarks && bookmarks.length > 0) {
    console.log("🚨 Setting folder Bookmark: ", bookmarks);
    await settings.set("folder-bookmarks", bookmarks[0]);
  }

  if (canceled || !filePaths || filePaths.length === 0) {
    logit("🚫 Select Folder Operation Cancelled");
    return null;
  } else {
    const chosenPath = filePaths[0];
    const isDir = fs.existsSync(chosenPath) && fs.statSync(chosenPath).isDirectory();
    const folder = isDir ? chosenPath : path.dirname(chosenPath);
    setSavedBatchUpscaylFolderPath(folder);
    logit("📁 Selected Folder Path: ", folder);

    if (isImagesMode && filePaths.length > 0) {
      return {
        folder,
        selectedFiles: filePaths.map((f) => path.basename(f)),
      };
    }

    return folder;
  }
};

export default selectFolder;
