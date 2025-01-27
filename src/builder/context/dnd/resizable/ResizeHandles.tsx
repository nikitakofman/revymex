import React from "react";

import { Node } from "@/builder/reducer/nodeDispatcher";
import { Direction, getHandleCursor } from "../utils";

interface ResizeHandlesProps {
  node: Node;
  transform: { scale: number };
  dragState: { dynamicModeNodeId: string | null; selectedIds: string[] };
  getBorderWidth: () => number;
  handleResizeStart: (e: React.PointerEvent, direction: Direction) => void;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  node,
  transform,
  dragState,
  getBorderWidth,
  handleResizeStart,
}) => {
  const getBorderResizeStyles = (direction: Direction): React.CSSProperties => {
    const borderSize = 4 / transform.scale;
    const borderWidth = getBorderWidth();
    const offset = -borderWidth;

    switch (direction) {
      case "top":
        return {
          top: offset,
          left: offset,
          right: offset,
          height: borderSize,
          transform: "translateY(-50%)",
        };
      case "right":
        return {
          top: offset,
          right: offset,
          bottom: offset,
          width: borderSize,
          transform: "translateX(50%)",
        };
      case "bottom":
        return {
          bottom: offset,
          left: offset,
          right: offset,
          height: borderSize,
          transform: "translateY(50%)",
        };
      case "left":
        return {
          top: offset,
          left: offset,
          bottom: offset,
          width: borderSize,
          transform: "translateX(-50%)",
        };
      default:
        return {};
    }
  };

  const getHandleStyles = (direction: Direction): React.CSSProperties => {
    const borderWidth = getBorderWidth();
    const offset = -borderWidth;

    switch (direction) {
      case "topLeft":
        return { top: offset, left: offset };
      case "topRight":
        return { top: offset, right: offset };
      case "bottomRight":
        return { bottom: offset, right: offset };
      case "bottomLeft":
        return { bottom: offset, left: offset };
      default:
        return {};
    }
  };

  return (
    <>
      {["topRight", "bottomRight", "bottomLeft", "topLeft"].map((direction) => (
        <div
          key={direction}
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
            transformOrigin: "center",
            pointerEvents: "all",
          }}
          onPointerDown={(e) => handleResizeStart(e, direction as Direction)}
        />
      ))}

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
};
