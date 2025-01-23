import React, { useRef, useState, useCallback, HTMLAttributes } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";

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
  const {
    nodeDisp,
    dragState,
    transform,
    isMovingCanvas,
    setNodeStyle,
    nodeState,
    dragDisp,
  } = useBuilder();
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
      const unit = computedStyle.width.includes("%") ? "%" : "px";
      const startX = e.clientX;
      const startY = e.clientY;

      setIsResizing(true);

      // Initial helper position and dimensions
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

        // Update helper with new position and dimensions
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

  const getBorderResizeStyles = (direction: Direction): React.CSSProperties => {
    const borderSize = 4 / transform.scale;

    switch (direction) {
      case "top":
        return {
          top: 0,
          left: 0,
          right: 0,
          height: borderSize,
          transform: "translateY(-50%)",
        };
      case "right":
        return {
          top: 0,
          right: 0,
          bottom: 0,
          width: borderSize,
          transform: "translateX(50%)",
        };
      case "bottom":
        return {
          bottom: 0,
          left: 0,
          right: 0,
          height: borderSize,
          transform: "translateY(50%)",
        };
      case "left":
        return {
          top: 0,
          left: 0,
          bottom: 0,
          width: borderSize,
          transform: "translateX(-50%)",
        };
      default:
        return {};
    }
  };

  const getHandleStyles = (direction: Direction): React.CSSProperties => {
    switch (direction) {
      case "topLeft":
        return { top: 0, left: 0 };
      case "topRight":
        return { top: 0, right: 0 };
      case "bottomRight":
        return { bottom: 0, right: 0 };
      case "bottomLeft":
        return { bottom: 0, left: 0 };
      default:
        return {};
    }
  };

  const startAdjustingGap = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    // Store current selection state
    const currentSelection = [...dragState.selectedIds];

    const currentGap = parseInt(
      getComputedStyle(elementRef.current!).gap || "0"
    );
    const isHorizontal =
      getComputedStyle(elementRef.current!).flexDirection === "row";

    // Show initial helper
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

      // Update helper with new position and value
      dragDisp.updateStyleHelper({
        type: "gap",
        position: { x: moveEvent.clientX, y: moveEvent.clientY },
        value: newGap,
      });

      // Update the style
      setNodeStyle(
        {
          gap: `${Math.round(newGap)}px`,
        },
        [node.id],
        true
      );

      // Restore selection after style update
      if (dragState.selectedIds.length === 0) {
        dragState.selectedIds = currentSelection;
      }
    };

    const handleMouseUp = () => {
      dragDisp.hideStyleHelper();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      // Ensure selection is maintained after mouse up
      if (dragState.selectedIds.length === 0) {
        dragState.selectedIds = currentSelection;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const renderGapHandles = () => {
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
            onMouseDown={(e) => startAdjustingGap(e)}
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
            onMouseDown={(e) => startAdjustingGap(e)}
          />
        );
      }
    }

    return <>{gapHandles}</>;
  };

  const ResizeHandles = () => (
    <>
      {/* Corner handles */}
      {["topRight", "bottomRight", "bottomLeft", "topLeft"].map((direction) => (
        <div
          key={direction}
          className="absolute bg-blue-500 rounded-full border-2 border-white"
          style={{
            ...getHandleStyles(direction as Direction),
            cursor: getHandleCursor(direction as Direction),
            zIndex: 1000,
            width: `${8 / transform.scale}px`,
            height: `${8 / transform.scale}px`,
            transform: `translate(${
              direction.includes("Right") ? "50%" : "-50%"
            }, ${direction.includes("bottom") ? "50%" : "-50%"})`,
            pointerEvents: "all",
          }}
          onPointerDown={(e) => handleResizeStart(e, direction as Direction)}
        />
      ))}

      {/* Border resize areas */}
      {["top", "right", "bottom", "left"].map((direction) => (
        <div
          key={direction}
          className="absolute bg-transparent"
          style={{
            ...getBorderResizeStyles(direction as Direction),
            cursor: getHandleCursor(direction as Direction),
            zIndex: 999,
            pointerEvents: "all",
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
      outline:
        !isMovingCanvas && isSelected
          ? `${2 / transform.scale}px solid #3b82f6`
          : undefined,
      pointerEvents: isSelected ? "all" : undefined,
    },
    children: (
      <>
        {children.props.children}
        {isSelected && !isResizing && !isMovingCanvas && (
          <>
            <ResizeHandles />
            {renderGapHandles()}
          </>
        )}
      </>
    ),
  } as React.HTMLAttributes<HTMLElement>);
};
