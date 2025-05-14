// src/builder/context/utils/dragStartUtils.ts

import { getCurrentNodes, NodeId } from "../atoms/node-store";
import { dragOps } from "../atoms/drag-store";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";

/**
 * Converts a CSS transform origin token to pixels
 * Handles both percentage values (e.g. "50%") and pixel values (e.g. "100px")
 */
export const originTokenToPx = (
  token: string,
  size: number // element width or height
): number => {
  if (token.endsWith("%")) {
    return (parseFloat(token) / 100) * size;
  }
  return parseFloat(token); // already px or keyword will be NaN
};

export const acceptsChild = (parentId: NodeId, childId: NodeId): boolean => {
  const parent = getCurrentNodes().find((n) => n.id === parentId);
  if (!parent) return false;

  // simplest rule: frames & viewports can host children
  return parent.type === "frame" || parent.flags?.isViewport;
};

/**
 * Helper function to find the transformed element within a container
 * First checks for data-transform-container, then for any elements with transforms
 */
export const findTransformedElement = (el: HTMLElement): HTMLElement => {
  // Check if this element has a transform container
  const transformContainer = el.querySelector(
    "[data-transform-container]"
  ) as HTMLElement;
  if (transformContainer) {
    return transformContainer;
  }

  // Check if this element has a transform
  const style = window.getComputedStyle(el);
  if (style.transform && style.transform !== "none") {
    return el;
  }

  // Look for first child with transform
  const children = Array.from(el.children);
  for (const child of children) {
    const childStyle = window.getComputedStyle(child as HTMLElement);
    if (childStyle.transform && childStyle.transform !== "none") {
      return child as HTMLElement;
    }
  }

  // If nothing found, return the original element
  return el;
};

/**
 * Prepares drag data for an element
 * Handles all element measurements, transform calculations, and mouse offset computation
 */
export const prepareDragData = (
  e: React.MouseEvent,
  element: HTMLElement,
  node: any
) => {
  // Find the actual transformed element
  const transformedEl = findTransformedElement(element);

  // Get the element's rect (we use the original element for positioning)
  const rect = element.getBoundingClientRect();

  // Get the transformed element's computed style
  const style = window.getComputedStyle(transformedEl);

  // Get dimensions
  const width = rect.width;
  const height = rect.height;

  // Calculate transform origin in pixels
  const [oxToken, oyToken] = style.transformOrigin.split(" ");
  const ox = originTokenToPx(oxToken, width);
  const oy = originTokenToPx(oyToken, height);

  // Get mouse offset relative to the element
  const mouseLocalX = e.clientX - rect.left;
  const mouseLocalY = e.clientY - rect.top;

  // Get the transformation matrix
  const matrix = new DOMMatrixReadOnly(style.transform || "none");

  return {
    x: 0,
    y: 0,
    mouseLocalX,
    mouseLocalY,
    ox,
    oy,
    matrix,
    width,
    height,
    transformString: style.transform,
    transformOrigin: style.transformOrigin,
  };
};

/**
 * Initiates dragging for a node
 * Handles all DOM measurements and sets up the drag state
 */
export const startNodeDrag = (
  e: React.MouseEvent,
  nodeId: NodeId,
  node: any
) => {
  // Find the element
  const element = document.querySelector(
    `[data-node-id="${nodeId}"]`
  ) as HTMLElement;
  if (!element) return false;

  // Prepare the drag data
  const dragData = prepareDragData(e, element, node);

  // Set the drag state
  dragOps.setIsDragging(true);
  dragOps.setDraggedNode(node, dragData);

  return true;
};

// utils/coords.ts
export const screenToCanvas = (
  e: MouseEvent,
  containerRect: DOMRect,
  transform: { x: number; y: number; scale: number }
) => ({
  x: (e.clientX - containerRect.left - transform.x) / transform.scale,
  y: (e.clientY - containerRect.top - transform.y) / transform.scale,
});

// utils/orderingUtils.ts

export interface TargetInfo {
  id: string;
  pos: "before" | "after";
}

