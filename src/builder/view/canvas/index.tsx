import React, { useEffect } from "react";
import Toolbar from "../toolbar";
import { RenderNodes } from "../../registry/renderNodes";
import { useBuilder } from "@/builder/context/builderState";
import { ViewportDevTools } from "./ViewportDevTools";
import RightToolbar from "../toolbar/rightToolbar";
import { useMouseMove } from "@/builder/context/dnd/useMouseMove";
import { useMouseUp } from "@/builder/context/dnd/useMouseUp";
import { LineIndicator } from "@/builder/context/dnd/LineIndicator";
import SnapGuides from "@/builder/context/dnd/SnapGuides";
import { ToolbarDragPreview } from "@/builder/context/dnd/toolbarDragPreview";
import { StyleUpdateHelper } from "@/builder/context/dnd/StyleUpdateHelper";
import { ArrowConnectors } from "./ArrowConnectors";
import { ContextMenu } from "@/builder/context/dnd/ContextMenu";

const Canvas = () => {
  const { containerRef, contentRef, dragState, isMovingCanvas, dragDisp } =
    useBuilder();
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

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === contentRef.current) {
      dragDisp.clearSelection();
    }
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[var(--bg-canvas)]">
      <ViewportDevTools />
      <Toolbar />
      <ToolbarDragPreview />

      <div
        ref={containerRef}
        style={{
          willChange: "transform",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          isolation: "isolate",
        }}
        className="w-full h-full canvas relative"
        onClick={handleCanvasClick}
      >
        <SnapGuides />
        <StyleUpdateHelper />
        {/* <DragLayer /> */}
        {!isMovingCanvas && <ArrowConnectors />}

        <div
          ref={contentRef}
          className="relative"
          style={{
            isolation: "isolate",
          }}
        >
          {dragState.dynamicModeNodeId ? (
            <RenderNodes filter="dynamicMode" />
          ) : (
            <RenderNodes filter="outOfViewport" />
          )}

          <LineIndicator />
          <ContextMenu />
        </div>
      </div>
      <RightToolbar />
    </div>
  );
};

export default Canvas;
