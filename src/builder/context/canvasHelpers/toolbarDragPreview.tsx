import React, { useEffect, useState } from "react";
import { useBuilder } from "@/builder/context/builderState";

export const ToolbarDragPreview = () => {
  const { dragState } = useBuilder();
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    if (dragState.isDragging && dragState.dragSource === "toolbar") {
      window.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [dragState.isDragging, dragState.dragSource]);

  if (!dragState.isDragging || dragState.dragSource !== "toolbar") {
    return null;
  }

  const previewStyle: React.CSSProperties = {
    width: 75,
    height: 75,
    pointerEvents: "none",
    position: "fixed",
    top: position.y,
    left: position.x,
    transform: "translate(-50%, -50%)",
    zIndex: 9999,
  };

  switch (dragState.draggedItem) {
    case "frame":
      previewStyle.backgroundColor = "rgba(128, 128, 128, 0.7)";
      break;
    case "image":
      previewStyle.backgroundColor = "rgba(0, 128, 255, 0.7)";
      break;
    case "text":
      previewStyle.backgroundColor = "rgba(255, 200, 0, 0.7)";
      break;
    default:
      break;
  }

  return (
    <div className="element-box" style={previewStyle}>
      {dragState.draggedItem}
    </div>
  );
};
