import React, { useRef, useEffect, useCallback } from "react";
import { useIsPreviewOpen } from "@/builder/context/atoms/interface-store";
import {
  canvasOps,
  useGetTransform,
  useIsMovingCanvas,
  useIsMiddleMouseDown,
} from "@/builder/context/atoms/canvas-interaction-store";
import {
  useGetIsDragging,
  useGetDraggedNode,
} from "@/builder/context/atoms/drag-store";

const VERTICAL_EDGE_SIZE = 50;
const LEFT_EDGE_SIZE = 309;
const RIGHT_EDGE_SIZE = 256;
const MAX_SCROLL_SPEED = 4;
const MIN_SCROLL_SPEED = 0.5;

interface CanvasControllerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
}

const createTransformManager = () => {
  let currentTransform = { x: 480, y: 200, scale: 0.3 };
  let isControlling = false;
  let contentElement: HTMLElement | null = null;
  let rafId: number | null = null;

  const applyTransform = () => {
    if (!contentElement) return;
    contentElement.style.transform = `translate3d(${currentTransform.x}px, ${currentTransform.y}px, 0) scale(${currentTransform.scale})`;
  };

  const scheduleFlush = () => {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      applyTransform();
    });
  };

  return {
    initialize: (
      element: HTMLElement,
      initialTransform: { x: number; y: number; scale: number }
    ) => {
      contentElement = element;
      currentTransform = { ...initialTransform };
      scheduleFlush();
    },

    startControlling: () => {
      isControlling = true;
    },

    stopControlling: () => {
      isControlling = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },

    isControlling: () => isControlling,

    getCurrentTransform: () => ({ ...currentTransform }),

    updateTransform: (newTransform: {
      x: number;
      y: number;
      scale: number;
    }) => {
      if (!isControlling) {
        currentTransform = { ...newTransform };
        scheduleFlush();
      }
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
      if (!isControlling) return currentTransform;
      currentTransform.x += deltaX;
      currentTransform.y += deltaY;
      scheduleFlush();
      return currentTransform;
    },

    zoom: (mouseX: number, mouseY: number, scaleDelta: number) => {
      if (!isControlling) return currentTransform;
      const newScale = Math.min(
        Math.max(0.1, currentTransform.scale + scaleDelta),
        4
      );
      const pointX = (mouseX - currentTransform.x) / currentTransform.scale;
      const pointY = (mouseY - currentTransform.y) / currentTransform.scale;
      currentTransform.x = mouseX - pointX * newScale;
      currentTransform.y = mouseY - pointY * newScale;
      currentTransform.scale = newScale;
      scheduleFlush();
      return currentTransform;
    },
  };
};

const transformManager = createTransformManager();

