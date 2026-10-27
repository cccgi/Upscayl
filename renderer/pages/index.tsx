"use client";
import { useState, useEffect } from "react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { useAtomValue, useSetAtom } from "jotai";
import { customModelIdsAtom } from "../atoms/models-list-atom";
import {
  batchModeAtom,
  savedOutputPathAtom,
  progressAtom,
  progressInfoAtom,
  initialProgressInfo,
  rememberOutputFolderAtom,
  userStatsAtom,
  batchCurrentProcessingAtom,
  batchSelectedFilesAtom,
} from "../atoms/user-settings-atom";
import useLogger from "../components/hooks/use-logger";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import UpscaylSVGLogo from "@/components/icons/upscayl-logo-svg";
import { translationAtom } from "@/atoms/translations-atom";
import Sidebar from "@/components/sidebar";
import MainContent from "@/components/main-content";
import getDirectoryFromPath from "@common/get-directory-from-path";
import { FEATURE_FLAGS } from "@common/feature-flags";
import { ImageFormat, VALID_IMAGE_FORMATS } from "@/lib/valid-formats";
import { initCustomModels } from "@/components/hooks/use-custom-models";
import { OnboardingDialog } from "@/components/main-content/onboarding-dialog";
import useSystemInfo from "@/components/hooks/use-system-info";

