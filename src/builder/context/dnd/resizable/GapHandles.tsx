import React, { useState } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";

export const GapHandles = ({
  node,
  isSelected,
  elementRef,
}: {
  node: Node;
  isSelected: boolean;
  elementRef: React.RefObject<HTMLDivElement>;
}) => {
  const {
    setNodeStyle,
    nodeState,
    dragDisp,
    transform,
    setIsAdjustingGap,
    isResizing,
    isMovingCanvas,
    startRecording,
    stopRecording,
  } = useBuilder();
  const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null);

  const startAdjustingGap = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sessionId = startRecording();

    const startX = e.clientX;
    const startY = e.clientY;
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

      setIsAdjustingGap(true);

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

      // if (dragState.selectedIds.length === 0) {
      //   dragState.selectedIds = currentSelection;
      // }
    };

    const handleMouseUp = () => {
      dragDisp.hideStyleHelper();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      setIsAdjustingGap(false);

      stopRecording(sessionId);

      window.dispatchEvent(new Event("resize"));

      // dragDisp.setPartialDragState({ selectedIds: currentSelection });

      // console.log("dragState  ", dragState.selectedIds);
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
  const gapElements = [];

  for (let i = 0; i < frameChildren.length - 1; i++) {
    const firstElement = frameChildren[i];
    const secondElement = frameChildren[i + 1];

    if (isColumn) {
      const firstElementBottomEdge = firstElement.rect.bottom;
      const secondElementTopEdge = secondElement.rect.top;
      const gapHeight = secondElementTopEdge - firstElementBottomEdge;
      const centerY = (firstElementBottomEdge + secondElementTopEdge) / 2;
      const relativeTop =
        (firstElementBottomEdge - frameRect.top) / transform.scale;
      const gapHeightScaled = gapHeight / transform.scale;

      gapElements.push(
        <div
          key={`gap-bg-${firstElement.id}-${secondElement.id}`}
          className="absolute pointer-events-none  transition-opacity duration-150"
          style={{
            top: `${relativeTop}px`,
            left: 0,
            width: "100%",
            height: `${gapHeightScaled}px`,
            backgroundColor: "rgba(244, 114, 182, 0.1)",
            opacity: hoveredGapIndex === i ? 1 : 0,
          }}
        />
      );

      gapElements.push(
        <div
          key={`gap-handle-${firstElement.id}-${secondElement.id}`}
          className="w-10 h-2 bg-pink-400 absolute rounded-t-full rounded-b-full cursor-row-resize pointer-events-auto"
          style={{
            transform: "translateY(-50%)",
            top: `${(centerY - frameRect.top) / transform.scale}px`,
            left: "50%",
            marginLeft: "-20px",
            zIndex: 1,
          }}
          onMouseDown={startAdjustingGap}
          onMouseEnter={() => setHoveredGapIndex(i)}
          onMouseLeave={() => setHoveredGapIndex(null)}
        />
      );
    } else {
      const firstElementRightEdge = firstElement.rect.right;
      const secondElementLeftEdge = secondElement.rect.left;
      const gapWidth = secondElementLeftEdge - firstElementRightEdge;
      const centerX = (firstElementRightEdge + secondElementLeftEdge) / 2;
      const relativeLeft =
        (firstElementRightEdge - frameRect.left) / transform.scale;
      const gapWidthScaled = gapWidth / transform.scale;

      gapElements.push(
        <div
          key={`gap-bg-${firstElement.id}-${secondElement.id}`}
          className="absolute pointer-events-none transition-opacity duration-150"
          style={{
            left: `${relativeLeft}px`,
            top: 0,
            width: `${gapWidthScaled}px`,
            height: "100%",
            backgroundColor: "rgba(244, 114, 182, 0.1)",
            opacity: hoveredGapIndex === i ? 1 : 0,
          }}
        />
      );

      gapElements.push(
        <div
          key={`gap-handle-${firstElement.id}-${secondElement.id}`}
          className="h-10 w-2 bg-pink-400 absolute rounded-t-full rounded-b-full cursor-col-resize pointer-events-auto"
          style={{
            transform: "translateX(-50%)",
            left: `${(centerX - frameRect.left) / transform.scale}px`,
            top: "50%",
            marginTop: "-20px",
            zIndex: 1,
          }}
          onMouseDown={startAdjustingGap}
          onMouseEnter={() => setHoveredGapIndex(i)}
          onMouseLeave={() => setHoveredGapIndex(null)}
        />
      );
    }
  }

  return <>{gapElements}</>;
};
