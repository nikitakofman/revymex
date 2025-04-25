// DraggedNode.tsx

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
import { visualOps } from "@/builder/context/atoms/visual-store";

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

const DraggedNode: React.FC<DraggedNodeProps> = ({
  node,
  content,
  virtualReference,
  transform,
  offset,
}) => {
  const { dragState, nodeState, containerRef } = useBuilder();
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

  // FIX: Special handling for absolutely positioned nodes in frames
  let rawLeft: number;
  let rawTop: number;

  if (dragState.dragSource === "absolute-in-frame" || isAbsoluteInFrame(node)) {
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
  if (snapGrid && (dragState.isOverCanvas || dragState.dynamicModeNodeId)) {
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

  // Step 3: dispatch the final guides
  useEffect(() => {
    if (!finalSnapResult) {
      visualOps.clearSnapGuides();
      lastSnapRef.current = null;
      return;
    }
    const { snapGuides } = finalSnapResult;
    // compare
    const oldString = JSON.stringify(lastSnapRef.current);
    const newString = JSON.stringify(finalSnapResult);
    if (oldString !== newString) {
      lastSnapRef.current = finalSnapResult;
      if (snapGuides.length) {
        visualOps.setSnapGuides(snapGuides);
      } else {
        visualOps.clearSnapGuides();
      }
    }
  }, [finalSnapResult]);

  // keep original node width/height while dragging
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
