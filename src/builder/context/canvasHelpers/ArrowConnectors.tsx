import React, { useCallback, useMemo } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useGetSelectedIds } from "../atoms/select-store";

export const ArrowConnectors = () => {
  const { nodeState, dragState, contentRef, transform } = useBuilder();
  // Replace subscription with imperative getter
  const getSelectedIds = useGetSelectedIds();

  const getAdjustedPosition = useCallback(
    (rect: DOMRect, containerRect: DOMRect) => {
      return {
        x:
          (rect.left - containerRect.left) / transform.scale +
          transform.x / transform.scale,
        y:
          (rect.top - containerRect.top) / transform.scale +
          transform.y / transform.scale,
        width: rect.width / transform.scale,
        height: rect.height / transform.scale,
      };
    },
    [transform]
  );

  // Find the current active viewport ID
  const activeViewportId = useMemo(() => {
    if (!dragState.dynamicModeNodeId) return null;

    // Check the explicit active viewport first
    if (dragState.activeViewportInDynamicMode) {
      return dragState.activeViewportInDynamicMode;
    }

    // Otherwise, try to determine from the dynamic mode node
    const dynamicNode = nodeState.nodes.find(
      (n) => n.id === dragState.dynamicModeNodeId
    );
    if (dynamicNode?.dynamicViewportId) {
      return dynamicNode.dynamicViewportId;
    }

    return null;
  }, [
    dragState.dynamicModeNodeId,
    dragState.activeViewportInDynamicMode,
    nodeState.nodes,
  ]);

  // Get all nodes in the current active viewport
  const nodesInActiveViewport = useMemo(() => {
    if (!activeViewportId) return [];

    return nodeState.nodes.filter(
      (node) => node.dynamicViewportId === activeViewportId
    );
  }, [nodeState.nodes, activeViewportId]);

  // Find all relevant connections in the current viewport
  // Get the selected IDs only when computing the connections
  const relevantConnections = useMemo(() => {
    if (!activeViewportId) return [];

    // Get the selected IDs imperatively only when this memo runs
    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) return [];

    const result = [];
    const processedConnections = new Set();

    // Direct connections from selected nodes
    for (const selectedId of selectedIds) {
      const selectedNode = nodeState.nodes.find((n) => n.id === selectedId);
      if (!selectedNode) continue;

      // Check outgoing connections from the selected node
      if (
        selectedNode.dynamicConnections &&
        selectedNode.dynamicConnections.length > 0
      ) {
        for (const conn of selectedNode.dynamicConnections) {
          // Skip if we've already processed this connection
          const connectionKey = `${conn.sourceId}-${conn.targetId}-${conn.type}`;
          if (processedConnections.has(connectionKey)) continue;
          processedConnections.add(connectionKey);

          // Get the target node
          const targetNode = nodeState.nodes.find(
            (n) => n.id === conn.targetId
          );
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
    }

    // Direct connections to selected nodes (incoming connections)
    for (const node of nodesInActiveViewport) {
      // Skip nodes without connections
      if (!node.dynamicConnections || node.dynamicConnections.length === 0)
        continue;

      // Check each connection for a selected target
      for (const conn of node.dynamicConnections) {
        // Skip if the target is not selected
        if (!selectedIds.includes(conn.targetId)) continue;

        // Create a unique identifier for this connection
        const connectionKey = `${conn.sourceId}-${conn.targetId}-${conn.type}`;

        // Skip if we've already processed this connection
        if (processedConnections.has(connectionKey)) continue;
        processedConnections.add(connectionKey);

        result.push({
          ...conn,
          connectionKey,
          sourceId: conn.sourceId,
          targetId: conn.targetId,
        });
      }
    }

    return result;
  }, [
    nodesInActiveViewport,
    activeViewportId,
    nodeState.nodes,
    getSelectedIds,
  ]);

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

  // Exit early if not in dynamic mode or content ref is not available
  if (!dragState.dynamicModeNodeId || !contentRef.current) {
    return null;
  }

  const containerRect = contentRef.current.getBoundingClientRect();

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

  // Debugging info

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {connectionGroups.map(({ key, connections, sourceId, targetId }) => {
        // Sort connections for consistent order (mouseLeave, hover, click)
        const sortedConnections = [...connections].sort((a, b) => {
          const order = { mouseLeave: 1, hover: 2, click: 3 };
          return (order[a.type] || 4) - (order[b.type] || 4);
        });

        // Get the DOM elements
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
            key={key}
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

              const connectionId = `${sourceId}-${targetId}-${conn.type}`;
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
