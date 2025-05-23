import { useCallback, useEffect, useRef } from "react";
import { useBuilder } from "../builderState";
import TransformManager from "@/builder/view/canvas/transform-manager";

export const useMoveCanvas = () => {
  const {
    containerRef,
    contentRef,
    transform,
    setTransform,
    isMoveCanvasMode,
    setIsMovingCanvas,
  } = useBuilder();

  const isDraggingRef = useRef(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  // Initialize TransformManager with contentRef on mount
  useEffect(() => {
    if (contentRef.current) {
      TransformManager.init(contentRef.current);
      // Initialize with existing transform values
      console.log("always moving?", "let's move2");

      TransformManager.updateTransform(transform);
    }
  }, [contentRef.current]);

  // Direct DOM update function using TransformManager
  const updateCanvasTransform = useCallback((x, y, scale) => {
    TransformManager.updateTransform({ x, y, scale });
  }, []);

  const handleMouseDown = useCallback(
    (e) => {
      if (!isMoveCanvasMode) return;

      // Only handle primary mouse button (left click)
      if (e.button !== 0) return;

      isDraggingRef.current = true;
      lastPositionRef.current = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = "grabbing";
      setIsMovingCanvas(true);
    },
    [isMoveCanvasMode, setIsMovingCanvas]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - lastPositionRef.current.x;
      const deltaY = e.clientY - lastPositionRef.current.y;

      // Update the last position
      lastPositionRef.current = { x: e.clientX, y: e.clientY };

      // Get current transform values from TransformManager
      const currentTransform = TransformManager.getTransform();

      // Update using TransformManager
      updateCanvasTransform(
        currentTransform.x + deltaX,
        currentTransform.y + deltaY,
        currentTransform.scale
      );
    },
    [updateCanvasTransform]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    document.body.style.cursor = isMoveCanvasMode ? "grab" : "default";
    setIsMovingCanvas(false);

    // IMPORTANT: We don't update React state after panning
    // This prevents the re-rendering cascade

    // OPTIONAL: If you need other components to be aware of the final position
    // at the end of a pan operation, you can update React state here
    // But only do this at the END of panning, not during

    // const finalTransform = TransformManager.getTransform();
    // setTransform(finalTransform);
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

  // Handle zoom operations that occur outside of this hook
  useEffect(() => {
    // If we're not dragging, sync TransformManager with React state
    if (!isDraggingRef.current) {
      // Only update if the values are different to avoid loops
      const currentTransform = TransformManager.getTransform();
      if (
        currentTransform.x !== transform.x ||
        currentTransform.y !== transform.y ||
        currentTransform.scale !== transform.scale
      ) {
        TransformManager.updateTransform(transform);
      }
    }
  }, [transform]);

  // Expose TransformManager methods for use in other components
  return {
    getTransform: TransformManager.getTransform,
    updateTransform: TransformManager.updateTransform,
    // You can add more methods as needed
  };
};
