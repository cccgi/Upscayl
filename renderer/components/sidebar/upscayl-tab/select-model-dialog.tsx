"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Maximize2, Sparkles, SwatchBookIcon, X, Zap } from "lucide-react";
import { ModelId, MODELS } from "@common/models-list";
import { useAtom, useAtomValue } from "jotai";
import { selectedModelIdAtom } from "@/atoms/user-settings-atom";
import { customModelIdsAtom } from "@/atoms/models-list-atom";
import useTranslation from "@/components/hooks/use-translation";
import posthog from "posthog-js";

export interface ModelMeta {
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
}

export const getModelMetadata = (id: string): ModelMeta => {
  const l = id.toLowerCase();
  if (l.includes("seedvr") || l.includes("seed")) {
    if (l.includes("7b_sharp") || l.includes("7b-sharp")) {
      return {
        name: "SeedVR2 7B Sharp (FP16)",
        badge: "SOTA Generative DiT",
        badgeClass: "badge-primary text-primary-content",
        description: "ByteDance 7B DiT with sharp detailing. Peak photorealism for portraits, eyes & fine textures.",
      };
    }
    if (l.includes("7b")) {
      return {
        name: "SeedVR2 7B (FP16)",
        badge: "SOTA Generative DiT",
        badgeClass: "badge-primary text-primary-content",
        description: "ByteDance 7B DiT. Unsurpassed generative hallucination and compression artifact repair.",
      };
    }
    if (l.includes("fp8")) {
      return {
        name: "SeedVR2 3B (FP8)",
        badge: "DiT Diffusion",
        badgeClass: "badge-primary text-primary-content",
        description: "ByteDance 3B DiT in 8-bit precision. Fast generative upscaling with low VRAM footprint.",
      };
    }
    return {
      name: "SeedVR2 3B (FP16)",
      badge: "SOTA Generative DiT",
      badgeClass: "badge-primary text-primary-content",
      description: "ByteDance SOTA DiT diffusion model. Reconstructs hair, skin pores, and natural textures.",
    };
  }
  if (l.includes("realwebphoto") || l.includes("dat2") || l.includes("dat-2") || l.includes("lexica")) {
    return {
      name: id.replace(/_/g, " "),
      badge: "SOTA DAT-2 Transformer",
      badgeClass: "badge-secondary text-secondary-content",
      description: "Dual Aggregation Transformer (DAT-2). Unmatched sharpness & structural fidelity without distortion.",
    };
  }
  if (l.includes("dat")) {
    return {
      name: id.replace(/_/g, " "),
      badge: "DAT Transformer",
      badgeClass: "badge-secondary text-secondary-content",
      description: "Dual Aggregation Transformer. Crystal clear edge restoration and facial clarity.",
    };
  }
  if (l.includes("ultrasharp") || l.includes("ultra-sharp")) {
    return {
      name: "4x-UltraSharp",
      badge: "SOTA Super-Resolution",
      badgeClass: "badge-accent text-accent-content",
      description: "Community favorite high-clarity upscaler for general photography and clean artwork.",
    };
  }
  if (l.includes("remacri")) {
    return {
      name: "4x Remacri",
      badge: "SOTA Super-Resolution",
      badgeClass: "badge-accent text-accent-content",
      description: "Exceptional for natural foliage, outdoor landscapes, and realistic photography.",
    };
  }
  if (l.includes("animesharp")) {
    return {
      name: "4x-AnimeSharp",
      badge: "Anime & Illustration",
      badgeClass: "badge-info text-info-content",
      description: "Sharp line art and vibrant color enhancement for drawings and anime.",
    };
  }
  if (l.includes("nmkd")) {
    return {
      name: id.replace(/_/g, " "),
      badge: "Fast Super-Resolution",
      badgeClass: "badge-accent text-accent-content",
      description: "High-performance upscale model tuned for clean detail preservation.",
    };
  }
  return {
    name: id.replace(/_/g, " "),
    badge: "PyTorch Model",
    badgeClass: "badge-ghost",
    description: "Universal PyTorch / CUDA model.",
  };
};

