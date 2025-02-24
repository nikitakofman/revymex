import { DragState, SnapGuideLine } from "@/builder/reducer/dragDispatcher";
import {
  Node,
  NodeDispatcher,
  NodeState,
} from "@/builder/reducer/nodeDispatcher";
import { LineIndicatorState } from "./builderState";
import { HTMLAttributes } from "react";
import { createPlaceholder } from "./createPlaceholder";

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export type Direction =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "topRight"
  | "bottomRight"
  | "bottomLeft"
  | "topLeft";

export interface ResizableWrapperProps {
  node: Node;
  children: React.ReactElement<HTMLAttributes<HTMLElement>>;
  minWidth?: number;
  minHeight?: number;
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
  const elementCenter = elementRect.top + elementRect.height / 2;
  const isTopHalf = mouseY < elementCenter;

  if (nodeType === "frame") {
    // For frames, check if we're in the middle zone
    const middleZoneSize = elementRect.height * 0.4; // 40% of height is middle zone
    const middleZoneStart = elementCenter - middleZoneSize / 2;
    const middleZoneEnd = elementCenter + middleZoneSize / 2;

    if (mouseY >= middleZoneStart && mouseY <= middleZoneEnd) {
      return {
        position: "inside",
        lineIndicator: {
          show: false,
          x: elementRect.left,
          y: elementRect.top,
          width: "2px",
          height: elementRect.height,
        },
      };
    }
  }

