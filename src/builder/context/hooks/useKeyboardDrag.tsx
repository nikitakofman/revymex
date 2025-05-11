// useKeyboardDrag.ts
import { useEffect, useRef } from "react";
import { useNodeActions } from "./useNodeActions";
import { NodeId, useGetAllNodes } from "@/builder/context/atoms/node-store";

import { selectOps, useGetSelectedIds } from "../atoms/select-store";
import {
  dragOps,
  useDuplicatedFromAlt,
  useGetIsDragging,
} from "../atoms/drag-store";
import {
  canvasOps,
  useGetIsEditingText,
  useGetIsMoveCanvasMode,
  useIsMoveCanvasMode,
} from "../atoms/canvas-interaction-store";
import { syncViewports } from "../atoms/node-store/operations/sync-operations";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";

export const useKeyboardDrag = () => {
  const getAllNodes = useGetAllNodes();

  const { handleDelete, handleDuplicate, handleCopy, handlePaste } =
    useNodeActions();

  const currentSelectedIds = useGetSelectedIds();
  const getIsMoveCanvasMode = useGetIsMoveCanvasMode();
  const isMoveCanvasMode = useIsMoveCanvasMode();
  const getIsEditingText = useGetIsEditingText();
  const duplicatedFromAlt = useDuplicatedFromAlt();

  const { clearSelection, setSelectedIds } = selectOps;
  const getIsDragging = useGetIsDragging();

  const isAltPressedRef = useRef(false);
  const isSpacePressedRef = useRef(false);
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
    // Skip if focus is in an input element
    if (
      document.activeElement?.tagName === "INPUT" ||
      document.activeElement?.tagName === "TEXTAREA" ||
      document.activeElement?.isContentEditable
    ) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if editing text using the imperative getter
      const isEditingText = getIsEditingText();

      // Skip all keyboard shortcuts if editing text
      if (isEditingText || document.activeElement?.isContentEditable) {
        return;
      }

      const isDragging = getIsDragging();

      // Handle Alt key for duplication
      if (e.key === "Alt") {
        e.preventDefault();
        isAltPressedRef.current = true;

        // Only duplicate immediately if we're already dragging
        if (isDragging && !altDuplicationHandledRef.current) {
          handleDuplicate();
          altDuplicationHandledRef.current = true;
        }
      }

      // Handle Space key for canvas movement
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault(); // Prevent default scrolling
        isSpacePressedRef.current = true;
        canvasOps.setIsMoveCanvasMode(true);
      }

      const selectedIds = currentSelectedIds();

      // Handle Delete/Backspace
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        selectedIds?.length > 0
      ) {
        e.preventDefault();
        e.stopPropagation();

        if (isEditingText || document.activeElement?.isContentEditable) {
          // Skip deletion when editing text - let the editor handle backspace
          return;
        }

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

        if (selectedIds.length > 0) {
          // Toggle lock state for all selected nodes
          selectedIds.forEach((id) => {
            const allNodes = getAllNodes();
            const node = allNodes.find((n) => n.id === id);
            if (node) {
              updateNodeLock(id, !node.isLocked);
            }
          });
        }
      }

      // Hide element (display none)
      if (e.key.toLowerCase() === "i" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          // Update display style for all selected nodes
          selectedIds.forEach((id) => {
            updateNodeStyle(id, { display: "none" });
          });
        }
      }

      // Handle Select All
      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();

        // Get all selectable node IDs (filtering out viewports)
        const allNodes = getAllNodes();
        const selectableNodeIds = allNodes
          .filter((node) => !node.isViewport)
          .map((node) => node.id);

        clearSelection();
        setSelectedIds(selectableNodeIds);
      }

      // Handle Cut
      if (e.key === "x" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();

        handleCopy();
        handleDelete();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isMoveCanvasMode = getIsMoveCanvasMode();

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
        canvasOps.setIsMoveCanvasMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    getIsDragging,
    getAllNodes,
    getIsMoveCanvasMode,
    getIsEditingText,
    handleCopy,
    handlePaste,
    handleDelete,
    handleDuplicate,
    currentSelectedIds,
    clearSelection,
    setSelectedIds,
  ]);

  // Handle drag start while Alt is pressed
  useEffect(() => {
    const isDragging = getIsDragging();

    if (isDragging) {
      if (isAltPressedRef.current && !altDuplicationHandledRef.current) {
        handleDuplicate();
        altDuplicationHandledRef.current = true;
      }
    } else {
      // Reset the flag when drag ends
      altDuplicationHandledRef.current = false;
      dragOps.setDuplicatedFromAlt(false);
    }
  }, [getIsDragging, handleDuplicate]);

  // Helper function to update node lock state
  const updateNodeLock = (nodeId: NodeId, isLocked: boolean) => {
    // Check if node is in viewport to handle syncing
    const allNodes = getAllNodes();
    const node = allNodes.find((n) => n.id === nodeId);

    if (node) {
      // Update the lock flag for this node
      const updatedNode = { ...node, isLocked };

      // Update the node
      if (node.inViewport && node.sharedId) {
        // Sync with other viewports if node has shared ID
        const nodesWithSameSharedId = allNodes.filter(
          (n) => n.sharedId === node.sharedId && n.id !== nodeId
        );

        if (nodesWithSameSharedId.length > 0) {
          // Update all nodes with the same shared ID
          nodesWithSameSharedId.forEach((sharedNode) => {
            updateNodeStyle(sharedNode.id, {}, { isLocked });
          });

          // Sync viewports to ensure consistency
          syncViewports(nodeId, node.parentId);
        }
      }

      // Update this node
      updateNodeStyle(nodeId, {}, { isLocked });
    }
  };

  return {
    isAltPressed: isAltPressedRef.current,
    isSpacePressed: isSpacePressedRef.current,
    isDuplicating: duplicatedFromAlt,
    isMoveCanvasMode,
  };
};
