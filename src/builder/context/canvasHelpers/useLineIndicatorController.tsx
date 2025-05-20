import { useEffect } from "react";
import {
  useIsDragging,
  useDraggedNode,
  useDragSource,
  dragOps,
  useGetDragBackToParentInfo,
} from "@/builder/context/atoms/drag-store";
import { visualOps } from "../atoms/visual-store";
import { computeFrameDropIndicator } from "../utils";
import { useGetNodeStyle } from "@/builder/context/atoms/node-store";

export const useLineIndicatorController = () => {
  const dragging = useIsDragging();
  const dragged = useDraggedNode();
  const dragSource = useDragSource();
  const getNodeStyle = useGetNodeStyle();
  // NEW: Add drag back to parent info to properly handle its state
  const getDragBackToParentInfo = useGetDragBackToParentInfo();

  useEffect(() => {
    // NEW: Immediately check if we're dragging back to parent and hide indicators
    if (
      !dragging ||
      !dragged ||
      getDragBackToParentInfo().isDraggingBackToParent
    ) {
      visualOps.hideLineIndicator();
      return;
    }

    // Also hide indicators if not in canvas mode
    if (dragSource !== "canvas") {
      visualOps.hideLineIndicator();
      // NEW: Also clear drop info when not in canvas mode
      dragOps.setDropInfo(null, null);
      return;
    }

    const onMove = (e: MouseEvent) => {
      // NEW: Check isDraggingBackToParent on every mouse move
      const isDraggingBackToParent =
        dragOps.getState().dragBackToParentInfo.isDraggingBackToParent;

      // NEW: Immediately exit and clear all indicators/drop info if dragging back to parent
      if (isDraggingBackToParent) {
        visualOps.hideLineIndicator();
        dragOps.setDropInfo(null, null);
        return;
      }

      const els = document.elementsFromPoint(e.clientX, e.clientY);

      const frame = els.find(
        (el) =>
          el.getAttribute("data-node-type") === "frame" &&
          el.getAttribute("data-node-id") !== dragged.node.id
      ) as HTMLElement | undefined;

      if (!frame) {
        visualOps.hideLineIndicator();
        dragOps.setDropInfo(null, null);
        return;
      }

      const frameId = frame.getAttribute("data-node-id");
      if (!frameId) {
        visualOps.hideLineIndicator();
        dragOps.setDropInfo(null, null);
        return;
      }

      // NEW: Another check for drag back to parent - don't show drop indicators
      // even if we're over a frame if we're in drag-back-to-parent mode
      if (isDraggingBackToParent) {
        visualOps.hideLineIndicator();
        dragOps.setDropInfo(null, null);
        return;
      }

      const children = Array.from(frame.children).filter((el) => {
        const childId = el.getAttribute("data-node-id");

        if (
          el.getAttribute("data-node-type") === "placeholder" ||
          childId === dragged.node.id
        ) {
          return false;
        }

        if (childId) {
          const childStyle = getNodeStyle(childId);
          return childStyle.isAbsoluteInFrame !== "true";
        }

        return true;
      }) as HTMLElement[];

      const childRects = children.map((el) => ({
        id: el.getAttribute("data-node-id")!,
        rect: el.getBoundingClientRect(),
      }));

      const result = computeFrameDropIndicator(
        frame,
        childRects,
        e.clientX,
        e.clientY
      );

      if (result && result.lineIndicator.show) {
        visualOps.setLineIndicator(result.lineIndicator);

        dragOps.setDropInfo(result.dropInfo.targetId, result.dropInfo.position);
      } else {
        visualOps.hideLineIndicator();
        dragOps.setDropInfo(frameId, "inside");
      }
    };

    const onMouseUp = () => {
      visualOps.hideLineIndicator();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onMouseUp);
      visualOps.hideLineIndicator();
    };
  }, [dragging, dragged, dragSource, getNodeStyle, getDragBackToParentInfo]);
};
