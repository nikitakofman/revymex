import React, { useState, useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { computeFrameDropIndicator, findIndexWithinParent } from "../utils";

interface DrawingBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDrawing: boolean;
}

const preventSelectStyle = {
  userSelect: "none",
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
} as const;

export const FrameCreator: React.FC = () => {
  const { containerRef, nodeDisp, transform, nodeState } = useBuilder();
  const [box, setBox] = useState<DrawingBoxState | null>(null);
  const { isFrameModeActive, setIsFrameModeActive } = useBuilder();
  const targetFrameRef = useRef<{ id: string; element: Element } | null>(null);

  const handleMediaToFrameTransformation = (
    mediaNode: Node,
    droppedNode: Node,
    position: string
  ) => {
    if (position !== "inside") return false;

    const frameNode: Node = {
      ...mediaNode,
      type: "frame",
      style: {
        ...mediaNode.style,
        // Set the appropriate background property based on type
        ...(mediaNode.type === "video"
          ? {
              backgroundVideo: mediaNode.style.src,
            }
          : { backgroundImage: mediaNode.style.src }),
        src: undefined,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    };

    // First replace the media with a frame
    nodeDisp.replaceNode(mediaNode.id, frameNode);

    // Then add the dropped node as a child
    const childNode = {
      ...droppedNode,
      sharedId: nanoid(),
      style: {
        ...droppedNode.style,
        position: "relative",
        zIndex: "",
        transform: "",
        left: "",
        top: "",
      },
      parentId: frameNode.id,
      inViewport: frameNode.inViewport || false,
    };

    nodeDisp.addNode(
      childNode,
      frameNode.id,
      "inside",
      frameNode.inViewport || false
    );

    return true;
  };

  // Handle F key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f" && !e.repeat) {
        setIsFrameModeActive(true);
        document.body.style.cursor = "crosshair";
        Object.assign(document.body.style, preventSelectStyle);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") {
        setIsFrameModeActive(false);
        document.body.style.cursor = "default";
        document.body.style.userSelect = "";
        document.body.style.WebkitUserSelect = "";
        document.body.style.MozUserSelect = "";
        document.body.style.msUserSelect = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      // Cleanup styles if component unmounts while frame mode is active
      document.body.style.userSelect = "";
      document.body.style.WebkitUserSelect = "";
      document.body.style.MozUserSelect = "";
      document.body.style.msUserSelect = "";
    };
  }, []);

  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;

    const findTargetFrame = (e: MouseEvent) => {
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of elementsUnder) {
        const frameEl = el.closest('[data-node-type="frame"]');
        if (frameEl && !frameEl.closest(".viewport-header")) {
          const frameId = frameEl.getAttribute("data-node-id");
          if (frameId) {
            const node = nodeState.nodes.find((n) => n.id === frameId);
            if (node) {
              return { id: frameId, element: frameEl };
            }
          }
        }
      }
      return null;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!isFrameModeActive) return;

      const target = e.target as HTMLElement;
      targetFrameRef.current = findTargetFrame(e);

      const rect = canvas.getBoundingClientRect();
      setBox({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
        isDrawing: true,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!box?.isDrawing) return;

      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      setBox((prev) => ({
        ...prev!,
        currentX: newX,
        currentY: newY,
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!box?.isDrawing) return;

      const rect = canvas.getBoundingClientRect();
      const finalX = e.clientX - rect.left;
      const finalY = e.clientY - rect.top;

      // Calculate dimensions
      const left = Math.min(box.startX, finalX);
      const top = Math.min(box.startY, finalY);
      const width = Math.abs(finalX - box.startX);
      const height = Math.abs(finalY - box.startY);

      if (width > 5 && height > 5) {
        const canvasX = (left - transform.x) / transform.scale;
        const canvasY = (top - transform.y) / transform.scale;

        // Check if we're drawing over a media element
        const targetFrame = targetFrameRef.current;
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        let mediaElement = null;

        for (const el of elementsUnder) {
          const mediaEl = el.closest(
            '[data-node-type="image"], [data-node-type="video"]'
          );
          if (mediaEl) {
            const mediaId = mediaEl.getAttribute("data-node-id");
            if (mediaId) {
              const mediaNode = nodeState.nodes.find((n) => n.id === mediaId);
              if (mediaNode) {
                mediaElement = { node: mediaNode, element: mediaEl };
                break;
              }
            }
          }
        }

        if (mediaElement) {
          // We're drawing over a media element - transform it to a frame
          const newFrame: Node = {
            id: nanoid(),
            type: "frame",
            style: {
              position: "relative",
              width: `${width / transform.scale}px`,
              height: `${height / transform.scale}px`,
              backgroundColor: "#97cffc",
              flex: "0 0 auto",
            },
            inViewport: mediaElement.node.inViewport,
          };

          // Use the existing handleMediaToFrameTransformation
          const transformed = handleMediaToFrameTransformation(
            mediaElement.node,
            newFrame,
            "inside"
          );

          if (transformed) {
            nodeDisp.syncViewports();
          }
        } else if (targetFrame) {
          // Drawing over a frame - insert as child
          const frameChildren = nodeState.nodes
            .filter((n) => n.parentId === targetFrame.id)
            .map((node) => {
              const el = document.querySelector(`[data-node-id="${node.id}"]`);
              return el
                ? { id: node.id, rect: el.getBoundingClientRect() }
                : null;
            })
            .filter(
              (item): item is { id: string | number; rect: DOMRect } =>
                item !== null
            );

          const newFrame: Node = {
            id: nanoid(),
            type: "frame",
            style: {
              position: "relative",
              width: `${width / transform.scale}px`,
              height: `${height / transform.scale}px`,
              backgroundColor: "#97cffc",
              flex: "0 0 auto",
            },
            inViewport: true,
          };

          const dropIndicator = computeFrameDropIndicator(
            targetFrame.element,
            frameChildren,
            e.clientX,
            e.clientY
          );

          if (dropIndicator?.dropInfo) {
            nodeDisp.addNode(
              newFrame,
              dropIndicator.dropInfo.targetId,
              dropIndicator.dropInfo.position,
              true
            );
          } else {
            nodeDisp.addNode(newFrame, targetFrame.id, "inside", true);
          }
        } else {
          // Drawing on canvas - create absolute positioned frame
          const newFrame: Node = {
            id: nanoid(),
            type: "frame",
            style: {
              position: "absolute",
              left: `${canvasX}px`,
              top: `${canvasY}px`,
              width: `${width / transform.scale}px`,
              height: `${height / transform.scale}px`,
              backgroundColor: "#97cffc",
              borderRadius: "8px",
              flex: "0 0 auto",
            },
            inViewport: false,
          };

          nodeDisp.addNode(newFrame, null, null, false);
        }
      }

      nodeDisp.syncViewports();

      // Reset state
      setBox(null);
      targetFrameRef.current = null;
      setIsFrameModeActive(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
      document.body.style.WebkitUserSelect = "";
      document.body.style.MozUserSelect = "";
      document.body.style.msUserSelect = "";
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    containerRef,
    box?.isDrawing,
    isFrameModeActive,
    transform,
    nodeDisp,
    nodeState.nodes,
  ]);

  if (!box?.isDrawing) return null;

  const left = Math.min(box.startX, box.currentX);
  const top = Math.min(box.startY, box.currentY);
  const width = Math.abs(box.currentX - box.startX);
  const height = Math.abs(box.currentY - box.startY);

  return (
    <div
      className="absolute pointer-events-none border border-blue-500 bg-blue-500/10"
      style={{
        left,
        top,
        width,
        height,
        zIndex: 1000,
        userSelect: "none",
      }}
    />
  );
};

export default FrameCreator;
