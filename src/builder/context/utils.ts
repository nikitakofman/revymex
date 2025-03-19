import { DragState, SnapGuideLine } from "@/builder/reducer/dragDispatcher";
import {
  Node,
  NodeDispatcher,
  NodeState,
} from "@/builder/reducer/nodeDispatcher";
import { LineIndicatorState } from "./builderState";
import { HTMLAttributes } from "react";
import { nanoid } from "nanoid";

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
  // First, create a map to deduplicate nodes with the same ID
  const nodesMap = new Map<string | number, Node>();

  // Take the last occurrence of each node ID (this fixes duplicated IDs)
  nodes.forEach((node) => {
    nodesMap.set(node.id, node);
  });

  // Convert back to array
  const deduplicatedNodes = Array.from(nodesMap.values());

  if (mode === "dynamicMode" && dynamicModeNodeId) {
    // First pass: collect all nodes that should be in dynamic mode
    const dynamicModeNodes = deduplicatedNodes.filter(
      (node: Node) =>
        node.id === dynamicModeNodeId ||
        node.dynamicParentId === dynamicModeNodeId ||
        (node.isVariant && node.variantParentId === dynamicModeNodeId)
    );

    // Group nodes by sharedId (only for nodes that have sharedId)
    const nodesBySharedId = new Map<string, Node[]>();

    dynamicModeNodes.forEach((node) => {
      if (node.sharedId) {
        const existing = nodesBySharedId.get(node.sharedId) || [];
        existing.push(node);
        nodesBySharedId.set(node.sharedId, existing);
      }
    });

    // Find nodes that don't have duplicates (either no sharedId or unique sharedId)
    const singletonNodes = dynamicModeNodes.filter(
      (node) =>
        !node.sharedId || nodesBySharedId.get(node.sharedId)?.length === 1
    );

    // For duplicates, only keep the one in viewport-1440 if available, otherwise the first one
    const filteredDuplicates: Node[] = [];

    nodesBySharedId.forEach((nodesGroup, sharedId) => {
      if (nodesGroup.length > 1) {
        // Check if any node is in viewport-1440
        const desktopNode = nodesGroup.find((node) => {
          let current = node;
          while (current.parentId) {
            const parent = deduplicatedNodes.find(
              (n) => n.id === current.parentId
            );
            if (!parent) break;
            if (parent.id === "viewport-1440") return true;
            current = parent;
          }
          return false;
        });

        // Add either the desktop node or the first node in the group
        filteredDuplicates.push(desktopNode || nodesGroup[0]);
      }
    });

    // Combine singleton nodes and filtered duplicates
    return [...singletonNodes, ...filteredDuplicates];
  }

  // For non-dynamic modes, use the existing filtering logic
  return deduplicatedNodes.filter((node: Node) => {
    // Don't show nodes with dynamicParentId
    if (node.dynamicParentId) {
      return false;
    }

    // Don't show variant nodes
    if (node.isVariant) {
      return false;
    }

    // Normal filtering by viewport status
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

interface CalculateDimensionsParams {
  node: Node;
  element: HTMLElement;
  transform: { scale: number };
  setNodeStyle: (
    styles: React.CSSProperties & { src?: string } & { text?: string },
    nodeIds?: (string | number)[],
    sync?: boolean
  ) => void;
}

interface DimensionResult {
  finalWidth: string | number | undefined;
  finalHeight: string | number | undefined;
}

export const calculateAndUpdateDimensions = ({
  node,
  element,
  transform,
  setNodeStyle,
}: CalculateDimensionsParams): DimensionResult => {
  const style = element.style;
  const isWidthPercent = style.width?.includes("%");
  const isHeightPercent = style.height?.includes("%");
  const isWidthAuto = style.width === "auto";
  const isHeightAuto = style.height === "auto";
  const isFillMode = style.flex === "1 0 0px";

  let finalWidth = node.style.width;
  let finalHeight = node.style.height;

  // Handle fill mode
  if (isFillMode) {
    const rect = element.getBoundingClientRect();

    console.log("fill mode true");

    finalWidth = `${Math.round(rect.width / transform.scale)}px`;
    finalHeight = `${Math.round(rect.height / transform.scale)}px`;

    console.log("setting conversion fill for node type", node.id, node.type);

    console.log("finalWidth", finalWidth);
    console.log("finalHeight", finalHeight);

    setNodeStyle(
      {
        width: finalWidth,
        height: finalHeight,
        flex: "0 0 auto",
      },
      [node.id]
    );
  } else {
    // Handle width calculations
    if (isWidthPercent || isWidthAuto) {
      const widthInPx = convertToNewUnit(
        parseFloat(style.width),
        isWidthPercent ? "%" : "auto",
        "px",
        "width",
        element
      );
      finalWidth = `${widthInPx}px`;
      setNodeStyle(
        {
          width: finalWidth,
        },
        [node.id]
      );
    }

    // Handle height calculations
    if (isHeightPercent || isHeightAuto) {
      const heightInPx = convertToNewUnit(
        parseFloat(style.height),
        isHeightPercent ? "%" : "auto",
        "px",
        "height",
        element
      );
      finalHeight = `${heightInPx}px`;
      setNodeStyle(
        {
          height: finalHeight,
        },
        [node.id]
      );
    }
  }

  return { finalWidth, finalHeight };
};

export const convertToNewUnit = (
  value: number,
  oldUnit: string,
  newUnit: string,
  propertyName: string,
  element: HTMLElement
): number => {
  if (oldUnit === newUnit) return value;

  const computedStyle = window.getComputedStyle(element);
  const parentElement = element.parentElement;

  if (newUnit === "fill") {
    return 1;
  }

  if (oldUnit === "fill") {
    const computedValue = parseFloat(computedStyle[propertyName as any]);
    return convertToNewUnit(
      computedValue,
      "px",
      newUnit,
      propertyName,
      element
    );
  }

  if (oldUnit === "auto") {
    const computedValue = parseFloat(computedStyle[propertyName as any]);
    return convertToNewUnit(
      computedValue,
      "px",
      newUnit,
      propertyName,
      element
    );
  }

  let valueInPixels = value;
  if (oldUnit === "%") {
    if (propertyName.includes("width")) {
      const parentWidth = parentElement ? parentElement.clientWidth : 0;
      valueInPixels = (value * parentWidth) / 100;
    } else if (propertyName.includes("height")) {
      const parentHeight = parentElement ? parentElement.clientHeight : 0;
      valueInPixels = (value * parentHeight) / 100;
    }
  } else if (oldUnit === "em") {
    const fontSizeInPx = parseFloat(computedStyle.fontSize);
    valueInPixels = value * fontSizeInPx;
  } else if (oldUnit === "rem") {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    valueInPixels = value * rootFontSize;
  } else if (oldUnit === "vw") {
    valueInPixels = (value * window.innerWidth) / 100;
  } else if (oldUnit === "vh") {
    valueInPixels = (value * window.innerHeight) / 100;
  }

  if (newUnit === "%") {
    if (propertyName.includes("width")) {
      const parentWidth = parentElement ? parentElement.clientWidth : 0;
      return parentWidth ? (valueInPixels / parentWidth) * 100 : 0;
    } else if (propertyName.includes("height")) {
      const parentHeight = parentElement ? parentElement.clientHeight : 0;
      return parentHeight ? (valueInPixels / parentHeight) * 100 : 0;
    }
  } else if (newUnit === "em") {
    const fontSizeInPx = parseFloat(computedStyle.fontSize);
    return valueInPixels / fontSizeInPx;
  } else if (newUnit === "rem") {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    return valueInPixels / rootFontSize;
  } else if (newUnit === "vw") {
    return (valueInPixels / window.innerWidth) * 100;
  } else if (newUnit === "vh") {
    return (valueInPixels / window.innerHeight) * 100;
  }

  return valueInPixels;
};

// Helper function to transform image/video to frame
export const handleMediaToFrameTransformation = (
  mediaNode: Node,
  droppedNode?: Node,
  nodeDisp?: NodeDispatcher,
  position: string = "inside"
) => {
  if (position !== "inside") return false;

  // Create frame node from media node
  const frameNode: Node = {
    ...mediaNode,
    type: "frame",
    style: {
      ...mediaNode.style,
      // Set the appropriate background property based on type
      ...(mediaNode.type === "video"
        ? {
            backgroundVideo: mediaNode.style.src,
          }
        : { backgroundImage: mediaNode.style.src }),
      src: undefined,
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  };

  // If we have a node dispatcher, perform the transformation
  if (nodeDisp) {
    // First replace the media with a frame
    nodeDisp.replaceNode(mediaNode.id, frameNode);

    // If we have a dropped node, add it as a child
    if (droppedNode) {
      const childNode = {
        ...droppedNode,
        sharedId: nanoid(),
        style: {
          ...droppedNode.style,
          position: "relative",
          zIndex: "",
          transform: "",
          left: "",
          top: "",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        parentId: frameNode.id,
        inViewport: frameNode.inViewport || false,
      };

      nodeDisp.addNode(
        childNode,
        frameNode.id,
        "inside",
        frameNode.inViewport || false
      );
    }
  }

  return true;
};
/**
 * Check if a transform string contains any skew transforms
 */

/**
 * Combine multiple skew transforms into one
 * This is for mathematical convenience, not for CSS output
 */
export const combineSkews = (
  skews: Array<{ skewX: number; skewY: number }>
): { skewX: number; skewY: number } => {
  return skews.reduce(
    (acc, curr) => {
      return {
        skewX: acc.skewX + curr.skewX,
        skewY: acc.skewY + curr.skewY,
      };
    },
    { skewX: 0, skewY: 0 }
  );
};

/**
 * Converts degrees to radians
 */
export const degToRad = (deg: number): number => {
  return (deg * Math.PI) / 180;
};

/**
 * Get the skew transformation hierarchy
 * Returns an array of skew transforms from the root to the current node
 */
export const getSkewHierarchy = (
  node: any,
  nodeState: { nodes: any[] }
): Array<{ skewX: number; skewY: number }> => {
  const skewHierarchy: Array<{ skewX: number; skewY: number }> = [];
  let currentNode = node;

  while (currentNode) {
    const skewValues = parseSkew(currentNode.style.transform);
    if (skewValues.skewX !== 0 || skewValues.skewY !== 0) {
      skewHierarchy.unshift(skewValues); // Add to beginning to maintain order
    }

    if (!currentNode.parentId) break;

    currentNode =
      nodeState.nodes.find((n) => n.id === currentNode.parentId) || currentNode;
    if (!currentNode) break;
  }

  return skewHierarchy;
};

/**
 * Create a matrix for skew transformation
 */
export const createSkewMatrix = (skewX: number, skewY: number): number[] => {
  const skewXRad = degToRad(skewX);
  const skewYRad = degToRad(skewY);

  // Create a 3x3 matrix representing skew transformation
  // [1, tan(skewX), 0]
  // [tan(skewY), 1, 0]
  // [0, 0, 1]
  return [1, Math.tan(skewXRad), 0, Math.tan(skewYRad), 1, 0, 0, 0, 1];
};

/**
 * Multiply two 3x3 matrices
 */
export const multiplyMatrices = (a: number[], b: number[]): number[] => {
  const result = new Array(9).fill(0);

  // Rows of a
  for (let i = 0; i < 3; i++) {
    // Columns of b
    for (let j = 0; j < 3; j++) {
      // Multiply and sum
      for (let k = 0; k < 3; k++) {
        result[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
      }
    }
  }

  return result;
};

/**
 * Apply a matrix to a point
 */
export const applyMatrixToPoint = (
  matrix: number[],
  x: number,
  y: number
): { x: number; y: number } => {
  // [x', y', 1] = [x, y, 1] * matrix
  const resultX = matrix[0] * x + matrix[1] * y + matrix[2];
  const resultY = matrix[3] * x + matrix[4] * y + matrix[5];

  return { x: resultX, y: resultY };
};

/**
 * Create a CSS matrix3d string from a matrix array
 */
export const createMatrixString = (matrix: number[]): string => {
  // Convert 3x3 matrix to 4x4 matrix3d
  return `matrix3d(
    ${matrix[0]}, ${matrix[3]}, 0, 0,
    ${matrix[1]}, ${matrix[4]}, 0, 0,
    0, 0, 1, 0,
    ${matrix[2]}, ${matrix[5]}, 0, 1
  )`;
};

export const hasSkewTransform = (transform: string | undefined): boolean => {
  if (!transform) return false;
  return transform.includes("skewX") || transform.includes("skewY");
};

/**
 * Parse skew values from a transform string.
 */
export const parseSkew = (
  transform: string | undefined
): { skewX: number; skewY: number } => {
  if (!transform) return { skewX: 0, skewY: 0 };

  const skewXMatch = transform.match(/skewX\(([-\d.]+)deg\)/);
  const skewYMatch = transform.match(/skewY\(([-\d.]+)deg\)/);

  return {
    skewX: skewXMatch ? parseFloat(skewXMatch[1]) : 0,
    skewY: skewYMatch ? parseFloat(skewYMatch[1]) : 0,
  };
};

/**
 * Create a CSS transform string from skew values.
 */
export const createSkewTransform = (skewX: number, skewY: number): string => {
  let transform = "";
  if (skewX !== 0) transform += `skewX(${skewX}deg) `;
  if (skewY !== 0) transform += `skewY(${skewY}deg)`;
  return transform.trim();
};

/**
 * Parse all transform values from a node's style.transform string
 * Includes 3D transforms like perspective, rotateY, rotateZ, scaleY, scaleZ
 */
export function parseTransformValues(transformStr: string | undefined) {
  const result = {
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    skewX: 0,
    skewY: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    perspective: 0,
    translateZ: 0,
  };

  if (!transformStr) return result;

  // Parse scaleX, scaleY, scaleZ
  const sxMatch = transformStr.match(/scaleX\(([-\d.]+)\)/);
  if (sxMatch) result.scaleX = parseFloat(sxMatch[1]);

  const syMatch = transformStr.match(/scaleY\(([-\d.]+)\)/);
  if (syMatch) result.scaleY = parseFloat(syMatch[1]);

  const szMatch = transformStr.match(/scaleZ\(([-\d.]+)\)/);
  if (szMatch) result.scaleZ = parseFloat(szMatch[1]);

  // Parse skewX, skewY
  const kxMatch = transformStr.match(/skewX\(([-\d.]+)deg\)/);
  if (kxMatch) result.skewX = parseFloat(kxMatch[1]);

  const kyMatch = transformStr.match(/skewY\(([-\d.]+)deg\)/);
  if (kyMatch) result.skewY = parseFloat(kyMatch[1]);

  // Parse rotateX, rotateY, rotateZ
  const rxMatch = transformStr.match(/rotateX\(([-\d.]+)deg\)/);
  if (rxMatch) result.rotateX = parseFloat(rxMatch[1]);

  const ryMatch = transformStr.match(/rotateY\(([-\d.]+)deg\)/);
  if (ryMatch) result.rotateY = parseFloat(ryMatch[1]);

  const rzMatch = transformStr.match(/rotateZ\(([-\d.]+)deg\)/);
  if (rzMatch) result.rotateZ = parseFloat(rzMatch[1]);

  // Parse perspective
  const pMatch = transformStr.match(/perspective\(([-\d.]+)px\)/);
  if (pMatch) result.perspective = parseFloat(pMatch[1]);

  // Parse translateZ
  const tzMatch = transformStr.match(/translateZ\(([-\d.]+)px\)/);
  if (tzMatch) result.translateZ = parseFloat(tzMatch[1]);

  return result;
}

/**
 * Convert transform values to a CSS transform string
 */
export function transformValuesToCSS(
  values: ReturnType<typeof parseTransformValues>
): string {
  const transforms: string[] = [];

  // Add perspective first (if any)
  if (values.perspective !== 0) {
    transforms.push(`perspective(${values.perspective}px)`);
  }

  // Add scales
  if (values.scaleX !== 1) transforms.push(`scaleX(${values.scaleX})`);
  if (values.scaleY !== 1) transforms.push(`scaleY(${values.scaleY})`);
  if (values.scaleZ !== 1) transforms.push(`scaleZ(${values.scaleZ})`);

  // Add rotations
  if (values.rotateX !== 0) transforms.push(`rotateX(${values.rotateX}deg)`);
  if (values.rotateY !== 0) transforms.push(`rotateY(${values.rotateY}deg)`);
  if (values.rotateZ !== 0) transforms.push(`rotateZ(${values.rotateZ}deg)`);

  // Add skews
  if (values.skewX !== 0) transforms.push(`skewX(${values.skewX}deg)`);
  if (values.skewY !== 0) transforms.push(`skewY(${values.skewY}deg)`);

  // Add translateZ
  if (values.translateZ !== 0)
    transforms.push(`translateZ(${values.translateZ}px)`);

  return transforms.join(" ");
}

/**
 * Get cumulative 3D transform properties from node and all ancestors
 */
export function getCumulative3DTransforms(
  node: Node,
  nodeState: { nodes: Node[] }
): ReturnType<typeof parseTransformValues> {
  // Initialize with default values
  const result = {
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    skewX: 0,
    skewY: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    perspective: 0,
    translateZ: 0,
  };

  let currentNode = node;
  let isFirst = true;

  // Traverse up the node hierarchy
  while (currentNode) {
    // For the first node (self), we might want special handling
    if (!isFirst) {
      // For parent nodes, accumulate their transforms
      const transforms = parseTransformValues(currentNode.style.transform);

      // Accumulate transforms (multiplication for scale, addition for angles)
      result.scaleX *= transforms.scaleX;
      result.scaleY *= transforms.scaleY;
      result.scaleZ *= transforms.scaleZ;

      result.skewX += transforms.skewX;
      result.skewY += transforms.skewY;

      result.rotateX += transforms.rotateX;
      result.rotateY += transforms.rotateY;
      result.rotateZ += transforms.rotateZ;

      // For perspective, we generally want the closest ancestor's value
      if (transforms.perspective !== 0 && result.perspective === 0) {
        result.perspective = transforms.perspective;
      }

      result.translateZ += transforms.translateZ;
    } else {
      isFirst = false;
    }

    // Move up to parent
    if (!currentNode.parentId) break;
    currentNode =
      nodeState.nodes.find((n) => n.id === currentNode.parentId) || currentNode;
    if (!currentNode) break;
  }

  return result;
}

/**
 * Apply 3D transform matrix to a CSS style object
 */
export function apply3DTransform(
  style: React.CSSProperties,
  transforms: ReturnType<typeof parseTransformValues>
): React.CSSProperties {
  return {
    ...style,
    transform: transformValuesToCSS(transforms),
    transformStyle: "preserve-3d", // Important for nested 3D transforms
  };
}

/**
 * Check if a transform string includes any 3D transforms
 */
export function has3DTransform(transformStr: string | undefined): boolean {
  if (!transformStr) return false;

  return /perspective\(|rotateX\(|rotateY\(|rotateZ\(|scaleZ\(|translateZ\(/.test(
    transformStr
  );
}

/**
 * Create a CSS matrix3d transform string from transform values
 * This is more complex and would require proper matrix calculations
 */
export function createMatrix3dTransform(
  transforms: ReturnType<typeof parseTransformValues>,
  width: number,
  height: number
): string {
  // This would require implementing proper 3D matrix calculations
  // For now, we'll return a simpler approximation using individual transforms
  return transformValuesToCSS(transforms);
}

/**
 * Get cumulative skew for an element and its ancestors
 * For a child element, include only parent skew
 */
export const getCumulativeSkew = (
  node: Node,
  nodeState: { nodes: Node[] }
): { skewX: number; skewY: number } => {
  let totalSkewX = 0;
  let totalSkewY = 0;
  let currentNode = node;
  let isFirst = true;

  while (currentNode) {
    if (isFirst) {
      // Skip the first node (self) when calculating parent cumulative skew
      isFirst = false;
    } else {
      const skewValues = parseSkew(currentNode.style.transform);
      totalSkewX += skewValues.skewX;
      totalSkewY += skewValues.skewY;
    }

    if (!currentNode.parentId) break;

    currentNode =
      nodeState.nodes.find((n) => n.id === currentNode.parentId) || currentNode;
    if (!currentNode) break;
  }

  return { skewX: totalSkewX, skewY: totalSkewY };
};

/**
 * NEW: Get cumulative rotation from all ancestors
 */
export const getCumulativeRotation = (
  node: Node,
  nodeState: { nodes: Node[] }
): number => {
  let totalRotation = 0;
  let currentNode = node;
  let isFirst = true;

  while (currentNode) {
    if (isFirst) {
      // For the node itself, include its own rotation
      totalRotation += parseRotation(currentNode.style.rotate);
      isFirst = false;
    } else {
      // For ancestors, add their rotations to the total
      totalRotation += parseRotation(currentNode.style.rotate);
    }

    if (!currentNode.parentId) break;

    currentNode =
      nodeState.nodes.find((n) => n.id === currentNode.parentId) || currentNode;
    if (!currentNode) break;
  }

  return totalRotation;
};

export const isAbsoluteInFrame = (node: Node) => {
  return node.isAbsoluteInFrame === true && node.parentId !== null;
};
