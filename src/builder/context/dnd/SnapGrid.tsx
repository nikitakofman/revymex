import React from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";

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
      if (!node.style) return;

      const left = parseFloat(node.style.left as string) || 0;
      const top = parseFloat(node.style.top as string) || 0;
      const width = parseFloat(node.style.width as string) || 0;
      const height = parseFloat(node.style.height as string) || 0;

      const roundedLeft = Math.round(left);
      const roundedTop = Math.round(top);
      const roundedWidth = Math.round(width);
      const roundedHeight = Math.round(height);

      this.addHorizontalLine(roundedTop, node.id);
      this.addHorizontalLine(roundedTop + roundedHeight, node.id);
      this.addHorizontalLine(roundedTop + roundedHeight / 2, node.id);

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

    let minHorizontalDist = threshold + 1;
    this.horizontalLines.forEach((sourceNodes, linePosition) => {
      if (sourceNodes.has(nodeId)) return;
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

            if (
              !snapGuides.some(
                (g) =>
                  g.orientation === "horizontal" && g.position === linePosition
              )
            ) {
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

    let minVerticalDist = threshold + 1;
    this.verticalLines.forEach((sourceNodes, linePosition) => {
      if (sourceNodes.has(nodeId)) return;
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

            if (
              !snapGuides.some(
                (g) =>
                  g.orientation === "vertical" && g.position === linePosition
              )
            ) {
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
    this.horizontalLines.forEach((sourceNodes, position) => {
      lines.push({
        position,
        orientation: "horizontal",
        sourceNodeId: Array.from(sourceNodes)[0],
      });
    });
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

export const useSnapGrid = (filteredNodes: Node[]) => {
  const snapGridRef = React.useRef<SnapGrid | null>(null);
  const prevNodesRef = React.useRef<Node[]>([]);

  React.useEffect(() => {
    if (filteredNodes !== prevNodesRef.current) {
      snapGridRef.current = new SnapGrid(filteredNodes);
      prevNodesRef.current = filteredNodes;
    }
    return () => {
      snapGridRef.current?.clear();
    };
  }, [filteredNodes]);

  return snapGridRef.current;
};
