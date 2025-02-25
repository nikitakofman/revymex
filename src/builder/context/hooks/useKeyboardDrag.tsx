import { useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useNodeActions } from "./useNodeActions";

export const useKeyboardDrag = () => {
  const { dragState, dragDisp, nodeState } = useBuilder();
  const { handleDelete, handleDuplicate, handleCopy, handlePaste } =
    useNodeActions();
  const isAltPressedRef = useRef(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault();
        isAltPressedRef.current = true;

        if (dragState.isDragging) {
          handleDuplicate();
        }
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
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [dragState.isDragging, dragState.selectedIds, nodeState.nodes]);

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
    isDuplicating: dragState.duplicatedFromAlt,
  };
};
