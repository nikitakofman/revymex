import { dragOps } from "../atoms/drag-store";
import { NodeId, useGetNode, useGetNodeStyle } from "../atoms/node-store";
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
import { getDimensionUnits, convertDimensionsToPx } from "./dnd-utils";

export const useDragStart = () => {
  const getNode = useGetNode();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getTransform = useGetTransform();
  const getNodeFlags = useGetNodeFlags();
  const getNodeStyle = useGetNodeStyle();

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
    const nodeType = nodeObj.type || node.type;
    const nodeStyle = getNodeStyle(nodeId);
    const nodeFlags = getNodeFlags(nodeId);

    const parentId = getNodeParent(nodeId);
    const isOnCanvas = !parentId && !nodeFlags.inViewport;

    // Check isAbsoluteInFrame from style instead of flags
    // Include both absolute and fixed as "absolute in frame" for drag handling
    const isAbsoluteInFrame =
      (nodeStyle.isAbsoluteInFrame === "true" ||
        nodeStyle.position === "fixed" ||
        nodeStyle.position === "absolute") &&
      parentId;

    // Simplified drag source determination
    if (isOnCanvas) {
      dragOps.setDragSource("canvas");
    } else if (
      nodeFlags.inViewport &&
      nodeStyle.isAbsoluteInFrame !== "true" &&
      nodeStyle.position !== "fixed" &&
      nodeStyle.position !== "absolute"
    ) {
      dragOps.setDragSource("viewport");
    } else if (fromToolbarType) {
      dragOps.setDragSource("toolbar");
    } else if (isAbsoluteInFrame) {
      // Use "absolute-in-frame" for both absolute and fixed
      dragOps.setDragSource("absolute-in-frame");
    } else {
      dragOps.setDragSource("parent");
    }

    const element = document.querySelector(
      `[data-node-id="${nodeId}"]`
    ) as HTMLElement;
    if (!element) return;

    const dimensionUnits = getDimensionUnits(element, node.style);

    // Only convert dimensions for non-absolute elements
    const needsConversion = parentId && !isOnCanvas && !isAbsoluteInFrame;
    if (needsConversion) {
      convertDimensionsToPx(nodeId, element, dimensionUnits);
    }

    const style = window.getComputedStyle(element);
    const width = parseFloat(style.width) || element.offsetWidth;
    const height = parseFloat(style.height) || element.offsetHeight;

    const transformStr = style.transform || "none";
    const isSimpleRotation =
      !transformStr.includes("skew") &&
      !transformStr.includes("perspective") &&
      !transformStr.includes("3d") &&
      !transformStr.includes("matrix");

    let rotate = "0deg";
    if (isSimpleRotation) {
      rotate =
        style.rotate ||
        (transformStr.includes("rotate") ? transformStr : "0deg");
    }

    const elementRect = element.getBoundingClientRect();

    const mouseOffsetX = e.clientX - elementRect.left;
    const mouseOffsetY = e.clientY - elementRect.top;

    const transform = getTransform();

    let placeholder = null;

    // Only create placeholder for non-absolute elements
    if (!isAbsoluteInFrame && !isOnCanvas) {
      placeholder = createPlaceholder({
        node,
        element,
        transform,
      });

      if (parentId) {
        const siblings = getNodeChildren(parentId);
        const index = siblings.indexOf(nodeId);

        if (index !== -1) {
          addNode(placeholder.id, parentId);
          moveNode(placeholder.id, parentId, index);
        }
      }
    }

    // Capture initial position for absolute/fixed elements
    let initialLeft = 0;
    let initialTop = 0;

    if (isAbsoluteInFrame && parentId) {
      // Get the current position
      initialLeft = parseFloat(style.left) || 0;
      initialTop = parseFloat(style.top) || 0;
    }

    // Remember original position type to maintain it during the drag
    const originalPositionType = nodeStyle.position || "static";

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
      placeholderId: placeholder?.id,
      startingParentId: parentId,
      dimensionUnits,
      isAbsoluteInFrame,
      originalPositionType, // Store the original position type to maintain it
      initialPosition: {
        left: initialLeft,
        top: initialTop,
      },
    });
  };
};
