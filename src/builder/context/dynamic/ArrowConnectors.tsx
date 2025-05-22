import React, {
  useCallback,
  useMemo,
  useEffect,
  useState,
  useRef,
} from "react";
import { useBuilderRefs } from "@/builder/context/builderState";
import { useGetSelectedIds, useSelectedIds } from "../atoms/select-store";
import {
  useTransform,
  useIsMovingCanvas,
} from "../atoms/canvas-interaction-store";
import {
  useDynamicModeNodeId,
  useActiveViewportInDynamicMode,
} from "../atoms/dynamic-store";
import {
  NodeId,
  getCurrentNodes,
  useNodeIds,
  nodeDynamicInfoAtom,
  nodeStore,
} from "../atoms/node-store";

export const ArrowConnectors = () => {
  // Get DOM references
  const { contentRef } = useBuilderRefs();

  // Use state to force re-renders when connections change
  const [renderKey, setRenderKey] = useState(0);

  // Use these hooks to access selection state
  const selectedIds = useSelectedIds(); // For reactive updates
  const getSelectedIds = useGetSelectedIds(); // For imperative access

  // Get viewport and canvas state
  const transform = useTransform();
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();
  const isMovingCanvas = useIsMovingCanvas();
  const nodeIds = useNodeIds();

  // Get all nodes directly to ensure fresh data
  const getAllNodes = useCallback(() => {
    return getCurrentNodes();
  }, []);

  // Subscribe to dynamic info changes for connections
  useEffect(() => {
    if (!dynamicModeNodeId) return;

    // Subscribe to all nodes to detect connection changes
    const unsubscribeFns: Array<() => void> = [];

    // Subscribe to nodes for connection changes
    nodeIds.forEach((id) => {
      const unsub = nodeStore.sub(nodeDynamicInfoAtom(id), () => {
        const newInfo = nodeStore.get(nodeDynamicInfoAtom(id));

        if (newInfo.dynamicConnections) {
          // Force re-render when connections change
          setRenderKey((prev) => prev + 1);
        }
      });

      unsubscribeFns.push(unsub);
    });

    return () => {
      unsubscribeFns.forEach((unsub) => unsub());
    };
  }, [dynamicModeNodeId, nodeIds]);

  // Force re-render when selection changes
  useEffect(() => {
    setRenderKey((prev) => prev + 1);
  }, [selectedIds]); // When selectedIds changes, re-render

  // Find the current active viewport ID
  const activeViewportId = useMemo(() => {
    if (!dynamicModeNodeId) return null;

    if (activeViewportInDynamicMode) {
      return activeViewportInDynamicMode;
    }

    const allNodes = getAllNodes();
    const dynamicNode = allNodes.find((n) => n.id === dynamicModeNodeId);

    if (dynamicNode?.dynamicViewportId) {
      return dynamicNode.dynamicViewportId;
    }

    return null;
  }, [dynamicModeNodeId, activeViewportInDynamicMode, getAllNodes]);

  // Find all relevant connections involving ONLY the selected node
  const relevantConnections = useMemo(() => {
    if (!activeViewportId) return [];

    // FIXED: Only show connections for the primary selected node, not its children
    const primarySelectedId = selectedIds[0];
    if (!primarySelectedId) return [];

    const result = [];
    const processedConnections = new Set();
    const allNodes = getAllNodes();

    // Get all nodes in the active viewport
    const nodesInViewport = allNodes.filter(
      (node) => node.dynamicViewportId === activeViewportId
    );

    // Check ALL nodes in viewport for connections
    for (const node of nodesInViewport) {
      // Skip if no connections
      if (!node.dynamicConnections || node.dynamicConnections.length === 0) {
        continue;
      }

      // OUTGOING CONNECTIONS: Only show connections from the exact selected node
      if (node.id === primarySelectedId) {
        for (const conn of node.dynamicConnections) {
          // Skip if we've already processed this connection
          const connectionKey = `${conn.sourceId}-${conn.targetId}-${conn.type}`;
          if (processedConnections.has(connectionKey)) continue;
          processedConnections.add(connectionKey);

          // Get the target node
          const targetNode = allNodes.find((n) => n.id === conn.targetId);
          // Skip if the target doesn't exist or isn't in the same viewport
          if (!targetNode || targetNode.dynamicViewportId !== activeViewportId)
            continue;

          result.push({
            ...conn,
            connectionKey,
            sourceId: conn.sourceId,
            targetId: conn.targetId,
          });
        }
      }

      // INCOMING CONNECTIONS: Check for connections TO the exact selected node
      for (const conn of node.dynamicConnections) {
        // Skip if this connection is not targeting the exactly selected node
        if (conn.targetId !== primarySelectedId) {
          continue;
        }

        // Create a unique identifier for this connection
        const connectionKey = `${conn.sourceId}-${conn.targetId}-${conn.type}`;

        // Skip if we've already processed this connection
        if (processedConnections.has(connectionKey)) continue;
        processedConnections.add(connectionKey);

        // Add the incoming connection
        result.push({
          ...conn,
          connectionKey,
          sourceId: conn.sourceId,
          targetId: conn.targetId,
        });
      }
    }

    return result;
  }, [activeViewportId, selectedIds, getAllNodes, renderKey]);

  // Group connections by source-target pair
  const connectionGroups = useMemo(() => {
    const pairMap = new Map();

    // Group connections by source-target pairs
    relevantConnections.forEach((conn) => {
      // Create a unique key for each pair
      const sourceId = conn.sourceId;
      const targetId = conn.targetId;
      const key = `${sourceId}-${targetId}`;

      if (!pairMap.has(key)) {
        pairMap.set(key, {
          key,
          connections: [],
          sourceId,
          targetId,
        });
      }

      // Add to existing group
      pairMap.get(key).connections.push(conn);
    });

    return Array.from(pairMap.values());
  }, [relevantConnections]);

  // Early return after all hooks are defined
  if (isMovingCanvas || !dynamicModeNodeId || !contentRef.current) {
    return null;
  }

  const containerRect = contentRef.current.getBoundingClientRect();

  // Function to get color for a connection type
  const getConnectionColor = (type) => {
    switch (type) {
      case "click":
        return "#9966FE";
      case "hover":
        return "#6096FF";
      case "mouseLeave":
        return "#FF66AC";
      default:
        return "#9966FE";
    }
  };

  const getConnectionPoints = (
    sourceRect: DOMRect,
    targetRect: DOMRect,
    bidirectional: boolean = false,
    offset: number = 0
  ) => {
    const sourceCenter = {
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top + sourceRect.height / 2,
    };
    const targetCenter = {
      x: targetRect.left + targetRect.width / 2,
      y: targetRect.top + targetRect.height / 2,
    };

    // Calculate angle between centers
    const angle = Math.atan2(
      targetCenter.y - sourceCenter.y,
      targetCenter.x - sourceCenter.x
    );
    const PI = Math.PI;

    // For bidirectional connections, apply a slight offset
    // to separate the paths visually
    const offsetAmount = offset * 10; // Pixels to offset

    let startPoint, endPoint;
    let offsetX = 0,
      offsetY = 0;

    if (bidirectional) {
      // Calculate perpendicular angle for offset
      const perpAngle = angle + Math.PI / 2;
      offsetX = Math.cos(perpAngle) * offsetAmount;
      offsetY = Math.sin(perpAngle) * offsetAmount;
    }

    // Source point
    if (angle <= (-3 * PI) / 4 || angle > (3 * PI) / 4) {
      // Target is to the left
      startPoint = {
        x: sourceRect.left + offsetX,
        y: sourceCenter.y + offsetY,
      };
    } else if (angle <= -PI / 4) {
      // Target is above
      startPoint = {
        x: sourceCenter.x + offsetX,
        y: sourceRect.top + offsetY,
      };
    } else if (angle <= PI / 4) {
      // Target is to the right
      startPoint = {
        x: sourceRect.right + offsetX,
        y: sourceCenter.y + offsetY,
      };
    } else {
      // Target is below
      startPoint = {
        x: sourceCenter.x + offsetX,
        y: sourceRect.bottom + offsetY,
      };
    }

    // Target point (reverse the logic)
    if (angle <= (-3 * PI) / 4 || angle > (3 * PI) / 4) {
      // Coming from the right
      endPoint = {
        x: targetRect.right + offsetX,
        y: targetCenter.y + offsetY,
      };
    } else if (angle <= -PI / 4) {
      // Coming from below
      endPoint = {
        x: targetCenter.x + offsetX,
        y: targetRect.bottom + offsetY,
      };
    } else if (angle <= PI / 4) {
      // Coming from the left
      endPoint = {
        x: targetRect.left + offsetX,
        y: targetCenter.y + offsetY,
      };
    } else if (angle <= (3 * PI) / 4) {
      // Coming from above
      endPoint = {
        x: targetCenter.x + offsetX,
        y: targetRect.top + offsetY,
      };
    }

    return {
      start: startPoint!,
      end: endPoint!,
      angle,
      sourceCenter,
      targetCenter,
    };
  };

  // Render the component with a key to force re-render when connections change
  return (
    <div className="absolute inset-0 pointer-events-none z-50" key={renderKey}>
      {connectionGroups.map(({ key, connections, sourceId, targetId }) => {
        // Sort connections for consistent order (mouseLeave, hover, click)
        const sortedConnections = [...connections].sort((a, b) => {
          const order = { mouseLeave: 1, hover: 2, click: 3 };
          return (order[a.type] || 4) - (order[b.type] || 4);
        });

        // Get the DOM elements for the source and target
        const source = document.querySelector(`[data-node-id="${sourceId}"]`);
        const target = document.querySelector(`[data-node-id="${targetId}"]`);

        // Skip if either element doesn't exist in the DOM
        if (!source || !target) return null;

        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        // Get midpoint between elements for the legend
        const sourceCenterX = sourceRect.left + sourceRect.width / 2;
        const sourceCenterY = sourceRect.top + sourceRect.height / 2;
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;

        // Calculate distance between centers
        const dx = targetCenterX - sourceCenterX;
        const dy = targetCenterY - sourceCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isMoreHorizontal = Math.abs(dx) > Math.abs(dy);

        // Adjust to canvas coordinates
        const midX =
          ((sourceCenterX + targetCenterX) / 2 - containerRect.left) /
            transform.scale +
          transform.x / transform.scale;

        // Position the text exactly at the midpoint between elements
        const midY =
          ((sourceCenterY + targetCenterY) / 2 - containerRect.top) /
            transform.scale +
          transform.y / transform.scale;

        // For very close elements, adjust the label position to be above the connection
        const offset = isMoreHorizontal ? -20 / transform.scale : 0;
        const legendY = midY + offset;

        // Create legend text with each type in its respective color
        let legendTextParts = [];
        sortedConnections.forEach((conn, i) => {
          if (i > 0) {
            legendTextParts.push({
              text: " - ",
              color: "white",
            });
          }
          legendTextParts.push({
            text: conn.type,
            color: getConnectionColor(conn.type),
          });
        });

        // SVG for the connections
        return (
          <svg
            key={`${key}-${renderKey}`}
            className="absolute top-0 left-0 w-full h-full overflow-visible"
          >
            {/* Create connection paths */}
            {sortedConnections.map((conn, index) => {
              // Always treat as bidirectional for proper curve separation
              const hasBidirectionalConnections = true;
              const offset =
                connections.length > 1
                  ? index - (connections.length - 1) / 2
                  : index === 0
                  ? 0.5
                  : -0.5; // Even with one connection, add an offset

              const points = getConnectionPoints(
                sourceRect,
                targetRect,
                hasBidirectionalConnections,
                offset
              );

              // Adjust to canvas coordinates
              const startX =
                (points.start.x - containerRect.left) / transform.scale +
                transform.x / transform.scale;
              const startY =
                (points.start.y - containerRect.top) / transform.scale +
                transform.y / transform.scale;
              const endX =
                (points.end.x - containerRect.left) / transform.scale +
                transform.x / transform.scale;
              const endY =
                (points.end.y - containerRect.top) / transform.scale +
                transform.y / transform.scale;

              // Calculate curve
              const pathDistance = Math.sqrt(
                (endX - startX) ** 2 + (endY - startY) ** 2
              );
              const curveOffset =
                connections.length > 1
                  ? Math.min(60, pathDistance * 0.4)
                  : Math.min(40, pathDistance * 0.3);

              // Generate path with enhanced curve separation
              let pathData;
              // Always use quadratic Bezier for better visual separation
              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              // Calculate perpendicular angle for control point offset
              const perpAngle = points.angle + Math.PI / 2;

              // Increase the curve offset for better visual separation
              const enhancedCurveOffset = curveOffset * 1.5;
              const ctrlOffsetX =
                Math.cos(perpAngle) * enhancedCurveOffset * offset;
              const ctrlOffsetY =
                Math.sin(perpAngle) * enhancedCurveOffset * offset;

              pathData = `M ${startX} ${startY} Q ${midX + ctrlOffsetX} ${
                midY + ctrlOffsetY
              } ${endX} ${endY}`;

              // Ensure unique IDs for each connection's markers
              const connectionId = `${sourceId}-${targetId}-${conn.type}-${renderKey}`;
              const connectionColor = getConnectionColor(conn.type);

              return (
                <g key={connectionId} transform={`scale(${transform.scale})`}>
                  <defs>
                    <marker
                      id={`arrowhead-${connectionId}`}
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3.5, 0 7"
                        fill={connectionColor}
                      />
                    </marker>
                  </defs>
                  <path
                    d={pathData}
                    stroke={connectionColor}
                    strokeWidth={2 / transform.scale}
                    fill="none"
                    markerEnd={`url(#arrowhead-${connectionId})`}
                  />
                </g>
              );
            })}

            {/* Combined legend with single text element with multiple tspans */}
            <g transform={`scale(${transform.scale})`}>
              {/* Enhanced background for better text visibility */}
              <rect
                x={
                  midX - legendTextParts.map((p) => p.text).join("").length * 4
                }
                y={legendY - 10 / transform.scale}
                width={legendTextParts.map((p) => p.text).join("").length * 8}
                height={20 / transform.scale}
                rx={5 / transform.scale}
                fill="rgba(0,0,0,0.5)"
                opacity="0.7"
              />

              <text
                x={midX}
                y={legendY}
                fontWeight="bold"
                fontSize={14 / transform.scale}
                textAnchor="middle"
                dominantBaseline="middle"
                filter="drop-shadow(0px 0px 2px rgba(0,0,0,0.8))"
              >
                {legendTextParts.map((part, index) => (
                  <tspan key={index} fill={part.color}>
                    {part.text}
                  </tspan>
                ))}
              </text>
            </g>
          </svg>
        );
      })}
    </div>
  );
};
