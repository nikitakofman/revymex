import React, { useCallback, useMemo } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";

export const ArrowConnectors = () => {
  const { nodeState, dragState, contentRef, transform } = useBuilder();

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

  // Get nodes that are part of this dynamic system and selected
  const relevantNodes = useMemo(() => {
    if (!dragState.dynamicModeNodeId) return [];

    // Get all nodes in the dynamic system
    const systemNodes: Node[] = [];
    const mainNode = nodeState.nodes.find(
      (n) => n.id === dragState.dynamicModeNodeId
    );
    if (!mainNode) return systemNodes;

    // Add main node
    systemNodes.push(mainNode);

    // Add nodes with dynamicParentId
    nodeState.nodes.forEach((node) => {
      if (node.dynamicParentId === dragState.dynamicModeNodeId) {
        systemNodes.push(node);
      }
    });

    // If no nodes are selected, don't show any arrows
    if (dragState.selectedIds.length === 0) {
      return [];
    }

    // Filter to only include selected nodes from the system
    const selectedNodesInSystem = systemNodes.filter((node) =>
      dragState.selectedIds.includes(node.id)
    );

    return selectedNodesInSystem;
  }, [nodeState.nodes, dragState.dynamicModeNodeId, dragState.selectedIds]);

  // Find connections that originate from the selected nodes
  const relevantConnections = useMemo(() => {
    const result = [];

    // Only collect connections from our relevant (selected) nodes
    relevantNodes.forEach((node) => {
      (node.dynamicConnections || []).forEach((conn) => {
        // We only care about connections where the selected node is the source
        if (dragState.selectedIds.includes(conn.sourceId)) {
          // Create a unique key for the connection
          const connectionKey = `${conn.sourceId}-${conn.targetId}-${conn.type}`;

          result.push({
            ...conn,
            connectionKey,
            sourceId: conn.sourceId,
            targetId: conn.targetId,
          });
        }
      });
    });

    return result;
  }, [relevantNodes, dragState.selectedIds]);

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

  // Exit early if not in dynamic mode or content ref is not available or no selected nodes
  if (
    !dragState.dynamicModeNodeId ||
    !contentRef.current ||
    dragState.selectedIds.length === 0
  ) {
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
    } else if (angle <= (3 * PI) / 4) {
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

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {connectionGroups.map(({ key, connections, sourceId, targetId }) => {
        // Sort connections for consistent order (mouseLeave, hover, click)
        const sortedConnections = [...connections].sort((a, b) => {
          const order = { mouseLeave: 1, hover: 2, click: 3 };
          return (order[a.type] || 4) - (order[b.type] || 4);
        });

        // Get the elements
        const source = document.querySelector(`[data-node-id="${sourceId}"]`);
        const target = document.querySelector(`[data-node-id="${targetId}"]`);

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
