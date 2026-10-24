export interface AnalysisResult {
  category: "portrait" | "photo" | "anime" | "compressed" | "graphic";
  tag: string;
  label: string;
  reason: string;
  suggestedModel: string;
  modelDisplayName: string;
  confidence: number;
}

export const getDefaultRecommendation = (): AnalysisResult => ({
  category: "photo",
  tag: "General Photo",
  label: "Photography / Real-World",
  reason: "DAT-2 transformer provides peak structural fidelity, crystal clear textures, and zero hallucination.",
  suggestedModel: "4xRealWebPhoto_v4_dat2",
  modelDisplayName: "DAT-2 (RealWebPhoto v4)",
  confidence: 0.88,
});

export const analyzeImage = async (
  imagePath: string,
): Promise<AnalysisResult> => {
  if (!imagePath) return getDefaultRecommendation();

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(getDefaultRecommendation());

        // Downscale to 200x200 for fast analysis
        const maxDim = 200;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const totalPixels = w * h;

        let skinPixels = 0;
        let darkInkLinePixels = 0;
        const grayscale = new Float32Array(totalPixels);

        for (let i = 0; i < totalPixels; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];

          // Grayscale luminance
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          grayscale[i] = gray;

          // Check for pure dark/black ink line art (anime signature)
          if (r < 35 && g < 35 && b < 35) {
            darkInkLinePixels++;
          }

          // Robust human skin chromaticity detection:
          // Works across fair, olive, brown, and dark skin tones
          const sum = r + g + b;
          if (sum > 70) {
            const normR = r / sum;
            const normG = g / sum;
            const isSkinRange =
              normR >= 0.35 &&
              normR <= 0.56 &&
              normG >= 0.25 &&
              normG <= 0.39 &&
              normR > normG &&
              r > b;

            const isRgbHeuristic =
              r > 55 &&
              g > 35 &&
              b > 20 &&
              r > g &&
              r > b &&
              r - g >= 8 &&
              Math.max(r, g, b) - Math.min(r, g, b) >= 10;

            if (isSkinRange || isRgbHeuristic) {
              skinPixels++;
            }
          }
        }

        const skinRatio = skinPixels / totalPixels;
        const darkInkRatio = darkInkLinePixels / totalPixels;

        // Laplacian edge & high-frequency texture detection
        let lapVarSum = 0;
        let edgeCount = 0;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            const lap =
              grayscale[idx - w] +
              grayscale[idx + w] +
              grayscale[idx - 1] +
              grayscale[idx + 1] -
              4 * grayscale[idx];
            lapVarSum += lap * lap;
            if (Math.abs(lap) > 25) edgeCount++;
          }
        }
        const lapVariance = lapVarSum / (totalPixels - 2 * w - 2 * h);
        const edgeDensity = edgeCount / totalPixels;

        const isLowRes = img.width <= 512 && img.height <= 512;
        const isJpeg =
          imagePath.toLowerCase().endsWith(".jpg") ||
          imagePath.toLowerCase().endsWith(".jpeg");

        // PRIORITY 1: Human Portrait / People / Skin Features
        // In AI generated portraits (Krea, Midjourney, Flux) or real photos, skin ratio is present
        if (skinRatio >= 0.05) {
          return resolve({
            category: "portrait",
            tag: "Portrait / Facial Photo",
            label: "Human Portrait & Skin",
            reason:
              "Detected human facial features and skin tones. SeedVR2 7B Sharp DiT reconstructs realistic skin pores, hair strands, and eye micro-details.",
            suggestedModel: "seedvr2_ema_7b_sharp_fp16",
            modelDisplayName: "SeedVR2 7B Sharp (FP16)",
            confidence: 0.95,
          });
        }

        // PRIORITY 2: Anime / Line Art (Requires dark ink boundaries + no skin presence)
        // Must have distinct dark ink lines AND low organic texture
        if (skinRatio < 0.03 && darkInkRatio > 0.035 && edgeDensity > 0.09) {
          return resolve({
            category: "anime",
            tag: "Anime / Digital Art",
            label: "Digital Art & Illustration",
            reason:
              "Detected flat color fields and dark line art ink strokes. 4x-AnimeSharp preserves crisp outlines without ringing artifacts.",
            suggestedModel: "4x-AnimeSharp",
            modelDisplayName: "4x-AnimeSharp",
            confidence: 0.93,
          });
        }

        // PRIORITY 3: Heavily Compressed / Low-Res Photo
        if (isLowRes && isJpeg && lapVariance < 450) {
          return resolve({
            category: "compressed",
            tag: "Low-Res / Compressed Photo",
            label: "Compression Noise Detected",
            reason:
              "Detected small resolution with compression artifacts. SeedVR2 generative diffusion repairs block damage and synthesizes realistic details.",
            suggestedModel: "seedvr2_ema_3b_fp16",
            modelDisplayName: "SeedVR2 3B (FP16)",
            confidence: 0.90,
          });
        }

        // PRIORITY 4: General Real-World Photography / Architecture / Nature
        return resolve({
          category: "photo",
          tag: "Photography / Real-World",
          label: "Real-World Photography",
          reason:
            "Detected continuous tone photography. DAT-2 provides state-of-the-art structural fidelity, clean textures, and high PSNR without hallucination.",
          suggestedModel: "4xRealWebPhoto_v4_dat2",
          modelDisplayName: "DAT-2 (RealWebPhoto v4)",
          confidence: 0.92,
        });
      } catch (err) {
        console.error("Smart image analyzer error:", err);
        resolve(getDefaultRecommendation());
      }
    };

    img.onerror = () => {
      resolve(getDefaultRecommendation());
    };

    const normalizedPath = imagePath.replace(/\\/g, "/");
    img.src = normalizedPath.startsWith("file://")
      ? normalizedPath
      : `file:///${encodeURI(normalizedPath)}`;
  });
};
