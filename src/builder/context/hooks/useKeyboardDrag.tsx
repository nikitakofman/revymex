import { useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useNodeActions } from "./useNodeActions";

export const useKeyboardDrag = ({ isEnabled = true }) => {
  const {
    dragState,
    dragDisp,
    nodeState,
    nodeDisp,
    isMoveCanvasMode,
    setIsMoveCanvasMode,
    setNodeStyle,
    isEditingText,
  } = useBuilder();

  const { handleDelete, handleDuplicate, handleCopy, handlePaste } =
    useNodeActions();

  const isAltPressedRef = useRef(false);
  const isSpacePressedRef = useRef(false);

  // Add this to track when we've already handled the Alt key duplication for this drag
  const altDuplicationHandledRef = useRef(false);

  // Reset the Alt state when window loses focus
  useEffect(() => {
    const handleBlur = () => {
      isAltPressedRef.current = false;
      altDuplicationHandledRef.current = false;
    };

    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (
      document.activeElement?.tagName === "INPUT" ||
      document.activeElement?.tagName === "TEXTAREA" ||
      document.activeElement?.isContentEditable
    ) {
      return;
    }

    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingText || document.activeElement?.isContentEditable) {
        return;
      }

      // Handle Alt key for duplication
      if (e.key === "Alt") {
        e.preventDefault();
        isAltPressedRef.current = true;

        // Only duplicate immediately if we're already dragging
        if (dragState.isDragging && !altDuplicationHandledRef.current) {
          handleDuplicate();
          altDuplicationHandledRef.current = true;
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

        if (isEditingText || document.activeElement?.isContentEditable) {
          // Skip deletion when editing text - let the editor handle backspace
          return;
        }

        handleDelete();
      }

      // Other key handlers remain the same...
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

      if (e.key === "x" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();

        handleCopy();
        handleDelete();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        isAltPressedRef.current = false;
        // Reset the duplication handled flag
        altDuplicationHandledRef.current = false;
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
    isEditingText,
    isEnabled,
    dragDisp,
    nodeDisp,
    handleCopy,
    handlePaste,
    handleDelete,
    handleDuplicate,
    setNodeStyle,
  ]);

  // Handle drag start while Alt is pressed
  useEffect(() => {
    if (dragState.isDragging) {
      if (isAltPressedRef.current && !altDuplicationHandledRef.current) {
        handleDuplicate();
        altDuplicationHandledRef.current = true;
      }
    } else {
      // Reset the flag when drag ends
      altDuplicationHandledRef.current = false;
      dragDisp.setDuplicatedFromAlt(false);
    }
  }, [dragState.isDragging, handleDuplicate, dragDisp]);

  return {
    isAltPressed: isAltPressedRef.current,
    isSpacePressed: isSpacePressedRef.current,
    isDuplicating: dragState.duplicatedFromAlt,
    isMoveCanvasMode,
  };
};
