import React, { useState, useEffect, useCallback, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { interfaceOps } from "../atoms/interface-store";
import { selectOps, useGetTempSelectedIds } from "../atoms/select-store";
import {
  useGetDragSource,
  useGetIsDragging,
  useIsDragging,
} from "../atoms/drag-store";
import {
  useIsMiddleMouseDown,
  useTransform,
  useIsMoveCanvasMode,
  useIsFrameModeActive,
  useIsTextModeActive,
  canvasOps,
} from "../atoms/canvas-interaction-store";

interface SelectionBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isSelecting: boolean;
}

export const SelectionBox: React.FC = () => {
  const { containerRef, nodeState } = useBuilder();

  // Subscribe to all states that affect whether we should show the selection box
  const transform = useTransform();
  const isMiddleMouseDown = useIsMiddleMouseDown();
  const isMoveCanvasMode = useIsMoveCanvasMode();
  const isFrameModeActive = useIsFrameModeActive();
  const isTextModeActive = useIsTextModeActive();
  const isDragging = useIsDragging();
  const getTempIds = useGetTempSelectedIds();

  // Calculate isDrawingMode from frame mode and text mode
  const isDrawingMode = isFrameModeActive || isTextModeActive;

  // Get all hooks BEFORE any conditional returns
  const getIsDragging = useGetIsDragging();
  const getDragSource = useGetDragSource();
  const [box, setBox] = useState<SelectionBoxState | null>(null);

  // Note: this should be below all hook calls
  const shouldRender =
    !isDrawingMode && !isMoveCanvasMode && !isDragging && !isMiddleMouseDown;

  const updateSelection = useCallback(
    (selectionRect: DOMRect) => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return [];

      const selectionInCanvas = {
        left:
          (selectionRect.left - containerRect.left - transform.x) /
          transform.scale,
        top:
          (selectionRect.top - containerRect.top - transform.y) /
          transform.scale,
        right:
          (selectionRect.right - containerRect.left - transform.x) /
          transform.scale,
        bottom:
          (selectionRect.bottom - containerRect.top - transform.y) /
          transform.scale,
      };

      const selectableElements = nodeState.nodes
        .filter((node) => !node.isViewport && !node.isLocked) // Filter out locked nodes
        .map((node) => {
          const element = document.querySelector(`[data-node-id="${node.id}"]`);
          return { node, element };
        })
        .filter(
          (
            item
          ): item is {
            node: (typeof nodeState.nodes)[0];
            element: HTMLElement;
          } => item.element !== null
        );

      const selectedNodes = selectableElements.filter(({ element }) => {
        const rect = element.getBoundingClientRect();
        const elementInCanvas = {
          left:
            (rect.left - containerRect.left - transform.x) / transform.scale,
          top: (rect.top - containerRect.top - transform.y) / transform.scale,
          right:
            (rect.right - containerRect.left - transform.x) / transform.scale,
          bottom:
            (rect.bottom - containerRect.top - transform.y) / transform.scale,
        };

        return !(
          elementInCanvas.left > selectionInCanvas.right ||
          elementInCanvas.right < selectionInCanvas.left ||
          elementInCanvas.top > selectionInCanvas.bottom ||
          elementInCanvas.bottom < selectionInCanvas.top
        );
      });

      const nodeIds = selectedNodes.map(({ node }) => node.id);
      selectOps.setTempSelectedIds(nodeIds);
      return nodeIds;
    },
    [containerRef, transform, nodeState]
  );

  useEffect(() => {
    // Skip effect if component should not render
    if (!shouldRender) return;

    const canvas = containerRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const isDragging = getIsDragging();
      const dragSource = getDragSource();

      // Don't start selection if we're already dragging something
      if (isDragging || dragSource) return;

      // Get the frame element if it exists
      const frameEl = target.closest('[data-node-type="frame"]');
      const node = frameEl
        ? nodeState.nodes.find(
            (n) => n.id === frameEl.getAttribute("data-node-id")
          )
        : null;

      // Check if we're clicking on any non-viewport node
      const clickedNode = target.closest("[data-node-id]");
      if (clickedNode) {
        const nodeId = clickedNode.getAttribute("data-node-id");
        const clickedNodeData = nodeState.nodes.find((n) => n.id === nodeId);
        // If it's not a viewport and not the canvas, return
        if (!clickedNodeData?.isViewport) return;
      }

      // Only proceed if target is canvas or a viewport frame
      // Remove the header check since we want to handle viewport clicks
      if (target !== canvas && !node?.isViewport) return;

      canvasOps.setIsSelectionBoxActive(true);
      const rect = canvas.getBoundingClientRect();
      setBox({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
        isSelecting: true,
      });

      selectOps.clearSelection();
      interfaceOps.toggleLayers();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const isDragging = getIsDragging();

      // If we're not selecting or dragging something, don't do anything
      if (!box?.isSelecting || isDragging) return;

      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      setBox((prev) => ({
        ...prev!,
        currentX: newX,
        currentY: newY,
      }));

      const selectionRect = new DOMRect(
        Math.min(box.startX, newX) + rect.left,
        Math.min(box.startY, newY) + rect.top,
        Math.abs(newX - box.startX),
        Math.abs(newY - box.startY)
      );

      updateSelection(selectionRect);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!box?.isSelecting) return;

      // Clear selection box active state
      setTimeout(() => {
        canvasOps.setIsSelectionBoxActive(false);
      }, 0);

      const rect = canvas.getBoundingClientRect();
      const finalX = e.clientX - rect.left;
      const finalY = e.clientY - rect.top;

      const finalSelectionRect = new DOMRect(
        Math.min(box.startX, finalX) + rect.left,
        Math.min(box.startY, finalY) + rect.top,
        Math.abs(finalX - box.startX),
        Math.abs(finalY - box.startY)
      );

      const tempSelectedIds = getTempIds();

      const isSmallMovement =
        Math.abs(finalX - box.startX) < 5 && Math.abs(finalY - box.startY) < 5;

      if (isSmallMovement) {
        selectOps.clearSelection();
      } else {
        const selectedIds = tempSelectedIds;
        if (selectedIds.length > 0) {
          selectOps.setSelectedIds(selectedIds);
        }
      }

      // Reset state
      setBox(null);
      selectOps.setTempSelectedIds([]);
    };

    // Use canvas-level listener for mousedown, but window-level for move and up
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    shouldRender, // Add this to dependency array
    containerRef,
    box?.isSelecting,
    updateSelection,
    box?.startX,
    box?.startY,
    getTempIds,
    getIsDragging,
    getDragSource,
    nodeState.nodes,
  ]);

  // Only render the box if all conditions are met
  if (!shouldRender || !box?.isSelecting) return null;

  const left = Math.min(box.startX, box.currentX);
  const top = Math.min(box.startY, box.currentY);
  const width = Math.abs(box.currentX - box.startX);
  const height = Math.abs(box.currentY - box.startY);

  return (
    <div
      className="absolute pointer-events-none border border-blue-500 bg-blue-500/10"
      style={{
        left,
        top,
        width,
        height,
        zIndex: 1000,
        userSelect: "none",
      }}
    />
  );
};

export default SelectionBox;
