import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useBuilderRefs } from "@/builder/context/builderState";
import { Zap } from "lucide-react";
import {
  useNodeSelected,
  useGetSelectedIds,
  selectOps,
} from "../atoms/select-store";
import { useDynamicModeNodeId, dynamicOps } from "../atoms/dynamic-store";
import { modalOps, useConnectionTypeModal } from "../atoms/modal-store";
import { useGetTransform } from "../atoms/canvas-interaction-store";
import {
  NodeId,
  useNodeDynamicInfo,
  getCurrentNodes,
  useGetIsTopLevelDynamicNode,
} from "../atoms/node-store";

export const ConnectionHandle: React.FC<{
  nodeId: NodeId;
}> = ({ nodeId }) => {
  const dynamicInfo = useNodeDynamicInfo(nodeId);
  const {
    dynamicConnections = [],
    dynamicFamilyId,
    isTopLevelDynamicNode,
  } = dynamicInfo || {};
  const dynamicModeNodeId = useDynamicModeNodeId();

  const getIsTopLevelDynamicNode = useGetIsTopLevelDynamicNode();

  const { contentRef } = useBuilderRefs();

  const getTransform = useGetTransform();

  const connectionTypeModal = useConnectionTypeModal();

  const isNodeSelected = useNodeSelected(nodeId);
  const getSelectedIds = useGetSelectedIds();

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

  const [isInteractive, setIsInteractive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInteractive(true);
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const cableIconRef = useRef<HTMLDivElement>(null);

  // Helper function to get parent hierarchy of a node
  const getParentHierarchy = useCallback((nodeId: NodeId): NodeId[] => {
    const allNodes = getCurrentNodes();
    const parentIds: NodeId[] = [];

    // Find the node
    let currentNode = allNodes.find((n) => n.id === nodeId);

    // Traverse up the tree
    while (currentNode && currentNode.parentId) {
      parentIds.push(currentNode.parentId);
      currentNode = allNodes.find((n) => n.id === currentNode?.parentId);
    }

    return parentIds;
  }, []);

  const findValidConnectionTargets = useCallback((): NodeId[] => {
    const allNodes = getCurrentNodes();

    // Get all parents of the current node to exclude them from targets
    const parentIds = getParentHierarchy(nodeId);

    // Only find top-level dynamic nodes as valid target connections
    // EXCLUDE the node's own parents from valid targets
    return allNodes
      .filter((node) => {
        // Don't connect to self
        if (node.id === nodeId) return false;

        // Don't connect to any parent in the hierarchy
        if (parentIds.includes(node.id)) return false;

        // Target must be a top-level dynamic node
        return node.isTopLevelDynamicNode === true;
      })
      .map((node) => node.id);
  }, [nodeId, getParentHierarchy]);

  useEffect(() => {
    if (
      connectionTypeModal.show &&
      connectionTypeModal.sourceId === nodeId &&
      !isNodeSelected
    ) {
      selectOps.selectNode(nodeId);
    }
  }, [connectionTypeModal, nodeId, isNodeSelected]);

  const shouldShowHandle = useCallback(() => {
    // Show handle on any node that is part of a dynamic family
    // This means all nodes in a dynamic family can be CONNECTION SOURCES
    if (isTopLevelDynamicNode) return true;
    if (dynamicConnections && dynamicConnections.length > 0) return true;
    if (dynamicFamilyId) return true;

    // Get active dynamic node family
    if (dynamicModeNodeId) {
      const allNodes = getCurrentNodes();
      const dynamicNode = allNodes.find((n) => n.id === dynamicModeNodeId);

      // If this node is in the same family as the active dynamic node, show the handle
      if (
        dynamicNode?.dynamicFamilyId &&
        dynamicInfo?.dynamicFamilyId === dynamicNode.dynamicFamilyId
      ) {
        return true;
      }
    }

    return false;
  }, [
    isTopLevelDynamicNode,
    dynamicConnections,
    dynamicFamilyId,
    dynamicModeNodeId,
    dynamicInfo,
  ]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const selectedIds = getSelectedIds();

    if (!selectedIds.includes(nodeId)) {
      selectOps.selectNode(nodeId);
    }

    if (cableIconRef.current) {
      const rect = cableIconRef.current.getBoundingClientRect();
      setStartPoint({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }

    setIsDragging(true);
    setEndPoint({ x: e.clientX, y: e.clientY });

    const validTargets = findValidConnectionTargets();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setEndPoint({ x: moveEvent.clientX, y: moveEvent.clientY });

      const elementsUnder = document.elementsFromPoint(
        moveEvent.clientX,
        moveEvent.clientY
      );

      setHoverTarget(null);

      for (const element of elementsUnder) {
        if (element.hasAttribute("data-node-id")) {
          const targetId = element.getAttribute("data-node-id");

          if (targetId && validTargets.includes(targetId)) {
            setHoverTarget({
              id: targetId,
              rect: element.getBoundingClientRect(),
            });
            break;
          }
        }
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const currentHoverTarget = hoverTarget;

      const currentSelectedIds = getSelectedIds();

      setIsDragging(false);
      setStartPoint(null);
      setEndPoint(null);

      if (currentHoverTarget) {
        // Ensure target is a top-level dynamic node and not a parent
        if (!getIsTopLevelDynamicNode(currentHoverTarget.id)) {
          console.log("Target is not a top-level dynamic node, cannot connect");
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        // Check if target is a parent
        const parentIds = getParentHierarchy(nodeId);
        if (parentIds.includes(currentHoverTarget.id)) {
          console.log("Cannot connect to parent node in hierarchy");
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        console.log("Showing modal for target:", currentHoverTarget.id);

        if (!currentSelectedIds.includes(nodeId)) {
          selectOps.selectNode(nodeId);
        }

        modalOps.showConnectionTypeModal(nodeId, currentHoverTarget.id, {
          x: upEvent.clientX,
          y: upEvent.clientY,
        });
      } else {
        const elementsUnder = document.elementsFromPoint(
          upEvent.clientX,
          upEvent.clientY
        );

        for (const element of elementsUnder) {
          if (element.hasAttribute("data-node-id")) {
            const targetId = element.getAttribute("data-node-id");

            if (targetId && validTargets.includes(targetId)) {
              // Ensure the target is a top-level dynamic node
              if (!getIsTopLevelDynamicNode(targetId)) {
                continue;
              }

              // Ensure the target is not a parent in the hierarchy
              const parentIds = getParentHierarchy(nodeId);
              if (parentIds.includes(targetId)) {
                console.log("Cannot connect to parent node in hierarchy");
                continue;
              }

              console.log(
                "Showing modal for target found on mouseup:",
                targetId
              );

              if (!currentSelectedIds.includes(nodeId)) {
                selectOps.selectNode(nodeId);
              }

              modalOps.showConnectionTypeModal(nodeId, targetId, {
                x: upEvent.clientX,
                y: upEvent.clientY,
              });

              setHoverTarget({
                id: targetId,
                rect: element.getBoundingClientRect(),
              });

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

  const getConnectionPoint = (
    rect: DOMRect,
    sourcePoint: { x: number; y: number }
  ) => {
    const targetCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    const angle = Math.atan2(
      targetCenter.y - sourcePoint.y,
      targetCenter.x - sourcePoint.x
    );
    const PI = Math.PI;

    if (angle <= (-3 * PI) / 4 || angle > (3 * PI) / 4) {
      return {
        x: rect.right,
        y: targetCenter.y,
      };
    } else if (angle <= -PI / 4) {
      return {
        x: targetCenter.x,
        y: rect.bottom,
      };
    } else if (angle <= PI / 4) {
      return {
        x: rect.left,
        y: targetCenter.y,
      };
    } else {
      return {
        x: targetCenter.x,
        y: rect.top,
      };
    }
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
          width: `${24 / getTransform().scale}px`,
          height: `${24 / getTransform().scale}px`,
          border: `${2 / getTransform().scale}px solid white`,
          right: `-${11 / getTransform().scale}px`,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: isInteractive ? "auto" : "none",
          zIndex: 2001,
        }}
        onMouseDown={handleMouseDown}
      >
        <Zap size={12 / getTransform().scale} />
      </div>

      {/* Connection Line Portal */}
      {(isDragging || connectionTypeModal.show) &&
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
              pointerEvents: isInteractive ? "auto" : "none",
              zIndex: 9999,
            }}
          >
            {hoverTarget ? (
              <>
                {/* Get the connection point on the edge of the target */}
                {(() => {
                  const connectionPoint = getConnectionPoint(
                    hoverTarget.rect,
                    startPoint
                  );

                  const dx = connectionPoint.x - startPoint.x;
                  const dy = connectionPoint.y - startPoint.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);

                  const controlPoint1X = startPoint.x + dx * 0.3;
                  const controlPoint1Y = startPoint.y + dy * 0.3;

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
          </svg>,
          document.body
        )}
    </>
  );
};

export default ConnectionHandle;
