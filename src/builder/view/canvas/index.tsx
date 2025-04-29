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
import LoadingScreen from "./loading-screen";
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
import { contextMenuOps } from "@/builder/context/atoms/context-menu-store";
import {
  canvasOps,
  useGetIsSelectionBoxActive,
  useIsEditingText,
} from "@/builder/context/atoms/canvas-interaction-store";
import { useDynamicModeNodeId } from "@/builder/context/atoms/dynamic-store";
import CanvasController from "@/builder/context/canvas-controller";
import {
  initNodeStateFromInitialState,
  nodeStore,
  nodeIdsAtom,
} from "@/builder/context/atoms/node-store";
import { nodeInitialState } from "@/builder/reducer/state";

const Canvas = () => {
  const [isLoading, setIsLoading] = useState(true);
  const eventHandlersAttached = useRef(false);
  const hasInitializedAtoms = useRef(false);

  const { containerRef, contentRef, nodeState } = useBuilder();

  // Get isPreviewOpen from interface store instead of interfaceState
  const isPreviewOpen = useIsPreviewOpen();

  const getIsSelectionBoxActive = useGetIsSelectionBoxActive();

  const { clearSelection } = selectOps;

  console.log(`Canvas re rendering`, new Date().getTime());

  // Initialize Jotai atoms with the initial node state on first render
  useEffect(() => {
    if (!hasInitializedAtoms.current) {
      console.log("Initializing Jotai node state from initial state");
      initNodeStateFromInitialState(nodeInitialState);
      console.log(
        `Initialized ${nodeInitialState.nodes.length} nodes in Jotai store`
      );

      // Check initialization was successful by reading the store
      const nodeIds = nodeStore.get(nodeIdsAtom);
      console.log(`Verified nodeIds in store: ${nodeIds.length} nodes`);

      // Mark as initialized so we don't do it again
      hasInitializedAtoms.current = true;
    }
  }, []);

  // With this approach:
  const handleMouseMove = useMouseMove();
  const handleMouseUp = useMouseUp();

  // Use our extracted image drop hook
  const { handleDragOver, handleDrop } = useImageDrop({
    containerRef,
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
  }, [isPreviewOpen]);

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
              <CanvasController
                containerRef={containerRef}
                contentRef={contentRef}
              />

              <SnapGuides />
              <StyleUpdateHelper />
              <SelectionBox />
              <FrameCreator />
              <TextCreator />
              <ArrowConnectors />
              <div
                ref={contentRef}
                className="relative"
                style={{
                  isolation: "isolate",
                  willChange: "transform",
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
