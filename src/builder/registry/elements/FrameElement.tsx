import { useBuilder } from "@/builder/context/builderState";
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
import { useEffect, useState, useRef } from "react";
import { useDragStart } from "@/builder/context/dnd/useDragStart";
import Button from "@/components/ui/button";
import { createPortal } from "react-dom";

export const Frame = ({ children, node }: ElementProps) => {
  const connect = useConnect();
  const {
    dragState,
    nodeDisp,
    transform,
    dragDisp,
    setNodeStyle,
    containerRef,
    contentRef,
  } = useBuilder();
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartedRef = useRef(false);
  const dragPositionInterval = useRef<any>(null);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  const isDropTarget =
    dragState.dropInfo?.targetId === node.id &&
    dragState.dropInfo?.position === "inside";

  const [isInteractiveAid, setIsInteractiveAid] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInteractiveAid(true);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const handleDragStart = useDragStart();

  if (node.isViewport) {
    const headerHeight = 36;
    const headerMargin = 10;
    const scaledHeaderHeight = headerHeight / transform.scale;
    const scaledHeaderMargin = headerMargin / transform.scale;

    // Simple click handler that just selects the viewport
    const handleHeaderClick = (e: React.MouseEvent) => {
      // Stop propagation but don't prevent default
      e.stopPropagation();

      // Simply select the viewport
      dragDisp.setSelectedIds([node.id]);
    };

    // Drag handler that initiates drag after movement
    const handleHeaderMouseDown = (e: React.MouseEvent) => {
      // Always select the viewport on mousedown, regardless of drag
      dragDisp.setSelectedIds([node.id]);

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

          // Ensure the viewport is selected before starting drag
          if (!dragState.selectedIds.includes(node.id)) {
            dragDisp.setSelectedIds([node.id]);
          }

          // Start tracking the dragged element's position
          startPositionTracking();

          // Start dragging
          handleDragStart(e, undefined, node);

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
            setNodeStyle(
              {
                left: `${finalPos.x}px`,
                top: `${finalPos.y}px`,
              },
              [node.id],
              true
            );

            // Update node position data
            nodeDisp.updateNodePosition(node.id, finalPos);
          } else {
            // Fallback - try to get the position directly from the DOM
            const draggedEl = document.querySelector(
              `[data-node-dragged="${node.id}"]`
            ) as HTMLElement;
            if (draggedEl && containerRef.current) {
              const containerRect =
                containerRef.current.getBoundingClientRect();
              const elRect = draggedEl.getBoundingClientRect();

              // Calculate the position in the canvas
              const elX =
                (elRect.left - containerRect.left - transform.x) /
                transform.scale;
              const elY =
                (elRect.top - containerRect.top - transform.y) /
                transform.scale;

              console.log("DOM position fallback:", { x: elX, y: elY });

              setNodeStyle(
                {
                  left: `${elX}px`,
                  top: `${elY}px`,
                },
                [node.id],
                true
              );

              nodeDisp.updateNodePosition(node.id, { x: elX, y: elY });
            } else {
              // Hard fallback - manually set a position to avoid resetting to origin
              console.log("Using hard fallback position");
              const currentLeft = parseFloat(node.style.left as string) || 0;
              const currentTop = parseFloat(node.style.top as string) || 0;

              // Attempt to preserve current position if it exists
              if (currentLeft !== 0 || currentTop !== 0) {
                setNodeStyle(
                  {
                    left: node.style.left,
                    top: node.style.top,
                  },
                  [node.id],
                  true
                );
              } else {
                // Use a default offset if no position exists
                setNodeStyle(
                  {
                    left: "10px",
                    top: "10px",
                  },
                  [node.id],
                  true
                );
              }
            }
          }

          // Reset drag state
          dragDisp.setIsDragging(false);
          dragDisp.resetDragState();
        }

        // Ensure the viewport stays selected after drag
        if (!dragState.selectedIds.includes(node.id)) {
          dragDisp.setSelectedIds([node.id]);
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
        // Check for the dragged element
        const draggedEl = document.querySelector(
          `[data-node-dragged="${node.id}"]`
        ) as HTMLElement;
        if (draggedEl && containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const elRect = draggedEl.getBoundingClientRect();

          // Calculate the position in the canvas
          const elX =
            (elRect.left - containerRect.left - transform.x) / transform.scale;
          const elY =
            (elRect.top - containerRect.top - transform.y) / transform.scale;

          // Store the position
          lastPositionRef.current = { x: elX, y: elY };
        } else if (
          dragState.dragPositions.x !== 0 ||
          dragState.dragPositions.y !== 0
        ) {
          // Fallback to drag positions from state
          lastPositionRef.current = { ...dragState.dragPositions };
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

    return (
      <ResizableWrapper node={node}>
        <div
          className={`${
            isDropTarget ? "dropTarget border-4 border-blue-900" : ""
          } relative`}
          style={{
            ...node.style,
            minHeight: "100vh",
            pointerEvents: "auto",
          }}
          data-node-id={node.id}
          data-node-type={node.type}
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
            !dragState.isDragging &&
            node.position &&
            createPortal(
              <div
                data-viewport-header="true"
                data-viewport-id={node.id}
                className="absolute viewport-header overflow-hidden select-none bg-[var(--control-bg)] z-[9999] flex items-center"
                style={{
                  // Position relative to the viewport with the same transform as the canvas
                  position: "absolute",
                  transformOrigin: "top left",
                  // transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  // Position is set in the untransformed coordinate space
                  left: node.style.left,
                  top:
                    parseFloat(String(node.style.top)) -
                    scaledHeaderHeight -
                    scaledHeaderMargin,
                  width: parseFloat(String(node.style.width)),
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
                  if (!dragState.selectedIds.includes(node.id)) {
                    requestAnimationFrame(() => {
                      dragDisp.setHoverNodeId(node.id);
                    });
                  }
                }}
                onMouseOut={(e) => {
                  e.stopPropagation();
                  if (
                    !dragState.selectedIds.includes(node.id) &&
                    dragState.hoverNodeId === node.id
                  ) {
                    requestAnimationFrame(() => {
                      dragDisp.setHoverNodeId(null);
                    });
                  }
                }}
                onClick={handleHeaderClick}
                onMouseDown={(e) => {
                  if (node.isLocked) {
                    return;
                  } else {
                    handleHeaderMouseDown(e);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dragDisp.setContextMenu(e.clientX, e.clientY, node.id, true);
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
                    {node.viewportName || node.id}
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
                          dragDisp.showViewportContextMenu(node.id, {
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
          {(node.style.backgroundImage || node.style.backgroundVideo) && (
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
              {node.style.backgroundVideo ? (
                <video
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: node.style.objectFit || "cover",
                    objectPosition: node.style.objectPosition,
                    borderRadius: "inherit",
                    pointerEvents: "none",
                  }}
                  src={node.style.backgroundVideo}
                  autoPlay={false}
                  muted
                  loop
                  playsInline
                />
              ) : node.style.backgroundImage ? (
                <Image
                  fill={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: node.style.objectFit || "cover",
                    objectPosition: node.style.objectPosition,
                    borderRadius: "inherit",
                    pointerEvents: "none",
                  }}
                  src={node.style.backgroundImage}
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

  return (
    <ResizableWrapper node={node}>
      <div {...connect(node)}>
        {/* Background media wrapper */}
        {(node.style.backgroundImage || node.style.backgroundVideo) && (
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
            {node.style.backgroundVideo ? (
              <video
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: node.style.objectFit,
                  objectPosition: node.style.objectPosition,
                  borderRadius: "inherit",
                  pointerEvents: "none",
                }}
                src={node.style.backgroundVideo}
                // // autoPlay={node.style.autoPlay || false}
                // loop={node.style.loop || false}
                // muted={node.style.muted || true}
                // controls={node.style.controls || false}
                // playsInline
                autoPlay={false}
                muted
                loop
              />
            ) : node.style.backgroundImage ? (
              <Image
                fill={true}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: node.style.objectFit,
                  objectPosition: node.style.objectPosition,
                  borderRadius: "inherit",
                  pointerEvents: "none",
                }}
                src={node.style.backgroundImage}
                alt=""
              />
            ) : null}
          </div>
        )}
        {isDropTarget && (
          <div
            className="absolute inset-0 dropTarget rounded-[inherit] z-10"
            style={{ borderRadius: node.style.borderRadius }}
          />
        )}
        {children}
      </div>
    </ResizableWrapper>
  );
};
