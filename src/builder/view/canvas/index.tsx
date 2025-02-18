// Canvas.tsx

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

// NEW: We import the shared filter
import { getFilteredNodes } from "@/builder/context/dnd/utils";
import ViewportBar from "./bar";
import Header from "./Header";
import SelectionBox from "@/builder/context/dnd/SelectionBox";
import { useKeyboardDrag } from "@/builder/context/hooks/useKeyboardDrag";

const Canvas = () => {
  const {
    containerRef,
    contentRef,
    dragState,
    isMovingCanvas,
    dragDisp,
    nodeState,
  } = useBuilder();

  useKeyboardDrag();

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
    if (dragState.isSelectionBoxActive) {
      return;
    }
    if (e.target === containerRef.current || e.target === contentRef.current) {
      dragDisp.clearSelection();
    }
  };

  // // Decide which filter to use
  // const activeFilter = dragState.dynamicModeNodeId
  //   ? "dynamicMode"
  //   : "outOfViewport";

  // // Now get the nodes that should actually be visible in this mode
  // const filteredNodes = getFilteredNodes(
  //   nodeState.nodes,
  //   activeFilter,
  //   dragState.dynamicModeNodeId
  // );

  return (
    <>
      <Header />
      <div className="fixed inset-0 pt-12 flex overflow-hidden bg-[var(--bg-canvas)]">
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
          <SelectionBox />
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
        <ViewportBar />
        <RightToolbar />
      </div>
    </>
  );
};

export default Canvas;
