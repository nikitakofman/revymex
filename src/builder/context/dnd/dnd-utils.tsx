// src/builder/context/utils/dragStartUtils.ts

import { getCurrentNodes, NodeId } from "../atoms/node-store";
import { dragOps } from "../atoms/drag-store";

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
  lastTarget: { id: string; pos: "before" | "after" } | null,
  prevMousePos: { x: number; y: number }
) => {
  const parentId = getNodeParent(placeholderId);
  if (!parentId) return null;

  const siblings = getNodeChildren(parentId).filter(
    (id) =>
      id !== placeholderId &&
      id !== draggedNodeId &&
      !id.includes("placeholder")
  );
  if (!siblings.length) return null;

  const parentElement = document.querySelector(`[data-node-id="${parentId}"]`);
  if (!parentElement) return null;

  const parentStyle = window.getComputedStyle(parentElement);
  const isColumn = parentStyle.flexDirection.includes("column");

  const siblingElements = siblings
    .map((id) => {
      const el = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
      if (!el) return null;
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
