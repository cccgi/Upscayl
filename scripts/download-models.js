/**
 * Upscayl Model Downloader
 * Fetches default models for users who freshly clone the repository.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const MODELS_DIR = path.resolve(__dirname, "..", "resources", "models");

const DEFAULT_MODELS = [
  {
    name: "ultrasharp-4x.bin",
    url: "https://github.com/upscayl/custom-models/raw/main/models/ultrasharp-4x.bin",
  },
  {
    name: "ultrasharp-4x.param",
    url: "https://github.com/upscayl/custom-models/raw/main/models/ultrasharp-4x.param",
  },
  {
    name: "remacri-4x.bin",
    url: "https://github.com/upscayl/custom-models/raw/main/models/remacri-4x.bin",
  },
  {
    name: "remacri-4x.param",
    url: "https://github.com/upscayl/custom-models/raw/main/models/remacri-4x.param",
  },
  {
    name: "digital-art-4x.bin",
    url: "https://github.com/upscayl/custom-models/raw/main/models/digital-art-4x.bin",
  },
  {
    name: "digital-art-4x.param",
    url: "https://github.com/upscayl/custom-models/raw/main/models/digital-art-4x.param",
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`✓ Already exists: ${path.basename(dest)}`);
      return resolve();
    }

    console.log(`⬇️ Downloading ${path.basename(dest)}...`);
    const file = fs.createWriteStream(dest);

    const request = (targetUrl) => {
      https.get(targetUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            console.log(`✓ Downloaded ${path.basename(dest)}`);
            resolve();
          });
        });
      }).on("error", (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    };

    request(url);
  });
}

async function main() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  console.log("🚀 Checking and fetching default Upscayl models...");
  for (const model of DEFAULT_MODELS) {
    try {
      await downloadFile(model.url, path.join(MODELS_DIR, model.name));
    } catch (err) {
      console.warn(`⚠️ Warning: Could not fetch ${model.name}: ${err.message}`);
    }
  }
  console.log("✨ Model setup check complete!");
}

main().catch(console.error);
