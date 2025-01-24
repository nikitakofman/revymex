import { SnapGuideLine } from "@/builder/reducer/dragDispatcher";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { LineIndicatorState } from "../builderState";

export interface Transform {
  x: number;
  y: number;
  scale: number;
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

interface DragPos {
  cursorX: number;
  cursorY: number;
  elementX: number;
  elementY: number;
  mouseOffsetX: number;
  mouseOffsetY: number;
}

export const calculateDragPositions = (
  e: MouseEvent | React.MouseEvent,
  element: Element,
  contentRect: DOMRect,
  transform: Transform,
  shouldNegateHeight: boolean = false
): DragPos => {
  const elementRect = element.getBoundingClientRect();

  const mouseOffsetX = e.clientX - elementRect.left;
  const mouseOffsetY = e.clientY - elementRect.top;

  const elementX = (elementRect.left - contentRect.left) / transform.scale;
  const heightOffset =
    shouldNegateHeight && element.closest(".viewport") ? elementRect.height : 0;
  const elementY =
    (elementRect.top - contentRect.top + heightOffset) / transform.scale;

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
  const x = cursorX - elementX - mouseOffsetX;
  const y = cursorY - elementY - mouseOffsetY;
  return { x, y };
};

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
  const draggedW = parseFloat(String(draggedNode.style.width ?? 0)) || 0;
  const draggedH = parseFloat(String(draggedNode.style.height ?? 0)) || 0;

  let snappedLeft = newLeft;
  let snappedTop = newTop;
  const guides: SnapGuideLine[] = [];

  const draggedEdges = {
    left: newLeft,
    right: newLeft + draggedW,
    centerX: newLeft + draggedW / 2,
    top: newTop,
    bottom: newTop + draggedH,
    centerY: newTop + draggedH / 2,
  };

  const otherCanvasNodes = allNodes.filter(
    (n) => !n.inViewport && n.id !== draggedNode.id
  );

  for (const node of otherCanvasNodes) {
    const w = parseFloat(String(node.style.width ?? 0)) || 0;
    const h = parseFloat(String(node.style.height ?? 0)) || 0;
    const left = node.position?.x ?? 0;
    const top = node.position?.y ?? 0;

    const nodeEdges = {
      left,
      right: left + w,
      centerX: left + w / 2,
      top,
      bottom: top + h,
      centerY: top + h / 2,
    };

    if (Math.abs(draggedEdges.left - nodeEdges.left) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.left;
      guides.push({ orientation: "vertical", position: nodeEdges.left });
    }
    if (Math.abs(draggedEdges.right - nodeEdges.right) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.right - draggedW;
      guides.push({ orientation: "vertical", position: nodeEdges.right });
    }
    if (Math.abs(draggedEdges.centerX - nodeEdges.centerX) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.centerX - draggedW / 2;
      guides.push({ orientation: "vertical", position: nodeEdges.centerX });
    }
    if (Math.abs(draggedEdges.left - nodeEdges.right) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.right;
      guides.push({ orientation: "vertical", position: nodeEdges.right });
    }

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
    if (Math.abs(draggedEdges.left - nodeEdges.right) < SNAP_THRESHOLD) {
      snappedLeft = nodeEdges.right;
      guides.push({ orientation: "vertical", position: nodeEdges.right });
    }
    if (Math.abs(draggedEdges.top - nodeEdges.bottom) < SNAP_THRESHOLD) {
      snappedTop = nodeEdges.bottom;
      guides.push({ orientation: "horizontal", position: nodeEdges.bottom });
    }
    if (Math.abs(draggedEdges.bottom - nodeEdges.top) < SNAP_THRESHOLD) {
      snappedTop = nodeEdges.top - draggedH;
      guides.push({ orientation: "horizontal", position: nodeEdges.top });
    }
  }

  return { snappedLeft, snappedTop, guides };
}

export const findIndexWithinParent = (
  nodes: Node[],
  nodeId: string | number,
  parentId: string | number | null | undefined
) => {
  const siblings = nodes.filter((node) => node.parentId === parentId);

  return siblings.findIndex((node) => node.id === nodeId);
};

