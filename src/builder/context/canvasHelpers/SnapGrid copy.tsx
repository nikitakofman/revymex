// SnapGrid.ts

import React from "react";
import { Node } from "../../reducer/nodeDispatcher";
import { isAbsoluteInFrame } from "../utils";

export interface SnapLine {
  orientation: "horizontal" | "vertical";
  sourceNodeId: string | number;

  // For alignment lines
  position?: number;

  // For spacing lines
  spacing?: number;
  x1?: number;
  x2?: number;
  y?: number;
  y1?: number;
  y2?: number;
  x?: number;
}

export interface SnapResult {
  // Edge/center alignment
  horizontalSnap: { position: number; type: string } | null;
  verticalSnap: { position: number; type: string } | null;

  // Potential offsets if you want to snap exactly to that spacing
  horizontalSpacingSnap?: number;
  verticalSpacingSnap?: number;

  // The combined array of alignment + spacing lines
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

  private horizontalSpacings: Map<
    number,
    Set<[string | number, string | number]>
  > = new Map();
  private verticalSpacings: Map<
    number,
    Set<[string | number, string | number]>
  > = new Map();

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
    this.buildSpacingInfo(nodes);
  }

  /**
   * Build alignment lines for each node:
   *  - top/bottom/centerY
   *  - left/right/centerX
   *
   * All positions are converted to global canvas coordinates
   */
  private buildSnapPoints(nodes: Node[]) {
    // First pass - store global positions for all frames
    const framePositions = new Map<
      string | number,
      { left: number; top: number }
    >();

    nodes.forEach((node) => {
      if (!node.style) return;
      framePositions.set(node.id, {
        left: parseFloat(node.style.left as string) || 0,
        top: parseFloat(node.style.top as string) || 0,
      });
    });

    // Second pass - calculate global coordinates for all nodes
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
   * Build spacing data for pairs of nodes that appear in roughly the same row or column.
   * Uses global coordinates for all calculations.
   */
  private buildSpacingInfo(nodes: Node[]) {
    // Increase these so more nodes are considered "in the same row/col."
    const rowTolerance = 50;
    const colTolerance = 50;

    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      const r1 = this.nodeRects[n1.id];
      if (!r1) continue;

      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const r2 = this.nodeRects[n2.id];
        if (!r2) continue;

        // same row => centerY within tolerance
        const cY1 = (r1.top + r1.bottom) / 2;
        const cY2 = (r2.top + r2.bottom) / 2;
        const sameRow = Math.abs(cY1 - cY2) <= rowTolerance;
        if (sameRow) {
          if (r1.right < r2.left) {
            const dist = Math.round(r2.left - r1.right);
            if (dist > 0) this.addHorizontalSpacing(dist, n1.id, n2.id);
          } else if (r2.right < r1.left) {
            const dist = Math.round(r1.left - r2.right);
            if (dist > 0) this.addHorizontalSpacing(dist, n2.id, n1.id);
          }
        }

        // same column => centerX within tolerance
        const cX1 = (r1.left + r1.right) / 2;
        const cX2 = (r2.left + r2.right) / 2;
        const sameCol = Math.abs(cX1 - cX2) <= colTolerance;
        if (sameCol) {
          if (r1.bottom < r2.top) {
            const dist = Math.round(r2.top - r1.bottom);
            if (dist > 0) this.addVerticalSpacing(dist, n1.id, n2.id);
          } else if (r2.bottom < r1.top) {
            const dist = Math.round(r1.top - r2.bottom);
            if (dist > 0) this.addVerticalSpacing(dist, n2.id, n1.id);
          }
        }
      }
    }
  }

  private addHorizontalSpacing(
    dist: number,
    id1: string | number,
    id2: string | number
  ) {
    if (!this.horizontalSpacings.has(dist)) {
      this.horizontalSpacings.set(dist, new Set());
    }
    this.horizontalSpacings.get(dist)!.add([id1, id2]);
  }

  private addVerticalSpacing(
    dist: number,
    id1: string | number,
    id2: string | number
  ) {
    if (!this.verticalSpacings.has(dist)) {
      this.verticalSpacings.set(dist, new Set());
    }
    this.verticalSpacings.get(dist)!.add([id1, id2]);
  }

  /**
   * findNearestSnaps:
   * 1) normal alignment lines
   * 2) multiple spacing lines
   *
   * The points passed in should be in global canvas coordinates.
   */
  public findNearestSnaps(
    points: Array<{ value: number; type: string }>,
    threshold: number,
    draggingNodeId: string | number,
    relevantNodes?: Node[]
  ): SnapResult {
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

    // Get the dragged node
    const draggedNode = this.nodes.find((n) => n.id === draggingNodeId);

    // For absolute-in-frame elements, focus on nodes within the same frame ecosystem
    if (
      draggedNode &&
      isAbsoluteInFrame(draggedNode) &&
      draggedNode.parentId &&
      !relevantNodes
    ) {
      // Get parent frame and siblings (nodes that share the same parent)
      const parentId = draggedNode.parentId;

      // Get sibling nodes
      const siblingIds = this.nodes
        .filter((n) => n.parentId === parentId && n.id !== draggingNodeId)
        .map((n) => n.id);

      // Include the parent frame itself
      relevantNodeIds = [...siblingIds, parentId];
    }

    const { horizontalSnap, verticalSnap, snapGuides } = this.checkAlignments(
      points,
      threshold,
      draggingNodeId,
      relevantNodeIds
    );

    const { allSpacingLines, bestHorizontalOffset, bestVerticalOffset } =
      this.checkSpacing(points, threshold, draggingNodeId, relevantNodeIds);

    return {
      horizontalSnap,
      verticalSnap,
      horizontalSpacingSnap: bestHorizontalOffset,
      verticalSpacingSnap: bestVerticalOffset,
      snapGuides: [...snapGuides, ...allSpacingLines],
    };
  }

  private checkAlignments(
    points: Array<{ value: number; type: string }>,
    threshold: number,
    draggingNodeId: string | number,
    relevantNodeIds: (string | number)[]
  ) {
    let horizontalSnap: { position: number; type: string } | null = null;
    let verticalSnap: { position: number; type: string } | null = null;
    const snapGuides: SnapLine[] = [];

    let minHdist = threshold + 1;
    this.horizontalLines.forEach((sourceNodes, linePos) => {
      // Only consider lines from relevant nodes
      const hasRelevantSource = Array.from(sourceNodes).some((id) =>
        relevantNodeIds.includes(id)
      );

      if (!hasRelevantSource) return;
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
            horizontalSnap = { position: linePos, type: pt.type };
            if (
              !snapGuides.some(
                (g) => g.orientation === "horizontal" && g.position === linePos
              )
            ) {
              snapGuides.push({
                orientation: "horizontal",
                position: linePos,
                sourceNodeId: Array.from(sourceNodes)[0],
              });
            }
          }
        }
      });
    });

    let minVdist = threshold + 1;
    this.verticalLines.forEach((sourceNodes, linePos) => {
      // Only consider lines from relevant nodes
      const hasRelevantSource = Array.from(sourceNodes).some((id) =>
        relevantNodeIds.includes(id)
      );

      if (!hasRelevantSource) return;
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
            verticalSnap = { position: linePos, type: pt.type };
            if (
              !snapGuides.some(
                (g) => g.orientation === "vertical" && g.position === linePos
              )
            ) {
              snapGuides.push({
                orientation: "vertical",
                position: linePos,
                sourceNodeId: Array.from(sourceNodes)[0],
              });
            }
          }
        }
      });
    });

    return { horizontalSnap, verticalSnap, snapGuides };
  }

  /**
   * checkSpacing:
   * - ALWAYS push a SnapLine for each matching distance (no break).
   * - Also compute the single "best" offset for snapping if you want to replicate that spacing.
   */
  private checkSpacing(
    points: Array<{ value: number; type: string }>,
    threshold: number,
    draggingNodeId: string | number,
    relevantNodeIds: (string | number)[]
  ) {
    const allSpacingLines: SnapLine[] = [];
    let bestHorizontalOffset: number | undefined;
    let bestVerticalOffset: number | undefined;

    // track minimal difference for the "closest" snap offset
    let bestHorizDiff = threshold + 1;
    let bestVertDiff = threshold + 1;

    // bounding box in canvas coords
    const leftP = points.find((p) => p.type === "left")?.value ?? 0;
    const rightP = points.find((p) => p.type === "right")?.value ?? 0;
    const topP = points.find((p) => p.type === "top")?.value ?? 0;
    const bottomP = points.find((p) => p.type === "bottom")?.value ?? 0;

    // we do the same row/column detection. Increase or remove if you want absolutely everything
    const rowTolerance = 50;
    const colTolerance = 50;

    for (const [otherId, r] of Object.entries(this.nodeRects)) {
      // Skip if not in relevant nodes
      if (!relevantNodeIds.includes(otherId)) continue;

      if (`${otherId}` === `${draggingNodeId}`) continue;

      // same row
      const cYdragged = (topP + bottomP) / 2;
      const cYother = (r.top + r.bottom) / 2;
      if (Math.abs(cYdragged - cYother) <= rowTolerance) {
        const gapRight = r.left - rightP;
        if (gapRight > 0) {
          this.matchHorizontalGap(
            allSpacingLines,
            draggingNodeId,
            otherId,
            gapRight,
            { x1: rightP, x2: r.left, y: cYdragged },
            threshold,
            (dist, diff) => {
              if (diff < bestHorizDiff) {
                bestHorizDiff = diff;
                const shift = r.left - dist - rightP;
                bestHorizontalOffset = leftP + shift;
              }
            }
          );
        } else {
          const gapLeft = leftP - r.right;
          if (gapLeft > 0) {
            this.matchHorizontalGap(
              allSpacingLines,
              draggingNodeId,
              otherId,
              gapLeft,
              { x1: r.right, x2: leftP, y: cYdragged },
              threshold,
              (dist, diff) => {
                if (diff < bestHorizDiff) {
                  bestHorizDiff = diff;
                  const shift = r.right + dist - leftP;
                  bestHorizontalOffset = leftP + shift;
                }
              }
            );
          }
        }
      }

      // same column
      const cXdragged = (leftP + rightP) / 2;
      const cXother = (r.left + r.right) / 2;
      if (Math.abs(cXdragged - cXother) <= colTolerance) {
        const gapBelow = r.top - bottomP;
        if (gapBelow > 0) {
          this.matchVerticalGap(
            allSpacingLines,
            draggingNodeId,
            otherId,
            gapBelow,
            { y1: bottomP, y2: r.top, x: cXdragged },
            threshold,
            (dist, diff) => {
              if (diff < bestVertDiff) {
                bestVertDiff = diff;
                const shift = r.top - dist - bottomP;
                bestVerticalOffset = topP + shift;
              }
            }
          );
        } else {
          const gapAbove = topP - r.bottom;
          if (gapAbove > 0) {
            this.matchVerticalGap(
              allSpacingLines,
              draggingNodeId,
              otherId,
              gapAbove,
              { y1: r.bottom, y2: topP, x: cXdragged },
              threshold,
              (dist, diff) => {
                if (diff < bestVertDiff) {
                  bestVertDiff = diff;
                  const shift = r.bottom + dist - topP;
                  bestVerticalOffset = topP + shift;
                }
              }
            );
          }
        }
      }
    }

    return {
      allSpacingLines,
      bestHorizontalOffset,
      bestVerticalOffset,
    };
  }

  private matchHorizontalGap(
    lines: SnapLine[],
    draggingNodeId: string | number,
    otherId: string | number,
    gap: number,
    coords: { x1: number; x2: number; y: number },
    threshold: number,
    onMatch: (dist: number, diff: number) => void
  ) {
    // No "break": we push lines for *all* matching distances
    for (const [dist, pairs] of this.horizontalSpacings.entries()) {
      const diff = Math.abs(dist - gap);
      if (diff <= threshold) {
        lines.push({
          orientation: "horizontal",
          sourceNodeId: otherId,
          spacing: dist,
          x1: coords.x1,
          x2: coords.x2,
          y: coords.y,
        });
        onMatch(dist, diff);
      }
    }
  }

  private matchVerticalGap(
    lines: SnapLine[],
    draggingNodeId: string | number,
    otherId: string | number,
    gap: number,
    coords: { y1: number; y2: number; x: number },
    threshold: number,
    onMatch: (dist: number, diff: number) => void
  ) {
    for (const [dist, pairs] of this.verticalSpacings.entries()) {
      const diff = Math.abs(dist - gap);
      if (diff <= threshold) {
        lines.push({
          orientation: "vertical",
          sourceNodeId: otherId,
          spacing: dist,
          y1: coords.y1,
          y2: coords.y2,
          x: coords.x,
        });
        onMatch(dist, diff);
      }
    }
  }

  /**
   * Expose all snap lines for debugging purposes
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
    this.horizontalSpacings.clear();
    this.verticalSpacings.clear();
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
