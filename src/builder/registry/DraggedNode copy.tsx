import React, { ReactElement, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Node } from "../reducer/nodeDispatcher";
import { useBuilder } from "../context/builderState";

interface Transform {
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
  content: ReactElement<
    ContentProps,
    string | React.JSXElementConstructor<string>
  >;
  virtualReference: VirtualReference | null;
  transform: Transform;
  offset: Offset;
}

const parseRotation = (rotate: string | null): number => {
  if (typeof rotate === "string" && rotate.endsWith("deg")) {
    return parseFloat(rotate);
  }
  return 0;
};

const DraggedNode: React.FC<DraggedNodeProps> = ({
  node,
  content,
  virtualReference,
  transform,
  offset,
}) => {
  const { dragState } = useBuilder();

  console.log("DRAAAG", dragState.dragPositions);

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
  const finalLeft = rawLeft + offsetX * transform.scale;
  const finalTop = rawTop + offsetY * transform.scale;

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
