import React from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";

interface GapHandlesProps {
  node: Node;
  isSelected: boolean;
  isMovingCanvas: boolean;
  isResizing: boolean;
  elementRef: React.RefObject<HTMLDivElement>;
  transform: { scale: number };
}

export const GapHandles: React.FC<GapHandlesProps> = ({
  node,
  isSelected,
  isMovingCanvas,
  isResizing,
  elementRef,
  transform,
}) => {
  const { dragState, setNodeStyle, nodeState, dragDisp } = useBuilder();

  const startAdjustingGap = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const currentSelection = [...dragState.selectedIds];
    const currentGap = parseInt(
      getComputedStyle(elementRef.current!).gap || "0"
    );
    const isHorizontal =
      getComputedStyle(elementRef.current!).flexDirection === "row";

    dragDisp.updateStyleHelper({
      type: "gap",
      position: { x: e.clientX, y: e.clientY },
      value: currentGap,
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      const deltaX = (moveEvent.clientX - startX) / transform.scale;
      const deltaY = (moveEvent.clientY - startY) / transform.scale;
      const delta = isHorizontal ? deltaX : deltaY;
      const newGap = Math.max(0, currentGap + delta);

      dragDisp.updateStyleHelper({
        type: "gap",
        position: { x: moveEvent.clientX, y: moveEvent.clientY },
        value: newGap,
      });

      setNodeStyle({ gap: `${Math.round(newGap)}px` }, [node.id], true);

      if (dragState.selectedIds.length === 0) {
        dragState.selectedIds = currentSelection;
      }
    };

    const handleMouseUp = () => {
      dragDisp.hideStyleHelper();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (dragState.selectedIds.length === 0) {
        dragState.selectedIds = currentSelection;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!elementRef.current || !isSelected || isMovingCanvas || isResizing)
    return null;
  if (node.type !== "frame") return null;

  const frameElement = document.querySelector(`[data-node-id="${node.id}"]`);
  if (!frameElement) return null;

  const computedStyle = window.getComputedStyle(frameElement);
  const isColumn = computedStyle.flexDirection === "column";

  const frameChildren = nodeState.nodes
    .filter((child) => child.parentId === node.id)
    .map((childNode) => {
      const el = document.querySelector(
        `[data-node-id="${childNode.id}"]`
      ) as HTMLElement | null;
      return el
        ? {
            id: childNode.id,
            rect: el.getBoundingClientRect(),
          }
        : null;
    })
    .filter((x): x is { id: string; rect: DOMRect } => !!x);

  if (frameChildren.length < 2) return null;

  const frameRect = frameElement.getBoundingClientRect();
  const gapHandles = [];

  for (let i = 0; i < frameChildren.length - 1; i++) {
    const firstElement = frameChildren[i];
    const secondElement = frameChildren[i + 1];

    if (isColumn) {
      const firstElementBottomEdge = firstElement.rect.bottom;
      const secondElementTopEdge = secondElement.rect.top;
      const centerY = (firstElementBottomEdge + secondElementTopEdge) / 2;
      const relativeCenter = (centerY - frameRect.top) / transform.scale;

      gapHandles.push(
        <div
          key={`gap-${firstElement.id}-${secondElement.id}`}
          className="w-10 h-2 bg-pink-400 absolute cursor-row-resize"
          style={{
            transform: "translateY(-50%)",
            top: `${relativeCenter}px`,
          }}
          onMouseDown={startAdjustingGap}
        />
      );
    } else {
      const firstElementRightEdge = firstElement.rect.right;
      const secondElementLeftEdge = secondElement.rect.left;
      const centerX = (firstElementRightEdge + secondElementLeftEdge) / 2;
      const relativeCenter = (centerX - frameRect.left) / transform.scale;

      gapHandles.push(
        <div
          key={`gap-${firstElement.id}-${secondElement.id}`}
          className="h-10 w-2 bg-pink-400 absolute cursor-col-resize"
          style={{
            transform: "translateX(-50%)",
            left: `${relativeCenter}px`,
          }}
          onMouseDown={startAdjustingGap}
        />
      );
    }
  }

  return <>{gapHandles}</>;
};
