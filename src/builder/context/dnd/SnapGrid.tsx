import { Node } from "@/builder/reducer/nodeDispatcher";
import React from "react";

interface SnapLine {
  position: number;
  orientation: "horizontal" | "vertical";
  sourceNodeId: string | number;
}

class SnapGrid {
  private horizontalLines: Map<number, Set<string | number>> = new Map();
  private verticalLines: Map<number, Set<string | number>> = new Map();

  constructor(nodes: Node[]) {
    this.buildSnapPoints(nodes);
  }

  private buildSnapPoints(nodes: Node[]) {
    nodes.forEach((node) => {
      if (!node.style || node.type === "placeholder") return;
      if (node.inViewport) return; // Skip nodes in viewport

      // Parse positions and ensure they are numbers
      const left = parseFloat(node.style.left as string) || 0;
      const top = parseFloat(node.style.top as string) || 0;
      const width = parseFloat(node.style.width as string) || 0;
      const height = parseFloat(node.style.height as string) || 0;

      // Round to prevent floating point issues
      const roundedLeft = Math.round(left);
      const roundedTop = Math.round(top);
      const roundedWidth = Math.round(width);
      const roundedHeight = Math.round(height);

      // Add horizontal lines
      this.addHorizontalLine(roundedTop, node.id);
      this.addHorizontalLine(roundedTop + roundedHeight, node.id);
      this.addHorizontalLine(roundedTop + roundedHeight / 2, node.id);

      // Add vertical lines
      this.addVerticalLine(roundedLeft, node.id);
      this.addVerticalLine(roundedLeft + roundedWidth, node.id);
      this.addVerticalLine(roundedLeft + roundedWidth / 2, node.id);
    });
  }

  private addHorizontalLine(position: number, nodeId: string | number) {
    if (!this.horizontalLines.has(position)) {
      this.horizontalLines.set(position, new Set());
    }
    this.horizontalLines.get(position)!.add(nodeId);
  }

  private addVerticalLine(position: number, nodeId: string | number) {
    if (!this.verticalLines.has(position)) {
      this.verticalLines.set(position, new Set());
    }
    this.verticalLines.get(position)!.add(nodeId);
  }

  findNearestSnaps(
    points: Array<{ value: number; type: string }>,
    threshold: number,
    nodeId: string | number
  ) {
    let horizontalSnap: { position: number; type: string } | null = null;
    let verticalSnap: { position: number; type: string } | null = null;
    const snapGuides: SnapLine[] = [];

    // Find closest horizontal line
    let minHorizontalDist = threshold + 1;
    this.horizontalLines.forEach((sourceNodes, linePosition) => {
      if (sourceNodes.has(nodeId)) return; // Skip self-snapping

      // Check each point that could snap horizontally (top, bottom, centerY)
      points.forEach((point) => {
        if (
          point.type === "top" ||
          point.type === "bottom" ||
          point.type === "centerY"
        ) {
          const distance = Math.abs(point.value - linePosition);
          if (distance <= threshold && distance < minHorizontalDist) {
            minHorizontalDist = distance;
            horizontalSnap = { position: linePosition, type: point.type };
            // Add or update the guide
            const existingGuideIndex = snapGuides.findIndex(
              (g) =>
                g.orientation === "horizontal" && g.position === linePosition
            );
            if (existingGuideIndex === -1) {
              snapGuides.push({
                position: linePosition,
                orientation: "horizontal",
                sourceNodeId: Array.from(sourceNodes)[0],
              });
            }
          }
        }
      });
    });

    // Find closest vertical line
    let minVerticalDist = threshold + 1;
    this.verticalLines.forEach((sourceNodes, linePosition) => {
      if (sourceNodes.has(nodeId)) return; // Skip self-snapping

      // Check each point that could snap vertically (left, right, centerX)
      points.forEach((point) => {
        if (
          point.type === "left" ||
          point.type === "right" ||
          point.type === "centerX"
        ) {
          const distance = Math.abs(point.value - linePosition);
          if (distance <= threshold && distance < minVerticalDist) {
            minVerticalDist = distance;
            verticalSnap = { position: linePosition, type: point.type };
            // Add or update the guide
            const existingGuideIndex = snapGuides.findIndex(
              (g) => g.orientation === "vertical" && g.position === linePosition
            );
            if (existingGuideIndex === -1) {
              snapGuides.push({
                position: linePosition,
                orientation: "vertical",
                sourceNodeId: Array.from(sourceNodes)[0],
              });
            }
          }
        }
      });
    });

    return {
      horizontalSnap,
      verticalSnap,
      snapGuides,
    };
  }

  getAllLines(): SnapLine[] {
    const lines: SnapLine[] = [];

    // Add horizontal lines
    this.horizontalLines.forEach((sourceNodes, position) => {
      lines.push({
        position,
        orientation: "horizontal",
        sourceNodeId: Array.from(sourceNodes)[0],
      });
    });

    // Add vertical lines
    this.verticalLines.forEach((sourceNodes, position) => {
      lines.push({
        position,
        orientation: "vertical",
        sourceNodeId: Array.from(sourceNodes)[0],
      });
    });

    return lines;
  }

  clear() {
    this.horizontalLines.clear();
    this.verticalLines.clear();
  }
}

export const useSnapGrid = (nodes: Node[]) => {
  const snapGridRef = React.useRef<SnapGrid | null>(null);
  const nodesRef = React.useRef(nodes);

  React.useEffect(() => {
    // Only rebuild if nodes have actually changed
    if (nodes !== nodesRef.current) {
      snapGridRef.current = new SnapGrid(nodes);
      nodesRef.current = nodes;
    }

    return () => {
      snapGridRef.current?.clear();
    };
  }, [nodes]);

  return snapGridRef.current;
};
