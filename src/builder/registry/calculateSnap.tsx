import { Node } from "@/builder/reducer/nodeDispatcher";
import { useSnapGrid } from "../context/dnd/SnapGrid";
import { Transform } from "../types";

type SnapGridReturn = ReturnType<typeof useSnapGrid>;

interface SnapCalculationParams {
  node: Node;
  baseRect: { left: number; top: number };
  width: number;
  height: number;
  transform: Transform;
  offset: { mouseX: number; mouseY: number };
  offsetX: number;
  offsetY: number;
  isAdditionalDraggedNode: boolean;
  snapGrid: SnapGridReturn;
  isOverCanvas: boolean;
  isDynamicMode: boolean;
  mainNodeInitialPosition?: { left: number; top: number };
}

interface SnapCalculationResult {
  finalLeft: number;
  finalTop: number;
  snapResult: {
    horizontalSnap: { position: number; type: string } | null;
    verticalSnap: { position: number; type: string } | null;
    snapGuides: Array<{
      position: number;
      orientation: "horizontal" | "vertical";
      sourceNodeId: string | number;
    }>;
  } | null;
  deltaX: number;
  deltaY: number;
}

export function calculateSnapping({
  node,
  baseRect,
  width,
  height,
  transform,
  offset,
  offsetX,
  offsetY,
  isAdditionalDraggedNode,
  snapGrid,
  isOverCanvas,
  isDynamicMode,
  mainNodeInitialPosition,
}: SnapCalculationParams): SnapCalculationResult {
  // Calculate initial positions without snapping
  let rawLeft = baseRect.left - offset.mouseX * transform.scale;
  let rawTop = baseRect.top - offset.mouseY * transform.scale;

  if (isAdditionalDraggedNode && mainNodeInitialPosition) {
    // For additional nodes, maintain relative position to main node
    const currentLeft = parseFloat(node.style.left as string) || 0;
    const currentTop = parseFloat(node.style.top as string) || 0;
    const relativeLeft = currentLeft - mainNodeInitialPosition.left;
    const relativeTop = currentTop - mainNodeInitialPosition.top;

    rawLeft += relativeLeft * transform.scale;
    rawTop += relativeTop * transform.scale;
  }

  // Convert to canvas coordinates for snap calculations
  const canvasX = (rawLeft - transform.x) / transform.scale;
  const canvasY = (rawTop - transform.y) / transform.scale;

  let finalLeft = rawLeft + offsetX * transform.scale;
  let finalTop = rawTop + offsetY * transform.scale;
  let snapResult = null;
  let deltaX = 0;
  let deltaY = 0;

  if (!isAdditionalDraggedNode && snapGrid && (isOverCanvas || isDynamicMode)) {
    // Create precise snap points
    const snapPoints = [
      { value: canvasX, type: "left" },
      { value: canvasX + width, type: "right" },
      { value: canvasX + width / 2, type: "centerX" },
      { value: canvasY, type: "top" },
      { value: canvasY + height, type: "bottom" },
      { value: canvasY + height / 2, type: "centerY" },
    ];

    snapResult = snapGrid.findNearestSnaps(snapPoints, 3, node.id); // Reduced threshold for more precise snapping

    if (snapResult.verticalSnap) {
      const snappedX =
        transform.x + snapResult.verticalSnap.position * transform.scale;

      switch (snapResult.verticalSnap.type) {
        case "left":
          deltaX = snappedX - rawLeft;
          finalLeft = snappedX + offsetX * transform.scale;
          break;
        case "right":
          deltaX = snappedX - width * transform.scale - rawLeft;
          finalLeft =
            snappedX - width * transform.scale + offsetX * transform.scale;
          break;
        case "centerX":
          deltaX = snappedX - (width * transform.scale) / 2 - rawLeft;
          finalLeft =
            snappedX -
            (width * transform.scale) / 2 +
            offsetX * transform.scale;
          break;
      }
    }

    if (snapResult.horizontalSnap) {
      const snappedY =
        transform.y + snapResult.horizontalSnap.position * transform.scale;

      switch (snapResult.horizontalSnap.type) {
        case "top":
          deltaY = snappedY - rawTop;
          finalTop = snappedY + offsetY * transform.scale;
          break;
        case "bottom":
          deltaY = snappedY - height * transform.scale - rawTop;
          finalTop =
            snappedY - height * transform.scale + offsetY * transform.scale;
          break;
        case "centerY":
          deltaY = snappedY - (height * transform.scale) / 2 - rawTop;
          finalTop =
            snappedY -
            (height * transform.scale) / 2 +
            offsetY * transform.scale;
          break;
      }
    }
  }

  return {
    finalLeft,
    finalTop,
    snapResult,
    deltaX,
    deltaY,
  };
}
