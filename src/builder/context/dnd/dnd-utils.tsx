// src/builder/context/utils/dragStartUtils.ts

import { NodeId } from "../atoms/node-store";
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
