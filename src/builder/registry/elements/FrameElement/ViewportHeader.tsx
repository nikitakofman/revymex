// src/builder/registry/elements/ViewportHeader.tsx
import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { Ellipsis } from "lucide-react";
import {
  useGetSelectedIds,
  selectOps,
} from "@/builder/context/atoms/select-store";
import { useNodeHovered, hoverOps } from "@/builder/context/atoms/hover-store";
import {
  dragOps,
  useGetDragPositions,
  useGetIsDragging,
} from "@/builder/context/atoms/drag-store";
import { contextMenuOps } from "@/builder/context/atoms/context-menu-store";
import {
  useGetIsMovingCanvas,
  useGetTransform,
  useIsMovingCanvas,
  useTransform,
} from "@/builder/context/atoms/canvas-interaction-store";
import {
  useNodeStyle,
  useGetNodeFlags,
  useGetNodeParent,
} from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import { useDragStart } from "@/builder/context/dnd/useDragStart";
import { useBuilderRefs } from "@/builder/context/builderState";

interface ViewportHeaderProps {
  nodeId: string;
}

export const ViewportHeader: React.FC<ViewportHeaderProps> = ({ nodeId }) => {
  const style = useNodeStyle(nodeId);
  const getNodeFlags = useGetNodeFlags();
  const flags = getNodeFlags(nodeId);
  const getNodeParent = useGetNodeParent();
  const { isLocked, viewportName } = flags;
  const isMovingCanvas = useIsMovingCanvas();

  const { containerRef, contentRef } = useBuilderRefs();
  const transform = useTransform();

  const isHovered = useNodeHovered(nodeId);
  const getSelectedIds = useGetSelectedIds();
  const getDragPositions = useGetDragPositions();
  const getIsDragging = useGetIsDragging();
  const isDragging = getIsDragging();

  const handleDragStart = useDragStart();

  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartedRef = useRef(false);
  const dragPositionInterval = useRef<
    string | number | NodeJS.Timeout | undefined
  >(null);
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const draggedOffsetRef = useRef({ mouseX: 0, mouseY: 0 });

  const parentId = getNodeParent(nodeId);

  const position = {
    x: style.left ? parseFloat(style.left.toString()) : 0,
    y: style.top ? parseFloat(style.top.toString()) : 0,
  };

  const headerHeight = 36;
  const headerMargin = 10;
  const scaledHeaderHeight = headerHeight / transform.scale;
  const scaledHeaderMargin = headerMargin / transform.scale;

  // Simple click handler that just selects the viewport
  const handleHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectOps.selectNode(nodeId);
  };

  // Function to start tracking the dragged element's position
  const startPositionTracking = () => {
    // Clear any existing interval
    if (dragPositionInterval.current) {
      clearInterval(dragPositionInterval.current);
    }

    // Set up an interval to track the position during drag
    dragPositionInterval.current = setInterval(() => {
      const dragPositions = getDragPositions();
      // FIXED: Use getState().draggedNodes instead of getDragState().draggedNode
      const dragState = dragOps.getState();
      const primaryDraggedNode =
        dragState.draggedNodes.length > 0 ? dragState.draggedNodes[0] : null;
      const currentTransform = transform;

      // Check for the dragged element
      const draggedEl = document.querySelector(
        `[data-node-dragged="${nodeId}"]`
      ) as HTMLElement;

      if (draggedEl && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const elRect = draggedEl.getBoundingClientRect();

        // Calculate the position in the canvas
        const elX =
          (elRect.left - containerRect.left - currentTransform.x) /
          currentTransform.scale;
        const elY =
          (elRect.top - containerRect.top - currentTransform.y) /
          currentTransform.scale;

        // Store the position
        lastPositionRef.current = { x: elX, y: elY };
      } else if (
        dragPositions &&
        (dragPositions.x !== 0 || dragPositions.y !== 0) &&
        primaryDraggedNode
      ) {
        // Convert pointer position to element origin by subtracting the mouse offset
        lastPositionRef.current = {
          x:
            dragPositions.x -
            primaryDraggedNode.offset.mouseX / currentTransform.scale,
          y:
            dragPositions.y -
            primaryDraggedNode.offset.mouseY / currentTransform.scale,
        };
      }
    }, 50); // Poll every 50ms during drag
  };

  // Function to stop tracking
  const stopPositionTracking = () => {
    if (dragPositionInterval.current) {
      clearInterval(dragPositionInterval.current);
      dragPositionInterval.current = null;
    }
  };

  // Drag handler that initiates drag after movement
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Always select the viewport on mousedown, regardless of drag
    selectOps.selectNode(nodeId);

    // Store mouse position for movement detection
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartedRef.current = false;

    // Add data attribute to the current viewport header to track it specifically
    const viewportHeader = e.currentTarget;
    viewportHeader.setAttribute("data-being-dragged", "true");

    // Mouse move handler to detect drag
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!mouseDownPosRef.current || dragStartedRef.current) return;

      // Calculate movement
      const dx = Math.abs(moveEvent.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(moveEvent.clientY - mouseDownPosRef.current.y);

      // If moved enough, start dragging
      if (dx > 3 || dy > 3) {
        dragStartedRef.current = true;

        // Get current selected IDs
        const selectedIds = getSelectedIds();

        // Ensure the viewport is selected before starting drag
        if (!selectedIds.includes(nodeId)) {
          selectOps.selectNode(nodeId);
        }

        // Start tracking the dragged element's position
        startPositionTracking();

        const nodeData = {
          id: nodeId,
          ...flags,
          parentId,
          style,
        };

        // Start dragging
        handleDragStart(e as any, undefined, nodeData);

        // Mark the actual element with data-node-dragged attribute
        const domEl = document.querySelector(
          `[data-node-id="${nodeId}"]`
        ) as HTMLElement;
        if (domEl) {
          domEl.setAttribute("data-node-dragged", nodeId);
        }

        // Stop propagation to prevent deselection on mouseup
        moveEvent.stopPropagation();
      }
    };

    // Mouse up handler for cleanup
    const handleMouseUp = () => {
      // Only clean up drag state if we actually started dragging
      if (dragStartedRef.current) {
        console.log("Cleaning up drag state");

        // Stop tracking the position
        stopPositionTracking();

        // Get the final position from our tracking
        const finalPos = { ...lastPositionRef.current };
        console.log("Final captured position:", finalPos);

        // Update the node style with the position
        if (finalPos.x !== 0 || finalPos.y !== 0) {
          // Use updateNodeStyle instead of setNodeStyle
          updateNodeStyle(
            nodeId,
            {
              left: `${finalPos.x}px`,
              top: `${finalPos.y}px`,
            },
            { dontSync: true }
          );
        } else {
          // Fallback - try to get the position directly from the DOM
          const draggedEl = document.querySelector(
            `[data-node-dragged="${nodeId}"]`
          ) as HTMLElement;
          if (draggedEl && containerRef.current) {
            // Remove data-node-dragged attribute
            draggedEl.removeAttribute("data-node-dragged");

            // Get the current transform
            const currentTransform = transform;

            const containerRect = containerRef.current.getBoundingClientRect();
            const elRect = draggedEl.getBoundingClientRect();

            // Calculate the position in the canvas
            const elX =
              (elRect.left - containerRect.left - currentTransform.x) /
              currentTransform.scale;
            const elY =
              (elRect.top - containerRect.top - currentTransform.y) /
              currentTransform.scale;

            console.log("DOM position fallback:", { x: elX, y: elY });

            // Use updateNodeStyle instead of setNodeStyle
            updateNodeStyle(
              nodeId,
              {
                left: `${elX}px`,
                top: `${elY}px`,
              },
              { dontSync: true }
            );
          } else {
            // Hard fallback - manually set a position to avoid resetting to origin
            console.log("Using hard fallback position");
            const currentLeft = parseFloat(style.left as string) || 0;
            const currentTop = parseFloat(style.top as string) || 0;

            // Attempt to preserve current position if it exists
            if (currentLeft !== 0 || currentTop !== 0) {
              // Use updateNodeStyle instead of setNodeStyle
              updateNodeStyle(
                nodeId,
                {
                  left: style.left,
                  top: style.top,
                },
                { dontSync: true }
              );
            } else {
              // Use a default offset if no position exists
              // Use updateNodeStyle instead of setNodeStyle
              updateNodeStyle(
                nodeId,
                {
                  left: "10px",
                  top: "10px",
                },
                { dontSync: true }
              );
            }
          }
        }

        // Reset drag state
        dragOps.setIsDragging(false);
        dragOps.resetDragState();
      }

      // Remove drag attribute
      viewportHeader.removeAttribute("data-being-dragged");

      // Remove data-node-dragged attribute from the element if it exists
      document
        .querySelector(`[data-node-dragged="${nodeId}"]`)
        ?.removeAttribute("data-node-dragged");

      // Get current selected IDs before ensuring viewport stays selected
      const currentSelectedIds = getSelectedIds();

      // Ensure the viewport stays selected after drag
      if (!currentSelectedIds.includes(nodeId)) {
        selectOps.selectNode(nodeId);
      }

      mouseDownPosRef.current = null;
      dragStartedRef.current = false;

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    // Add event listeners
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Only render if within a portal context
  if (!contentRef.current || isDragging || !position || isMovingCanvas) {
    return null;
  }

  return createPortal(
    <div
      data-viewport-header="true"
      data-viewport-id={nodeId}
      className={`absolute viewport-header overflow-hidden select-none bg-[var(--control-bg)] z-[9999] flex items-center ${
        isHovered ? "hover-highlight" : ""
      }`}
      style={{
        // Position relative to the viewport with the same transform as the canvas
        position: "absolute",
        transformOrigin: "top left",
        // Position is set in the untransformed coordinate space
        left: style.left,
        top:
          parseFloat(String(style.top)) -
          scaledHeaderHeight -
          scaledHeaderMargin,
        width: parseFloat(String(style.width)),
        height: `${scaledHeaderHeight}px`,
        boxShadow: "var(--shadow-sm)",
        border: `${1 / transform.scale}px solid var(--border-light)`,
        padding: `0 ${8 / transform.scale}px`,
        borderRadius: `${8 / transform.scale}px`,
        minHeight: `${Math.min(36, 24 / transform.scale)}px`,
        maxHeight: `${36 / transform.scale}px`,
        pointerEvents: "auto",
      }}
      onMouseOver={(e) => {
        e.stopPropagation();

        // Get current selected IDs
        const currentSelectedIds = getSelectedIds();

        if (!currentSelectedIds.includes(nodeId)) {
          requestAnimationFrame(() => {
            hoverOps.setHoverNodeId(nodeId);
          });
        }
      }}
      onMouseOut={(e) => {
        e.stopPropagation();

        // Get current selected IDs
        const currentSelectedIds = getSelectedIds();

        if (!currentSelectedIds.includes(nodeId) && isHovered) {
          requestAnimationFrame(() => {
            hoverOps.setHoverNodeId(null);
          });
        }
      }}
      onClick={handleHeaderClick}
      onMouseDown={(e) => {
        if (isLocked) {
          return;
        } else {
          handleHeaderMouseDown(e);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        contextMenuOps.setContextMenu(e.clientX, e.clientY, nodeId, true);
      }}
    >
      <div className="flex pointer-events-none items-center justify-between w-full">
        <div
          className="flex items-center gap-1 text-[var(--text-secondary)]"
          style={{
            padding: `${6 / transform.scale}px ${8 / transform.scale}px`,
            fontSize: `${10 / transform.scale}px`,
          }}
        >
          {viewportName || nodeId}
        </div>

        {/* Single ellipsis button - only shown when scale >= 0.15 */}
        {transform.scale >= 0.15 && (
          <div className="flex items-center">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const buttonRect = e.currentTarget.getBoundingClientRect();
                contextMenuOps.showViewportContextMenu(nodeId, {
                  x: buttonRect.right,
                  y: buttonRect.bottom,
                });
              }}
              className="flex items-center justify-center hover:bg-[var(--accent)] text-white transition-colors duration-150"
              style={{
                width: `${24 / transform.scale}px`,
                height: `${24 / transform.scale}px`,
                borderRadius: `${6 / transform.scale}px`,
                pointerEvents: "auto",
              }}
            >
              <Ellipsis size={14 / transform.scale} />
            </button>
          </div>
        )}
      </div>
    </div>,
    contentRef.current
  );
};