export const getSiblingOrdering = (
  e: MouseEvent,
  placeholderId: string,
  draggedNodeId: string,
  getNodeParent: (id: string) => string | null,
  getNodeChildren: (id: string | null) => string[],
  getNodeStyle: (id: string) => any, // Changed parameter to get node style instead of flags
  lastTarget: TargetInfo | null,
  prevMousePos: { x: number; y: number }
) => {
  const parentId = getNodeParent(placeholderId);
  if (!parentId) return null;

  // Get all siblings except placeholder and dragged node
  let allChildren = getNodeChildren(parentId);

  let siblings = allChildren.filter(
    (id) =>
      id !== placeholderId &&
      id !== draggedNodeId &&
      !id.includes("placeholder")
  );

  // Log the style details of each sibling before filtering
  siblings.forEach((id) => {
    const style = getNodeStyle(id);
  });

  siblings = siblings.filter((id) => {
    const style = getNodeStyle(id);

    // Check conditions one by one for easier debugging
    if (style.isAbsoluteInFrame === "true") {
      return false;
    }

    if (style.isAbsoluteInFrame === true) {
      return false;
    }

    if (style.position === "absolute" && style.isAbsoluteInFrame !== "false") {
      return false;
    }
    return true;
  });

  // If no valid siblings left after filtering, return null
  if (!siblings.length) {
    return null;
  }

  const parentElement = document.querySelector(`[data-node-id="${parentId}"]`);
  if (!parentElement) {
    return null;
  }

  const parentStyle = window.getComputedStyle(parentElement);
  const isColumn = parentStyle.flexDirection.includes("column");

  const siblingElements = siblings
    .map((id) => {
      const el = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
      if (!el) {
        return null;
      }
      return { id, rect: el.getBoundingClientRect() };
    })
    .filter(Boolean);

  const sortedSiblings = siblingElements.sort((a, b) => {
    return isColumn ? a.rect.top - b.rect.top : a.rect.left - b.rect.left;
  });

  const mouseXDirection = e.clientX - prevMousePos.x;
  const mouseYDirection = e.clientY - prevMousePos.y;

  const isMovingRight = mouseXDirection > 1;
  const isMovingLeft = mouseXDirection < -1;
  const isMovingDown = mouseYDirection > 1;
  const isMovingUp = mouseYDirection < -1;

  let targetInfo: TargetInfo | null = null;

  if (isColumn) {
    // Before first sibling
    if (sortedSiblings.length > 0 && e.clientY < sortedSiblings[0].rect.top) {
      targetInfo = { id: sortedSiblings[0].id, pos: "before" };
    }
    // After last sibling
    else if (
      sortedSiblings.length > 0 &&
      e.clientY > sortedSiblings[sortedSiblings.length - 1].rect.bottom
    ) {
      targetInfo = {
        id: sortedSiblings[sortedSiblings.length - 1].id,
        pos: "after",
      };
    } else {
      // Within siblings
      for (let i = 0; i < sortedSiblings.length; i++) {
        const sibling = sortedSiblings[i];
        // Within this sibling
        if (e.clientY >= sibling.rect.top && e.clientY <= sibling.rect.bottom) {
          if (isMovingUp) {
            targetInfo = { id: sibling.id, pos: "before" };
          } else if (isMovingDown) {
            targetInfo = { id: sibling.id, pos: "after" };
          } else {
            // No movement, use position within sibling
            const pos =
              e.clientY < sibling.rect.top + sibling.rect.height / 2
                ? "before"
                : "after";
            targetInfo = { id: sibling.id, pos };
          }
          break;
        }
        // Between this sibling and next
        if (i < sortedSiblings.length - 1) {
          const nextSibling = sortedSiblings[i + 1];
          if (
            e.clientY > sibling.rect.bottom &&
            e.clientY < nextSibling.rect.top
          ) {
            targetInfo = { id: sibling.id, pos: "after" };
            break;
          }
        }
      }
    }
  } else {
    // Before first sibling
    if (sortedSiblings.length > 0 && e.clientX < sortedSiblings[0].rect.left) {
      targetInfo = { id: sortedSiblings[0].id, pos: "before" };
    }
    // After last sibling
    else if (
      sortedSiblings.length > 0 &&
      e.clientX > sortedSiblings[sortedSiblings.length - 1].rect.right
    ) {
      targetInfo = {
        id: sortedSiblings[sortedSiblings.length - 1].id,
        pos: "after",
      };
    } else {
      // Within siblings
      for (let i = 0; i < sortedSiblings.length; i++) {
        const sibling = sortedSiblings[i];
        // Within this sibling
        if (e.clientX >= sibling.rect.left && e.clientX <= sibling.rect.right) {
          if (isMovingLeft) {
            targetInfo = { id: sibling.id, pos: "before" };
          } else if (isMovingRight) {
            targetInfo = { id: sibling.id, pos: "after" };
          } else {
            // No movement, use position within sibling
            const pos =
              e.clientX < sibling.rect.left + sibling.rect.width / 2
                ? "before"
                : "after";
            targetInfo = { id: sibling.id, pos };
          }
          break;
        }
        // Between this sibling and next
        if (i < sortedSiblings.length - 1) {
          const nextSibling = sortedSiblings[i + 1];
          if (
            e.clientX > sibling.rect.right &&
            e.clientX < nextSibling.rect.left
          ) {
            targetInfo = { id: sibling.id, pos: "after" };
            break;
          }
        }
      }
    }
  }

  // Skip if no target found or if it hasn't changed
  if (!targetInfo) {
    return null;
  }

  if (
    lastTarget &&
    lastTarget.id === targetInfo.id &&
    lastTarget.pos === targetInfo.pos
  ) {
    return null;
  }

  return {
    targetInfo,
    parentId,
    isColumn,
  };
};

