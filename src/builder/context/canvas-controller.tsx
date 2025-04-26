// src/builder/context/canvasHelpers/CanvasController.tsx
import React, { useRef, useEffect, useCallback } from "react";
import { useIsPreviewOpen } from "@/builder/context/atoms/interface-store";
import {
  canvasOps,
  useTransform,
  useIsMovingCanvas,
  useIsMiddleMouseDown,
} from "@/builder/context/atoms/canvas-interaction-store";

interface CanvasControllerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
}

// Create a separate transform manager outside of React's lifecycle
// This helps prevent React's rendering from interfering with smooth panning
const createTransformManager = () => {
  // Current transform state
  let currentTransform = { x: 480, y: 200, scale: 0.3 };
  let isControlling = false;
  let contentElement: HTMLElement | null = null;

  const applyTransform = () => {
    if (!contentElement) return;

    contentElement.style.transform = `translate3d(${currentTransform.x}px, ${currentTransform.y}px, 0) scale(${currentTransform.scale})`;
  };

  return {
    initialize: (
      element: HTMLElement,
      initialTransform: { x: number; y: number; scale: number }
    ) => {
      contentElement = element;
      currentTransform = { ...initialTransform };
      applyTransform();
    },

    startControlling: () => {
      isControlling = true;
    },

    stopControlling: () => {
      isControlling = false;
    },

    isControlling: () => isControlling,

    getCurrentTransform: () => ({ ...currentTransform }),

    updateTransform: (newTransform: {
      x: number;
      y: number;
      scale: number;
    }) => {
      currentTransform = { ...newTransform };
      applyTransform();
    },

    updateFromDOM: () => {
      if (!contentElement) return currentTransform;

      const transformStr = contentElement.style.transform;
      const match = transformStr.match(
        /translate3d\(([^,]+)px,\s*([^,]+)px,\s*[^)]+\)\s*scale\(([^)]+)\)/
      );

      if (match) {
        currentTransform = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          scale: parseFloat(match[3]),
        };
      }

      return currentTransform;
    },

    applyTransform,

    pan: (deltaX: number, deltaY: number) => {
      currentTransform.x += deltaX;
      currentTransform.y += deltaY;
      applyTransform();
      return currentTransform;
    },

    zoom: (mouseX: number, mouseY: number, scaleDelta: number) => {
      // Constrain scale between 0.1 and 4
      const newScale = Math.min(
        Math.max(0.1, currentTransform.scale + scaleDelta),
        4
      );

      // Calculate the point in canvas coordinates
      const pointX = (mouseX - currentTransform.x) / currentTransform.scale;
      const pointY = (mouseY - currentTransform.y) / currentTransform.scale;

      // Apply new position and scale
      currentTransform.x = mouseX - pointX * newScale;
      currentTransform.y = mouseY - pointY * newScale;
      currentTransform.scale = newScale;

      applyTransform();
      return currentTransform;
    },
  };
};

// Create a single instance of the transform manager
const transformManager = createTransformManager();

