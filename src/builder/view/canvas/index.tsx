// Canvas.tsx
import React, { useEffect, useState } from "react";
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
import Header from "../header";
import SelectionBox from "@/builder/context/canvasHelpers/SelectionBox";
import { useKeyboardDrag } from "@/builder/context/hooks/useKeyboardDrag";
import FrameCreator from "../toolbars/bottomToolbar/FrameCreator";
import { useImageDrop } from "@/builder/context/hooks/useImageDrop";
import LeftMenu from "../toolbars/leftToolbar/leftMenu";
import TextCreator from "../toolbars/bottomToolbar/TextCreator";
import "react-tooltip/dist/react-tooltip.css";
import BottomToolbar from "../toolbars/bottomToolbar";
import { useCursorManager } from "../../context/hooks/useCursorManager";
import LoadingScreen from "./loading-screen";
import { useMoveCanvas } from "@/builder/context/hooks/useMoveCanvas";

const Canvas = () => {
  const [isLoading, setIsLoading] = useState(true);

  const {
    containerRef,
    contentRef,
    dragState,
    isMovingCanvas,
    dragDisp,
    nodeDisp,
    transform,
    interfaceDisp,
    isResizing,
    isRotating,
    isAdjustingGap,
    isAdjustingBorderRadius,
  } = useBuilder();

  // Use the cursor manager hook
  const { isDrawingMode, isMoveMode } = useCursorManager();

  useMoveCanvas();
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

  // Loading state detection based on critical refs and a minimum time
  useEffect(() => {
    // Minimum loading time for UX purposes
    const minLoadTime = 800;
    const minLoadTimer = setTimeout(() => {
      setIsLoading(false);
    }, minLoadTime);

    // Set up a reference to track when critical components have mounted
    if (containerRef.current && contentRef.current) {
      // Critical refs exist, we can consider the app "loaded"
      // But still respect the minimum load time
      const appLoadedTimer = setTimeout(() => {
        clearTimeout(minLoadTimer);
        setIsLoading(false);
      }, 100); // Small buffer to ensure rendering is complete

      return () => {
        clearTimeout(appLoadedTimer);
        clearTimeout(minLoadTimer);
      };
    }

    return () => {
      clearTimeout(minLoadTimer);
    };
  }, [containerRef.current, contentRef.current]);

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

  const isAnyResize =
    !isResizing && !isAdjustingGap && !isRotating && !isAdjustingBorderRadius;

  return (
    <>
      <LoadingScreen isLoading={isLoading} />

      <Header />
      <div className="fixed inset-0 pt-12 flex overflow-hidden bg-[var(--bg-canvas)]">
        <ViewportDevTools />
        <InterfaceToolbar />
        <LeftMenu />
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
          {!isDrawingMode && !isMoveMode && !dragState.isDragging && (
            <SelectionBox />
          )}
          {isAnyResize && <FrameCreator />}
          {isAnyResize && <TextCreator />}
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
