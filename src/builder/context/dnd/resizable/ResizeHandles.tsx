import React from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Direction, getHandleCursor } from "../utils";
import { useBuilder } from "../../builderState";

interface ResizeHandlesProps {
  node: Node;
  handleResizeStart: (e: React.PointerEvent, direction: Direction) => void;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  node,
  handleResizeStart,
}) => {
  const { dragState, transform } = useBuilder();

  const getBorderResizeStyles = (direction: Direction): React.CSSProperties => {
    const borderSize = 4 / transform.scale;
    const baseStyles = {
      position: "absolute",
      transformOrigin: "center",
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

  const getHandleStyles = (direction: Direction): React.CSSProperties => {
    const basePosition = {
      position: "absolute",
      transformOrigin: "center",
    } as React.CSSProperties;

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
