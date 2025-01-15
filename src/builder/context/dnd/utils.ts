import { DragState, SnapGuideLine } from "@/builder/reducer/dragDispatcher";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { LineIndicatorState } from "../builderState";
import { nanoid } from "nanoid";
export interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface DragPosition {
  cursorX: number;
  cursorY: number;
  elementX: number;
  elementY: number;
  mouseOffsetX: number;
  mouseOffsetY: number;
}

export const getDragPosition = (
  mouseY: number,
  elementRect: DOMRect,
  nodeType: string | null
): "before" | "after" | "inside" => {
  const INSIDE_ZONE = 0.9;
  const EDGE_ZONE = (1 - INSIDE_ZONE) / 2;

  const height = elementRect.height;
  const relativeY = mouseY - elementRect.top;
  const percentage = relativeY / height;

  if (nodeType === "frame") {
    if (percentage < EDGE_ZONE) return "before";
    if (percentage > 1 - EDGE_ZONE) return "after";
    return "inside";
  }

  const middleY = elementRect.top + elementRect.height / 2;
  return mouseY < middleY ? "before" : "after";
};

export const findElementUnderMouse = (
  e: MouseEvent,
  attribute: string
): Element | null => {
  const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
  return (
    elementsUnder.find((el) => el.getAttribute(attribute) !== null) || null
  );
};

export const isUnderClassNameDuringDrag = (
  e: MouseEvent,
  className: string,
  dragState: DragState
) => {
  const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);

  const filteredElements = elementsUnder.filter((el) => {
    const closestNode = el.closest(
      `[data-node-id="${dragState.draggedNode?.node.id}"]`
    );
    return !closestNode;
  });

  return filteredElements[0].className.includes(className);
};

export const isOverDropzone = (e: MouseEvent, className: string): boolean => {
  const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);

  return elementsUnder.some((el) => el.classList.contains(className));
};

export const getDropPosition = (
  mouseY: number,
  elementRect: DOMRect,
  nodeType: string | null
): {
  position: "before" | "after" | "inside";
  lineIndicator: LineIndicatorState;
} => {
  const INSIDE_ZONE = 0.9;
  const EDGE_ZONE = (1 - INSIDE_ZONE) / 2;

  const height = elementRect.height;
  const relativeY = mouseY - elementRect.top;
  const percentage = relativeY / height;

  if (nodeType === "frame") {
    if (percentage < EDGE_ZONE) {
      return {
        position: "before",
        lineIndicator: {
          show: true,
          x: elementRect.left,
          y: elementRect.top,
          width: elementRect.width,
          height: "2px",
        },
      };
    }
    if (percentage > 1 - EDGE_ZONE) {
      return {
        position: "after",
        lineIndicator: {
          show: true,
          x: elementRect.left,
          y: elementRect.bottom,
          width: elementRect.width,
          height: "2px",
        },
      };
    }
    return {
      position: "inside",
      lineIndicator: {
        show: true,
        x: elementRect.left,
        y: elementRect.top,
        width: "2px",
        height: elementRect.height,
      },
    };
  }

  const middleY = elementRect.top + elementRect.height / 2;
  const position = mouseY < middleY ? "before" : "after";

  return {
    position,
    lineIndicator: {
      show: true,
      x: elementRect.left,
      y: position === "before" ? elementRect.top : elementRect.bottom,
      width: elementRect.width,
      height: "2px",
    },
  };
};

export const getDropTarget = (e: MouseEvent) => {
  const nodeElement = findElementUnderMouse(e, "data-node-id");
  if (!nodeElement) {
    return { targetId: null, position: null };
  }

  const nodeId = parseInt(nodeElement.getAttribute("data-node-id")!);
  const nodeType = nodeElement.getAttribute("data-node-type");

  const position = getDragPosition(
    e.clientY,
    nodeElement.getBoundingClientRect(),
    nodeType
  );

  return { targetId: nodeId, position };
};

export const handleCanvasDrop = (
  e: MouseEvent,
  contentRef: React.RefObject<HTMLDivElement | null>,
  transform: { x: number; y: number; scale: number }
) => {
  const canvasRect = contentRef.current?.getBoundingClientRect();
  if (!canvasRect) return;

  const x = (e.clientX - canvasRect.left - transform.x) / transform.scale;
  const y = (e.clientY - canvasRect.top - transform.y) / transform.scale;

  return { x, y };
};

export const calculateTransformedPosition = (
  e: MouseEvent | React.MouseEvent,
  contentRef: React.RefObject<HTMLDivElement | null>,
  transform: { x: number; y: number; scale: number }
) => {
  if (!contentRef.current) return null;

  const contentRect = contentRef.current.getBoundingClientRect();

  const mouseX = (e.clientX - contentRect.left) / transform.scale;
  const mouseY = (e.clientY - contentRect.top) / transform.scale;

  return { mouseX, mouseY };
};

