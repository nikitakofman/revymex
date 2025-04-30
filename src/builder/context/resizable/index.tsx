import React, { useRef, useCallback, RefObject } from "react";
import { useBuilderDynamic } from "@/builder/context/builderState";
import { Direction } from "../utils";
import { VisualHelpers } from "./VisualHelpers";
import {
  useNodeSelected,
  useGetSelectedIds,
  selectOps,
  useNodeTempSelected,
} from "../atoms/select-store";
import { visualOps } from "../atoms/visual-store";
import {
  canvasOps,
  useGetTransform,
  useIsDraggingChevrons,
  useIsEditingText,
  useIsFontSizeHandleActive,
  useIsMiddleMouseDown,
  useIsMoveCanvasMode,
  useIsResizing,
  useIsTextMenuOpen,
} from "../atoms/canvas-interaction-store";
import { useNodeHovered } from "../atoms/hover-store";
import {
  useNodeStyle,
  useGetNodeFlags,
  useGetNodeParent,
} from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";

/**
 * If SHIFT + direct edge, we snap movement to multiples of SHIFT_INCREMENT.
 */
const SHIFT_INCREMENT = 100;

/**
 * SHIFT + corner => aspect ratio.
 */
type AspectRatioState = {
  ratio: number;
  primaryAxis: "x" | "y" | null;
};

/**
 * For each node on pointer-down, store its initial geometry plus handle orientation.
 */
type NodeInitial = {
  width: number;
  height: number;
  left: number;
  top: number;
  xHandle: "left" | "right";
  yHandle: "top" | "bottom";
};

/**
 * Map a direction ("topLeft", "left", etc.) to the x/y handle sides.
 */
function getHandlesFromDirection(dir: Direction) {
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
 * ResizableWrapper that:
 * - Lets you resize absolutely positioned elements down to width=0 or height=0.
 * - If you cross below zero, it flips immediately (left↔right or top↔bottom) and continues
 *   from zero on the new side, with no jump.
 * - SHIFT + corner => locks aspect ratio.
 * - SHIFT + direct edge => snaps to multiples of SHIFT_INCREMENT.
 * - No min-size clamp.
 * - Respects locked nodes: they can be selected but not modified.
 */
export const ResizableWrapper = ({
  nodeId,
  isDraggable = true,
  children,
}: {
  nodeId: string;
  isDraggable?: boolean;
  children: React.ReactElement;
}) => {
  const { startRecording, stopRecording } = useBuilderDynamic();

  // Get node data from atoms
  const style = useNodeStyle(nodeId);
  const flags = useGetNodeFlags(nodeId);
  const parentId = useGetNodeParent(nodeId);

  // Extract flags
  const { isLocked = false } = flags;

  // For debugging
  // console.log(`Resizable Wrapper re-rendering: ${nodeId}`, new Date().getTime());

  const getTransform = useGetTransform();
  const isMiddleMouseDown = useIsMiddleMouseDown();
  const isResizing = useIsResizing();
  const isDraggingChevrons = useIsDraggingChevrons();
  const isEditingText = useIsEditingText();
  const isTextMenuOpen = useIsTextMenuOpen();
  const isFontSizeHandleActive = useIsFontSizeHandleActive();

  const isSelected = useNodeSelected(nodeId);
  const isHovered = useNodeHovered(nodeId);
  const isNodeTempSelected = useNodeTempSelected(nodeId);

  const elementRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;

  const isMoveCanvasMode = useIsMoveCanvasMode();

  // Use the imperative getter for selected IDs - no subscription
  const getSelectedIds = useGetSelectedIds();

  // For SHIFT+corner aspect ratio.
  const aspectRatioRef = useRef<AspectRatioState>({
    ratio: 1,
    primaryAxis: null,
  });

  // Store each node's initial geometry on pointer-down.
  const initialSizesRef = useRef<Record<string, NodeInitial>>({});

  const handleResizeStart = useCallback(
    (
      e: React.PointerEvent,
      direction: Direction,
      isDirectBorderResize = false
    ) => {
      // Prevent resize for locked nodes
      if (isLocked) return;

      if (!elementRef.current) return;

      const transform = getTransform();

      e.preventDefault();
      e.stopPropagation();

      const sessionId = startRecording();

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

      // 1) Capture each node's initial geometry.
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
        initialSizesRef.current[id] = {
          width: w,
          height: h,
          left: localX,
          top: localY,
          xHandle,
          yHandle,
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

        // 4. Process each selected node.
        selectedNodesToResize.forEach((id) => {
          const init = initialSizesRef.current[id];
          if (!init) return;
          const { width, height, left, top } = init;

          let { xHandle, yHandle } = init;

          // Compute normalized delta for this node.
          const widthScaleFactor = maxInitialWidth
            ? width / maxInitialWidth
            : 1;
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
            }
          } else {
            // Regular zero crossing for non-corner or non-shift cases.
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
          if (!parentId) {
            styleUpdate.left = `${newLeft}px`;
            styleUpdate.top = `${newTop}px`;
          }
          const wHandles = [
            "left",
            "right",
            "topLeft",
            "topRight",
            "bottomLeft",
            "bottomRight",
          ];
          if (wHandles.includes(direction)) {
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
          if (hHandles.includes(direction)) {
            styleUpdate.height = `${finalHeight}${
              isHeightPercent ? "%" : "px"
            }`;
          }

          // DIRECT DOM UPDATE: Apply style directly to DOM
          const nodeElement = document.querySelector(
            `[data-node-id="${id}"]`
          ) as HTMLElement;
          if (nodeElement) {
            Object.entries(styleUpdate).forEach(([prop, value]) => {
              nodeElement.style[prop] = value;
            });
          }

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
        // Apply all final style updates at once using updateNodeStyle
        finalStyleUpdates.forEach((styleUpdate, id) => {
          // Use updateNodeStyle instead of setNodeStyle
          updateNodeStyle(id, styleUpdate);
        });

        visualOps.hideStyleHelper();
        stopRecording(sessionId);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        canvasOps.setIsResizing(false);
        aspectRatioRef.current.primaryAxis = null;
        initialSizesRef.current = {};
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [
      nodeId,
      getTransform,
      startRecording,
      stopRecording,
      isLocked,
      getSelectedIds,
      parentId,
    ]
  );

  const noPointer = isResizing;

  // Create a node object to pass to VisualHelpers (for backward compatibility)
  const nodeForVisualHelpers = {
    id: nodeId,
    type: "frame",
    isLocked,
    style,
  };

  return (
    <>
      {React.cloneElement(children, {
        ref: elementRef,
        style: {
          ...children.props.style,
          pointerEvents: noPointer ? "none" : "auto",
        },
        "data-node-locked": isLocked ? "true" : "false", // Add data attribute for locked state
        children: children.props.children,
      } as React.HTMLAttributes<HTMLElement>)}

      {/* Only render visual helpers for unlocked nodes */}
      {!isMoveCanvasMode &&
        !isEditingText &&
        !isTextMenuOpen &&
        !isFontSizeHandleActive &&
        !isMiddleMouseDown &&
        !isDraggingChevrons &&
        (isSelected || isHovered || isNodeTempSelected) && (
          <VisualHelpers
            key={nodeId}
            elementRef={elementRef}
            nodeId={nodeId}
            handleResizeStart={handleResizeStart}
          />
        )}
    </>
  );
};
