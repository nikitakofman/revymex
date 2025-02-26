import { useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useNodeActions } from "./useNodeActions";

export const useKeyboardDrag = () => {
  const {
    dragState,
    dragDisp,
    nodeState,
    nodeDisp,
    isMoveCanvasMode,
    setIsMoveCanvasMode,
    setNodeStyle,
  } = useBuilder();

  const { handleDelete, handleDuplicate, handleCopy, handlePaste } =
    useNodeActions();

  const isAltPressedRef = useRef(false);
  const isSpacePressedRef = useRef(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Alt key for duplication
      if (e.key === "Alt") {
        e.preventDefault();
        isAltPressedRef.current = true;

        if (dragState.isDragging) {
          handleDuplicate();
        }
      }

      // Handle Space key for canvas movement
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault(); // Prevent default scrolling
        isSpacePressedRef.current = true;
        setIsMoveCanvasMode(true);
      }

      // Handle Delete/Backspace
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        dragState.selectedIds?.length > 0
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleDelete();
      }

      // Handle Copy
      if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleCopy();
      }

      // Handle Paste
      if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        handlePaste();
      }

      // Lock element
      if (e.key.toLowerCase() === "l" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();

        if (dragState.selectedIds.length > 0) {
          nodeDisp.toggleNodeLock(dragState.selectedIds);
        }
      }

      // Hide element (display none)

      if (e.key.toLowerCase() === "i" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();

        console.log("HINDING");
        if (dragState.selectedIds.length > 0) {
          setNodeStyle(
            {
              display: "none",
            },
            undefined,
            true
          );
        }
      }

      // Handle Select All
      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();

        // Get all selectable node IDs (filtering out dynamic nodes)
        const selectableNodeIds = nodeState.nodes
          .filter((node) => !node.isViewport)
          .map((node) => node.id);

        dragDisp.clearSelection();

        dragDisp.setSelectedIds(selectableNodeIds);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        isAltPressedRef.current = false;
      }

      if (e.code === "Space") {
        isSpacePressedRef.current = false;
        // Only deactivate move mode if it was activated by space
        // (not if it was activated by the toolbar button)
        if (!isMoveCanvasMode) return;

        // Check if the move mode wasn't activated by clicking the button
        // We can infer this if the mode was activated by space key
        setIsMoveCanvasMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    dragState.isDragging,
    dragState.selectedIds,
    nodeState.nodes,
    isMoveCanvasMode,
    setIsMoveCanvasMode,
  ]);

  // Handle drag start while Alt is pressed
  useEffect(() => {
    if (dragState.isDragging && isAltPressedRef.current) {
      handleDuplicate();
    }
  }, [dragState.isDragging]);

  // Reset flags when drag ends
  useEffect(() => {
    if (!dragState.isDragging) {
      dragDisp.setDuplicatedFromAlt(false);
    }
  }, [dragState.isDragging]);

  return {
    isAltPressed: isAltPressedRef.current,
    isSpacePressed: isSpacePressedRef.current,
    isDuplicating: dragState.duplicatedFromAlt,
    isMoveCanvasMode,
  };
};
