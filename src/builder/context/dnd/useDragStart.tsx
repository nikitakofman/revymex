import { dragOps } from "../atoms/drag-store";
import { NodeId, useGetNode } from "../atoms/node-store";
import {
  useGetNodeParent,
  useGetNodeChildren,
} from "../atoms/node-store/hierarchy-store";
import { useGetTransform } from "../atoms/canvas-interaction-store";
import { createPlaceholder } from "./createPlaceholder";
import {
  addNode,
  moveNode,
} from "../atoms/node-store/operations/insert-operations";
import { useGetNodeFlags } from "../atoms/node-store";

export const useDragStart = () => {
  const getNode = useGetNode();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getTransform = useGetTransform();
  const getNodeFlags = useGetNodeFlags();

  return (
    e: React.MouseEvent,
    fromToolbarType?: string,
    nodeObj?: { id: NodeId; type?: string }
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!nodeObj?.id) return;

    const nodeId = nodeObj.id;
    const node = getNode(nodeId);
    const nodeType = nodeObj.type || node.type; // Get node type

    // Determine drag source
    const parentId = getNodeParent(nodeId);
    const nodeFlags = getNodeFlags(nodeId);
    const isOnCanvas = !parentId && !nodeFlags.inViewport;

    // Set appropriate drag source
    if (isOnCanvas) {
      dragOps.setDragSource("canvas");
    } else if (nodeFlags.inViewport) {
      dragOps.setDragSource("viewport");
    } else if (fromToolbarType) {
      dragOps.setDragSource("toolbar");
    } else if (nodeFlags.isAbsoluteInFrame) {
      dragOps.setDragSource("absolute-in-frame");
    } else {
      dragOps.setDragSource("parent");
    }

    // Get the element that was clicked
    const element = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!element) return;

    // Get computed style for dimensions and rotation
    const style = window.getComputedStyle(element);
    const width = parseFloat(style.width) || element.offsetWidth;
    const height = parseFloat(style.height) || element.offsetHeight;

    // Detect if we have a pure 2D rotation or more complex transforms
    const transformStr = style.transform || "none";
    const isSimpleRotation =
      !transformStr.includes("skew") &&
      !transformStr.includes("perspective") &&
      !transformStr.includes("3d") &&
      !transformStr.includes("matrix");

    // Get rotation value if it's a simple rotation
    let rotate = "0deg";
    if (isSimpleRotation) {
      rotate =
        style.rotate ||
        (transformStr.includes("rotate") ? transformStr : "0deg");
    }

    const elementRect = element.getBoundingClientRect();

    // Store the grab-offset in screen pixels
    const mouseOffsetX = e.clientX - elementRect.left;
    const mouseOffsetY = e.clientY - elementRect.top;

    // Create placeholder with the same dimensions
    const transform = getTransform();
    const placeholder = createPlaceholder({
      node,
      element,
      transform,
    });

    // Find the parent and position of the dragged node
    if (parentId) {
      const siblings = getNodeChildren(parentId);
      const index = siblings.indexOf(nodeId);

      if (index !== -1) {
        // Add placeholder to parent
        addNode(placeholder.id, parentId);
        // Move placeholder to the exact position
        moveNode(placeholder.id, parentId, index);
      }
    }

    // Start the drag operation
    dragOps.setIsDragging(true);
    dragOps.setDraggedNode(node, {
      x: 0,
      y: 0,
      mouseX: mouseOffsetX,
      mouseY: mouseOffsetY,
      width,
      height,
      rotate,
      isSimpleRotation,
      nodeType,
      placeholderId: placeholder.id, // Store placeholder ID for reference
    });
  };
};
