// src/builder/context/resizeHandlers/handleResizeStart.ts
import React from "react";
import { Direction } from "../utils";
import { canvasOps } from "../atoms/canvas-interaction-store";
import { snapOps } from "../atoms/snap-guides-store";
import { visualOps } from "../atoms/visual-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";

/**
 * If SHIFT + direct edge, we snap movement to multiples of SHIFT_INCREMENT.
 */
const SHIFT_INCREMENT = 100;

/**
 * For each node on pointer-down, store its initial geometry plus handle orientation.
 */
export type NodeInitial = {
  width: number;
  height: number;
  left: number;
  top: number;
  xHandle: "left" | "right";
  yHandle: "top" | "bottom";
  parentCanvasOffsetX?: number;
  parentCanvasOffsetY?: number;
  isAbsolutePositioned?: boolean;
};

/**
 * SHIFT + corner => aspect ratio.
 */
export type AspectRatioState = {
  ratio: number;
  primaryAxis: "x" | "y" | null;
};

/**
 * Helper function to determine if there was significant movement on the active axis
 */
export function movedOnActiveAxis(
  dir: Direction,
  dx: number,
  dy: number,
  min = 1 /* px */
) {
  switch (dir) {
    case "left":
    case "right":
      return Math.abs(dx) >= min;
    case "top":
    case "bottom":
      return Math.abs(dy) >= min;
    default: // corners
      return Math.abs(dx) >= min || Math.abs(dy) >= min;
  }
}

/**
 * Map a direction ("topLeft", "left", etc.) to the x/y handle sides.
 */
export function getHandlesFromDirection(dir: Direction) {
  let xHandle: "left" | "right" = "left";
  let yHandle: "top" | "bottom" = "top";
  switch (dir) {
    case "left":
      xHandle = "left";
      yHandle = "bottom"; // not relevant for vertical
      break;
    case "right":
      xHandle = "right";
      yHandle = "bottom";
      break;
    case "top":
      xHandle = "right"; // not relevant for horizontal
      yHandle = "top";
      break;
    case "bottom":
      xHandle = "right";
      yHandle = "bottom";
      break;
    case "topLeft":
      xHandle = "left";
      yHandle = "top";
      break;
    case "topRight":
      xHandle = "right";
      yHandle = "top";
      break;
    case "bottomLeft":
      xHandle = "left";
      yHandle = "bottom";
      break;
    case "bottomRight":
      xHandle = "right";
      yHandle = "bottom";
      break;
  }
  return { xHandle, yHandle };
}

/**
 * Helper function to update resize direction after zero crossing
 */
export function updateResizeDirectionAfterCrossing(
  newXHandle: "left" | "right",
  newYHandle: "top" | "bottom",
  direction: Direction
): Direction {
  if (newXHandle === "left" && newYHandle === "top") {
    return "topLeft";
  } else if (newXHandle === "right" && newYHandle === "top") {
    return "topRight";
  } else if (newXHandle === "left" && newYHandle === "bottom") {
    return "bottomLeft";
  } else if (newXHandle === "right" && newYHandle === "bottom") {
    return "bottomRight";
  } else if (
    newXHandle === "left" &&
    (direction === "left" || direction === "right")
  ) {
    return "left";
  } else if (
    newXHandle === "right" &&
    (direction === "left" || direction === "right")
  ) {
    return "right";
  } else if (
    newYHandle === "top" &&
    (direction === "top" || direction === "bottom")
  ) {
    return "top";
  } else if (
    newYHandle === "bottom" &&
    (direction === "top" || direction === "bottom")
  ) {
    return "bottom";
  }
  return direction;
}

/**
 * Create the resize handler function
 * This function is exported as a factory to allow injection of dependencies
 */
