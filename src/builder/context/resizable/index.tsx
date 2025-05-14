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
  getCurrentNodes,
} from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import { useIsDragging } from "../atoms/drag-store";
import { snapOps } from "../atoms/snap-guides-store";
import { createResizeHandler } from "./create-resize-handler";

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
  const getParentId = useGetNodeParent();

  // Extract flags
  const { isLocked = false } = flags;

  const isDragging = useIsDragging();

  // For debugging
  // console.log(`Resizable Wrapper re-rendering: ${nodeId}`, new Date().getTime());

  const getTransform = useGetTransform();
  const isMiddleMouseDown = useIsMiddleMouseDown();
  const isResizing = useIsResizing();
  const isDraggingChevrons = useIsDraggingChevrons();
  const isEditingText = useIsEditingText();
  const isTextMenuOpen = useIsTextMenuOpen();
  const isFontSizeHandleActive = useIsFontSizeHandleActive();
  const getNodeFlags = useGetNodeFlags();

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
    createResizeHandler({
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
    }),
    [
      nodeId,
      getTransform,
      startRecording,
      stopRecording,
      isLocked,
      getSelectedIds,
      getParentId,
      style,
    ]
  );

  const noPointer = isResizing;

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
        !isDragging &&
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
