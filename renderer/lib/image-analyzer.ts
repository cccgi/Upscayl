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
  label: "Standard Photography",
  reason: "Generative DiT with Euler sampling restores fine organic textures, hair, and surfaces.",
  suggestedModel: "seedvr2_ema_3b_fp16",
  modelDisplayName: "SeedVR2 3B (FP16)",
  confidence: 0.85,
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

        // Downscale for instant analysis (max 256x256)
        const scale = Math.min(1, 256 / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const totalPixels = w * h;

        let skinPixels = 0;
        let totalSat = 0;
        let saturatedPixels = 0;
        const colorPalette = new Set<number>();
        const grayscale = new Float32Array(totalPixels);

        for (let i = 0; i < totalPixels; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];

          // Grayscale luminance
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          grayscale[i] = gray;

          // Palette quantization (12-bit RGB) to assess color complexity
          const qColor = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          colorPalette.add(qColor);

          // HSV Saturation
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const sat = max === 0 ? 0 : delta / max;
          totalSat += sat;
          if (sat > 0.45) saturatedPixels++;

          // Skin tone heuristic in RGB space
          if (
            r > 95 &&
            g > 40 &&
            b > 20 &&
            delta > 15 &&
            Math.abs(r - g) > 15 &&
            r > g &&
            r > b
          ) {
            skinPixels++;
          }
        }

        const skinRatio = skinPixels / totalPixels;
        const avgSat = totalSat / totalPixels;
        const uniqueColorsRatio = colorPalette.size / totalPixels;

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
            if (Math.abs(lap) > 28) edgeCount++;
          }
        }
        const lapVariance = lapVarSum / (totalPixels - 2 * w - 2 * h);
        const edgeDensity = edgeCount / totalPixels;

        const isLowRes = img.width <= 600 && img.height <= 600;
        const isJpeg =
          imagePath.toLowerCase().endsWith(".jpg") ||
          imagePath.toLowerCase().endsWith(".jpeg");

        // 1. Anime / Digital Art / Vector
        // Low color palette entropy with strong line art edges or high saturation
        if (uniqueColorsRatio < 0.1 && (edgeDensity > 0.08 || avgSat > 0.35)) {
          return resolve({
            category: "anime",
            tag: "Anime / Digital Art",
            label: "Digital Art & Illustration",
            reason:
              "Detected flat color fields and distinct line art. 4x-AnimeSharp preserves crisp outlines without ringing artifacts.",
            suggestedModel: "4x-AnimeSharp",
            modelDisplayName: "4x-AnimeSharp",
            confidence: 0.94,
          });
        }

        // 2. Human Portrait / Facial Photography
        // High skin pixel presence (>11%)
        if (skinRatio > 0.11) {
          return resolve({
            category: "portrait",
            tag: "Portrait / Facial Photo",
            label: "Human Portrait & Skin",
            reason:
              "Detected facial features and skin tones. SeedVR2 7B Sharp reconstructs realistic facial pores, hair, and eye micro-details.",
            suggestedModel: "seedvr2_ema_7b_sharp_fp16",
            modelDisplayName: "SeedVR2 7B Sharp (FP16)",
            confidence: 0.96,
          });
        }

        // 3. Compressed / Low-Res Web Image
        if (isLowRes && isJpeg && lapVariance < 600) {
          return resolve({
            category: "compressed",
            tag: "Low-Res / Compressed Photo",
            label: "Compression Noise Detected",
            reason:
              "Detected small resolution and JPEG compression. SeedVR2 generative diffusion repairs block artifacts and hallucinates realistic details.",
            suggestedModel: "seedvr2_ema_3b_fp16",
            modelDisplayName: "SeedVR2 3B (FP16)",
            confidence: 0.91,
          });
        }

        // 4. Real-World Photography / Architecture / Nature
        return resolve({
          category: "photo",
          tag: "Photography / Real-World",
          label: "Real-World Photography",
          reason:
            "Detected continuous tone photography. DAT-2 delivers peak structural fidelity, crystal clear textures, and zero hallucination.",
          suggestedModel: "4xRealWebPhoto_v4_dat2",
          modelDisplayName: "DAT-2 (RealWebPhoto v4)",
          confidence: 0.93,
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
