import { join, dirname, resolve } from "path";
import { getPlatform } from "./get-device-specs";
import isDev from "electron-is-dev";
import { app } from "electron";
import fs from "fs";

/**
 * appRootDir is the resources directory inside the unpacked electron app temp directory.
 * resources contains app.asar file, that contains the main and renderer files.
 * We're putting resources/{os}/bin from project inside resources/bin of electron.
 * Same for the models directory as well.
 */
const appRootDir = app.getAppPath();

const binariesPath = isDev
  ? join(appRootDir, "resources", getPlatform()!, "bin")
  : join(dirname(appRootDir), "bin");

const execPath = resolve(join(binariesPath, `./upscayl-bin`));

const modelsPath = isDev
  ? resolve(join(appRootDir, "resources", "models"))
  : resolve(join(dirname(appRootDir), "models"));

const engineScriptPath = isDev
  ? resolve(join(appRootDir, "resources", "engine", "upscayl_engine.py"))
  : resolve(join(dirname(appRootDir), "engine", "upscayl_engine.py"));

const classifierScriptPath = isDev
  ? resolve(join(appRootDir, "resources", "engine", "classifier_service.py"))
  : resolve(join(dirname(appRootDir), "engine", "classifier_service.py"));

const candidatePythons = [
  process.env.UPSCAYL_PYTHON_PATH,
  "C:\\Users\\Admin\\.conda\\envs\\krea2\\python.exe",
  "python",
].filter(Boolean) as string[];

let pythonPath = "python";
for (const p of candidatePythons) {
  if (p === "python" || fs.existsSync(p)) {
    pythonPath = p;
    break;
  }
}

export { execPath, modelsPath, engineScriptPath, classifierScriptPath, pythonPath };