const Home = () => {
  const t = useAtomValue(translationAtom);
  const logit = useLogger();
  const { toast } = useToast();
  const { systemInfo } = useSystemInfo();

  initCustomModels();

  const [isLoading, setIsLoading] = useState(true);
  const [imagePath, setImagePath] = useState("");
  const [upscaledImagePath, setUpscaledImagePath] = useState("");
  const [dimensions, setDimensions] = useState({
    width: null,
    height: null,
  });
  const setOutputPath = useSetAtom(savedOutputPathAtom);
  const rememberOutputFolder = useAtomValue(rememberOutputFolderAtom);
  const batchMode = useAtomValue(batchModeAtom);
  const [batchFolderPath, setBatchFolderPath] = useState("");
  const [upscaledBatchFolderPath, setUpscaledBatchFolderPath] = useState("");
  const setProgress = useSetAtom(progressAtom);
  const setProgressInfo = useSetAtom(progressInfoAtom);
  const setBatchCurrentProcessing = useSetAtom(batchCurrentProcessingAtom);
  const setBatchSelectedFiles = useSetAtom(batchSelectedFilesAtom);
  const [doubleUpscaylCounter, setDoubleUpscaylCounter] = useState(0);
  const setModelIds = useSetAtom(customModelIdsAtom);
  const setUserStats = useSetAtom(userStatsAtom);

  const selectImageHandler = async () => {
    resetImagePaths();
    const path = await window.electron.invoke(ELECTRON_COMMANDS.SELECT_FILE);
    if (path === null) return;
    logit("🖼 Selected Image Path: ", path);
    setImagePath(path);
    const dirname = getDirectoryFromPath(path);
    logit("📁 Selected Image Directory: ", dirname);
    if (!FEATURE_FLAGS.APP_STORE_BUILD) {
      if (!rememberOutputFolder) {
        setOutputPath(dirname);
      }
    }
    validateImagePath(path);
  };

  const selectFolderHandler = async () => {
    const result = await window.electron.invoke(ELECTRON_COMMANDS.SELECT_FOLDER);
    if (result !== null) {
      const folderPath = typeof result === "string" ? result : result?.folder;
      logit("🖼 Selected Folder Path: ", folderPath);
      setBatchFolderPath(folderPath);
      if (!rememberOutputFolder) {
        setOutputPath(folderPath);
      }
      if (typeof result === "object" && result?.selectedFiles && result.selectedFiles.length > 1) {
        setBatchSelectedFiles(result.selectedFiles);
      }
    } else {
      logit("🚫 Folder selection cancelled");
    }
  };

  const validateImagePath = (path: string) => {
    if (path.length > 0) {
      logit("🖼 imagePath: ", path);
      const extension = path.split(".").pop().toLowerCase() as ImageFormat;
      logit("🔤 Extension: ", extension);
      if (!VALID_IMAGE_FORMATS.includes(extension)) {
        toast({
          title: t("ERRORS.INVALID_IMAGE_ERROR.TITLE"),
          description: t("ERRORS.INVALID_IMAGE_ERROR.DESCRIPTION"),
        });
        resetImagePaths();
      }
    } else {
      resetImagePaths();
    }
  };

  // Helper to parse detailed engine progress
  const processProgressData = (data: string) => {
    if (!data) return;
    const trimmed = data.trim();

    setProgressInfo((prev) => {
      const next = { ...prev };
      if (!next.startTime) {
        next.startTime = Date.now();
      }

      // Percentage extraction (e.g. "25.00%", "50%")
      const pctMatch = trimmed.match(/(\d+(?:\.\d+)?)%/);
      if (pctMatch) {
        const val = parseFloat(pctMatch[1]);
        next.percent = Math.min(100, Math.max(0, val));
        setProgress(`${val.toFixed(1)}%`);
      }

      // Phase identification
      if (
        trimmed.includes("Phase 1:") ||
        trimmed.toLowerCase().includes("vae encode") ||
        trimmed.toLowerCase().includes("encoding")
      ) {
        next.phaseIndex = 1;
        next.phaseName = "Phase 1/4: Latent Encoding";
        next.phaseDesc = "Mapping image pixels into deep latent tensor space";
        next.detailMessage = trimmed;
      } else if (
        trimmed.includes("Phase 2:") ||
        trimmed.toLowerCase().includes("dit") ||
        trimmed.toLowerCase().includes("diffusion")
      ) {
        next.phaseIndex = 2;
        next.phaseName = "Phase 2/4: DiT Diffusion Super-Resolution";
        next.phaseDesc = "Synthesizing fine facial features, micro-pores & textures";
        next.detailMessage = trimmed;
      } else if (
        trimmed.includes("Phase 3:") ||
        trimmed.toLowerCase().includes("vae decode") ||
        trimmed.toLowerCase().includes("decoding")
      ) {
        next.phaseIndex = 3;
        next.phaseName = "Phase 3/4: High-Fidelity Decoding";
        next.phaseDesc = "Decoding latent tokens into full-resolution RGB image";
        next.detailMessage = trimmed;
      } else if (
        trimmed.includes("Phase 4:") ||
        trimmed.toLowerCase().includes("color correction") ||
        trimmed.toLowerCase().includes("blending")
      ) {
        next.phaseIndex = 4;
        next.phaseName = "Phase 4/4: Color Harmonization";
        next.phaseDesc = "Matching perceptual LAB color balance & post-processing";
        next.detailMessage = trimmed;
      } else if (
        trimmed.toLowerCase().includes("tiled inference") ||
        trimmed.toLowerCase().includes("tile")
      ) {
        next.phaseIndex = 2;
        next.phaseName = "Tiled Transformer Inference";
        next.phaseDesc = "Processing high-res patches with Hann-cosine feathering";
        next.detailMessage = trimmed;
      } else if (
        trimmed.toLowerCase().includes("loading model") ||
        trimmed.toLowerCase().includes("spandrel")
      ) {
        next.phaseIndex = 1;
        next.phaseName = "Loading Neural Model";
        next.phaseDesc = "Initializing PyTorch CUDA weights & tensor pipeline";
        next.detailMessage = trimmed;
      } else if (
        trimmed.toLowerCase().includes("resizing") ||
        trimmed.toLowerCase().includes("converting") ||
        trimmed.toLowerCase().includes("scaling")
      ) {
        next.phaseIndex = 4;
        next.phaseName = "Final Scaling & Output";
        next.phaseDesc = "Lanczos anti-aliased resampling & format export";
        next.detailMessage = trimmed;
      } else if (trimmed.length > 5 && !pctMatch) {
        next.detailMessage = trimmed;
      }

      return next;
    });

    if (trimmed.length > 0 && trimmed.length < 10) {
      setProgress(trimmed);
    } else if (trimmed.includes("converting")) {
      setProgress(t("APP.PROGRESS.SCALING_CONVERTING_TITLE"));
    } else if (trimmed.includes("Successful")) {
      setProgress(t("APP.PROGRESS.SUCCESS_TITLE"));
    }
  };

  // ELECTRON EVENT LISTENERS
  useEffect(() => {
    const handleErrors = (data: string) => {
      if (data.includes("Invalid GPU")) {
        toast({
          title: t("ERRORS.GPU_ERROR.TITLE"),
          description: t("ERRORS.GPU_ERROR.DESCRIPTION", { data }),
          action: (
            <div className="flex flex-col gap-2">
              <ToastAction
                altText={t("ERRORS.COPY_ERROR.TITLE")}
                onClick={() => {
                  navigator.clipboard.writeText(data);
                }}
              >
                {t("ERRORS.COPY_ERROR.TITLE")}
              </ToastAction>
              <a href="https://docs.upscayl.org/" target="_blank">
                <ToastAction altText={t("ERRORS.OPEN_DOCS_TITLE")}>
                  {t("ERRORS.OPEN_DOCS_BUTTON_TITLE")}
                </ToastAction>
              </a>
            </div>
          ),
        });
        resetImagePaths();
      } else if (data.includes("write") || data.includes("read")) {
        if (batchMode) return;
        toast({
          title: t("ERRORS.READ_WRITE_ERROR.TITLE"),
          description: t("ERRORS.READ_WRITE_ERROR.DESCRIPTION", { data }),
          action: (
            <div className="flex flex-col gap-2">
              <ToastAction
                altText="Copy Error"
                onClick={() => {
                  navigator.clipboard.writeText(data);
                }}
              >
                {t("ERRORS.COPY_ERROR.TITLE")}
              </ToastAction>
              <a href="https://docs.upscayl.org/" target="_blank">
                <ToastAction altText={t("ERRORS.OPEN_DOCS_TITLE")}>
                  {t("ERRORS.OPEN_DOCS_BUTTON_TITLE")}
                </ToastAction>
              </a>
            </div>
          ),
        });
        resetImagePaths();
      } else if (data.includes("tile size")) {
        toast({
          title: t("ERRORS.TILE_SIZE_ERROR.TITLE"),
          description: t("ERRORS.TILE_SIZE_ERROR.DESCRIPTION", { data }),
        });
        resetImagePaths();
      } else if (data.includes("uncaughtException")) {
        toast({
          title: t("ERRORS.EXCEPTION_ERROR.TITLE"),
          description: t("ERRORS.EXCEPTION_ERROR.DESCRIPTION"),
        });
        resetImagePaths();
      }
    };

    // LOG
    window.electron.on(ELECTRON_COMMANDS.LOG, (_, data: string) => {
      logit(`🎒 BACKEND REPORTED: `, data);
    });

    // SCALING AND CONVERTING
    window.electron.on(
      ELECTRON_COMMANDS.SCALING_AND_CONVERTING,
      (_, data: string) => {
        setProgress(t("APP.PROGRESS.PROCESSING_TITLE"));
      },
    );

    // UPSCAYL WARNING
    window.electron.on(ELECTRON_COMMANDS.UPSCAYL_WARNING, (_, data: string) => {
      toast({
        title: t("WARNING.GENERIC_WARNING.TITLE"),
        description: data,
      });
    });

    // METADATA ERROR
    window.electron.on(ELECTRON_COMMANDS.METADATA_ERROR, (_, data: string) => {
      toast({
        title: t("ERRORS.METADATA_ERROR.TITLE"),
        description: data,
      });
    });

    // UPSCAYL ERROR
    window.electron.on(ELECTRON_COMMANDS.UPSCAYL_ERROR, (_, data: string) => {
      toast({
        title: t("ERRORS.GENERIC_ERROR.TITLE"),
        description: data,
      });
      resetImagePaths();
    });

    // UPSCAYL PROGRESS
    window.electron.on(
      ELECTRON_COMMANDS.UPSCAYL_PROGRESS,
      (_, data: string) => {
        processProgressData(data);
        handleErrors(data);
        logit(`🚧 UPSCAYL_PROGRESS: `, data);
      },
    );

    // FOLDER UPSCAYL PROGRESS
    window.electron.on(
      ELECTRON_COMMANDS.FOLDER_UPSCAYL_PROGRESS,
      (_, data: string) => {
        processProgressData(data);
        handleErrors(data);
        logit(`🚧 FOLDER_UPSCAYL_PROGRESS: `, data);
      },
    );

    // DOUBLE UPSCAYL PROGRESS
    window.electron.on(
      ELECTRON_COMMANDS.DOUBLE_UPSCAYL_PROGRESS,
      (_, data: string) => {
        if (data.includes("0.00%")) {
          setDoubleUpscaylCounter((prev) => prev + 1);
        }
        processProgressData(data);
        handleErrors(data);
        logit(`🚧 DOUBLE_UPSCAYL_PROGRESS: `, data);
      },
    );

    // UPSCAYL DONE
    window.electron.on(ELECTRON_COMMANDS.UPSCAYL_DONE, (_, data: string) => {
      setProgress("");
      setProgressInfo(initialProgressInfo);
      setUpscaledImagePath(data);
      setUserStats((prev) => ({
        ...prev,
        lastUpscaylDuration: new Date().getTime() - prev.lastUsedAt,
        averageUpscaylTime:
          (prev.averageUpscaylTime * prev.totalUpscayls +
            (new Date().getTime() - prev.lastUsedAt)) /
          (prev.totalUpscayls + 1),
      }));
      logit("upscaledImagePath: ", data);
      logit(`💯 UPSCAYL_DONE: `, data);
    });

    // BATCH CURRENT IMAGE
    window.electron.on(
      ELECTRON_COMMANDS.BATCH_CURRENT_IMAGE,
      (
        _,
        payload: {
          currentImagePath: string;
          currentIndex: number;
          totalImages: number;
        },
      ) => {
        setBatchCurrentProcessing(payload);
        if (payload?.currentImagePath) {
          const filename = payload.currentImagePath.replace(/\\/g, "/").split("/").pop();
          setProgressInfo((prev) => ({
            ...prev,
            detailMessage: `[${payload.currentIndex}/${payload.totalImages}] Processing ${filename}`,
          }));
        }
      },
    );

    // FOLDER UPSCAYL DONE
    window.electron.on(
      ELECTRON_COMMANDS.FOLDER_UPSCAYL_DONE,
      (_, data: string) => {
        setProgress("");
        setProgressInfo(initialProgressInfo);
        setBatchCurrentProcessing(null);
        setUpscaledBatchFolderPath(data);
        logit(`💯 FOLDER_UPSCAYL_DONE: `, data);
        setUserStats((prev) => ({
          ...prev,
          lastUpscaylDuration: new Date().getTime() - prev.lastUsedAt,
          averageUpscaylTime:
            (prev.averageUpscaylTime * prev.totalUpscayls +
              (new Date().getTime() - prev.lastUsedAt)) /
            (prev.totalUpscayls + 1),
        }));
      },
    );

    // DOUBLE UPSCAYL DONE
    window.electron.on(
      ELECTRON_COMMANDS.DOUBLE_UPSCAYL_DONE,
      (_, data: string) => {
        setProgress("");
        setProgressInfo(initialProgressInfo);
        setTimeout(() => setUpscaledImagePath(data), 500);
        setDoubleUpscaylCounter(0);
        logit(`💯 DOUBLE_UPSCAYL_DONE: `, data);
        setUserStats((prev) => ({
          ...prev,
          lastUpscaylDuration: new Date().getTime() - prev.lastUsedAt,
          averageUpscaylTime:
            (prev.averageUpscaylTime * prev.totalUpscayls +
              (new Date().getTime() - prev.lastUsedAt)) /
            (prev.totalUpscayls + 1),
        }));
      },
    );

    // CUSTOM FOLDER LISTENER
    window.electron.on(
      ELECTRON_COMMANDS.CUSTOM_MODEL_FILES_LIST,
      (_, data: string[]) => {
        logit(`📜 CUSTOM_MODEL_FILES_LIST: `, data);
        console.log("🚀 => data:", data);
        setModelIds(data);
      },
    );
  }, []);

  // LOADING STATE
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // SYSTEM INFO
  useEffect(() => {
    if (systemInfo) logit("💻 System Info:", JSON.stringify(systemInfo));
  }, [systemInfo]);

  // HANDLERS
  const resetImagePaths = () => {
    logit("🔄 Resetting image paths");
    setDimensions({
      width: null,
      height: null,
    });
    setProgress("");
    setProgressInfo(initialProgressInfo);
    setBatchCurrentProcessing(null);
    setImagePath("");
    setUpscaledImagePath("");
    setBatchFolderPath("");
    setUpscaledBatchFolderPath("");
  };

  if (isLoading) {
    return (
      <UpscaylSVGLogo className="absolute left-1/2 top-1/2 w-36 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
    );
  }

  return (
    <div
      className="flex h-screen w-screen flex-row overflow-hidden bg-base-300"
      onPaste={(e) => console.log(e)}
    >
      <Sidebar
        imagePath={imagePath}
        dimensions={dimensions}
        setUpscaledImagePath={setUpscaledImagePath}
        batchFolderPath={batchFolderPath}
        setUpscaledBatchFolderPath={setUpscaledBatchFolderPath}
        selectImageHandler={selectImageHandler}
        selectFolderHandler={selectFolderHandler}
      />
      <MainContent
        imagePath={imagePath}
        resetImagePaths={resetImagePaths}
        upscaledBatchFolderPath={upscaledBatchFolderPath}
        setImagePath={setImagePath}
        validateImagePath={validateImagePath}
        selectFolderHandler={selectFolderHandler}
        selectImageHandler={selectImageHandler}
        batchFolderPath={batchFolderPath}
        upscaledImagePath={upscaledImagePath}
        doubleUpscaylCounter={doubleUpscaylCounter}
        setDimensions={setDimensions}
      />
      <OnboardingDialog />
    </div>
  );
};

export default Home;
