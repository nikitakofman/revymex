import React, { useRef, useCallback, RefObject } from "react";
import { useBuilder } from "@/builder/context/builderState";

import { Direction, ResizableWrapperProps } from "../utils";
import { VisualHelpers } from "./VisualHelpers";

export const ResizableWrapper: React.FC<ResizableWrapperProps> = ({
  node,
  children,
  minWidth = 50,
  minHeight = 50,
}) => {
  const {
    nodeDisp,
    dragState,
    transform,
    setNodeStyle,
    dragDisp,
    setIsResizing,
    startRecording,
    stopRecording,
  } = useBuilder();
  const elementRef = useRef<HTMLDivElement | null>(
    null
  ) as RefObject<HTMLDivElement>;
  const isSelected = dragState.selectedIds.includes(node.id);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, direction: Direction) => {
      if (!elementRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const sessionId = startRecording();

      console.log("sessionID", sessionId);

      const selectedNodes =
        dragState.selectedIds.length > 0 ? dragState.selectedIds : [node.id];

      const computedStyle = window.getComputedStyle(elementRef.current);
      const startWidth = parseFloat(computedStyle.width);
      const startHeight = parseFloat(computedStyle.height);
      const unit = computedStyle.width.includes("%") ? "%" : "px";
      const startX = e.clientX;
      const startY = e.clientY;

      setIsResizing(true);

      dragDisp.updateStyleHelper({
        type: "dimensions",
        position: { x: e.clientX, y: e.clientY },
        dimensions: {
          width: startWidth,
          height: startHeight,
          unit,
        },
      });

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!elementRef.current) return;
        moveEvent.preventDefault();

        const deltaX = (moveEvent.clientX - startX) / transform.scale;
        const deltaY = (moveEvent.clientY - startY) / transform.scale;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = node.position?.x ?? 0;
        let newY = node.position?.y ?? 0;

        switch (direction) {
          case "right":
            newWidth = Math.max(startWidth + deltaX, minWidth);
            break;
          case "bottom":
            newHeight = Math.max(startHeight + deltaY, minHeight);
            break;
          case "left":
            newWidth = Math.max(startWidth - deltaX, minWidth);
            if (newWidth !== startWidth) {
              newX += startWidth - newWidth;
            }
            break;
          case "top":
            newHeight = Math.max(startHeight - deltaY, minHeight);
            if (newHeight !== startHeight) {
              newY += startHeight - newHeight;
            }
            break;
          case "topRight":
            newWidth = Math.max(startWidth + deltaX, minWidth);
            newHeight = Math.max(startHeight - deltaY, minHeight);
            if (newHeight !== startHeight) {
              newY += startHeight - newHeight;
            }
            break;
          case "bottomRight":
            newWidth = Math.max(startWidth + deltaX, minWidth);
            newHeight = Math.max(startHeight + deltaY, minHeight);
            break;
          case "bottomLeft":
            newWidth = Math.max(startWidth - deltaX, minWidth);
            newHeight = Math.max(startHeight + deltaY, minHeight);
            if (newWidth !== startWidth) {
              newX += startWidth - newWidth;
            }
            break;
          case "topLeft":
            newWidth = Math.max(startWidth - deltaX, minWidth);
            newHeight = Math.max(startHeight - deltaY, minHeight);
            if (newWidth !== startWidth) {
              newX += startWidth - newWidth;
            }
            if (newHeight !== startHeight) {
              newY += startHeight - newHeight;
            }
            break;
        }

        dragDisp.updateStyleHelper({
          type: "dimensions",
          position: { x: moveEvent.clientX, y: moveEvent.clientY },
          dimensions: {
            width: newWidth,
            height: newHeight,
            unit,
          },
        });

        selectedNodes.forEach((nodeId) => {
          setNodeStyle(
            {
              width: `${newWidth}${unit}`,
              height: `${newHeight}${unit}`,
            },
            selectedNodes,
            true
          );

          if (newX !== node.position?.x || newY !== node.position?.y) {
            nodeDisp.updateNodePosition(nodeId, { x: newX, y: newY });
          }
        });
      };

      const handlePointerUp = () => {
        dragDisp.hideStyleHelper();
        stopRecording(sessionId);
        console.log("Recording session stopped:", sessionId);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        setIsResizing(false);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [
      node,
      nodeDisp,
      dragState.selectedIds,
      minWidth,
      minHeight,
      dragDisp,
      setNodeStyle,
      startRecording,
      stopRecording,
      transform.scale,
      setIsResizing,
    ]
  );

  return (
    <>
      {React.cloneElement(children, {
        ref: elementRef,
        style: {
          ...children.props.style,
          pointerEvents: isSelected ? "all" : undefined,
        },
        children: children.props.children,
      } as React.HTMLAttributes<HTMLElement>)}

      <VisualHelpers
        elementRef={elementRef}
        node={node}
        isSelected={isSelected}
        handleResizeStart={handleResizeStart}
      />
    </>
  );
};
