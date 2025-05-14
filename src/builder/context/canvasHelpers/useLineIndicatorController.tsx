import { useEffect } from "react";
import {
  useIsDragging,
  useDraggedNode,
  useDragSource,
  dragOps,
} from "@/builder/context/atoms/drag-store";
import { visualOps } from "../atoms/visual-store";
import { computeFrameDropIndicator } from "../utils";
import { useGetNodeStyle } from "@/builder/context/atoms/node-store";

export const useLineIndicatorController = () => {
  const dragging = useIsDragging();
  const dragged = useDraggedNode();
  const dragSource = useDragSource();
  const getNodeStyle = useGetNodeStyle();

  useEffect(() => {
    if (!dragging || !dragged) return;

    if (dragSource !== "canvas") {
      visualOps.hideLineIndicator();
      return;
    }

    const onMove = (e: MouseEvent) => {
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
  }, [dragging, dragged, dragSource, getNodeStyle]);
};
