import React, { useCallback } from "react";
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

  const getConnectionPoints = (sourceRect: DOMRect, targetRect: DOMRect) => {
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

    // Determine which side to use based on angle
    let startPoint, endPoint;

    // Source point
    if (angle <= (-3 * PI) / 4 || angle > (3 * PI) / 4) {
      // Target is to the left
      startPoint = {
        x: sourceRect.left,
        y: sourceCenter.y,
      };
    } else if (angle <= -PI / 4) {
      // Target is above
      startPoint = {
        x: sourceCenter.x,
        y: sourceRect.top,
      };
    } else if (angle <= PI / 4) {
      // Target is to the right
      startPoint = {
        x: sourceRect.right,
        y: sourceCenter.y,
      };
    } else if (angle <= (3 * PI) / 4) {
      // Target is below
      startPoint = {
        x: sourceCenter.x,
        y: sourceRect.bottom,
      };
    }

    // Target point (reverse the logic)
    if (angle <= (-3 * PI) / 4 || angle > (3 * PI) / 4) {
      // Coming from the right
      endPoint = {
        x: targetRect.right,
        y: targetCenter.y,
      };
    } else if (angle <= -PI / 4) {
      // Coming from below
      endPoint = {
        x: targetCenter.x,
        y: targetRect.bottom,
      };
    } else if (angle <= PI / 4) {
      // Coming from the left
      endPoint = {
        x: targetRect.left,
        y: targetCenter.y,
      };
    } else if (angle <= (3 * PI) / 4) {
      // Coming from above
      endPoint = {
        x: targetCenter.x,
        y: targetRect.top,
      };
    }

    return {
      start: startPoint!,
      end: endPoint!,
      angle,
    };
  };

  if (!dragState.dynamicModeNodeId || !contentRef.current) return null;

  // Get all nodes that are part of this dynamic system
  const getDynamicSystemNodes = () => {
    const result: Node[] = [];
    const mainNode = nodeState.nodes.find(
      (n) => n.id === dragState.dynamicModeNodeId
    );
    if (!mainNode) return result;

    // Add main node
    result.push(mainNode);

    // Add nodes with dynamicParentId
    nodeState.nodes.forEach((node) => {
      if (node.dynamicParentId === dragState.dynamicModeNodeId) {
        result.push(node);
      }
    });

    return result;
  };

  const dynamicNodes = getDynamicSystemNodes();
  const containerRect = contentRef.current.getBoundingClientRect();

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {dynamicNodes.map((node) =>
        (node.dynamicConnections || []).map((conn) => {
          const source = document.querySelector(
            `[data-node-id="${conn.sourceId}"]`
          );
          const target = document.querySelector(
            `[data-node-id="${conn.targetId}"]`
          );

          if (!source || !target) return null;

          const sourceRect = source.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();

          const points = getConnectionPoints(sourceRect, targetRect);

          const sourcePos = getAdjustedPosition(sourceRect, containerRect);
          const targetPos = getAdjustedPosition(targetRect, containerRect);

          // Adjust start and end points to our coordinate system
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

          // Adjust curve based on connection points
          const dx = endX - startX;
          const dy = endY - startY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const curveOffset = Math.min(50, distance * 0.4);

          return (
            <svg
              key={`${conn.sourceId}-${conn.targetId}`}
              className="absolute top-0 left-0 w-full h-full overflow-visible"
            >
              <defs>
                <marker
                  id={`arrowhead-${conn.sourceId}-${conn.targetId}`}
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#9966FE" />
                </marker>
              </defs>
              <g transform={`scale(${transform.scale})`}>
                <path
                  d={`M ${startX} ${startY}
                    C ${startX + dx / 3} ${startY + dy / 3}
                      ${startX + (dx * 2) / 3} ${startY + (dy * 2) / 3}
                      ${endX} ${endY}`}
                  stroke="#9966FE"
                  strokeWidth={2 / transform.scale}
                  fill="none"
                  markerEnd={`url(#arrowhead-${conn.sourceId}-${conn.targetId})`}
                />
                <text
                  x={(startX + endX) / 2}
                  y={(startY + endY) / 2 - 10}
                  fill="#9966FE"
                  fontSize={12 / transform.scale}
                  textAnchor="middle"
                >
                  {conn.type}
                </text>
              </g>
            </svg>
          );
        })
      )}
    </div>
  );
};
