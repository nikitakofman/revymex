import { Node } from "@/builder/reducer/nodeDispatcher";
import React, { useRef, useState, useEffect } from "react";
import { useBuilder } from "../builderState";
import { Component, Crown } from "lucide-react"; // Import Crown icon from lucide-react
import { useDragStart } from "../dnd/useDragStart";

const NameDisplay = ({ node }: { node: Node }) => {
  const { nodeState, dragState, dragDisp, transform } = useBuilder();
  const handleDragStart = useDragStart();

  // Store mousedown position and time for drag detection
  const mouseDownRef = useRef({ x: 0, y: 0, time: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Get the full node data
  const fullNode = nodeState.nodes.find((nodes) => node.id === nodes.id);

  // Get active viewport in dynamic mode
  const activeViewport = nodeState.nodes.find(
    (nodes) => nodes.id === dragState.activeViewportInDynamicMode
  );

  // Early returns for nodes we don't want to display names for
  if (node.isViewport) return null;
  if (dragState.isDragging) return null;

  // In normal mode (not dynamic mode), don't show names for nodes in viewports
  if (!dragState.dynamicModeNodeId) {
    // Check if this node is inside a viewport
    const isInsideViewport = node.inViewport || !!node.parentId;
    if (isInsideViewport) return null;
  }

  // Changed: Now we're only filtering out non-top-level nodes in dynamic mode
  if (dragState.dynamicModeNodeId && node.parentId !== null && !node.isDynamic)
    return null;

  // Determine name to display - always start with custom name or type
  let nameToDisplay = node.customName || node.type;

  // Get the viewport name for appending to the display
  const viewportName =
    activeViewport?.viewportName ||
    (activeViewport?.viewportWidth
      ? activeViewport.viewportWidth >= 768
        ? "Desktop"
        : activeViewport.viewportWidth >= 376
        ? "Tablet"
        : "Mobile"
      : "");

  // Check if this is a base dynamic node or a variant
  const isBaseDynamicNode = node.isDynamic;
  const isVariant = node.isVariant;

  // Check if this should show the viewport suffix
  // We only want to show viewport suffix for:
  // 1. Base dynamic nodes (isDynamic)
  // 2. Actual variants (isVariant)
  // 3. NOT free-floating elements that just happen to have dynamicParentId
  const shouldShowViewportSuffix = isBaseDynamicNode || isVariant;

  // FIXED: Only append viewport name for proper dynamic nodes and variants
  if (dragState.dynamicModeNodeId && viewportName && shouldShowViewportSuffix) {
    nameToDisplay = `${nameToDisplay} - ${viewportName}`;
  }

  // Capitalize first letter
  const displayedName =
    nameToDisplay.slice(0, 1).toUpperCase() + nameToDisplay.slice(1);

  // CRITICAL FIX: Use transform scale to adjust the positioning
  // This ensures the visual gap remains the same regardless of zoom level
  const BASE_VERTICAL_OFFSET = 32; // Base offset in pixels at zoom level 1
  const adjustedVerticalOffset = BASE_VERTICAL_OFFSET / transform.scale;

  const handleMouseDown = (e: React.MouseEvent) => {
    // Store the initial mouse position and time
    mouseDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Calculate distance moved
      const dx = moveEvent.clientX - mouseDownRef.current.x;
      const dy = moveEvent.clientY - mouseDownRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If moved more than 5px, consider it a drag
      if (distance > 5 && !isDragging) {
        setIsDragging(true);

        // Start the drag operation
        handleDragStart(e as any, undefined, node);

        // Clean up event listeners
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      // If this wasn't a drag, it was a click
      if (!isDragging) {
        // Only count as a click if it's been less than 300ms
        const timeDiff = Date.now() - mouseDownRef.current.time;
        if (timeDiff < 300) {
          // This is a click - select the node
          dragDisp.setSelectedIds([node.id]);
        }
      }

      // Reset state
      setIsDragging(false);

      // Clean up event listeners
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    // Add event listeners
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className="absolute text-nowrap text-[var(--accent-secondary)] select-none flex items-center"
      style={{
        fontSize: 12 / transform.scale,
        // Adjust the position based on transform scale
        top: `-${adjustedVerticalOffset}px`,
        left: `0px`,
        pointerEvents: "auto", // Make sure clicks work
        textAlign: "left",
        color: dragState.dynamicModeNodeId
          ? "var(--accent-secondary)"
          : "var(--accent)",
        whiteSpace: "nowrap",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Show Crown icon for base dynamic nodes */}
      {isBaseDynamicNode && (
        <Crown
          fill="#000"
          style={{
            marginRight: `${6 / transform.scale}px`,
            width: `${12 / transform.scale}px`,
            height: `${12 / transform.scale}px`,
          }}
        />
      )}
      {isVariant && (
        <Component
          fill="#000"
          style={{
            marginRight: `${6 / transform.scale}px`,
            width: `${12 / transform.scale}px`,
            height: `${12 / transform.scale}px`,
          }}
        />
      )}
      {displayedName}
    </div>
  );
};

export default NameDisplay;