export const calculateNodeOffset = (
  e: React.MouseEvent,
  nodeElement: HTMLElement,
  contentRef: React.RefObject<HTMLDivElement | null>,
  transform: { x: number; y: number; scale: number }
) => {
  if (!contentRef.current) return null;

  const contentRect = contentRef.current.getBoundingClientRect();

  const mouseX = (e.clientX - contentRect.left) / transform.scale;
  const mouseY = (e.clientY - contentRect.top) / transform.scale;

  const rect = nodeElement.getBoundingClientRect();
  const nodeX = (rect.left - contentRect.left) / transform.scale;
  const nodeY = (rect.top - contentRect.top) / transform.scale;

  return {
    x: mouseX - nodeX,
    y: mouseY - nodeY,
  };
};

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface DragPosition {
  mouseOffsetX: number;
  mouseOffsetY: number;
  elementX: number;
  elementY: number;
}

export const calculateDragPositions = (
  e: MouseEvent | React.MouseEvent,
  element: Element,
  contentRect: DOMRect,
  transform: Transform,
  shouldNegateHeight: boolean = false
): DragPosition => {
  const elementRect = element.getBoundingClientRect();

  // Where is the mouse relative to the top-left of the element?
  const mouseOffsetX = e.clientX - elementRect.left;
  const mouseOffsetY = e.clientY - elementRect.top;

  // Where is the element relative to the content's top-left?
  const elementX = (elementRect.left - contentRect.left) / transform.scale;

  // Optionally negate the element's height.
  const heightOffset =
    shouldNegateHeight && element.closest(".viewport") ? elementRect.height : 0;

  const elementY =
    (elementRect.top - contentRect.top + heightOffset) / transform.scale;

  // Where is the mouse relative to the content's top-left?
  const cursorX = (e.clientX - contentRect.left) / transform.scale;
  const cursorY = (e.clientY - contentRect.top) / transform.scale;

  return {
    cursorX,
    cursorY,
    elementX,
    elementY,
    mouseOffsetX: mouseOffsetX / transform.scale,
    mouseOffsetY: mouseOffsetY / transform.scale,
  };
};

export const calculateDragTransform = (
  cursorX: number,
  cursorY: number,
  elementX: number,
  elementY: number,
  mouseOffsetX: number,
  mouseOffsetY: number
) => {
  // The difference = how far the mouse has moved from the element's initial position
  const x = cursorX - elementX - mouseOffsetX;
  const y = cursorY - elementY - mouseOffsetY;

  return { x, y };
};

export function findAndRemove(
  arr: Node[],
  nodeId: string | number
): [Node[] | null, Node | null] {
  const idx = arr.findIndex((n) => n.id === nodeId);
  if (idx !== -1) {
    const removedNode = arr.splice(idx, 1)[0];
    return [arr, removedNode];
  }

  for (const n of arr) {
    if (n.children) {
      const [foundArr, removed] = findAndRemove(n.children, nodeId);
      if (removed) return [foundArr, removed];
    }
  }
  return [null, null];
}

export function reorderWithinSameParent(
  rootArray: Node[],
  nodeId: string | number,
  targetId: string | number,
  position: "before" | "after"
): boolean {
  const [nodeParentArray, removedNode] = findAndRemove(rootArray, nodeId);
  if (!nodeParentArray || !removedNode) {
    return false;
  }

  const targetIndex = nodeParentArray.findIndex((n) => n.id === targetId);
  if (targetIndex === -1) {
    nodeParentArray.push(removedNode);
    return false;
  }

  const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
  nodeParentArray.splice(insertIndex, 0, removedNode);
  return true;
}

