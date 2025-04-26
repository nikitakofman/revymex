// DraggedNode.tsx

import React, {
  ReactElement,
  CSSProperties,
  useEffect,
  useRef,
  cloneElement,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Node } from "../../reducer/nodeDispatcher";
import { useBuilder } from "../builderState";
import { useSnapGrid, SnapResult } from "./SnapGrid";
import { getFilteredNodes, isAbsoluteInFrame, parseRotation } from "../utils";
import { visualOps } from "@/builder/context/atoms/visual-store";
import {
  useAdditionalDraggedNodes,
  useDragSource,
  useIsOverCanvas,
  useNodeDimensions,
  useGetIsDragging,
} from "../atoms/drag-store";
import { useDynamicModeNodeId } from "../atoms/dynamic-store";
import { useTransform } from "../atoms/canvas-interaction-store";

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
  offset: { mouseX: number; mouseY: number };
}

const DraggedNode: React.FC<DraggedNodeProps> = ({ node, content, offset }) => {
  const { nodeState, containerRef } = useBuilder();

  // Get transform directly from atoms
  const transform = useTransform();

  // Virtual reference state - moved from RenderNodes
  const [virtualReference, setVirtualReference] =
    useState<VirtualReference | null>(null);
  const getIsDragging = useGetIsDragging();

  // Use atoms for state
  const dynamicModeNodeId = useDynamicModeNodeId();
  const additionalDraggedNodes = useAdditionalDraggedNodes();
  const dragSource = useDragSource();
  const isOverCanvas = useIsOverCanvas();

  const initialDimensionsRef = useRef<{ width: number; height: number } | null>(
    null
  );

  const nodeDimensions = useNodeDimensions();

  // Set up mouse move listener for virtual reference - BEFORE any conditional returns
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const isDragging = getIsDragging();
      // Only update virtualReference when dragging
      if (isDragging) {
        setVirtualReference({
          getBoundingClientRect() {
            return {
              top: e.clientY,
              left: e.clientX,
              bottom: e.clientY,
              right: e.clientX,
              width: 0,
              height: 0,
            };
          },
        });
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [getIsDragging]);

  // figure out which nodes to show
  const activeFilter = dynamicModeNodeId ? "dynamicMode" : "outOfViewport";
  const filteredNodes = getFilteredNodes(
    nodeState.nodes,
    activeFilter,
    dynamicModeNodeId
  );

  const snapGrid = useSnapGrid(filteredNodes);

  // Keep track of the last used SnapResult so we don't re‐dispatch identical guides
  const lastSnapRef = useRef<SnapResult | null>(null);
  const finalSnapResultRef = useRef<SnapResult | null>(null);

  // All useEffect hooks MUST BE BEFORE any conditional returns

  // Effect to update snap guides - BEFORE conditional returns
  useEffect(() => {
    const currentFinalSnapResult = finalSnapResultRef.current;
    if (!currentFinalSnapResult) {
      visualOps.clearSnapGuides();
      lastSnapRef.current = null;
      return;
    }

    const { snapGuides } = currentFinalSnapResult;
    // compare
    const oldString = JSON.stringify(lastSnapRef.current);
    const newString = JSON.stringify(currentFinalSnapResult);
    if (oldString !== newString) {
      lastSnapRef.current = currentFinalSnapResult;
      if (snapGuides.length) {
        visualOps.setSnapGuides(snapGuides);
      } else {
        visualOps.clearSnapGuides();
      }
    }
  }, [finalSnapResultRef.current]);

  // keep original node width/height while dragging - BEFORE conditional returns
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

  // If no virtual reference, we can't position the dragged node
  if (!virtualReference || !containerRef.current) return null;

  // bounding rect of the node in window coords
  const baseRect = virtualReference.getBoundingClientRect();

  // container bounding rect in window coords
  const containerRect = containerRef.current.getBoundingClientRect();

  // store initial dimensions
  const dims = nodeDimensions[node.id];
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
  const isAdditionalDraggedNode = additionalDraggedNodes?.some(
    (info) => info.node.id === node.id
  );

  // FIX: Special handling for absolutely positioned nodes in frames
  let rawLeft: number;
  let rawTop: number;

  if (dragSource === "absolute-in-frame" || isAbsoluteInFrame(node)) {
    // For absolute-in-frame, position directly based on mouse position
    // No additional transformations, just the raw mouse position minus the grabbed point
    const mouseX = baseRect.left;
    const mouseY = baseRect.top;

    rawLeft = mouseX - offset.mouseX * transform.scale - containerRect.left;
    rawTop = mouseY - offset.mouseY * transform.scale - containerRect.top;

    // No other transformations - simplest possible approach
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

  // convert to canvas coords
  const canvasX = (rawLeft - transform.x) / transform.scale;
  const canvasY = (rawTop - transform.y) / transform.scale;

  // add rotation offset
  let finalLeft = rawLeft + offsetX * transform.scale;
  let finalTop = rawTop + offsetY * transform.scale;

  // handle "grip handle" in flex, etc.
  if (dragSource === "gripHandle") {
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

  // Build the 6 snap points
  const snapPoints = [
    { value: canvasX, type: "left" },
    { value: canvasX + nodeWidth, type: "right" },
    { value: canvasX + nodeWidth / 2, type: "centerX" },
    { value: canvasY, type: "top" },
    { value: canvasY + nodeHeight, type: "bottom" },
    { value: canvasY + nodeHeight / 2, type: "centerY" },
  ];

  let snapResult: SnapResult | null = null;

  // Step 2: compute prospective snaps
  if (snapGrid && (isOverCanvas || dynamicModeNodeId)) {
    snapResult = snapGrid.findNearestSnaps(snapPoints, 10, node.id);

    // apply alignment snap
    if (snapResult.verticalSnap) {
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
    if (snapResult.horizontalSnap) {
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

    // apply spacing snap (for "best" offset)
    if (typeof snapResult.horizontalSpacingSnap === "number") {
      const snappedCanvasX = snapResult.horizontalSpacingSnap;
      const snappedScreenX = transform.x + snappedCanvasX * transform.scale;
      finalLeft = snappedScreenX + offsetX * transform.scale;
    }
    if (typeof snapResult.verticalSpacingSnap === "number") {
      const snappedCanvasY = snapResult.verticalSpacingSnap;
      const snappedScreenY = transform.y + snappedCanvasY * transform.scale;
      finalTop = snappedScreenY + offsetY * transform.scale;
    }
  }

  // OPTIONAL: Recompute the final snap lines from the final (snapped) position
  // so they do not move if the mouse slightly moves.
  // We'll do a "mini second pass" for stable lines:
  let stableSnapResult: SnapResult | null = null;
  if (snapGrid && snapResult) {
    // figure out final left/top in canvas coords
    const stableCanvasX = (finalLeft - transform.x) / transform.scale;
    const stableCanvasY = (finalTop - transform.y) / transform.scale;

    const stablePoints = [
      { value: stableCanvasX, type: "left" },
      { value: stableCanvasX + nodeWidth, type: "right" },
      { value: stableCanvasX + nodeWidth / 2, type: "centerX" },
      { value: stableCanvasY, type: "top" },
      { value: stableCanvasY + nodeHeight, type: "bottom" },
      { value: stableCanvasY + nodeHeight / 2, type: "centerY" },
    ];
    stableSnapResult = snapGrid.findNearestSnaps(stablePoints, 10, node.id);
  }

  // Decide which result to dispatch (the stable one if we have it)
  const finalSnapResult = stableSnapResult || snapResult;

  // Store in ref for the effect to use
  finalSnapResultRef.current = finalSnapResult;

  return createPortal(
    <div
      data-node-dragged={node.id}
      style={{
        position: "absolute",
        left: isAbsoluteInFrame(node)
          ? `${finalLeft - parseFloat(node.style.left) * transform.scale}px`
          : `${finalLeft}px`,
        top: isAbsoluteInFrame(node)
          ? `${finalTop - parseFloat(node.style.top) * transform.scale}px`
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
            dragSource === "absolute-in-frame" || isAbsoluteInFrame(node)
              ? "0px" // Force to zero instead of undefined
              : undefined,
          top:
            dragSource === "absolute-in-frame" || isAbsoluteInFrame(node)
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