  // For all elements (including frames when not in middle zone)
  if (isTopHalf) {
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
  } else {
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
  inViewport?: boolean
): DragPos => {
  const elementRect = element.getBoundingClientRect();

  const mouseOffsetX = e.clientX - elementRect.left;
  const mouseOffsetY = e.clientY - elementRect.top;

  const elementX =
    (elementRect.left - contentRect.left - transform.x) / transform.scale;
  const heightOffset = inViewport ? elementRect.height : 0;
  const elementY =
    (elementRect.top - contentRect.top - transform.y + heightOffset) /
    transform.scale;

  const cursorX =
    (e.clientX - contentRect.left - transform.x) / transform.scale;
  const cursorY = (e.clientY - contentRect.top - transform.y) / transform.scale;

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
  allNodes: Node[],
  dynamicModeNodeId?: string | number | null
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

  const nodesToSnap = allNodes.filter((n) => {
    if (n.inViewport || n.id === draggedNode.id) return false;

    if (dynamicModeNodeId) {
      return (
        n.id === dynamicModeNodeId || n.dynamicParentId === dynamicModeNodeId
      );
    }

    return !n.inViewport;
  });

  for (const node of nodesToSnap) {
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
  const siblings = nodes.filter(
    (node) =>
      node.parentId === parentId &&
      (node.type === "placeholder" || node.type !== "placeholder")
  );
  const index = siblings.findIndex((node) => node.id === nodeId);
  return index;
};

export const computeFrameDropIndicator = (
  frameElement: Element,
  frameChildren: { id: string; rect: DOMRect }[],
  mouseX: number,
  mouseY: number
) => {
  const frameRect = frameElement.getBoundingClientRect();
  const frameId = frameElement.getAttribute("data-node-id")!;
  const computedStyle = window.getComputedStyle(frameElement);
  const isColumn = computedStyle.flexDirection === "column";

  if (frameChildren.length === 0) {
    return {
      dropInfo: {
        targetId: frameId,
        position: "inside" as const,
      },
      lineIndicator: {
        show: false,
      },
    };
  }

  // Sort children by position
  const sortedChildren = [...frameChildren].sort((a, b) =>
    isColumn ? a.rect.top - b.rect.top : a.rect.left - b.rect.left
  );

  // Find the gaps between children
  const gaps = [];
  for (let i = 0; i < sortedChildren.length - 1; i++) {
    const current = sortedChildren[i];
    const next = sortedChildren[i + 1];

    if (isColumn) {
      const gapCenter = (current.rect.bottom + next.rect.top) / 2;
      gaps.push({
        center: gapCenter,
        firstId: current.id,
        secondId: next.id,
        region: {
          start: current.rect.top + current.rect.height / 2, // Start from middle of first element
          end: next.rect.top + next.rect.height / 2, // End at middle of second element
        },
      });
    } else {
      const gapCenter = (current.rect.right + next.rect.left) / 2;
      gaps.push({
        center: gapCenter,
        firstId: current.id,
        secondId: next.id,
        region: {
          start: current.rect.left + current.rect.width / 2, // Start from middle of first element
          end: next.rect.left + next.rect.width / 2, // End at middle of second element
        },
      });
    }
  }

  // Find which gap region we're in
  for (const gap of gaps) {
    const isInRegion = isColumn
      ? mouseY >= gap.region.start && mouseY <= gap.region.end
      : mouseX >= gap.region.start && mouseX <= gap.region.end;

    if (isInRegion) {
      return {
        dropInfo: {
          targetId: gap.secondId.toString(),
          position: "before",
        },
        lineIndicator: {
          show: true,
          x: isColumn ? frameRect.left : gap.center,
          y: isColumn ? gap.center : frameRect.top,
          width: isColumn ? frameRect.width : "2px",
          height: isColumn ? "2px" : frameRect.height,
        },
      };
    }
  }

  // If we're not in any gap region, find the nearest child
  const hoveredChild = sortedChildren.find(({ rect }) => {
    if (isColumn) {
      return mouseY < rect.top + rect.height / 2;
    } else {
      return mouseX < rect.left + rect.width / 2;
    }
  });

  if (hoveredChild) {
    // We're before the middle of this child
    return {
      dropInfo: {
        targetId: hoveredChild.id.toString(),
        position: "before",
      },
      lineIndicator: {
        show: true,
        x: isColumn ? frameRect.left : hoveredChild.rect.left,
        y: isColumn ? hoveredChild.rect.top : frameRect.top,
        width: isColumn ? frameRect.width : "2px",
        height: isColumn ? "2px" : frameRect.height,
      },
    };
  } else {
    // We're after the middle of the last child
    const lastChild = sortedChildren[sortedChildren.length - 1];
    return {
      dropInfo: {
        targetId: lastChild.id.toString(),
        position: "after",
      },
      lineIndicator: {
        show: true,
        x: isColumn ? frameRect.left : lastChild.rect.right,
        y: isColumn ? lastChild.rect.bottom : frameRect.top,
        width: isColumn ? frameRect.width : "2px",
        height: isColumn ? "2px" : frameRect.height,
      },
    };
  }
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
  mouseY: number,
  prevMouseX: number,
  prevMouseY: number,
  display: string = "flex"
): ReorderZoneResult | null => {
  const siblingZones: ReorderZone[] = siblings
    .map((node, index) => {
      const element = document.querySelector(`[data-node-id="${node.id}"]`);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { id: node.id, index, rect };
    })
    .filter((x): x is ReorderZone => x !== null);

  if (siblingZones.length === 0) return null;

  // Grid-specific handling
  if (display === "grid") {
    // Find elements under the mouse
    const zonesUnder = siblingZones.filter(
      (zone) =>
        mouseX >= zone.rect.left &&
        mouseX <= zone.rect.right &&
        mouseY >= zone.rect.top &&
        mouseY <= zone.rect.bottom
    );

    if (zonesUnder.length === 0) return null;

    const dx = mouseX - prevMouseX;
    const dy = mouseY - prevMouseY;
    const isMovingHorizontally = Math.abs(dx) > Math.abs(dy);

    if (isMovingHorizontally) {
      if (dx > 0) {
        // Moving right
        const chosenZone = zonesUnder.reduce((prev, curr) =>
          curr.rect.left < prev.rect.left ? curr : prev
        );
        return { targetId: chosenZone.id, position: "after" };
      } else if (dx < 0) {
        // Moving left
        const chosenZone = zonesUnder.reduce((prev, curr) =>
          curr.rect.right > prev.rect.right ? curr : prev
        );
        return { targetId: chosenZone.id, position: "before" };
      }
    } else {
      if (dy > 0) {
        // Moving down
        const chosenZone = zonesUnder.reduce((prev, curr) =>
          curr.rect.top < prev.rect.top ? curr : prev
        );
        return { targetId: chosenZone.id, position: "after" };
      } else if (dy < 0) {
        // Moving up
        const chosenZone = zonesUnder.reduce((prev, curr) =>
          curr.rect.bottom > prev.rect.bottom ? curr : prev
        );
        return { targetId: chosenZone.id, position: "before" };
      }
    }

    // If no movement, use distance to center
    const chosenZone = zonesUnder.reduce((prev, curr) => {
      const prevCenterX = (prev.rect.left + prev.rect.right) / 2;
      const prevCenterY = (prev.rect.top + prev.rect.bottom) / 2;
      const currCenterX = (curr.rect.left + curr.rect.right) / 2;
      const currCenterY = (curr.rect.top + curr.rect.bottom) / 2;

      const prevDist = Math.sqrt(
        Math.pow(mouseX - prevCenterX, 2) + Math.pow(mouseY - prevCenterY, 2)
      );
      const currDist = Math.sqrt(
        Math.pow(mouseX - currCenterX, 2) + Math.pow(mouseY - currCenterY, 2)
      );

      return currDist < prevDist ? curr : prev;
    });

    // Determine position based on which half of the element we're in
    const centerX = (chosenZone.rect.left + chosenZone.rect.right) / 2;
    const centerY = (chosenZone.rect.top + chosenZone.rect.bottom) / 2;

    if (isMovingHorizontally) {
      return {
        targetId: chosenZone.id,
        position: mouseX < centerX ? "before" : "after",
      };
    } else {
      return {
        targetId: chosenZone.id,
        position: mouseY < centerY ? "before" : "after",
      };
    }
  }

  // Original flex layout handling
  let zonesUnder: ReorderZone[];
  if (isColumn) {
    zonesUnder = siblingZones.filter(
      (zone) => mouseY >= zone.rect.top && mouseY <= zone.rect.bottom
    );
  } else {
    zonesUnder = siblingZones.filter(
      (zone) => mouseX >= zone.rect.left && mouseX <= zone.rect.right
    );
  }
  if (zonesUnder.length === 0) return null;

  if (isColumn) {
    if (mouseY > prevMouseY) {
      const chosenZone = zonesUnder.reduce((prev, curr) =>
        curr.rect.top < prev.rect.top ? curr : prev
      );
      return { targetId: chosenZone.id, position: "after" };
    } else if (mouseY < prevMouseY) {
      const chosenZone = zonesUnder.reduce((prev, curr) =>
        curr.rect.bottom > prev.rect.bottom ? curr : prev
      );
      return { targetId: chosenZone.id, position: "before" };
    } else {
      const chosenZone = zonesUnder.reduce((prev, curr) => {
        const prevCenter = (prev.rect.top + prev.rect.bottom) / 2;
        const currCenter = (curr.rect.top + curr.rect.bottom) / 2;
        return Math.abs(mouseY - currCenter) < Math.abs(mouseY - prevCenter)
          ? curr
          : prev;
      });
      const centerY = (chosenZone.rect.top + chosenZone.rect.bottom) / 2;
      return {
        targetId: chosenZone.id,
        position: mouseY < centerY ? "before" : "after",
      };
    }
  } else {
    if (mouseX > prevMouseX) {
      const chosenZone = zonesUnder.reduce((prev, curr) =>
        curr.rect.left < prev.rect.left ? curr : prev
      );
      return { targetId: chosenZone.id, position: "after" };
    } else if (mouseX < prevMouseX) {
      const chosenZone = zonesUnder.reduce((prev, curr) =>
        curr.rect.right > prev.rect.right ? curr : prev
      );
      return { targetId: chosenZone.id, position: "before" };
    } else {
      const chosenZone = zonesUnder.reduce((prev, curr) => {
        const prevCenter = (prev.rect.left + prev.rect.right) / 2;
        const currCenter = (curr.rect.left + curr.rect.right) / 2;
        return Math.abs(mouseX - currCenter) < Math.abs(mouseX - prevCenter)
          ? curr
          : prev;
      });
      const centerX = (chosenZone.rect.left + chosenZone.rect.right) / 2;
      return {
        targetId: chosenZone.id,
        position: mouseX < centerX ? "before" : "after",
      };
    }
  }
};

export const computeGridReorderResult = (
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

  const parentRect = parentElement.getBoundingClientRect();
  const gridComputedStyle = window.getComputedStyle(parentElement);
  const columns = gridComputedStyle.gridTemplateColumns.split(" ").length;
  const cellWidth = parentRect.width / columns;
  const cellHeight = parentRect.height / Math.ceil(siblings.length / columns);

  // Get all grid item positions
  const gridItems = siblings
    .map((node, index) => {
      const element = document.querySelector(`[data-node-id="${node.id}"]`);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const row = Math.floor(index / columns);
      const col = index % columns;
      return {
        id: node.id,
        index,
        rect,
        gridPosition: { row, col },
        center: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (gridItems.length === 0) return null;

  // Find the closest grid cell based on mouse position
  const mouseRelativeX = mouseX - parentRect.left;
  const mouseRelativeY = mouseY - parentRect.top;
  const targetCol = Math.floor(mouseRelativeX / cellWidth);
  const targetRow = Math.floor(mouseRelativeY / cellHeight);

  // Find the closest item to insert before/after
  let closestItem = gridItems[0];
  let minDistance = Number.MAX_VALUE;
  let position: "before" | "after" = "before";

  gridItems.forEach((item) => {
    const dx = mouseX - item.center.x;
    const dy = mouseY - item.center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      closestItem = item;

      // Determine if we should insert before or after based on the mouse position
      // relative to the item's center
      if (columns === 1) {
        // For single column, use vertical position
        position = mouseY < item.center.y ? "before" : "after";
      } else {
        // For multiple columns, use both x and y to determine position
        const itemRow = Math.floor(item.index / columns);
        const itemCol = item.index % columns;

        if (targetRow === itemRow) {
          // Same row - use horizontal position
          position =
            mouseRelativeX < item.center.x - parentRect.left
              ? "before"
              : "after";
        } else {
          // Different row - use vertical position
          position = targetRow < itemRow ? "before" : "after";
        }
      }
    }
  });

  return {
    targetId: closestItem.id,
    position,
  };
};

// Now modify the existing computeSiblingReorderResult to handle grid layouts
export const computeSiblingReorderResult = (
  draggedNode: Node,
  allNodes: Node[],
  parentElement: Element,
  mouseX: number,
  mouseY: number,
  prevMouseX: number,
  prevMouseY: number
): ReorderZoneResult | null => {
  const computedStyle = window.getComputedStyle(parentElement);
  const display = computedStyle.display;
  const isColumn = computedStyle.flexDirection?.includes("column") || false;

  const siblings = allNodes.filter(
    (node) =>
      node.parentId === draggedNode.parentId &&
      node.type !== "placeholder" &&
      node.id !== draggedNode.id
  );

  return computeSiblingReorderZones(
    draggedNode,
    siblings,
    isColumn,
    mouseX,
    mouseY,
    prevMouseX,
    prevMouseY,
    display
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

export const getHandleCursor = (direction: Direction): string => {
  switch (direction) {
    case "top":
    case "bottom":
      return "ns-resize";
    case "left":
    case "right":
      return "ew-resize";
    case "topLeft":
    case "bottomRight":
      return "nwse-resize";
    case "topRight":
    case "bottomLeft":
      return "nesw-resize";
    default:
      return "pointer";
  }
};

export const rgbToHex = (rgb: string): string => {
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return rgb;

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export const parentHasRotate = (node: Node, nodeState: NodeState): boolean => {
  if (!node) return false;

  let currentId = node.parentId;

  while (currentId) {
    const ancestor = document.querySelector(`[data-node-id="${currentId}"]`);
    if (!ancestor) break;

    if (window.getComputedStyle(ancestor).rotate !== "none") {
      return true;
    }

    if (!nodeState) break;

    const parentNode = nodeState.nodes.find((n) => n.id === currentId);
    currentId = parentNode?.parentId;
  }

  return false;
};

export const calculateRotationCalibration = (
  rotation: string | number | undefined,
  transform: { scale: number },
  width: number = 0,
  height: number = 0
) => {
  const rotationDeg = parseRotation(rotation as string);
  const rotationRad = ((rotationDeg % 360) * Math.PI) / 180;

  const baseCalibration = 1;
  const peakCalibration = 100;

  const referenceSize = 500;
  const sizeFactor = Math.abs(
    ((width + height) / 2 - referenceSize) / referenceSize
  );

  const diagonalFactor = Math.abs(Math.sin(2 * rotationRad));

  const combinedFactor = diagonalFactor * (1 + sizeFactor);

  const calibrationX =
    (baseCalibration + (peakCalibration - baseCalibration) * combinedFactor) *
    transform.scale;
  const calibrationY =
    (baseCalibration + (peakCalibration - baseCalibration) * combinedFactor) *
    transform.scale;

  return { calibrationX, calibrationY };
};

export const getCalibrationAdjustedPosition = (
  position: { x: number; y: number },
  rotation: string | number | undefined,
  transform: { scale: number }
) => {
  const { calibrationX, calibrationY } = calculateRotationCalibration(
    rotation,
    transform
  );

  return {
    x: position.x + calibrationX / transform.scale,
    y: position.y + calibrationY / transform.scale,
  };
};

//@ts-expect-error - unused
export function rotatePoint(x, y, angleDeg) {
  const rad = (Math.PI / 180) * angleDeg;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

//@ts-expect-error - unused
export function inverseRotatePoint(x, y, angleDeg) {
  return rotatePoint(x, y, -angleDeg);
}

export const parseRotation = (rotate: string) => {
  if (typeof rotate === "string" && rotate.endsWith("deg")) {
    return parseFloat(rotate);
  }
  if (typeof rotate === "number") {
    return rotate;
  }
  return 0;
};

export const calculateRotationOffset = (node: Node) => {
  const width = parseFloat(node.style.width as string) || 0;
  const height = parseFloat(node.style.height as string) || 0;
  const rotationDeg = parseRotation(node.style.rotate as string);
  const rotationRad = (rotationDeg * Math.PI) / 180;

  const effectiveHeight =
    Math.abs(height * Math.cos(rotationRad)) +
    Math.abs(width * Math.sin(rotationRad));
  const effectiveWidth =
    Math.abs(width * Math.cos(rotationRad)) +
    Math.abs(height * Math.sin(rotationRad));

  return {
    offsetX: (effectiveWidth - width) * 0.5,
    offsetY: (effectiveHeight - height) * 0.5,
  };
};

export function getFilteredNodes(
  nodes: Node[],
  mode: "dynamicMode" | "inViewport" | "outOfViewport",
  dynamicModeNodeId: string | number | null | undefined
): Node[] {
  return nodes.filter((node: Node) => {
    if (mode === "dynamicMode") {
      return (
        node.id === dynamicModeNodeId ||
        node.dynamicParentId === dynamicModeNodeId
      );
    }

    if (node.dynamicParentId) {
      return false;
    }

    if (mode === "inViewport") {
      return node.inViewport === true;
    } else if (mode === "outOfViewport") {
      return node.inViewport === false;
    }

    return true;
  });
}

// dragFrameUtils.ts
export const handleFrameDropInteraction = (
  frameElement: Element,
  frameChildren: { id: string | number; rect: DOMRect }[],
  mouseX: number,
  mouseY: number,
  draggedNode: Node,
  nodeState: { nodes: Node[] },
  dragDisp: any,
  dragState: DragState,
  canvasX: number,
  canvasY: number
) => {
  const frameId = frameElement.getAttribute("data-node-id")!;
  const targetNode = nodeState.nodes.find((n) => String(n.id) === frameId);

  if (targetNode?.isDynamic && !dragState.dynamicModeNodeId) {
    dragDisp.setDropInfo(null, null, canvasX, canvasY);
    return;
  }

  const result = computeFrameDropIndicator(
    frameElement,
    frameChildren,
    mouseX,
    mouseY
  );

  if (result) {
    dragDisp.setDropInfo(
      result.dropInfo.targetId,
      result.dropInfo.position,
      canvasX,
      canvasY
    );
    if (result.lineIndicator.show) {
      dragDisp.setLineIndicator(result.lineIndicator);
    } else {
      dragDisp.hideLineIndicator();
    }
  }
};

// dragViewportUtils.ts
export const handleViewportTransition = (
  isOverViewportArea: boolean,
  hasLeftViewportRef: { current: boolean },
  originalViewportDataRef: any,
  dragState: DragState,
  nodeState: { nodes: Node[] },
  dragDisp: any,
  nodeDisp: NodeDispatcher,
  transform: Transform,
  setNodeStyle: Function
) => {
  if (
    isOverViewportArea &&
    hasLeftViewportRef.current &&
    originalViewportDataRef.current &&
    !dragState.placeholderInfo
  ) {
    const placeholderInfo = handlePlaceholderRecreation({
      draggedNode: dragState.draggedNode.node,
      originalData: originalViewportDataRef.current,
      dragState,
      nodeState,
      nodeDisp,
      transform,
      setNodeStyle,
    });

    if (placeholderInfo) {
      dragDisp.setPlaceholderInfo(placeholderInfo);
      hasLeftViewportRef.current = false;
    }
  }
};

type NodePosition = {
  id: string | number;
  rect: DOMRect;
};

/**
 * Determines the spatial order of nodes relative to a main anchor node
 * @param mainNodeId - The ID of the main anchor node being dragged
 * @param additionalNodes - Array of additional node IDs being dragged
 * @param containerDirection - The flex direction of the target container ('row' | 'column')
 * @returns Ordered array of node IDs based on their spatial relationship
 */
export const computeSpatialNodeOrder = (
  mainNodeId: string | number,
  additionalNodes: Array<{ node: { id: string | number } }>,
  containerDirection: "row" | "column"
): Array<string | number> => {
  // Get all node positions including main node
  const nodePositions: NodePosition[] = [];

  // Get main node position
  const mainElement = document.querySelector(
    `[data-node-dragged="${mainNodeId}"]`
  ) as HTMLElement;
  if (!mainElement)
    return [mainNodeId, ...additionalNodes.map((n) => n.node.id)];

  const mainRect = mainElement.getBoundingClientRect();
  nodePositions.push({ id: mainNodeId, rect: mainRect });

  // Get additional node positions
  additionalNodes.forEach(({ node }) => {
    const element = document.querySelector(
      `[data-node-dragged="${node.id}"]`
    ) as HTMLElement;
    if (element) {
      const rect = element.getBoundingClientRect();
      nodePositions.push({ id: node.id, rect });
    }
  });

  // Sort based on container direction
  if (containerDirection === "row") {
    // For row layout, sort primarily by x position
    nodePositions.sort((a, b) => {
      // Primary sort by X position
      const xDiff = a.rect.left - b.rect.left;
      if (Math.abs(xDiff) > 5) {
        // 5px threshold for horizontal alignment
        return xDiff;
      }
      // Secondary sort by Y position if X positions are similar
      return a.rect.top - b.rect.top;
    });
  } else {
    // For column layout, sort primarily by y position
    nodePositions.sort((a, b) => {
      // Primary sort by Y position
      const yDiff = a.rect.top - b.rect.top;
      if (Math.abs(yDiff) > 5) {
        // 5px threshold for vertical alignment
        return yDiff;
      }
      // Secondary sort by X position if Y positions are similar
      return a.rect.left - b.rect.left;
    });
  }

  return nodePositions.map((pos) => pos.id);
};

/**
 * Determines the flex direction of a container element
 * @param containerId - The ID of the container element
 * @returns 'row' | 'column' based on the container's flex direction
 */
export const getContainerDirection = (
  containerId: string | number
): "row" | "column" => {
  const container = document.querySelector(
    `[data-node-id="${containerId}"]`
  ) as HTMLElement;
  if (!container) return "row"; // Default to row

  const computedStyle = window.getComputedStyle(container);
  const flexDirection = computedStyle.getPropertyValue("flex-direction");

  return flexDirection.includes("row") ? "row" : "column";
};

export function sortDraggedNodesByVisualPosition(
  allDraggedNodes: Array<{ nodeId: string | number; placeholderId: string }>,
  mainAnchorId: string | number
): Array<{ nodeId: string | number; placeholderId: string }> {
  // Get the main anchor element and its parent container.
  const mainEl = document.querySelector(
    `[data-node-id="${mainAnchorId}"]`
  ) as HTMLElement;
  if (!mainEl) return allDraggedNodes;

  // Determine the sort key (assume row by default)
  let sortKey: "left" | "top" = "left";
  if (mainEl.parentElement) {
    const parentStyle = window.getComputedStyle(mainEl.parentElement);
    if (parentStyle.flexDirection === "column") {
      sortKey = "top";
    }
  }

  // Sort based on the node’s bounding rect property (left or top)
  return allDraggedNodes.sort((a, b) => {
    const aEl = document.querySelector(
      `[data-node-id="${a.nodeId}"]`
    ) as HTMLElement;
    const bEl = document.querySelector(
      `[data-node-id="${b.nodeId}"]`
    ) as HTMLElement;
    if (!aEl || !bEl) return 0;
    const aRect = aEl.getBoundingClientRect();
    const bRect = bEl.getBoundingClientRect();
    return aRect[sortKey] - bRect[sortKey];
  });
}
