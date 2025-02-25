import React, { useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";

interface BorderRadiusHandleProps {
  node: Node;
  elementRef: React.RefObject<HTMLDivElement>;
  groupBounds?: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
  isGroupSelection?: boolean;
}

export const BorderRadiusHandle: React.FC<BorderRadiusHandleProps> = ({
  node,
  groupBounds,
  isGroupSelection = false,
}) => {
  const {
    setNodeStyle,
    transform,
    dragDisp,
    startRecording,
    stopRecording,
    dragState,
    setIsAdjustingBorderRadius,
  } = useBuilder();

  const startPosRef = useRef<number>(0);
  const startRadiusRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sessionId = startRecording();
    setIsAdjustingBorderRadius(true);
    // Get current radius in pixels - use the primary node as reference
    let currentRadius = 0;
    if (node.style.borderRadius) {
      const match = node.style.borderRadius.toString().match(/(\d+)/);
      if (match) {
        currentRadius = parseInt(match[1]);
      }
    }

    startRadiusRef.current = currentRadius;
    startPosRef.current = e.clientY;

    dragDisp.updateStyleHelper({
      type: "radius",
      position: { x: e.clientX, y: e.clientY },
      value: currentRadius,
    });

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = (e.clientY - startPosRef.current) / transform.scale;
      let newRadius = Math.max(0, startRadiusRef.current + deltaY);

      if (e.shiftKey) {
        newRadius = Math.round(newRadius / 32) * 32;
      }

      dragDisp.updateStyleHelper({
        type: "radius",
        position: { x: e.clientX, y: e.clientY },
        value: newRadius,
      });

      // Apply border radius to all selected nodes if it's a group selection
      const nodesToUpdate = isGroupSelection
        ? dragState.selectedIds
        : [node.id];

      if (newRadius === 0) {
        setNodeStyle({ borderRadius: undefined }, nodesToUpdate, true);
      } else {
        setNodeStyle(
          { borderRadius: `${Math.round(newRadius)}px` },
          nodesToUpdate,
          true
        );
      }
    };

    const handleMouseUp = () => {
      dragDisp.hideStyleHelper();
      stopRecording(sessionId);
      setIsAdjustingBorderRadius(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Don't render if this isn't the primary selected node in a group
  if (isGroupSelection && node.id !== dragState.selectedIds[0]) {
    return null;
  }

  // Don't render at very small scales
  if (transform.scale < 0.2) return null;

  const handleSize = 8 / transform.scale;
  const borderWidth = 1 / transform.scale;
  const offset = 12 / transform.scale;

  // For group selection, position at top-left of group bounds
  const handlePosition =
    isGroupSelection && groupBounds
      ? {
          position: "absolute" as const,
          left: `${offset}px`,
          top: `${offset}px`,
        }
      : {
          position: "absolute" as const,
          left: `${offset}px`,
          top: `${offset}px`,
        };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        ...handlePosition,
        width: `${handleSize}px`,
        height: `${handleSize}px`,
        borderRadius: "50%",
        backgroundColor:
          node.isDynamic || node.dynamicParentId
            ? "var(--accent-secondary)"
            : "var(--accent)",
        border: `${borderWidth}px solid white`,
        cursor: "ns-resize",
        zIndex: 1001,
        pointerEvents: "auto",
      }}
    />
  );
};
