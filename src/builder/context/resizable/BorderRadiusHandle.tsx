import React, { useRef, useState, useEffect, useCallback } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useGetSelectedIds } from "../atoms/select-store";
import { visualOps } from "../atoms/visual-store";
import { canvasOps, useTransform } from "../atoms/canvas-interaction-store";

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
  const { setNodeStyle, startRecording, stopRecording } = useBuilder();

  // Use the imperative getter function instead of subscription
  const getSelectedIds = useGetSelectedIds();
  const transform = useTransform();

  // Function to check if this node is the primary selected node
  const isPrimarySelectedNode = useCallback(() => {
    if (!isGroupSelection) return true;
    const selectedIds = getSelectedIds();
    return selectedIds.length > 0 && node.id === selectedIds[0];
  }, [isGroupSelection, node.id, getSelectedIds]);

  const startPosRef = useRef<number>(0);
  const startRadiusRef = useRef<number>(0);

  // Add state to track whether the handle is interactive
  const [isInteractive, setIsInteractive] = useState(false);

  // Start timer when the component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInteractive(true);
    }, 200); // 200ms delay before making it interactive

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // If not yet interactive, don't process the event
    if (!isInteractive) return;

    e.preventDefault();
    e.stopPropagation();

    const sessionId = startRecording();
    canvasOps.setIsAdjustingBorderRadius(true);

    // Get current selection state at the time of the event
    const selectedIds = getSelectedIds();

    // Get current radius in pixels
    let currentRadius = 0;
    if (node.style.borderRadius) {
      const match = node.style.borderRadius.toString().match(/(\d+)/);
      if (match) {
        currentRadius = parseInt(match[1]);
      }
    }

    startRadiusRef.current = currentRadius;
    startPosRef.current = e.clientY;

    visualOps.updateStyleHelper({
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

      visualOps.updateStyleHelper({
        type: "radius",
        position: { x: e.clientX, y: e.clientY },
        value: newRadius,
      });

      // Apply border radius to all selected nodes if it's a group selection
      const nodesToUpdate = isGroupSelection ? selectedIds : [node.id];

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
      visualOps.hideStyleHelper();
      stopRecording(sessionId);
      canvasOps.setIsAdjustingBorderRadius(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Don't render if this isn't the primary selected node in a group
  if (isGroupSelection && !isPrimarySelectedNode()) {
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
      data-border-radius-handle="true"
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
        pointerEvents: isInteractive ? "auto" : "none",
        transition: "opacity 0s ease-out",
      }}
    />
  );
};
