import React, { useEffect } from "react";
import Toolbar from "../toolbar";
import { RenderNodes } from "../../registry/renderNodes";
import { useBuilder } from "@/builder/context/builderState";
import { ViewportDevTools } from "./ViewportDevTools";
import RightToolbar from "../toolbar/rightToolbar";
import { useMouseMove } from "@/builder/context/dnd/useMouseMove";
import { useMouseUp } from "@/builder/context/dnd/useMouseUp";
import { LineIndicator } from "@/builder/context/dnd/LineIndicator";
import { SnapGuides } from "@/builder/context/dnd/SnapGuides";
import { ToolbarDragPreview } from "@/builder/context/dnd/toolbarDragPreview";

const Canvas = () => {
  const { containerRef, contentRef, dragState } = useBuilder();
  const handleMouseMove = useMouseMove();
  const handleMouseUp = useMouseUp();

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (dragState.isDragging) {
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
  }, [dragState.isDragging]);

  const viewports = [
    { width: 1440, class: "w-[1440px]" },
    { width: 768, class: "w-[768px]" },
    { width: 375, class: "w-[375px]" },
  ];

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#1D1D1D]">
      <ViewportDevTools />
      <Toolbar />
      <ToolbarDragPreview />

      <div ref={containerRef} className="w-full h-full canvas relative">
        <SnapGuides />

        <div ref={contentRef} className="relative">
          <RenderNodes filter="outOfViewport" />

          <div className="flex gap-8 p-10">
            {viewports.map(({ width, class: widthClass }) => (
              <div
                key={width}
                data-viewport={width}
                className={`${widthClass} viewport flex-shrink-0 h-[1000px] bg-white border border-gray-200 
                            items-center justify-center shadow-lg rounded-lg`}
              >
                <RenderNodes filter="inViewport" />
                <LineIndicator
                  show={dragState.lineIndicator.show}
                  x={dragState.lineIndicator.x}
                  y={dragState.lineIndicator.y}
                  width={dragState.lineIndicator.width}
                  height={dragState.lineIndicator.height}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <RightToolbar />
    </div>
  );
};

export default Canvas;
