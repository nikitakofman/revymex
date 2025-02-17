import React, { useState, useEffect, useCallback, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";

interface SelectionBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isSelecting: boolean;
}

export const SelectionBox: React.FC = () => {
  const { containerRef, dragDisp, nodeState, transform, dragState } =
    useBuilder();
  const [box, setBox] = useState<SelectionBoxState | null>(null);

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
        .filter((node) => !node.isViewport && !node.isDynamic)
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

      // Store IDs in tempSelectedIds, don't apply to dragState yet
      const nodeIds = selectedNodes.map(({ node }) => node.id);
      dragDisp.setTempSelectedIds(nodeIds);

      return nodeIds;
    },
    [containerRef, transform, dragDisp, nodeState]
  );

  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.target !== canvas) return;

      dragDisp.setIsSelectionBoxActive(true);
      const rect = canvas.getBoundingClientRect();
      setBox({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
        isSelecting: true,
      });

      dragDisp.clearSelection();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!box?.isSelecting) return;

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
      setTimeout(() => {
        dragDisp.setIsSelectionBoxActive(false);
      }, 0);

      const rect = canvas.getBoundingClientRect();
      const finalX = e.clientX - rect.left;
      const finalY = e.clientY - rect.top;

      // Do one final selection check
      const finalSelectionRect = new DOMRect(
        Math.min(box.startX, finalX) + rect.left,
        Math.min(box.startY, finalY) + rect.top,
        Math.abs(finalX - box.startX),
        Math.abs(finalY - box.startY)
      );

      // Small movement check (for clicks)
      const isSmallMovement =
        Math.abs(finalX - box.startX) < 5 && Math.abs(finalY - box.startY) < 5;

      if (isSmallMovement) {
        dragDisp.clearSelection();
      } else {
        // Get the final selection state
        updateSelection(finalSelectionRect);

        // Store the selected IDs before we clear the ref
        const selectedIds = dragState.tempSelectedIds;

        if (selectedIds.length > 0) {
          // Use the new setSelectedIds method to update all at once
          dragDisp.setSelectedIds(selectedIds);
        }
      }

      // Reset state
      setBox(null);
      dragDisp.setTempSelectedIds([]);
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    containerRef,
    box?.isSelecting,
    updateSelection,
    dragDisp,
    box?.startX,
    box?.startY,
    dragState.tempSelectedIds,
  ]);

  if (!box?.isSelecting) return null;

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
