"use client";

import React, { useState, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  batchModelMappingAtom,
  batchReportAtom,
  batchSelectedFilesAtom,
  useAdaptiveBatchAtom,
} from "../../atoms/user-settings-atom";
import { sanitizePath } from "@common/sanitize-path";
import {
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Folder,
  User,
  Palette,
  Image as ImageIcon,
  FileCode,
  Filter,
  Check,
} from "lucide-react";

export default function BatchGalleryView() {
  const report = useAtomValue(batchReportAtom);
  const [selectedFiles, setSelectedFiles] = useAtom(batchSelectedFilesAtom);
  const modelMapping = useAtomValue(batchModelMappingAtom);
  const useAdaptiveBatch = useAtomValue(useAdaptiveBatchAtom);

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");

  const totalCount = report?.items.length || 0;
  const selectedCount = selectedFiles.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  // Toggle single file selection
  const toggleFile = (filename: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedFiles((prev) => {
      if (prev.includes(filename)) {
        return prev.filter((f) => f !== filename);
      } else {
        return [...prev, filename];
      }
    });
  };

  // Select all or deselect all
  const handleToggleSelectAll = () => {
    if (!report) return;
    if (allSelected) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(report.items.map((item) => item.filename));
    }
  };

  // Select only files of currently active category
  const handleSelectCurrentCategory = (category: string) => {
    if (!report) return;
    const catFiles = report.items
      .filter((item) => category === "all" || item.category === category)
      .map((item) => item.filename);

    setSelectedFiles((prev) => {
      const set = new Set(prev);
      const allCatSelected = catFiles.every((f) => set.has(f));
      if (allCatSelected) {
        // Unselect these
        return prev.filter((f) => !catFiles.includes(f));
      } else {
        // Add all
        catFiles.forEach((f) => set.add(f));
        return Array.from(set);
      }
    });
  };

  // Filtered items based on category pill
  const filteredItems = useMemo(() => {
    if (!report) return [];
    if (activeCategoryFilter === "all") return report.items;
    return report.items.filter((item) => item.category === activeCategoryFilter);
  }, [report, activeCategoryFilter]);

  if (!report || report.items.length === 0) {
    return null;
  }

  const folderName = report.folderPath
    ? report.folderPath.split(/[\\/]/).filter(Boolean).pop() || report.folderPath
    : "Batch Folder";

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "portrait":
        return <User className="h-3 w-3 text-blue-400" />;
      case "anime":
        return <Palette className="h-3 w-3 text-purple-400" />;
      case "photo":
        return <ImageIcon className="h-3 w-3 text-emerald-400" />;
      case "graphic":
        return <FileCode className="h-3 w-3 text-amber-400" />;
      default:
        return <Layers className="h-3 w-3 text-slate-400" />;
    }
  };

  return (
    <div className="z-10 flex h-full w-full flex-col overflow-hidden bg-base-300/40 select-none animate-step-in">
      {/* TOP HEADER CONTROLS TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-content/10 bg-base-100/80 px-5 py-3 backdrop-blur-md">
        {/* LEFT: FOLDER & SELECTION STATUS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-base-200/90 px-3 py-1.5 border border-base-content/10">
            <Folder className="h-4 w-4 text-primary shrink-0" />
            <span
              className="text-xs font-semibold text-base-content max-w-[200px] truncate"
              title={report.folderPath}
            >
              {folderName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`badge badge-sm font-semibold text-xs py-2 px-2.5 transition-colors ${
                selectedCount > 0
                  ? "badge-primary text-primary-content"
                  : "badge-error text-error-content"
              }`}
            >
              {selectedCount} / {totalCount} Selected
            </span>

            {report.isMixed ? (
              <span className="badge badge-warning badge-sm text-[11px] font-medium gap-1 hidden sm:inline-flex">
                <Sparkles className="h-3 w-3" />
                Mixed Content
              </span>
            ) : (
              <span className="badge badge-success badge-sm text-[11px] font-medium gap-1 hidden sm:inline-flex">
                <Check className="h-3 w-3" />
                Uniform {report.dominantCategory}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: SELECT ALL & CATEGORY FILTER PILLS */}
        <div className="flex items-center gap-2">
          {/* CATEGORY FILTER PILLS */}
          <div className="join bg-base-200/70 p-0.5 rounded-lg border border-base-content/10">
            <button
              onClick={() => setActiveCategoryFilter("all")}
              className={`join-item btn btn-xs border-0 text-[11px] font-medium ${
                activeCategoryFilter === "all"
                  ? "btn-primary"
                  : "btn-ghost text-base-content/70 hover:text-base-content"
              }`}
            >
              All ({totalCount})
            </button>

            {Object.entries(report.categoryCounts).map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setActiveCategoryFilter(cat)}
                className={`join-item btn btn-xs border-0 text-[11px] font-medium capitalize ${
                  activeCategoryFilter === cat
                    ? "btn-primary"
                    : "btn-ghost text-base-content/70 hover:text-base-content"
                }`}
              >
                {cat === "portrait" && "👤 "}
                {cat === "anime" && "🎨 "}
                {cat === "photo" && "📷 "}
                {cat === "graphic" && "💻 "}
                {cat} ({count})
              </button>
            ))}
          </div>

          {/* BULK SELECTION TOGGLE */}
          <button
            onClick={handleToggleSelectAll}
            className="btn btn-outline btn-xs gap-1.5 font-semibold text-xs ml-1"
          >
            {allSelected ? (
              <>
                <Square className="h-3.5 w-3.5 text-base-content/60" />
                Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                Select All ({totalCount})
              </>
            )}
          </button>
        </div>
      </div>

      {/* THUMBNAIL GALLERY GRID */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center text-base-content/50">
            <Filter className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">
              No images match category "{activeCategoryFilter}"
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-8">
            {filteredItems.map((item) => {
              const isSelected = selectedFiles.includes(item.filename);
              const assignedModel =
                modelMapping[item.filename] || item.suggestedModel;

              return (
                <div
                  key={item.filename}
                  onClick={() => toggleFile(item.filename)}
                  className={`group relative flex flex-col rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200 select-none ${
                    isSelected
                      ? "border-primary/70 bg-base-100 shadow-md hover:border-primary hover:shadow-lg"
                      : "border-base-content/10 bg-base-200/50 opacity-40 grayscale-[0.6] hover:opacity-75 hover:grayscale-0"
                  }`}
                >
                  {/* THUMBNAIL IMAGE CONTAINER */}
                  <div className="relative aspect-square w-full overflow-hidden bg-base-300">
                    <img
                      src={"file:///" + sanitizePath(item.path)}
                      alt={item.filename}
                      loading="lazy"
                      draggable="false"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />

                    {/* TOP-LEFT: CHECKBOX BUTTON */}
                    <div
                      onClick={(e) => toggleFile(item.filename, e)}
                      className="absolute top-2 left-2 z-10 rounded-md p-1 backdrop-blur-md bg-black/60 transition-transform active:scale-95"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Controlled by parent div
                        className="checkbox checkbox-xs checkbox-primary pointer-events-none"
                      />
                    </div>

                    {/* TOP-RIGHT: CATEGORY TAG BADGE */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md px-1.5 py-0.5 backdrop-blur-md bg-black/60 text-[10px] font-semibold text-white/90">
                      {getCategoryIcon(item.category)}
                      <span className="capitalize">{item.tag || item.category}</span>
                    </div>

                    {/* SELECTION OVERLAY GLOW WHEN HOVERING UNCHECKED */}
                    {!isSelected && (
                      <div className="absolute inset-0 bg-base-content/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="badge badge-neutral text-xs font-medium">
                          Click to include
                        </span>
                      </div>
                    )}
                  </div>

                  {/* BOTTOM INFO BAR */}
                  <div className="flex flex-col gap-0.5 p-2 bg-base-100/95 border-t border-base-content/5">
                    <p
                      className="text-xs font-medium truncate text-base-content"
                      title={item.filename}
                    >
                      {item.filename}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-base-content/70">
                      <span
                        className="truncate font-mono text-primary font-semibold"
                        title={
                          useAdaptiveBatch
                            ? `Model: ${assignedModel}`
                            : "Using Global Model from Step 2"
                        }
                      >
                        {useAdaptiveBatch ? assignedModel : "Step 2 Model"}
                      </span>
                      <span className="shrink-0 text-base-content/50 ml-1">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER BAR: SUMMARY & HINT */}
      <div className="flex items-center justify-between border-t border-base-content/10 bg-base-100/80 px-5 py-2 text-xs text-base-content/70 backdrop-blur-md">
        <span>
          💡 Click any thumbnail or checkbox to exclude/include images from batch upscaling.
        </span>
        <span className="font-semibold text-base-content">
          {selectedCount} of {totalCount} images ready
        </span>
      </div>
    </div>
  );
}