// Interface for dimension units tracking
export interface DimensionUnits {
  widthUnit: "px" | "%" | "vw" | "vh" | "auto" | "fill";
  heightUnit: "px" | "%" | "vw" | "vh" | "auto" | "fill";
  originalWidth: string | number | undefined;
  originalHeight: string | number | undefined;
  isFillMode: boolean;
}

/**
 * Get original dimension information from an element and its style
 */
export function getDimensionUnits(
  element: HTMLElement,
  nodeStyle: any
): DimensionUnits {
  // Get element's computed style
  const computedStyle = window.getComputedStyle(element);

  // Detect original units
  const originalWidth = nodeStyle.width;
  const originalHeight = nodeStyle.height;

  const isWidthPercent =
    typeof originalWidth === "string" && originalWidth.includes("%");
  const isHeightPercent =
    typeof originalHeight === "string" && originalHeight.includes("%");
  const isWidthVw =
    typeof originalWidth === "string" && originalWidth.includes("vw");
  const isHeightVh =
    typeof originalHeight === "string" && originalHeight.includes("vh");
  const isWidthAuto = originalWidth === "auto";
  const isHeightAuto = originalHeight === "auto";
  const isFillMode =
    computedStyle.flex === "1 0 0px" || element.style.flex === "1 0 0px";

  return {
    widthUnit: isFillMode
      ? "fill"
      : isWidthPercent
      ? "%"
      : isWidthVw
      ? "vw"
      : isWidthAuto
      ? "auto"
      : "px",
    heightUnit: isFillMode
      ? "fill"
      : isHeightPercent
      ? "%"
      : isHeightVh
      ? "vh"
      : isHeightAuto
      ? "auto"
      : "px",
    originalWidth,
    originalHeight,
    isFillMode,
  };
}

/**
 * Convert an element's dimensions to pixels for dragging
 */
export function convertDimensionsToPx(
  nodeId: NodeId,
  element: HTMLElement,
  dimensionUnits: DimensionUnits
): void {
  // Only convert if not already in pixels
  if (
    dimensionUnits.widthUnit === "px" &&
    dimensionUnits.heightUnit === "px" &&
    !dimensionUnits.isFillMode
  ) {
    return; // Already in pixels, no conversion needed
  }

  // Get computed dimensions
  const computedStyle = window.getComputedStyle(element);
  const computedWidth = parseFloat(computedStyle.width) || element.offsetWidth;
  const computedHeight =
    parseFloat(computedStyle.height) || element.offsetHeight;

  // Create style updates
  const styleUpdates: any = {};

  // Only update width if it's not already in px
  if (dimensionUnits.widthUnit !== "px") {
    styleUpdates.width = `${Math.round(computedWidth)}px`;
  }

  // Only update height if it's not already in px
  if (dimensionUnits.heightUnit !== "px") {
    styleUpdates.height = `${Math.round(computedHeight)}px`;
  }

  // If in fill mode, also update flex
  if (dimensionUnits.isFillMode) {
    styleUpdates.flex = "0 0 auto";
  }

  // Apply the style updates
  if (Object.keys(styleUpdates).length > 0) {
    updateNodeStyle(nodeId, styleUpdates);
  }
}

/**
 * Restore original dimension units after dragging
 */
export function restoreOriginalDimensions(
  nodeId: NodeId,
  dimensionUnits: DimensionUnits
): void {
  // Create style updates
  const styleUpdates: any = {};

  // Restore width if it was percentage, viewport units, auto, or fill
  if (dimensionUnits.widthUnit !== "px") {
    styleUpdates.width = dimensionUnits.originalWidth;
  }

  // Restore height if it was percentage, viewport units, auto, or fill
  if (dimensionUnits.heightUnit !== "px") {
    styleUpdates.height = dimensionUnits.originalHeight;
  }

  // If was in fill mode, also restore flex
  if (dimensionUnits.isFillMode) {
    styleUpdates.flex = "1 0 0px";
  }

  // Apply the style updates
  if (Object.keys(styleUpdates).length > 0) {
    updateNodeStyle(nodeId, styleUpdates);
  }
}

