import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { findIndexWithinParent } from "./utils";
import { nanoid } from "nanoid";

export const useDragStart = () => {
  const {
    dragDisp,
    nodeDisp,
    transform,
    contentRef,
    nodeState,
    dragState,
    setNodeStyle,
  } = useBuilder();

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
    dragDisp.setIsDragging(true);

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

    const elementRect = element.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

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
          borderRadius: node.style.borderRadius,
        },
        inViewport: true,
        parentId: node.parentId,
      };

      nodeDisp.insertAtIndex(placeholderNode, oldIndex, node.parentId);

      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      dragDisp.setDraggedNode(node, {
        x:
          (elementRect.left - contentRect.left - transform.x) / transform.scale,
        y: (elementRect.top - contentRect.top - transform.y) / transform.scale,
        mouseX: mouseOffsetX,
        mouseY: mouseOffsetY,
      });
    } else {
      dragDisp.setDragSource("canvas");

      // Keep track of the absolute canvas position
      const currentLeft = parseFloat(node.style.left as string) || 0;
      const currentTop = parseFloat(node.style.top as string) || 0;

      // Calculate mouse offset in screen coordinates
      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      setNodeStyle(
        {
          position: "absolute",
          left: undefined,
          top: undefined,
        },
        [node.id]
      );

      dragDisp.setIsDragging(true);

      console.log("dragging", dragState.isDragging);

      dragDisp.setDraggedNode(node, {
        x: currentLeft, // Store the actual canvas position
        y: currentTop,
        mouseX: mouseOffsetX,
        mouseY: mouseOffsetY,
      });
    }

    dragDisp.setDraggedItem(null);
  };
};