export const computeFrameDropIndicator = (
  frameElement: Element,
  frameChildren: { id: string | number; rect: DOMRect }[],
  mouseX: number,
  mouseY: number
) => {
  const computedStyle = window.getComputedStyle(frameElement);
  const isColumn = computedStyle.flexDirection === "column";
  const frameRect = frameElement.getBoundingClientRect();

  const firstChild = frameChildren[0];
  if (firstChild) {
    const virtualGap = 10;
    if (isColumn) {
      if (
        mouseY >= frameRect.top &&
        mouseY <= firstChild.rect.top + virtualGap
      ) {
        return {
          dropInfo: {
            targetId: firstChild.id,
            position: "before" as const,
          },
          lineIndicator: {
            show: true,
            x: frameRect.left,
            y: firstChild.rect.top,
            width: frameRect.width,
            height: 1,
          },
        };
      }
    } else {
      if (
        mouseX >= frameRect.left &&
        mouseX <= firstChild.rect.left + virtualGap
      ) {
        return {
          dropInfo: {
            targetId: firstChild.id,
            position: "before" as const,
          },
          lineIndicator: {
            show: true,
            x: firstChild.rect.left,
            y: frameRect.top,
            width: 1,
            height: frameRect.height,
          },
        };
      }
    }
  }

  const lastChild = frameChildren[frameChildren.length - 1];
  if (lastChild) {
    const virtualGap = 5;
    if (isColumn) {
      if (
        mouseY >= lastChild.rect.bottom - virtualGap &&
        mouseY <= frameRect.bottom
      ) {
        return {
          dropInfo: {
            targetId: lastChild.id,
            position: "after" as const,
          },
          lineIndicator: {
            show: true,
            x: frameRect.left,
            y: lastChild.rect.bottom,
            width: frameRect.width,
            height: 1,
          },
        };
      }
    } else {
      if (
        mouseX >= lastChild.rect.right - virtualGap &&
        mouseX <= frameRect.right
      ) {
        return {
          dropInfo: {
            targetId: lastChild.id,
            position: "after" as const,
          },
          lineIndicator: {
            show: true,
            x: lastChild.rect.right,
            y: frameRect.top,
            width: 1,
            height: frameRect.height,
          },
        };
      }
    }
  }

  for (let i = 0; i < frameChildren.length - 1; i++) {
    const currentChild = frameChildren[i];
    const nextChild = frameChildren[i + 1];
    if (!currentChild || !nextChild) continue;

    const virtualGap = 5;
    if (isColumn) {
      const centerY = (currentChild.rect.bottom + nextChild.rect.top) / 2;
      if (Math.abs(mouseY - centerY) <= virtualGap) {
        return {
          dropInfo: {
            targetId: currentChild.id,
            position: "after" as const,
          },
          lineIndicator: {
            show: true,
            x: frameRect.left,
            y: centerY,
            width: frameRect.width,
            height: 1,
          },
        };
      }
    } else {
      const centerX = (currentChild.rect.right + nextChild.rect.left) / 2;
      if (Math.abs(mouseX - centerX) <= virtualGap) {
        return {
          dropInfo: {
            targetId: currentChild.id,
            position: "after" as const,
          },
          lineIndicator: {
            show: true,
            x: centerX,
            y: frameRect.top,
            width: 1,
            height: frameRect.height,
          },
        };
      }
    }
  }

  if (frameChildren.length === 0) {
    return {
      dropInfo: {
        targetId: frameElement.getAttribute("data-node-id")!,
        position: "inside" as const,
      },
      lineIndicator: {
        show: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    };
  }

  return null;
};

export const computeMidPoints = (
  frameElement: Element,
  frameChildren: { rect: DOMRect }[],
  transform: { x: number; y: number; scale: number }
) => {
  const computedStyle = window.getComputedStyle(frameElement);
  const isColumn = computedStyle.flexDirection === "column";
  const frameRect = frameElement.getBoundingClientRect();

  const midPoints = [];

  for (let i = 0; i < frameChildren.length - 1; i++) {
    const currentChild = frameChildren[i];
    const nextChild = frameChildren[i + 1];
    if (!currentChild || !nextChild) continue;

    if (isColumn) {
      const centerY = (currentChild.rect.bottom + nextChild.rect.top) / 2;
      midPoints.push({
        x: (frameRect.left - transform.x) / transform.scale,
        y: (centerY - transform.y) / transform.scale,
        start: currentChild.rect.bottom,
        end: nextChild.rect.top,
      });
    } else {
      const centerX = (currentChild.rect.right + nextChild.rect.left) / 2;
      midPoints.push({
        x: (centerX - transform.x) / transform.scale,
        y: (frameRect.top - transform.y) / transform.scale,
        start: currentChild.rect.right,
        end: nextChild.rect.left,
      });
    }
  }

  return midPoints;
};

export interface ReorderZoneResult {
  targetId: string | number;
  position: "before" | "after";
}

interface ReorderZone {
  id: string | number;
  index: number;
  rect: DOMRect;
  hitRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export const computeSiblingReorderZones = (
  draggedNode: Node,
  siblings: Node[],
  isColumn: boolean,
  mouseX: number,
  mouseY: number
): ReorderZoneResult | null => {
  const BUFFER = 50;

  const siblingZones = siblings
    .map((node, index) => {
      const element = document.querySelector(`[data-node-id="${node.id}"]`);
      if (!element) return null;

      const rect = element.getBoundingClientRect();

      const zone: ReorderZone = {
        id: node.id,
        index,
        rect,
        hitRect: isColumn
          ? {
              top: rect.top,
              bottom: rect.bottom,
              left: 0,
              right: window.innerWidth,
            }
          : {
              top: 0,
              bottom: window.innerHeight,
              left: rect.left,
              right: rect.right,
            },
      };

      return zone;
    })
    .filter((x): x is ReorderZone => x !== null);

  const sortedZones = isColumn
    ? siblingZones.sort((a, b) => a.rect.top - b.rect.top)
    : siblingZones.sort((a, b) => a.rect.left - b.rect.left);

  for (const zone of sortedZones) {
    const mousePos = isColumn ? mouseY : mouseX;
    const zoneStart = isColumn ? zone.rect.top : zone.rect.left;
    const zoneEnd = isColumn ? zone.rect.bottom : zone.rect.right;

    if (mousePos >= zoneStart - BUFFER && mousePos <= zoneEnd + BUFFER) {
      const zoneMiddle = (zoneStart + zoneEnd) / 2;
      const position = mousePos < zoneMiddle ? "before" : "after";

      return {
        targetId: zone.id,
        position,
      };
    }
  }

  return null;
};

export const computeSiblingReorderResult = (
  draggedNode: Node,
  allNodes: Node[],
  parentElement: Element,
  mouseX: number,
  mouseY: number
): ReorderZoneResult | null => {
  const siblings = allNodes.filter(
    (node) =>
      node.parentId === draggedNode.parentId &&
      node.type !== "placeholder" &&
      node.id !== draggedNode.id
  );

  const computedStyle = window.getComputedStyle(parentElement);
  const isColumn = computedStyle.flexDirection?.includes("column");

  return computeSiblingReorderZones(
    draggedNode,
    siblings,
    isColumn,
    mouseX,
    mouseY
  );
};

export const getFilteredElementsUnderMouseDuringDrag = (
  e: MouseEvent,
  draggedNodeId: string | number,
  className: string
): boolean => {
  const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
  const filteredElements = elementsUnder.filter((el) => {
    const isDraggedElement =
      el.getAttribute("data-node-id") === String(draggedNodeId);
    const isChildOfDragged = el.closest(`[data-node-id="${draggedNodeId}"]`);
    return !isDraggedElement && !isChildOfDragged;
  });

  return filteredElements[0].classList.contains(className);
};

export const isWithinViewport = (
  nodeId: string | number | null | undefined,
  nodes: Node[]
): boolean => {
  if (!nodeId) return false;

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;

  if (node.isViewport) return true;

  return node.parentId ? isWithinViewport(node.parentId, nodes) : false;
};

export const findParentViewport = (
  nodeId: string | number | null | undefined,
  nodes: Node[]
): string | number | null => {
  if (!nodeId) return null;
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  if (node.isViewport) return node.id;

  return findParentViewport(node.parentId, nodes);
};
