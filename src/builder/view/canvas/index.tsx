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
import { StyleUpdateHelper } from "@/builder/context/dnd/StyleUpdateHelper";
import { ArrowConnectors } from "./ArrowConnectors";

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

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#1D1D1D]">
      <ViewportDevTools />
      <Toolbar />
      <ToolbarDragPreview />

      <div ref={containerRef} className="w-full h-full canvas relative">
        <SnapGuides />
        <StyleUpdateHelper />
        <ArrowConnectors />

        <div ref={contentRef} className="relative">
          {dragState.dynamicModeNodeId ? (
            <RenderNodes filter="dynamicMode" />
          ) : (
            <RenderNodes filter="outOfViewport" />
          )}

          <LineIndicator />
        </div>
      </div>
      <RightToolbar />
    </div>
  );
};

export default Canvas;
