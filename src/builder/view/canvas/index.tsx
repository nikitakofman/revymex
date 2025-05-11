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
import DragOverlay from "@/builder/context/dnd/DragOverlay";
import TextEditor from "@/builder/registry/elements/TextElement/TextEditor";
import SnapGuides from "@/builder/context/canvasHelpers/snapGrids/snapGuides";
const Canvas = () => {
  const [isLoading, setIsLoading] = useState(true);
  const hasInitializedAtoms = useRef(false);

  const { nodeState } = useBuilderDynamic();
  const { containerRef, contentRef } = useBuilderRefs();

  const isPreviewOpen = useIsPreviewOpen();

  const getIsSelectionBoxActive = useGetIsSelectionBoxActive();

  const { clearSelection } = selectOps;

  useEffect(() => {
    if (!hasInitializedAtoms.current) {
      const parentChildMap = {};
      nodeInitialState.nodes.forEach((node) => {
        if (!parentChildMap[node.parentId || "root"]) {
          parentChildMap[node.parentId || "root"] = [];
        }
        parentChildMap[node.parentId || "root"].push(node.id);
      });

      initNodeStateFromInitialState(nodeInitialState);

      const nodeIds = nodeStore.get(nodeIdsAtom);

      try {
      } catch (error) {
        console.error("Error checking hierarchy store:", error);
      }

      hasInitializedAtoms.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isPreviewOpen) {
      canvasOps.setIsMovingCanvas(false);

      window.dispatchEvent(new Event("resize"));
    }
  }, [isPreviewOpen]);

  useEffect(() => {
    const minLoadTime = 800;
    const minLoadTimer = setTimeout(() => {
      setIsLoading(false);
    }, minLoadTime);

    if (containerRef.current && contentRef.current) {
      const appLoadedTimer = setTimeout(() => {
        clearTimeout(minLoadTimer);
        setIsLoading(false);
      }, 100);

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
      clearSelection();
      interfaceOps.toggleLayers();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

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

              {/* Add this line temporarily for debugging */}
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
                <TextEditor />

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
            <DragOverlay />
          </>
        )}
      </div>
    </>
  );
};

export default Canvas;
