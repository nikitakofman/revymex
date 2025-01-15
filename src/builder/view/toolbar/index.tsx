import React from "react";
import { elementRegistry } from "../../registry";
import { useDragStart } from "@/builder/context/dnd/useDragStart";

const Toolbar = () => {
  const handleDragStart = useDragStart();

  return (
    <div className="w-64 fixed z-50 h-screen bg-[#111111] p-4">
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

export default Toolbar;