export function makeNodeAbsoluteInFrame(
  nodeId: NodeId,
  parentId: NodeId
): void {
  if (!nodeId || !parentId) return;

  // Get element and parent element
  const element = document.querySelector(
    `[data-node-id="${nodeId}"]`
  ) as HTMLElement;
  const parentElement = document.querySelector(
    `[data-node-id="${parentId}"]`
  ) as HTMLElement;

  if (!element || !parentElement) return;

  // Get element's current position within parent
  const elementRect = element.getBoundingClientRect();
  const parentRect = parentElement.getBoundingClientRect();

  // Calculate relative position
  const x = elementRect.left - parentRect.left;
  const y = elementRect.top - parentRect.top;

  // Update style to absolute AND set isAbsoluteInFrame directly in style
  updateNodeStyle(nodeId, {
    position: "absolute",
    left: `${Math.round(x)}px`,
    top: `${Math.round(y)}px`,
    right: "",
    bottom: "",
    isAbsoluteInFrame: "true", // Add this line to set the flag in style
  });
}

export function calculatePositionInParent(
  e: MouseEvent,
  parentId: NodeId,
  mouseOffset: { x: number; y: number },
  transform: { x: number; y: number; scale: number }
): { x: number; y: number } {
  // Get parent element
  const parentElement = document.querySelector(
    `[data-node-id="${parentId}"]`
  ) as HTMLElement;
  if (!parentElement) {
    return { x: 0, y: 0 };
  }

  // Get parent's bounding rect
  const parentRect = parentElement.getBoundingClientRect();

  // Calculate position relative to parent
  // Here we divide by scale to account for zoom level
  const x = (e.clientX - parentRect.left) / transform.scale;
  const y = (e.clientY - parentRect.top) / transform.scale;

  // Subtract the original mouse offset to maintain the grab point
  return {
    x: Math.round(x - mouseOffset.x / transform.scale),
    y: Math.round(y - mouseOffset.y / transform.scale),
  };
}

interface SnapPoint {
  position: number;
  distance: number;
  edge: string;
}

interface NodeDimensions {
  width: number;
  height: number;
}

interface SnapResult {
  x: number;
  y: number;
  snapped: boolean;
}

/**
 * Calculates snapped position based on active snap points and node dimensions
 */
export const calculateSnappedPosition = (
  rawX: number,
  rawY: number,
  dimensions: NodeDimensions,
  mouseSpeed: { x: number; y: number },
  activeSnapPoints: {
    horizontal: SnapPoint | null;
    vertical: SnapPoint | null;
  },
  enabled: boolean,
  hasActiveDropZone: boolean
): SnapResult => {
  // Return raw position if snapping is disabled or there's an active drop zone
  if (!enabled || hasActiveDropZone) {
    return { x: rawX, y: rawY, snapped: false };
  }

  let finalX = rawX;
  let finalY = rawY;
  let snapped = false;

  // Calculate snap strength based on mouse speed
  // Reduce snap effect when moving quickly
  const speedFactor = Math.max(mouseSpeed.x, mouseSpeed.y);
  const snapStrength = Math.max(0, 1 - speedFactor / 20);

  // Apply horizontal snapping
  if (activeSnapPoints.horizontal) {
    const snapPoint = activeSnapPoints.horizontal;
    let snappedY = finalY;

    // Adjust position based on which edge is snapping
    if (snapPoint.edge === "top") {
      snappedY = snapPoint.position;
    } else if (snapPoint.edge === "center") {
      snappedY = snapPoint.position - dimensions.height / 2;
    } else if (snapPoint.edge === "bottom") {
      snappedY = snapPoint.position - dimensions.height;
    }

    // Blend raw position with snapped position based on speed
    finalY = snappedY * snapStrength + rawY * (1 - snapStrength);
    snapped = true;
  }

  // Apply vertical snapping
  if (activeSnapPoints.vertical) {
    const snapPoint = activeSnapPoints.vertical;
    let snappedX = finalX;

    // Adjust position based on which edge is snapping
    if (snapPoint.edge === "left") {
      snappedX = snapPoint.position;
    } else if (snapPoint.edge === "center") {
      snappedX = snapPoint.position - dimensions.width / 2;
    } else if (snapPoint.edge === "right") {
      snappedX = snapPoint.position - dimensions.width;
    }

    // Blend raw position with snapped position based on speed
    finalX = snappedX * snapStrength + rawX * (1 - snapStrength);
    snapped = true;
  }

  return { x: finalX, y: finalY, snapped };
};

export const extractNodeDimensions = (style: any): NodeDimensions => {
  let width = 100; // Default
  let height = 100; // Default

  // Get width from style
  if (typeof style.width === "string" && style.width.includes("px")) {
    width = parseFloat(style.width);
  } else if (typeof style.width === "number") {
    width = style.width;
  }

  // Get height from style
  if (typeof style.height === "string" && style.height.includes("px")) {
    height = parseFloat(style.height);
  } else if (typeof style.height === "number") {
    height = style.height;
  }

  return { width, height };
};
