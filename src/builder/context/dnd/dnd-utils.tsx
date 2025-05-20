// src/builder/context/utils/dnd-utils.ts
import { getCurrentNodes, NodeId } from "../atoms/node-store";
import { dragOps } from "../atoms/drag-store";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";
import { updateNodeFlags } from "../atoms/node-store/operations/update-operations";
import { moveNode } from "../atoms/node-store/operations/insert-operations";

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

// Get parent element's position in canvas space
export const getParentOffsetInCanvas = (
  parentEl: HTMLElement,
  containerRect: DOMRect,
  transform: { x: number; y: number; scale: number }
) => ({
  x:
    (parentEl.getBoundingClientRect().left - containerRect.left - transform.x) /
    transform.scale,
  y:
    (parentEl.getBoundingClientRect().top - containerRect.top - transform.y) /
    transform.scale,
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
  getNodeStyle: (id: string) => any,
  lastTarget: TargetInfo | null,
  prevMousePos: { x: number; y: number },
  placeholderInfo?: any // Add placeholder info parameter
) => {
  const parentId = getNodeParent(placeholderId);
  if (!parentId) return null;

  // Get all siblings except placeholders and dragged nodes
  let allChildren = getNodeChildren(parentId);

  // Get all placeholder IDs from placeholderInfo if available
  const allPlaceholderIds = placeholderInfo?.additionalPlaceholders?.map(
    (p) => p.placeholderId
  ) || [placeholderId];
  const allDraggedNodeIds = placeholderInfo?.nodeOrder || [draggedNodeId];

  // Filter out all placeholders and dragged nodes
  let siblings = allChildren.filter(
    (id) =>
      !allPlaceholderIds.includes(id) &&
      !allDraggedNodeIds.includes(id) &&
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
    placeholderInfo, // Include placeholder info in the result
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

// NEW MULTI-DRAG UTILITY FUNCTIONS

/**
 * Collect information for all selected nodes to be dragged
 */
export function collectDraggedNodesInfo(
  primaryNodeId: NodeId,
  selectedIds: string[],
  getNode: (id: string) => any,
  getNodeParent: (id: string) => string | null,
  getNodeFlags: (id: string) => any,
  getNodeStyle: (id: string) => any,
  e: React.MouseEvent,
  getTransform: () => any
) {
  const isMultiDrag =
    selectedIds.includes(primaryNodeId) && selectedIds.length > 1;
  const draggedNodes = [];

  // Process primary node first
  const primaryNode = getNode(primaryNodeId);
  if (!primaryNode) return { draggedNodes: [], isMultiDrag: false };

  const primaryNodeStyle = getNodeStyle(primaryNodeId);
  const primaryNodeFlags = getNodeFlags(primaryNodeId);
  const primaryParentId = getNodeParent(primaryNodeId);

  // Determine context
  const isOnCanvas = !primaryParentId && !primaryNodeFlags.inViewport;
  const isAbsoluteInFrame =
    (primaryNodeStyle.isAbsoluteInFrame === "true" ||
      primaryNodeStyle.position === "fixed" ||
      primaryNodeStyle.position === "absolute") &&
    primaryParentId;

  const primaryElement = document.querySelector(
    `[data-node-id="${primaryNodeId}"]`
  ) as HTMLElement;

  if (!primaryElement) return { draggedNodes: [], isMultiDrag: false };

  // Process primary node
  const primaryOffset = processElementForDrag(
    primaryElement,
    primaryNode,
    e,
    primaryParentId,
    isOnCanvas,
    isAbsoluteInFrame,
    primaryNodeStyle,
    getTransform
  );

  // Add primary node to the list
  draggedNodes.push({
    node: primaryNode,
    offset: primaryOffset,
  });

  // If not multi-drag, return just the primary node
  if (!isMultiDrag) {
    return { draggedNodes, isMultiDrag: false };
  }

  // Process additional nodes for multi-drag
  const additionalNodeIds = selectedIds.filter((id) => id !== primaryNodeId);

  for (const selectedId of additionalNodeIds) {
    const selectedNode = getNode(selectedId);
    if (!selectedNode) continue;

    const selectedElement = document.querySelector(
      `[data-node-id="${selectedId}"]`
    ) as HTMLElement;

    if (!selectedElement) continue;

    const selectedNodeStyle = getNodeStyle(selectedId);
    const selectedNodeFlags = getNodeFlags(selectedId);
    const selectedParentId = getNodeParent(selectedId);

    // Determine context for this node
    const nodeIsOnCanvas = !selectedParentId && !selectedNodeFlags.inViewport;
    const nodeIsAbsoluteInFrame =
      (selectedNodeStyle.isAbsoluteInFrame === "true" ||
        selectedNodeStyle.position === "fixed" ||
        selectedNodeStyle.position === "absolute") &&
      selectedParentId;

    // Only add nodes that are in the same context as the primary node
    if (
      isOnCanvas !== nodeIsOnCanvas ||
      isAbsoluteInFrame !== nodeIsAbsoluteInFrame ||
      (primaryParentId !== selectedParentId && !isOnCanvas)
    ) {
      continue;
    }

    // Process this element for drag
    const nodeOffset = processElementForDrag(
      selectedElement,
      selectedNode,
      e,
      selectedParentId,
      nodeIsOnCanvas,
      nodeIsAbsoluteInFrame,
      selectedNodeStyle,
      getTransform
    );

    // Add this node to the list
    draggedNodes.push({
      node: selectedNode,
      offset: nodeOffset,
    });
  }

  return { draggedNodes, isMultiDrag: true };
}

/**
 * Process an HTML element for dragging, gathering necessary metrics
 */
function processElementForDrag(
  element: HTMLElement,
  node: any,
  e: React.MouseEvent,
  parentId: string | null,
  isOnCanvas: boolean,
  isAbsoluteInFrame: boolean,
  nodeStyle: any,
  getTransform: () => any
) {
  const dimensionUnits = getDimensionUnits(element, node.style);

  // Only convert dimensions for non-absolute elements
  const needsConversion = parentId && !isOnCanvas && !isAbsoluteInFrame;
  if (needsConversion) {
    convertDimensionsToPx(node.id, element, dimensionUnits);
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
      style.rotate || (transformStr.includes("rotate") ? transformStr : "0deg");
  }

  const elementRect = element.getBoundingClientRect();

  const mouseOffsetX = e.clientX - elementRect.left;
  const mouseOffsetY = e.clientY - elementRect.top;

  // Capture initial position for absolute/fixed elements
  let initialLeft = 0;
  let initialTop = 0;

  if (isAbsoluteInFrame && parentId) {
    initialLeft = parseFloat(style.left) || 0;
    initialTop = parseFloat(style.top) || 0;
  }

  // Original position type
  const originalPositionType = nodeStyle.position || "static";

  return {
    x: 0,
    y: 0,
    mouseX: mouseOffsetX,
    mouseY: mouseOffsetY,
    width,
    height,
    rotate,
    isSimpleRotation,
    nodeType: node.type,
    startingParentId: parentId,
    dimensionUnits,
    isAbsoluteInFrame,
    originalPositionType,
    initialPosition: {
      left: initialLeft,
      top: initialTop,
    },
  };
}

/**
 * Updates styles for all nodes in a drag operation
 */
export function updateDraggedNodesStyles(
  draggedNodes: Array<{ node: any; offset: any }>,
  primaryStyleUpdates: Record<string, string>,
  options: { dontSync?: boolean } = {}
) {
  if (draggedNodes.length === 0) return;

  // Update primary node
  const primaryNode = draggedNodes[0];
  const primaryElement = document.querySelector(
    `[data-node-id="${primaryNode.node.id}"]`
  );

  if (!primaryElement) return;

  // Get current and new positions for primary node
  const computedStyle = window.getComputedStyle(primaryElement);
  const currentLeft = parseFloat(computedStyle.left) || 0;
  const currentTop = parseFloat(computedStyle.top) || 0;
  const newLeft = parseFloat(primaryStyleUpdates.left) || 0;
  const newTop = parseFloat(primaryStyleUpdates.top) || 0;

  // Calculate delta
  const deltaX = newLeft - currentLeft;
  const deltaY = newTop - currentTop;

  // Update primary node
  updateNodeStyle(primaryNode.node.id, primaryStyleUpdates, options);

  // Update additional nodes
  for (let i = 1; i < draggedNodes.length; i++) {
    const node = draggedNodes[i];
    const element = document.querySelector(`[data-node-id="${node.node.id}"]`);

    if (!element) continue;

    // Get current position
    const nodeStyle = window.getComputedStyle(element);
    const nodeLeft = parseFloat(nodeStyle.left) || 0;
    const nodeTop = parseFloat(nodeStyle.top) || 0;

    // Apply the same delta
    updateNodeStyle(
      node.node.id,
      {
        ...primaryStyleUpdates,
        left: `${Math.round(nodeLeft + deltaX)}px`,
        top: `${Math.round(nodeTop + deltaY)}px`,
      },
      options
    );
  }
}

/**
 * Get positions of all dragged nodes
 */
export function getDraggedNodesPositions(draggedNodes: Array<{ node: any }>) {
  const positions: Record<string, { left: string; top: string }> = {};

  draggedNodes.forEach((nodeInfo) => {
    const element = document.querySelector(
      `[data-node-id="${nodeInfo.node.id}"]`
    );
    if (element) {
      const computedStyle = window.getComputedStyle(element);
      positions[nodeInfo.node.id] = {
        left: computedStyle.left,
        top: computedStyle.top,
      };
    }
  });

  return positions;
}

export function handleCanvasDropForNodes(
  e,
  draggedNodes,
  containerRef,
  getTransform,
  nodePositions,
  isDraggingFromViewport
) {
  const transform = getTransform();
  const containerRect = containerRef.current?.getBoundingClientRect();

  // Process each node
  draggedNodes.forEach((draggedNode, index) => {
    const nodeId = draggedNode.node.id;
    const currentPosition = nodePositions[nodeId];

    // Move node to canvas if not absolute-in-frame
    if (
      !draggedNode.offset.isAbsoluteInFrame ||
      !draggedNode.offset.startingParentId
    ) {
      moveNode(nodeId, null);
    }

    // Determine position
    let finalX, finalY;

    // If we have position info from DOM
    if (currentPosition) {
      finalX = parseInt(currentPosition.left, 10);
      finalY = parseInt(currentPosition.top, 10);
    }
    // For viewport to canvas, calculate from mouse position
    else if (isDraggingFromViewport && containerRect && e) {
      // Primary node uses direct mouse offset
      if (index === 0) {
        const canvasX =
          (e.clientX - containerRect.left - transform.x) / transform.scale;
        const canvasY =
          (e.clientY - containerRect.top - transform.y) / transform.scale;

        finalX = Math.round(
          canvasX - draggedNode.offset.mouseX / transform.scale
        );
        finalY = Math.round(
          canvasY - draggedNode.offset.mouseY / transform.scale
        );
      }
      // Additional nodes maintain relative positioning from primary
      else {
        const primaryNode = draggedNodes[0];
        const primaryEl = document.querySelector(
          `[data-node-id="${primaryNode.node.id}"]`
        );
        const currentEl = document.querySelector(`[data-node-id="${nodeId}"]`);

        if (primaryEl && currentEl) {
          // Get relative position from DOM
          const primaryRect = primaryEl.getBoundingClientRect();
          const currentRect = currentEl.getBoundingClientRect();

          const offsetX =
            (currentRect.left - primaryRect.left) / transform.scale;
          const offsetY = (currentRect.top - primaryRect.top) / transform.scale;

          // Calculate position based on primary node's position
          const canvasX =
            (e.clientX - containerRect.left - transform.x) / transform.scale;
          const canvasY =
            (e.clientY - containerRect.top - transform.y) / transform.scale;

          const primaryX = Math.round(
            canvasX - primaryNode.offset.mouseX / transform.scale
          );
          const primaryY = Math.round(
            canvasY - primaryNode.offset.mouseY / transform.scale
          );

          finalX = primaryX + offsetX;
          finalY = primaryY + offsetY;
        } else {
          // Fallback with simple offset
          const canvasX =
            (e.clientX - containerRect.left - transform.x) / transform.scale;
          const canvasY =
            (e.clientY - containerRect.top - transform.y) / transform.scale;

          finalX =
            Math.round(canvasX - draggedNode.offset.mouseX / transform.scale) +
            index * 10;
          finalY =
            Math.round(canvasY - draggedNode.offset.mouseY / transform.scale) +
            index * 10;
        }
      }
    }
    // Fallback
    else {
      const currentStyles = draggedNode.node.style;
      finalX = parseInt(currentStyles.left, 10) || 0;
      finalY = parseInt(currentStyles.top, 10) || 0;
    }

    // Apply snap points for primary node
    const { activeSnapPoints } = snapOps.getState();
    if (index === 0) {
      if (
        activeSnapPoints.horizontal &&
        activeSnapPoints.horizontal.edge === "left" &&
        Math.abs(finalX - activeSnapPoints.horizontal.position) <= 5
      ) {
        finalX = Math.round(activeSnapPoints.horizontal.position);
      }

      if (
        activeSnapPoints.vertical &&
        activeSnapPoints.vertical.edge === "top" &&
        Math.abs(finalY - activeSnapPoints.vertical.position) <= 5
      ) {
        finalY = Math.round(activeSnapPoints.vertical.position);
      }
    }

    // Update node style based on its type
    if (
      draggedNode.offset.isAbsoluteInFrame &&
      draggedNode.offset.startingParentId
    ) {
      // For absolute-in-frame nodes, keep them in their parent
      updateNodeStyle(
        nodeId,
        {
          position: draggedNode.offset.originalPositionType || "absolute",
          left: `${finalX}px`,
          top: `${finalY}px`,
          isAbsoluteInFrame: "true",
        },
        { dontSync: true }
      );
    } else {
      // For regular nodes
      updateNodeStyle(
        nodeId,
        {
          position: "absolute",
          left: `${finalX}px`,
          top: `${finalY}px`,
          isAbsoluteInFrame: "false",
        },
        { dontSync: true }
      );

      // Update viewport flag
      updateNodeFlags(nodeId, {
        inViewport: false,
      });
    }

    // Restore dimensions if needed
    if (draggedNode.offset.dimensionUnits) {
      restoreOriginalDimensions(nodeId, draggedNode.offset.dimensionUnits);
    }
  });
}

/**
 * Handle canvas drop for multiple dragged nodes
 */
/**
 * Handle canvas drop for multiple dragged nodes
 */
/**
 * Handle canvas drop for multiple dragged nodes
 */
export function handleDraggedNodesCanvasDrop(
  draggedNodes: Array<{ node: any; offset: any }>,
  positions: Record<string, { left: string; top: string }>,
  activeSnapPoints: any = { horizontal: null, vertical: null },
  containerRef?: any,
  e?: MouseEvent,
  getTransform?: () => any,
  isDraggingFromViewport?: boolean
) {
  // Make sure we have positions info
  const needPositionCalculation =
    (Object.keys(positions).length === 0 || isDraggingFromViewport) &&
    e &&
    containerRef &&
    getTransform;

  // Calculate positions if needed (especially important for viewport to canvas)
  if (needPositionCalculation) {
    const transform = getTransform();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Calculate position for primary node based on mouse position
    const primaryNode = draggedNodes[0];

    const canvasX =
      (e.clientX - containerRect.left - transform.x) / transform.scale;
    const canvasY =
      (e.clientY - containerRect.top - transform.y) / transform.scale;

    const finalX = Math.round(
      canvasX - primaryNode.offset.mouseX / transform.scale
    );
    const finalY = Math.round(
      canvasY - primaryNode.offset.mouseY / transform.scale
    );

    // Store positions
    positions[primaryNode.node.id] = {
      left: `${finalX}px`,
      top: `${finalY}px`,
    };

    // Calculate relative positions for other nodes compared to primary
    if (draggedNodes.length > 1) {
      const primaryElement = document.querySelector(
        `[data-node-id="${primaryNode.node.id}"]`
      );
      if (primaryElement) {
        const primaryRect = primaryElement.getBoundingClientRect();

        for (let i = 1; i < draggedNodes.length; i++) {
          const node = draggedNodes[i];
          const element = document.querySelector(
            `[data-node-id="${node.node.id}"]`
          );

          if (element) {
            const rect = element.getBoundingClientRect();
            // Calculate offset from primary element
            const offsetX = rect.left - primaryRect.left;
            const offsetY = rect.top - primaryRect.top;

            // Apply same offset to calculated position
            positions[node.node.id] = {
              left: `${finalX + offsetX / transform.scale}px`,
              top: `${finalY + offsetY / transform.scale}px`,
            };
          } else {
            // If element not found, place with an offset from primary
            positions[node.node.id] = {
              left: `${finalX + 10 * i}px`,
              top: `${finalY + 10 * i}px`,
            };
          }
        }
      } else {
        // If primary element not found, add simple offsets
        for (let i = 1; i < draggedNodes.length; i++) {
          positions[draggedNodes[i].node.id] = {
            left: `${finalX + 10 * i}px`,
            top: `${finalY + 10 * i}px`,
          };
        }
      }
    }
  }

  // Process each dragged node
  draggedNodes.forEach((nodeInfo, index) => {
    const nodeId = nodeInfo.node.id;

    // Move node to canvas only if not absolute-in-frame inside a parent
    if (
      !nodeInfo.offset.isAbsoluteInFrame ||
      !nodeInfo.offset.startingParentId
    ) {
      moveNode(nodeId, null);
    }

    const nodePosition = positions[nodeId];
    if (!nodePosition) return;

    // Extract numeric values
    let finalX = parseInt(nodePosition.left, 10);
    let finalY = parseInt(nodePosition.top, 10);

    // Primary node gets snapping (first node)
    if (index === 0) {
      // Apply snap points if available and the element is close to them
      if (
        activeSnapPoints.horizontal &&
        activeSnapPoints.horizontal.edge === "left"
      ) {
        // Apply snapping if close enough
        if (Math.abs(finalX - activeSnapPoints.horizontal.position) <= 5) {
          finalX = Math.round(activeSnapPoints.horizontal.position);
        }
      }

      if (
        activeSnapPoints.vertical &&
        activeSnapPoints.vertical.edge === "top"
      ) {
        // Apply snapping if close enough
        if (Math.abs(finalY - activeSnapPoints.vertical.position) <= 5) {
          finalY = Math.round(activeSnapPoints.vertical.position);
        }
      }
    }

    // Handle absolute-in-frame elements differently
    if (nodeInfo.offset.isAbsoluteInFrame && nodeInfo.offset.startingParentId) {
      // Keep it in its parent and maintain absolute positioning
      updateNodeStyle(
        nodeId,
        {
          position: nodeInfo.offset.originalPositionType || "absolute",
          left: `${finalX}px`,
          top: `${finalY}px`,
          isAbsoluteInFrame: "true", // Important to maintain absoluteInFrame flag
        },
        { dontSync: true }
      );
    } else {
      // Update style for non-absolute-in-frame elements
      updateNodeStyle(
        nodeId,
        {
          position: "absolute",
          left: `${finalX}px`,
          top: `${finalY}px`,
          isAbsoluteInFrame: "false",
        },
        { dontSync: true }
      );

      // Update flags
      updateNodeFlags(nodeId, {
        inViewport: false,
      });
    }

    // Restore dimensions if needed
    if (nodeInfo.offset.dimensionUnits) {
      restoreOriginalDimensions(nodeId, nodeInfo.offset.dimensionUnits);
    }
  });
}

/**
 * Restores dimensions for all dragged nodes
 */
export function restoreDimensionsForDraggedNodes(
  draggedNodes: Array<{ node: any; offset: any }>
) {
  draggedNodes.forEach((nodeInfo) => {
    if (nodeInfo.offset.dimensionUnits) {
      restoreOriginalDimensions(
        nodeInfo.node.id,
        nodeInfo.offset.dimensionUnits
      );
    }
  });
}