const SelectModelDialog = () => {
  const t = useTranslation();
  const [selectedModelId, setSelectedModelId] = useAtom(selectedModelIdAtom);
  const customModelIds = useAtomValue(customModelIdsAtom);
  const [open, setOpen] = useState(false);
  const [zoomedModel, setZoomedModel] = useState<ModelId | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);

  // Fallback modern list if models list hasn't finished IPC sync yet
  const defaultSotaList = [
    "seedvr2_ema_3b_fp16",
    "seedvr2_ema_7b_sharp_fp16",
    "4xRealWebPhoto_v4_dat2",
    "4xFaceUpDAT",
    "4x-UltraSharp",
    "4x_foolhardy_Remacri",
  ];

  const activeModernModels =
    customModelIds.length > 0
      ? customModelIds.filter((id) => !(id in MODELS))
      : defaultSotaList;

  const handleModelSelect = (model: ModelId | string) => {
    setSelectedModelId(model);
    setOpen(false);

    posthog.capture("model_selected", {
      $ip: "0.0.0.0",
      $geoip_disable: true,
      model,
    });
  };

  const handleZoom = (event: React.MouseEvent, model: ModelId) => {
    event.stopPropagation();
    setZoomedModel(model);
  };

  const selectedMeta = getModelMetadata(selectedModelId);

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="btn btn-primary justify-start border-border gap-2 text-left">
            <SwatchBookIcon className="h-5 w-5 shrink-0" />
            <div className="flex flex-col items-start leading-tight truncate">
              <span className="font-semibold truncate">
                {selectedModelId in MODELS
                  ? t(`APP.MODEL_SELECTION.MODELS.${MODELS[selectedModelId]?.id}.NAME` as any)
                  : selectedMeta.name}
              </span>
              <span className="text-[10px] opacity-75 font-normal">
                {selectedModelId in MODELS ? "Legacy NCNN" : selectedMeta.badge}
              </span>
            </div>
          </button>
        </DialogTrigger>
        <DialogContent className="z-50 sm:max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Select AI Upscale Model
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="flex flex-col gap-4 py-2">
              {/* TOP SECTION: MODERN SOTA MODELS (SEEDVR2, DAT2, ULTRASHARP, ETC.) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <Zap className="h-4 w-4 text-warning" />
                  <p className="font-bold text-sm tracking-wide uppercase text-base-content/90">
                    Latest & Greatest AI Models (SOTA PyTorch / CUDA)
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {activeModernModels.map((customModel) => {
                    const meta = getModelMetadata(customModel);
                    const isSelected = selectedModelId === customModel;
                    return (
                      <button
                        key={customModel}
                        className={`btn h-auto w-full flex flex-col items-start p-3.5 text-left rounded-lg transition-all border ${
                          isSelected
                            ? "btn-primary border-primary ring-2 ring-primary/40 shadow-md"
                            : "bg-base-200/60 hover:bg-base-200 border-base-300"
                        }`}
                        onClick={() => handleModelSelect(customModel)}
                      >
                        <div className="flex w-full items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-sm">{meta.name}</span>
                          <span className={`badge badge-sm font-semibold ${meta.badgeClass}`}>
                            {meta.badge}
                          </span>
                        </div>
                        <p className="text-xs font-normal leading-relaxed opacity-80">
                          {meta.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COLLAPSIBLE LEGACY MODELS SECTION */}
              <div className="pt-2 border-t border-base-300">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm w-full justify-between text-base-content/60 font-semibold"
                  onClick={() => setShowLegacy(!showLegacy)}
                >
                  <span>Legacy Models (Vulkan NCNN)</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showLegacy ? "rotate-180" : ""}`}
                  />
                </button>

                {showLegacy && (
                  <div className="flex flex-col gap-4 mt-3">
                    {Object.entries(MODELS).map((modelData) => {
                      const modelId = modelData[0] as ModelId;
                      const model = modelData[1];
                      const isSelected = selectedModelId === modelId;
                      return (
                        <button
                          key={modelId}
                          className={`btn !h-auto !w-full !flex-col !items-start !rounded-sm !p-4 border ${
                            isSelected ? "border-primary ring-2 ring-primary/40" : "border-base-300"
                          }`}
                          onClick={() => handleModelSelect(modelId)}
                        >
                          <p className="font-semibold">
                            {t(`APP.MODEL_SELECTION.MODELS.${modelId}.NAME`)}
                          </p>
                          <p className="mb-2 text-left font-normal leading-normal text-base-content/70">
                            {t(`APP.MODEL_SELECTION.MODELS.${modelId}.DESCRIPTION`)}
                          </p>
                          <div className="relative h-44 w-full overflow-hidden rounded-sm">
                            <div className="flex h-full w-full">
                              <img
                                src={`public:///model-comparison/${model.id}/before.webp`}
                                alt={`Model Before`}
                                className="h-full w-1/2 object-cover"
                              />
                              <img
                                src={`public:///model-comparison/${model.id}/after.webp`}
                                alt={`Model After`}
                                className="h-full w-1/2 object-cover"
                              />
                            </div>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              <div className="h-full w-px bg-white opacity-50"></div>
                            </div>
                            <div className="absolute bottom-2 left-2 rounded bg-black bg-opacity-50 px-1 text-xs text-white">
                              {t("APP.MODEL_SELECTION.BEFORE")}
                            </div>
                            <div className="absolute bottom-2 right-2 rounded bg-black bg-opacity-50 px-1 text-xs text-white">
                              {t("APP.MODEL_SELECTION.AFTER")}
                            </div>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute right-2 top-2"
                              onClick={(e) => handleZoom(e, modelId)}
                            >
                              <Maximize2 className="h-4 w-4" />
                              <span className="sr-only">
                                {t("APP.MODEL_SELECTION.ZOOM")}
                              </span>
                            </Button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!zoomedModel}
        onOpenChange={(open) => !open && setZoomedModel(null)}
      >
        <DialogContent
          className="h-screen w-screen max-w-full p-0"
          hideCloseButton
        >
          <div className="relative flex h-full w-full items-center justify-center bg-black">
            <div className="flex h-full w-full">
              <div className="relative h-full w-1/2">
                <img
                  src={`public:///model-comparison/${MODELS[zoomedModel]?.id}/before.webp`}
                  alt={`Zoomed in Image - Before`}
                  className="h-full w-full object-contain"
                />
                <div className="absolute bottom-4 left-4 rounded bg-black bg-opacity-50 px-2 py-1 text-sm text-white">
                  Before
                </div>
              </div>
              <div className="relative h-full w-1/2">
                <img
                  src={`public:///model-comparison/${MODELS[zoomedModel]?.id}/after.webp`}
                  alt={`Zoomed in Image - After`}
                  className="h-full w-full object-contain"
                />
                <div className="absolute bottom-4 right-4 rounded bg-black bg-opacity-50 px-2 py-1 text-sm text-white">
                  After
                </div>
              </div>
            </div>
            <button
              className="btn btn-circle btn-secondary absolute right-4 top-4"
              onClick={() => setZoomedModel(null)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SelectModelDialog;
