import { useBuilder } from "@/builder/context/builderState";
import {
  calculateDragPositions,
  calculateDragTransform,
  getDropPosition,
  computeSnapAndGuides,
  computeFrameDropIndicator,
  computeSiblingReorderResult,
  getFilteredElementsUnderMouseDuringDrag,
} from "./utils";
import { useRef } from "react";

export const useMouseMove = () => {
  const {
    dragState,
    transform,
    contentRef,
    setNodeStyle,
    nodeDisp,
    dragDisp,
    nodeState,
  } = useBuilder();

  const prevMousePosRef = useRef({ x: 0, y: 0 });

  const originalIndexRef = useRef<number | null>(null);

  return (e: MouseEvent) => {
    e.preventDefault();

    if (
      !dragState.isDragging ||
      !dragState.draggedNode ||
      !contentRef.current
    ) {
      return;
    }

    const draggedNode = dragState.draggedNode.node;

    const { offset } = dragState.draggedNode;
    const contentRect = contentRef.current.getBoundingClientRect();

    if (dragState.draggedItem) {
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);

      const frameElement = elementsUnder.find(
        (el) => el.getAttribute("data-node-type") === "frame"
      );

      if (frameElement) {
        console.log("hovering over frame");
        const frameId = frameElement.getAttribute("data-node-id")!;
        const frameNode = nodeState.nodes.find((n) => String(n.id) === frameId);
        if (!frameNode) {
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        const frameChildren = nodeState.nodes.filter(
          (child) => child.parentId === frameId
        );

        const childRects = frameChildren
          .map((childNode) => {
            const el = document.querySelector(
              `[data-node-id="${childNode.id}"]`
            ) as HTMLElement | null;
            return el
              ? {
                  id: childNode.id,
                  rect: el.getBoundingClientRect(),
                }
              : null;
          })
          .filter((x): x is { id: string | number; rect: DOMRect } => !!x);

        const result = computeFrameDropIndicator(
          frameElement,
          childRects,
          e.clientX,
          e.clientY
        );

        console.log("result", result);

        if (result) {
          dragDisp.setDropInfo(
            result.dropInfo.targetId,
            result.dropInfo.position
          );
          if (result.lineIndicator.show) {
            dragDisp.setLineIndicator(result.lineIndicator);
          } else {
            dragDisp.hideLineIndicator();
          }
        }

        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      } else {
        dragDisp.setDropInfo(null, null, e.clientX, e.clientY);
      }
    }

    const overCanvas = getFilteredElementsUnderMouseDuringDrag(
      e,
      draggedNode.id,
      "canvas"
    );

    const draggedElement = document.querySelector(
      `[data-node-id="${draggedNode.id}"]`
    ) as HTMLElement | null;
    if (!draggedElement) return;

    const { cursorX, cursorY } = calculateDragPositions(
      e,
      draggedElement,
      contentRect,
      transform
    );
    const { x, y } = calculateDragTransform(
      cursorX,
      cursorY,
      offset.x,
      offset.y,
      offset.mouseX,
      offset.mouseY
    );

    let newLeft = offset.x + x;
    let newTop = offset.y + y;

    if (!draggedNode.inViewport) {
      const { snappedLeft, snappedTop, guides } = computeSnapAndGuides(
        newLeft,
        newTop,
        draggedNode,
        nodeState.nodes
      );
      newLeft = snappedLeft;
      newTop = snappedTop;
      dragDisp.setSnapGuides(guides);
    } else {
      dragDisp.clearSnapGuides();
    }

    setNodeStyle(
      {
        position: "fixed",
        left: `${newLeft}px`,
        top: `${newTop}px`,
        zIndex: 1000,
      },
      [draggedNode.id]
    );

    const isReorderingNode =
      dragState.dragSource === "viewport" &&
      (draggedNode.inViewport || originalIndexRef.current !== null);

    setNodeStyle({
      position: "fixed",
      left: `${offset.x + x}px`,
      top: `${offset.y + y}px`,
      zIndex: 1000,
    });

    if (isReorderingNode) {
      const parentElement = document.querySelector(
        `[data-node-id="${draggedNode.parentId}"]`
      );

      if (!parentElement) return;

      const reorderResult = computeSiblingReorderResult(
        draggedNode,
        nodeState.nodes,
        parentElement,
        e.clientX,
        e.clientY
      );

      if (reorderResult) {
        const placeholder = nodeState.nodes.find(
          (n) => n.type === "placeholder"
        );
        if (placeholder) {
          nodeDisp.moveNode(placeholder.id, true, {
            targetId: reorderResult.targetId,
            position: reorderResult.position,
          });
        }
      }

      dragDisp.hideLineIndicator();
    } else {
      dragDisp.hideLineIndicator();
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      const filteredElements = elementsUnder.filter((el) => {
        const closestNode = el.closest(`[data-node-id="${draggedNode.id}"]`);
        return !closestNode;
      });

      // First check for frame elements
      const frameElement = filteredElements.find(
        (el) => el.getAttribute("data-node-type") === "frame"
      );

      if (frameElement) {
        if (draggedNode.isViewport) {
          dragDisp.setDropInfo(null, null);
          dragDisp.hideLineIndicator();
          return;
        }

        const frameId = frameElement.getAttribute("data-node-id")!;
        const frameChildren = nodeState.nodes.filter(
          (child) => child.parentId === frameId
        );

        const childRects = frameChildren
          .map((childNode) => {
            const el = document.querySelector(
              `[data-node-id="${childNode.id}"]`
            ) as HTMLElement | null;
            return el
              ? {
                  id: childNode.id,
                  rect: el.getBoundingClientRect(),
                }
              : null;
          })
          .filter((x): x is { id: string | number; rect: DOMRect } => !!x);

        const result = computeFrameDropIndicator(
          frameElement,
          childRects,
          e.clientX,
          e.clientY
        );

        if (result) {
          dragDisp.setDropInfo(
            result.dropInfo.targetId,
            result.dropInfo.position
          );
          if (result.lineIndicator.show) {
            dragDisp.setLineIndicator(result.lineIndicator);
          } else {
            dragDisp.hideLineIndicator();
          }
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
      }

      // If not over a frame, check for other sibling elements
      const siblingElement = filteredElements.find((el) => {
        if (!el.hasAttribute("data-node-id")) return false;
        return el.getAttribute("data-node-type") !== "placeholder";
      });

      if (siblingElement) {
        const siblingId = siblingElement.getAttribute("data-node-id")!;
        const nodeType = siblingElement.getAttribute("data-node-type");
        const rect = siblingElement.getBoundingClientRect();

        const { position, lineIndicator } = getDropPosition(
          e.clientY,
          rect,
          nodeType
        );

        if (position !== "inside") {
          dragDisp.setLineIndicator(lineIndicator);
        }
        dragDisp.setDropInfo(siblingId, position);
      } else {
        dragDisp.setDropInfo(null, null);
      }
    }

    if (overCanvas) {
      const placeholder = nodeState.nodes.find((n) => n.type === "placeholder");
      if (placeholder && isReorderingNode) {
        if (originalIndexRef.current === null) {
          originalIndexRef.current = nodeState.nodes.findIndex(
            (n) => n.type === "placeholder"
          );
        }
        nodeDisp.removeNode(placeholder.id);
      }

      nodeDisp.moveNode(draggedNode.id, false);

      setNodeStyle({
        position: "fixed",
        left: `${offset.x + x}px`,
        top: `${offset.y + y}px`,
        zIndex: 1000,
      });

      const { snappedLeft, snappedTop, guides } = computeSnapAndGuides(
        offset.x + x,
        offset.y + y,
        draggedNode,
        nodeState.nodes
      );
      setNodeStyle({
        position: "fixed",
        left: `${snappedLeft}px`,
        top: `${snappedTop}px`,
        zIndex: 1000,
      });
      dragDisp.setSnapGuides(guides);

      dragDisp.hideLineIndicator();
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      console.log("OUT OF CANVAS");
      nodeDisp.syncViewports();
      return;
    }

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
