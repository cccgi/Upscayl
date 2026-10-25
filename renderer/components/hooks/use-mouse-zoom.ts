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
  maxZoom = 12.0,
  zoomStep = 0.15,
  initialZoom = 1.0,
  onZoomChange,
}: UseMouseZoomOptions = {}) {
  const [zoom, setZoom] = useState(initialZoom);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  // Keep fresh refs to avoid stale closures in capture-phase listeners
  const panRef = useRef(pan);
  panRef.current = pan;

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const minZoomRef = useRef(minZoom);
  minZoomRef.current = minZoom;

  const maxZoomRef = useRef(maxZoom);
  maxZoomRef.current = maxZoom;

  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const resetZoom = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setOrigin({ x: 50, y: 50 });
    onZoomChangeRef.current?.(1.0);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((prev) => {
      const next = Math.min(maxZoomRef.current, Number((prev * 1.25).toFixed(2)));
      onZoomChangeRef.current?.(next);
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(minZoomRef.current, Number((prev / 1.25).toFixed(2)));
      if (next <= 1.02) {
        resetZoom();
        return 1.0;
      }
      onZoomChangeRef.current?.(next);
      return next;
    });
  }, [resetZoom]);

  // NATIVE CAPTURE-PHASE EVENT LISTENERS
  // Crucial: ReactCompareSlider and other child widgets listen to pointerdown in capture phase
  // and call preventDefault(), which suppresses React's synthetic onMouseDown.
  // Attaching to container in capture phase ensures right-click drag pan works BEFORE/AFTER upscale.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onPointerDownCapture = (e: PointerEvent) => {
      const isRightClick = e.button === 2;
      const isMiddleClick = e.button === 1;
      const isLeftClickZoomed = e.button === 0 && zoomRef.current > 1.05;

      // Do not hijack left click if clicking on UI buttons or the comparison slider handle
      if (e.button === 0) {
        const target = e.target as HTMLElement | null;
        if (
          target?.closest("button") ||
          target?.closest("[data-rcs='handle']") ||
          target?.closest(".rcs-handle")
        ) {
          return;
        }
      }

      if (isRightClick || isMiddleClick || isLeftClickZoomed) {
        // Stop propagation so child widgets (like ReactCompareSlider) don't intercept right/middle click
        if (isRightClick || isMiddleClick) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        e.preventDefault();

        setIsDragging(true);
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: e.clientX - panRef.current.x,
          y: e.clientY - panRef.current.y,
        };
      }
    };

    const onPointerMoveCapture = (e: PointerEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
        setPan({
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        });
      } else if (zoomRef.current <= 1.05) {
        const rect = container.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        setOrigin({ x, y });
      }
    };

    const onPointerUpCapture = (e: PointerEvent) => {
      if (isDraggingRef.current) {
        setIsDragging(false);
        isDraggingRef.current = false;
      }
    };

    const onContextMenuCapture = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const cursorX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const cursorY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      setOrigin({ x: cursorX, y: cursorY });

      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.15 : 1 / 1.15;

      setZoom((prev) => {
        let next = prev * factor;
        if (next < minZoomRef.current || next <= 1.02) {
          setPan({ x: 0, y: 0 });
          next = 1.0;
        } else if (next > maxZoomRef.current) {
          next = maxZoomRef.current;
        }
        next = Number(next.toFixed(2));
        onZoomChangeRef.current?.(next);
        return next;
      });
    };

    const onDblClick = (e: MouseEvent) => {
      if (zoomRef.current > 1.0) {
        e.stopPropagation();
        resetZoom();
      }
    };

    // Attach capture listeners
    container.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    window.addEventListener("pointermove", onPointerMoveCapture, { capture: true });
    window.addEventListener("pointerup", onPointerUpCapture, { capture: true });
    container.addEventListener("contextmenu", onContextMenuCapture, { capture: true });
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("dblclick", onDblClick);

    return () => {
      container.removeEventListener("pointerdown", onPointerDownCapture, { capture: true });
      window.removeEventListener("pointermove", onPointerMoveCapture, { capture: true });
      window.removeEventListener("pointerup", onPointerUpCapture, { capture: true });
      container.removeEventListener("contextmenu", onContextMenuCapture, { capture: true });
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("dblclick", onDblClick);
    };
  }, [resetZoom]);

  // Keep stub React handlers for backward compatibility
  const handleMouseMove = useCallback(() => {}, []);
  const handleMouseDown = useCallback(() => {}, []);
  const handleMouseUp = useCallback(() => {}, []);
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    zoom,
    setZoom,
    origin,
    pan,
    setPan,
    isDragging,
    containerRef,
    resetZoom,
    zoomIn,
    zoomOut,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleContextMenu,
    zoomPercent: Math.round(zoom * 100),
  };
}
