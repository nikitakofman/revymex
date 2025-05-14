import { useRef } from "react";
import {
  useGetDraggedNode,
  useGetIsDragging,
  dragOps,
  useGetDragSource,
  useGetDropInfo,
} from "../atoms/drag-store";
import { useBuilderRefs } from "@/builder/context/builderState";
import { useGetTransform } from "../atoms/canvas-interaction-store";
import {
  useGetNodeParent,
  useGetNodeChildren,
} from "../atoms/node-store/hierarchy-store";
import {
  moveNode,
  removeNode,
} from "../atoms/node-store/operations/insert-operations";
import { getFilteredElementsUnderMouseDuringDrag } from "../utils";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";
import {
  getSiblingOrdering,
  TargetInfo,
  calculateSnappedPosition,
  extractNodeDimensions,
} from "./dnd-utils";
import { snapOps } from "../atoms/snap-guides-store";
import { useGetNodeFlags, useGetNodeStyle } from "../atoms/node-store";

// Convert screen coordinates to canvas space
export const screenToCanvas = (
  e: MouseEvent,
  containerRect: DOMRect,
  transform: { x: number; y: number; scale: number }
) => ({
  x: (e.clientX - containerRect.left - transform.x) / transform.scale,
  y: (e.clientY - containerRect.top - transform.y) / transform.scale,
});

// Get parent element's position in canvas space
export const getParentOffsetInCanvas = (
  parentEl: HTMLElement,
  containerRect: DOMRect,
  transform: { x: number; y: number; scale: number }
) => ({
  x:
    (parentEl.getBoundingClientRect().left - containerRect.left - transform.x) /
    transform.scale,
  y:
    (parentEl.getBoundingClientRect().top - containerRect.top - transform.y) /
    transform.scale,
});

