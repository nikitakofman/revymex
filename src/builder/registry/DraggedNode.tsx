import React, { ReactElement, CSSProperties, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Node } from "../reducer/nodeDispatcher";
import { useBuilder } from "../context/builderState";
import { useSnapGrid } from "../context/dnd/SnapGrid";
import { parseRotation } from "../context/dnd/utils";

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
  const snapGrid = useSnapGrid(nodeState.nodes);
  const lastSnapGuideRef = useRef<any>(null);

  const baseRect = virtualReference?.getBoundingClientRect() || {
    left: 0,
    top: 0,
  };

  const width = parseFloat(node.style.width as string) || 0;
  const height = parseFloat(node.style.height as string) || 0;
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

  const rawLeft = baseRect.left - offset.mouseX * transform.scale;
  const rawTop = baseRect.top - offset.mouseY * transform.scale;

  // Convert screen coordinates to canvas coordinates for snapping
  const canvasX = (rawLeft - transform.x) / transform.scale;
  const canvasY = (rawTop - transform.y) / transform.scale;

  // Calculate snap points
  const snapPoints = [
    { value: canvasX, type: "left" },
    { value: canvasX + width, type: "right" },
    { value: canvasX + width / 2, type: "centerX" },
    { value: canvasY, type: "top" },
    { value: canvasY + height, type: "bottom" },
    { value: canvasY + height / 2, type: "centerY" },
  ];

  let finalLeft = rawLeft + offsetX * transform.scale;
  let finalTop = rawTop + offsetY * transform.scale;
  let snapResult = null;

  if (snapGrid && dragState.isOverCanvas) {
    snapResult = snapGrid.findNearestSnaps(snapPoints, 5, node.id);

    if (snapResult.horizontalSnap || snapResult.verticalSnap) {
      if (snapResult.verticalSnap) {
        const snappedScreenX =
          transform.x + snapResult.verticalSnap.position * transform.scale;

        // Adjust based on which edge triggered the snap
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

        // Adjust based on which edge triggered the snap
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

  return createPortal(
    <div
      data-node-dragged
      style={{
        position: "fixed",
        left: `${finalLeft}px`,
        top: `${finalTop}px`,
        transform: `scale(${transform.scale})`,
        transformOrigin: "top left",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {React.cloneElement(content, {
        style: {
          ...content.props.style,
          position: "fixed",
          rotate: node.style.rotate,
          transformOrigin: "top left",
          pointerEvents: "none",
          left: undefined,
          top: undefined,
          width: width ? `${width}px` : undefined,
          height: height ? `${height}px` : undefined,
        },
      })}
    </div>,
    document.body
  );
};

export default DraggedNode;
