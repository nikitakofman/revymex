import React, { useRef, useState, useEffect, useCallback } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useGetSelectedIds } from "../atoms/select-store";

interface ObjectPositionHandleProps {
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

export const ObjectPositionHandle: React.FC<ObjectPositionHandleProps> = ({
  node,
  elementRef,
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
  } = useBuilder();

  // Use the imperative getter function instead of subscription
  const getSelectedIds = useGetSelectedIds();

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPositionRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });

  // Add state to track whether the handle is interactive
  const [isInteractive, setIsInteractive] = useState(false);

  // Function to check if this node is the primary selected node
  // This is called during render but doesn't create a subscription
  const isPrimarySelectedNode = useCallback(() => {
    if (!isGroupSelection) return true;
    const selectedIds = getSelectedIds();
    return selectedIds.length > 0 && node.id === selectedIds[0];
  }, [isGroupSelection, node.id, getSelectedIds]);

  // Initialize position values based on existing objectPosition
  useEffect(() => {
    if (node && node.style.objectPosition) {
      // Parse existing objectPosition (e.g., "25% 75%")
      const positionStr = node.style.objectPosition.toString();
      const matches = positionStr.match(/(\d+)%\s+(\d+)%/);

      if (matches && matches.length === 3) {
        currentPositionRef.current = {
          x: parseInt(matches[1], 10),
          y: parseInt(matches[2], 10),
        };
      } else if (positionStr === "center") {
        currentPositionRef.current = { x: 50, y: 50 };
      } else if (positionStr.includes("top")) {
        currentPositionRef.current.y = 0;
      } else if (positionStr.includes("bottom")) {
        currentPositionRef.current.y = 100;
      } else if (positionStr.includes("left")) {
        currentPositionRef.current.x = 0;
      } else if (positionStr.includes("right")) {
        currentPositionRef.current.x = 100;
      }
    }
  }, [node]);

  // Start timer when the component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInteractive(true);
    }, 200); // 200ms delay before making it interactive

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Check if the node is eligible for the object-position handle
  const isEligibleNode = () => {
    // Direct image or video node
    if (node.type === "image" || node.type === "video") {
      return true;
    }

    // Frame with background image or video
    if (
      node.type === "frame" &&
      (node.style.backgroundImage || node.style.backgroundVideo)
    ) {
      return true;
    }

    return false;
  };

  // Check if objectFit is "cover" - the only mode where position adjustment makes sense
  const hasCoverObjectFit = () => {
    const objectFit = node.style.objectFit;
    return !objectFit || objectFit === "cover";
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // If not yet interactive, don't process the event
    if (!isInteractive) return;

    e.preventDefault();
    e.stopPropagation();

    const sessionId = startRecording();

    startPosRef.current = { x: e.clientX, y: e.clientY };

    // Get the current selected IDs imperatively at the time of the event
    const selectedIds = getSelectedIds();

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - startPosRef.current.x) / transform.scale;
      const deltaY = (e.clientY - startPosRef.current.y) / transform.scale;

      // Calculate the new position percentages (0-100%)
      // Moving right increases X percentage, which moves the image left
      // Moving down increases Y percentage, which moves the image up
      let newX = Math.max(
        0,
        Math.min(100, currentPositionRef.current.x + deltaX * 0.5)
      );
      let newY = Math.max(
        0,
        Math.min(100, currentPositionRef.current.y + deltaY * 0.5)
      );

      if (e.shiftKey) {
        // Round to nearest 10% when shift is held
        newX = Math.round(newX / 10) * 10;
        newY = Math.round(newY / 10) * 10;
      }

      // Apply object position to all selected nodes if it's a group selection
      const nodesToUpdate = isGroupSelection ? selectedIds : [node.id];

      // Update the node style
      setNodeStyle(
        { objectPosition: `${Math.round(newX)}% ${Math.round(newY)}%` },
        nodesToUpdate,
        true
      );

      // Set the current position reference for future movements
      currentPositionRef.current = { x: newX, y: newY };

      // Update the start position to avoid accumulating delta
      startPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      dragDisp.hideStyleHelper();
      stopRecording(sessionId);
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

  // Don't render if the node isn't eligible or doesn't have objectFit: cover
  if (!isEligibleNode() || !hasCoverObjectFit()) {
    return null;
  }

  // Don't render at very small scales
  if (transform.scale < 0.2) return null;

  const handleSize = 8 / transform.scale;
  const borderWidth = 1 / transform.scale;
  const offset = 12 / transform.scale;

  // For group selection, position at bottom-right of group bounds
  // Otherwise, position at bottom-right of element
  const handlePosition =
    isGroupSelection && groupBounds
      ? {
          position: "absolute" as const,
          right: `${offset}px`,
          bottom: `${offset}px`,
        }
      : {
          position: "absolute" as const,
          right: `${offset}px`,
          bottom: `${offset}px`,
        };

  return (
    <div
      data-object-position-handle="true"
      onMouseDown={handleMouseDown}
      style={{
        ...handlePosition,
        width: `${handleSize}px`,
        height: `${handleSize}px`,
        borderRadius: "50%",
        backgroundColor: "var(--accent)",
        border: `${borderWidth}px solid white`,
        cursor: "move",
        zIndex: 1001,
        // Critically, no pointer events until it becomes interactive
        pointerEvents: isInteractive ? "auto" : "none",
        // Optional: add a subtle fade-in for visual polish
        transition: "opacity 0s ease-out",
        // Add an icon or indicator to show it's for positioning
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Optional: Add a small inner indicator */}
      <div
        style={{
          width: `${handleSize * 0.4}px`,
          height: `${handleSize * 0.4}px`,
          borderRadius: "50%",
          backgroundColor: "white",
        }}
      />
    </div>
  );
};
