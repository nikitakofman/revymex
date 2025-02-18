import React, {
  ReactElement,
  CSSProperties,
  useEffect,
  useRef,
  cloneElement,
} from "react";
import { createPortal } from "react-dom";
import { Node } from "../reducer/nodeDispatcher";
import { useBuilder } from "../context/builderState";
import { useSnapGrid } from "../context/dnd/SnapGrid";
import { getFilteredNodes, parseRotation } from "../context/dnd/utils";

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
  const { dragState, nodeState, dragDisp } = useBuilder();
  const initialDimensionsRef = useRef<{ width: number; height: number } | null>(
    null
  );

  const activeFilter = dragState.dynamicModeNodeId
    ? "dynamicMode"
    : "outOfViewport";

  const filteredNodes = getFilteredNodes(
    nodeState.nodes,
    activeFilter,
    dragState.dynamicModeNodeId
  );

  const snapGrid = useSnapGrid(filteredNodes);
  const lastSnapGuideRef = useRef<any>(null);

  const baseRect = virtualReference?.getBoundingClientRect() || {
    left: 0,
    top: 0,
  };

  // Get dimensions from dragState
  const dimensions = dragState.nodeDimensions[node.id];

  // Store initial dimensions on first render if we haven't already
  if (
    !initialDimensionsRef.current &&
    dimensions?.finalWidth &&
    dimensions?.finalHeight
  ) {
    initialDimensionsRef.current = {
      width: parseFloat(dimensions.finalWidth as string),
      height: parseFloat(dimensions.finalHeight as string),
    };
  }

  // Use stored dimensions instead of live dimensions
  const width =
    initialDimensionsRef.current?.width ||
    parseFloat(dimensions?.finalWidth as string) ||
    0;
  const height =
    initialDimensionsRef.current?.height ||
    parseFloat(dimensions?.finalHeight as string) ||
    0;

  const rotationDeg = parseRotation(node.style.rotate as string);
  const rotationRad = (rotationDeg * Math.PI) / 180;

  const effectiveHeight =
    Math.abs(height * Math.cos(rotationRad)) +
    Math.abs(width * Math.sin(rotationRad));
  const effectiveWidth =
    Math.abs(width * Math.cos(rotationRad)) +
    Math.abs(height * Math.sin(rotationRad));

  const offsetX = (effectiveWidth - width) * 0.5;
  const offsetY = (effectiveHeight - height) * 0.5;

  // Check if this is an additional dragged node
  const isAdditionalDraggedNode = dragState.additionalDraggedNodes?.some(
    (info) => info.node.id === node.id
  );

  let rawLeft, rawTop;
  if (isAdditionalDraggedNode) {
    // For additional nodes, compensate for existing absolute positioning
    const currentLeft = parseFloat(node.style.left as string) || 0;
    const currentTop = parseFloat(node.style.top as string) || 0;

    rawLeft =
      baseRect.left -
      offset.mouseX * transform.scale -
      currentLeft * transform.scale;
    rawTop =
      baseRect.top -
      offset.mouseY * transform.scale -
      currentTop * transform.scale;
  } else {
    // Original calculation for main dragged node
    rawLeft = baseRect.left - offset.mouseX * transform.scale;
    rawTop = baseRect.top - offset.mouseY * transform.scale;
  }

  const canvasX = (rawLeft - transform.x) / transform.scale;
  const canvasY = (rawTop - transform.y) / transform.scale;

  let finalLeft = rawLeft + offsetX * transform.scale;
  let finalTop = rawTop + offsetY * transform.scale;

  if (dragState.dragSource === "gripHandle") {
    const parentNode = nodeState.nodes.find((n) => n.id === node.parentId);
    if (parentNode) {
      const parentElement = document.querySelector(
        `[data-node-id="${parentNode.id}"]`
      ) as HTMLElement;

      if (parentElement) {
        const parentStyle = window.getComputedStyle(parentElement);
        const flexDirection = parentStyle.flexDirection;
        const display = parentStyle.display;

        if (display === "flex") {
          const draggedElement = document.querySelector(
            `[data-node-id="${node.id}"]`
          );
          if (draggedElement) {
            if (flexDirection.includes("row")) {
              finalTop = draggedElement.getBoundingClientRect().top;
            } else if (flexDirection.includes("column")) {
              finalLeft = draggedElement.getBoundingClientRect().left;
            }
          }
        }
      }
    }
  }

  const snapPoints = [
    { value: canvasX, type: "left" },
    { value: canvasX + width, type: "right" },
    { value: canvasX + width / 2, type: "centerX" },
    { value: canvasY, type: "top" },
    { value: canvasY + height, type: "bottom" },
    { value: canvasY + height / 2, type: "centerY" },
  ];

  let snapResult = null;

  if (snapGrid && (dragState.isOverCanvas || dragState.dynamicModeNodeId)) {
    snapResult = snapGrid.findNearestSnaps(snapPoints, 10, node.id);

    if (snapResult.horizontalSnap || snapResult.verticalSnap) {
      if (snapResult.verticalSnap) {
        const snappedScreenX =
          transform.x + snapResult.verticalSnap.position * transform.scale;

        switch (snapResult.verticalSnap.type) {
          case "left":
            finalLeft = snappedScreenX + offsetX * transform.scale;
            break;
          case "right":
            finalLeft =
              snappedScreenX -
              width * transform.scale +
              offsetX * transform.scale;
            break;
          case "centerX":
            finalLeft =
              snappedScreenX -
              (width / 2) * transform.scale +
              offsetX * transform.scale;
            break;
        }
      }

      if (snapResult.horizontalSnap) {
        const snappedScreenY =
          transform.y + snapResult.horizontalSnap.position * transform.scale;

        switch (snapResult.horizontalSnap.type) {
          case "top":
            finalTop = snappedScreenY + offsetY * transform.scale;
            break;
          case "bottom":
            finalTop =
              snappedScreenY -
              height * transform.scale +
              offsetY * transform.scale;
            break;
          case "centerY":
            finalTop =
              snappedScreenY -
              (height / 2) * transform.scale +
              offsetY * transform.scale;
            break;
        }
      }
    }
  }

  useEffect(() => {
    if (
      JSON.stringify(snapResult) !== JSON.stringify(lastSnapGuideRef.current)
    ) {
      lastSnapGuideRef.current = snapResult;
      if (snapResult?.snapGuides?.length) {
        dragDisp.setSnapGuides(snapResult.snapGuides);
      } else {
        dragDisp.clearSnapGuides();
      }
    }
  }, [snapResult, dragDisp]);

  // Only try to update the actual element immediately when mounting
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
  }, [node.id]);

  return createPortal(
    <div
      data-node-dragged={node.id}
      style={{
        position: "fixed",
        left: `${finalLeft}px`,
        top: `${finalTop}px`,
        transform: `scale(${transform.scale})`,
        transformOrigin: "top left",
        pointerEvents: "none",
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 9999,
      }}
    >
      {cloneElement(content, {
        "data-node-id": undefined,
        style: {
          position: "fixed",
          rotate: node.style.rotate,
          transformOrigin: "top left",
          pointerEvents: "none",
          left: undefined,
          top: undefined,
          width: `${width}px`,
          height: `${height}px`,
          background: isAdditionalDraggedNode
            ? "rgba(255,0,0,0.2)"
            : "rgba(0,0,255,0.2)",
          border: "1px solid blue",
        },
      })}
    </div>,
    document.body
  );
};

export default DraggedNode;
