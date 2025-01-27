import React, { useRef, useState, useCallback, useEffect } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { ConnectionHandle } from "../ConnectionHandle";
import { ResizeHandles } from "./ResizeHandles";
import { GapHandles } from "./GapHandles";
import { Direction, ResizableWrapperProps } from "../utils";

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
    isMovingCanvas,
    setNodeStyle,
    dragDisp,
  } = useBuilder();
  const elementRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const isSelected = dragState.selectedIds.includes(node.id);

  const getBorderWidth = () => {
    if (!elementRef.current) return 0;
    try {
      return parseFloat(getComputedStyle(elementRef.current).borderWidth);
    } catch (e) {
      return 0;
    }
  };

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, direction: Direction) => {
      if (!elementRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const selectedNodes =
        dragState.selectedIds.length > 0 ? dragState.selectedIds : [node.id];

      const computedStyle = window.getComputedStyle(elementRef.current);
      const startWidth = parseFloat(computedStyle.width);
      const startHeight = parseFloat(computedStyle.height);
      const unit = computedStyle.width.includes("%") ? "%" : "px";
      const startX = e.clientX;
      const startY = e.clientY;

      console.log("unit", unit);

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
    ]
  );

  return React.cloneElement(children, {
    ref: elementRef,
    style: {
      ...children.props.style,
      pointerEvents: isSelected ? "all" : undefined,
    },
    children: (
      <>
        {children.props.children}
        {!isMovingCanvas && isSelected && (
          <div
            className="absolute pointer-events-none"
            style={{
              position: "absolute",
              inset: `-${getBorderWidth()}px`,
              border:
                node.isDynamic || dragState.dynamicModeNodeId
                  ? `${2 / transform.scale}px solid var(--accent-secondary)`
                  : `${2 / transform.scale}px solid #3b82f6`,
              zIndex: 999,
              borderRadius: 0,
              boxSizing: "content-box",
              pointerEvents: "none",
            }}
          />
        )}
        {isSelected && !isResizing && !isMovingCanvas && (
          <>
            <ResizeHandles
              node={node}
              transform={transform}
              dragState={dragState}
              getBorderWidth={getBorderWidth}
              handleResizeStart={handleResizeStart}
            />
            {(!node.isDynamic || dragState.dynamicModeNodeId === node.id) && (
              <GapHandles
                node={node}
                isSelected={isSelected}
                isMovingCanvas={isMovingCanvas}
                isResizing={isResizing}
                elementRef={elementRef}
                transform={transform}
              />
            )}
            <ConnectionHandle node={node} transform={transform} />
          </>
        )}
      </>
    ),
  } as React.HTMLAttributes<HTMLElement>);
};
