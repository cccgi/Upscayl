import { ImageFormat } from "@electron/types/types";

export interface BatchAnalysisItem {
  path: string;
  filename: string;
  category: "portrait" | "photo" | "anime" | "compressed" | "graphic";
  label: string;
  tag: string;
  suggestedModel: string;
  modelDisplayName: string;
  confidence: number;
  reason: string;
}

export interface BatchAnalysisReport {
  folderPath: string;
  totalImages: number;
  isMixed: boolean;
  dominantModel: string;
  dominantCategory: string;
  dominantCount: number;
  summaryMessage: string;
  items: BatchAnalysisItem[];
  modelCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
}

export type ImageUpscaylPayload = {
  imagePath: string;
  outputPath: string;
  scale: string;
  model: string;
  gpuId: string;
  saveImageAs: ImageFormat;
  overwrite: boolean;
  compression: string;
  noImageProcessing: boolean;
  customWidth: string;
  useCustomWidth: boolean;
  tileSize: number;
  ttaMode: boolean;
  copyMetadata: boolean;
};

export type DoubleUpscaylPayload = {
  model: string;
  /**
   * The path to the image to upscale.
   */
  imagePath: string;
  outputPath: string;
  scale: string;
  gpuId: string;
  saveImageAs: ImageFormat;
  compression: string;
  noImageProcessing: boolean;
  customWidth: string;
  useCustomWidth: boolean;
  tileSize: number;
  ttaMode: boolean;
  copyMetadata: boolean;
};

export type BatchUpscaylPayload = {
  batchFolderPath: string;
  outputPath: string;
  model: string;
  modelMapping?: Record<string, string>;
  gpuId: string;
  saveImageAs: ImageFormat;
  scale: string;
  compression: string;
  noImageProcessing: boolean;
  customWidth: string;
  useCustomWidth: boolean;
  tileSize: number;
  ttaMode: boolean;
  copyMetadata: boolean;
};
