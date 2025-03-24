import React, { useEffect, useState, useRef } from "react";
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
import { DynamicToolbar } from "../toolbars/dynamicToolbar";
import ConnectionTypeModal from "@/builder/context/canvasHelpers/ConnectionTypeModal";
import IframePreview from "../preview/iframePreview";
import AddViewportModal from "@/builder/context/canvasHelpers/AddViewportModal";
import EditViewportModal from "@/builder/context/canvasHelpers/EditViewportModal";
import ViewportContextMenu from "@/builder/context/canvasHelpers/ViewportContextMenu";
import AddVariantsUI from "@/builder/context/canvasHelpers/AddVariantUI";

const Canvas = () => {
  const [isLoading, setIsLoading] = useState(true);
  const eventHandlersAttached = useRef(false);

  const {
    containerRef,
    contentRef,
    dragState,
    isMovingCanvas,
    setIsMovingCanvas,
    dragDisp,
    nodeDisp,
    transform,
    setTransform,
    interfaceDisp,
    isResizing,
    isRotating,
    isAdjustingGap,
    isAdjustingBorderRadius,
    nodeState,
    interfaceState,
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
    if (
      document.activeElement?.tagName === "INPUT" ||
      document.activeElement?.tagName === "TEXTAREA" ||
      document.activeElement?.isContentEditable
    ) {
      return;
    }
  });

  // Function to attach event listeners
  const attachEventListeners = () => {
    if (!eventHandlersAttached.current) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      eventHandlersAttached.current = true;
    }
  };

  // Function to detach event listeners
  const detachEventListeners = () => {
    if (eventHandlersAttached.current) {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      eventHandlersAttached.current = false;
    }
  };

  // Attach event listeners when not in preview mode
  useEffect(() => {
    if (!interfaceState.isPreviewOpen) {
      attachEventListeners();
    } else {
      detachEventListeners();
    }

    return () => {
      detachEventListeners();
    };
  }, [
    interfaceState.isPreviewOpen,
    handleMouseMove,
    handleMouseUp,
    attachEventListeners,
    detachEventListeners,
  ]);

  // Reset any necessary state when switching back from preview mode
  useEffect(() => {
    if (!interfaceState.isPreviewOpen && eventHandlersAttached.current) {
      // Reset any necessary state when returning from preview mode
      setIsMovingCanvas(false);

      // Force a redraw of the canvas by triggering a window resize event
      window.dispatchEvent(new Event("resize"));
    }
  }, [interfaceState.isPreviewOpen, setIsMovingCanvas]);

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

  // Update transform when switching from preview back to editor
  useEffect(() => {
    if (!interfaceState.isPreviewOpen && contentRef.current) {
      // Ensure the transform is applied to the content
      contentRef.current.style.willChange = "transform";
      contentRef.current.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`;
      contentRef.current.style.transformOrigin = "0 0";
    }
  }, [interfaceState.isPreviewOpen, transform, contentRef]);

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
      <div
        className={`fixed inset-0 pt-12 flex overflow-hidden bg-[var(--bg-canvas)] ${
          interfaceState.isPreviewOpen && ""
        }`}
      >
        {interfaceState.isPreviewOpen ? (
          <IframePreview nodes={nodeState.nodes} viewport={1440} />
        ) : (
          <>
            <ViewportDevTools />
            <InterfaceToolbar />
            <LeftMenu />
            <ToolbarDragPreview />
            <DynamicToolbar />
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
                  willChange: "transform",
                  transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
                  transformOrigin: "0 0",
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
            <ConnectionTypeModal />
            <AddViewportModal />
            <EditViewportModal />
            <ViewportContextMenu />
          </>
        )}
      </div>
    </>
  );
};

export default Canvas;
