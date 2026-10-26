import { useAtom, useAtomValue } from "jotai";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "react-tooltip";
import { themeChange } from "theme-change";
import useLogger from "../../hooks/use-logger";
import {
  savedOutputPathAtom,
  progressAtom,
  rememberOutputFolderAtom,
  scaleAtom,
  customWidthAtom,
  useCustomWidthAtom,
  selectedModelIdAtom,
  autoSelectModelAtom,
  batchReportAtom,
  batchScanningAtom,
  useAdaptiveBatchAtom,
  batchModelMappingAtom,
} from "../../../atoms/user-settings-atom";
import { FEATURE_FLAGS } from "@common/feature-flags";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { useToast } from "@/components/ui/use-toast";
import { translationAtom } from "@/atoms/translations-atom";
import { SelectImageScale } from "../settings-tab/select-image-scale";
import SelectModelDialog from "./select-model-dialog";
import BatchModelCustomizerDialog from "./batch-model-customizer-dialog";
import { ImageFormat } from "@/lib/valid-formats";
import {
  analyzeImage,
  analyzeBatchFolder,
  AnalysisResult,
} from "@/lib/image-analyzer";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Layers,
  Sparkles,
  Wand2,
} from "lucide-react";

interface IProps {
  selectImageHandler: () => Promise<void>;
  selectFolderHandler: () => Promise<void>;
  upscaylHandler: () => Promise<void>;
  batchMode: boolean;
  setBatchMode: React.Dispatch<React.SetStateAction<boolean>>;
  imagePath: string;
  batchFolderPath?: string;
  doubleUpscayl: boolean;
  setDoubleUpscayl: React.Dispatch<React.SetStateAction<boolean>>;
  dimensions: {
    width: number | null;
    height: number | null;
  };
  setSaveImageAs: React.Dispatch<React.SetStateAction<ImageFormat>>;
  setGpuId: React.Dispatch<React.SetStateAction<string>>;
}

