import { useBuilder } from "@/builder/context/builderState";
import {
  calculateDragPositions,
  calculateDragTransform,
  isUnderClassNameDuringDrag,
  getDropPosition,
  getNodeFixedStyle,
  findViewportSibling,
  computeSnapAndGuides,
} from "./utils";
import { useRef } from "react";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";

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
      const overViewport = elementsUnder.some((el) =>
        el.classList.contains("viewport")
      );

      if (overViewport) {
        const sibling = findViewportSibling(elementsUnder);
        if (sibling) {
          const { position, lineIndicator } = getDropPosition(
            e.clientY,
            sibling.rect,
            sibling.type
          );
          dragDisp.setLineIndicator(lineIndicator);
          dragDisp.setDropInfo(sibling.id, position);
        } else {
          dragDisp.hideLineIndicator();
          dragDisp.setDropInfo(null, null);
        }
      } else {
        dragDisp.hideLineIndicator();
      }

      setNodeStyle(
        getNodeFixedStyle(e.clientX, e.clientY, { pointerEvents: "none" })
      );
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const overCanvas = isUnderClassNameDuringDrag(e, "canvas", dragState);
    const draggedElement = document.querySelector(
      `[data-node-id="${draggedNode.id}"]`
    );
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

    // We'll call these newLeft/newTop: how we plan to position absolutely
    let newLeft = offset.x + x;
    let newTop = offset.y + y;

    // Only do snapping if node is out-of-viewport
    if (!draggedNode.inViewport) {
      const { snappedLeft, snappedTop, guides } = computeSnapAndGuides(
        newLeft,
        newTop,
        draggedNode,
        nodeState.nodes
      );

      // *** This is the actual "snap": ***
      newLeft = snappedLeft;
      newTop = snappedTop;

      // *** This sets the lines in global state for rendering: ***
      dragDisp.setSnapGuides(guides);
    } else {
      // If in viewport, no snap lines
      dragDisp.clearSnapGuides();
    }

    // Now apply the style so it actually moves the element:
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

      // Apply snapping
      setNodeStyle({
        position: "fixed",
        left: `${snappedLeft}px`,
        top: `${snappedTop}px`,
        zIndex: 1000,
      });

      // Set snap guides for rendering
      dragDisp.setSnapGuides(guides);

      dragDisp.hideLineIndicator();
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    setNodeStyle({
      position: "fixed",
      left: `${offset.x + x}px`,
      top: `${offset.y + y}px`,
      zIndex: 1000,
    });

    if (isReorderingNode) {
      const placeholder = nodeState.nodes.find((n) => n.type === "placeholder");
      if (!placeholder && originalIndexRef.current !== null) {
        const placeholderNode: Node = {
          id: nanoid(),
          type: "placeholder",
          style: {
            width: draggedNode.style.width,
            height: draggedNode.style.height,
            backgroundColor: "rgba(0,153,255,0.8)",
            position: "relative",
          },
          inViewport: true,
        };

        nodeDisp.insertAtIndex(placeholderNode, originalIndexRef.current);
      }

      if (placeholder) {
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        const filtered = elementsUnder.filter((el) => {
          const closestNode = el.closest(`[data-node-id="${draggedNode.id}"]`);
          return !closestNode;
        });

        const siblingElement = filtered.find((el) => {
          const nodeId = el.getAttribute("data-node-id");
          if (!nodeId) return false;
          if (nodeId === String(draggedNode.id)) return false;
          return el.getAttribute("data-node-type") !== "placeholder";
        });

        if (siblingElement) {
          const siblingId = siblingElement.getAttribute("data-node-id")!;
          const movingDown = e.clientY > prevMousePosRef.current.y;
          const position = movingDown ? "after" : "before";

          nodeDisp.moveNode(placeholder.id, true, {
            targetId: parseInt(siblingId, 10),
            position,
          });
        }
        dragDisp.hideLineIndicator();
      }
    } else {
      dragDisp.hideLineIndicator();
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      const filteredElements = elementsUnder.filter((el) => {
        const closestNode = el.closest(`[data-node-id="${draggedNode.id}"]`);
        return !closestNode;
      });

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

        dragDisp.setLineIndicator(lineIndicator);
        dragDisp.setDropInfo(parseInt(siblingId, 10), position);
      } else {
        dragDisp.setDropInfo(null, null);
      }
    }

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
