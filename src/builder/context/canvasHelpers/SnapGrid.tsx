// SnapGrid.ts

import React from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";

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
    }
  > = {};

  constructor(nodes: Node[]) {
    this.buildSnapPoints(nodes);
    this.buildSpacingInfo(nodes);
  }

  /**
   * Build alignment lines for each node:
   *  - top/bottom/centerY
   *  - left/right/centerX
   */
  private buildSnapPoints(nodes: Node[]) {
    nodes.forEach((node) => {
      if (!node.style) return;

      const left = parseFloat(node.style.left as string) || 0;
      const top = parseFloat(node.style.top as string) || 0;
      const width = parseFloat(node.style.width as string) || 0;
      const height = parseFloat(node.style.height as string) || 0;

      const right = left + width;
      const bottom = top + height;

      this.nodeRects[node.id] = { left, right, top, bottom };

      const rLeft = Math.round(left);
      const rRight = Math.round(right);
      const rTop = Math.round(top);
      const rBottom = Math.round(bottom);

      // horizontal lines => top, bottom, centerY
      this.addHorizontalLine(rTop, node.id);
      this.addHorizontalLine(rBottom, node.id);
      this.addHorizontalLine(Math.round((rTop + rBottom) / 2), node.id);

      // vertical lines => left, right, centerX
      this.addVerticalLine(rLeft, node.id);
      this.addVerticalLine(rRight, node.id);
      this.addVerticalLine(Math.round((rLeft + rRight) / 2), node.id);
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
   * If you want to show absolutely all horizontal gaps, remove the rowTolerance check.
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
   */
  public findNearestSnaps(
    points: Array<{ value: number; type: string }>,
    threshold: number,
    draggingNodeId: string | number
  ): SnapResult {
    const { horizontalSnap, verticalSnap, snapGuides } = this.checkAlignments(
      points,
      threshold,
      draggingNodeId
    );

    const { allSpacingLines, bestHorizontalOffset, bestVerticalOffset } =
      this.checkSpacing(points, threshold, draggingNodeId);

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
    draggingNodeId: string | number
  ) {
    let horizontalSnap: { position: number; type: string } | null = null;
    let verticalSnap: { position: number; type: string } | null = null;
    const snapGuides: SnapLine[] = [];

    let minHdist = threshold + 1;
    this.horizontalLines.forEach((sourceNodes, linePos) => {
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
    draggingNodeId: string | number
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
            +otherId,
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
              +otherId,
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
            +otherId,
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
              +otherId,
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
    otherId: number,
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
    otherId: number,
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

  /** For debugging alignment lines only */
  public getAllLines(): SnapLine[] {
    const lines: SnapLine[] = [];
    this.horizontalLines.forEach((sourceNodes, position) => {
      lines.push({
        orientation: "horizontal",
        position,
        sourceNodeId: Array.from(sourceNodes)[0],
      });
    });
    this.verticalLines.forEach((sourceNodes, position) => {
      lines.push({
        orientation: "vertical",
        position,
        sourceNodeId: Array.from(sourceNodes)[0],
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

/** Hook to build or rebuild a SnapGrid whenever `filteredNodes` changes. */
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
