import React from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Direction, getHandleCursor } from "../utils";
import { useBuilder } from "../../builderState";

interface GroupBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ResizeHandlesProps {
  node: Node;
  handleResizeStart: (e: React.PointerEvent, direction: Direction) => void;
  groupBounds?: GroupBounds | null;
  isGroupSelection?: boolean;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  node,
  handleResizeStart,
  groupBounds,
  isGroupSelection,
}) => {
  const { dragState, transform } = useBuilder();
  const isWidthAuto = node.style.width === "auto";
  const isHeightAuto = node.style.height === "auto";

  // Handle click on resize borders to prevent drag
  const handleBorderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  // Handle pointer down events for resize
  const handlePointerDown = (e: React.PointerEvent, direction: Direction) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    handleResizeStart(e, direction);
  };

  // If it's a group selection and we don't have group bounds, don't render anything
  if (isGroupSelection && !groupBounds) return null;

  // If it's a group selection, only the primary selected node should show resize handles
  if (isGroupSelection && node.id !== dragState.selectedIds[0]) return null;

  const getHandleStyles = (direction: Direction): React.CSSProperties => {
    const basePosition = {
      position: "absolute",
      transformOrigin: "center",
    } as React.CSSProperties;

    if (isWidthAuto) {
      switch (direction) {
        case "top":
          return { ...basePosition, top: "0", left: "50%" };
        case "bottom":
          return { ...basePosition, bottom: "0", left: "50%" };
      }
    }

    if (isHeightAuto) {
      switch (direction) {
        case "left":
          return { ...basePosition, left: "0", top: "50%" };
        case "right":
          return { ...basePosition, right: "0", top: "50%" };
      }
    }

    switch (direction) {
      case "topLeft":
        return { ...basePosition, top: 0, left: 0 };
      case "topRight":
        return { ...basePosition, top: 0, right: 0 };
      case "bottomRight":
        return { ...basePosition, bottom: 0, right: 0 };
      case "bottomLeft":
        return { ...basePosition, bottom: 0, left: 0 };
      default:
        return basePosition;
    }
  };

  const getGroupBorderStyles = (direction: Direction): React.CSSProperties => {
    const borderSize = 4 / transform.scale;
    const baseStyles = {
      position: "absolute",
      transformOrigin: "center",
      pointerEvents: "all",
    } as React.CSSProperties;

    switch (direction) {
      case "top":
        return {
          ...baseStyles,
          top: 0,
          left: 0,
          right: 0,
          height: borderSize,
          transform: "translateY(-50%)",
        };
      case "right":
        return {
          ...baseStyles,
          top: 0,
          right: 0,
          bottom: 0,
          width: borderSize,
          transform: "translateX(50%)",
        };
      case "bottom":
        return {
          ...baseStyles,
          bottom: 0,
          left: 0,
          right: 0,
          height: borderSize,
          transform: "translateY(50%)",
        };
      case "left":
        return {
          ...baseStyles,
          top: 0,
          left: 0,
          bottom: 0,
          width: borderSize,
          transform: "translateX(-50%)",
        };
      default:
        return baseStyles;
    }
  };

  const getGroupHandleStyles = (direction: Direction): React.CSSProperties => {
    const handleSize = 8 / transform.scale;
    const baseStyles = {
      position: "absolute",
      width: `${handleSize}px`,
      height: `${handleSize}px`,
      zIndex: 1000,
      pointerEvents: "all",
    } as React.CSSProperties;

    switch (direction) {
      case "topLeft":
        return {
          ...baseStyles,
          top: 0,
          left: 0,
          transform: `translate(-50%, -50%)`,
        };
      case "topRight":
        return {
          ...baseStyles,
          top: 0,
          right: 0,
          transform: `translate(50%, -50%)`,
        };
      case "bottomRight":
        return {
          ...baseStyles,
          bottom: 0,
          right: 0,
          transform: `translate(50%, 50%)`,
        };
      case "bottomLeft":
        return {
          ...baseStyles,
          bottom: 0,
          left: 0,
          transform: `translate(-50%, 50%)`,
        };
      case "top":
        return {
          ...baseStyles,
          top: 0,
          left: "50%",
          transform: `translate(-50%, -50%)`,
        };
      case "right":
        return {
          ...baseStyles,
          top: "50%",
          right: 0,
          transform: `translate(50%, -50%)`,
        };
      case "bottom":
        return {
          ...baseStyles,
          bottom: 0,
          left: "50%",
          transform: `translate(-50%, 50%)`,
        };
      case "left":
        return {
          ...baseStyles,
          top: "50%",
          left: 0,
          transform: `translate(-50%, -50%)`,
        };
      default:
        return baseStyles;
    }
  };

  // Group selection mode
  if (isGroupSelection && groupBounds) {
    return (
      <>
        {["topRight", "bottomRight", "bottomLeft", "topLeft"].map(
          (direction) => (
            <div
              key={direction}
              data-resize-handle="true"
              className={`absolute ${
                node.isDynamic || dragState.dynamicModeNodeId
                  ? "bg-[var(--accent-secondary)]"
                  : "bg-blue-500"
              } rounded-full`}
              style={{
                ...getHandleStyles(direction as Direction),
                cursor: getHandleCursor(direction as Direction),
                zIndex: 1000,
                width: `${8 / transform.scale}px`,
                height: `${8 / transform.scale}px`,
                transform: `translate(${
                  direction.includes("Right") ? "50%" : "-50%"
                }, ${direction.includes("bottom") ? "50%" : "-50%"})`,
                border: `${1 / transform.scale}px solid white`,
                pointerEvents: "all",
              }}
              onClick={handleBorderClick}
              onMouseDown={handleBorderClick}
              onPointerDown={(e) =>
                handlePointerDown(e, direction as Direction)
              }
            />
          )
        )}

        {/* Edge handles */}
        {["top", "right", "bottom", "left"].map((direction) => (
          <div
            key={direction}
            data-resize-handle="true"
            className="bg-transparent"
            style={{
              ...getGroupBorderStyles(direction as Direction),
              cursor: getHandleCursor(direction as Direction),
              zIndex: 999,
            }}
            onClick={handleBorderClick}
            onMouseDown={handleBorderClick}
            onPointerDown={(e) => handlePointerDown(e, direction as Direction)}
          />
        ))}
      </>
    );
  }

  // Single element mode
  return (
    <>
      {/* Corner handles for normal mode */}
      {!isWidthAuto && !isHeightAuto
        ? ["topRight", "bottomRight", "bottomLeft", "topLeft"].map(
            (direction) => (
              <div
                key={direction}
                data-resize-handle="true"
                className={`absolute ${
                  node.isDynamic || dragState.dynamicModeNodeId
                    ? "bg-[var(--accent-secondary)]"
                    : "bg-blue-500"
                } rounded-full`}
                style={{
                  ...getHandleStyles(direction as Direction),
                  cursor: getHandleCursor(direction as Direction),
                  zIndex: 1000,
                  width: `${8 / transform.scale}px`,
                  height: `${8 / transform.scale}px`,
                  transform: `translate(${
                    direction.includes("Right") ? "50%" : "-50%"
                  }, ${direction.includes("bottom") ? "50%" : "-50%"})`,
                  border: `${1 / transform.scale}px solid white`,
                  pointerEvents: "all",
                }}
                onClick={handleBorderClick}
                onMouseDown={handleBorderClick}
                onPointerDown={(e) =>
                  handlePointerDown(e, direction as Direction)
                }
              />
            )
          )
        : isWidthAuto && !isHeightAuto // Only show if height is not auto when width is auto
        ? ["top", "bottom"].map((direction) => (
            <div
              key={direction}
              data-resize-handle="true"
              className={`absolute ${
                node.isDynamic || dragState.dynamicModeNodeId
                  ? "bg-[var(--accent-secondary)]"
                  : "bg-blue-500"
              } rounded-full`}
              style={{
                ...getHandleStyles(direction),
                cursor: getHandleCursor(direction as Direction),
                zIndex: 1000,
                width: `${8 / transform.scale}px`,
                height: `${8 / transform.scale}px`,
                transform:
                  direction === "top"
                    ? "translate(-50%, -50%)"
                    : "translate(-50%, 50%)",
                border: `${1 / transform.scale}px solid white`,
                pointerEvents: "all",
              }}
              onClick={handleBorderClick}
              onMouseDown={handleBorderClick}
              onPointerDown={(e) =>
                handlePointerDown(e, direction as Direction)
              }
            />
          ))
        : !isWidthAuto && isHeightAuto // Only show if width is not auto when height is auto
        ? ["left", "right"].map((direction) => (
            <div
              key={direction}
              data-resize-handle="true"
              className={`absolute ${
                node.isDynamic || dragState.dynamicModeNodeId
                  ? "bg-[var(--accent-secondary)]"
                  : "bg-blue-500"
              } rounded-full`}
              style={{
                ...getHandleStyles(direction),
                cursor: getHandleCursor(direction as Direction),
                zIndex: 1000,
                width: `${8 / transform.scale}px`,
                height: `${8 / transform.scale}px`,
                transform:
                  direction === "left"
                    ? "translate(-50%, -50%)"
                    : "translate(50%, -50%)",
                border: `${1 / transform.scale}px solid white`,
                pointerEvents: "all",
              }}
              onClick={handleBorderClick}
              onMouseDown={handleBorderClick}
              onPointerDown={(e) =>
                handlePointerDown(e, direction as Direction)
              }
            />
          ))
        : null}

      {/* Edge resize handles */}
      {["top", "right", "bottom", "left"].map((direction) => {
        if (
          (isWidthAuto && (direction === "left" || direction === "right")) ||
          (isHeightAuto && (direction === "top" || direction === "bottom"))
        ) {
          return null;
        }

        return (
          <div
            key={direction}
            data-resize-handle="true"
            className="absolute bg-transparent"
            style={{
              ...getGroupBorderStyles(direction as Direction),
              cursor: getHandleCursor(direction as Direction),
              zIndex: 999,
              pointerEvents: "all",
            }}
            onClick={handleBorderClick}
            onMouseDown={handleBorderClick}
            onPointerDown={(e) => handlePointerDown(e, direction as Direction)}
          />
        );
      })}
    </>
  );
};
