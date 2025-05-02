import {
  useBuilder,
  useBuilderDynamic,
  useBuilderRefs,
} from "@/builder/context/builderState";
import { ResizableWrapper } from "@/builder/context/resizable";
import { useConnect } from "@/builder/context/hooks/useConnect";
import { ElementProps } from "@/builder/types";
import {
  Plus,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Settings,
  Ellipsis,
} from "lucide-react";
import { nanoid } from "nanoid";
import Image from "next/image";
import { useEffect, useState, useRef, useMemo } from "react";
import { useDragStart } from "@/builder/context/dnd/useDragStart";
import Button from "@/components/ui/button";
import { createPortal } from "react-dom";
import {
  useNodeSelected,
  useGetSelectedIds,
  selectOps,
} from "@/builder/context/atoms/select-store";
import { useNodeHovered, hoverOps } from "@/builder/context/atoms/hover-store";
import {
  dragOps,
  useDropInfo,
  useGetDragPositions,
  useGetDropInfo,
  useGetIsDragging,
} from "@/builder/context/atoms/drag-store";
import { contextMenuOps } from "@/builder/context/atoms/context-menu-store";
import { useGetTransform } from "@/builder/context/atoms/canvas-interaction-store";
import {
  useNodeStyle,
  NodeId,
  useGetNodeFlags,
} from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";

