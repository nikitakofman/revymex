import React, { useEffect, useState } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { createPortal } from "react-dom";

export const DragLayer = () => {
  const { dragState, transform } = useBuilder();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  if (!dragState.isDragging || !dragState.draggedNode) return null;

  const { node, offset } = dragState.draggedNode;

  // Calculate position using the saved offset
  const x = mousePos.x - offset.mouseX * transform.scale;
  const y = mousePos.y - offset.mouseY * transform.scale;

  const style: React.CSSProperties = {
    ...node.style,
    position: "fixed",
    left: `${x}px`,
    top: `${y}px`,
    transform: `scale(${transform.scale})`,
    transformOrigin: "top left",
    zIndex: 1000,
    pointerEvents: "none",
  };

  console.log("Offset:", offset);
  console.log("Mouse position:", mousePos);
  console.log("Calculated position:", { x, y });

  return createPortal(
    <div data-node-id={node.id} style={style}>
      {node.type}
    </div>,
    document.body
  );
};
