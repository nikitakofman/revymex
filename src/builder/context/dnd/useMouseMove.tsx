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
import { getSiblingOrdering, TargetInfo } from "./dnd-utils";
import { snapOps } from "../atoms/snap-guides-store";

export const screenToCanvas = (
  e: MouseEvent,
  containerRect: DOMRect,
  transform: { x: number; y: number; scale: number }
) => ({
  x: (e.clientX - containerRect.left - transform.x) / transform.scale,
  y: (e.clientY - containerRect.top - transform.y) / transform.scale,
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

  const lastTarget = useRef<TargetInfo | null>(null);
  const prevMousePosRef = useRef({ x: 0, y: 0 });

  return (e: MouseEvent) => {
    if (!getIsDragging()) return;

    const dragged = getDraggedNode();
    if (!dragged) return;

    const dragSource = getDragSource();
    const draggedNodeId = dragged.node.id;

    const isOverCanvas = getFilteredElementsUnderMouseDuringDrag(
      e,
      draggedNodeId,
      "canvas"
    );

    // Always track mouse position for canvas elements
    if (dragSource === "canvas") {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const transform = getTransform();
      const { x, y } = screenToCanvas(e, containerRect, transform);

      // Check if there's an active drop zone
      const dropInfo = getDropInfo();
      const hasActiveDropZone = dropInfo && dropInfo.targetId !== null;

      // Get snap guides state - only if no active drop zone
      const { enabled, activeSnapPoints } = hasActiveDropZone
        ? {
            enabled: false,
            activeSnapPoints: { horizontal: null, vertical: null },
          }
        : snapOps.getState();

      // Calculate mouse speed (pixels per frame)
      const mouseSpeed = {
        x: Math.abs(e.clientX - prevMousePosRef.current.x),
        y: Math.abs(e.clientY - prevMousePosRef.current.y),
      };

      // Dynamic snap threshold based on speed
      // Reduce snap effect when moving quickly
      const speedFactor = Math.max(mouseSpeed.x, mouseSpeed.y);
      const snapStrength = Math.max(0, 1 - speedFactor / 20); // Gradually reduce snapping as speed increases

      // Prepare final position (will be adjusted if snapping)
      let finalX = x - dragged.offset.mouseX / transform.scale;
      let finalY = y - dragged.offset.mouseY / transform.scale;

      // Raw positions (without snapping) to blend with snapped positions
      const rawX = finalX;
      const rawY = finalY;

      // Extract node dimensions for snapping calculations
      const { style } = dragged.node;
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

      // Apply snapping if enabled, we have active snap points, and no active drop zone
      if (enabled && !hasActiveDropZone) {
        // Apply horizontal snapping
        if (activeSnapPoints.horizontal) {
          const snapPoint = activeSnapPoints.horizontal;
          let snappedY = finalY;

          // Adjust position based on which edge is snapping
          if (snapPoint.edge === "top") {
            snappedY = snapPoint.position;
          } else if (snapPoint.edge === "center") {
            snappedY = snapPoint.position - height / 2;
          } else if (snapPoint.edge === "bottom") {
            snappedY = snapPoint.position - height;
          }

          // Blend raw position with snapped position based on speed
          finalY = snappedY * snapStrength + rawY * (1 - snapStrength);
        }

        // Apply vertical snapping
        if (activeSnapPoints.vertical) {
          const snapPoint = activeSnapPoints.vertical;
          let snappedX = finalX;

          // Adjust position based on which edge is snapping
          if (snapPoint.edge === "left") {
            snappedX = snapPoint.position;
          } else if (snapPoint.edge === "center") {
            snappedX = snapPoint.position - width / 2;
          } else if (snapPoint.edge === "right") {
            snappedX = snapPoint.position - width;
          }

          // Blend raw position with snapped position based on speed
          finalX = snappedX * snapStrength + rawX * (1 - snapStrength);
        }
      }

      // Update the node's position with (potentially) snapped coordinates
      updateNodeStyle(draggedNodeId, {
        position: "absolute",
        left: `${finalX}px`,
        top: `${finalY}px`,
      });

      // Store positions for drag operations
      dragOps.setDragPositions(x, y);

      // Toggle canvas state if needed
      dragOps.setIsOverCanvas(isOverCanvas);

      // Update for next frame
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Normal placeholder-based dragging
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
      // Use the comprehensive utility function for all placeholder positioning logic
      const result = getSiblingOrdering(
        e,
        placeholderId,
        draggedNodeId,
        getNodeParent,
        getNodeChildren,
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