export const Frame = ({
  children,
  nodeId,
}: {
  children?: React.ReactNode;
  nodeId: string;
}) => {
  console.log(`Frame re-rendering: ${nodeId}`, new Date().getTime());

  // Read style directly from the atom - this will make the component reactive to style changes
  const style = useNodeStyle(nodeId);
  const getNodeFlags = useGetNodeFlags();
  const flags = getNodeFlags(nodeId);

  const { nodeDisp } = useBuilderDynamic();
  const { containerRef, contentRef } = useBuilderRefs();

  const getIsDragging = useGetIsDragging();

  const connect = useConnect();

  // Replace useTransform with useGetTransform
  const getTransform = useGetTransform();

  // Use per-node subscription for hover and selection state
  const isSelected = useNodeSelected(nodeId);
  const isHovered = useNodeHovered(nodeId);
  const getDropInfo = useGetDropInfo();
  // Use imperative getter instead of subscription for selectedIds
  const getSelectedIds = useGetSelectedIds();
  const getDragPositions = useGetDragPositions();

  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartedRef = useRef(false);
  const dragPositionInterval = useRef<any>(null);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  // Extract important flags
  const { isViewport, isLocked, isDynamic, isVariant } = flags;

  // Get other properties from the style
  const viewportWidth = style.width ? parseInt(style.width.toString()) : 0;
  const viewportName = flags.viewportName;
  const position = {
    x: style.left ? parseFloat(style.left.toString()) : 0,
    y: style.top ? parseFloat(style.top.toString()) : 0,
  };

  const isDropTarget =
    getDropInfo()?.targetId === nodeId && getDropInfo()?.position === "inside";

  const handleDragStart = useDragStart();

  if (isViewport) {
    // Get transform directly when needed instead of subscribing to changes
    const transform = getTransform();

    const headerHeight = 36;
    const headerMargin = 10;
    const scaledHeaderHeight = headerHeight / transform.scale;
    const scaledHeaderMargin = headerMargin / transform.scale;

    // Simple click handler that just selects the viewport
    const handleHeaderClick = (e: React.MouseEvent) => {
      // Stop propagation but don't prevent default
      e.stopPropagation();

      // Simply select the viewport
      selectOps.selectNode(nodeId);
    };

    // Drag handler that initiates drag after movement
    const handleHeaderMouseDown = (e: React.MouseEvent) => {
      // Always select the viewport on mousedown, regardless of drag
      selectOps.selectNode(nodeId);

      // Store mouse position for movement detection
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      dragStartedRef.current = false;

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

          // Start dragging
          handleDragStart(e, undefined, { id: nodeId }); // Pass minimal node object with just ID

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
            updateNodeStyle(nodeId, {
              left: `${finalPos.x}px`,
              top: `${finalPos.y}px`,
            });

            // Update node position data
            nodeDisp.updateNodePosition(nodeId, finalPos);
          } else {
            // Fallback - try to get the position directly from the DOM
            const draggedEl = document.querySelector(
              `[data-node-dragged="${nodeId}"]`
            ) as HTMLElement;
            if (draggedEl && containerRef.current) {
              // Get the current transform from the imperative getter
              const currentTransform = getTransform();

              const containerRect =
                containerRef.current.getBoundingClientRect();
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
              updateNodeStyle(nodeId, {
                left: `${elX}px`,
                top: `${elY}px`,
              });

              nodeDisp.updateNodePosition(nodeId, { x: elX, y: elY });
            } else {
              // Hard fallback - manually set a position to avoid resetting to origin
              console.log("Using hard fallback position");
              const currentLeft = parseFloat(style.left as string) || 0;
              const currentTop = parseFloat(style.top as string) || 0;

              // Attempt to preserve current position if it exists
              if (currentLeft !== 0 || currentTop !== 0) {
                // Use updateNodeStyle instead of setNodeStyle
                updateNodeStyle(nodeId, {
                  left: style.left,
                  top: style.top,
                });
              } else {
                // Use a default offset if no position exists
                // Use updateNodeStyle instead of setNodeStyle
                updateNodeStyle(nodeId, {
                  left: "10px",
                  top: "10px",
                });
              }
            }
          }

          // Reset drag state
          dragOps.setIsDragging(false);
          dragOps.resetDragState();
        }

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

    // Function to start tracking the dragged element's position
    const startPositionTracking = () => {
      // Clear any existing interval
      if (dragPositionInterval.current) {
        clearInterval(dragPositionInterval.current);
      }

      // Set up an interval to track the position during drag
      dragPositionInterval.current = setInterval(() => {
        const dragPositions = getDragPositions();
        // Check for the dragged element
        const draggedEl = document.querySelector(
          `[data-node-dragged="${nodeId}"]`
        ) as HTMLElement;
        if (draggedEl && containerRef.current) {
          // Get the current transform from the imperative getter
          const currentTransform = getTransform();

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
        } else if (dragPositions.x !== 0 || dragPositions.y !== 0) {
          // Fallback to drag positions from state
          lastPositionRef.current = { ...dragPositions };
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

    const isDragging = getIsDragging();

    return (
      <ResizableWrapper nodeId={nodeId} isDraggable={!isViewport}>
        <div
          className={`${
            isDropTarget ? "dropTarget border-4 border-blue-900" : ""
          } relative`}
          style={{
            ...style,
            minHeight: "100vh",
            pointerEvents: "auto",
          }}
          data-node-id={nodeId}
          data-node-type="frame"
          data-viewport="true"
          onMouseDown={(e) => {
            // Only prevent direct clicks on the viewport background
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
          onMouseOver={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          {/* Viewport Header rendered in a portal but stays properly positioned */}
          {contentRef.current &&
            !isDragging &&
            position &&
            createPortal(
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
                  contextMenuOps.setContextMenu(
                    e.clientX,
                    e.clientY,
                    nodeId,
                    true
                  );
                }}
              >
                <div className="flex pointer-events-none items-center justify-between w-full">
                  <div
                    className="flex items-center gap-1 text-[var(--text-secondary)]"
                    style={{
                      padding: `${6 / transform.scale}px ${
                        8 / transform.scale
                      }px`,
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
                          const buttonRect =
                            e.currentTarget.getBoundingClientRect();
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
            )}

          {/* Background media wrapper */}
          {(style.backgroundImage || style.backgroundVideo) && (
            <div
              data-background-wrapper="true"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                overflow: "hidden",
                zIndex: 0,
                pointerEvents: "none",
              }}
            >
              {style.backgroundVideo ? (
                <video
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: style.objectFit || "cover",
                    objectPosition: style.objectPosition,
                    borderRadius: "inherit",
                    pointerEvents: "none",
                  }}
                  src={style.backgroundVideo}
                  autoPlay={false}
                  muted
                  loop
                  playsInline
                />
              ) : style.backgroundImage ? (
                <Image
                  fill={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: style.objectFit || "cover",
                    objectPosition: style.objectPosition,
                    borderRadius: "inherit",
                    pointerEvents: "none",
                  }}
                  src={style.backgroundImage}
                  alt=""
                />
              ) : null}
            </div>
          )}

          {/* Render children directly in the viewport to preserve styling inheritance */}
          {children}
        </div>
      </ResizableWrapper>
    );
  }

  // Create connect props based on nodeId
  const connectProps = connect(nodeId);

  return (
    <ResizableWrapper nodeId={nodeId} isDraggable={!isViewport}>
      <div
        data-node-id={nodeId}
        data-node-type="frame"
        data-is-viewport={isViewport ? "true" : "false"}
        data-is-variant={isVariant ? "true" : "false"}
        data-is-dynamic={isDynamic ? "true" : "false"}
        className={`${isSelected ? "outline outline-2 outline-blue-500" : ""} ${
          isHovered ? "hover-highlight" : ""
        }`}
        style={{
          ...style,
          cursor: getIsDragging() ? "grabbing" : "auto",
        }}
        onContextMenu={connectProps.onContextMenu}
        onMouseDown={connectProps.onMouseDown}
      >
        {/* Background media wrapper */}
        {(style.backgroundImage || style.backgroundVideo) && (
          <div
            data-background-wrapper="true"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              overflow: "hidden",
              zIndex: 0,
              pointerEvents: "none",
            }}
          >
            {style.backgroundVideo ? (
              <video
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: style.objectFit,
                  objectPosition: style.objectPosition,
                  borderRadius: "inherit",
                  pointerEvents: "none",
                }}
                src={style.backgroundVideo}
                autoPlay={false}
                muted
                loop
              />
            ) : style.backgroundImage ? (
              <Image
                fill={true}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: style.objectFit,
                  objectPosition: style.objectPosition,
                  borderRadius: "inherit",
                  pointerEvents: "none",
                }}
                src={style.backgroundImage}
                alt=""
              />
            ) : null}
          </div>
        )}
        {isDropTarget && (
          <div
            className="absolute inset-0 dropTarget rounded-[inherit] z-10"
            style={{ borderRadius: style.borderRadius }}
          />
        )}
        {children}
      </div>
    </ResizableWrapper>
  );
};
