import React, { useState, useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import {
  computeFrameDropIndicator,
  handleMediaToFrameTransformation,
} from "@/builder/context/utils";

interface DrawingBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDrawing: boolean;
}

export const TextCreator: React.FC = () => {
  const {
    containerRef,
    nodeDisp,
    transform,
    nodeState,
    setNodeStyle,
    isTextModeActive,
    setIsTextModeActive,
    dragDisp,
    isResizing,
    isRotating,
    isAdjustingGap,
  } = useBuilder();
  const [box, setBox] = useState<DrawingBoxState | null>(null);
  const targetFrameRef = useRef<{ id: string; element: Element } | null>(null);

  // The key press effect is now moved to Canvas component,
  // we no longer need to handle T key press here

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
      if (!isTextModeActive) return;

      targetFrameRef.current = findTargetFrame(e);

      const rect = canvas.getBoundingClientRect();
      setBox({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
        isDrawing: true,
      });

      // Initialize style helper
      dragDisp.updateStyleHelper({
        type: "dimensions",
        position: { x: e.clientX, y: e.clientY },
        dimensions: {
          width: 0,
          height: 0,
          unit: "px",
        },
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!box?.isDrawing) return;

      if (isResizing || isRotating || isAdjustingGap) return;

      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      setBox((prev) => ({
        ...prev!,
        currentX: newX,
        currentY: newY,
      }));

      // Calculate real dimensions in pixels
      const width = Math.abs(newX - box.startX) / transform.scale;
      const height = Math.abs(newY - box.startY) / transform.scale;

      // Calculate font size (same logic as when creating the text node)
      const calculatedFontSize = Math.max(
        12,
        Math.min(1000, Math.floor(height * 0.7))
      );

      // Update style helper with current dimensions and font size
      dragDisp.updateStyleHelper({
        type: "dimensions",
        position: { x: e.clientX, y: e.clientY },
        dimensions: {
          width,
          height,
          unit: "px",
          fontSize: calculatedFontSize,
        },
      });
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

        // Check if we're inside a frame
        const targetFrame = targetFrameRef.current;

        // Check if we're drawing over a media element (image/video)
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

        // Calculate font size based on height (using about 70% of height as a reasonable font size)
        const scaledHeight = height / transform.scale;
        const calculatedFontSize = Math.max(
          12,
          Math.min(1000, Math.floor(scaledHeight * 0.7))
        );

        // Create text with font size in a span element instead of on the paragraph
        const defaultText = `<p class="text-inherit" style="text-align: center"><span style="color: #000000; font-size: ${calculatedFontSize}px">Text</span></p>`;

        let newNodeId: string;

        // If drawing on a media element, transform it to a frame first
        if (mediaElement) {
          // Create a new text node to add inside the frame
          const newText: Node = {
            id: nanoid(),
            type: "text",
            style: {
              position: "relative",
              width: `auto`,
              height: `auto`,
              flex: "0 0 auto",
              text: defaultText,
            },
            inViewport: mediaElement.node.inViewport || false,
          };

          newNodeId = newText.id;

          // Use the centralized utility to transform media to frame and add the text node
          handleMediaToFrameTransformation(
            mediaElement.node,
            newText,
            nodeDisp,
            "inside"
          );
        } else if (targetFrame) {
          // Drawing over a frame - insert text as child
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

          const newText: Node = {
            id: nanoid(),
            type: "text",
            style: {
              position: "relative",
              width: `auto`,
              height: `auto`,
              flex: "0 0 auto",
              text: defaultText,
            },
            inViewport: true,
          };

          newNodeId = newText.id;

          const dropIndicator = computeFrameDropIndicator(
            targetFrame.element,
            frameChildren,
            e.clientX,
            e.clientY
          );

          if (dropIndicator?.dropInfo) {
            nodeDisp.addNode(
              newText,
              dropIndicator.dropInfo.targetId,
              dropIndicator.dropInfo.position,
              true
            );
          } else {
            nodeDisp.addNode(newText, targetFrame.id, "inside", true);
          }
        } else {
          // Drawing on canvas - create absolute positioned text
          const newText: Node = {
            id: nanoid(),
            type: "text",
            style: {
              position: "absolute",
              left: `${canvasX}px`,
              top: `${canvasY}px`,
              width: `${width / transform.scale}px`,
              height: `${height / transform.scale}px`,
              text: defaultText,
            },
            inViewport: false,
          };

          newNodeId = newText.id;
          nodeDisp.addNode(newText, null, null, false);
        }

        // Additional text styling options based on dimensions
        if (width / transform.scale > 500) {
          // For wider text boxes, center align text
          setTimeout(() => {
            setNodeStyle(
              {
                text: `<p class="text-inherit" style="text-align: center"><span style="color: #000000; font-size: ${calculatedFontSize}px">Text</span></p>`,
              },
              [newNodeId],
              true
            );
          }, 0);
        }
      }

      nodeDisp.syncViewports();

      // Hide the style helper
      dragDisp.hideStyleHelper();

      // Reset state
      setBox(null);
      targetFrameRef.current = null;
      setIsTextModeActive(false); // Still need to reset text mode after drawing
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Make sure to hide the style helper when unmounting
      dragDisp.hideStyleHelper();
    };
  }, [
    containerRef,
    box?.isDrawing,
    isTextModeActive,
    transform,
    nodeDisp,
    nodeState.nodes,
    setNodeStyle,
    setIsTextModeActive,
    dragDisp,
    isResizing,
    isRotating,
    isAdjustingGap,
    box?.startX,
    box?.startY,
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

export default TextCreator;
