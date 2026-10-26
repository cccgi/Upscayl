import { ImageFormat } from "@/lib/valid-formats";
import { ModelId } from "@common/models-list";
import { BatchAnalysisReport } from "@common/types/types";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const customModelsPathAtom = atomWithStorage<string | null>(
  "customModelsPath",
  null,
);

export const selectedModelIdAtom = atomWithStorage<ModelId | string>(
  "selectedModelId",
  "seedvr2_ema_3b_fp16",
);

export const autoSelectModelAtom = atomWithStorage<boolean>(
  "autoSelectModel",
  true,
);

export const doubleUpscaylAtom = atomWithStorage("doubleUpscayl", false);
export const gpuIdAtom = atomWithStorage("gpuId", "");
export const saveImageAsAtom = atomWithStorage<ImageFormat>(
  "saveImageAs",
  "png",
);

export const scaleAtom = atomWithStorage<string>("scale", "4");

export const batchModeAtom = atom<boolean>(false);
export const batchReportAtom = atom(null as BatchAnalysisReport | null);
export const batchScanningAtom = atom<boolean>(false);
export const useAdaptiveBatchAtom = atomWithStorage<boolean>("useAdaptiveBatch", true);
export const batchModelMappingAtom = atom({} as Record<string, string>);
export const batchSelectedFilesAtom = atom<string[]>([]);

/**
 * The path to the last folder the user saved an image to.
 * Reset to "" if rememberOutputFolder is false.
 */
export const savedOutputPathAtom = atomWithStorage<string | null>(
  "savedOutputPath",
  null,
);

export const progressAtom = atom<string>("");

export interface ProgressInfo {
  percent: number;
  phaseName: string;
  phaseDesc: string;
  phaseIndex: number;
  totalPhases: number;
  detailMessage: string;
  startTime: number;
}

export const initialProgressInfo: ProgressInfo = {
  percent: 0,
  phaseName: "Initializing Engine",
  phaseDesc: "Preparing neural network & tensor buffers",
  phaseIndex: 1,
  totalPhases: 4,
  detailMessage: "Starting super-resolution engine...",
  startTime: 0,
};

export const progressInfoAtom = atom<ProgressInfo>(initialProgressInfo);

export const rememberOutputFolderAtom = atomWithStorage<boolean>(
  "rememberOutputFolder",
  false,
);

export const dontShowCloudModalAtom = atomWithStorage<boolean>(
  "dontShowCloudModal",
  false,
);

export const noImageProcessingAtom = atomWithStorage<boolean>(
  "noImageProcessing",
  false,
);

export const compressionAtom = atomWithStorage<number>("compression", 0);

export const overwriteAtom = atomWithStorage("overwrite", false);

export const turnOffNotificationsAtom = atomWithStorage(
  "turnOffNotifications",
  false,
);

export const ttaModeAtom = atomWithStorage("ttaMode", false);

export const viewTypeAtom = atomWithStorage<"slider" | "lens">(
  "viewType",
  "slider",
);

export const lensSizeAtom = atomWithStorage<number>("lensSize", 100);

export const customWidthAtom = atomWithStorage<number>("customWidth", 0);

export const useCustomWidthAtom = atomWithStorage<boolean>(
  "useCustomWidth",
  false,
);

export const tileSizeAtom = atomWithStorage<number | null>("tileSize", null);

// CLIENT SIDE ONLY
export const showSidebarAtom = atomWithStorage("showSidebar", true);

export const autoUpdateAtom = atomWithStorage("autoUpdate", true);

export const enableContributionAtom = atomWithStorage(
  "enableContribution",
  true,
);

export const userStatsAtom = atomWithStorage("userStats", {
  totalUpscayls: 0,
  doubleUpscayls: 0,
  batchUpscayls: 0,
  imageUpscayls: 0,
  averageUpscaylTime: 0,
  lastUpscaylDuration: 0,
  lastUsedAt: 0,
});

export const copyMetadataAtom = atomWithStorage<boolean>(
  "copyMetadata",
  false,
);
