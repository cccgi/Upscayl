import { getMainWindow } from "../main-window";
import { childProcesses, setStopped } from "../utils/config-variables";
import logit from "../utils/logit";
import { exec } from "child_process";
import { ELECTRON_COMMANDS } from "../../common/electron-commands";

export const killProcessTree = (pid: number): Promise<void> => {
  return new Promise((resolve) => {
    if (!pid) return resolve();

    if (process.platform === "win32") {
      // Forcefully kill the entire process tree (/T = tree, /F = forceful)
      exec(`taskkill /PID ${pid} /T /F`, (err) => {
        if (err) {
          // Fallback to wmic if taskkill fails or needs alternate permissions
          exec(
            `wmic process where (ProcessId=${pid} or ParentProcessId=${pid}) call terminate`,
            () => resolve(),
          );
        } else {
          resolve();
        }
      });
    } else {
      try {
        process.kill(-pid, "SIGKILL");
      } catch (e) {
        try {
          process.kill(pid, "SIGKILL");
        } catch (_) {}
      }
      resolve();
    }
  });
};

const stop = async (event?: any, payload?: any) => {
  const mainWindow = getMainWindow();

  setStopped(true);

  if (mainWindow) {
    try {
      mainWindow.setProgressBar(-1);
      mainWindow.webContents.send(ELECTRON_COMMANDS.UPSCAYL_PROGRESS, "");
      mainWindow.webContents.send("upscayl-stopped");
    } catch (e) {
      logit("⚠️ Error resetting mainWindow progress on stop:", e);
    }
  }

  const procsToKill = [...childProcesses];
  childProcesses.length = 0;

  for (const child of procsToKill) {
    const proc = (child as any).process || child;
    const pid = proc?.pid;
    if (pid) {
      logit(`🛑 Terminating Upscaling Process Tree PID: ${pid}`);
      await killProcessTree(pid);
    }
    try {
      if (typeof proc?.kill === "function") {
        proc.kill("SIGKILL");
      }
    } catch (_) {}
  }

  logit("🛑 All Upscaling Processes Terminated and VRAM Released.");
};

export default stop;
