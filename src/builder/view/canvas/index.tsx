// Canvas.tsx
import React, { useEffect, useCallback } from "react";
import { nanoid } from "nanoid";
import Toolbar from "../toolbar";
import { RenderNodes } from "../../registry/renderNodes";
import { useBuilder } from "@/builder/context/builderState";
import { ViewportDevTools } from "../../dev/ViewportDevTools";
import RightToolbar from "../toolbar/rightToolbar";
import { useMouseMove } from "@/builder/context/dnd/useMouseMove";
import { useMouseUp } from "@/builder/context/dnd/useMouseUp";
import { LineIndicator } from "@/builder/context/canvasHelpers/LineIndicator";
import SnapGuides from "@/builder/context/canvasHelpers/SnapGuides";
import { ToolbarDragPreview } from "@/builder/context/canvasHelpers/toolbarDragPreview";
import { StyleUpdateHelper } from "@/builder/context/canvasHelpers/StyleUpdateHelper";
import { ArrowConnectors } from "./ArrowConnectors";
import { ContextMenu } from "@/builder/context/dnd/ContextMenu";
import { getFilteredNodes } from "@/builder/context/utils";
import ViewportBar from "./bar";
import Header from "./Header";
import SelectionBox from "@/builder/context/canvasHelpers/SelectionBox";
import { useKeyboardDrag } from "@/builder/context/hooks/useKeyboardDrag";
import DebugSnapGrid from "@/builder/context/dnd/DebugSnapGrid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import FrameCreator from "@/builder/context/canvasHelpers/FrameCreator";

const Canvas = () => {
  const {
    containerRef,
    contentRef,
    dragState,
    isMovingCanvas,
    dragDisp,
    nodeState,
    nodeDisp,
    transform,
    isFrameModeActive,
    interfaceDisp,
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

    interfaceDisp.toggleLayers();

    if (e.target === containerRef.current || e.target === contentRef.current) {
      dragDisp.clearSelection();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    // Only show context menu if clicking directly on canvas or content
    if (e.target === containerRef.current || e.target === contentRef.current) {
      dragDisp.setContextMenu(e.clientX, e.clientY, null);
    }
  };

  // Image drop handling
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const createImageNode = useCallback(
    (
      imageSrc: string,
      clientX: number,
      clientY: number,
      naturalWidth?: number,
      naturalHeight?: number
    ) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Convert screen coordinates to canvas coordinates
      const canvasX = (clientX - rect.left - transform.x) / transform.scale;
      const canvasY = (clientY - rect.top - transform.y) / transform.scale;

      // Calculate dimensions while maintaining aspect ratio if we have natural dimensions
      let width = 200;
      let height = 200;
      if (naturalWidth && naturalHeight) {
        const aspectRatio = naturalWidth / naturalHeight;
        if (aspectRatio > 1) {
          height = width / aspectRatio;
        } else {
          width = height * aspectRatio;
        }
      }

      const newNode: Node = {
        id: nanoid(),
        type: "image",
        style: {
          position: "absolute",
          left: `${canvasX}px`,
          top: `${canvasY}px`,
          width: `${width}px`,
          height: `${height}px`,
          objectFit: "cover",
          src: imageSrc,
        },
        inViewport: false,
      };

      nodeDisp.addNode(newNode, null, null, false);
      dragDisp.setSelectedIds([newNode.id]);
    },
    [containerRef, transform, nodeDisp, dragDisp]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        // Handle dropped files (e.g., from desktop)
        if (e.dataTransfer.files.length > 0) {
          const files = Array.from(e.dataTransfer.files).filter((file) =>
            file.type.startsWith("image/")
          );

          if (files.length === 0) {
            alert("Please drop image files only");
            return;
          }

          // Process each image file
          files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (reader.result) {
                // Create a temporary image to get dimensions
                const img = new Image();
                img.onload = () => {
                  createImageNode(
                    reader.result as string,
                    e.clientX + index * 20, // Offset multiple images
                    e.clientY + index * 20,
                    img.naturalWidth,
                    img.naturalHeight
                  );
                };
                img.src = reader.result as string;
              }
            };
            reader.onerror = () => {
              alert(`Failed to load image: ${file.name}`);
            };
            reader.readAsDataURL(file);
          });
          return;
        }

        // Handle dropped images (e.g., from browser)
        const imageUrl =
          e.dataTransfer.getData("text/uri-list") ||
          e.dataTransfer.getData("text/plain");

        if (
          imageUrl &&
          (imageUrl.startsWith("http") || imageUrl.startsWith("data:"))
        ) {
          // Create a temporary image to get dimensions
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            createImageNode(
              imageUrl,
              e.clientX,
              e.clientY,
              img.naturalWidth,
              img.naturalHeight
            );
          };
          img.onerror = () => {
            alert("Failed to load image from URL");
          };
          img.src = imageUrl;
        }
      } catch (error) {
        alert("Error processing dropped image");
        console.error("Drop error:", error);
      }
    },
    [createImageNode]
  );

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
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onContextMenu={handleContextMenu}
        >
          <SnapGuides />
          {/* <DebugSnapGrid /> */}
          <StyleUpdateHelper />
          {!isFrameModeActive && !dragState.isDragging && <SelectionBox />}
          <FrameCreator />
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
