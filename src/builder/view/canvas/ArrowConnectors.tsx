import React, { useCallback } from "react";
import { useBuilder } from "@/builder/context/builderState";

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

  if (!dragState.dynamicModeNodeId || !contentRef.current) return null;

  const mainDynamicNode = nodeState.nodes.find(
    (node) => node.id === dragState.dynamicModeNodeId
  );
  if (!mainDynamicNode?.dynamicConnections) return null;

  const containerRect = contentRef.current.getBoundingClientRect();

  return (
    <div className="absolute inset-0 pointer-events-none z-[9999]">
      {mainDynamicNode.dynamicConnections.map((conn) => {
        const source = document.querySelector(
          `[data-node-id="${conn.sourceId}"]`
        );
        const target = document.querySelector(
          `[data-node-id="${conn.targetId}"]`
        );

        if (!source || !target) return null;

        const sourcePos = getAdjustedPosition(
          source.getBoundingClientRect(),
          containerRect
        );
        const targetPos = getAdjustedPosition(
          target.getBoundingClientRect(),
          containerRect
        );

        const startX = sourcePos.x + sourcePos.width;
        const startY = sourcePos.y + sourcePos.height / 2;
        const endX = targetPos.x;
        const endY = targetPos.y + targetPos.height / 2;

        const curveOffset = Math.min(50, Math.abs(endX - startX) * 0.4);

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
                   C ${startX + curveOffset} ${startY}
                     ${endX - curveOffset} ${endY}
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
      })}
    </div>
  );
};
