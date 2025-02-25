// Canvas.tsx
import React, { useEffect } from "react";
import InterfaceToolbar from "../toolbars/leftToolbar";
import { RenderNodes } from "../../registry/renderNodes";
import { useBuilder } from "@/builder/context/builderState";
import { ViewportDevTools } from "../../dev/ViewportDevTools";
import ElementToolbar from "../toolbars/rightToolbar";
import { useMouseMove } from "@/builder/context/dnd/useMouseMove";
import { useMouseUp } from "@/builder/context/dnd/useMouseUp";
import { LineIndicator } from "@/builder/context/canvasHelpers/LineIndicator";
import SnapGuides from "@/builder/context/canvasHelpers/SnapGuides";
import { ToolbarDragPreview } from "@/builder/context/canvasHelpers/toolbarDragPreview";
import { StyleUpdateHelper } from "@/builder/context/canvasHelpers/StyleUpdateHelper";
import { ArrowConnectors } from "../../context/canvasHelpers/ArrowConnectors";
import { ContextMenu } from "@/builder/context/canvasHelpers/ContextMenu";
import ViewportBar from "../toolbars/bottomToolbar";
import Header from "../header";
import SelectionBox from "@/builder/context/canvasHelpers/SelectionBox";
import { useKeyboardDrag } from "@/builder/context/hooks/useKeyboardDrag";
import FrameCreator from "@/builder/context/canvasHelpers/FrameCreator";
import { useImageDrop } from "@/builder/context/hooks/useImageDrop";
import InterfaceMenu from "../toolbars/leftToolbar/interfaceMenu";
import TextCreator from "@/builder/context/canvasHelpers/TextCreator";
import "react-tooltip/dist/react-tooltip.css"; // Import this once, preferably in your main index.js file
import BottomToolbar from "../toolbars/bottomToolbar";

const Canvas = () => {
  const {
    containerRef,
    contentRef,
    dragState,
    isMovingCanvas,
    dragDisp,
    nodeDisp,
    transform,
    isFrameModeActive,
    isTextModeActive,
    interfaceDisp,
  } = useBuilder();

  useKeyboardDrag();

  const handleMouseMove = useMouseMove();
  const handleMouseUp = useMouseUp();

  // Use our extracted image drop hook
  const { handleDragOver, handleDrop } = useImageDrop({
    containerRef,
    transform,
    nodeDisp,
    dragDisp,
  });

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
      console.log("clicked on canvas");
      dragDisp.clearSelection();

      interfaceDisp.toggleLayers();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    // Only show context menu if clicking directly on canvas or content
    if (e.target === containerRef.current || e.target === contentRef.current) {
      dragDisp.setContextMenu(e.clientX, e.clientY, null);
    }
  };

  return (
    <>
      <Header />
      <div className="fixed inset-0 pt-12 flex overflow-hidden bg-[var(--bg-canvas)]">
        <ViewportDevTools />
        <InterfaceToolbar />
        <InterfaceMenu />
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
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onContextMenu={handleContextMenu}
        >
          <SnapGuides />
          {/* <DebugSnapGrid /> */}
          <StyleUpdateHelper />
          {!isFrameModeActive && !isTextModeActive && !dragState.isDragging && (
            <SelectionBox />
          )}
          <FrameCreator />
          <TextCreator />
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
        <BottomToolbar />
        <ElementToolbar />
      </div>
    </>
  );
};

export default Canvas;
