// hooks/useCursorManager.ts
import { useEffect, useRef } from "react";
import { useGetIsDragging, useIsDragging } from "../atoms/drag-store";
import {
  canvasOps,
  useGetIsFrameModeActive,
  useGetIsMoveCanvasMode,
  useGetIsMovingCanvas,
  useGetIsResizing,
  useGetIsRotating,
  useGetIsTextModeActive,
  useIsFrameModeActive,
  useIsMoveCanvasMode,
  useIsTextModeActive,
} from "../atoms/canvas-interaction-store";

// Define preventSelectStyle as a constant
const preventSelectStyle = {
  userSelect: "none",
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
} as const;

export const useCursorManager = () => {
  // Use refs to track previous state to avoid unnecessary style updates
  const prevCursorStyleRef = useRef("");
  const prevSelectStyleRef = useRef({});

  // console.log(`Cursor Manager re-rendering`, new Date().getTime());

  // Imperative getters for use in effects and event handlers
  const getIsDragging = useGetIsDragging();
  const getMovingCanvas = useGetIsMovingCanvas();
  const getIsMoveCanvasMode = useGetIsMoveCanvasMode();
  const getIsFrameModeActive = useGetIsFrameModeActive();
  const getIsTextModeActive = useGetIsTextModeActive();

  // Set up the cursor and selection styles based on current modes
  useEffect(() => {
    // Use a ref to track if effect is mounted to avoid memory leaks
    const isMounted = { current: true };

    // Function to update cursor style with debounce/optimization
    const updateCursorStyle = (cursorStyle: string, selectStyle: object) => {
      if (!isMounted.current) return;

      // Only update if style actually changed
      if (prevCursorStyleRef.current !== cursorStyle) {
        document.body.style.cursor = cursorStyle;
        prevCursorStyleRef.current = cursorStyle;
      }

      // Only update select style if it changed
      const selectStyleStr = JSON.stringify(selectStyle);
      if (JSON.stringify(prevSelectStyleRef.current) !== selectStyleStr) {
        Object.assign(document.body.style, selectStyle);
        prevSelectStyleRef.current = selectStyle;
      }
    };

    // Mouse move handler to check if we're over toolbars
    const handleMouseMove = (e: MouseEvent) => {
      // Refresh values inside the event handler to ensure we have latest state
      const isFrameModeActive = getIsFrameModeActive();
      const isTextModeActive = getIsTextModeActive();
      const isMoveCanvasMode = getIsMoveCanvasMode();
      const isMovingCanvas = getMovingCanvas();

      const target = e.target as HTMLElement;
      const isOverToolbar =
        target.closest(".right-toolbar") ||
        target.closest(".left-toolbar") ||
        target.closest(".bottom-toolbar") ||
        target.closest(".header") ||
        target.closest(".left-menu");

      if (isOverToolbar) {
        updateCursorStyle("default", {});
      } else if (isFrameModeActive) {
        updateCursorStyle("crosshair", preventSelectStyle);
      } else if (isTextModeActive) {
        updateCursorStyle("text", preventSelectStyle);
      } else if (isMoveCanvasMode) {
        updateCursorStyle(
          isMovingCanvas ? "grabbing" : "grab",
          preventSelectStyle
        );
      } else {
        updateCursorStyle("default", {
          userSelect: "",
          WebkitUserSelect: "",
          MozUserSelect: "",
          msUserSelect: "",
        });
      }
    };

    // Initial cursor setup based on current state - use imperative getters
    const initialSetup = () => {
      const isDragging = getIsDragging();
      const isMovingCanvas = getMovingCanvas();
      const isMoveCanvasMode = getIsMoveCanvasMode();
      const isFrameModeActive = getIsFrameModeActive();
      const isTextModeActive = getIsTextModeActive();

      if (isFrameModeActive) {
        updateCursorStyle("crosshair", preventSelectStyle);
      } else if (isTextModeActive) {
        updateCursorStyle("text", preventSelectStyle);
      } else if (isMoveCanvasMode) {
        updateCursorStyle(
          isMovingCanvas ? "grabbing" : "grab",
          preventSelectStyle
        );
      } else if (isDragging) {
        updateCursorStyle("move", preventSelectStyle);
      } else {
        updateCursorStyle("default", {
          userSelect: "",
          WebkitUserSelect: "",
          MozUserSelect: "",
          msUserSelect: "",
        });
      }
    };

    // Set initial cursor state
    initialSetup();

    // Add mouse move listener
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      isMounted.current = false;
      window.removeEventListener("mousemove", handleMouseMove);

      // Only reset if we're the last cursor manager
      updateCursorStyle("default", {
        userSelect: "",
        WebkitUserSelect: "",
        MozUserSelect: "",
        msUserSelect: "",
      });
    };
  }, []); // Empty dependency array to run once

  // Handle keyboard shortcuts for drawing modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if there's active input elements
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      // Using key press to toggle mode
      if (e.key.toLowerCase() === "f" && !e.repeat) {
        // Toggle frame mode
        const currentFrameMode = getIsFrameModeActive();
        if (!currentFrameMode) {
          canvasOps.setIsFrameModeActive(true);
          canvasOps.setIsTextModeActive(false);
        }
      } else if (e.key.toLowerCase() === "t" && !e.repeat) {
        // Toggle text mode
        const currentTextMode = getIsTextModeActive();
        if (!currentTextMode) {
          canvasOps.setIsTextModeActive(true);
          canvasOps.setIsFrameModeActive(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // Empty dependency array
};
