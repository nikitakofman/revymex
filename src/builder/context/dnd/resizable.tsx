import React, { useRef, useState, useCallback, HTMLAttributes } from "react";
import { useBuilder } from "../builderState";
import { Node } from "../../../../../RevymeX/legacy/nodeReducer";

type Direction =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "topRight"
  | "bottomRight"
  | "bottomLeft"
  | "topLeft";

interface ResizableWrapperProps {
  node: Node;
  children: React.ReactElement<HTMLAttributes<HTMLElement>>;
  minWidth?: number;
  minHeight?: number;
}

export const ResizableWrapper: React.FC<ResizableWrapperProps> = ({
  node,
  children,
  minWidth = 50,
  minHeight = 50,
}) => {
  const { nodeDisp, dragState, transform } = useBuilder();
  const elementRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const isSelected = dragState.selectedIds.includes(node.id);

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
      const startX = e.clientX;
      const startY = e.clientY;

      setIsResizing(true);

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

        // Update all selected nodes with the new dimensions
        selectedNodes.forEach((nodeId) => {
          // Update style dimensions
          nodeDisp.updateNodeStyle([nodeId], {
            width: `${newWidth}px`,
            height: `${newHeight}px`,
          });

          // Update position if needed
          if (newX !== node.position?.x || newY !== node.position?.y) {
            nodeDisp.updateNodePosition(nodeId, { x: newX, y: newY });
          }
        });
      };

      const handlePointerUp = () => {
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
      transform.scale,
    ]
  );

  const getHandleCursor = (direction: Direction): string => {
    switch (direction) {
      case "top":
      case "bottom":
        return "ns-resize";
      case "left":
      case "right":
        return "ew-resize";
      case "topLeft":
      case "bottomRight":
        return "nwse-resize";
      case "topRight":
      case "bottomLeft":
        return "nesw-resize";
      default:
        return "pointer";
    }
  };

  const ResizeHandles = () => (
    <>
      {[
        "top",
        "right",
        "bottom",
        "left",
        "topRight",
        "bottomRight",
        "bottomLeft",
        "topLeft",
      ].map((direction) => (
        <div
          key={direction}
          className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white"
          style={{
            ...getHandleStyles(direction as Direction),
            cursor: getHandleCursor(direction as Direction),
            zIndex: 1000,
          }}
          onPointerDown={(e) => handleResizeStart(e, direction as Direction)}
        />
      ))}
    </>
  );

  return React.cloneElement(children, {
    ref: elementRef,
    style: {
      ...children.props.style,
      outline: isSelected ? "2px solid #3b82f6" : undefined,
    },
    children: (
      <>
        {children.props.children}
        {isSelected && !isResizing && <ResizeHandles />}
      </>
    ),
  } as React.HTMLAttributes<HTMLElement>);
};

const getHandleStyles = (direction: Direction): React.CSSProperties => {
  switch (direction) {
    case "top":
      return { top: -6, left: "50%", transform: "translateX(-50%)" };
    case "right":
      return { right: -6, top: "50%", transform: "translateY(-50%)" };
    case "bottom":
      return { bottom: -6, left: "50%", transform: "translateX(-50%)" };
    case "left":
      return { left: -6, top: "50%", transform: "translateY(-50%)" };
    case "topLeft":
      return { top: -6, left: -6 };
    case "topRight":
      return { top: -6, right: -6 };
    case "bottomRight":
      return { bottom: -6, right: -6 };
    case "bottomLeft":
      return { bottom: -6, left: -6 };
  }
};