function UpscaylSteps({
  selectImageHandler,
  selectFolderHandler,
  upscaylHandler,
  batchMode,
  setBatchMode,
  imagePath,
  batchFolderPath = "",
  doubleUpscayl,
  setDoubleUpscayl,
  dimensions,
}: IProps) {
  const [scale, setScale] = useAtom(scaleAtom);
  const [outputPath, setOutputPath] = useAtom(savedOutputPathAtom);
  const [progress, setProgress] = useAtom(progressAtom);
  const [selectedModelId, setSelectedModelId] = useAtom(selectedModelIdAtom);
  const [autoSelectModel, setAutoSelectModel] = useAtom(autoSelectModelAtom);

  const [batchReport, setBatchReport] = useAtom(batchReportAtom);
  const [batchScanning, setBatchScanning] = useAtom(batchScanningAtom);
  const [useAdaptiveBatch, setUseAdaptiveBatch] = useAtom(useAdaptiveBatchAtom);
  const [, setBatchModelMapping] = useAtom(batchModelMappingAtom);

  const rememberOutputFolder = useAtomValue(rememberOutputFolderAtom);
  const customWidth = useAtomValue(customWidthAtom);
  const useCustomWidth = useAtomValue(useCustomWidthAtom);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const lastAnalyzedPathRef = useRef<string>("");
  const lastAnalyzedBatchFolderRef = useRef<string>("");
  const autoSelectRef = useRef(autoSelectModel);
  autoSelectRef.current = autoSelectModel;

  const logit = useLogger();
  const { toast } = useToast();
  const t = useAtomValue(translationAtom);

  const outputHandler = async () => {
    const path = await window.electron.invoke(ELECTRON_COMMANDS.SELECT_FOLDER);
    if (path !== null) {
      logit("🗂 Setting Output Path: ", path);
      setOutputPath(path);
    } else {
      setOutputPath(null);
    }
  };

  useEffect(() => {
    themeChange(false);
  }, []);

  // SMART IMAGE SCANNING (Single Image Mode)
  useEffect(() => {
    if (!imagePath || batchMode) {
      setAnalysis(null);
      lastAnalyzedPathRef.current = "";
      return;
    }

    if (lastAnalyzedPathRef.current === imagePath) {
      return;
    }
    lastAnalyzedPathRef.current = imagePath;

    let isMounted = true;

    analyzeImage(imagePath).then((result) => {
      if (!isMounted) return;
      setAnalysis(result);

      if (autoSelectRef.current && result?.suggestedModel) {
        console.log("✨ Smart Auto-Selected Model:", result.suggestedModel);
        setSelectedModelId(result.suggestedModel);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [imagePath, batchMode, setSelectedModelId]);

  // SMART BATCH FOLDER SCANNING (Batch Mode)
  useEffect(() => {
    if (!batchMode || !batchFolderPath) {
      if (!batchMode) {
        setBatchReport(null);
        setBatchScanning(false);
        lastAnalyzedBatchFolderRef.current = "";
      }
      return;
    }

    if (lastAnalyzedBatchFolderRef.current === batchFolderPath) {
      return;
    }
    lastAnalyzedBatchFolderRef.current = batchFolderPath;

    let isMounted = true;
    setBatchScanning(true);

    analyzeBatchFolder(batchFolderPath)
      .then((report) => {
        if (!isMounted) return;
        setBatchReport(report);
        setBatchScanning(false);

        if (report && report.items && report.items.length > 0) {
          const mapping: Record<string, string> = {};
          for (const item of report.items) {
            mapping[item.filename] = item.suggestedModel;
          }
          setBatchModelMapping(mapping);

          if (report.isMixed) {
            setUseAdaptiveBatch(true);
          } else {
            setUseAdaptiveBatch(false);
            if (report.dominantModel) {
              setSelectedModelId(report.dominantModel);
            }
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Batch folder analysis error:", err);
        setBatchScanning(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    batchFolderPath,
    batchMode,
    setBatchReport,
    setBatchScanning,
    setBatchModelMapping,
    setUseAdaptiveBatch,
    setSelectedModelId,
  ]);

  const upscaylResolution = useMemo(() => {
    const newDimensions = {
      width: dimensions.width,
      height: dimensions.height,
    };

    let doubleScale = parseInt(scale) * parseInt(scale);
    let singleScale = parseInt(scale);

    if (doubleUpscayl) {
      if (useCustomWidth) {
        newDimensions.width = customWidth;
        newDimensions.height = Math.round(
          customWidth * (dimensions.height / dimensions.width),
        );
      } else {
        const newWidth = dimensions.width * doubleScale;
        const newHeight = dimensions.height * doubleScale;
        newDimensions.width = newWidth;
        newDimensions.height = newHeight;
      }
    } else {
      if (useCustomWidth) {
        newDimensions.width = customWidth;
        newDimensions.height = Math.round(
          customWidth * (dimensions.height / dimensions.width),
        );
      } else {
        newDimensions.width = dimensions.width * singleScale;
        newDimensions.height = dimensions.height * singleScale;
      }
    }

    return newDimensions;
  }, [dimensions.width, dimensions.height, doubleUpscayl, scale, customWidth, useCustomWidth]);

  return (
    <div
      className={`animate-step-in animate flex h-screen flex-col gap-6 overflow-y-auto overflow-x-hidden p-5`}
    >
      {/* BATCH OPTION */}
      <div className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          className="toggle"
          defaultChecked={batchMode}
          onClick={() => {
            if (!rememberOutputFolder) {
              setOutputPath("");
            }
            setProgress("");
            setBatchMode((oldValue) => !oldValue);
          }}
        ></input>
        <p
          className="mr-1 inline-block cursor-help text-sm"
          data-tooltip-id="tooltip"
          data-tooltip-content={t("APP.BATCH_MODE.DESCRIPTION")}
        >
          {t("APP.BATCH_MODE.TITLE")}
        </p>
      </div>

      {/* STEP 1 */}
      <div className="animate-step-in">
        <p className="step-heading">{t("APP.FILE_SELECTION.TITLE")}</p>
        <button
          className="btn btn-primary"
          onClick={!batchMode ? selectImageHandler : selectFolderHandler}
          data-tooltip-id="tooltip"
          data-tooltip-content={batchMode ? batchFolderPath : imagePath}
        >
          {batchMode
            ? t("APP.FILE_SELECTION.BATCH_MODE_TYPE")
            : t("APP.FILE_SELECTION.SINGLE_MODE_TYPE")}
        </button>

        {/* BATCH SCANNING SPINNER */}
        {batchMode && batchScanning && (
          <div className="mt-2.5 rounded-lg border border-primary/30 bg-base-200/60 p-2.5 flex items-center gap-2.5 animate-pulse">
            <span className="loading loading-spinner loading-xs text-primary shrink-0"></span>
            <span className="text-xs font-medium text-base-content/90 truncate">
              Scanning folder contents with Vision AI...
            </span>
          </div>
        )}

        {/* BATCH REPORT: MIXED CONTENT DETECTED */}
        {batchMode && !batchScanning && batchReport && batchReport.isMixed && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning/5 p-3 flex flex-col gap-2.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5 text-warning">
                <Layers className="h-4 w-4 shrink-0" />
                Mixed Content ({batchReport.totalImages} images)
              </span>
              <span className="badge badge-warning badge-xs text-[10px] font-semibold">
                Multi-Model
              </span>
            </div>

            <div className="flex flex-wrap gap-1 text-[11px]">
              {Object.entries(batchReport.categoryCounts).map(([cat, count]) => (
                <span
                  key={cat}
                  className="badge badge-neutral badge-xs text-[10px] py-1 px-1.5 capitalize"
                >
                  {cat === "portrait" && "👤 "}
                  {cat === "anime" && "🎨 "}
                  {cat === "photo" && "📷 "}
                  {cat === "graphic" && "💻 "}
                  {count} {cat}
                </span>
              ))}
            </div>

            <div className="divider my-0"></div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs checkbox-primary"
                  checked={useAdaptiveBatch}
                  onChange={(e) => setUseAdaptiveBatch(e.target.checked)}
                />
                <span className="text-xs font-medium">
                  Adaptive Smart Upscaling
                </span>
              </label>

              {useAdaptiveBatch && <BatchModelCustomizerDialog />}
            </div>

            <p className="text-[10px] text-base-content/70 leading-tight">
              {useAdaptiveBatch
                ? "Each image will automatically use its best matched specialized model."
                : "Single-model mode: Selected model in Step 2 will be applied to all images."}
            </p>
          </div>
        )}

        {/* BATCH REPORT: UNIFORM CONTENT */}
        {batchMode && !batchScanning && batchReport && !batchReport.isMixed && (
          <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-2.5 flex items-center justify-between gap-2 transition-all">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-success capitalize truncate">
                  Uniform {batchReport.dominantCategory} ({batchReport.totalImages} images)
                </p>
                <p className="text-[10px] text-base-content/70 truncate">
                  Auto-selected: {batchReport.dominantModel}
                </p>
              </div>
            </div>
            <BatchModelCustomizerDialog
              triggerButton={
                <button className="btn btn-ghost btn-xs text-[11px] text-base-content/70 shrink-0">
                  Review
                </button>
              }
            />
          </div>
        )}
      </div>

      {/* STEP 2 */}
      <div className="animate-step-in group flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="step-heading mb-0">{t("APP.MODEL_SELECTION.TITLE")}</p>
            {analysis && !batchMode && (
              <span className="badge badge-primary badge-sm font-semibold gap-1 text-[11px]">
                <Sparkles className="h-3 w-3" />
                {analysis.tag}
              </span>
            )}
            {batchMode && useAdaptiveBatch && batchReport?.isMixed && (
              <span className="badge badge-warning badge-sm font-semibold gap-1 text-[11px]">
                <Sparkles className="h-3 w-3" />
                Adaptive Active
              </span>
            )}
          </div>

          {batchMode && useAdaptiveBatch && batchReport?.isMixed ? (
            <div className="rounded-lg border border-primary/25 bg-base-200/60 p-3 mb-2 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-1.5 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Multi-Model Adaptive Mode
                </span>
                <BatchModelCustomizerDialog
                  triggerButton={
                    <button className="btn btn-primary btn-xs text-[10px] font-semibold h-6 min-h-6">
                      Customize Per-Image
                    </button>
                  }
                />
              </div>
              <p className="text-[11px] text-base-content/80 leading-relaxed">
                Upscayl will run portrait faces on FaceUpDAT, anime on AnimeSharp, and photos on DAT-2. You can also pick a default fallback below.
              </p>
              <SelectModelDialog />
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm">{t("APP.MODEL_SELECTION.DESCRIPTION")}</p>
              <SelectModelDialog />
            </>
          )}
        </div>

        {/* SMART IMAGE DETECTION & ALGORITHM RECOMMENDATION (Single Image Mode) */}
        {analysis && !batchMode && (
          <div className="rounded-lg border border-primary/25 bg-base-200/60 p-3 flex flex-col gap-2 transition-all">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-primary">
                <Wand2 className="h-3.5 w-3.5" />
                Detected: {analysis.label}
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-base-content/70 hover:text-base-content select-none">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs checkbox-primary"
                  checked={autoSelectModel}
                  onChange={(e) => setAutoSelectModel(e.target.checked)}
                />
                Auto-apply
              </label>
            </div>

            <p className="text-[11px] leading-relaxed text-base-content/80">
              {analysis.reason}
            </p>

            <button
              type="button"
              className={`btn btn-xs w-full justify-between font-medium transition-all ${
                selectedModelId === analysis.suggestedModel
                  ? "btn-success text-success-content"
                  : "btn-outline btn-primary"
              }`}
              onClick={() => setSelectedModelId(analysis.suggestedModel)}
            >
              <span className="flex items-center gap-1.5 truncate">
                {selectedModelId === analysis.suggestedModel ? (
                  <>
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Active: {analysis.modelDisplayName}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Use Recommended: {analysis.modelDisplayName}</span>
                  </>
                )}
              </span>
              {selectedModelId !== analysis.suggestedModel && (
                <ArrowRight className="h-3.5 w-3.5 shrink-0 ml-1" />
              )}
            </button>
          </div>
        )}

        {!batchMode && (
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              className="checkbox"
              checked={doubleUpscayl}
              onChange={(e) => {
                if (e.target.checked) {
                  setDoubleUpscayl(true);
                } else {
                  setDoubleUpscayl(false);
                }
              }}
            />
            <p
              className="cursor-pointer text-sm"
              onClick={(e) => {
                setDoubleUpscayl((prev) => !prev);
              }}
            >
              {t("APP.DOUBLE_UPSCAYL.TITLE")}
            </p>
            <button
              className="badge badge-neutral badge-sm cursor-help"
              data-tooltip-id="tooltip"
              data-tooltip-content={t("APP.DOUBLE_UPSCAYL.DESCRIPTION")}
            >
              ?
            </button>
          </div>
        )}

        <SelectImageScale scale={scale} setScale={setScale} hideInfo />
      </div>

      {/* STEP 3 */}
      <div className="animate-step-in">
        <div className="flex flex-col pb-2">
          <div className="step-heading flex items-center gap-2">
            <span className="leading-none">
              {t("APP.OUTPUT_PATH_SELECTION.TITLE")}
            </span>
            {FEATURE_FLAGS.APP_STORE_BUILD && (
              <button
                className="badge badge-outline badge-sm cursor-pointer"
                onClick={() =>
                  alert(t("APP.OUTPUT_PATH_SELECTION.MAC_APP_STORE_ALERT"))
                }
              >
                ?
              </button>
            )}
          </div>
          {!outputPath && FEATURE_FLAGS.APP_STORE_BUILD && (
            <div className="text-xs">
              <span className="rounded-btn bg-base-200 px-2 font-medium uppercase text-base-content/50">
                {t("APP.OUTPUT_PATH_SELECTION.NOT_SELECTED")}
              </span>
            </div>
          )}
        </div>
        {!batchMode && !FEATURE_FLAGS.APP_STORE_BUILD && (
          <p className="mb-2 text-sm">
            {!batchMode
              ? t("APP.OUTPUT_PATH_SELECTION.DEFAULT_IMG_PATH")
              : t("APP.OUTPUT_PATH_SELECTION.DEFAULT_FOLDER_PATH")}
          </p>
        )}
        <button
          className="btn btn-primary"
          data-tooltip-content={outputPath}
          data-tooltip-id="tooltip"
          onClick={outputHandler}
        >
          {t("APP.OUTPUT_PATH_SELECTION.BUTTON_TITLE")}
        </button>
      </div>

      {/* STEP 4 */}
      <div className="animate-step-in">
        <p className="step-heading">{t("APP.SCALE_SELECTION.TITLE")}</p>
        {dimensions.width && dimensions.height && (
          <p className="mb-2 text-sm">
            {t("APP.SCALE_SELECTION.FROM_TITLE")}
            <span className="font-bold">
              {dimensions.width}x{dimensions.height}
            </span>
            {t("APP.SCALE_SELECTION.TO_TITLE")}
            <span className="font-bold">
              {upscaylResolution.width}x{upscaylResolution.height}
            </span>
          </p>
        )}
        <button
          className="btn btn-secondary"
          onClick={
            progress.length > 0 || !outputPath
              ? () =>
                  toast({
                    description: t(
                      "APP.SCALE_SELECTION.NO_OUTPUT_FOLDER_ALERT",
                    ),
                  })
              : upscaylHandler
          }
        >
          {progress.length > 0
            ? t("APP.SCALE_SELECTION.IN_PROGRESS_BUTTON_TITLE")
            : t("APP.SCALE_SELECTION.START_BUTTON_TITLE")}
        </button>
      </div>
    </div>
  );
}

export default UpscaylSteps;
