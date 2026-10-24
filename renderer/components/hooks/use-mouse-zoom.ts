import { useState, useEffect, useRef, useCallback } from "react";

interface UseMouseZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export function useMouseZoom({
  minZoom = 1.0,
  maxZoom = 10.0,
  zoomStep = 0.15,
  initialZoom = 1.0,
  onZoomChange,
}: UseMouseZoomOptions = {}) {
  const [zoom, setZoom] = useState(initialZoom);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  const resetZoom = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setOrigin({ x: 50, y: 50 });
    onZoomChange?.(1.0);
  }, [onZoomChange]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => {
      const next = Math.min(maxZoom, Number((prev * 1.25).toFixed(2)));
      onZoomChange?.(next);
      return next;
    });
  }, [maxZoom, onZoomChange]);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(minZoom, Number((prev / 1.25).toFixed(2)));
      if (next <= 1.02) {
        resetZoom();
        return 1.0;
      }
      onZoomChange?.(next);
      return next;
    });
  }, [minZoom, onZoomChange, resetZoom]);

  // Track cursor position to anchor zoom origin
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      if (isDragging) {
        setPan({
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        });
      } else if (zoom <= 1.05) {
        setOrigin({ x, y });
      }
    },
    [isDragging, zoom],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (zoom > 1.0 && (e.button === 0 || e.button === 1)) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.clientX - pan.x,
          y: e.clientY - pan.y,
        };
      }
    },
    [zoom, pan],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach non-passive wheel event listener to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const cursorX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const cursorY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      // Update anchor point to cursor
      setOrigin({ x: cursorX, y: cursorY });

      // Determine zoom direction and factor
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.15 : 1 / 1.15;

      setZoom((prev) => {
        let next = prev * factor;
        if (next < minZoom || next <= 1.02) {
          setPan({ x: 0, y: 0 });
          next = 1.0;
        } else if (next > maxZoom) {
          next = maxZoom;
        }
        next = Number(next.toFixed(2));
        onZoomChange?.(next);
        return next;
      });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, [minZoom, maxZoom, onZoomChange]);

  return {
    zoom,
    setZoom,
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
    zoomPercent: Math.round(zoom * 100),
  };
}