const CanvasController: React.FC<CanvasControllerProps> = ({
  containerRef,
  contentRef,
}) => {
  const getTransform = useGetTransform();
  const isMovingCanvas = useIsMovingCanvas();
  const isMiddleMouseDown = useIsMiddleMouseDown();
  const isPreviewOpen = useIsPreviewOpen();

  const getIsDragging = useGetIsDragging();
  const getDraggedNode = useGetDraggedNode();

  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wheelHandlerAttached = useRef(false);
  const hasMoved = useRef(false);
  const isInitializedRef = useRef(false);

  const scrollAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    if (contentRef.current && !isInitializedRef.current) {
      const transform = getTransform();
      transformManager.initialize(contentRef.current, transform);
      isInitializedRef.current = true;
    }
  }, [contentRef, getTransform]);

  const calculateScrollDirections = useCallback(
    (clientX: number, clientY: number, containerRect: DOMRect) => {
      const distanceFromTop = Math.max(0, clientY - containerRect.top);
      const distanceFromBottom = Math.max(0, containerRect.bottom - clientY);
      const distanceFromLeft = Math.max(0, clientX - containerRect.left);
      const distanceFromRight = Math.max(0, containerRect.right - clientX);

      const isInsideCanvas =
        clientX >= containerRect.left &&
        clientX <= containerRect.right &&
        clientY >= containerRect.top &&
        clientY <= containerRect.bottom;

      if (!isInsideCanvas) {
        return { left: 0, right: 0, up: 0, down: 0 };
      }

      const getScrollSpeed = (distance: number, edgeSize: number): number => {
        if (distance > edgeSize) return 0;
        const distancePercent = distance / edgeSize;
        const speedFactor = Math.pow(1 - distancePercent, 2);
        return (
          MIN_SCROLL_SPEED + (MAX_SCROLL_SPEED - MIN_SCROLL_SPEED) * speedFactor
        );
      };

      return {
        left:
          distanceFromLeft <= LEFT_EDGE_SIZE
            ? getScrollSpeed(distanceFromLeft, LEFT_EDGE_SIZE)
            : 0,
        right:
          distanceFromRight <= RIGHT_EDGE_SIZE
            ? -getScrollSpeed(distanceFromRight, RIGHT_EDGE_SIZE)
            : 0,
        up:
          distanceFromTop <= VERTICAL_EDGE_SIZE
            ? getScrollSpeed(distanceFromTop, VERTICAL_EDGE_SIZE)
            : 0,
        down:
          distanceFromBottom <= VERTICAL_EDGE_SIZE
            ? -getScrollSpeed(distanceFromBottom, VERTICAL_EDGE_SIZE)
            : 0,
      };
    },
    []
  );

  const isNearEdge = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return false;

      const containerRect = containerRef.current.getBoundingClientRect();

      const isNearLeftEdge = clientX <= containerRect.left + LEFT_EDGE_SIZE;
      const isNearRightEdge = clientX >= containerRect.right - RIGHT_EDGE_SIZE;
      const isNearTopEdge = clientY <= containerRect.top + VERTICAL_EDGE_SIZE;
      const isNearBottomEdge =
        clientY >= containerRect.bottom - VERTICAL_EDGE_SIZE;

      const isInside =
        clientX >= containerRect.left &&
        clientX <= containerRect.right &&
        clientY >= containerRect.top &&
        clientY <= containerRect.bottom;

      return (
        isInside &&
        (isNearLeftEdge || isNearRightEdge || isNearTopEdge || isNearBottomEdge)
      );
    },
    [containerRef]
  );

  const stopAutoScroll = useCallback(() => {
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;

      // Update the global transform state with the current transform when auto-scroll stops
      if (contentRef.current) {
        // Save the latest transform applied to the DOM
        const currentTransform = transformManager.updateFromDOM();

        // Update the global state with the current transform
        canvasOps.setTransform(currentTransform);

        // Also make sure transformManager knows we're no longer controlling the transform
        transformManager.stopControlling();

        // Force a synchronization between the canvas visual state and the state management
        const transform = canvasOps.getState().transform;
        transformManager.updateTransform(transform);
      }
    }
  }, [contentRef]);

  const handleDragAutoScroll = useCallback(
    (e: MouseEvent) => {
      const isDragging = getIsDragging();
      if (!isDragging || !containerRef.current || isPreviewOpen) {
        if (scrollAnimationRef.current) {
          stopAutoScroll();
        }
        return;
      }

      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (isNearEdge(e.clientX, e.clientY)) {
        if (!scrollAnimationRef.current) {
          const scroll = () => {
            if (
              !getIsDragging() ||
              !containerRef.current ||
              !contentRef.current
            ) {
              stopAutoScroll();
              return;
            }

            const { x: clientX, y: clientY } = lastMousePosRef.current;
            const containerRect = containerRef.current.getBoundingClientRect();
            const { left, right, up, down } = calculateScrollDirections(
              clientX,
              clientY,
              containerRect
            );

            const shouldScroll =
              left !== 0 || right !== 0 || up !== 0 || down !== 0;

            if (shouldScroll) {
              const currentTransform = canvasOps.getState().transform;

              const newTransform = {
                ...currentTransform,
                x: currentTransform.x + left + right,
                y: currentTransform.y + up + down,
              };

              canvasOps.setTransform(newTransform);

              if (contentRef.current) {
                contentRef.current.style.transform = `translate3d(${newTransform.x}px, ${newTransform.y}px, 0) scale(${newTransform.scale})`;
              }

              scrollAnimationRef.current = requestAnimationFrame(scroll);
            } else {
              stopAutoScroll();
            }
          };

          scrollAnimationRef.current = requestAnimationFrame(scroll);
        }
      } else if (scrollAnimationRef.current) {
        stopAutoScroll();
      }
    },
    [
      getIsDragging,
      containerRef,
      isPreviewOpen,
      isNearEdge,
      calculateScrollDirections,
      stopAutoScroll,
    ]
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button === 1) {
        e.preventDefault();

        const container = containerRef.current;
        if (container) {
          container.setPointerCapture(e.pointerId);
        }

        canvasOps.setIsMiddleMouseDown(true);
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        hasMoved.current = false;

        transformManager.startControlling();

        if (containerRef.current) {
          containerRef.current.style.cursor = "grabbing";
        }

        canvasOps.setIsMovingCanvas(true);
      }
    },
    [containerRef]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (isMiddleMouseDown && containerRef.current && !isPreviewOpen) {
        e.preventDefault();

        const deltaX = e.clientX - lastMousePosRef.current.x;
        const deltaY = e.clientY - lastMousePosRef.current.y;

        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        if (deltaX !== 0 || deltaY !== 0) {
          hasMoved.current = true;
          transformManager.pan(deltaX, deltaY);
        }

        if (moveTimerRef.current) {
          clearTimeout(moveTimerRef.current);
          moveTimerRef.current = null;
        }
      }
    },
    [isMiddleMouseDown, containerRef, isPreviewOpen]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (e.button === 1 || isMiddleMouseDown) {
        e.preventDefault();
        canvasOps.setIsMiddleMouseDown(false);

        if (containerRef.current) {
          containerRef.current.style.cursor = "";
          try {
            containerRef.current.releasePointerCapture(e.pointerId);
          } catch (err) {}
        }

        transformManager.stopControlling();

        if (hasMoved.current) {
          requestAnimationFrame(() => {
            const finalTransform = transformManager.getCurrentTransform();
            canvasOps.setTransform(finalTransform);
            canvasOps.setIsMovingCanvas(false);
          });
        } else {
          canvasOps.setIsMovingCanvas(false);
        }

        if (moveTimerRef.current) {
          clearTimeout(moveTimerRef.current);
          moveTimerRef.current = null;
        }

        hasMoved.current = false;
      }
    },
    [isMiddleMouseDown, containerRef]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (!containerRef.current || isPreviewOpen) return;

      transformManager.startControlling();
      canvasOps.setIsMovingCanvas(true);

      if (e.ctrlKey || e.metaKey) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = -e.deltaY * 0.01;
        transformManager.zoom(mouseX, mouseY, delta);
      } else {
        transformManager.pan(-e.deltaX, -e.deltaY);
      }

      if (moveTimerRef.current) {
        clearTimeout(moveTimerRef.current);
      }

      moveTimerRef.current = setTimeout(() => {
        transformManager.stopControlling();
        requestAnimationFrame(() => {
          const finalTransform = transformManager.getCurrentTransform();
          canvasOps.setTransform(finalTransform);
          canvasOps.setIsMovingCanvas(false);
        });
      }, 150);
    },
    [containerRef, isPreviewOpen]
  );

  useEffect(() => {
    if (
      !transformManager.isControlling() &&
      !isMovingCanvas &&
      !isMiddleMouseDown &&
      contentRef.current
    ) {
      const transform = getTransform();
      transformManager.updateTransform(transform);
    }
  }, [getTransform, contentRef, isMovingCanvas, isMiddleMouseDown]);

  const attachEventListeners = useCallback(() => {
    const container = containerRef.current;
    if (!container || wheelHandlerAttached.current) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    wheelHandlerAttached.current = true;
  }, [
    containerRef,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  ]);

  const detachEventListeners = useCallback(() => {
    const container = containerRef.current;
    if (!container || !wheelHandlerAttached.current) return;

    container.removeEventListener("wheel", handleWheel);
    container.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);

    wheelHandlerAttached.current = false;
  }, [
    containerRef,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  ]);

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

  useEffect(() => {
    if (isPreviewOpen) return;

    window.addEventListener("mousemove", handleDragAutoScroll);

    return () => {
      window.removeEventListener("mousemove", handleDragAutoScroll);
      stopAutoScroll();
    };
  }, [handleDragAutoScroll, isPreviewOpen, stopAutoScroll]);

  useEffect(() => {
    if (!getIsDragging() && scrollAnimationRef.current) {
      stopAutoScroll();
    }
  }, [getIsDragging, stopAutoScroll]);

  return null;
};

export default CanvasController;
