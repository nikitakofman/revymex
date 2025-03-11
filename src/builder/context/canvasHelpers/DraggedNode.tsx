// DraggedNode.tsx - Fixed to snap to both canvas and frame lines

import React, {
  ReactElement,
  CSSProperties,
  useEffect,
  useRef,
  cloneElement,
} from "react";
import { createPortal } from "react-dom";
import { Node } from "../../reducer/nodeDispatcher";
import { useBuilder } from "../builderState";
import { useSnapGrid, SnapResult } from "./SnapGrid";
import { getFilteredNodes, isAbsoluteInFrame, parseRotation } from "../utils";

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface Offset {
  mouseX: number;
  mouseY: number;
}

export interface VirtualReference {
  getBoundingClientRect: () => {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
}

interface ContentProps {
  style?: CSSProperties;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

interface DraggedNodeProps {
  node: Node;
  content: ReactElement<ContentProps>;
  virtualReference: VirtualReference | null;
  transform: Transform;
  offset: Offset;
}

// Utility function to get absolute position by recursively adding parent offsets
function getAbsolutePosition(
  nodeId: string | number,
  allNodes: Node[]
): { x: number; y: number } {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node || !node.style) return { x: 0, y: 0 };

  // Start with the node's local position
  let x = parseFloat(node.style.left as string) || 0;
  let y = parseFloat(node.style.top as string) || 0;

  // If this is absolute-in-frame, recursively add the parent's offset
  if (isAbsoluteInFrame(node) && node.parentId) {
    const parentPos = getAbsolutePosition(node.parentId, allNodes);
    x += parentPos.x;
    y += parentPos.y;
  }

