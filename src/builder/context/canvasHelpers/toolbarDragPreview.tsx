import React, { useEffect, useState } from "react";
import {
  useIsDragging,
  useDragSource,
  useDraggedItem,
} from "@/builder/context/atoms/drag-store";

export const ToolbarDragPreview = () => {
  // Use the subscription hooks since this is for rendering decisions
  const isDragging = useIsDragging();
  const dragSource = useDragSource();
  const draggedItem = useDraggedItem();

  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    if (isDragging && dragSource === "toolbar") {
      window.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isDragging, dragSource]);

  if (!isDragging || dragSource !== "toolbar") {
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

  switch (draggedItem) {
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
      {draggedItem}
    </div>
  );
};
