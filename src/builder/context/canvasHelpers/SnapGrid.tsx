// SnapGrid.ts - Optimized for both canvas and frame elements

import React from "react";
import { Node } from "../../reducer/nodeDispatcher";
import { isAbsoluteInFrame } from "../utils";

export interface SnapLine {
  orientation: "horizontal" | "vertical";
  sourceNodeId: string | number;
  position: number; // Alignment position
}

export interface SnapResult {
  // Edge/center alignment
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

// Utility function to get absolute position by recursively adding parent offsets
function getAbsolutePosition(
  node: Node,
  allNodes: Node[]
): { x: number; y: number } {
  if (!node.style) return { x: 0, y: 0 };

  // Start with the node's local position
  let x = parseFloat(node.style.left as string) || 0;
  let y = parseFloat(node.style.top as string) || 0;

  // If this is absolute-in-frame, add the parent's position
  if (isAbsoluteInFrame(node) && node.parentId) {
    const parentNode = allNodes.find((n) => n.id === node.parentId);
    if (parentNode) {
      const parentPos = getAbsolutePosition(parentNode, allNodes);
      x += parentPos.x;
      y += parentPos.y;
    }
  }

  return { x, y };
}

export class SnapGrid {
  private horizontalLines: Map<number, Set<string | number>> = new Map();
  private verticalLines: Map<number, Set<string | number>> = new Map();

  private nodeRects: Record<
    string | number,
    {
      left: number;
      right: number;
      top: number;
      bottom: number;
      parentId?: string | number;
    }
  > = {};

  // Store node references for additional filtering
  private nodes: Node[] = [];

  constructor(nodes: Node[]) {
    this.nodes = nodes;
    this.buildSnapPoints(nodes);
  }

