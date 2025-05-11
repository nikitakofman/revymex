// src/builder/context/hooks/useDragAutoScroll.ts
import { useRef, useEffect, useCallback } from "react";
import { useBuilderRefs } from "@/builder/context/builderState";
import { canvasOps } from "../atoms/canvas-interaction-store";
import { useGetIsDragging, useGetDraggedNode } from "../atoms/drag-store";

// Edge sizes for auto-scrolling
export const VERTICAL_EDGE_SIZE = 50; // Top and bottom edges
export const LEFT_EDGE_SIZE = 309; // Left edge
export const RIGHT_EDGE_SIZE = 256; // Right edge
const MAX_SCROLL_SPEED = 4;
const MIN_SCROLL_SPEED = 0.5;

export const useDragAutoScroll = () => {
  // Get necessary refs and state
  const { containerRef } = useBuilderRefs();
  const isDragging = useGetIsDragging();
  const getDraggedNode = useGetDraggedNode();

  // Animation frame reference for smooth scrolling
  const scrollAnimationRef = useRef<number | null>(null);

  // Current mouse position for scrolling calculations
  const currentMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Calculate scroll directions and speeds based on mouse position
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

      // Calculate scroll speed based on distance from edge
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

  // Stop auto-scrolling
  const stopAutoScroll = useCallback(() => {
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    currentMousePosRef.current = null;
  }, []);

  // Update mouse position for auto-scrolling
  const updateMousePosition = useCallback(
    (clientX: number, clientY: number) => {
      currentMousePosRef.current = { x: clientX, y: clientY };

      // If we're not already scrolling, start the scroll animation
      if (!scrollAnimationRef.current && isDragging()) {
        const scroll = () => {
          if (
            !currentMousePosRef.current ||
            !containerRef.current ||
            !isDragging()
          ) {
            stopAutoScroll();
            return;
          }

          const { x: clientX, y: clientY } = currentMousePosRef.current;
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
            canvasOps.setTransform({
              ...currentTransform,
              x: currentTransform.x + left + right,
              y: currentTransform.y + up + down,
            });
            scrollAnimationRef.current = requestAnimationFrame(scroll);
          } else {
            stopAutoScroll();
          }
        };

        scrollAnimationRef.current = requestAnimationFrame(scroll);
      }
    },
    [calculateScrollDirections, stopAutoScroll, isDragging, containerRef]
  );

  // Set up mouse move listener to track position during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging()) {
        updateMousePosition(e.clientX, e.clientY);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      stopAutoScroll();
    };
  }, [isDragging, updateMousePosition, stopAutoScroll]);

  // Clean up auto-scroll when dragging ends
  useEffect(() => {
    if (!isDragging()) {
      stopAutoScroll();
    }
  }, [isDragging, stopAutoScroll]);

  return {
    updateMousePosition,
    stopAutoScroll,
  };
};
