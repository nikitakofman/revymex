// hooks/useCursorManager.ts
import { useEffect, useState } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useGetIsDragging } from "../atoms/drag-store";

// Define preventSelectStyle as a constant
const preventSelectStyle = {
  userSelect: "none",
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
} as const;

export const useCursorManager = () => {
  const {
    isFrameModeActive,
    isTextModeActive,
    isMoveCanvasMode, // Add this from the BuilderContext
    setIsFrameModeActive,
    setIsTextModeActive,
    dragState,
    isMovingCanvas,
    isResizing,
    isRotating,
  } = useBuilder();

  const getIsDragging = useGetIsDragging();

  // Set up the cursor and selection styles based on current modes
  useEffect(() => {
    const isDragging = getIsDragging();
    // Mouse move handler to check if we're over toolbars
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isOverToolbar =
        target.closest(".right-toolbar") ||
        target.closest(".left-toolbar") ||
        target.closest(".bottom-toolbar") ||
        target.closest(".header") ||
        target.closest(".left-menu");

      if (isOverToolbar) {
        // When over toolbars, use default cursor
        document.body.style.cursor = "default";
      } else if (isFrameModeActive) {
        document.body.style.cursor = "crosshair";
        Object.assign(document.body.style, preventSelectStyle);
      } else if (isTextModeActive) {
        document.body.style.cursor = "text";
        Object.assign(document.body.style, preventSelectStyle);
      } else if (isMoveCanvasMode) {
        // When in move canvas mode but not actively moving
        document.body.style.cursor = isMovingCanvas ? "grabbing" : "grab";
        Object.assign(document.body.style, preventSelectStyle);
      } else {
        // Default cursor
        document.body.style.cursor = "default";
        document.body.style.userSelect = "";
        document.body.style.WebkitUserSelect = "";
        document.body.style.MozUserSelect = "";
        document.body.style.msUserSelect = "";
      }
    };

    // Initial cursor setup based on current state
    if (isFrameModeActive || isTextModeActive) {
      // Apply initial drawing cursor, but it will be overridden
      // by the mouse move handler if over toolbars
      document.body.style.cursor = isFrameModeActive ? "crosshair" : "text";
      Object.assign(document.body.style, preventSelectStyle);
    } else if (isMoveCanvasMode) {
      // Set grab cursor when in move canvas mode
      document.body.style.cursor = isMovingCanvas ? "grabbing" : "grab";
      Object.assign(document.body.style, preventSelectStyle);
    } else if (isDragging) {
      document.body.style.cursor = "move";
      Object.assign(document.body.style, preventSelectStyle);
    } else {
      // Default cursor
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
      document.body.style.WebkitUserSelect = "";
      document.body.style.MozUserSelect = "";
      document.body.style.msUserSelect = "";
    }

    // Add mouse move listener
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      // Cleanup styles when component unmounts
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
      document.body.style.WebkitUserSelect = "";
      document.body.style.MozUserSelect = "";
      document.body.style.msUserSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [
    isFrameModeActive,
    isTextModeActive,
    isMoveCanvasMode, // Add this dependency
    isMovingCanvas,
    isResizing,
    isRotating,
    getIsDragging,
  ]);

  // Handle keyboard shortcuts for drawing modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f" && !e.repeat) {
        setIsFrameModeActive(true);
        setIsTextModeActive(false);
      } else if (e.key.toLowerCase() === "t" && !e.repeat) {
        setIsTextModeActive(true);
        setIsFrameModeActive(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") {
        setIsFrameModeActive(false);
      } else if (e.key.toLowerCase() === "t") {
        setIsTextModeActive(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setIsFrameModeActive, setIsTextModeActive]);

  // Return any values that might be needed by components using this hook
  return {
    isDrawingMode: isFrameModeActive || isTextModeActive,
    isMoveMode: isMoveCanvasMode,
  };
};
