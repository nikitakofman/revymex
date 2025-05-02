// Modified Canvas.tsx
import React, { useEffect, useState, useRef } from "react";
import InterfaceToolbar from "../toolbars/leftToolbar";
import { RenderNodes } from "../../registry/renderNodes";
import {
  useBuilder,
  useBuilderDynamic,
  useBuilderRefs,
} from "@/builder/context/builderState";
import { ViewportDevTools } from "../../dev/ViewportDevTools";
import ElementToolbar from "../toolbars/rightToolbar";
import { LineIndicator } from "@/builder/context/canvasHelpers/LineIndicator";
import SnapGuides from "@/builder/context/canvasHelpers/SnapGuides";
import { ToolbarDragPreview } from "@/builder/context/canvasHelpers/toolbarDragPreview";
import { StyleUpdateHelper } from "@/builder/context/canvasHelpers/StyleUpdateHelper";
import { ArrowConnectors } from "../../context/canvasHelpers/ArrowConnectors";
import { ContextMenu } from "@/builder/context/canvasHelpers/ContextMenu";
import Header from "../header";
import SelectionBox from "@/builder/context/canvasHelpers/SelectionBox";
import FrameCreator from "../toolbars/bottomToolbar/FrameCreator";
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
import MouseHandlers from "@/builder/context/dnd/MouseHandlers";
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
import {
  childrenMapAtom,
  hierarchyStore,
  parentMapAtom,
} from "@/builder/context/atoms/node-store/hierarchy-store";

const Canvas = () => {
  const [isLoading, setIsLoading] = useState(true);
  const hasInitializedAtoms = useRef(false);

  const { nodeState } = useBuilderDynamic();
  const { containerRef, contentRef } = useBuilderRefs();

  // Get isPreviewOpen from interface store instead of interfaceState
  const isPreviewOpen = useIsPreviewOpen();

  const getIsSelectionBoxActive = useGetIsSelectionBoxActive();

  const { clearSelection } = selectOps;

  console.log(`Canvas re rendering`, new Date().getTime());

  // Initialize Jotai atoms with the initial node state on first render
  useEffect(() => {
    if (!hasInitializedAtoms.current) {
      console.log("------- INITIALIZATION STARTS -------");
      console.log(
        "Initializing Jotai node state from initial state",
        nodeInitialState
      );

      // Log the nodes with their parent-child relationships
      const parentChildMap = {};
      nodeInitialState.nodes.forEach((node) => {
        if (!parentChildMap[node.parentId || "root"]) {
          parentChildMap[node.parentId || "root"] = [];
        }
        parentChildMap[node.parentId || "root"].push(node.id);
      });
      console.log(
        "Parent-child relationships in initial state:",
        parentChildMap
      );

      // Call the initialize function
      initNodeStateFromInitialState(nodeInitialState);

      console.log(
        `Initialized ${nodeInitialState.nodes.length} nodes in Jotai store`
      );

      // Check initialization was successful by reading the store
      const nodeIds = nodeStore.get(nodeIdsAtom);
      console.log(`Verified nodeIds in store: ${nodeIds.length} nodes`);

      // Check the hierarchy store
      try {
        // Log children map
        const childrenMap = hierarchyStore.get(childrenMapAtom);
        console.log("Children map from hierarchy store:", childrenMap);

        // Log parent map
        const parentMap = hierarchyStore.get(parentMapAtom);
        console.log("Parent map from hierarchy store:", parentMap);

        // Log root nodes
        const rootNodeIds = childrenMap.get(null) || [];
        console.log("Root nodes:", rootNodeIds);

        // Check viewport children
        console.log(
          "Viewport-1440 children:",
          childrenMap.get("viewport-1440") || []
        );
        console.log(
          "Viewport-768 children:",
          childrenMap.get("viewport-768") || []
        );
        console.log(
          "Viewport-375 children:",
          childrenMap.get("viewport-375") || []
        );
      } catch (error) {
        console.error("Error checking hierarchy store:", error);
      }

      console.log("------- INITIALIZATION COMPLETE -------");

      // Mark as initialized so we don't do it again
      hasInitializedAtoms.current = true;
    }
  }, []);

  // Reset any necessary state when switching back from preview mode
  useEffect(() => {
    if (!isPreviewOpen) {
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

      {/* Add MouseHandlers component */}
      <MouseHandlers />

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
