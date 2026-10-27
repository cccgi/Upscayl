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
  mode?: "batchInput" | "output";
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

  const isOutputMode = typeof options === "object" && options?.mode === "output";

  // For batch upscale input, open a dialog that displays thumbnails and image files
  // matching selectFile for consistency, while allowing the user to select the folder or images inside it.
  const dialogProperties: Array<"openFile" | "openDirectory" | "multiSelections"> = isOutputMode
    ? ["openDirectory"]
    : ["openFile", "multiSelections"];

  const dialogFilters = isOutputMode
    ? undefined
    : [
        {
          name: "Images in Folder (*.png, *.jpg, *.webp)",
          extensions: [
            "png",
            "jpg",
            "jpeg",
            "jfif",
            "webp",
            "bmp",
            "PNG",
            "JPG",
            "JPEG",
            "JFIF",
            "WEBP",
            "BMP",
          ],
        },
        { name: "All Files", extensions: ["*"] },
      ];

  const defaultDir = savedBatchUpscaylFolderPath || (savedImagePath ? path.dirname(savedImagePath) : undefined);

  const {
    canceled,
    filePaths,
    bookmarks,
  } = await dialog.showOpenDialog({
    properties: dialogProperties,
    defaultPath: defaultDir,
    securityScopedBookmarks: true,
    title: isOutputMode ? "Select Output Folder" : "Select Batch Folder (or choose images inside)",
    message: isOutputMode
      ? "Select output folder for upscaled images"
      : "Select any image in the folder to choose that folder for batch upscale",
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

    return {
      folder,
      selectedFiles: filePaths.map((f) => path.basename(f)),
    };
  }
};

export default selectFolder;