export const useMouseMove = () => {
  const getDraggedNode = useGetDraggedNode();
  const getIsDragging = useGetIsDragging();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getDragSource = useGetDragSource();
  const { containerRef } = useBuilderRefs();
  const getTransform = useGetTransform();
  const getDropInfo = useGetDropInfo();
  const getNodeFlags = useGetNodeFlags();
  const getNodeStyle = useGetNodeStyle();

  const lastTarget = useRef<TargetInfo | null>(null);
  const prevMousePosRef = useRef({ x: 0, y: 0 });

  return (e: MouseEvent) => {
    if (!getIsDragging()) return;

    const dragged = getDraggedNode();
    if (!dragged) return;

    const dragSource = getDragSource();
    const draggedNodeId = dragged.node.id;
    const startingParentId = dragged.offset.startingParentId;

    // Get the original position type to maintain it
    const originalPositionType =
      dragged.offset.originalPositionType || "absolute";

    const isOverCanvas = getFilteredElementsUnderMouseDuringDrag(
      e,
      draggedNodeId,
      "canvas"
    );

    // Handle absolute-in-frame elements (including fixed)
    if (dragSource === "absolute-in-frame" && startingParentId) {
      const transform = getTransform();
      const containerRect = containerRef.current!.getBoundingClientRect();
      const parentEl = document.querySelector(
        `[data-node-id="${startingParentId}"]`
      ) as HTMLElement;

      if (!parentEl) return;

      // 1️⃣ Mouse position in canvas space
      const { x: mouseCX, y: mouseCY } = screenToCanvas(
        e,
        containerRect,
        transform
      );

      // 2️⃣ Raw drag position in canvas space (keep the grab-offset)
      const rawCX = mouseCX - dragged.offset.mouseX / transform.scale;
      const rawCY = mouseCY - dragged.offset.mouseY / transform.scale;

      // Check if there's an active drop zone
      const dropInfo = getDropInfo();
      const hasActiveDropZone = dropInfo && dropInfo.targetId !== null;

      // 3️⃣ Snap in canvas space
      const { enabled, activeSnapPoints } = hasActiveDropZone
        ? {
            enabled: false,
            activeSnapPoints: { horizontal: null, vertical: null },
          }
        : snapOps.getState();

      // Extract node dimensions
      const dimensions = extractNodeDimensions(dragged.node.style);

      // Calculate mouse speed
      const mouseSpeed = {
        x: Math.abs(e.clientX - prevMousePosRef.current.x),
        y: Math.abs(e.clientY - prevMousePosRef.current.y),
      };

      // Calculate snapped position in canvas space
      const { x: snapCX, y: snapCY } = calculateSnappedPosition(
        rawCX,
        rawCY,
        dimensions,
        mouseSpeed,
        activeSnapPoints,
        enabled,
        hasActiveDropZone
      );

      // 4️⃣ Convert snapped canvas coords → parent coords
      const { x: parentCX, y: parentCY } = getParentOffsetInCanvas(
        parentEl,
        containerRect,
        transform
      );

      const relX = Math.round(snapCX - parentCX);
      const relY = Math.round(snapCY - parentCY);

      // 5️⃣ Write styles - use absolute for positioning but maintain the original position type
      updateNodeStyle(draggedNodeId, {
        position: originalPositionType, // Keep the original position type
        left: `${relX}px`,
        top: `${relY}px`,
      });

      // Store position for snap guides
      dragOps.setDragPositions(mouseCX, mouseCY);

      // Store mouse position for reference
      dragOps.setLastMousePosition(e.clientX, e.clientY);
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Handle canvas elements
    else if (dragSource === "canvas") {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const transform = getTransform();

      // Mouse position in canvas space
      const { x: mouseCX, y: mouseCY } = screenToCanvas(
        e,
        containerRect,
        transform
      );

      // Raw drag position in canvas space
      const rawCX = mouseCX - dragged.offset.mouseX / transform.scale;
      const rawCY = mouseCY - dragged.offset.mouseY / transform.scale;

      // Check if there's an active drop zone
      const dropInfo = getDropInfo();
      const hasActiveDropZone = dropInfo && dropInfo.targetId !== null;

      // Get snap guides state
      const { enabled, activeSnapPoints } = hasActiveDropZone
        ? {
            enabled: false,
            activeSnapPoints: { horizontal: null, vertical: null },
          }
        : snapOps.getState();

      // Extract node dimensions
      const dimensions = extractNodeDimensions(dragged.node.style);

      // Calculate mouse speed
      const mouseSpeed = {
        x: Math.abs(e.clientX - prevMousePosRef.current.x),
        y: Math.abs(e.clientY - prevMousePosRef.current.y),
      };

      // Store positions for drag operations
      dragOps.setDragPositions(mouseCX, mouseCY);

      // Calculate snapped position (already in canvas space)
      const { x: finalX, y: finalY } = calculateSnappedPosition(
        rawCX,
        rawCY,
        dimensions,
        mouseSpeed,
        activeSnapPoints,
        enabled,
        hasActiveDropZone
      );

      // Update the node's position - use absolute for positioning on canvas
      // regardless of original position type
      updateNodeStyle(draggedNodeId, {
        position: "absolute", // Always use absolute when on canvas
        left: `${Math.round(finalX)}px`,
        top: `${Math.round(finalY)}px`,
      });

      // Toggle canvas state if needed
      dragOps.setIsOverCanvas(isOverCanvas);

      // Update for next frame
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Handle placeholder-based dragging
    const placeholderId = dragged.offset.placeholderId;
    if (!placeholderId) return;

    if (isOverCanvas) {
      if (placeholderId) removeNode(placeholderId);

      const containerRect = containerRef.current!.getBoundingClientRect();
      const transform = getTransform();
      const { x, y } = screenToCanvas(e, containerRect, transform);

      dragOps.setIsOverCanvas(true);
      dragOps.setDragPositions(x, y);
    } else {
      // Handle sibling ordering
      const result = getSiblingOrdering(
        e,
        placeholderId,
        draggedNodeId,
        getNodeParent,
        getNodeChildren,
        getNodeStyle,
        lastTarget.current,
        prevMousePosRef.current
      );

      if (result) {
        const { targetInfo, parentId } = result;

        // Update last target
        lastTarget.current = targetInfo;

        // Move placeholder to new position
        const ordered = getNodeChildren(parentId);
        const clean = ordered.filter(
          (id) => id !== placeholderId && !id.includes("placeholder")
        );
        const targetIdx = clean.indexOf(targetInfo.id);
        const newIdx = targetInfo.pos === "before" ? targetIdx : targetIdx + 1;

        const currentIdx = ordered.indexOf(placeholderId);
        if (currentIdx !== newIdx) {
          moveNode(placeholderId, parentId, newIdx);
          dragOps.setDropInfo(targetInfo.id, targetInfo.pos, 0, 0);
        }
      }
    }

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
