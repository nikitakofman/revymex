import { SnapGuideLine } from "@/builder/reducer/dragDispatcher";
import { Node, NodeState } from "@/builder/reducer/nodeDispatcher";
import { LineIndicatorState } from "../builderState";
import { HTMLAttributes } from "react";

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
  //eslint-disable-next-line
  shouldNegateHieght?: boolean
): DragPos => {
  const elementRect = element.getBoundingClientRect();

  const mouseOffsetX = e.clientX - elementRect.left;
  const mouseOffsetY = e.clientY - elementRect.top;

  const elementX = (elementRect.left - contentRect.left) / transform.scale;
  const heightOffset = elementRect.height;
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
  mouseY: number,
  prevMouseX: number,
  prevMouseY: number
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

export const computeSiblingReorderResult = (
  draggedNode: Node,
  allNodes: Node[],
  parentElement: Element,
  mouseX: number,
  mouseY: number,
  prevMouseX: number,
  prevMouseY: number
): ReorderZoneResult | null => {
  const siblings = allNodes.filter(
    (node) =>
      node.parentId === draggedNode.parentId &&
      node.type !== "placeholder" &&
      node.id !== draggedNode.id
  );

  const computedStyle = window.getComputedStyle(parentElement);
  const isColumn = computedStyle.flexDirection?.includes("column") || false;

  return computeSiblingReorderZones(
    draggedNode,
    siblings,
    isColumn,
    mouseX,
    mouseY,
    prevMouseX,
    prevMouseY
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
