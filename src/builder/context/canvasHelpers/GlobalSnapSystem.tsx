// GlobalSnapSystem.ts - Complete replacement for SnapGrid.ts

import React from "react";
import { Node } from "../../reducer/nodeDispatcher";
import { isAbsoluteInFrame } from "../utils";

export interface SnapLine {
  orientation: "horizontal" | "vertical";
  sourceNodeId: string | number;
  position: number;
}

export interface SnapResult {
  horizontalSnap: {
    position: number;
    type: string;
    sourceNodeId: string | number;
  } | null;
  verticalSnap: {
    position: number;
    type: string;
    sourceNodeId: string | number;
  } | null;
  snapGuides: SnapLine[];
}

// Convert any node to global coordinates
function getGlobalPosition(
  node: Node,
  allNodes: Node[]
): { left: number; top: number; width: number; height: number } {
  if (!node.style) return { left: 0, top: 0, width: 0, height: 0 };

  let left = parseFloat(node.style.left as string) || 0;
  let top = parseFloat(node.style.top as string) || 0;
  const width = parseFloat(node.style.width as string) || 0;
  const height = parseFloat(node.style.height as string) || 0;

  // If absolute-in-frame, recursively add all parent positions
  if (isAbsoluteInFrame(node) && node.parentId) {
    let current = node;
    while (current.parentId) {
      const parent = allNodes.find((n) => n.id === current.parentId);
      if (parent && parent.style) {
        left += parseFloat(parent.style.left as string) || 0;
        top += parseFloat(parent.style.top as string) || 0;
        current = parent;
      } else {
        break;
      }
    }
  }

  return { left, top, width, height };
}

export class GlobalSnapSystem {
  // Store all possible snap lines from all elements
  private horizontalLines: { position: number; nodeId: string | number }[] = [];
  private verticalLines: { position: number; nodeId: string | number }[] = [];
  private nodes: Node[] = [];

  constructor(nodes: Node[]) {
    this.nodes = nodes;
    this.buildGlobalSnapLines(nodes);
  }

  private buildGlobalSnapLines(nodes: Node[]) {
    // Clear existing lines
    this.horizontalLines = [];
    this.verticalLines = [];

    // Add all possible snap lines from all nodes
    nodes.forEach((node) => {
      if (!node.style) return;

      // ALWAYS convert to global coordinates
      const { left, top, width, height } = getGlobalPosition(node, nodes);

      // Add horizontal lines (top, center, bottom)
      this.horizontalLines.push({ position: top, nodeId: node.id });
      this.horizontalLines.push({
        position: top + height / 2,
        nodeId: node.id,
      });
      this.horizontalLines.push({ position: top + height, nodeId: node.id });

      // Add vertical lines (left, center, right)
      this.verticalLines.push({ position: left, nodeId: node.id });
      this.verticalLines.push({ position: left + width / 2, nodeId: node.id });
      this.verticalLines.push({ position: left + width, nodeId: node.id });
    });
  }

  // Find the closest snap for any element
  public findSnaps(
    points: Array<{ value: number; type: string }>,
    threshold: number = 40, // Higher threshold for better snap
    draggingNodeId: string | number
  ): SnapResult {
    const snapGuides: SnapLine[] = [];
    let horizontalSnap = null;
    let verticalSnap = null;

    // Find closest horizontal snap
    let minHDist = threshold + 1;
    points.forEach((point) => {
      if (
        point.type !== "top" &&
        point.type !== "bottom" &&
        point.type !== "centerY"
      )
        return;

      this.horizontalLines.forEach((line) => {
        if (line.nodeId === draggingNodeId) return; // Skip self

        const dist = Math.abs(point.value - line.position);
        if (dist <= threshold && dist < minHDist) {
          minHDist = dist;
          horizontalSnap = {
            position: line.position,
            type: point.type,
            sourceNodeId: line.nodeId,
          };

          // Add to guides if not already there
          if (
            !snapGuides.some(
              (g) =>
                g.orientation === "horizontal" && g.position === line.position
            )
          ) {
            snapGuides.push({
              orientation: "horizontal",
              position: line.position,
              sourceNodeId: line.nodeId,
            });
          }
        }
      });
    });

    // Find closest vertical snap
    let minVDist = threshold + 1;
    points.forEach((point) => {
      if (
        point.type !== "left" &&
        point.type !== "right" &&
        point.type !== "centerX"
      )
        return;

      this.verticalLines.forEach((line) => {
        if (line.nodeId === draggingNodeId) return; // Skip self

        const dist = Math.abs(point.value - line.position);
        if (dist <= threshold && dist < minVDist) {
          minVDist = dist;
          verticalSnap = {
            position: line.position,
            type: point.type,
            sourceNodeId: line.nodeId,
          };

          // Add to guides if not already there
          if (
            !snapGuides.some(
              (g) =>
                g.orientation === "vertical" && g.position === line.position
            )
          ) {
            snapGuides.push({
              orientation: "vertical",
              position: line.position,
              sourceNodeId: line.nodeId,
            });
          }
        }
      });
    });

    return { horizontalSnap, verticalSnap, snapGuides };
  }

  // For debug visualization
  public getAllLines(): SnapLine[] {
    const lines: SnapLine[] = [];

    this.horizontalLines.forEach((line) => {
      lines.push({
        orientation: "horizontal",
        position: line.position,
        sourceNodeId: line.nodeId,
      });
    });

    this.verticalLines.forEach((line) => {
      lines.push({
        orientation: "vertical",
        position: line.position,
        sourceNodeId: line.nodeId,
      });
    });

    return lines;
  }

  public clear() {
    this.horizontalLines = [];
    this.verticalLines = [];
  }
}

// New hook with the same name for compatibility
export const useSnapGrid = (filteredNodes: Node[]) => {
  const gridRef = React.useRef<GlobalSnapSystem | null>(null);
  const prevNodesRef = React.useRef<Node[]>([]);

  React.useEffect(() => {
    if (filteredNodes !== prevNodesRef.current) {
      gridRef.current = new GlobalSnapSystem(filteredNodes);
      prevNodesRef.current = filteredNodes;
    }
    return () => {
      gridRef.current?.clear();
    };
  }, [filteredNodes]);

  return gridRef.current;
};

// For backward compatibility with existing code
export { GlobalSnapSystem as SnapGrid };
