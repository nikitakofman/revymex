import React, { useRef, useState } from "react";
import { Component, Crown } from "lucide-react"; // Import Crown icon from lucide-react
import { useDragStart } from "../dnd/useDragStart";
import { selectOps } from "../atoms/select-store";
import { useIsDragging } from "../atoms/drag-store";
import { contextMenuOps } from "../atoms/context-menu-store";
import { useTransform } from "../atoms/canvas-interaction-store";
import {
  useDynamicModeNodeId,
  useActiveViewportInDynamicMode,
} from "../atoms/dynamic-store";
import {
  useNodeFlags,
  useNodeParent,
  useNodeBasics,
  useGetNode,
  useNodeStyle,
  useGetNodeFlags,
  useNodeDynamicInfo,
  getCurrentNodes,
} from "../atoms/node-store";

const NameDisplay = ({ nodeId }: { nodeId: string }) => {
  const handleDragStart = useDragStart();

  // Get node data directly from atoms
  const flags = useNodeFlags(nodeId);
  const { isViewport, isDynamic, isVariant, inViewport } = flags;
  const parentId = useNodeParent(nodeId);
  const basics = useNodeBasics(nodeId);
  const { type, customName } = basics;
  const dynamicInfo = useNodeDynamicInfo(nodeId);

  // Get a full node builder for compatibility with drag functions
  const getNode = useGetNode();
  const getNodeFlags = useGetNodeFlags();

  // Use atoms for state
  const transform = useTransform();
  const isDraggingFromStore = useIsDragging();
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();

  const { setSelectedIds } = selectOps;

  // Store mousedown position and time for drag detection
  const mouseDownRef = useRef({ x: 0, y: 0, time: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const allNodes = getCurrentNodes();
  const activeViewport = allNodes.find(
    (node) => node.id === activeViewportInDynamicMode
  );

  // Don't show name if currently dragging
  if (isDraggingFromStore) return null;

  // In normal mode (not dynamic mode)
  if (!dynamicModeNodeId) {
    // Only show names for:
    // 1. Viewports
    // 2. Canvas elements (parentId === null and not inViewport)
    // 3. Top-level dynamic nodes that are also on canvas (parentId === null)

    if (isViewport) {
      // Always show viewport names
    } else if (parentId === null && !inViewport) {
      // Show canvas element names (including top-level dynamic nodes)
    } else {
      // Don't show names for anything else (including dynamic nodes with parents)
      return null;
    }
  } else {
    // In dynamic mode
    // Only show names for nodes that belong to the active viewport
    if (dynamicInfo.dynamicViewportId !== activeViewportInDynamicMode) {
      return null;
    }

    // Don't show names for child nodes (only top-level)
    if (parentId !== null && !dynamicInfo.isTopLevelDynamicNode) {
      return null;
    }
  }

  // Determine name to display - always start with custom name or type
  let nameToDisplay = customName || type;

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

  // Check if this is a top-level dynamic node
  const isTopLevelDynamicNode = dynamicInfo.isTopLevelDynamicNode === true;

  // Only append viewport name in dynamic mode for dynamic nodes and variants
  if (dynamicModeNodeId && viewportName && (isDynamic || isVariant)) {
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

        // Build a node for drag operation
        const node = getNode(nodeId);

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
          setSelectedIds([nodeId]);
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
        color: dynamicModeNodeId ? "var(--accent-secondary)" : "var(--accent)",
        whiteSpace: "nowrap",
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) =>
        contextMenuOps.setContextMenu(e.clientX, e.clientY, nodeId, true)
      }
    >
      {/* Show Crown icon for top-level dynamic nodes */}
      {isTopLevelDynamicNode && !isVariant && (
        <Crown
          fill={dynamicModeNodeId ? "var(--accent-secondary)" : "var(--accent)"}
          style={{
            marginRight: `${6 / transform.scale}px`,
            width: `${12 / transform.scale}px`,
            height: `${12 / transform.scale}px`,
          }}
        />
      )}
      {/* Show Component icon for variants */}
      {isVariant && (
        <Component
          fill={dynamicModeNodeId ? "var(--accent-secondary)" : "var(--accent)"}
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
