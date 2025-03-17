import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useBuilder } from "../builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Zap } from "lucide-react";

export const ConnectionHandle: React.FC<{
  node: Node;
  transform: { x: number; y: number; scale: number };
}> = ({ node, transform }) => {
  const { dragState, dragDisp, nodeState, contentRef } = useBuilder();
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [hoverTarget, setHoverTarget] = useState<{
    id: string | number;
    rect: DOMRect;
  } | null>(null);

  const cableIconRef = useRef<HTMLDivElement>(null);

  // Find the topmost parent of a node in the dynamic system
  const findTopmostParent = (nodeId: string | number): string | number => {
    const targetNode = nodeState.nodes.find((n) => n.id === nodeId);
    if (!targetNode) return nodeId;

    // If this is the main dynamic node or has no parent, it's already the top
    if (nodeId === dragState.dynamicModeNodeId || !targetNode.parentId) {
      return nodeId;
    }

    // Start traversing upward
    let currentId = nodeId;
    let currentNode = targetNode;

    while (currentNode.parentId) {
      const parentNode = nodeState.nodes.find(
        (n) => n.id === currentNode.parentId
      );

      // If parent not found or reached a viewport, stop
      if (!parentNode || parentNode.isViewport) break;

      // If parent has the same dynamic parent ID, it's part of the same system
      if (parentNode.dynamicParentId === dragState.dynamicModeNodeId) {
        currentId = parentNode.id;
        currentNode = parentNode;
      } else {
        // Parent isn't part of the dynamic system, stop
        break;
      }
    }

    return currentId;
  };

  // Get all ancestor IDs of a node
  const getAncestorIds = (nodeId: string | number): (string | number)[] => {
    const ancestors: (string | number)[] = [];
    let currentNode = nodeState.nodes.find((n) => n.id === nodeId);

    while (currentNode && currentNode.parentId) {
      ancestors.push(currentNode.parentId);
      currentNode = nodeState.nodes.find((n) => n.id === currentNode.parentId);
    }

    return ancestors;
  };

  // Get the connection point on a target element (always on the edge)
  const getConnectionPoint = (
    rect: DOMRect,
    sourcePoint: { x: number; y: number }
  ) => {
    const targetCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    // Calculate angle to determine which side to connect to
    const angle = Math.atan2(
      targetCenter.y - sourcePoint.y,
      targetCenter.x - sourcePoint.x
    );
    const PI = Math.PI;

    // Determine which side to use based on angle
    if (angle <= (-3 * PI) / 4 || angle > (3 * PI) / 4) {
      // Coming from the right
      return {
        x: rect.right,
        y: targetCenter.y,
      };
    } else if (angle <= -PI / 4) {
      // Coming from below
      return {
        x: targetCenter.x,
        y: rect.bottom,
      };
    } else if (angle <= PI / 4) {
      // Coming from the left
      return {
        x: rect.left,
        y: targetCenter.y,
      };
    } else {
      // Coming from above
      return {
        x: targetCenter.x,
        y: rect.top,
      };
    }
  };

  // Checks if the node should display the connection handle
  const shouldShowHandle = () => {
    if (node.id === dragState.dynamicModeNodeId) return true;
    if (node.dynamicParentId === dragState.dynamicModeNodeId) return true;

    // Also check if this node has any connections
    if (node.dynamicConnections && node.dynamicConnections.length > 0)
      return true;

    return false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Get the cable icon's center position in screen coordinates
    if (cableIconRef.current) {
      const rect = cableIconRef.current.getBoundingClientRect();
      setStartPoint({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }

    setIsDragging(true);
    setEndPoint({ x: e.clientX, y: e.clientY });

    // Get all ancestors of the current node - we can't connect to these
    const sourceAncestors = getAncestorIds(node.id);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Set the current end point of the dragging line
      setEndPoint({ x: moveEvent.clientX, y: moveEvent.clientY });

      // Check if we're hovering over a potential target
      const elementsUnder = document.elementsFromPoint(
        moveEvent.clientX,
        moveEvent.clientY
      );

      // Reset hover target
      setHoverTarget(null);

      // Find the first element with a node ID that's not the source node or its ancestors
      for (const element of elementsUnder) {
        if (element.hasAttribute("data-node-id")) {
          const targetId = element.getAttribute("data-node-id");

          if (
            targetId &&
            targetId !== node.id &&
            !sourceAncestors.includes(targetId)
          ) {
            // Find the topmost parent in the dynamic system
            const topmostParentId = findTopmostParent(targetId);

            // Skip if this is an ancestor of the source node
            if (sourceAncestors.includes(topmostParentId)) {
              continue;
            }

            // Find the DOM element for the topmost parent
            const topmostElement = document.querySelector(
              `[data-node-id="${topmostParentId}"]`
            );

            if (topmostElement) {
              // Set the hover target to the topmost parent
              setHoverTarget({
                id: topmostParentId,
                rect: topmostElement.getBoundingClientRect(),
              });
              break;
            }
          }
        }
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const currentHoverTarget = hoverTarget;

      // Stop dragging
      setIsDragging(false);
      setStartPoint(null);
      setEndPoint(null);

      // If we have a hover target, show the connection type modal
      if (currentHoverTarget) {
        console.log("Showing modal for target:", currentHoverTarget.id);

        // Show the connection type modal without resetting existing connections
        dragDisp.showConnectionTypeModal(node.id, currentHoverTarget.id, {
          x: upEvent.clientX,
          y: upEvent.clientY,
        });

        // Keep the hover target for visual indication during modal display
      } else {
        // If no hover target, check if we're over any valid target
        const elementsUnder = document.elementsFromPoint(
          upEvent.clientX,
          upEvent.clientY
        );

        // Find the first element with a node ID that's not an ancestor
        for (const element of elementsUnder) {
          if (element.hasAttribute("data-node-id")) {
            const targetId = element.getAttribute("data-node-id");

            if (
              targetId &&
              targetId !== node.id &&
              !sourceAncestors.includes(targetId)
            ) {
              // Find the topmost parent in the dynamic system
              const topmostParentId = findTopmostParent(targetId);

              // Skip if this is an ancestor of the source node
              if (sourceAncestors.includes(topmostParentId)) {
                continue;
              }

              console.log(
                "Showing modal for target found on mouseup:",
                topmostParentId
              );

              // Show the connection type modal without resetting existing connections
              dragDisp.showConnectionTypeModal(node.id, topmostParentId, {
                x: upEvent.clientX,
                y: upEvent.clientY,
              });

              // Set hover target for visual indication during modal display
              const topmostElement = document.querySelector(
                `[data-node-id="${topmostParentId}"]`
              );

              if (topmostElement) {
                setHoverTarget({
                  id: topmostParentId,
                  rect: topmostElement.getBoundingClientRect(),
                });
              }

              break;
            }
          }
        }
      }

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!shouldShowHandle()) return null;
  if (!contentRef.current) return null;

  return (
    <>
      {/* Cable Icon */}
      <div
        ref={cableIconRef}
        className="absolute bg-purple-500 rounded-full cursor-pointer"
        style={{
          width: `${24 / transform.scale}px`,
          height: `${24 / transform.scale}px`,
          border: `${2 / transform.scale}px solid white`,
          right: `-${11 / transform.scale}px`,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
          zIndex: 2001, // Higher than selection borders
        }}
        onMouseDown={handleMouseDown}
      >
        <Zap size={12 / transform.scale} />
      </div>

      {/* Connection Line Portal */}
      {(isDragging || dragState.connectionTypeModal.show) &&
        startPoint &&
        endPoint &&
        createPortal(
          <svg
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          >
            {hoverTarget ? (
              // If hovering over a target, draw a straight line to the edge of the target
              <>
                {/* Get the connection point on the edge of the target */}
                {(() => {
                  const connectionPoint = getConnectionPoint(
                    hoverTarget.rect,
                    startPoint
                  );

                  // Calculate control points that stay outside the target
                  // This ensures the arrow never curves into the target
                  const dx = connectionPoint.x - startPoint.x;
                  const dy = connectionPoint.y - startPoint.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);

                  // Adjust control points to keep the curve outside
                  const controlPoint1X = startPoint.x + dx * 0.3;
                  const controlPoint1Y = startPoint.y + dy * 0.3;

                  // Second control point is close to the connection point but still outside
                  const controlPoint2X = connectionPoint.x - dx * 0.1;
                  const controlPoint2Y = connectionPoint.y - dy * 0.1;

                  return (
                    <path
                      d={`M ${startPoint.x} ${startPoint.y}
                         C ${controlPoint1X} ${controlPoint1Y}
                           ${controlPoint2X} ${controlPoint2Y}
                           ${connectionPoint.x} ${connectionPoint.y}`}
                      stroke="#9966FE"
                      strokeWidth={2}
                      fill="none"
                      markerEnd="url(#arrowhead)"
                    />
                  );
                })()}
              </>
            ) : (
              // Otherwise, draw a curved dashed line from source to mouse position
              <path
                d={`M ${startPoint.x} ${startPoint.y}
                  C ${startPoint.x + 50} ${startPoint.y}
                    ${endPoint.x - 50} ${endPoint.y}
                    ${endPoint.x} ${endPoint.y}`}
                stroke="#9966FE"
                strokeWidth={2}
                fill="none"
                strokeDasharray="5,5"
              />
            )}

            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#9966FE" />
              </marker>
            </defs>

            {/* If hovering over a target, highlight it with a glow */}
            {/* {hoverTarget && (
              <rect
                x={hoverTarget.rect.left - 2}
                y={hoverTarget.rect.top - 2}
                width={hoverTarget.rect.width + 4}
                height={hoverTarget.rect.height + 4}
                rx="4"
                fill="none"
                stroke="#9966FE"
                strokeWidth="2"
                filter="drop-shadow(0 0 3px rgba(153, 102, 254, 0.7))"
              />
            )} */}
          </svg>,
          document.body
        )}
    </>
  );
};

export default ConnectionHandle;
