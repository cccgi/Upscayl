"use client";

import React, { useEffect, useState, useMemo } from "react";
import UpscaylSVGLogo from "@/components/icons/upscayl-logo-svg";
import { useAtomValue, useSetAtom } from "jotai";
import { translationAtom } from "@/atoms/translations-atom";
import {
  progressAtom,
  progressInfoAtom,
  selectedModelIdAtom,
  batchCurrentProcessingAtom,
} from "@/atoms/user-settings-atom";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import useLogger from "../hooks/use-logger";
import {
  Sparkles,
  Cpu,
  Layers,
  Timer,
  X,
  CheckCircle2,
  Activity,
  ArrowRight,
  FolderSync,
} from "lucide-react";

interface ProgressBarProps {
  progress: string;
  doubleUpscaylCounter: number;
  batchMode: boolean;
  resetImagePaths: () => void;
}

const PHASES = [
  { index: 1, label: "Encode", short: "Latent Prep" },
  { index: 2, label: "Super-Resolution", short: "AI Upscale" },
  { index: 3, label: "Decode", short: "Pixel Synth" },
  { index: 4, label: "Harmonize", short: "Export" },
];

function ProgressBar({
  progress,
  doubleUpscaylCounter,
  batchMode,
  resetImagePaths,
}: ProgressBarProps) {
  const [batchProgress, setBatchProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const t = useAtomValue(translationAtom);
  const logit = useLogger();
  const progressInfo = useAtomValue(progressInfoAtom);
  const selectedModelId = useAtomValue(selectedModelIdAtom);
  const batchCurrentProcessing = useAtomValue(batchCurrentProcessingAtom);

  const setProgress = useSetAtom(progressAtom);

  // Live stopwatch timer
  useEffect(() => {
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}s`;
  }, [elapsedSeconds]);

  // Batch progress counting
  useEffect(() => {
    const progressString = progress.trim().replace(/\n/g, "");
    if (progressString.includes("Successful")) {
      setBatchProgress((prev) => prev + 1);
    }
  }, [progress]);

  // Listen for backend process termination
  useEffect(() => {
    const onStopped = () => {
      setProgress("");
      resetImagePaths();
    };
    if (typeof window !== "undefined" && (window as any).electron?.on) {
      (window as any).electron.on("upscayl-stopped", onStopped);
      return () => {
        (window as any).electron.off?.("upscayl-stopped", onStopped);
      };
    }
  }, [setProgress, resetImagePaths]);

  const stopHandler = () => {
    window.electron.send(ELECTRON_COMMANDS.STOP);
    setProgress("");
    resetImagePaths();
    logit("🛑 Stopping Upscayl");
  };

  // Determine current display percentage
  const currentPct = useMemo(() => {
    if (progressInfo.percent > 0) return progressInfo.percent;
    const match = progress.match(/(\d+(?:\.\d+)?)%/);
    if (match) return parseFloat(match[1]);
    return 0;
  }, [progressInfo.percent, progress]);

  // Overall batch progress (0% - 100%)
  const batchOverallPct = useMemo(() => {
    if (!batchMode || !batchCurrentProcessing || batchCurrentProcessing.totalImages <= 0) {
      return null;
    }
    const { currentIndex, totalImages } = batchCurrentProcessing;
    const completed = Math.max(0, currentIndex - 1);
    const subPct = Math.min(100, Math.max(0, currentPct));
    const overall = ((completed + subPct / 100) / totalImages) * 100;
    return Math.min(100, Math.max(0, overall));
  }, [batchMode, batchCurrentProcessing, currentPct]);

  const effectivePct = batchOverallPct !== null ? batchOverallPct : currentPct;

  const activePhase = progressInfo.phaseIndex || 1;

  const modelDisplay = useMemo(() => {
    if (!selectedModelId) return "AI Upscaler";
    const clean = selectedModelId.replace(/\.(pth|safetensors|bin|onnx)$/i, "");
    if (clean.includes("FaceUpDAT")) return "FaceUpDAT (Face & Skin SOTA)";
    if (clean.includes("seedvr2_ema_7b_fp16")) return "SeedVR2 7B (Official SOTA)";
    if (clean.includes("seedvr2_ema_7b_sharp")) return "SeedVR2 7B Sharp (DiT)";
    if (clean.includes("seedvr2_ema_3b")) return "SeedVR2 3B DiT";
    if (clean.includes("RealWebPhoto") || clean.includes("dat2")) return "DAT-2 Transformer";
    if (clean.includes("UltraSharp")) return "UltraSharp Super-Res";
    return clean.replace(/_/g, " ");
  }, [selectedModelId]);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col justify-between overflow-hidden select-none">
      {/* SCANNING LASER SWEEP LINE OVER CANVAS */}
      <div className="ai-scan-line" />

      {/* TOP SUBTLE AMBIENT GRADIENT */}
      <div className="h-20 w-full bg-gradient-to-b from-base-300/60 to-transparent pointer-events-none" />

      {/* BOTTOM AMBIENT GRADIENT & FLOATING HUD PROGRESS CARD */}
      <div className="flex w-full flex-col items-center justify-end pb-7 pointer-events-none bg-gradient-to-t from-base-300/90 via-base-300/40 to-transparent pt-12">
        <div className="pointer-events-auto flex w-[94%] max-w-2xl flex-col gap-3 rounded-2xl border border-base-content/15 bg-base-200/90 p-4 sm:p-5 shadow-2xl backdrop-blur-xl transition-all">
          
          {/* HEADER ROW */}
          <div className="flex items-center justify-between border-b border-base-content/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-wider text-base-content uppercase">
                    {batchMode ? "Batch Processing" : "Neural Super-Resolution"}
                  </span>
                  {doubleUpscaylCounter > 0 && (
                    <span className="badge badge-primary badge-xs font-semibold">
                      Pass {doubleUpscaylCounter}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-base-content/70">
                  {batchMode ? `Folder Queue` : modelDisplay}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* LIVE TIMER PILL */}
              <div className="flex items-center gap-1.5 rounded-full border border-base-content/10 bg-base-300/80 px-2.5 py-1 text-xs font-semibold tabular-nums text-base-content">
                <Timer className="h-3.5 w-3.5 text-primary" />
                <span>{formattedTime}</span>
              </div>

              {/* STOP BUTTON */}
              <button
                type="button"
                onClick={stopHandler}
                className="btn btn-ghost btn-xs h-7 rounded-lg border border-error/30 text-error hover:border-error hover:bg-error/20"
                title={t("APP.PROGRESS_BAR.STOP_BUTTON_TITLE")}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Stop
              </button>
            </div>
          </div>

          {/* MAIN PERCENTAGE & STAGE DESCRIPTION */}
          <div className="flex items-end justify-between pt-1">
            <div className="flex flex-col max-w-[70%]">
              <span className="text-sm font-bold text-base-content truncate">
                {batchMode && batchCurrentProcessing
                  ? `[${batchCurrentProcessing.currentIndex}/${batchCurrentProcessing.totalImages}] ${batchCurrentProcessing.currentImagePath.replace(/\\/g, "/").split("/").pop()}`
                  : batchMode
                  ? `${t("APP.PROGRESS_BAR.BATCH_UPSCAYL_IN_PROGRESS_TITLE")} ${batchProgress} files`
                  : progressInfo.phaseName || "Upscaling in Progress"}
              </span>
              <span className="text-xs text-base-content/70 truncate">
                {batchMode && batchCurrentProcessing
                  ? progressInfo.detailMessage || `Processing image with ${modelDisplay}`
                  : progressInfo.phaseDesc || "Computing deep transformer & diffusion super-resolution..."}
              </span>
            </div>

            <div className="flex flex-col items-end">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-primary">
                  {effectivePct.toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-primary/80">%</span>
              </div>
              {batchOverallPct !== null && (
                <span className="text-[10px] font-semibold tabular-nums text-base-content/60">
                  Image: {currentPct.toFixed(0)}%
                </span>
              )}
            </div>
          </div>

          {/* SLEEK PROGRESS BAR WITH SHIMMER */}
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-base-300">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-300 ease-out"
              style={{ width: `${Math.max(3, effectivePct)}%` }}
            />
            {effectivePct < 99 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse pointer-events-none" />
            )}
          </div>

          {/* BATCH MODE STEP OVERVIEW */}
          {batchMode && batchCurrentProcessing && (
            <div className="flex items-center justify-between text-[11px] text-base-content/70 pt-0.5 px-0.5">
              <div className="flex items-center gap-1.5 font-medium">
                <FolderSync className="h-3.5 w-3.5 text-primary animate-spin" />
                <span>Upscaling image {batchCurrentProcessing.currentIndex} of {batchCurrentProcessing.totalImages}</span>
              </div>
              <div className="font-semibold tabular-nums text-primary">
                Overall: {effectivePct.toFixed(1)}%
              </div>
            </div>
          )}

          {/* 4-PHASE STEP PIPELINE */}
          {!batchMode && (
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {PHASES.map((p) => {
                const isDone = activePhase > p.index;
                const isCurrent = activePhase === p.index;
                return (
                  <div
                    key={p.index}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] transition-all ${
                      isDone
                        ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                        : isCurrent
                        ? "border-accent bg-accent/15 text-base-content font-bold shadow-sm"
                        : "border-base-content/10 bg-base-300/40 text-base-content/40"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                    ) : isCurrent ? (
                      <div className="h-2 w-2 rounded-full bg-accent animate-ping shrink-0" />
                    ) : (
                      <span className="text-[10px] opacity-60 shrink-0 font-mono">
                        {p.index}
                      </span>
                    )}
                    <span className="truncate">{p.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* LIVE TERMINAL DETAIL LOG PILL */}
          {progressInfo.detailMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-300/50 px-2.5 py-1 text-[11px] font-mono text-base-content/75">
              <Activity className="h-3 w-3 text-accent shrink-0 animate-pulse" />
              <span className="truncate">{progressInfo.detailMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProgressBar;
