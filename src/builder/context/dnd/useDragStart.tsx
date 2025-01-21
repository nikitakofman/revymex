import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import {
  calculateDragPositions,
  calculateDragTransform,
  findIndex,
  findIndexWithinParent,
  findParentViewport,
} from "./utils";
import { nanoid } from "nanoid";

export const useDragStart = () => {
  const { dragDisp, nodeDisp, transform, contentRef, nodeState, setNodeStyle } =
    useBuilder();

  return (e: React.MouseEvent, fromToolbarType?: string, node?: Node) => {
    e.preventDefault();

    console.log("dragstart");

    if (fromToolbarType) {
      const newNode: Node = {
        id: nanoid(),
        type: fromToolbarType,
        style: {
          width: "150px",
          height: "150px",
          position: "fixed",
          backgroundColor: fromToolbarType === "frame" ? "gray" : undefined,
        },
        inViewport: false,
        parentId: null,
      };

      dragDisp.setDraggedNode(newNode, {
        x: e.clientX,
        y: e.clientY,
        mouseX: 0,
        mouseY: 0,
      });
      dragDisp.setIsDragging(true);
      dragDisp.setDraggedItem(fromToolbarType);
      dragDisp.setDragSource("toolbar");

      return;
    }

    if (!node || !contentRef.current) return;

    const element = document.querySelector(`[data-node-id="${node.id}"]`);
    if (!element) return;

    const contentRect = contentRef.current.getBoundingClientRect();
    const positions = calculateDragPositions(
      e,
      element,
      contentRect,
      transform,
      node.inViewport
    );

    if (node.inViewport) {
      dragDisp.setDragSource("viewport");

      const oldIndex = findIndexWithinParent(
        nodeState.nodes,
        node.id,
        node.parentId
      );

      const placeholderNode: Node = {
        id: nanoid(),
        type: "placeholder",
        style: {
          width: node.style.width,
          height: node.style.height,
          backgroundColor: "rgba(0,153,255,0.8)",
          position: "relative",
        },
        inViewport: true,
        parentId: node.parentId,
      };

      nodeDisp.insertAtIndex(placeholderNode, oldIndex, node.parentId);

      const { x: initialX, y: initialY } = calculateDragTransform(
        positions.cursorX,
        positions.cursorY,
        positions.elementX,
        positions.elementY,
        positions.mouseOffsetX,
        positions.mouseOffsetY
      );

      setNodeStyle(
        {
          position: "fixed",
          left: `${positions.elementX + initialX}px`,
          top: `${positions.elementY + initialY}px`,
          zIndex: 1000,
        },
        [node.id]
      );

      dragDisp.setDraggedNode(node, {
        x: positions.elementX,
        y: positions.elementY,
        mouseX: positions.mouseOffsetX,
        mouseY: positions.mouseOffsetY,
      });
    } else {
      dragDisp.setDragSource("canvas");

      const { x: initialX, y: initialY } = calculateDragTransform(
        positions.cursorX,
        positions.cursorY,
        positions.elementX,
        positions.elementY,
        positions.mouseOffsetX,
        positions.mouseOffsetY
      );

      setNodeStyle(
        {
          position: "fixed",
          left: `${positions.elementX + initialX}px`,
          top: `${positions.elementY + initialY}px`,
          zIndex: 1000,
        },
        [node.id]
      );

      dragDisp.setDraggedNode(node, {
        x: positions.elementX,
        y: positions.elementY,
        mouseX: positions.mouseOffsetX,
        mouseY: positions.mouseOffsetY,
      });
    }

    dragDisp.setIsDragging(true);
    dragDisp.setDraggedItem(null);
  };
};
