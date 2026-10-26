"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAtom, useAtomValue } from "jotai";
import {
  batchModelMappingAtom,
  batchReportAtom,
} from "@/atoms/user-settings-atom";
import {
  Check,
  Filter,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  User,
  Image as ImageIcon,
  Palette,
  FileCode,
  Layers,
} from "lucide-react";

const AVAILABLE_MODELS = [
  { id: "4xFaceUpDAT", name: "4xFaceUpDAT (SOTA Face & Portrait)" },
  { id: "seedvr2_ema_7b_fp16", name: "SeedVR2 7B Base DiT (Generative Photo)" },
  { id: "seedvr2_ema_3b_fp16", name: "SeedVR2 3B DiT (Fast Generative)" },
  { id: "4xRealWebPhoto_v4_dat2", name: "DAT-2 RealWebPhoto (Photo Crisp)" },
  { id: "4x-AnimeSharp", name: "4x-AnimeSharp (Anime & Clean Art)" },
  { id: "4x-UltraSharp", name: "4x-UltraSharp (Universal Sharpness)" },
  { id: "4x_NMKD-Superscale-SP_178000_G", name: "NMKD Superscale (Old / Compressed)" },
  { id: "remacri-4x", name: "4x Remacri (Nature & Landscapes)" },
  { id: "digital-art-4x", name: "Digital Art 4x" },
  { id: "upscayl-standard-4x", name: "Upscayl Standard 4x" },
];

export default function BatchModelCustomizerDialog({
  triggerButton,
}: {
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const report = useAtomValue(batchReportAtom);
  const [modelMapping, setModelMapping] = useAtom(batchModelMappingAtom);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  if (!report || report.items.length === 0) {
    return null;
  }

  const handleModelChange = (filename: string, modelId: string) => {
    setModelMapping((prev) => ({
      ...prev,
      [filename]: modelId,
    }));
  };

  const handleResetToAuto = () => {
    const fresh: Record<string, string> = {};
    for (const item of report.items) {
      fresh[item.filename] = item.suggestedModel;
    }
    setModelMapping(fresh);
  };

  const handleSetAllTo = (modelId: string) => {
    const bulk: Record<string, string> = {};
    for (const item of report.items) {
      bulk[item.filename] = modelId;
    }
    setModelMapping(bulk);
  };

  const filteredItems = report.items.filter((item) => {
    const matchesSearch =
      item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "portrait":
        return <User className="h-3.5 w-3.5 text-blue-400" />;
      case "anime":
        return <Palette className="h-3.5 w-3.5 text-purple-400" />;
      case "photo":
        return <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />;
      case "graphic":
        return <FileCode className="h-3.5 w-3.5 text-amber-400" />;
      default:
        return <Layers className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton ? (
          triggerButton
        ) : (
          <button className="btn btn-outline btn-xs gap-1.5 font-medium">
            <Settings2 className="h-3.5 w-3.5" />
            Customize Models ({report.items.length})
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl bg-base-100 border border-base-300 text-base-content p-5 rounded-2xl shadow-2xl">
        <DialogHeader className="pb-2 border-b border-base-300">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Batch Per-Image Model Assignments
            </DialogTitle>
            <span className="badge badge-primary badge-sm font-semibold">
              {report.items.length} Images Scanned
            </span>
          </div>
          <p className="text-xs text-base-content/70 mt-1">
            Our Vision AI automatically matched models to each image. You can fine-tune or override any image's model below.
          </p>
        </DialogHeader>

        {/* CONTROLS BAR: SEARCH, FILTER, QUICK ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 pb-1">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
              <input
                type="text"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-xs input-bordered w-full pl-8"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select select-bordered select-xs text-xs"
            >
              <option value="all">All Types</option>
              <option value="portrait">Portraits</option>
              <option value="anime">Anime / Art</option>
              <option value="photo">Photos</option>
              <option value="graphic">Graphics</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToAuto}
              className="btn btn-ghost btn-xs gap-1 text-[11px] text-base-content/70 hover:text-base-content"
              title="Reset all assignments to AI detected recommendations"
            >
              <RefreshCw className="h-3 w-3" />
              Reset All to Auto
            </button>
          </div>
        </div>

        {/* LIST OF IMAGES & MODEL SELECTORS */}
        <ScrollArea className="h-[360px] pr-3 rounded-lg border border-base-200 bg-base-200/40 p-2">
          {filteredItems.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-xs text-base-content/50">
              No images match your filter criteria.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item, idx) => {
                const assigned = modelMapping[item.filename] || item.suggestedModel;
                const isAuto = assigned === item.suggestedModel;

                return (
                  <div
                    key={item.filename + idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-base-100 p-2.5 border border-base-300/80 shadow-sm transition-all hover:border-primary/40"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="mt-0.5 rounded-md bg-base-200 p-1.5 shrink-0">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className="text-xs font-semibold truncate text-base-content"
                            title={item.filename}
                          >
                            {item.filename}
                          </p>
                          <span
                            className="badge badge-ghost badge-xs text-[10px] font-medium shrink-0"
                            title={item.reason}
                          >
                            {item.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-base-content/60 truncate mt-0.5">
                          {item.reason}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 sm:self-center">
                      <select
                        value={assigned}
                        onChange={(e) =>
                          handleModelChange(item.filename, e.target.value)
                        }
                        className={`select select-xs select-bordered text-xs font-medium max-w-[210px] ${
                          isAuto
                            ? "border-primary/40 text-primary"
                            : "border-warning/60 text-warning"
                        }`}
                      >
                        {AVAILABLE_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* FOOTER */}
        <div className="flex items-center justify-between pt-2 border-t border-base-300 text-xs">
          <div className="text-[11px] text-base-content/60">
            {Object.keys(modelMapping).length > 0
              ? `${Object.keys(modelMapping).length} model assignments configured`
              : "Using AI auto-selected recommendations"}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="btn btn-primary btn-sm px-5 font-semibold text-xs"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
