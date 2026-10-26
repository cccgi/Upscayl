import { BatchAnalysisReport } from "@common/types/types";

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

  // Primary: Ultra-precise Vision AI in Electron backend (Ultralytics YOLOv8 Face + OpenAI CLIP ViT-B/32)
  if (typeof window !== "undefined" && (window as any).electron?.invoke) {
    try {
      const result = await (window as any).electron.invoke("analyze-image", imagePath);
      if (result && result.suggestedModel) {
        return result;
      }
    } catch (err) {
      console.warn("Backend AI classifier invoke failed, falling back to heuristic:", err);
    }
  }

  // Fallback for non-Electron test environments
  return getDefaultRecommendation();
};

export const analyzeBatchFolder = async (
  folderPath: string,
): Promise<BatchAnalysisReport | null> => {
  if (!folderPath) return null;

  if (typeof window !== "undefined" && (window as any).electron?.invoke) {
    try {
      const report: BatchAnalysisReport = await (window as any).electron.invoke(
        "analyze-batch-folder",
        folderPath,
      );
      if (report && report.totalImages > 0) {
        return report;
      }
    } catch (err) {
      console.warn("Backend analyze-batch-folder invoke failed:", err);
    }
  }

  return null;
};
