// DebugSnapGuides.tsx - Simplified version with alignment guides only

import React, { useEffect, useState } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { SnapLine } from "@/builder/context/canvasHelpers/SnapGrid";
import { useSnapGrid } from "@/builder/context/canvasHelpers/SnapGrid";
import { isAbsoluteInFrame } from "../context/utils";

const DebugSnapGuides: React.FC = () => {
  const { transform, nodeState } = useBuilder();
  const [allGuides, setAllGuides] = useState<SnapLine[]>([]);

  // Get all nodes
  const allNodes = nodeState.nodes;

  // Create snap grid directly
  const snapGrid = useSnapGrid(allNodes);

  // Update guides whenever nodes change
  useEffect(() => {
    if (snapGrid && snapGrid.getAllLines) {
      // Get all lines but filter out spacing lines
      const allLines = snapGrid.getAllLines();
      const alignmentLines = allLines.filter(
        (line) => line.position !== undefined
      );
      setAllGuides(alignmentLines);
    }
  }, [snapGrid, nodeState.nodes]);

  // Function to get absolute position (including parent frame offsets)
  const getAbsolutePosition = (node) => {
    if (!node || !node.style) return { left: 0, top: 0, width: 0, height: 0 };

    let left = parseFloat(node.style.left as string) || 0;
    let top = parseFloat(node.style.top as string) || 0;
    const width = parseFloat(node.style.width as string) || 0;
    const height = parseFloat(node.style.height as string) || 0;

    // If absolute-in-frame, add parent frame's position
    if (isAbsoluteInFrame(node) && node.parentId) {
      const parentNode = nodeState.nodes.find((n) => n.id === node.parentId);
      if (parentNode && parentNode.style) {
        const parentLeft = parseFloat(parentNode.style.left as string) || 0;
        const parentTop = parseFloat(parentNode.style.top as string) || 0;
        left += parentLeft;
        top += parentTop;
      }
    }

    return { left, top, width, height };
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Render alignment guides only */}
      {allGuides.map((guide: SnapLine, i: number) => {
        const sourceNode = nodeState.nodes.find(
          (n) => n.id === guide.sourceNodeId
        );

        // Skip if not an alignment guide
        if (guide.position === undefined) return null;

        // Use different colors based on node type
        const isFrameChild = sourceNode?.parentId ? true : false;
        const lineColor = isFrameChild
          ? "rgba(0, 255, 0, 0.8)" // Green for frame children
          : "rgba(255, 105, 180, 0.8)"; // Pink for regular nodes

        const screenPos =
          guide.orientation === "vertical"
            ? transform.x + guide.position * transform.scale
            : transform.y + guide.position * transform.scale;

        // Debug label
        const sourceNodeInfo = sourceNode
          ? `${sourceNode.id}${
              sourceNode.parentId ? ` (child of ${sourceNode.parentId})` : ""
            }`
          : guide.sourceNodeId;

        const debugLabel = `${guide.orientation} at ${Math.round(
          guide.position
        )}px from ${sourceNodeInfo}`;

        return guide.orientation === "vertical" ? (
          <React.Fragment key={`guide-${i}`}>
            {/* Vertical line */}
            <div
              style={{
                position: "absolute",
                left: screenPos,
                top: 0,
                width: "1px",
                height: "100%",
                backgroundColor: lineColor,
                zIndex: 1000,
              }}
            />
            {/* Label */}
            <div
              style={{
                position: "absolute",
                left: screenPos + 2,
                top: 10 + (i % 10) * 20,
                background: "#fff",
                color: "#333",
                fontSize: 10,
                padding: "2px 4px",
                borderRadius: 4,
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                zIndex: 1001,
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {debugLabel}
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment key={`guide-${i}`}>
            {/* Horizontal line */}
            <div
              style={{
                position: "absolute",
                top: screenPos,
                left: 0,
                height: "1px",
                width: "100%",
                backgroundColor: lineColor,
                zIndex: 1000,
              }}
            />
            {/* Label */}
            <div
              style={{
                position: "absolute",
                top: screenPos + 2,
                left: 10 + (i % 20) * 40,
                background: "#fff",
                color: "#333",
                fontSize: 10,
                padding: "2px 4px",
                borderRadius: 4,
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                zIndex: 1001,
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {debugLabel}
            </div>
          </React.Fragment>
        );
      })}

      {/* Visualize frame children in a different color */}
      {nodeState.nodes
        .filter((node) => node.parentId)
        .map((node, i) => {
          const { left, top, width, height } = getAbsolutePosition(node);

          // Transform to screen coordinates
          const screenLeft = transform.x + left * transform.scale;
          const screenTop = transform.y + top * transform.scale;
          const screenRight = screenLeft + width * transform.scale;
          const screenBottom = screenTop + height * transform.scale;
          const screenCenterX = screenLeft + (width * transform.scale) / 2;
          const screenCenterY = screenTop + (height * transform.scale) / 2;

          return (
            <React.Fragment key={`node-${node.id}`}>
              {/* Left edge */}
              <div
                style={{
                  position: "absolute",
                  left: screenLeft,
                  top: screenTop,
                  width: "1px",
                  height: height * transform.scale,
                  backgroundColor: "rgba(255, 0, 0, 0.5)",
                  zIndex: 999,
                }}
              />
              {/* Right edge */}
              <div
                style={{
                  position: "absolute",
                  left: screenRight,
                  top: screenTop,
                  width: "1px",
                  height: height * transform.scale,
                  backgroundColor: "rgba(255, 0, 0, 0.5)",
                  zIndex: 999,
                }}
              />
              {/* Top edge */}
              <div
                style={{
                  position: "absolute",
                  left: screenLeft,
                  top: screenTop,
                  width: width * transform.scale,
                  height: "1px",
                  backgroundColor: "rgba(255, 0, 0, 0.5)",
                  zIndex: 999,
                }}
              />
              {/* Bottom edge */}
              <div
                style={{
                  position: "absolute",
                  left: screenLeft,
                  top: screenBottom,
                  width: width * transform.scale,
                  height: "1px",
                  backgroundColor: "rgba(255, 0, 0, 0.5)",
                  zIndex: 999,
                }}
              />
              {/* Center X */}
              <div
                style={{
                  position: "absolute",
                  left: screenCenterX,
                  top: screenTop,
                  width: "1px",
                  height: height * transform.scale,
                  backgroundColor: "rgba(255, 0, 0, 0.5)",
                  zIndex: 999,
                }}
              />
              {/* Center Y */}
              <div
                style={{
                  position: "absolute",
                  left: screenLeft,
                  top: screenCenterY,
                  width: width * transform.scale,
                  height: "1px",
                  backgroundColor: "rgba(255, 0, 0, 0.5)",
                  zIndex: 999,
                }}
              />

              {/* Label */}
              <div
                style={{
                  position: "absolute",
                  left: screenLeft,
                  top: screenTop - 20,
                  background: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  fontSize: 10,
                  padding: "2px 4px",
                  borderRadius: 4,
                  zIndex: 1002,
                }}
              >
                {`Frame child: ${node.id} (parent: ${node.parentId})`}
              </div>
            </React.Fragment>
          );
        })}
    </div>
  );
};

export default DebugSnapGuides;
