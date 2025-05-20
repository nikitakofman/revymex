import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  useGetIsResizing,
  useIsMovingCanvas,
  useIsResizing,
  useTransform,
} from "@/builder/context/atoms/canvas-interaction-store";
import {
  useDraggedNode,
  useIsDragging,
  useDragSource,
  useDragPositions,
  useDropInfo,
  useDraggedNodes, // Added this hook to get all dragged nodes
} from "@/builder/context/atoms/drag-store";
import {
  useGetAllNodes,
  useGetNodeFlags,
  useGetNodeParent,
  getCurrentNodes,
  useGetNodeStyle,
} from "@/builder/context/atoms/node-store";
import {
  useActiveGuides,
  snapOps,
  useShowChildElements,
  useLimitToNodes,
  useResizeDirection,
  useSpacingGuide,
} from "@/builder/context/atoms/snap-guides-store";
import { useGetNodeChildren } from "../../atoms/node-store/hierarchy-store";
import { useGetSelectedIds } from "../../atoms/select-store";

// Add these constants to control the snap guides behavior
const SHOW_ALL_GUIDES = false; // Set to true to show all guides without activation
const SHOW_SPACING = true; // Set to true to show spacing between canvas elements with no parent

/**
 * Helper function to check if two ranges overlap (1D interval overlap)
 */
function rangesOverlap(a1: number, a2: number, b1: number, b2: number) {
  return a1 < b2 && b1 < a2;
}

/**
 * Helper function to check if a point is within viewport range (with margin)
 */
function withinViewport(p: number, q: number, margin = 600 /*px*/) {
  // do not accept a snap line that is more than `margin` away
  return Math.abs(p - q) <= margin;
}

/**
 * Return the overlap ratio (0-1) of the intersection on the secondary axis.
 * A value ≥ 0.01 means the two boxes are in the same "layout family".
 */
function crossAxisOverlapRatio(a, b, axis: "h" | "v") {
  if (axis === "h") {
    const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return Math.max(0, overlap) / Math.min(a.bottom - a.top, b.bottom - b.top);
  } else {
    const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    return Math.max(0, overlap) / Math.min(a.right - a.left, b.right - b.left);
  }
}

/**
 * Helper function to collect all gaps with equal spacing
 */
function collectEqualGaps(
  boxes: ReturnType<typeof getCanvasBoxes>,
  dist: number,
  axis: "h" | "v",
  currentViewportId: string | number | null = null,
  nodesToExclude: string[] = [] // Added parameter for nodes to exclude
) {
  const segs: { start: number; end: number; min: number; max: number }[] = [];

  // Filter out excluded nodes first (FIX FOR ISSUE 2)
  const filteredBoxes = boxes.filter((box) => !nodesToExclude.includes(box.id));

  // Sort boxes by appropriate position
  const sorted =
    axis === "h"
      ? [...filteredBoxes].sort((a, b) => a.left - b.left)
      : [...filteredBoxes].sort((a, b) => a.top - b.top);

  // Check ALL possible pairs, not just adjacent ones
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const b1 = sorted[i];
      const b2 = sorted[j];

      // If we have a current viewport ID, only consider boxes in this viewport
      if (currentViewportId) {
        if (
          b1.viewportId !== currentViewportId ||
          b2.viewportId !== currentViewportId
        ) {
          continue;
        }
      }

      // Skip if elements don't follow the correct order
      if (axis === "h" && b2.left <= b1.right) continue;
      if (axis === "v" && b2.top <= b1.bottom) continue;

      // Check if there's any element between these two
      const hasBetween = sorted.some(
        (box) =>
          box !== b1 &&
          box !== b2 &&
          (axis === "h"
            ? box.left > b1.right && box.right < b2.left
            : box.top > b1.bottom && box.bottom < b2.top)
      );

      // Only consider direct neighbors (no elements between them)
      if (hasBetween) continue;

      // Calculate the gap between elements
      const gap = axis === "h" ? b2.left - b1.right : b2.top - b1.bottom;

      // Check if the gap matches the target distance and elements are in the same layout family
      if (
        Math.abs(gap - dist) < 0.5 &&
        crossAxisOverlapRatio(b1, b2, axis) >= 0.01
      ) {
        if (axis === "h") {
          segs.push({
            start: b1.right,
            end: b2.left,
            min: Math.min(b1.top, b2.top),
            max: Math.max(b1.bottom, b2.bottom),
          });
        } else {
          segs.push({
            start: b1.bottom,
            end: b2.top,
            min: Math.min(b1.left, b2.left),
            max: Math.max(b1.right, b2.right),
          });
        }
      }
    }
  }

  return segs;
}

/**
 * SnapGuides that can toggle between showing guides for
 * child elements (with parentId) or top-level elements (no parentId)
 */
