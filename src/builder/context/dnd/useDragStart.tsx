import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import {
  calculateDragPositions,
  calculateDragTransform,
  findIndexWithinParent,
} from "./utils";
import { nanoid } from "nanoid";

export const useDragStart = () => {
  const { dragDisp, nodeDisp, transform, contentRef, nodeState, dragState } =
    useBuilder();

  const getDynamicParentNode = (node: Node): Node | null => {
    let currentNode = node;
    while (currentNode.parentId) {
      const parent = nodeState.nodes.find((n) => n.id === currentNode.parentId);
      if (!parent) break;
      if (parent.isDynamic) return parent;
      currentNode = parent;
    }
    return null;
  };

  return (e: React.MouseEvent, fromToolbarType?: string, node?: Node) => {
    e.preventDefault();

    if (fromToolbarType) {
      const newNode: Node = {
        id: nanoid(),
        type: fromToolbarType,
        style: {
          width: "150px",
          height: "150px",
          position: "fixed",
          backgroundColor: fromToolbarType === "frame" ? "gray" : undefined,
          flex: "0 0 auto",
        },
        inViewport: true,
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

    if (!dragState.dynamicModeNodeId) {
      const dynamicParent = getDynamicParentNode(node);
      if (dynamicParent && !node.isDynamic) {
        node = dynamicParent;
      }
    }

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

    const { x, y } = calculateDragTransform(
      positions.cursorX,
      positions.cursorY,
      positions.elementX,
      positions.elementY,
      positions.mouseOffsetX,
      positions.mouseOffsetY
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
          flex: "0 0 auto",
          rotate: node.style.rotate,
        },
        inViewport: true,
        parentId: node.parentId,
      };

      nodeDisp.insertAtIndex(placeholderNode, oldIndex, node.parentId);

      dragDisp.setDraggedNode(node, {
        x: positions.elementX,
        y: positions.elementY,
        mouseX: positions.mouseOffsetX,
        mouseY: positions.mouseOffsetY,
      });
    } else {
      dragDisp.setDragSource("canvas");

      dragDisp.setDraggedNode(node, {
        x: positions.elementX,
        y: positions.elementY,
        mouseX: x,
        mouseY: y,
      });
    }

    dragDisp.setIsDragging(true);
    dragDisp.setDraggedItem(null);
  };
};
