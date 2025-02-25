// hooks/useCursorManager.ts
import { useEffect } from "react";
import { useBuilder } from "@/builder/context/builderState";

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
    setIsFrameModeActive,
    setIsTextModeActive,
    dragState,
    isMovingCanvas,
    isResizing,
    isRotating,
  } = useBuilder();

  // Set up the cursor and selection styles based on current modes
  useEffect(() => {
    // Determine appropriate cursor
    if (isFrameModeActive) {
      document.body.style.cursor = "crosshair";
      Object.assign(document.body.style, preventSelectStyle);
    } else if (isTextModeActive) {
      document.body.style.cursor = "text";
      Object.assign(document.body.style, preventSelectStyle);
    } else if (dragState.isDragging) {
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

    return () => {
      // Cleanup styles when component unmounts
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
      document.body.style.WebkitUserSelect = "";
      document.body.style.MozUserSelect = "";
      document.body.style.msUserSelect = "";
    };
  }, [
    isFrameModeActive,
    isTextModeActive,
    isMovingCanvas,
    isResizing,
    isRotating,
    dragState.isDragging,
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
  };
};
