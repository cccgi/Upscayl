import { spawn } from "child_process";
import { execPath, engineScriptPath, pythonPath } from "./get-resource-paths";
import fs from "fs";

export const spawnUpscayl = (
  command: string[],
  logit: (...args: any) => void,
) => {
  const filteredCommand = command.filter((arg) => arg !== "");
  logit("📢 Upscayl Command: ", filteredCommand);

  // Check if model requested is a modern model or legacy ncnn
  const nIndex = filteredCommand.indexOf("-n");
  const modelName = nIndex !== -1 ? filteredCommand[nIndex + 1] : "";
  const isSeedVR =
    modelName.toLowerCase().includes("seedvr") ||
    modelName.toLowerCase().includes("seed");

  const isPyTorchOrModern =
    isSeedVR ||
    modelName.endsWith(".pth") ||
    modelName.endsWith(".safetensors") ||
    modelName.endsWith(".pt") ||
    modelName.toLowerCase().includes("dat") ||
    !fs.existsSync(execPath);

  let spawnedProcess;
  if (isPyTorchOrModern && fs.existsSync(engineScriptPath)) {
    logit(`🚀 Spawning Modern Upscayl Engine with Python: ${pythonPath}`);
    spawnedProcess = spawn(
      pythonPath,
      [engineScriptPath, ...filteredCommand],
      {
        cwd: undefined,
        detached: false,
        env: {
          ...process.env,
          PYTHONUTF8: "1",
          PYTHONIOENCODING: "utf-8",
        },
      },
    );
  } else {
    logit(`⚙️ Spawning Legacy NCNN Binary: ${execPath}`);
    spawnedProcess = spawn(execPath, filteredCommand, {
      cwd: undefined,
      detached: false,
    });
  }

  return {
    process: spawnedProcess,
    kill: () => spawnedProcess.kill(),
  };
};
