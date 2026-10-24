import React, { useEffect } from "react";
import { sanitizePath } from "@common/sanitize-path";
import { useMouseZoom } from "../hooks/use-mouse-zoom";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageViewerProps {
  imagePath: string;
  setDimensions: (dimensions: { width: number; height: number }) => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  imagePath,
  setDimensions,
}) => {
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
  } = useMouseZoom({
    minZoom: 1.0,
    maxZoom: 12.0,
  });

  // Reset zoom whenever image changes
  useEffect(() => {
    resetZoom();
  }, [imagePath, resetZoom]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full select-none items-center justify-center overflow-hidden"
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
      <img
        src={"file:///" + sanitizePath(imagePath)}
        onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
          setDimensions({
            width: e.currentTarget.naturalWidth,
            height: e.currentTarget.naturalHeight,
          });
        }}
        draggable="false"
        alt="Input Preview"
        className="h-full w-full object-contain pointer-events-none"
        style={{
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transition: isDragging ? "none" : "transform 0.08s ease-out",
        }}
      />

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

export default ImageViewer;