const SnapGuides: React.FC = () => {
  // Get active guides from the store
  const activeGuides = useActiveGuides();
  const showChildElements = useShowChildElements();
  const limitToNodes = useLimitToNodes();
  const resizeDirection = useResizeDirection();
  const spacingGuide = useSpacingGuide();

  // Get required state
  const transform = useTransform();
  const isMovingCanvas = useIsMovingCanvas();
  const isDragging = useIsDragging();
  const isResizing = useIsResizing();
  const draggedNode = useDraggedNode();
  const draggedNodes = useDraggedNodes(); // Get all dragged nodes for issue #2
  const dragSource = useDragSource();
  const dragPositions = useDragPositions();
  const getAllNodes = useGetAllNodes();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getSelectedIds = useGetSelectedIds();
  const getNodeStyle = useGetNodeStyle();

  // Get drop info state
  const dropInfo = useDropInfo();
  const hasActiveDropZone = dropInfo && dropInfo.targetId !== null;

  const animationFrameRef = useRef<number | null>(null);
  const snapSetupDoneRef = useRef(false);
  const topmostParentIdRef = useRef<string | number | null>(null);
  const excludedChildrenIdsRef = useRef<Set<string | number>>(new Set());

  // Ref to track if there are active snap points - only show guides when actively snapping
  const hasActiveSnapRef = useRef<boolean>(false);

  const prevDragSourceRef = useRef(dragSource);

  // Track currently dragged node IDs (FIX FOR ISSUE 2)
  const currentDraggedNodeIds = useMemo(() => {
    if (!isDragging || !draggedNodes || draggedNodes.length === 0) return [];
    return draggedNodes.map((node) => node.node.id);
  }, [isDragging, draggedNodes]);

  // Reset the setup flag when drag source changes
  useEffect(() => {
    if (isDragging && prevDragSourceRef.current !== dragSource) {
      console.log(
        `Drag source changed from ${prevDragSourceRef.current} to ${dragSource}, reconfiguring snap guides`
      );
      snapSetupDoneRef.current = false; // Reset the flag to force reconfiguration
      prevDragSourceRef.current = dragSource; // Update the previous value
    }
  }, [isDragging, dragSource]);

  // Local state to store all snap positions when SHOW_ALL_GUIDES is true
  const [allGuides, setAllGuides] = useState<{
    horizontal: number[];
    vertical: number[];
  }>({ horizontal: [], vertical: [] });

  // State for spacing between elements (top-level canvas elements only)
  const [elementSpacings, setElementSpacings] = useState<{
    horizontal: {
      start: number;
      end: number;
      distance: number;
      text: string;
      y: number;
    }[];
    vertical: {
      start: number;
      end: number;
      distance: number;
      text: string;
      x: number;
    }[];
  }>({
    horizontal: [],
    vertical: [],
  });

  /**
   * Get all top-level boxes (elements directly on canvas with no parent)
   * for spacing calculations and snapping
   */
  const getCanvasBoxes = () => {
    try {
      // Get canvas content element
      const contentRef = document.querySelector(
        '.relative[style*="transform-origin"]'
      );
      if (!contentRef) {
        return [];
      }

      // Get content rect to calculate offsets
      const contentRect = contentRef.getBoundingClientRect();

      // Get all node data from store
      const allNodes = getAllNodes();

      // Track nodes being dragged (to exclude from spacing bands)
      const draggedNodeIds =
        isDragging && draggedNodes
          ? draggedNodes.map((node) => node.node.id)
          : [];

      // Collect top-level elements (no parent)
      const topLevelElements: Array<{
        id: string;
        left: number;
        top: number;
        right: number;
        bottom: number;
        centerX: number;
        centerY: number;
        viewportId?: string | number | null;
      }> = [];

      // Get all DOM nodes with data-node-id
      const elements = document.querySelectorAll("[data-node-id]");

      // Process each element to find top-level ones
      elements.forEach((element) => {
        const nodeId = element.getAttribute("data-node-id");
        if (!nodeId) return;

        // Skip if this is one of the dragged nodes (current selection) - FIX FOR ISSUE 2
        if (draggedNodeIds.includes(nodeId)) {
          return;
        }

        // Find node data to check parentId
        const nodeData = allNodes.find((node) => node.id === nodeId);
        if (!nodeData) return;

        // Check if this is a top-level element (no parent)
        const hasParent =
          nodeData.parentId !== null && nodeData.parentId !== undefined;
        if (!hasParent) {
          // Get element's position relative to viewport
          const rect = element.getBoundingClientRect();

          // Convert screen coordinates to canvas coordinates
          const left = (rect.left - contentRect.left) / transform.scale;
          const top = (rect.top - contentRect.top) / transform.scale;
          const right = left + rect.width / transform.scale;
          const bottom = top + rect.height / transform.scale;
          const centerX = left + rect.width / transform.scale / 2;
          const centerY = top + rect.height / transform.scale / 2;

          // Find the viewport ID this element belongs to, if any
          // First, check if the element itself is a viewport
          let viewportId = null;
          const flags = getNodeFlags(nodeId);
          if (flags && flags.isViewport) {
            viewportId = nodeId;
          }

          topLevelElements.push({
            id: nodeId,
            left,
            top,
            right,
            bottom,
            centerX,
            centerY,
            viewportId,
          });
        }
      });

      return topLevelElements;
    } catch (error) {
      console.error("SnapGuides: Error getting canvas boxes", error);
      return [];
    }
  };

  /**
   * Find pairs of elements with equal spacing between them
   */
  const findEqualSpacingPairs = (
    boxes,
    currentViewportId = null,
    nodesToExclude = []
  ) => {
    // Filter out excluded nodes (FIX FOR ISSUE 2)
    const filteredBoxes = boxes.filter(
      (box) => !nodesToExclude.includes(box.id)
    );

    const horizontalPairs: { left: any; right: any; distance: number }[] = [];
    const verticalPairs: { top: any; bottom: any; distance: number }[] = [];

    // Find horizontal equal spacing pairs
    for (let i = 0; i < filteredBoxes.length; i++) {
      for (let j = i + 1; j < filteredBoxes.length; j++) {
        const box1 = filteredBoxes[i];
        const box2 = filteredBoxes[j];

        // If we have a viewport ID, only consider boxes in this viewport
        if (currentViewportId) {
          if (
            box1.viewportId !== currentViewportId ||
            box2.viewportId !== currentViewportId
          ) {
            continue;
          }
        }

        // Only consider elements that are horizontal neighbors
        if (box1.right < box2.left) {
          // Check if there's no element between them
          const hasBetween = filteredBoxes.some(
            (box) =>
              box !== box1 &&
              box !== box2 &&
              box.left > box1.right &&
              box.right < box2.left
          );

          // Only consider elements in the same layout family (with vertical overlap)
          const isInSameFamily = crossAxisOverlapRatio(box1, box2, "h") >= 0.01;

          if (!hasBetween && isInSameFamily) {
            horizontalPairs.push({
              left: box1,
              right: box2,
              distance: box2.left - box1.right,
            });
          }
        } else if (box2.right < box1.left) {
          // Check if there's no element between them
          const hasBetween = filteredBoxes.some(
            (box) =>
              box !== box1 &&
              box !== box2 &&
              box.left > box2.right &&
              box.right < box1.left
          );

          // Only consider elements in the same layout family (with vertical overlap)
          const isInSameFamily = crossAxisOverlapRatio(box1, box2, "h") >= 0.01;

          if (!hasBetween && isInSameFamily) {
            horizontalPairs.push({
              left: box2,
              right: box1,
              distance: box1.left - box2.right,
            });
          }
        }
      }
    }

    // Find vertical equal spacing pairs
    for (let i = 0; i < filteredBoxes.length; i++) {
      for (let j = i + 1; j < filteredBoxes.length; j++) {
        const box1 = filteredBoxes[i];
        const box2 = filteredBoxes[j];

        // If we have a viewport ID, only consider boxes in this viewport
        if (currentViewportId) {
          if (
            box1.viewportId !== currentViewportId ||
            box2.viewportId !== currentViewportId
          ) {
            continue;
          }
        }

        // Only consider elements that are vertical neighbors
        if (box1.bottom < box2.top) {
          // Check if there's no element between them
          const hasBetween = filteredBoxes.some(
            (box) =>
              box !== box1 &&
              box !== box2 &&
              box.top > box1.bottom &&
              box.bottom < box2.top
          );

          // Only consider elements in the same layout family (with horizontal overlap)
          const isInSameFamily = crossAxisOverlapRatio(box1, box2, "v") >= 0.01;

          if (!hasBetween && isInSameFamily) {
            verticalPairs.push({
              top: box1,
              bottom: box2,
              distance: box2.top - box1.bottom,
            });
          }
        } else if (box2.bottom < box1.top) {
          // Check if there's no element between them
          const hasBetween = filteredBoxes.some(
            (box) =>
              box !== box1 &&
              box !== box2 &&
              box.top > box2.bottom &&
              box.bottom < box1.top
          );

          // Only consider elements in the same layout family (with horizontal overlap)
          const isInSameFamily = crossAxisOverlapRatio(box1, box2, "v") >= 0.01;

          if (!hasBetween && isInSameFamily) {
            verticalPairs.push({
              top: box2,
              bottom: box1,
              distance: box1.top - box2.bottom,
            });
          }
        }
      }
    }

    return { horizontalPairs, verticalPairs };
  };

  /**
   * If the dragged box can sit between two canvas-level boxes with the
   * *same* gap on both sides, return the X (or Y) where it has to go and
   * the guide we should draw.  Otherwise return null.
   */
  function getEqualSpacingSnap(
    boxes: ReturnType<typeof getCanvasBoxes>, // all other top-level boxes
    w: number, // dragged width
    h: number, // dragged height
    currentDraggedNodeIds: string[] = [] // IDs of all nodes in the current selection (FIX FOR ISSUE 2)
  ) {
    if (!dragPositions) return null;

    const g = snapOps.getState().snapThreshold / transform.scale;

    const dragLeft =
      dragPositions.x - (draggedNode?.offset.mouseX || 0) / transform.scale;
    const dragTop =
      dragPositions.y - (draggedNode?.offset.mouseY || 0) / transform.scale;
    const dragRight = dragLeft + w;
    const dragBottom = dragTop + h;

    // Helper functions to get dragged element center
    const dragCenterX = () => dragLeft + w / 2;
    const dragCenterY = () => dragTop + h / 2;

    // Find the current viewport this element is interacting with
    let currentViewportId = null;
    if (draggedNode && draggedNode.node) {
      // If the dragged node has a parentId, use that to determine the viewport
      if (draggedNode.node.parentId) {
        // Traverse up to find the topmost parent (viewport)
        let current = draggedNode.node.parentId;
        while (current) {
          const flags = getNodeFlags(current);
          if (flags && flags.isViewport) {
            currentViewportId = current;
            break;
          }
          const parent = getNodeParent(current);
          if (!parent) break;
          current = parent;
        }
      } else {
        // If on canvas (no parent), find the viewport this element interacts with
        // For simplicity, just find the first viewport that contains the element
        for (const box of boxes) {
          const flags = getNodeFlags(box.id);
          if (flags && flags.isViewport) {
            if (
              dragLeft <= box.right &&
              dragRight >= box.left &&
              dragTop <= box.bottom &&
              dragBottom >= box.top
            ) {
              currentViewportId = box.id;
              break;
            }
          }
        }
      }
    }

    /* ---------- HORIZONTAL ---------- */
    let bestH: null | { x: number; pos1: number; pos2: number; d: number } =
      null;

    boxes.forEach((b1) => {
      // Skip if this box is part of the current drag selection (FIX FOR ISSUE 2)
      if (currentDraggedNodeIds.includes(b1.id)) return;

      // If we have a viewport ID, only consider boxes in this viewport
      if (currentViewportId && b1.viewportId !== currentViewportId) {
        return;
      }

      // neighbour must overlap vertically with dragged elm
      if (!rangesOverlap(b1.top, b1.bottom, dragTop, dragBottom)) return;

      boxes.forEach((b2) => {
        // Skip if this box is part of the current drag selection (FIX FOR ISSUE 2)
        if (currentDraggedNodeIds.includes(b2.id)) return;

        // If we have a viewport ID, only consider boxes in this viewport
        if (currentViewportId && b2.viewportId !== currentViewportId) {
          return;
        }

        if (b2.left <= b1.right) return; // keep left-to-right order
        if (!rangesOverlap(b2.top, b2.bottom, dragTop, dragBottom)) return;

        // Check if in same layout family
        if (crossAxisOverlapRatio(b1, b2, "h") < 0.01) return;

        const total = b2.left - b1.right; // free space
        if (total <= w) return; // not enough room

        const gap = (total - w) / 2; // candidate equal gap
        const target = b1.right + gap; // where dragged box starts
        const delta = Math.abs(target - dragLeft);

        // Locality: ignore candidates that are far off-screen
        if (!withinViewport((b1.right + b2.left) / 2, dragCenterX())) return;

        if (delta <= g && (!bestH || delta < bestH.d)) {
          bestH = { x: target, pos1: b1.right, pos2: b2.left, d: delta };
        }
      });
    });

    if (bestH) {
      /* --- add a temporary representation of the dragged element --- */
      const tempBox = {
        id: "temp",
        left: bestH.x,
        right: bestH.x + w,
        top: dragTop,
        bottom: dragBottom,
        centerX: bestH.x + w / 2,
        centerY: dragTop + h / 2,
        viewportId: currentViewportId,
      };

      /* --- collect only the segments that overlap vertically with the
      dragged element; this shows the whole "family" but not
      unrelated rows further up / down the canvas */
      const segs = collectEqualGaps(
        [...boxes, tempBox],
        bestH.pos2 - bestH.pos1,
        "h",
        currentViewportId,
        currentDraggedNodeIds // FIX FOR ISSUE 2: Pass dragged nodes to exclude
      ).filter((s) => rangesOverlap(s.min, s.max, dragTop, dragBottom));

      return {
        axis: "h" as const,
        snap: { position: bestH.x, distance: 0, edge: "left" },
        guide: { axis: "h", distance: bestH.pos2 - bestH.pos1, segments: segs },
      };
    }

    /* ---------- VERTICAL ---------- */
    let bestV: null | { y: number; pos1: number; pos2: number; d: number } =
      null;

    boxes.forEach((b1) => {
      // Skip if this box is part of the current drag selection (FIX FOR ISSUE 2)
      if (currentDraggedNodeIds.includes(b1.id)) return;

      // If we have a viewport ID, only consider boxes in this viewport
      if (currentViewportId && b1.viewportId !== currentViewportId) {
        return;
      }

      if (!rangesOverlap(b1.left, b1.right, dragLeft, dragRight)) return;

      boxes.forEach((b2) => {
        // Skip if this box is part of the current drag selection (FIX FOR ISSUE 2)
        if (currentDraggedNodeIds.includes(b2.id)) return;

        // If we have a viewport ID, only consider boxes in this viewport
        if (currentViewportId && b2.viewportId !== currentViewportId) {
          return;
        }

        if (b2.top <= b1.bottom) return;
        if (!rangesOverlap(b2.left, b2.right, dragLeft, dragRight)) return;

        // Check if in same layout family
        if (crossAxisOverlapRatio(b1, b2, "v") < 0.01) return;

        const total = b2.top - b1.bottom;
        if (total <= h) return;

        const gap = (total - h) / 2;
        const target = b1.bottom + gap;
        const delta = Math.abs(target - dragTop);

        if (!withinViewport((b1.bottom + b2.top) / 2, dragCenterY())) return;

        if (delta <= g && (!bestV || delta < bestV.d)) {
          bestV = { y: target, pos1: b1.bottom, pos2: b2.top, d: delta };
        }
      });
    });

    if (bestV) {
      const tempBox = {
        id: "temp",
        left: dragLeft,
        right: dragRight,
        top: bestV.y,
        bottom: bestV.y + h,
        centerX: dragLeft + w / 2,
        centerY: bestV.y + h / 2,
        viewportId: currentViewportId,
      };

      const segs = collectEqualGaps(
        [...boxes, tempBox],
        bestV.pos2 - bestV.pos1,
        "v",
        currentViewportId,
        currentDraggedNodeIds // FIX FOR ISSUE 2: Pass dragged nodes to exclude
      ).filter((s) => rangesOverlap(s.min, s.max, dragLeft, dragRight));

      return {
        axis: "v" as const,
        snap: { position: bestV.y, distance: 0, edge: "top" },
        guide: { axis: "v", distance: bestV.pos2 - bestV.pos1, segments: segs },
      };
    }

    // Case 2: Snap to create equal spacing to the left or right of existing pairs
    const { horizontalPairs, verticalPairs } = findEqualSpacingPairs(
      boxes,
      currentViewportId,
      currentDraggedNodeIds // FIX FOR ISSUE 2: Pass dragged nodes to exclude
    );

    // Check horizontal pairs for left/right snapping (with additional checks)
    for (const pair of horizontalPairs) {
      const spacing = pair.distance;

      // Skip if the spacing pair doesn't overlap vertically with dragged element
      if (
        !rangesOverlap(pair.left.top, pair.left.bottom, dragTop, dragBottom) ||
        !rangesOverlap(pair.right.top, pair.right.bottom, dragTop, dragBottom)
      ) {
        continue;
      }

      // Check if we can snap to the left of the leftmost element with the same spacing
      if (dragRight < pair.left.left) {
        const targetLeft = pair.left.left - spacing - w;
        const delta = Math.abs(targetLeft - dragLeft);

        // Locality check
        if (
          !withinViewport((targetLeft + w + pair.left.left) / 2, dragCenterX())
        )
          continue;

        if (delta <= g && (!bestH || delta < bestH.d)) {
          bestH = {
            x: targetLeft,
            pos1: targetLeft + w,
            pos2: pair.left.left,
            d: delta,
          };

          // Create a temporary box for the dragged node in its new position
          const tempBox = {
            id: "temp",
            left: targetLeft,
            right: targetLeft + w,
            top: dragTop,
            bottom: dragBottom,
            centerX: targetLeft + w / 2,
            centerY: dragTop + h / 2,
            viewportId: currentViewportId,
          };

          return {
            axis: "h" as const,
            snap: { position: targetLeft, distance: 0, edge: "left" },
            guide: {
              axis: "h",
              distance: spacing,
              segments: collectEqualGaps(
                [...boxes, tempBox],
                spacing,
                "h",
                currentViewportId,
                currentDraggedNodeIds // FIX FOR ISSUE 2: Pass dragged nodes to exclude
              ),
            },
          };
        }
      }

      // Check if we can snap to the right of the rightmost element with the same spacing
      if (dragLeft > pair.right.right) {
        const targetLeft = pair.right.right + spacing;
        const delta = Math.abs(targetLeft - dragLeft);

        // Locality check
        if (!withinViewport((pair.right.right + targetLeft) / 2, dragCenterX()))
          continue;

        if (delta <= g && (!bestH || delta < bestH.d)) {
          bestH = {
            x: targetLeft,
            pos1: pair.right.right,
            pos2: targetLeft,
            d: delta,
          };

          // Create a temporary box for the dragged node in its new position
          const tempBox = {
            id: "temp",
            left: targetLeft,
            right: targetLeft + w,
            top: dragTop,
            bottom: dragBottom,
            centerX: targetLeft + w / 2,
            centerY: dragTop + h / 2,
            viewportId: currentViewportId,
          };

          return {
            axis: "h" as const,
            snap: { position: targetLeft, distance: 0, edge: "left" },
            guide: {
              axis: "h",
              distance: spacing,
              segments: collectEqualGaps(
                [...boxes, tempBox],
                spacing,
                "h",
                currentViewportId,
                currentDraggedNodeIds // FIX FOR ISSUE 2: Pass dragged nodes to exclude
              ),
            },
          };
        }
      }
    }

    // Check vertical pairs for top/bottom snapping (with additional checks)
    for (const pair of verticalPairs) {
      const spacing = pair.distance;

      // Skip if the spacing pair doesn't overlap horizontally with dragged element
      if (
        !rangesOverlap(pair.top.left, pair.top.right, dragLeft, dragRight) ||
        !rangesOverlap(pair.bottom.left, pair.bottom.right, dragLeft, dragRight)
      ) {
        continue;
      }

      // Check if we can snap above the top element with the same spacing
      if (dragBottom < pair.top.top) {
        const targetTop = pair.top.top - spacing - h;
        const delta = Math.abs(targetTop - dragTop);

        // Locality check
        if (!withinViewport((targetTop + h + pair.top.top) / 2, dragCenterY()))
          continue;

        if (delta <= g && (!bestV || delta < bestV.d)) {
          bestV = {
            y: targetTop,
            pos1: targetTop + h,
            pos2: pair.top.top,
            d: delta,
          };

          // Create a temporary box for the dragged node in its new position
          const tempBox = {
            id: "temp",
            left: dragLeft,
            right: dragRight,
            top: targetTop,
            bottom: targetTop + h,
            centerX: dragLeft + w / 2,
            centerY: targetTop + h / 2,
            viewportId: currentViewportId,
          };

          return {
            axis: "v" as const,
            snap: { position: targetTop, distance: 0, edge: "top" },
            guide: {
              axis: "v",
              distance: spacing,
              segments: collectEqualGaps(
                [...boxes, tempBox],
                spacing,
                "v",
                currentViewportId,
                currentDraggedNodeIds // FIX FOR ISSUE 2: Pass dragged nodes to exclude
              ),
            },
          };
        }
      }

      // Check if we can snap below the bottom element with the same spacing
      if (dragTop > pair.bottom.bottom) {
        const targetTop = pair.bottom.bottom + spacing;
        const delta = Math.abs(targetTop - dragTop);

        // Locality check
        if (
          !withinViewport((pair.bottom.bottom + targetTop) / 2, dragCenterY())
        )
          continue;

        if (delta <= g && (!bestV || delta < bestV.d)) {
          bestV = {
            y: targetTop,
            pos1: pair.bottom.bottom,
            pos2: targetTop,
            d: delta,
          };

          // Create a temporary box for the dragged node in its new position
          const tempBox = {
            id: "temp",
            left: dragLeft,
            right: dragRight,
            top: targetTop,
            bottom: targetTop + h,
            centerX: dragLeft + w / 2,
            centerY: targetTop + h / 2,
            viewportId: currentViewportId,
          };

          return {
            axis: "v" as const,
            snap: { position: targetTop, distance: 0, edge: "top" },
            guide: {
              axis: "v",
              distance: spacing,
              segments: collectEqualGaps(
                [...boxes, tempBox],
                spacing,
                "v",
                currentViewportId,
                currentDraggedNodeIds // FIX FOR ISSUE 2: Pass dragged nodes to exclude
              ),
            },
          };
        }
      }
    }

    return null;
  }

  // Helper function to find the topmost parent (e.g., viewport) of a node
  const findTopmostParent = (
    nodeId: string | number
  ): string | number | null => {
    let currentId = nodeId;
    let currentParentId = getNodeParent(currentId);
    let topmostParentId = currentParentId;

    // Track the hierarchy to find the topmost parent or viewport
    while (currentParentId) {
      topmostParentId = currentParentId;

      // If we found a viewport, stop immediately
      const flags = getNodeFlags(currentParentId);
      if (flags && flags.isViewport) {
        return currentParentId;
      }

      // Move up the tree
      currentId = currentParentId;
      currentParentId = getNodeParent(currentId);
    }

    return topmostParentId;
  };

  // Helper function to collect all child IDs recursively
  const collectAllChildren = (
    nodeId: string | number,
    result: Set<string | number>
  ) => {
    const children = getNodeChildren(nodeId);

    // Add each child to the result set
    children.forEach((childId) => {
      result.add(childId);
      // Recursively collect children of this child
      collectAllChildren(childId, result);
    });

    return result;
  };

  // Helper function to configure snap guides for absolute-in-frame elements
  const configureSnapGuidesForAbsoluteInFrame = (nodeId: string | number) => {
    // Find the topmost parent (usually a viewport)
    const topmostParentId = findTopmostParent(nodeId);

    // Store it in ref for later use
    topmostParentIdRef.current = topmostParentId;

    if (!topmostParentId) return;

    // Get all nodes
    const allNodes = getAllNodes();

    // Function to check if a node is within the hierarchy of the topmost parent
    const isInHierarchy = (nodeToCheck: any) => {
      let current = nodeToCheck.id;

      while (current) {
        if (current === topmostParentId) {
          return true;
        }
        const parent = getNodeParent(current);
        if (!parent) break;
        current = parent;
      }

      return false;
    };

    // Collect all children of the dragged node that should be excluded from snapping
    const childrenToExclude = new Set<string | number>();
    collectAllChildren(nodeId, childrenToExclude);
    excludedChildrenIdsRef.current = childrenToExclude;

    // Filter nodes to only those within the same hierarchy AND not children of dragged node
    const nodesInSameHierarchy = allNodes.filter(
      (node) =>
        node.id !== nodeId && // Exclude the dragged node itself
        !childrenToExclude.has(node.id) && // Exclude children of dragged node
        (node.id === topmostParentId || isInHierarchy(node)) // Include topmost parent and nodes in hierarchy
    );

    // Extract node IDs that should be used for snap guides
    const hierarchyNodeIds = nodesInSameHierarchy.map((node) => node.id);

    // Set the snap guides configuration to use child elements
    snapOps.setShowChildElements(true);

    // Crucial fix: Explicitly limit snap guides to only nodes in the same hierarchy
    snapOps.setLimitToNodes(hierarchyNodeIds);

    return hierarchyNodeIds;
  };

  // Helper function to configure snap guides for resize operations
  const configureSnapGuidesForResizing = (resizeDirection = "") => {
    // Get selected nodes that are being resized
    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) return;

    // Find the first selected node to determine parent/hierarchy
    const firstNodeId = selectedIds[0];

    // Get style of the first selected node
    const nodeStyle = getNodeStyle(firstNodeId);

    // Only configure snap guides for absolute positioned elements
    const isAbsolutePositioned =
      nodeStyle.position === "absolute" ||
      nodeStyle.isFakeFixed === "true" ||
      nodeStyle.isAbsoluteInFrame === "true";

    if (!isAbsolutePositioned) {
      // For non-absolute elements, disable snap guides during resize
      snapOps.setLimitToNodes([]);
      snapOps.setShowChildElements(false);
      topmostParentIdRef.current = null;
      excludedChildrenIdsRef.current.clear();
      return;
    }

    const parentId = getNodeParent(firstNodeId);

    if (!parentId) {
      // For canvas elements, show guides only for top-level elements
      snapOps.setShowChildElements(false);
      snapOps.setLimitToNodes(null);
      topmostParentIdRef.current = null;
      excludedChildrenIdsRef.current.clear();
      return;
    }

    // For elements in a parent, find topmost parent (usually a viewport)
    const topmostParentId = findTopmostParent(firstNodeId);

    // Store for later use
    topmostParentIdRef.current = topmostParentId;

    if (!topmostParentId) return;

    // Get all nodes
    const allNodes = getAllNodes();

    // Function to check if a node is within the hierarchy of the topmost parent
    const isInHierarchy = (nodeToCheck: any) => {
      let current = nodeToCheck.id;

      while (current) {
        if (current === topmostParentId) {
          return true;
        }
        const parent = getNodeParent(current);
        if (!parent) break;
        current = parent;
      }

      return false;
    };

    // Collect all children of selected nodes that should be excluded from snapping
    const childrenToExclude = new Set<string | number>();
    selectedIds.forEach((id) => {
      collectAllChildren(id, childrenToExclude);
    });

    // Also exclude the selected nodes themselves
    selectedIds.forEach((id) => {
      childrenToExclude.add(id);
    });

    excludedChildrenIdsRef.current = childrenToExclude;

    // Filter nodes to only those within the same hierarchy AND not children of selected nodes
    const nodesInSameHierarchy = allNodes.filter(
      (node) =>
        !childrenToExclude.has(node.id) && // Exclude selected nodes and their children
        (node.id === topmostParentId || isInHierarchy(node)) // Include topmost parent and nodes in hierarchy
    );

    // Extract node IDs that should be used for snap guides
    const hierarchyNodeIds = nodesInSameHierarchy.map((node) => node.id);

    // Set the snap guides configuration to use child elements
    snapOps.setShowChildElements(true);

    // Limit snap guides to only nodes in the same hierarchy
    snapOps.setLimitToNodes(hierarchyNodeIds);

    return hierarchyNodeIds;
  };

  // Helper to determine which edges to check based on resize direction
  const getActiveEdgesForDirection = (direction) => {
    let edges = {
      horizontal: ["top", "center", "bottom"],
      vertical: ["left", "center", "right"],
    };

    // Filter edges based on direction
    switch (direction) {
      case "left":
        edges.horizontal = [];
        edges.vertical = ["left"];
        break;
      case "right":
        edges.horizontal = [];
        edges.vertical = ["right"];
        break;
      case "top":
        edges.horizontal = ["top"];
        edges.vertical = [];
        break;
      case "bottom":
        edges.horizontal = ["bottom"];
        edges.vertical = [];
        break;
      case "topLeft":
        edges.horizontal = ["top"];
        edges.vertical = ["left"];
        break;
      case "topRight":
        edges.horizontal = ["top"];
        edges.vertical = ["right"];
        break;
      case "bottomLeft":
        edges.horizontal = ["bottom"];
        edges.vertical = ["left"];
        break;
      case "bottomRight":
        edges.horizontal = ["bottom"];
        edges.vertical = ["right"];
        break;
      // Default keeps all edges
    }

    return edges;
  };

  // Detect changes in drag/resize state to configure snap guides
  useEffect(() => {
    // If dragging and setup not done yet, configure snap guides based on drag source
    if (isDragging && draggedNode && !snapSetupDoneRef.current) {
      if (dragSource === "absolute-in-frame") {
        // For absolute-in-frame, show guides for elements in the same hierarchy
        configureSnapGuidesForAbsoluteInFrame(draggedNode.node.id);
      } else if (dragSource === "canvas") {
        // For canvas elements, show guides only for top-level elements
        snapOps.setShowChildElements(false);
        snapOps.setLimitToNodes(null);
        topmostParentIdRef.current = null;
        excludedChildrenIdsRef.current.clear();
      }

      snapSetupDoneRef.current = true;
    }
    // If resizing and setup not done yet, configure snap guides for resizing
    else if (isResizing && !isDragging && !snapSetupDoneRef.current) {
      configureSnapGuidesForResizing(resizeDirection);
      snapSetupDoneRef.current = true;
    }

    // When operations end, reset snap configuration
    if (!isDragging && !isResizing && snapSetupDoneRef.current) {
      snapOps.setLimitToNodes(null);
      snapOps.setShowChildElements(false);
      snapOps.resetGuides();
      snapOps.setSpacingGuide(null);
      snapSetupDoneRef.current = false;
      topmostParentIdRef.current = null;
      excludedChildrenIdsRef.current.clear();
      hasActiveSnapRef.current = false;
    }
  }, [
    isDragging,
    isResizing,
    draggedNode,
    dragSource,
    getSelectedIds,
    resizeDirection,
  ]);

  // Calculate all possible snap positions
  useEffect(() => {
    const calculateSnapPositions = () => {
      try {
        // Get canvas content element
        const contentRef = document.querySelector(
          '.relative[style*="transform-origin"]'
        );
        if (!contentRef) {
          console.error("SnapGuides: contentRef not found");
          return;
        }

        // Get content rect to calculate offsets
        const contentRect = contentRef.getBoundingClientRect();

        // Get all DOM nodes with data-node-id
        const elements = document.querySelectorAll("[data-node-id]");

        // Get all node data from store
        const allNodes = getAllNodes();

        const horizontalPositions: number[] = [];
        const verticalPositions: number[] = [];

        // For spacing calculation, collect top-level elements (no parent)
        const topLevelElements: Array<{
          id: string;
          left: number;
          top: number;
          right: number;
          bottom: number;
          centerX: number;
          centerY: number;
          viewportId?: string | number | null;
        }> = [];

        // Process each element to extract snap positions
        elements.forEach((element) => {
          const nodeId = element.getAttribute("data-node-id");
          if (!nodeId) return;

          // Skip if this is part of the dragged selection (FIX FOR ISSUE 2)
          if (currentDraggedNodeIds.includes(nodeId)) {
            return;
          }

          // Skip if this is being resized (in selected nodes)
          if (isResizing && getSelectedIds().includes(nodeId)) {
            return;
          }

          // Skip if this is a child of a node being dragged or resized
          if (excludedChildrenIdsRef.current.has(nodeId)) {
            return;
          }

          // Special case: include the topmost parent if it exists
          const isTopmostParent = nodeId === topmostParentIdRef.current;

          // Skip if we're limiting to specific nodes and this one isn't included
          // Unless it's the topmost parent which we always want to include
          if (
            limitToNodes &&
            !isTopmostParent &&
            !limitToNodes.includes(nodeId)
          ) {
            return;
          }

          // Find node data to check parentId
          const nodeData = allNodes.find((node) => node.id === nodeId);
          if (!nodeData) return;

          // Get element's position relative to viewport
          const rect = element.getBoundingClientRect();

          // Convert screen coordinates to canvas coordinates
          const left = (rect.left - contentRect.left) / transform.scale;
          const top = (rect.top - contentRect.top) / transform.scale;
          const right = left + rect.width / transform.scale;
          const bottom = top + rect.height / transform.scale;
          const centerX = left + rect.width / transform.scale / 2;
          const centerY = top + rect.height / transform.scale / 2;

          // Determine if this element is a viewport or within one
          let viewportId = null;
          const flags = getNodeFlags(nodeId);
          if (flags && flags.isViewport) {
            viewportId = nodeId;
          } else {
            // Check if this element is within a viewport
            let current = nodeData.parentId;
            while (current) {
              const parentFlags = getNodeFlags(current);
              if (parentFlags && parentFlags.isViewport) {
                viewportId = current;
                break;
              }
              const parent = getNodeParent(current);
              if (!parent) break;
              current = parent;
            }
          }

          // Check if this is a top-level element (no parent) for spacing calculation
          const hasParent =
            nodeData.parentId !== null && nodeData.parentId !== undefined;
          if (!hasParent && SHOW_SPACING) {
            topLevelElements.push({
              id: nodeId,
              left,
              top,
              right,
              bottom,
              centerX,
              centerY,
              viewportId,
            });
          }

          // Skip based on showChildElements setting from store
          // But always include the topmost parent
          if (nodeData && !isTopmostParent) {
            const hasParent =
              nodeData.parentId !== null && nodeData.parentId !== undefined;

            if (showChildElements) {
              // Skip nodes that DON'T have a parent when showing child elements
              if (!hasParent) {
                return;
              }
            } else {
              // Skip nodes that DO have a parent when showing top-level elements
              if (hasParent) {
                return;
              }
            }
          }

          // Add horizontal snap positions
          horizontalPositions.push(top);
          horizontalPositions.push(centerY);
          horizontalPositions.push(bottom);

          // Add vertical snap positions
          verticalPositions.push(left);
          verticalPositions.push(centerX);
          verticalPositions.push(right);
        });

        // Filter out any invalid values
        const validHorizontal = horizontalPositions.filter(
          (pos) => !isNaN(pos) && pos !== undefined
        );
        const validVertical = verticalPositions.filter(
          (pos) => !isNaN(pos) && pos !== undefined
        );

        // Update the snap positions in the store
        snapOps.setAllSnapPositions({
          horizontal: validHorizontal,
          vertical: validVertical,
        });

        // Set all guides if SHOW_ALL_GUIDES is true
        if (SHOW_ALL_GUIDES) {
          setAllGuides({
            horizontal: validHorizontal,
            vertical: validVertical,
          });
        }

        // Calculate spacing between top-level elements if SHOW_SPACING is enabled
        if (SHOW_SPACING) {
          // First filter out any elements that are part of the current drag (FIX FOR ISSUE 2)
          const filteredTopLevelElements = topLevelElements.filter(
            (elem) => !currentDraggedNodeIds.includes(elem.id)
          );

          // Sort elements by position for easier spacing calculation
          const sortedHorizontal = [...filteredTopLevelElements].sort(
            (a, b) => a.left - b.left
          );
          const sortedVertical = [...filteredTopLevelElements].sort(
            (a, b) => a.top - b.top
          );

          // Calculate horizontal spacings (elements side by side)
          const horizontalSpacings: {
            start: number;
            end: number;
            distance: number;
            text: string;
            y: number;
          }[] = [];

          // Compare each element with all others to ensure we catch all spacings
          for (let i = 0; i < sortedHorizontal.length; i++) {
            for (let j = 0; j < sortedHorizontal.length; j++) {
              if (i === j) continue; // Skip comparing element with itself

              const elem1 = sortedHorizontal[i];
              const elem2 = sortedHorizontal[j];

              // Only compare elements in the same viewport
              if (
                elem1.viewportId &&
                elem2.viewportId &&
                elem1.viewportId !== elem2.viewportId
              ) {
                continue;
              }

              // Only process if elem2 is to the right of elem1
              if (elem2.left <= elem1.right) continue;

              // Check if there's no other element between these two
              const hasElementBetween = sortedHorizontal.some(
                (other) =>
                  other.id !== elem1.id &&
                  other.id !== elem2.id &&
                  other.left > elem1.right &&
                  other.right < elem2.left
              );

              if (!hasElementBetween) {
                // Only show spacing if elements are in the same layout family
                const verticalOverlap =
                  crossAxisOverlapRatio(elem1, elem2, "h") >= 0.01;

                if (verticalOverlap) {
                  const distance = Math.round(elem2.left - elem1.right);
                  if (distance > 0) {
                    // Only show positive distances
                    // Check if this spacing already exists
                    const exists = horizontalSpacings.some(
                      (s) => s.start === elem1.right && s.end === elem2.left
                    );

                    if (!exists) {
                      // Calculate the vertical position for the spacing indicator - use the average of the overlapping region
                      const overlapTop = Math.max(elem1.top, elem2.top);
                      const overlapBottom = Math.min(
                        elem1.bottom,
                        elem2.bottom
                      );
                      const y = (overlapTop + overlapBottom) / 2;

                      horizontalSpacings.push({
                        start: elem1.right,
                        end: elem2.left,
                        distance,
                        text: `${distance}px`,
                        y,
                      });
                    }
                  }
                }
              }
            }
          }

          // Calculate vertical spacings (elements stacked)
          const verticalSpacings: {
            start: number;
            end: number;
            distance: number;
            text: string;
            x: number;
          }[] = [];

          // Similar approach for vertical spacing
          for (let i = 0; i < sortedVertical.length; i++) {
            for (let j = 0; j < sortedVertical.length; j++) {
              if (i === j) continue; // Skip comparing element with itself

              const elem1 = sortedVertical[i];
              const elem2 = sortedVertical[j];

              // Only compare elements in the same viewport
              if (
                elem1.viewportId &&
                elem2.viewportId &&
                elem1.viewportId !== elem2.viewportId
              ) {
                continue;
              }

              // Only process if elem2 is below elem1
              if (elem2.top <= elem1.bottom) continue;

              // Check if there's no other element between these two
              const hasElementBetween = sortedVertical.some(
                (other) =>
                  other.id !== elem1.id &&
                  other.id !== elem2.id &&
                  other.top > elem1.bottom &&
                  other.bottom < elem2.top
              );

              if (!hasElementBetween) {
                // Only show spacing if elements are in the same layout family
                const horizontalOverlap =
                  crossAxisOverlapRatio(elem1, elem2, "v") >= 0.01;

                if (horizontalOverlap) {
                  const distance = Math.round(elem2.top - elem1.bottom);
                  if (distance > 0) {
                    // Only show positive distances
                    // Check if this spacing already exists
                    const exists = verticalSpacings.some(
                      (s) => s.start === elem1.bottom && s.end === elem2.top
                    );

                    if (!exists) {
                      // Calculate the horizontal position for the spacing indicator - use the average of the overlapping region
                      const overlapLeft = Math.max(elem1.left, elem2.left);
                      const overlapRight = Math.min(elem1.right, elem2.right);
                      const x = (overlapLeft + overlapRight) / 2;

                      verticalSpacings.push({
                        start: elem1.bottom,
                        end: elem2.top,
                        distance,
                        text: `${distance}px`,
                        x,
                      });
                    }
                  }
                }
              }
            }
          }

          // Update spacing state
          setElementSpacings({
            horizontal: horizontalSpacings,
            vertical: verticalSpacings,
          });
        }
      } catch (error) {
        console.error("SnapGuides: Error calculating snap positions", error);
      }
    };

    // Calculate initial snap positions
    calculateSnapPositions();

    // Recalculate on resize
    window.addEventListener("resize", calculateSnapPositions);

    return () => {
      window.removeEventListener("resize", calculateSnapPositions);
    };
  }, [
    transform,
    draggedNode,
    getAllNodes,
    showChildElements,
    limitToNodes,
    isResizing,
    getSelectedIds,
    currentDraggedNodeIds, // FIX FOR ISSUE 2: React to changes in dragged nodes
  ]);

  // Check for alignment during canvas dragging or resizing
  useEffect(() => {
    // If SHOW_ALL_GUIDES is true, we don't need this effect
    if (SHOW_ALL_GUIDES) return;

    // Clear active snap points when not in an active operation
    if (
      (!isDragging && !isResizing) ||
      (isDragging && !draggedNode) ||
      (!dragPositions && isDragging) ||
      isMovingCanvas ||
      (isDragging &&
        dragSource !== "canvas" &&
        dragSource !== "absolute-in-frame") ||
      hasActiveDropZone // Skip snap guides when a drop zone is active
    ) {
      // Reset active guides and snap points in the store
      snapOps.resetGuides();
      hasActiveSnapRef.current = false;
      return;
    }

    // Skip if the dragged node's parent status doesn't match what we want to show
    // Only check this for canvas elements during dragging, not for absolute-in-frame elements or resizing
    if (isDragging && dragSource === "canvas") {
      const hasParent =
        draggedNode.node.parentId !== null &&
        draggedNode.node.parentId !== undefined;

      if (showChildElements ? !hasParent : hasParent) {
        snapOps.resetGuides();
        hasActiveSnapRef.current = false;
        return;
      }
    }

    // Get current state from store
    const snapGuidesState = snapOps.getState();
    const snapThreshold = snapGuidesState.snapThreshold / transform.scale;
    const allSnapPositions = snapGuidesState.allSnapPositions;

    const checkForAlignment = () => {
      try {
        // Check again inside animation frame if drop zone has been activated
        if (hasActiveDropZone) {
          snapOps.resetGuides();
          hasActiveSnapRef.current = false;
          return;
        }

        // Get current waitForResizeMove directly from store
        const { waitForResizeMove } = snapOps.getState();
        if (isResizing && waitForResizeMove) {
          // Still on the very first frame – no guides yet
          snapOps.resetGuides();
          hasActiveSnapRef.current = false;
          animationFrameRef.current = requestAnimationFrame(checkForAlignment);
          return;
        }

        const newActiveGuides: {
          horizontal: number[];
          vertical: number[];
        } = {
          horizontal: [],
          vertical: [],
        };

        // For storing the best snap points
        let closestHorizontal: {
          position: number;
          distance: number;
          edge: string;
        } | null = null;
        let closestVertical: {
          position: number;
          distance: number;
          edge: string;
        } | null = null;

        // Handle different cases based on operation
        if (isResizing && !isDragging) {
          // RESIZING CASE: Check selected elements being resized
          const selectedIds = getSelectedIds();
          const contentRef = document.querySelector(
            '.relative[style*="transform-origin"]'
          );

          if (!contentRef) return;
          const contentRect = contentRef.getBoundingClientRect();

          // Get the current resize direction from store
          const { resizeDirection } = snapOps.getState();

          // Get the active edges based on resize direction
          const activeEdges = getActiveEdgesForDirection(resizeDirection);

          // Only process elements with position: absolute
          const absolutePositionedIds = selectedIds.filter((id) => {
            const style = getNodeStyle(id);
            return (
              style.position === "absolute" ||
              style.isFakeFixed === "true" ||
              style.isAbsoluteInFrame === "true"
            );
          });

          if (absolutePositionedIds.length === 0) {
            // No absolute elements being resized, reset guides
            snapOps.resetGuides();
            hasActiveSnapRef.current = false;
            return;
          }

          // Track if any element is snapping
          let isSnapping = false;

          // Process each selected absolutely positioned element to find snap positions
          absolutePositionedIds.forEach((id) => {
            const element = document.querySelector(`[data-node-id="${id}"]`);
            if (!element) return;

            // Get element's position relative to canvas
            const rect = element.getBoundingClientRect();

            // Convert screen coordinates to canvas coordinates
            const left = (rect.left - contentRect.left) / transform.scale;
            const top = (rect.top - contentRect.top) / transform.scale;
            const right = left + rect.width / transform.scale;
            const bottom = top + rect.height / transform.scale;
            const centerX = left + rect.width / transform.scale / 2;
            const centerY = top + rect.height / transform.scale / 2;

            // Build edges based on the active edges for the current resize direction
            const edges = {
              horizontal: [],
              vertical: [],
            };

            // Only include edges that are relevant to the current resize operation
            if (activeEdges.horizontal.includes("top")) {
              edges.horizontal.push({ name: "top", position: top });
            }
            if (activeEdges.horizontal.includes("center")) {
              edges.horizontal.push({ name: "center", position: centerY });
            }
            if (activeEdges.horizontal.includes("bottom")) {
              edges.horizontal.push({ name: "bottom", position: bottom });
            }

            if (activeEdges.vertical.includes("left")) {
              edges.vertical.push({ name: "left", position: left });
            }
            if (activeEdges.vertical.includes("center")) {
              edges.vertical.push({ name: "center", position: centerX });
            }
            if (activeEdges.vertical.includes("right")) {
              edges.vertical.push({ name: "right", position: right });
            }

            // Check horizontal edges against all snap positions
            edges.horizontal.forEach((edge) => {
              allSnapPositions.horizontal.forEach((snapPos) => {
                const distance = Math.abs(edge.position - snapPos);
                if (distance <= snapThreshold) {
                  isSnapping = true;
                  // Add to active guides - only the one that's closest
                  if (
                    !closestHorizontal ||
                    distance < closestHorizontal.distance
                  ) {
                    // Clear previous horizontal guides if this is closer
                    newActiveGuides.horizontal = [snapPos];

                    closestHorizontal = {
                      position: snapPos,
                      distance: distance,
                      edge: edge.name,
                    };
                  } else if (
                    closestHorizontal &&
                    distance === closestHorizontal.distance
                  ) {
                    // If same distance, add this guide too
                    newActiveGuides.horizontal.push(snapPos);
                  }
                }
              });
            });

            // Check vertical edges against all snap positions
            edges.vertical.forEach((edge) => {
              allSnapPositions.vertical.forEach((snapPos) => {
                const distance = Math.abs(edge.position - snapPos);
                if (distance <= snapThreshold) {
                  isSnapping = true;
                  // Add to active guides - only the one that's closest
                  if (!closestVertical || distance < closestVertical.distance) {
                    // Clear previous vertical guides if this is closer
                    newActiveGuides.vertical = [snapPos];

                    closestVertical = {
                      position: snapPos,
                      distance: distance,
                      edge: edge.name,
                    };
                  } else if (
                    closestVertical &&
                    distance === closestVertical.distance
                  ) {
                    // If same distance, add this guide too
                    newActiveGuides.vertical.push(snapPos);
                  }
                }
              });
            });
          });

          // Update the active snap state
          hasActiveSnapRef.current = isSnapping;

          // If no snapping is occurring, don't show any guides
          if (!isSnapping) {
            snapOps.resetGuides();
          }
        } else if (isDragging && draggedNode) {
          // DRAGGING CASE: From original code
          // Extract dimensions from draggedNode
          const { style } = draggedNode.node;
          let width = 100; // Default
          let height = 100; // Default

          // Get width from style
          if (typeof style.width === "string" && style.width.includes("px")) {
            width = parseFloat(style.width);
          } else if (typeof style.width === "number") {
            width = style.width;
          }

          // Get height from style
          if (typeof style.height === "string" && style.height.includes("px")) {
            height = parseFloat(style.height);
          } else if (typeof style.height === "number") {
            height = style.height;
          }

          //------------------------------------------------------------------
          //  BEFORE you build `edges`, *and* BEFORE const-binding dragLeft / dragTop
          //------------------------------------------------------------------
          let dragLeft =
            dragPositions.x - draggedNode.offset.mouseX / transform.scale;
          let dragTop =
            dragPositions.y - draggedNode.offset.mouseY / transform.scale;
          let spacingSnap = null;

          if (dragSource === "canvas" && !draggedNode.node.parentId) {
            const boxes = getCanvasBoxes();
            // Pass currentDraggedNodeIds to exclude from spacing calculations (FIX FOR ISSUE 2)
            const snap = getEqualSpacingSnap(
              boxes,
              width,
              height,
              currentDraggedNodeIds
            );

            if (snap) {
              spacingSnap = snap;
              if (snap.axis === "h") dragLeft = snap.snap.position;
              else dragTop = snap.snap.position;
            }
          }

          // Calculate dragged node edges in canvas coordinates
          const dragRight = dragLeft + width;
          const dragBottom = dragTop + height;
          const dragCenterX = dragLeft + width / 2;
          const dragCenterY = dragTop + height / 2;

          // Edges to check for snapping
          const edges = {
            horizontal: [
              { name: "top", position: dragTop },
              { name: "center", position: dragCenterY },
              { name: "bottom", position: dragBottom },
            ],
            vertical: [
              { name: "left", position: dragLeft },
              { name: "center", position: dragCenterX },
              { name: "right", position: dragRight },
            ],
          };

          // Track if any snapping is occurring
          let isSnapping = false;

          // Check horizontal edges against all snap positions
          edges.horizontal.forEach((edge) => {
            allSnapPositions.horizontal.forEach((snapPos) => {
              const distance = Math.abs(edge.position - snapPos);
              if (distance <= snapThreshold) {
                isSnapping = true;
                // Add to active guides
                newActiveGuides.horizontal.push(snapPos);

                // Update closest horizontal if this is closer
                if (
                  !closestHorizontal ||
                  distance < closestHorizontal.distance
                ) {
                  closestHorizontal = {
                    position: snapPos,
                    distance: distance,
                    edge: edge.name,
                  };
                }
              }
            });
          });

          // Check vertical edges against all snap positions
          edges.vertical.forEach((edge) => {
            allSnapPositions.vertical.forEach((snapPos) => {
              const distance = Math.abs(edge.position - snapPos);
              if (distance <= snapThreshold) {
                isSnapping = true;
                // Add to active guides
                newActiveGuides.vertical.push(snapPos);

                // Update closest vertical if this is closer
                if (!closestVertical || distance < closestVertical.distance) {
                  closestVertical = {
                    position: snapPos,
                    distance: distance,
                    edge: edge.name,
                  };
                }
              }
            });
          });

          // Apply equal spacing snap if available
          if (spacingSnap) {
            isSnapping = true;
            if (spacingSnap.axis === "h") {
              closestVertical = spacingSnap.snap; // ← horizontal spacing → vertical guide
            } else {
              closestHorizontal = spacingSnap.snap; // ← vertical spacing → horizontal guide
            }
            snapOps.setSpacingGuide(spacingSnap.guide); // shows the blue line & label
          } else {
            snapOps.setSpacingGuide(null);
          }

          // Update the active snap state
          hasActiveSnapRef.current = isSnapping;

          // If no snapping is occurring, don't show any guides
          if (!isSnapping) {
            snapOps.resetGuides();
          }
        }

        // Only update guides and snap points if we have an active snap
        if (hasActiveSnapRef.current) {
          // Update active guides in the store (for visual display)
          snapOps.setActiveGuides({
            horizontal: [...new Set(newActiveGuides.horizontal)],
            vertical: [...new Set(newActiveGuides.vertical)],
          });

          // Update active snap points in the store (for snapping logic)
          snapOps.setActiveSnapPoints({
            horizontal: closestHorizontal,
            vertical: closestVertical,
          });
        }
      } catch (error) {
        console.error("SnapGuides: Error in alignment check", error);
      }

      // Continue the loop
      animationFrameRef.current = requestAnimationFrame(checkForAlignment);
    };

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(checkForAlignment);

    // Clean up
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    isDragging,
    draggedNode,
    dragPositions,
    transform,
    isMovingCanvas,
    dragSource,
    hasActiveDropZone,
    showChildElements,
    isResizing,
    getSelectedIds,
    getNodeStyle,
    currentDraggedNodeIds, // FIX FOR ISSUE 2: React to changes in dragged nodes
  ]);

  // Determine which guides to render
  const guidesToRender = SHOW_ALL_GUIDES ? allGuides : activeGuides;

  // When showing all guides or spacing, always render unless there are no guides/spacing
  // Only show guides when actually snapping (hasActiveSnapRef.current is true)
  const shouldRender = SHOW_ALL_GUIDES
    ? guidesToRender.horizontal.length > 0 || guidesToRender.vertical.length > 0
    : (!hasActiveDropZone &&
        hasActiveSnapRef.current &&
        (guidesToRender.horizontal.length > 0 ||
          guidesToRender.vertical.length > 0)) ||
      (SHOW_SPACING &&
        (elementSpacings.horizontal.length > 0 ||
          elementSpacings.vertical.length > 0 ||
          (spacingGuide !== null && hasActiveSnapRef.current)));

  // Return early if no guides or spacing to render
  if (!shouldRender) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
      data-snap-guides-container
    >
      {guidesToRender.horizontal.map((position, i) => {
        // Apply transform to position
        const transformedPos = position * transform.scale + transform.y;

        return (
          <div
            key={`h-${i}-${position}`}
            style={{
              position: "absolute",
              top: `${transformedPos}px`,
              left: 0,
              width: "100%",
              height: "1px",
              backgroundColor: "rgba(255, 124, 221, 0.8)",
              pointerEvents: "none",
            }}
            data-snap-guide-horizontal
            data-snap-position={position}
          />
        );
      })}

      {guidesToRender.vertical.map((position, i) => {
        // Apply transform to position
        const transformedPos = position * transform.scale + transform.x;

        return (
          <div
            key={`v-${i}-${position}`}
            style={{
              position: "absolute",
              left: `${transformedPos}px`,
              top: 0,
              width: "1px",
              height: "100%",
              backgroundColor: "rgba(255, 124, 221, 0.8)",
              pointerEvents: "none",
            }}
            data-snap-guide-vertical
            data-snap-position={position}
          />
        );
      })}

      {SHOW_SPACING &&
        spacingGuide &&
        spacingGuide.segments &&
        hasActiveSnapRef.current &&
        spacingGuide.segments.map((segment, idx) =>
          spacingGuide.axis === "h" ? (
            <div key={`h-segment-${idx}`}>
              <div
                style={{
                  position: "absolute",
                  left: `${segment.start * transform.scale + transform.x}px`,
                  top: `${segment.min * transform.scale + transform.y}px`,
                  width: `${(segment.end - segment.start) * transform.scale}px`,
                  height: `${(segment.max - segment.min) * transform.scale}px`,
                  backgroundColor: "rgba(244, 114, 182, 0.12)",
                  pointerEvents: "none",
                }}
                data-spacing-band-horizontal
              />

              <div
                style={{
                  position: "absolute",
                  left: `${
                    ((segment.start + segment.end) / 2) * transform.scale +
                    transform.x -
                    18
                  }px`,
                  top: `${
                    ((segment.min + segment.max) / 2) * transform.scale +
                    transform.y -
                    10
                  }px`,
                  backgroundColor: "rgba(255, 124, 221, 0.8)",
                  color: "white",
                  padding: "2px 4px",
                  fontSize: "10px",
                  borderRadius: "2px",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                }}
              >
                {`${Math.round(spacingGuide.distance)}px`}
              </div>
            </div>
          ) : (
            <div key={`v-segment-${idx}`}>
              <div
                style={{
                  position: "absolute",
                  left: `${segment.min * transform.scale + transform.x}px`,
                  top: `${segment.start * transform.scale + transform.y}px`,
                  width: `${(segment.max - segment.min) * transform.scale}px`,
                  height: `${
                    (segment.end - segment.start) * transform.scale
                  }px`,
                  backgroundColor: "rgba(244, 114, 182, 0.12)",
                  pointerEvents: "none",
                }}
                data-spacing-band-vertical
              />

              <div
                style={{
                  position: "absolute",
                  left: `${
                    ((segment.min + segment.max) / 2) * transform.scale +
                    transform.x -
                    18
                  }px`,
                  top: `${
                    ((segment.start + segment.end) / 2) * transform.scale +
                    transform.y -
                    10
                  }px`,
                  backgroundColor: "rgba(255, 124, 221, 0.8)",
                  color: "white",
                  padding: "2px 4px",
                  fontSize: "10px",
                  borderRadius: "2px",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                }}
              >
                {`${Math.round(spacingGuide.distance)}px`}
              </div>
            </div>
          )
        )}
    </div>
  );
};

export default SnapGuides;