export function createResizeHandler({
  nodeId,
  getTransform,
  startRecording,
  stopRecording,
  isLocked,
  getSelectedIds,
  getParentId,
  style,
  initialSizesRef,
  aspectRatioRef,
  elementRef,
}: {
  nodeId: string;
  getTransform: () => any;
  startRecording: () => string;
  stopRecording: (id: string) => void;
  isLocked: boolean;
  getSelectedIds: () => string[];
  getParentId: (id: string) => string | null;
  style: any;
  initialSizesRef: React.MutableRefObject<Record<string, NodeInitial>>;
  aspectRatioRef: React.MutableRefObject<AspectRatioState>;
  elementRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    e: React.PointerEvent,
    direction: Direction,
    isDirectBorderResize = false
  ) => {
    // Prevent resize for locked nodes
    if (isLocked) return;
    if (!elementRef.current) return;

    const transform = getTransform();
    const parentId = getParentId(nodeId);

    e.preventDefault();
    e.stopPropagation();

    const sessionId = startRecording();

    // Set wait flag to prevent snap guides until movement
    snapOps.setWaitForResizeMove(true);

    // Set resize direction in the store directly
    snapOps.setResizeDirection(direction);

    // Get current selected IDs at the time of the event
    const selectedIds = getSelectedIds();

    // If multiple nodes are selected, use only unlocked ones
    const selectedNodesToResize =
      selectedIds.length > 0
        ? selectedIds.filter((id) => {
            const selectedNode =
              selectedIds.length > 1
                ? document.querySelector(
                    `[data-node-id="${id}"][data-node-locked="false"]`
                  )
                : document.querySelector(`[data-node-id="${id}"]`);
            return selectedNode !== null;
          })
        : [nodeId];

    // If all selected nodes are locked, don't proceed
    if (selectedNodesToResize.length === 0) return;

    // Determine which handles are active based on the resize direction.
    const { xHandle, yHandle } = getHandlesFromDirection(direction);

    // Store final style updates for all nodes to apply at the end
    const finalStyleUpdates = new Map();

    // Find the canvas root element for coordinate conversion
    const canvasRoot = document.querySelector(
      '.relative[style*="transform-origin"]'
    ) as HTMLElement;
    const canvasRect = canvasRoot.getBoundingClientRect();

    // 1) Capture each node's initial geometry and positioning style
    selectedNodesToResize.forEach((id) => {
      const el = document.querySelector(
        `[data-node-id="${id}"]`
      ) as HTMLElement;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const parentEl = el.parentElement;
      const parentRect = parentEl
        ? parentEl.getBoundingClientRect()
        : { left: 0, top: 0 };
      const computed = window.getComputedStyle(el);
      const w = parseFloat(computed.width) || 0;
      const h = parseFloat(computed.height) || 0;

      // Convert screen coordinates to parent-local coordinates.
      const localX = (rect.left - parentRect.left) / transform.scale;
      const localY = (rect.top - parentRect.top) / transform.scale;

      // Calculate parent's offset in canvas-space
      const parentCanvasOffsetX =
        (parentRect.left - canvasRect.left) / transform.scale;
      const parentCanvasOffsetY =
        (parentRect.top - canvasRect.top) / transform.scale;

      const isAbsolutePositioned =
        style.position === "absolute" ||
        style.isFakeFixed === "true" ||
        style.isAbsoluteInFrame === "true";

      initialSizesRef.current[id] = {
        width: w,
        height: h,
        left: localX,
        top: localY,
        xHandle,
        yHandle,
        parentCanvasOffsetX,
        parentCanvasOffsetY,
        isAbsolutePositioned,
      };
    });

    // 2) Determine style units.
    const computedStyle = window.getComputedStyle(elementRef.current);
    const parentElement = elementRef.current.parentElement;
    const widthStyle = elementRef.current.style.width;
    const heightStyle = elementRef.current.style.height;
    const isWidthPercent = widthStyle.includes("%");
    const isHeightPercent = heightStyle.includes("%");
    const isWidthAuto = widthStyle === "auto";
    const isHeightAuto = heightStyle === "auto";

    // Setup aspect ratio state (for SHIFT+corner resizing).
    const startWidth = parseFloat(computedStyle.width) || 0;
    const startHeight = parseFloat(computedStyle.height) || 0;
    aspectRatioRef.current = {
      ratio: startWidth / startHeight,
      primaryAxis: null,
    };

    const parentWidth = parentElement?.clientWidth || 0;
    const parentHeight = parentElement?.clientHeight || 0;

    // 3) Capture initial pointer position.
    let startX = e.clientX;
    let startY = e.clientY;

    // Store original direction for comparison after zero crossing
    let currentDirection = direction;

    canvasOps.setIsResizing(true);

    // Show the dimension overlay for the main node.
    visualOps.updateStyleHelper({
      type: "dimensions",
      position: { x: e.clientX, y: e.clientY },
      dimensions: {
        width: isWidthPercent ? (startWidth / parentWidth) * 100 : startWidth,
        height: isHeightPercent
          ? (startHeight / parentHeight) * 100
          : startHeight,
        unit: isWidthPercent ? "%" : "px",
        widthUnit: isWidthPercent ? "%" : "px",
        heightUnit: isHeightPercent ? "%" : "px",
      },
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();

      // 1. Get raw pointer deltas.
      const rawDeltaX = (moveEvent.clientX - startX) / transform.scale;
      const rawDeltaY = (moveEvent.clientY - startY) / transform.scale;

      // 2. Apply SHIFT snapping if applicable.
      let deltaX = rawDeltaX;
      let deltaY = rawDeltaY;
      if (isDirectBorderResize && moveEvent.shiftKey) {
        if (direction === "left" || direction === "right") {
          deltaX = Math.round(deltaX / SHIFT_INCREMENT) * SHIFT_INCREMENT;
        } else if (direction === "top" || direction === "bottom") {
          deltaY = Math.round(deltaY / SHIFT_INCREMENT) * SHIFT_INCREMENT;
        }
      }
      // If resizing a single border, ignore the non-active axis.
      if (direction === "left" || direction === "right") {
        deltaY = 0;
      }
      if (direction === "top" || direction === "bottom") {
        deltaX = 0;
      }

      // ---------------------- 0-movement guard ----------------------
      if (!movedOnActiveAxis(direction, deltaX, deltaY)) {
        // don't show guides, don't snap – user hasn't really dragged yet
        snapOps.resetGuides();
        return;
      }

      // Turn off wait flag since we've detected movement
      snapOps.setWaitForResizeMove(false);
      // --------------------------------------------------------------

      // 3. Find maximum initial dimensions among selected nodes (for normalization).
      let maxInitialWidth = 0;
      let maxInitialHeight = 0;
      selectedNodesToResize.forEach((id) => {
        const init = initialSizesRef.current[id];
        if (!init) return;
        maxInitialWidth = Math.max(maxInitialWidth, init.width);
        maxInitialHeight = Math.max(maxInitialHeight, init.height);
      });

      const isCorner = [
        "topLeft",
        "topRight",
        "bottomLeft",
        "bottomRight",
      ].includes(direction);
      const isShiftPressed = moveEvent.shiftKey;

      let mainFinalWidth: number | undefined;
      let mainFinalHeight: number | undefined;

      // Get snap guides state for snapping
      const snapGuidesState = snapOps.getState();
      const snapThreshold = snapGuidesState.snapThreshold / transform.scale;
      const activeSnapPoints = snapGuidesState.activeSnapPoints;

      // 4. Process each selected node.
      selectedNodesToResize.forEach((id) => {
        const init = initialSizesRef.current[id];
        if (!init) return;
        const {
          width,
          height,
          left,
          top,
          parentCanvasOffsetX,
          parentCanvasOffsetY,
          isAbsolutePositioned,
        } = init;

        let { xHandle, yHandle } = init;

        // Compute normalized delta for this node.
        const widthScaleFactor = maxInitialWidth ? width / maxInitialWidth : 1;
        const heightScaleFactor = maxInitialHeight
          ? height / maxInitialHeight
          : 1;
        const normalizedDeltaX = deltaX * widthScaleFactor;
        const normalizedDeltaY = deltaY * heightScaleFactor;

        // 5. Calculate new dimensions and positions.
        let newWidth =
          width + (xHandle === "left" ? -normalizedDeltaX : normalizedDeltaX);
        let newHeight =
          height + (yHandle === "top" ? -normalizedDeltaY : normalizedDeltaY);
        let newLeft = xHandle === "left" ? left + normalizedDeltaX : left;
        let newTop = yHandle === "top" ? top + normalizedDeltaY : top;

        // 6. Apply aspect ratio locking if SHIFT is pressed on a corner.
        if (
          isCorner &&
          isShiftPressed &&
          !isWidthAuto &&
          !isHeightAuto &&
          height !== 0
        ) {
          const ratio = aspectRatioRef.current.ratio;
          // Recalculate based solely on horizontal movement.
          if (xHandle === "left") {
            newWidth = width - normalizedDeltaX;
            newLeft = left + normalizedDeltaX;
          } else {
            newWidth = width + normalizedDeltaX;
            newLeft = left;
          }
          newHeight = newWidth / ratio;
          if (yHandle === "top") {
            newTop = top + (height - newHeight);
          } else {
            newTop = top;
          }
        }

        // 7. Handle zero crossing.
        if (isCorner && isShiftPressed) {
          // Aspect ratio mode: maintain ratio even after crossing.
          const ratio = aspectRatioRef.current.ratio;
          let crossed = false;
          if (newWidth < 0) {
            const wasLeft = xHandle === "left";
            xHandle = wasLeft ? "right" : "left";
            newWidth = -newWidth;
            newLeft = wasLeft ? left + width : left;
            // Recalculate height using the ratio.
            newHeight = newWidth / ratio;
            if (yHandle === "top") {
              newTop = top + (height - newHeight);
            } else {
              newTop = top;
            }
            crossed = true;
          }
          if (newHeight < 0) {
            const wasTop = yHandle === "top";
            yHandle = wasTop ? "bottom" : "top";
            newHeight = -newHeight;
            newTop = wasTop ? top + height : top;
            // Recalculate width from the ratio.
            newWidth = newHeight * ratio;
            if (xHandle === "left") {
              newLeft = left + (width - newWidth);
            } else {
              newLeft = left;
            }
            crossed = true;
          }
          if (crossed) {
            startX = moveEvent.clientX;
            startY = moveEvent.clientY;
            initialSizesRef.current[id] = {
              ...init,
              width: newWidth,
              height: newHeight,
              left: newLeft,
              top: newTop,
              xHandle,
              yHandle,
            };

            // Update resize direction in snap guides store
            const newDirection = updateResizeDirectionAfterCrossing(
              xHandle,
              yHandle,
              direction
            );
            if (newDirection !== currentDirection) {
              currentDirection = newDirection;
              snapOps.setResizeDirection(newDirection);
            }
          }
        } else {
          // Regular zero crossing for non-corner or non-shift cases.
          let crossedZero = false;

          if (newWidth < 0) {
            const wasLeft = xHandle === "left";
            xHandle = wasLeft ? "right" : "left";
            newWidth = -newWidth;
            newLeft = wasLeft ? left + width : left;
            startX = moveEvent.clientX;
            initialSizesRef.current[id] = {
              ...init,
              width: 0,
              left: newLeft,
              xHandle,
            };
            crossedZero = true;
          }
          if (newHeight < 0) {
            const wasTop = yHandle === "top";
            yHandle = wasTop ? "bottom" : "top";
            newHeight = -newHeight;
            newTop = wasTop ? top + height : top;
            startY = moveEvent.clientY;
            initialSizesRef.current[id] = {
              ...init,
              height: 0,
              top: newTop,
              yHandle,
            };
            crossedZero = true;
          }

          // Update resize direction in the store when crossing zero boundary
          if (crossedZero) {
            const newDirection = updateResizeDirectionAfterCrossing(
              xHandle,
              yHandle,
              direction
            );
            if (newDirection !== currentDirection) {
              currentDirection = newDirection;
              snapOps.setResizeDirection(newDirection);
            }
          }
        }

        // Apply snap guides if not using shift increments
        // IMPORTANT: We apply snapping after zero crossing to ensure we're using the correct edges
        if (
          (!isDirectBorderResize || !moveEvent.shiftKey) &&
          isAbsolutePositioned
        ) {
          // Convert parent-space coordinates to canvas-space for snap comparisons
          const canvasLeft = newLeft + parentCanvasOffsetX;
          const canvasTop = newTop + parentCanvasOffsetY;
          const canvasRight = canvasLeft + newWidth;
          const canvasBottom = canvasTop + newHeight;

          // Check for horizontal snap (top, bottom)
          if (
            activeSnapPoints.horizontal &&
            [
              "top",
              "bottom",
              "topLeft",
              "topRight",
              "bottomLeft",
              "bottomRight",
            ].includes(currentDirection)
          ) {
            const snapPos = activeSnapPoints.horizontal.position;

            // Compare canvas-space coordinates for top edge
            if (
              yHandle === "top" &&
              Math.abs(canvasTop - snapPos) <= snapThreshold
            ) {
              // Calculate delta in canvas-space
              const delta = canvasTop - snapPos;
              // Apply correction in parent-space
              newTop -= delta;
              newHeight += delta;
            }

            // Compare canvas-space coordinates for bottom edge
            if (
              yHandle === "bottom" &&
              Math.abs(canvasBottom - snapPos) <= snapThreshold
            ) {
              // Calculate delta in canvas-space
              const delta = canvasBottom - snapPos;
              // Apply correction in parent-space
              newHeight -= delta;
            }
          }

          // Check for vertical snap (left, right)
          if (
            activeSnapPoints.vertical &&
            [
              "left",
              "right",
              "topLeft",
              "topRight",
              "bottomLeft",
              "bottomRight",
            ].includes(currentDirection)
          ) {
            const snapPos = activeSnapPoints.vertical.position;

            // Compare canvas-space coordinates for left edge
            if (
              xHandle === "left" &&
              Math.abs(canvasLeft - snapPos) <= snapThreshold
            ) {
              // Calculate delta in canvas-space
              const delta = canvasLeft - snapPos;
              // Apply correction in parent-space
              newLeft -= delta;
              newWidth += delta;
            }

            // Compare canvas-space coordinates for right edge
            if (
              xHandle === "right" &&
              Math.abs(canvasRight - snapPos) <= snapThreshold
            ) {
              // Calculate delta in canvas-space
              const delta = canvasRight - snapPos;
              // Apply correction in parent-space
              newWidth -= delta;
            }
          }
        }

        // 8. Convert dimensions to percentages if needed.
        let finalWidth = newWidth;
        let finalHeight = newHeight;
        if (parentElement?.clientWidth && isWidthPercent) {
          finalWidth = (newWidth / parentElement.clientWidth) * 100;
        }
        if (parentElement?.clientHeight && isHeightPercent) {
          finalHeight = (newHeight / parentElement.clientHeight) * 100;
        }
        if (id === nodeId) {
          mainFinalWidth = finalWidth;
          mainFinalHeight = finalHeight;
        }

        // 9. Build the style update.
        const styleUpdate: Record<string, string> = {};

        // Apply position updates for ALL absolutely positioned elements
        if (isAbsolutePositioned) {
          const wHandles = [
            "left",
            "right",
            "topLeft",
            "topRight",
            "bottomLeft",
            "bottomRight",
          ];
          const hHandles = [
            "top",
            "bottom",
            "topLeft",
            "topRight",
            "bottomLeft",
            "bottomRight",
          ];

          // Update left position when using left handle
          if (xHandle === "left" && wHandles.includes(currentDirection)) {
            styleUpdate.left = `${newLeft}px`;
          }

          // Update top position when using top handle
          if (yHandle === "top" && hHandles.includes(currentDirection)) {
            styleUpdate.top = `${newTop}px`;
          }

          // Update width for all width-affecting handles
          if (wHandles.includes(currentDirection)) {
            styleUpdate.width = `${finalWidth}${isWidthPercent ? "%" : "px"}`;
          }

          // Update height for all height-affecting handles
          if (hHandles.includes(currentDirection)) {
            styleUpdate.height = `${finalHeight}${
              isHeightPercent ? "%" : "px"
            }`;
          }
        } else {
          // For non-absolute elements, just update width/height
          const wHandles = [
            "left",
            "right",
            "topLeft",
            "topRight",
            "bottomLeft",
            "bottomRight",
          ];
          if (wHandles.includes(currentDirection)) {
            styleUpdate.width = `${finalWidth}${isWidthPercent ? "%" : "px"}`;
          }

          const hHandles = [
            "top",
            "bottom",
            "topLeft",
            "topRight",
            "bottomLeft",
            "bottomRight",
          ];
          if (hHandles.includes(currentDirection)) {
            styleUpdate.height = `${finalHeight}${
              isHeightPercent ? "%" : "px"
            }`;
          }
        }

        // // DIRECT DOM UPDATE: Apply style directly to DOM
        // const nodeElement = document.querySelector(
        //   `[data-node-id="${id}"]`
        // ) as HTMLElement;
        // if (nodeElement) {
        //   Object.entries(styleUpdate).forEach(([prop, value]) => {
        //     nodeElement.style[prop] = value;
        //   });
        // }

        updateNodeStyle(id, styleUpdate);

        // Store the final style update for this node to apply at the end
        finalStyleUpdates.set(id, styleUpdate);
      });

      if (mainFinalWidth !== undefined && mainFinalHeight !== undefined) {
        visualOps.updateStyleHelper({
          type: "dimensions",
          position: { x: moveEvent.clientX, y: moveEvent.clientY },
          dimensions: {
            width: mainFinalWidth,
            height: mainFinalHeight,
            unit: isWidthPercent ? "%" : "px",
            widthUnit: isWidthPercent ? "%" : "px",
            heightUnit: isHeightPercent ? "%" : "px",
          },
        });
      }
    };

    const handlePointerUp = () => {
      // Apply all final style updates at once using updatestyle
      finalStyleUpdates.forEach((styleUpdate, id) => {
        // Use updateNodeStyle instead of setNodeStyle
        updateNodeStyle(id, styleUpdate);
      });

      visualOps.hideStyleHelper();
      stopRecording(sessionId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      // Reset snap guides state
      snapOps.setResizeDirection(null);
      snapOps.setWaitForResizeMove(false);
      snapOps.resetGuides();

      canvasOps.setIsResizing(false);
      aspectRatioRef.current.primaryAxis = null;
      initialSizesRef.current = {};
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };
}