const CanvasController: React.FC<CanvasControllerProps> = ({
  containerRef,
  contentRef,
}) => {
  // State from atoms
  const transform = useTransform();
  const isMovingCanvas = useIsMovingCanvas();
  const isMiddleMouseDown = useIsMiddleMouseDown();
  const isPreviewOpen = useIsPreviewOpen();

  // Local refs
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wheelHandlerAttached = useRef(false);
  const hasMoved = useRef(false);

  // Initialize transform manager with content element and initial transform
  useEffect(() => {
    if (contentRef.current) {
      transformManager.initialize(contentRef.current, transform);
    }
  }, [contentRef, transform.x, transform.y, transform.scale]);

  // Middle mouse button panning
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Check if it's the middle mouse button (button === 1)
      if (e.button === 1) {
        e.preventDefault();
        canvasOps.setIsMiddleMouseDown(true);
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        hasMoved.current = false;

        // Take control of the transform
        transformManager.startControlling();

        if (containerRef.current) {
          containerRef.current.style.cursor = "grabbing";
        }

        // Signal that canvas is moving - for UI feedback
        canvasOps.setIsMovingCanvas(true);
      }
    },
    [containerRef]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isMiddleMouseDown && containerRef.current && !isPreviewOpen) {
        e.preventDefault();

        // Calculate the delta from the last position
        const deltaX = e.clientX - lastMousePosRef.current.x;
        const deltaY = e.clientY - lastMousePosRef.current.y;

        // Update the last position
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        // Mark as moved if the values actually changed
        if (deltaX !== 0 || deltaY !== 0) {
          hasMoved.current = true;

          // Apply pan directly through transform manager
          transformManager.pan(deltaX, deltaY);
        }

        // Clear any existing timer to prevent jitter
        if (moveTimerRef.current) {
          clearTimeout(moveTimerRef.current);
          moveTimerRef.current = null;
        }
      }
    },
    [isMiddleMouseDown, containerRef, isPreviewOpen]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (e.button === 1 || isMiddleMouseDown) {
        e.preventDefault();
        canvasOps.setIsMiddleMouseDown(false);

        if (containerRef.current) {
          containerRef.current.style.cursor = "";
        }

        // TEST: Skip updating the atom store
        // if (hasMoved.current) {
        //   const finalTransform = transformManager.getCurrentTransform();
        //   setTimeout(() => {
        //     canvasOps.setTransform(finalTransform);
        //   }, 0);
        // }

        // Reset isMovingCanvas with a slight delay
        setTimeout(() => {
          canvasOps.setIsMovingCanvas(false);
          transformManager.stopControlling();
        }, 100);

        if (moveTimerRef.current) {
          clearTimeout(moveTimerRef.current);
          moveTimerRef.current = null;
        }

        hasMoved.current = false;
      }
    },
    [isMiddleMouseDown, containerRef]
  );

  // Wheel handling for panning and zooming
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (!containerRef.current || isPreviewOpen) return;

      // Take control of the transform
      transformManager.startControlling();

      // Signal that canvas is moving
      canvasOps.setIsMovingCanvas(true);

      if (e.ctrlKey || e.metaKey) {
        // Zooming behavior
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = -e.deltaY * 0.01;

        // Apply zoom directly through transform manager
        transformManager.zoom(mouseX, mouseY, delta);
      } else {
        // Panning behavior
        transformManager.pan(-e.deltaX, -e.deltaY);
      }

      // Clear any existing timer
      if (moveTimerRef.current) {
        clearTimeout(moveTimerRef.current);
      }

      moveTimerRef.current = setTimeout(() => {
        // TEST: Skip updating the atom store
        // const finalTransform = transformManager.getCurrentTransform();
        // canvasOps.setTransform(finalTransform);

        // Reset isMovingCanvas with a slight delay
        setTimeout(() => {
          canvasOps.setIsMovingCanvas(false);
          transformManager.stopControlling();
        }, 100);
      }, 150);
    },
    [containerRef, isPreviewOpen]
  );

  // Synchronize with atom state when not actively controlling the transform
  useEffect(() => {
    if (
      !transformManager.isControlling() &&
      !isMovingCanvas &&
      !isMiddleMouseDown &&
      contentRef.current
    ) {
      transformManager.updateTransform(transform);
    }
  }, [transform, contentRef, isMovingCanvas, isMiddleMouseDown]);

  // Attach/detach event listeners
  const attachEventListeners = useCallback(() => {
    const container = containerRef.current;
    if (!container || wheelHandlerAttached.current) return;

    // Use passive: false to prevent default browser behavior
    container.addEventListener("wheel", handleWheel, { passive: false });

    // Attach middle mouse handlers
    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mouseleave", handleMouseUp);

    wheelHandlerAttached.current = true;
  }, [
    containerRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  ]);

  const detachEventListeners = useCallback(() => {
    const container = containerRef.current;
    if (!container || !wheelHandlerAttached.current) return;

    // Detach wheel handler
    container.removeEventListener("wheel", handleWheel);

    // Detach middle mouse handlers
    container.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("mouseleave", handleMouseUp);

    wheelHandlerAttached.current = false;
  }, [
    containerRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  ]);

  // Attach/detach event listeners based on preview state
  useEffect(() => {
    if (isPreviewOpen) {
      detachEventListeners();
    } else {
      attachEventListeners();
    }

    return () => {
      detachEventListeners();
    };
  }, [isPreviewOpen, attachEventListeners, detachEventListeners]);

  // This component doesn't render anything, it just attaches event listeners
  return null;
};

export default CanvasController;
