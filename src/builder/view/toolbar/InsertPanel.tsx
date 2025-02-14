import React from "react";
import { elementRegistry } from "../../registry";
import { useDragStart } from "@/builder/context/dnd/useDragStart";

const InsertPanel = () => {
  const handleDragStart = useDragStart();

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-4">
        {elementRegistry.map((element, index) => (
          <div
            key={index}
            className="element-box"
            onMouseDown={(e) => handleDragStart(e, element.type)}
            draggable={false}
          >
            {element.type}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InsertPanel;
