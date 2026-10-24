import React, { useEffect } from "react";
import { ReactCompareSlider } from "react-compare-slider";
import useTranslation from "../hooks/use-translation";
import { useMouseZoom } from "../hooks/use-mouse-zoom";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface SliderViewProps {
  sanitizedImagePath: string;
  sanitizedUpscaledImagePath: string;
  zoomAmount?: string;
  setZoomAmount?: (val: string) => void;
}

const SliderView: React.FC<SliderViewProps> = ({
  sanitizedImagePath,
  sanitizedUpscaledImagePath,
  zoomAmount,
  setZoomAmount,
}) => {
  const t = useTranslation();

  const {
    zoom,
    origin,
    pan,
    isDragging,
    containerRef,
    resetZoom,
    zoomIn,
    zoomOut,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleContextMenu,
    zoomPercent,
    setZoom,
  } = useMouseZoom({
    minZoom: 1.0,
    maxZoom: 12.0,
    initialZoom: zoomAmount ? Math.max(1, parseInt(zoomAmount) / 100) : 1.0,
    onZoomChange: (newZoom) => {
      setZoomAmount?.(String(Math.round(newZoom * 100)));
    },
  });

  // Sync if drawer changes zoomAmount
  useEffect(() => {
    if (zoomAmount) {
      const parsed = Math.max(1, parseInt(zoomAmount) / 100);
      if (Math.abs(parsed - zoom) > 0.05) {
        setZoom(parsed);
      }
    }
  }, [zoomAmount]);

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full select-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      onDoubleClick={(e) => {
        if (zoom > 1.0) {
          e.stopPropagation();
          resetZoom();
        }
      }}
      style={{
        cursor: isDragging ? "grabbing" : zoom > 1.0 ? "grab" : "default",
      }}
    >
      <div
        className="h-full w-full"
        style={{
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transition: isDragging ? "none" : "transform 0.08s ease-out",
        }}
      >
        <ReactCompareSlider
          itemOne={
            <>
              <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {t("APP.SLIDER.ORIGINAL_TITLE")}
              </p>
              <img
                src={"file:///" + sanitizedImagePath}
                alt={t("APP.SLIDER.ORIGINAL_TITLE")}
                draggable="false"
                className="h-full w-full object-contain pointer-events-none"
              />
            </>
          }
          itemTwo={
            <>
              <p className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {t("APP.SLIDER.UPSCAYLED_TITLE")}
              </p>
              <img
                src={"file:///" + sanitizedUpscaledImagePath}
                alt={t("APP.SLIDER.UPSCAYLED_TITLE")}
                draggable="false"
                className="h-full w-full object-contain pointer-events-none"
              />
            </>
          }
          className="group h-screen w-full"
        />
      </div>

      {/* FLOATING ZOOM HUD OVERLAY */}
      {zoom > 1.0 && (
        <div
          className="absolute bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-base-content/15 bg-base-300/85 px-3 py-1.5 shadow-2xl backdrop-blur-md select-none transition-all"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-xs h-6 w-6 hover:bg-base-content/20"
            onClick={(e) => {
              e.stopPropagation();
              zoomOut();
            }}
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>

          <span className="min-w-[3.5rem] text-center text-xs font-semibold tabular-nums text-base-content">
            {zoomPercent}%
          </span>

          <button
            type="button"
            className="btn btn-ghost btn-circle btn-xs h-6 w-6 hover:bg-base-content/20"
            onClick={(e) => {
              e.stopPropagation();
              zoomIn();
            }}
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>

          <div className="h-3.5 w-[1px] bg-base-content/20" />

          <button
            type="button"
            className="btn btn-ghost btn-xs h-6 rounded-full px-2 text-[11px] font-medium text-base-content/90 hover:bg-base-content/20"
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
            }}
            title="Reset Zoom (Double click)"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export default SliderView;
