// hooks/useLineIndicatorController.ts
import { useEffect } from "react";
import {
  useIsDragging,
  useDraggedNode,
  useDragSource,
  dragOps,
} from "@/builder/context/atoms/drag-store";
import { visualOps } from "../atoms/visual-store";
import { computeFrameDropIndicator } from "../utils";

export const useLineIndicatorController = () => {
  const dragging = useIsDragging();
  const dragged = useDraggedNode();
  const dragSource = useDragSource();

  useEffect(() => {
    // Only proceed if we're dragging and have a dragged node
    if (!dragging || !dragged) return;

    // Only show line indicator when dragging from canvas
    if (dragSource !== "canvas") {
      visualOps.hideLineIndicator();
      return;
    }

    const onMove = (e: MouseEvent) => {
      const els = document.elementsFromPoint(e.clientX, e.clientY);

      // Find the nearest element that can accept children
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

      // Gather non-placeholder, non-dragged children rects
      const children = Array.from(frame.children).filter(
        (el) =>
          el.getAttribute("data-node-type") !== "placeholder" &&
          el.getAttribute("data-node-id") !== dragged.node.id
      ) as HTMLElement[];

      const childRects = children.map((el) => ({
        id: el.getAttribute("data-node-id")!,
        rect: el.getBoundingClientRect(),
      }));

      // Get the result from the original helper
      const result = computeFrameDropIndicator(
        frame,
        childRects,
        e.clientX,
        e.clientY
      );

      if (result && result.lineIndicator.show) {
        // Show the line indicator visually
        visualOps.setLineIndicator(result.lineIndicator);

        // IMPORTANT: Pass the actual position from the result
        // This preserves the correct drop position
        dragOps.setDropInfo(result.dropInfo.targetId, result.dropInfo.position);
      } else {
        // When not showing a line indicator, set drop to "inside"
        visualOps.hideLineIndicator();
        dragOps.setDropInfo(frameId, "inside");
      }
    };

    // Mouse up handler to hide the line indicator
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
  }, [dragging, dragged, dragSource]);
};
