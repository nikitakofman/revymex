import { SnapGuideLine } from "@/builder/reducer/dragDispatcher";
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

/**
 * Get elements under the mouse during drag and filter by className
 * @param e - Mouse event
 * @param draggedNodeId - ID of the node being dragged
 * @param className - Class name to check for
 * @returns boolean indicating if an element with the className is under the mouse
 */
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

/**
 * Get all filtered element IDs under the mouse during drag
 * @param e - Mouse event
 * @param draggedNodeId - ID of the node being dragged
 * @returns Array of node IDs under the mouse
 */
export const getFilteredElementIdsUnderMouseDuringDrag = (
  e: MouseEvent,
  draggedNodeId: string | number
): string[] => {
  const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
  const filteredElements = elementsUnder.filter((el) => {
    const isDraggedElement =
      el.getAttribute("data-node-id") === String(draggedNodeId);
    const isChildOfDragged = el.closest(`[data-node-id="${draggedNodeId}"]`);
    return !isDraggedElement && !isChildOfDragged;
  });

  return filteredElements
    .map((el) => el.getAttribute("data-node-id"))
    .filter((id) => id !== null) as string[];
};

export const isWithinViewport = (
  nodeId: string | number | null | undefined,
  nodes: Node[]
): boolean => {
  if (!nodeId) return false;

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;

  // Direct checks
  if (node.isViewport) return true;
  if (node.inViewport) return true;

  // Dynamic node checks
  if (node.dynamicViewportId) {
    // If it has a dynamicViewportId, it's logically within that viewport
    return true;
  }

  if (node.originalState?.inViewport) {
    // If it was originally in a viewport (for dynamic nodes)
    return true;
  }

  // Check if parent is a dynamic node with viewport connection
  if (node.parentId) {
    const parentNode = nodes.find((n) => n.id === node.parentId);
    if (
      parentNode &&
      (parentNode.dynamicViewportId || parentNode.originalState?.inViewport)
    ) {
      return true;
    }
  }

  // Recurse up the parent chain for traditional viewport relationships
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

export const parseRotationFloat = (rotate: string) => {
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
  dynamicModeNodeId: string | number | null | undefined,
  activeViewportId?: string | number | null
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
    // If we have an activeViewportId, find the right dynamic node
    if (activeViewportId) {
      // Try to find a dynamic node specific to this viewport
      let mainNode: Node | undefined;

      if (activeViewportId === "viewport-1440") {
        // For desktop, use the primary dynamic node
        mainNode = deduplicatedNodes.find(
          (node) => node.id === dynamicModeNodeId
        );
      } else {
        // For other viewports, find a responsive counterpart with matching dynamicViewportId
        const mainDynamicNode = deduplicatedNodes.find(
          (node) => node.id === dynamicModeNodeId
        );

        if (mainDynamicNode) {
          // Critical change: Use multiple strategies to find the correct counterpart

          // Strategy 1: Direct match on sharedId + dynamicViewportId
          if (mainDynamicNode.sharedId) {
            mainNode = deduplicatedNodes.find(
              (node) =>
                node.sharedId === mainDynamicNode.sharedId &&
                node.dynamicViewportId === activeViewportId
            );
          }

          // Strategy 2: Match on variantResponsiveId + dynamicViewportId
          if (!mainNode && mainDynamicNode.variantResponsiveId) {
            mainNode = deduplicatedNodes.find(
              (node) =>
                node.variantResponsiveId ===
                  mainDynamicNode.variantResponsiveId &&
                node.dynamicViewportId === activeViewportId
            );
          }

          // Strategy 3: Match on dynamicFamilyId + dynamicViewportId
          if (!mainNode && mainDynamicNode.dynamicFamilyId) {
            mainNode = deduplicatedNodes.find(
              (node) =>
                node.dynamicFamilyId === mainDynamicNode.dynamicFamilyId &&
                node.dynamicViewportId === activeViewportId
            );
          }

          // Strategy 4: Match on originalParentId that's the active viewport
          if (!mainNode && mainDynamicNode.sharedId) {
            mainNode = deduplicatedNodes.find(
              (node) =>
                node.sharedId === mainDynamicNode.sharedId &&
                node.originalParentId === activeViewportId
            );
          }

          // Strategy 5: Look for any node with the same sharedId that has this viewport
          // in its original parent chain
          if (!mainNode && mainDynamicNode.sharedId) {
            // This is a more aggressive approach to find matching nodes
            const possibleNodes = deduplicatedNodes.filter(
              (node) =>
                node.sharedId === mainDynamicNode.sharedId &&
                node.id !== mainDynamicNode.id
            );

            for (const candidate of possibleNodes) {
              // Find the parent viewport for this candidate
              let current = candidate;
              let foundViewport = false;

              // Try to match with originalParentId first
              if (current.originalParentId) {
                const parentNode = deduplicatedNodes.find(
                  (n) => n.id === current.originalParentId
                );
                if (
                  parentNode &&
                  parentNode.isViewport &&
                  parentNode.id === activeViewportId
                ) {
                  mainNode = candidate;
                  foundViewport = true;
                  break;
                }
              }

              // If not found, check the parentId chain
              if (!foundViewport && current.parentId) {
                let parentId = current.parentId;
                while (parentId) {
                  const parent = deduplicatedNodes.find(
                    (n) => n.id === parentId
                  );
                  if (!parent) break;

                  if (parent.isViewport && parent.id === activeViewportId) {
                    mainNode = candidate;
                    foundViewport = true;
                    break;
                  }

                  parentId = parent.parentId;
                }
              }

              if (foundViewport) break;
            }
          }
        }

        // Fallback to main node if no counterpart found
        if (!mainNode) {
          mainNode = mainDynamicNode;
        }
      }

      if (!mainNode) return [];

      // Get all direct variants of this node using all possible relationships
      const directVariants = deduplicatedNodes.filter((node) => {
        return (
          // Traditional direct connections
          node.variantParentId === mainNode!.id ||
          node.dynamicParentId === mainNode!.id ||
          // Dynamic family connection
          (mainNode!.dynamicFamilyId &&
            node.dynamicFamilyId === mainNode!.dynamicFamilyId &&
            node.id !== mainNode!.id) ||
          // Variant responsive connection
          (mainNode!.variantResponsiveId &&
            node.variantResponsiveId === mainNode!.variantResponsiveId &&
            node.id !== mainNode!.id) ||
          // Shared ID connection (critical for repositioned elements)
          (mainNode!.sharedId &&
            node.sharedId === mainNode!.sharedId &&
            node.id !== mainNode!.id)
        );
      });

      // All top-level nodes we want to include
      const topLevelNodes = [mainNode, ...directVariants];

      // Build a set of all top-level node IDs for quick lookup
      const topLevelNodeIds = new Set(topLevelNodes.map((node) => node.id));

      // Here's the critical change: we need to process base nodes first, followed by variants
      // This ensures the primary base node for each viewport gets priority in rendering

      // Separate nodes into base nodes and variants
      const baseNodes = topLevelNodes.filter((node) => !node.isVariant);
      const variantNodes = topLevelNodes.filter((node) => node.isVariant);

      // Create result with base nodes first, then variants
      // This ensures base nodes have rendering priority
      const result: Node[] = [...baseNodes, ...variantNodes];

      // CRITICAL FIX: Ensure the dynamic base node for this viewport is included and comes first
      // First look for dynamic nodes with matching sharedId and dynamicViewportId
      if (mainNode.sharedId && activeViewportId) {
        const viewportBaseNode = deduplicatedNodes.find(
          (node) =>
            node.sharedId === mainNode.sharedId &&
            node.dynamicViewportId === activeViewportId &&
            node.isDynamic &&
            !node.isVariant
        );

        if (
          viewportBaseNode &&
          !result.some((n) => n.id === viewportBaseNode.id)
        ) {
          // Insert at the beginning to give it priority
          result.unshift(viewportBaseNode);
        }
      }

      // Process all top-level nodes for their children
      topLevelNodes.forEach((parent) => {
        // Get all children - using originalParentId to reconstruct relationships
        const childrenOfParent = deduplicatedNodes.filter(
          (node) => node.originalParentId === parent.id
        );

        // Add these children to the result
        result.push(...childrenOfParent);

        // Recursively get all descendants using originalParentId
        let queue = [...childrenOfParent];
        while (queue.length > 0) {
          const currentNode = queue.shift()!;
          const childrenOfCurrent = deduplicatedNodes.filter(
            (node) => node.originalParentId === currentNode.id
          );

          result.push(...childrenOfCurrent);
          queue.push(...childrenOfCurrent);
        }
      });

      // Important: Ensure all nodes with the same dynamicFamilyId are included
      if (mainNode.dynamicFamilyId) {
        const familyNodes = deduplicatedNodes.filter(
          (node) =>
            node.dynamicFamilyId === mainNode.dynamicFamilyId &&
            !result.some((r) => r.id === node.id)
        );

        // Add family nodes that are not variants first, then variants
        const familyBaseNodes = familyNodes.filter((node) => !node.isVariant);
        const familyVariantNodes = familyNodes.filter((node) => node.isVariant);
        result.push(...familyBaseNodes, ...familyVariantNodes);
      }

      // Also ensure all nodes with the same variantResponsiveId are included
      if (mainNode.variantResponsiveId) {
        const variantNodes = deduplicatedNodes.filter(
          (node) =>
            node.variantResponsiveId === mainNode.variantResponsiveId &&
            !result.some((r) => r.id === node.id)
        );

        // Add base nodes first, then variants
        const vBaseNodes = variantNodes.filter((node) => !node.isVariant);
        const vVariantNodes = variantNodes.filter((node) => node.isVariant);
        result.push(...vBaseNodes, ...vVariantNodes);
      }

      // Also include all nodes with same sharedId as any node already in result
      const sharedIdsToInclude = new Set<string>();
      result.forEach((node) => {
        if (node.sharedId) sharedIdsToInclude.add(node.sharedId);
      });

      if (sharedIdsToInclude.size > 0) {
        const allSharedNodes = deduplicatedNodes.filter(
          (node) =>
            node.sharedId &&
            sharedIdsToInclude.has(node.sharedId) &&
            !result.some((r) => r.id === node.id)
        );

        // Add base nodes first, then variants
        const sharedBaseNodes = allSharedNodes.filter(
          (node) => !node.isVariant
        );
        const sharedVariantNodes = allSharedNodes.filter(
          (node) => node.isVariant
        );
        result.push(...sharedBaseNodes, ...sharedVariantNodes);
      }

      return result;
    }

    // Default case if no activeViewportId specified
    // Get the main dynamic node
    const mainDynamicNode = deduplicatedNodes.find(
      (node) => node.id === dynamicModeNodeId
    );

    if (!mainDynamicNode) return [];

    // Get all direct variants of the main dynamic node
    // Enhanced to use dynamicFamilyId and variantResponsiveId
    const directVariants = deduplicatedNodes.filter((node) => {
      return (
        node.variantParentId === dynamicModeNodeId ||
        node.dynamicParentId === dynamicModeNodeId ||
        (mainDynamicNode.dynamicFamilyId &&
          node.dynamicFamilyId === mainDynamicNode.dynamicFamilyId &&
          node.id !== mainDynamicNode.id) ||
        (mainDynamicNode.variantResponsiveId &&
          node.variantResponsiveId === mainDynamicNode.variantResponsiveId &&
          node.id !== mainDynamicNode.id)
      );
    });

    // All top-level nodes we want to include
    const topLevelNodes = [mainDynamicNode, ...directVariants];

    // Build a set of all top-level node IDs for quick lookup
    const topLevelNodeIds = new Set(topLevelNodes.map((node) => node.id));

    // Final set of nodes to include
    const result: Node[] = [...topLevelNodes];

    // For each top-level node, include its children
    topLevelNodes.forEach((parent) => {
      // Get all children - using originalParentId since parentId is null in dynamic mode
      const childrenOfParent = deduplicatedNodes.filter(
        (node) => node.originalParentId === parent.id
      );

      // Add these children to the result
      result.push(...childrenOfParent);

      // Recursively get all descendants
      let queue = [...childrenOfParent];
      while (queue.length > 0) {
        const currentNode = queue.shift()!;
        const childrenOfCurrent = deduplicatedNodes.filter(
          (node) => node.originalParentId === currentNode.id
        );

        result.push(...childrenOfCurrent);
        queue.push(...childrenOfCurrent);
      }
    });

    return result;
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
    sync?: boolean,
    preventUnsync?: boolean
  ) => void;
  preventUnsync?: boolean;
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
  preventUnsync = false, // Parameter to prevent adding unsync flags
  preventCascade = preventUnsync, // By default, prevent cascade if preventing unsync
}: CalculateDimensionsParams): DimensionResult => {
  const style = element.style;
  const isWidthPercent = style.width?.includes("%");
  const isHeightPercent = style.height?.includes("%");
  const isWidthAuto = style.width === "auto";
  const isHeightAuto = style.height === "auto";
  const isWidthVw = node.style.width?.includes("vw");
  const isHeightVh = node.style.height?.includes("vh");
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
      [node.id],
      false, // Don't sync viewports
      preventUnsync, // Prevent adding unsync flags
      preventCascade // Prevent cascading styles to other viewports
    );
  } else {
    // Handle width calculations
    if (isWidthPercent || isWidthAuto || isWidthVw) {
      const widthUnit = isWidthPercent ? "%" : isWidthVw ? "vw" : "auto";
      const widthInPx = convertToNewUnit(
        parseFloat(style.width),
        widthUnit,
        "px",
        "width",
        element
      );
      finalWidth = `${widthInPx}px`;

      console.log("Converting width from", widthUnit, "to px:", finalWidth);
      setNodeStyle(
        {
          width: finalWidth,
        },
        [node.id],
        false, // Don't sync viewports
        preventUnsync, // Prevent adding unsync flags
        preventCascade // Prevent cascading styles to other viewports
      );
    }

    // Handle height calculations
    if (isHeightPercent || isHeightAuto || isHeightVh) {
      const heightUnit = isHeightPercent ? "%" : isHeightVh ? "vh" : "auto";
      const heightInPx = convertToNewUnit(
        parseFloat(style.height),
        heightUnit,
        "px",
        "height",
        element
      );
      finalHeight = `${heightInPx}px`;

      console.log("Converting height from", heightUnit, "to px:", finalHeight);
      setNodeStyle(
        {
          height: finalHeight,
        },
        [node.id],
        false, // Don't sync viewports
        preventUnsync, // Prevent adding unsync flags
        preventCascade // Prevent cascading styles to other viewports
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
      // Check if the dropped node is from the canvas (existing node)
      const isExistingNode =
        !droppedNode.parentId || droppedNode.style.position === "absolute";

      // Check for duplicates of this node
      if (isExistingNode) {
        // Find all instances of this node in the tree
        const allNodes = nodeDisp.getNodeState().nodes;
        const duplicateNodes = allNodes.filter((n) => n.id === droppedNode.id);

        // If there's more than one or this is a canvas node, we need to handle it differently
        if (
          duplicateNodes.length > 1 ||
          droppedNode.style.position === "absolute"
        ) {
          // For existing nodes, we'll just update properties rather than creating a new node
          const updatedNode = {
            ...droppedNode,
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

          // Update the existing node
          nodeDisp.updateNode(droppedNode.id, updatedNode);

          // Find any canvas duplicates to remove
          const canvasDuplicate = allNodes.find(
            (n) =>
              n.id === droppedNode.id &&
              (n.style.position === "absolute" || n.parentId === null) &&
              n.id !== updatedNode.id
          );

          if (canvasDuplicate) {
            nodeDisp.removeNode(canvasDuplicate.id);
          }

          nodeDisp.syncViewports();
          nodeDisp.syncVariants(mediaNode.id);

          return true;
        }
      }

      // For new nodes or non-duplicate existing nodes, add as child
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

export const getNestedParentChain = (nodeId, nodes) => {
  const parentChain = [];
  let currentId = nodeId;

  while (currentId) {
    const node = nodes.find((n) => n.id === currentId);
    if (!node) break;

    parentChain.push(node);
    currentId = node.parentId;
  }

  return parentChain;
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

export const isAbsoluteInFrame = (node: Node) => {
  return node.style.isAbsoluteInFrame === "true" && node.parentId !== null;
};

export function multiply2D(A: number[], B: number[]) {
  // Multiply two 3x3 matrices (row-major order)
  const C = new Array(9).fill(0);
  C[0] = A[0] * B[0] + A[1] * B[3] + A[2] * B[6];
  C[1] = A[0] * B[1] + A[1] * B[4] + A[2] * B[7];
  C[2] = A[0] * B[2] + A[1] * B[5] + A[2] * B[8];

  C[3] = A[3] * B[0] + A[4] * B[3] + A[5] * B[6];
  C[4] = A[3] * B[1] + A[4] * B[4] + A[5] * B[7];
  C[5] = A[3] * B[2] + A[4] * B[5] + A[5] * B[8];

  C[6] = A[6] * B[0] + A[7] * B[3] + A[8] * B[6];
  C[7] = A[6] * B[1] + A[7] * B[4] + A[8] * B[7];
  C[8] = A[6] * B[2] + A[7] * B[5] + A[8] * B[8];
  return C;
}

export function applyMatrixToPoint(m: number[], x: number, y: number) {
  const nx = m[0] * x + m[1] * y + m[2];
  const ny = m[3] * x + m[4] * y + m[5];
  return { x: nx, y: ny };
}

/**
 * Create a 3×3 2D transform matrix, applying:
 *   translate(tx, ty) → translate(cx, cy) → scale → skewX → skewY → translate(-cx, -cy)
 */
export function build2DMatrix({
  tx,
  ty,
  cx,
  cy,
  scaleX,
  scaleY,
  skewXDeg,
  skewYDeg,
}: {
  tx: number;
  ty: number;
  cx: number;
  cy: number;
  scaleX: number;
  scaleY: number;
  skewXDeg: number;
  skewYDeg: number;
}) {
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // 1) Translate by (tx, ty)
  M = multiply2D(M, [1, 0, tx, 0, 1, ty, 0, 0, 1]);

  // 2) Translate pivot (cx, cy)
  M = multiply2D(M, [1, 0, cx, 0, 1, cy, 0, 0, 1]);

  // 3) Scale
  M = multiply2D(M, [scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1]);

  // 4) SkewX
  const sx = Math.tan(degToRad(skewXDeg));
  M = multiply2D(M, [1, sx, 0, 0, 1, 0, 0, 0, 1]);

  // 5) SkewY
  const sy = Math.tan(degToRad(skewYDeg));
  M = multiply2D(M, [1, 0, 0, sy, 1, 0, 0, 0, 1]);

  // 6) Translate back (-cx, -cy)
  M = multiply2D(M, [1, 0, -cx, 0, 1, -cy, 0, 0, 1]);

  return M;
}

export function getFullTransformMatrix(
  node: Node,
  nodeState: { nodes: Node[] },
  width: number,
  height: number
) {
  // Start with identity matrix
  let fullMatrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // Gather the ancestor chain from root to this node
  const chain: Node[] = [];
  let current: Node | undefined = node;

  while (current) {
    chain.unshift(current); // Add to front to get root → ... → node order

    if (!current.parentId) break;
    current = nodeState.nodes.find((n) => n.id === current!.parentId);
  }

  // Process each node in the chain and multiply matrices
  for (const node of chain) {
    // Extract transform values
    const skewX = parseSkewValue(node.style.transform, "skewX");
    const skewY = parseSkewValue(node.style.transform, "skewY");
    const scaleX = parseScaleValue(node.style.transform, "scaleX");
    const scaleY = parseScaleValue(node.style.transform, "scaleY");

    // Create local transform matrix for this node
    const localMatrix = build2DMatrix({
      tx: 0,
      ty: 0,
      cx: width / 2, // Use element's dimensions for pivoting
      cy: height / 2,
      scaleX,
      scaleY,
      skewXDeg: skewX,
      skewYDeg: skewY,
    });

    // Multiply with accumulated matrix
    fullMatrix = multiply2D(fullMatrix, localMatrix);
  }

  return fullMatrix;
}

function parseSkewValue(
  transform: string | undefined,
  prop: "skewX" | "skewY"
): number {
  if (!transform) return 0;
  const regex = new RegExp(`${prop}\\(([-\\d.]+)deg\\)`);
  const match = transform.match(regex);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Parse scale values from transform string
 */
function parseScaleValue(
  transform: string | undefined,
  prop: "scaleX" | "scaleY"
): number {
  if (!transform) return 1;
  const regex = new RegExp(`${prop}\\(([-\\d.]+)\\)`);
  const match = transform.match(regex);
  return match ? parseFloat(match[1]) : 1;
}

export function matrixToCss(m: number[]) {
  // return a "matrix(...)" 2D transform string
  return `matrix(${m[0]}, ${m[3]}, ${m[1]}, ${m[4]}, ${m[2]}, ${m[5]})`;
}

/**
 * Parse numeric rotation (in deg) from style.rotate if present, else 0
 */
export function parseRotation(rotate: string | undefined): number {
  if (!rotate) return 0;
  const match = rotate.match(/([-\d.]+)deg/);
  return match ? parseFloat(match[1]) : 0;
}

export function computeFullMatrixChain(
  node: Node,
  nodes: Node[],
  // The actual DOM width/height for pivot
  width: number,
  height: number
) {
  let totalRotationDeg = 0;

  // We'll gather transforms from ancestor → ... → self
  // so we can multiply them in order
  const transformMatrices: number[][] = [];

  let current: Node | undefined = node;
  let depth = 0;

  // We'll "unshift" each parent's matrix so that the root is first
  // and the child is last, then multiply in sequence
  while (current) {
    // Add rotation
    totalRotationDeg += parseRotation(current.style.rotate);

    // parse local skew/scale
    const { scaleX, scaleY, skewX, skewY } = parseTransformValues(
      current.style.transform
    );

    // Build local matrix with pivot at the center of *this* node:
    const localM = build2DMatrix({
      tx: 0,
      ty: 0,
      cx: width / 2,
      cy: height / 2,
      scaleX,
      scaleY,
      skewXDeg: skewX,
      skewYDeg: skewY,
    });

    // We'll store it
    transformMatrices.unshift(localM);

    if (!current.parentId) break;
    current = nodes.find((n) => n.id === current?.parentId);
    depth++;
    // NOTE: If each ancestor might have a *different* width/height pivot,
    // you would need a more advanced approach (like your POC with each parent's dimension).
    // But if you keep it simplified to the child's dimension,
    // or if your parent doesn't scale child differently, this is enough.
    // If you do want *each* parent's pivot dimension, you'd track them in a chain.
  }

  // Multiply all from root → child in order
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (const mat of transformMatrices) {
    M = multiply2D(M, mat);
  }

  return {
    totalRotationDeg,
    fullMatrix: M,
  };
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
