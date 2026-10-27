import log from "electron-log";
import { getMainWindow } from "../main-window";
import { ELECTRON_COMMANDS } from "../../common/electron-commands";

const logit = (...args: any) => {
  try {
    log.log(...args);
    const mainWindow = getMainWindow();
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      !mainWindow.webContents ||
      mainWindow.webContents.isDestroyed()
    ) {
      return;
    }
    mainWindow.webContents.send(ELECTRON_COMMANDS.LOG, args.join(" "));
  } catch (_) {
    // Window is closing or destroyed; ignore IPC send failures safely
  }
};

export default logit;