  return { x, y };
}

const DraggedNode: React.FC<DraggedNodeProps> = ({
  node,
  content,
  virtualReference,
  transform,
  offset,
}) => {
  const { dragState, nodeState, dragDisp, containerRef } = useBuilder();
  const initialDimensionsRef = useRef<{ width: number; height: number } | null>(
    null
  );

  // figure out which nodes to show
  const activeFilter = dragState.dynamicModeNodeId
    ? "dynamicMode"
    : "outOfViewport";
  const filteredNodes = getFilteredNodes(
    nodeState.nodes,
    activeFilter,
    dragState.dynamicModeNodeId
  );

  const snapGrid = useSnapGrid(filteredNodes);

  // Keep track of the last used SnapResult so we don't re‐dispatch identical guides
  const lastSnapRef = useRef<SnapResult | null>(null);

  // bounding rect of the node in window coords
  const baseRect = virtualReference?.getBoundingClientRect() || {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  };

  // container bounding rect in window coords
  const containerRect = containerRef.current?.getBoundingClientRect() || {
    left: 0,
    top: 0,
  };

  // store initial dimensions
  const dims = dragState.nodeDimensions[node.id];
  if (!initialDimensionsRef.current && dims?.finalWidth && dims?.finalHeight) {
    initialDimensionsRef.current = {
      width: parseFloat(dims.finalWidth),
      height: parseFloat(dims.finalHeight),
    };
  }

  const nodeWidth = parseFloat(node.style.width as string) || 0;
  const nodeHeight = parseFloat(node.style.height as string) || 0;

  // rotation
  const rotationDeg = parseRotation(node.style.rotate as string);
  const rotationRad = (rotationDeg * Math.PI) / 180;

  const effectiveWidth =
    Math.abs(nodeWidth * Math.cos(rotationRad)) +
    Math.abs(nodeHeight * Math.sin(rotationRad));
  const effectiveHeight =
    Math.abs(nodeHeight * Math.cos(rotationRad)) +
    Math.abs(nodeWidth * Math.sin(rotationRad));
  const offsetX = (effectiveWidth - nodeWidth) / 2;
  const offsetY = (effectiveHeight - nodeHeight) / 2;

  // is this an additional (multi) dragged node?
  const isAdditionalDraggedNode = dragState.additionalDraggedNodes?.some(
    (info) => info.node.id === node.id
  );

  // Check if we're dealing with an absolute-in-frame element
  const isAbsoluteNodeInFrame =
    dragState.dragSource === "absolute-in-frame" || isAbsoluteInFrame(node);

  // Function to get the parent frame for absolute-in-frame elements
  const getParentFrame = () => {
    if (!node.parentId) return null;
    return nodeState.nodes.find((n) => n.id === node.parentId) || null;
  };

  // Position calculation for the dragged node
  let rawLeft: number;
  let rawTop: number;

  if (isAbsoluteNodeInFrame) {
    // For absolute-in-frame, position directly based on mouse position
    const mouseX = baseRect.left;
    const mouseY = baseRect.top;

    rawLeft = mouseX - offset.mouseX * transform.scale - containerRect.left;
    rawTop = mouseY - offset.mouseY * transform.scale - containerRect.top;
  } else if (isAdditionalDraggedNode) {
    // Standard logic for additional dragged nodes
    const currentLeft = parseFloat(node.style.left as string) || 0;
    const currentTop = parseFloat(node.style.top as string) || 0;

    rawLeft =
      baseRect.left -
      containerRect.left -
      offset.mouseX * transform.scale -
      currentLeft * transform.scale;
    rawTop =
      baseRect.top -
      containerRect.top -
      offset.mouseY * transform.scale -
      currentTop * transform.scale;
  } else {
    // Standard logic for normal dragged nodes
    rawLeft =
      baseRect.left - containerRect.left - offset.mouseX * transform.scale;
    rawTop = baseRect.top - containerRect.top - offset.mouseY * transform.scale;
  }

  // Convert from screen coordinates to canvas coordinates
  const canvasX = (rawLeft - transform.x) / transform.scale;
  const canvasY = (rawTop - transform.y) / transform.scale;

  // Add rotation offset
  let finalLeft = rawLeft + offsetX * transform.scale;
  let finalTop = rawTop + offsetY * transform.scale;

  // handle "grip handle" in flex, etc.
  if (dragState.dragSource === "gripHandle") {
    const parentNode = nodeState.nodes.find((n) => n.id === node.parentId);
    if (parentNode) {
      const parentEl = document.querySelector(
        `[data-node-id="${parentNode.id}"]`
      ) as HTMLElement;
      if (parentEl) {
        const { display, flexDirection } = window.getComputedStyle(parentEl);
        if (display === "flex") {
          const draggedEl = document.querySelector(
            `[data-node-id="${node.id}"]`
          ) as HTMLElement;
          if (draggedEl) {
            const r = draggedEl.getBoundingClientRect();
            if (flexDirection.includes("row")) {
              finalTop = r.top - containerRect.top;
            } else if (flexDirection.includes("column")) {
              finalLeft = r.left - containerRect.left;
            }
          }
        }
      }
    }
  }

  // Build snap points for the current position - in global coordinates
  let snapPoints = [];

  if (isAbsoluteNodeInFrame && node.parentId) {
    const parentFrame = getParentFrame();

    if (parentFrame) {
      // Get parent position
      const parentLeft = parseFloat(parentFrame.style.left as string) || 0;
      const parentTop = parseFloat(parentFrame.style.top as string) || 0;

      // Calculate current position in canvas coordinates
      const frameRelativeX =
        (finalLeft - transform.x) / transform.scale - offsetX;
      const frameRelativeY =
        (finalTop - transform.y) / transform.scale - offsetY;

      // Convert to global canvas coordinates by adding parent position
      const globalX = parentLeft + frameRelativeX;
      const globalY = parentTop + frameRelativeY;

      // Create snap points in global canvas coordinates
      snapPoints = [
        { value: globalX, type: "left" },
        { value: globalX + nodeWidth, type: "right" },
        { value: globalX + nodeWidth / 2, type: "centerX" },
        { value: globalY, type: "top" },
        { value: globalY + nodeHeight, type: "bottom" },
        { value: globalY + nodeHeight / 2, type: "centerY" },
      ];
    } else {
      // Fallback
      snapPoints = [
        { value: canvasX, type: "left" },
        { value: canvasX + nodeWidth, type: "right" },
        { value: canvasX + nodeWidth / 2, type: "centerX" },
        { value: canvasY, type: "top" },
        { value: canvasY + nodeHeight, type: "bottom" },
        { value: canvasY + nodeHeight / 2, type: "centerY" },
      ];
    }
  } else {
    // Regular elements
    snapPoints = [
      { value: canvasX, type: "left" },
      { value: canvasX + nodeWidth, type: "right" },
      { value: canvasX + nodeWidth / 2, type: "centerX" },
      { value: canvasY, type: "top" },
      { value: canvasY + nodeHeight, type: "bottom" },
      { value: canvasY + nodeHeight / 2, type: "centerY" },
    ];
  }

  let snapResult: SnapResult | null = null;

  // Always enable snapping for absolute-in-frame elements, regardless of whether we're over the canvas
  const enableSnapping =
    snapGrid &&
    (dragState.isOverCanvas ||
      dragState.dynamicModeNodeId ||
      isAbsoluteNodeInFrame);

  // Find relevant nodes for snapping
  let relevantNodes = undefined;

  if (isAbsoluteNodeInFrame && node.parentId) {
    const parentFrame = getParentFrame();

    if (parentFrame) {
      // Get siblings (nodes with same parent) and the parent frame
      const siblings = nodeState.nodes.filter(
        (n) => n.parentId === node.parentId && n.id !== node.id
      );

      // Include the parent frame itself
      relevantNodes = [...siblings, parentFrame];

      // Optionally, also include other nodes with the same parent as the parent frame
      // This helps snapping to "uncle" elements
      if (parentFrame.parentId) {
        const uncles = nodeState.nodes.filter(
          (n) => n.parentId === parentFrame.parentId && n.id !== parentFrame.id
        );
        relevantNodes = [...relevantNodes, ...uncles];
      }
    }
  }

  // Compute prospective snaps with increased threshold for better snapping
  if (enableSnapping) {
    // Find snaps using only relevant nodes if specified - increase threshold for better snapping
    snapResult = snapGrid.findNearestSnaps(
      snapPoints,
      25,
      node.id,
      relevantNodes
    );

    // DEBUGGING
    if (snapResult?.verticalSnap || snapResult?.horizontalSnap) {
      const sourceNode =
        snapResult.verticalSnap?.sourceNodeId ||
        snapResult.horizontalSnap?.sourceNodeId;
      const source = nodeState.nodes.find((n) => n.id === sourceNode);
      console.log("SNAP DETECTED:", {
        sourceNode: source?.id,
        isFrameChild: !!source?.parentId,
        verticalSnap: snapResult.verticalSnap,
        horizontalSnap: snapResult.horizontalSnap,
        relevantNodeCount: relevantNodes?.length,
      });
    }

    // Apply alignment snap for vertical direction
    if (
      snapResult &&
      snapResult.verticalSnap &&
      isAbsoluteNodeInFrame &&
      node.parentId
    ) {
      const parentFrame = getParentFrame();

      if (parentFrame) {
        const parentLeft = parseFloat(parentFrame.style.left as string) || 0;
        const snappedX = snapResult.verticalSnap.position;

        // Convert the snap position from global to frame-relative
        const frameRelativeX = snappedX - parentLeft;

        // Apply offset based on snap type
        let frameX = frameRelativeX;
        switch (snapResult.verticalSnap.type) {
          case "left":
            // No adjustment needed
            break;
          case "right":
            frameX = frameRelativeX - nodeWidth;
            break;
          case "centerX":
            frameX = frameRelativeX - nodeWidth / 2;
            break;
        }

        // Convert frame-relative position to screen position
        finalLeft =
          transform.x +
          (parentLeft + frameX) * transform.scale +
          offsetX * transform.scale;
      }
    } else if (snapResult && snapResult.verticalSnap) {
      // Standard snap application for regular canvas elements
      const snappedX =
        transform.x + snapResult.verticalSnap.position * transform.scale;

      switch (snapResult.verticalSnap.type) {
        case "left":
          finalLeft = snappedX + offsetX * transform.scale;
          break;
        case "right":
          finalLeft =
            snappedX - nodeWidth * transform.scale + offsetX * transform.scale;
          break;
        case "centerX":
          finalLeft =
            snappedX -
            (nodeWidth / 2) * transform.scale +
            offsetX * transform.scale;
          break;
      }
    }

    // Apply alignment snap for horizontal direction
    if (
      snapResult &&
      snapResult.horizontalSnap &&
      isAbsoluteNodeInFrame &&
      node.parentId
    ) {
      const parentFrame = getParentFrame();

      if (parentFrame) {
        const parentTop = parseFloat(parentFrame.style.top as string) || 0;
        const snappedY = snapResult.horizontalSnap.position;

        // Convert the snap position from global to frame-relative
        const frameRelativeY = snappedY - parentTop;

        // Apply offset based on snap type
        let frameY = frameRelativeY;
        switch (snapResult.horizontalSnap.type) {
          case "top":
            // No adjustment needed
            break;
          case "bottom":
            frameY = frameRelativeY - nodeHeight;
            break;
          case "centerY":
            frameY = frameRelativeY - nodeHeight / 2;
            break;
        }

        // Convert frame-relative position to screen position
        finalTop =
          transform.y +
          (parentTop + frameY) * transform.scale +
          offsetY * transform.scale;
      }
    } else if (snapResult && snapResult.horizontalSnap) {
      // Standard snap application for regular canvas elements
      const snappedY =
        transform.y + snapResult.horizontalSnap.position * transform.scale;

      switch (snapResult.horizontalSnap.type) {
        case "top":
          finalTop = snappedY + offsetY * transform.scale;
          break;
        case "bottom":
          finalTop =
            snappedY - nodeHeight * transform.scale + offsetY * transform.scale;
          break;
        case "centerY":
          finalTop =
            snappedY -
            (nodeHeight / 2) * transform.scale +
            offsetY * transform.scale;
          break;
      }
    }
  }

  // Compute stable snaps for consistent guides
  let stableSnapResult: SnapResult | null = null;
  if (enableSnapping && snapResult) {
    // Figure out final left/top in canvas coords
    const stableCanvasX = (finalLeft - transform.x) / transform.scale - offsetX;
    const stableCanvasY = (finalTop - transform.y) / transform.scale - offsetY;

    // Convert to absolute canvas coordinates if needed
    let stableAbsoluteX = stableCanvasX;
    let stableAbsoluteY = stableCanvasY;

    if (isAbsoluteNodeInFrame && node.parentId) {
      const parentFrame = getParentFrame();
      if (parentFrame) {
        const parentLeft = parseFloat(parentFrame.style.left as string) || 0;
        const parentTop = parseFloat(parentFrame.style.top as string) || 0;

        // Convert to global coordinates by adding parent position
        stableAbsoluteX = parentLeft + stableCanvasX;
        stableAbsoluteY = parentTop + stableCanvasY;
      }
    }

    const stablePoints = [
      { value: stableAbsoluteX, type: "left" },
      { value: stableAbsoluteX + nodeWidth, type: "right" },
      { value: stableAbsoluteX + nodeWidth / 2, type: "centerX" },
      { value: stableAbsoluteY, type: "top" },
      { value: stableAbsoluteY + nodeHeight, type: "bottom" },
      { value: stableAbsoluteY + nodeHeight / 2, type: "centerY" },
    ];

    // Find stable snap result using relevant nodes if specified
    stableSnapResult = snapGrid.findNearestSnaps(
      stablePoints,
      25,
      node.id,
      relevantNodes
    );
  }

  // Decide which result to dispatch (the stable one if we have it)
  const finalSnapResult = stableSnapResult || snapResult;

  // Dispatch the final guides
  useEffect(() => {
    if (!finalSnapResult) {
      dragDisp.clearSnapGuides();
      lastSnapRef.current = null;
      return;
    }
    const { snapGuides } = finalSnapResult;
    // Compare with previous guides to avoid re-dispatching identical guides
    const oldString = JSON.stringify(lastSnapRef.current);
    const newString = JSON.stringify(finalSnapResult);
    if (oldString !== newString) {
      lastSnapRef.current = finalSnapResult;
      if (snapGuides.length) {
        dragDisp.setSnapGuides(snapGuides);
      } else {
        dragDisp.clearSnapGuides();
      }
    }
  }, [finalSnapResult, dragDisp]);

  // Keep original node width/height while dragging
  useEffect(() => {
    if ((node.parentId || node.inViewport) && initialDimensionsRef.current) {
      const el = document.querySelector(
        `[data-node-id="${node.id}"]`
      ) as HTMLElement;
      if (el) {
        el.style.width = `${initialDimensionsRef.current.width}px`;
        el.style.height = `${initialDimensionsRef.current.height}px`;
      }
    }
  }, [node.id, node.inViewport, node.parentId]);

  return createPortal(
    <div
      data-node-dragged={node.id}
      style={{
        position: "absolute",
        left: isAbsoluteNodeInFrame
          ? `${
              finalLeft -
              parseFloat(node.style.left as string) * transform.scale
            }px`
          : `${finalLeft}px`,
        top: isAbsoluteNodeInFrame
          ? `${
              finalTop - parseFloat(node.style.top as string) * transform.scale
            }px`
          : `${finalTop}px`,
        transform: `scale(${transform.scale})`,
        transformOrigin: "top left",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {cloneElement(content, {
        style: {
          ...content.props.style,
          position: "absolute",
          transformOrigin: "top left",
          pointerEvents: "none",
          left:
            dragState.dragSource === "absolute-in-frame" ||
            isAbsoluteInFrame(node)
              ? "0px" // Force to zero instead of undefined
              : undefined,
          top:
            dragState.dragSource === "absolute-in-frame" ||
            isAbsoluteInFrame(node)
              ? "0px" // Force to zero instead of undefined
              : undefined,
          width: `${nodeWidth}px`,
          height: `${nodeHeight}px`,
        },
      })}
    </div>,
    containerRef.current as Element | DocumentFragment
  );
};

export default DraggedNode;
