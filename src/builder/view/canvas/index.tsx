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
import { selectOps } from "@/builder/context/atoms/select-store";
import {
  useIsPreviewOpen,
  interfaceOps,
} from "@/builder/context/atoms/interface-store";
import { useIsDragging } from "@/builder/context/atoms/drag-store";
import { contextMenuOps } from "@/builder/context/atoms/context-menu-store";
import {
  canvasOps,
  useGetIsSelectionBoxActive,
  useIsEditingText,
  useIsMovingCanvas,
  useTransform,
} from "@/builder/context/atoms/canvas-interaction-store";
import { useDynamicModeNodeId } from "@/builder/context/atoms/dynamic-store";

const Canvas = () => {
  const [isLoading, setIsLoading] = useState(true);
  const eventHandlersAttached = useRef(false);

  const { containerRef, contentRef, nodeDisp, nodeState } = useBuilder();

  // Get isPreviewOpen from interface store instead of interfaceState
  const isPreviewOpen = useIsPreviewOpen();

  const transform = useTransform();

  const isMovingCanvas = useIsMovingCanvas();

  const isEditingText = useIsEditingText();

  const getIsSelectionBoxActive = useGetIsSelectionBoxActive();

  const { clearSelection } = selectOps;

  // useMoveCanvas();

  // With this approach:
  useKeyboardDrag({ isEnabled: !isEditingText });

  const handleMouseMove = useMouseMove();
  const handleMouseUp = useMouseUp();

  // Use our extracted image drop hook
  const { handleDragOver, handleDrop } = useImageDrop({
    containerRef,
    transform,
    nodeDisp,
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
    if (!isPreviewOpen) {
      attachEventListeners();
    } else {
      detachEventListeners();
    }

    return () => {
      detachEventListeners();
    };
  }, [isPreviewOpen, handleMouseMove, handleMouseUp]);

  // Reset any necessary state when switching back from preview mode
  useEffect(() => {
    if (!isPreviewOpen && eventHandlersAttached.current) {
      // Reset any necessary state when returning from preview mode
      canvasOps.setIsMovingCanvas(false);

      // Force a redraw of the canvas by triggering a window resize event
      window.dispatchEvent(new Event("resize"));
    }
  }, [isPreviewOpen, canvasOps.setIsMovingCanvas]);

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
    if (!isPreviewOpen && contentRef.current) {
      // Ensure the transform is applied to the content
      contentRef.current.style.willChange = "transform";
      contentRef.current.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`;
      contentRef.current.style.transformOrigin = "0 0";
    }
  }, [isPreviewOpen, transform, contentRef]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    const isSelectionBoxActive = getIsSelectionBoxActive();

    if (isSelectionBoxActive) {
      return;
    }

    if (e.target === containerRef.current || e.target === contentRef.current) {
      console.log("clicked on canvas");
      clearSelection();
      interfaceOps.toggleLayers();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    // Only show context menu if clicking directly on canvas or content
    if (e.target === containerRef.current || e.target === contentRef.current) {
      contextMenuOps.setContextMenu(e.clientX, e.clientY, null);
    }
  };

  const dynamicModeNodeId = useDynamicModeNodeId();

  return (
    <>
      <LoadingScreen isLoading={isLoading} />

      <Header />
      <div
        className={`fixed inset-0 pt-12 flex overflow-hidden bg-[var(--bg-canvas)] ${
          isPreviewOpen && ""
        }`}
      >
        {isPreviewOpen ? (
          <IframePreview nodes={nodeState.nodes} viewport={1440} />
        ) : (
          // <PreviewPlay nodes={nodeState.nodes} />
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
              <SelectionBox />
              <FrameCreator />
              <TextCreator />
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
                {dynamicModeNodeId ? (
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
