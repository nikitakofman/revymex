import { useCallback, useEffect, useRef } from "react";
import { useBuilder } from "../builderState";

export const useMoveCanvas = () => {
  const {
    containerRef,
    setTransform,
    isMoveCanvasMode,
    setIsMovingCanvas, // Use this for active dragging state
  } = useBuilder();

  const isDraggingRef = useRef(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!isMoveCanvasMode) return;

      // Only handle primary mouse button (left click)
      if (e.button !== 0) return;

      isDraggingRef.current = true;
      lastPositionRef.current = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = "grabbing";
      setIsMovingCanvas(true); // Set active dragging state
    },
    [isMoveCanvasMode, setIsMovingCanvas]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - lastPositionRef.current.x;
      const deltaY = e.clientY - lastPositionRef.current.y;

      setTransform((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      lastPositionRef.current = { x: e.clientX, y: e.clientY };
    },
    [setTransform]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    document.body.style.cursor = isMoveCanvasMode ? "grab" : "default";
    setIsMovingCanvas(false); // Only stop the active dragging, not the mode
  }, [isMoveCanvasMode, setIsMovingCanvas]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, handleMouseDown, handleMouseMove, handleMouseUp]);

  // Update cursor based on mode
  useEffect(() => {
    if (isDraggingRef.current) {
      document.body.style.cursor = "grabbing";
    } else if (isMoveCanvasMode) {
      document.body.style.cursor = "grab";
    } else {
      document.body.style.cursor = ""; // Reset to default
    }
  }, [isMoveCanvasMode]);

  // When exiting move mode, ensure dragging is canceled
  useEffect(() => {
    if (!isMoveCanvasMode && isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsMovingCanvas(false);
    }
  }, [isMoveCanvasMode, setIsMovingCanvas]);
};
