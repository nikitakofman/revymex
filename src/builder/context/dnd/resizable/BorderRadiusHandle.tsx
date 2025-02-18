import React, { useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";

export const BorderRadiusHandle: React.FC<{
  node: Node;
  elementRef: React.RefObject<HTMLDivElement>;
}> = ({ node, elementRef }) => {
  const { setNodeStyle, transform, dragDisp, startRecording, stopRecording } =
    useBuilder();

  const startPosRef = useRef<number>(0);
  const startRadiusRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!elementRef.current) return;

    const sessionId = startRecording();

    // Get current radius in pixels
    let currentRadius = 0;
    if (node.style.borderRadius) {
      const match = node.style.borderRadius.toString().match(/(\d+)/);
      if (match) {
        currentRadius = parseInt(match[1]);
      }
    }

    startRadiusRef.current = currentRadius;
    startPosRef.current = e.clientY;

    dragDisp.updateStyleHelper({
      type: "radius",
      position: { x: e.clientX, y: e.clientY },
      value: currentRadius,
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (!elementRef.current) return;

      const deltaY = (e.clientY - startPosRef.current) / transform.scale;
      let newRadius = Math.max(0, startRadiusRef.current + deltaY);

      if (e.shiftKey) {
        newRadius = Math.round(newRadius / 32) * 32;
      }

      dragDisp.updateStyleHelper({
        type: "radius",
        position: { x: e.clientX, y: e.clientY },
        value: newRadius,
      });

      if (newRadius === 0) {
        setNodeStyle({ borderRadius: undefined }, undefined, true);
      } else {
        setNodeStyle(
          { borderRadius: `${Math.round(newRadius)}px` },
          undefined,
          true
        );
      }
    };

    const handleMouseUp = () => {
      dragDisp.hideStyleHelper();
      stopRecording(sessionId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleSize = 8 / transform.scale;
  const borderWidth = 1 / transform.scale;
  const offset = 12 / transform.scale;

  if (transform.scale < 0.25) return;

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: `${offset}px`,
        top: `${offset}px`,
        width: `${handleSize}px`,
        height: `${handleSize}px`,
        borderRadius: "50%",
        backgroundColor:
          node.isDynamic || node.dynamicParentId
            ? "var(--accent-secondary)"
            : "var(--accent)",
        border: `${borderWidth}px solid white`,
        cursor: "ns-resize",
        zIndex: 1001,
        pointerEvents: "auto",
      }}
    />
  );
};