export function findNodeById(arr: Node[], id: string | number): Node | null {
  for (const node of arr) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export const findIndex = (nodes: Node[], nodeId: string | number) => {
  return nodes.findIndex((n) => n.id === nodeId);
};

export const findViewportSibling = (
  elementsUnder: Element[],
  draggedNodeId?: string | number,
  excludeTypes: string[] = ["placeholder"]
) => {
  const siblingElement = elementsUnder.find((el) => {
    if (!el.hasAttribute("data-node-id")) return false;
    if (
      draggedNodeId &&
      el.getAttribute("data-node-id") === String(draggedNodeId)
    )
      return false;
    return !excludeTypes.includes(el.getAttribute("data-node-type") || "");
  });

  if (!siblingElement) return null;

  return {
    id: parseInt(siblingElement.getAttribute("data-node-id")!, 10),
    type: siblingElement.getAttribute("data-node-type"),
    rect: siblingElement.getBoundingClientRect(),
  };
};

export const getFilteredElementsUnder = (
  e: MouseEvent,
  draggedNodeId: string | number
) => {
  const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
  return elementsUnder.filter((el) => {
    const closestNode = el.closest(`[data-node-id="${draggedNodeId}"]`);
    return !closestNode;
  });
};

export const createPlaceholderNode = (
  width: string | number,
  height: string | number
): Node => ({
  id: nanoid(),
  type: "placeholder",
  style: {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    backgroundColor: "rgba(0,153,255,0.8)",
    position: "relative",
  },
  inViewport: true,
});

export const findAndRemovePlaceholder = (
  nodes: Node[],
  originalIndexRef: React.MutableRefObject<number | null>
) => {
  const placeholder = nodes.find((n) => n.type === "placeholder");
  if (placeholder) {
    if (originalIndexRef.current === null) {
      originalIndexRef.current = nodes.findIndex(
        (n) => n.type === "placeholder"
      );
    }
    return placeholder.id;
  }
  return null;
};

export const getNodeFixedStyle = (
  x: number,
  y: number,
  options?: {
    zIndex?: number;
    pointerEvents?: "none" | "auto";
  }
) => ({
  position: "fixed" as const,
  left: `${x}px`,
  top: `${y}px`,
  zIndex: options?.zIndex ?? 1000,
  pointerEvents: options?.pointerEvents,
});

export const getNodeResetStyle = () => ({
  position: "relative" as const,
  zIndex: "",
  transform: "",
  left: "",
  top: "",
});

interface SnapResult {
  snappedLeft: number;
  snappedTop: number;
  guides: SnapGuideLine[];
}

const SNAP_THRESHOLD = 10;

export function computeSnapAndGuides(
  newLeft: number,
  newTop: number,
  draggedNode: Node,
  allNodes: Node[]
): SnapResult {
  // Parse numeric width/height from node's style
  const draggedW = parseFloat(String(draggedNode.style.width ?? 0)) || 0;
  const draggedH = parseFloat(String(draggedNode.style.height ?? 0)) || 0;

  let snappedLeft = newLeft;
  let snappedTop = newTop;
  const guides: SnapGuideLine[] = [];

  // The dragged node's edges
  const draggedEdges = {
    left: newLeft,
    right: newLeft + draggedW,
    centerX: newLeft + draggedW / 2,
    top: newTop,
    bottom: newTop + draggedH,
    centerY: newTop + draggedH / 2,
  };

  // Filter the "other" out-of-viewport nodes
  const otherCanvasNodes = allNodes.filter(
    (n) => !n.inViewport && n.id !== draggedNode.id
  );

  for (const node of otherCanvasNodes) {
    const w = parseFloat(String(node.style.width ?? 0)) || 0;
    const h = parseFloat(String(node.style.height ?? 0)) || 0;
    const left = node.position?.x ?? 0;
    const top = node.position?.y ?? 0;

    // The other node's edges
    const nodeEdges = {
      left,
      right: left + w,
      centerX: left + w / 2,
      top,
      bottom: top + h,
      centerY: top + h / 2,
    };

    // For each combination: if distance < SNAP_THRESHOLD, snap & record line
    // EXAMPLE: Dragged left vs. Node left
    if (Math.abs(draggedEdges.left - nodeEdges.left) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.left; // snap
      guides.push({ orientation: "vertical", position: nodeEdges.left });
    }
    // Dragged right vs. Node right
    if (Math.abs(draggedEdges.right - nodeEdges.right) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.right - draggedW;
      guides.push({ orientation: "vertical", position: nodeEdges.right });
    }
    // Dragged centerX vs. Node centerX
    if (Math.abs(draggedEdges.centerX - nodeEdges.centerX) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.centerX - draggedW / 2;
      guides.push({ orientation: "vertical", position: nodeEdges.centerX });
    }
    // Dragged left vs. Node right
    if (Math.abs(draggedEdges.left - nodeEdges.right) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.right;
      guides.push({ orientation: "vertical", position: nodeEdges.right });
    }
    // etc. You can keep adding more combos like dragged.right vs. node.left

    // Now do the same for top/bottom/centerY
    if (Math.abs(draggedEdges.top - nodeEdges.top) < SNAP_THRESHOLD) {
      snappedTop = nodeEdges.top;
      guides.push({ orientation: "horizontal", position: nodeEdges.top });
    }
    if (Math.abs(draggedEdges.bottom - nodeEdges.bottom) < SNAP_THRESHOLD) {
      snappedTop = nodeEdges.bottom - draggedH;
      guides.push({ orientation: "horizontal", position: nodeEdges.bottom });
    }
    if (Math.abs(draggedEdges.centerY - nodeEdges.centerY) < SNAP_THRESHOLD) {
      snappedTop = nodeEdges.centerY - draggedH / 2;
      guides.push({ orientation: "horizontal", position: nodeEdges.centerY });
    }

    if (Math.abs(draggedEdges.right - nodeEdges.left) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.left - draggedW;
      guides.push({ orientation: "vertical", position: nodeEdges.left });
    }

    // "dragged left" near "node right"
    if (Math.abs(draggedEdges.left - nodeEdges.right) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.right;
      guides.push({ orientation: "vertical", position: nodeEdges.right });
    }

    if (Math.abs(draggedEdges.top - nodeEdges.bottom) < SNAP_THRESHOLD) {
      snappedTop = nodeEdges.bottom;
      guides.push({ orientation: "horizontal", position: nodeEdges.bottom });
    }

    // dragged bottom near node top
    if (Math.abs(draggedEdges.bottom - nodeEdges.top) < SNAP_THRESHOLD) {
      snappedTop = nodeEdges.top - draggedH;
      guides.push({ orientation: "horizontal", position: nodeEdges.top });
    }
  }

  // Possibly deduplicate guides if you don't want repeated lines
  // ...

  return { snappedLeft, snappedTop, guides };
}
