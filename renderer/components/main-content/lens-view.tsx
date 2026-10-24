import React, { useEffect, useMemo, useRef, useState } from "react";

const LensViewer = ({
  sanitizedImagePath,
  sanitizedUpscaledImagePath,
}: {
  sanitizedImagePath: string;
  sanitizedUpscaledImagePath: string;
}) => {
  const originalImageContainerRef = useRef<HTMLDivElement>(null);
  const originalImageRef = useRef<HTMLImageElement>(null);

  const [hoverPosition, setHoverPosition] = useState({
    relativeMouseX: 0,
    mouseY: 0,
    relativeMouseXPercent: 0,
    relativeMouseYPercent: 0,
    originalImageMouseX: 0,
    originalImageMouseY: 0,
  });
  const [zoomLevel, setZoomLevel] = useState(4);

  // Mouse wheel zoom in Lens mode
  useEffect(() => {
    const container = originalImageContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = -e.deltaY;
      setZoomLevel((prev) => {
        if (delta > 0) {
          return Math.min(16, prev + (prev < 4 ? 1 : 2));
        } else {
          return Math.max(2, prev - (prev <= 4 ? 1 : 2));
        }
      });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!originalImageRef.current || !originalImageContainerRef.current) return;

    const containerRect =
      originalImageContainerRef.current.getBoundingClientRect();

    let viewportImageWidth = originalImageRef.current.width;
    let viewportImageHeight = originalImageRef.current.height;
    let imageTop = 0;
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const containerHeight = containerRect.height;
    const containerLeft = containerRect.left;
    const containerTop = containerRect.top;

    const originalImageAspectRatio =
      originalImageRef.current.naturalWidth /
      originalImageRef.current.naturalHeight;
    viewportImageHeight = viewportImageWidth / originalImageAspectRatio;
    imageTop = (containerHeight - viewportImageHeight) / 2;

    const relativeMouseX = mouseX - containerLeft;
    const relativeMouseY = mouseY - imageTop;

    const isWithinImage =
      relativeMouseX >= 0 &&
      relativeMouseX <= viewportImageWidth &&
      relativeMouseY >= 0 &&
      relativeMouseY <= viewportImageHeight;

    if (!isWithinImage) {
      setHoverPosition({
        relativeMouseXPercent: -1000,
        relativeMouseYPercent: -1000,
        relativeMouseX: -1000,
        mouseY: -1000,
        originalImageMouseX: -1000,
        originalImageMouseY: -1000,
      });
      return;
    }

    const relativeMouseXPercent = (relativeMouseX / viewportImageWidth) * 100;
    const relativeMouseYPercent = (relativeMouseY / viewportImageHeight) * 100;

    const bgPosX =
      (relativeMouseX / viewportImageWidth) *
      originalImageRef.current.naturalWidth;
    const bgPosY =
      (relativeMouseY / viewportImageHeight) *
      originalImageRef.current.naturalHeight;

    setHoverPosition({
      relativeMouseXPercent,
      relativeMouseYPercent,
      relativeMouseX,
      mouseY,
      originalImageMouseX: bgPosX,
      originalImageMouseY: bgPosY,
    });
  };

  const originalImage = useMemo(
    () => "file:///" + sanitizedImagePath,
    [sanitizedImagePath],
  );
  const upscaledImage = useMemo(
    () => "file:///" + sanitizedUpscaledImagePath,
    [sanitizedUpscaledImagePath],
  );

  return (
    <div className="group relative flex h-full w-full flex-col items-center">
      {/* Main image container */}
      <div
        className="relative h-full w-full cursor-crosshair select-none"
        ref={originalImageContainerRef}
      >
        <img
          src={originalImage}
          alt="Original"
          className="h-full w-full object-contain pointer-events-none"
          onMouseMove={handleMouseMove}
          ref={originalImageRef}
          draggable="false"
        />
        {/* Lens border indicator */}
        <div
          className="pointer-events-none absolute hidden cursor-cell border-2 border-primary bg-primary/10 shadow-lg group-hover:block"
          style={{
            left: `${hoverPosition.relativeMouseX}px`,
            top: `${hoverPosition.mouseY}px`,
            transform: "translate(-50%, -50%)",
            height: `56px`,
            width: `56px`,
          }}
        />
      </div>

      {/* Enlarged floating views for original and upscaled images */}
      <div
        className="pointer-events-none absolute hidden group-hover:flex shadow-2xl z-40 rounded-lg overflow-hidden border border-base-content/20 bg-base-100"
        style={{
          left: `${hoverPosition.relativeMouseX}px`,
          top: `${hoverPosition.mouseY + 30}px`,
          transform: "translate(-50%, 0)",
        }}
      >
        {/* ORIGINAL IMAGE */}
        <div
          className="relative h-56 w-56 border-r border-base-content/20 bg-cover bg-no-repeat"
          style={{
            backgroundImage: `url(${originalImage})`,
            backgroundPosition: `-${hoverPosition.originalImageMouseX * zoomLevel - 112}px -${hoverPosition.originalImageMouseY * zoomLevel - 112}px`,
            backgroundSize: `${(originalImageRef.current?.naturalWidth || 1) * zoomLevel}px ${(originalImageRef.current?.naturalHeight || 1) * zoomLevel}px`,
          }}
        >
          <span className="absolute bottom-0 w-full bg-black/70 px-2 py-1 text-center text-xs font-semibold text-white backdrop-blur-sm">
            Original ({zoomLevel}x)
          </span>
        </div>
        {/* UPSCALED IMAGE */}
        <div
          className="relative h-56 w-56 bg-cover bg-no-repeat"
          style={{
            backgroundImage: `url(${upscaledImage})`,
            backgroundPosition: `-${hoverPosition.originalImageMouseX * zoomLevel - 112}px -${hoverPosition.originalImageMouseY * zoomLevel - 112}px`,
            backgroundSize: `${(originalImageRef.current?.naturalWidth || 1) * zoomLevel}px ${(originalImageRef.current?.naturalHeight || 1) * zoomLevel}px`,
          }}
        >
          <span className="absolute bottom-0 w-full bg-primary/80 px-2 py-1 text-center text-xs font-semibold text-primary-content backdrop-blur-sm">
            Upscayl AI ({zoomLevel}x)
          </span>
        </div>
      </div>
    </div>
  );
};

export default LensViewer;