  /**
   * Build alignment lines for each node:
   *  - top/bottom/centerY
   *  - left/right/centerX
   *
   * All positions are converted to global canvas coordinates
   */
  private buildSnapPoints(nodes: Node[]) {
    // First pass - calculate global coordinates for all nodes
    nodes.forEach((node) => {
      if (!node.style) return;

      // Calculate global position
      const { x: left, y: top } = getAbsolutePosition(node, nodes);

      const width = parseFloat(node.style.width as string) || 0;
      const height = parseFloat(node.style.height as string) || 0;

      // Store node in global coordinates
      this.nodeRects[node.id] = {
        left,
        right: left + width,
        top,
        bottom: top + height,
        parentId: node.parentId,
      };

      // Add snap lines using global coordinates
      const rLeft = Math.round(left);
      const rRight = Math.round(left + width);
      const rTop = Math.round(top);
      const rBottom = Math.round(top + height);
      const rCenterX = Math.round(left + width / 2);
      const rCenterY = Math.round(top + height / 2);

      this.addHorizontalLine(rTop, node.id);
      this.addHorizontalLine(rBottom, node.id);
      this.addHorizontalLine(rCenterY, node.id);

      this.addVerticalLine(rLeft, node.id);
      this.addVerticalLine(rRight, node.id);
      this.addVerticalLine(rCenterX, node.id);
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

  /**
   * findNearestSnaps:
   * Find alignment lines only (no spacing)
   *
   * The points passed in should be in global canvas coordinates.
   */
  public findNearestSnaps(
    points: Array<{ value: number; type: string }>,
    threshold: number,
    draggingNodeId: string | number,
    relevantNodes?: Node[]
  ): SnapResult {
    // Get the dragged node
    const draggedNode = this.nodes.find((n) => n.id === draggingNodeId);

    // Get relevant node IDs for filtering
    let relevantNodeIds: (string | number)[] = [];

    if (relevantNodes) {
      // If relevantNodes is explicitly provided, use these nodes
      relevantNodeIds = relevantNodes.map((n) => n.id);
    } else {
      // By default, consider all nodes except the one being dragged
      relevantNodeIds = this.nodes
        .filter((n) => n.id !== draggingNodeId)
        .map((n) => n.id);
    }

    // For absolute-in-frame elements, focus on nodes within the same frame ecosystem
    // Only if relevantNodes wasn't explicitly provided
    if (
      draggedNode &&
      isAbsoluteInFrame(draggedNode) &&
      draggedNode.parentId &&
      !relevantNodes
    ) {
      // Get parent frame
      const parentId = draggedNode.parentId;

      // Get sibling nodes
      const siblingIds = this.nodes
        .filter((n) => n.parentId === parentId && n.id !== draggingNodeId)
        .map((n) => n.id);

      // Include the parent frame itself
      relevantNodeIds = [...siblingIds, parentId];

      // Optionally include "uncle" nodes (siblings of the parent)
      const parentNode = this.nodes.find((n) => n.id === parentId);
      if (parentNode && parentNode.parentId) {
        const uncleIds = this.nodes
          .filter(
            (n) => n.parentId === parentNode.parentId && n.id !== parentId
          )
          .map((n) => n.id);
        relevantNodeIds = [...relevantNodeIds, ...uncleIds];
      }
    }

    const { horizontalSnap, verticalSnap, snapGuides } = this.checkAlignments(
      points,
      threshold,
      draggingNodeId,
      relevantNodeIds
    );

    return {
      horizontalSnap,
      verticalSnap,
      snapGuides,
    };
  }

  private checkAlignments(
    points: Array<{ value: number; type: string }>,
    threshold: number,
    draggingNodeId: string | number,
    relevantNodeIds: (string | number)[]
  ) {
    let horizontalSnap: {
      position: number;
      type: string;
      sourceNodeId: string | number;
    } | null = null;
    let verticalSnap: {
      position: number;
      type: string;
      sourceNodeId: string | number;
    } | null = null;
    const snapGuides: SnapLine[] = [];

    let minHdist = threshold + 1;

    // Process horizontal lines (for top, bottom, centerY alignment)
    this.horizontalLines.forEach((sourceNodes, linePos) => {
      // Only consider lines from relevant nodes
      const relevantSources = Array.from(sourceNodes).filter((id) =>
        relevantNodeIds.includes(id)
      );

      if (!relevantSources.length) return;
      if (sourceNodes.has(draggingNodeId)) return;

      points.forEach((pt) => {
        if (
          pt.type === "top" ||
          pt.type === "bottom" ||
          pt.type === "centerY"
        ) {
          const dist = Math.abs(pt.value - linePos);
          if (dist <= threshold && dist < minHdist) {
            minHdist = dist;
            horizontalSnap = {
              position: linePos,
              type: pt.type,
              sourceNodeId: relevantSources[0],
            };

            if (
              !snapGuides.some(
                (g) => g.orientation === "horizontal" && g.position === linePos
              )
            ) {
              snapGuides.push({
                orientation: "horizontal",
                position: linePos,
                sourceNodeId: relevantSources[0],
              });
            }
          }
        }
      });
    });

    let minVdist = threshold + 1;

    // Process vertical lines (for left, right, centerX alignment)
    this.verticalLines.forEach((sourceNodes, linePos) => {
      // Only consider lines from relevant nodes
      const relevantSources = Array.from(sourceNodes).filter((id) =>
        relevantNodeIds.includes(id)
      );

      if (!relevantSources.length) return;
      if (sourceNodes.has(draggingNodeId)) return;

      points.forEach((pt) => {
        if (
          pt.type === "left" ||
          pt.type === "right" ||
          pt.type === "centerX"
        ) {
          const dist = Math.abs(pt.value - linePos);
          if (dist <= threshold && dist < minVdist) {
            minVdist = dist;
            verticalSnap = {
              position: linePos,
              type: pt.type,
              sourceNodeId: relevantSources[0],
            };

            if (
              !snapGuides.some(
                (g) => g.orientation === "vertical" && g.position === linePos
              )
            ) {
              snapGuides.push({
                orientation: "vertical",
                position: linePos,
                sourceNodeId: relevantSources[0],
              });
            }
          }
        }
      });
    });

    return { horizontalSnap, verticalSnap, snapGuides };
  }

  /**
   * Expose all alignment lines for debugging purposes
   */
  public getAllLines(): SnapLine[] {
    const lines: SnapLine[] = [];

    // Add all horizontal lines
    this.horizontalLines.forEach((sourceNodes, position) => {
      const sourceNodeId = Array.from(sourceNodes)[0];
      lines.push({
        orientation: "horizontal",
        position,
        sourceNodeId,
      });
    });

    // Add all vertical lines
    this.verticalLines.forEach((sourceNodes, position) => {
      const sourceNodeId = Array.from(sourceNodes)[0];
      lines.push({
        orientation: "vertical",
        position,
        sourceNodeId,
      });
    });

    return lines;
  }

  public clear() {
    this.horizontalLines.clear();
    this.verticalLines.clear();
    this.nodeRects = {};
  }
}

/** Hook to build or rebuild a SnapGrid whenever filteredNodes changes. */
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
