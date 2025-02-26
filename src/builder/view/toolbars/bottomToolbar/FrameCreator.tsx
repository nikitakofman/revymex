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

export const FrameCreator: React.FC = () => {
  const {
    containerRef,
    nodeDisp,
    transform,
    nodeState,
    isFrameModeActive,
    setIsFrameModeActive,
    dragDisp,
    isResizing,
    isRotating,
    isAdjustingGap,
  } = useBuilder();
  const [box, setBox] = useState<DrawingBoxState | null>(null);
  const targetFrameRef = useRef<{ id: string; element: Element } | null>(null);

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

      if (isResizing || isRotating || isAdjustingGap) return;

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

      // Update style helper with current dimensions
      dragDisp.updateStyleHelper({
        type: "dimensions",
        position: { x: e.clientX, y: e.clientY },
        dimensions: {
          width,
          height,
          unit: "px",
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

        // Define box for element detection
        const boxRect = {
          left: canvasX,
          top: canvasY,
          right: canvasX + width / transform.scale,
          bottom: canvasY + height / transform.scale,
        };

        // Find elements that will be encapsulated
        const allElements = nodeState.nodes.filter(
          (node) => node.type !== "placeholder" && !node.isViewport
        );

        const containedElements = [];

        for (const node of allElements) {
          const element = document.querySelector(
            `[data-node-id="${node.id}"]`
          ) as HTMLElement;
          if (!element) continue;

          // Get element bounds in canvas coordinates
          const elRect = element.getBoundingClientRect();
          const elCanvasX =
            (elRect.left - rect.left - transform.x) / transform.scale;
          const elCanvasY =
            (elRect.top - rect.top - transform.y) / transform.scale;
          const elCanvasRight = elCanvasX + elRect.width / transform.scale;
          const elCanvasBottom = elCanvasY + elRect.height / transform.scale;

          // Check if element is completely inside box
          const isContained =
            elCanvasX >= boxRect.left &&
            elCanvasY >= boxRect.top &&
            elCanvasRight <= boxRect.right &&
            elCanvasBottom <= boxRect.bottom;

          if (isContained) {
            containedElements.push({
              node,
              absolutePosition: {
                left: elCanvasX,
                top: elCanvasY,
              },
            });
          }
        }

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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            inViewport: mediaElement.node.inViewport,
          };

          // Use the centralized transformation utility
          const transformed = handleMediaToFrameTransformation(
            mediaElement.node,
            newFrame,
            nodeDisp,
            "inside"
          );

          if (transformed) {
            // Process other contained elements if any (except the media element)
            if (containedElements.length > 0) {
              const newFrameNode = nodeState.nodes.find(
                (n) => n.id === newFrame.id
              );
              if (newFrameNode) {
                for (const item of containedElements) {
                  // Skip the media element itself
                  if (item.node.id === mediaElement.node.id) continue;

                  // Update position to be centered in the frame
                  nodeDisp.updateNodeStyle([item.node.id], {
                    position: "relative",
                    left: "",
                    top: "",
                  });

                  // Then make it a child of the frame
                  nodeDisp.moveNode(item.node.id, true, {
                    targetId: newFrame.id,
                    position: "inside",
                  });
                }
              }
            }

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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            inViewport: true,
          };

          const dropIndicator = computeFrameDropIndicator(
            targetFrame.element,
            frameChildren,
            e.clientX,
            e.clientY
          );

          let newFrameId = newFrame.id;

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

          // Process contained elements if any
          if (containedElements.length > 0) {
            for (const item of containedElements) {
              // Update position to be centered in the frame
              nodeDisp.updateNodeStyle([item.node.id], {
                position: "relative",
                left: "",
                top: "",
              });

              // Then make it a child of the frame
              nodeDisp.moveNode(item.node.id, true, {
                targetId: newFrameId,
                position: "inside",
              });
            }
          }
        } else {
          // Drawing on canvas - create absolute positioned frame
          const newFrameId = nanoid();
          const newFrame: Node = {
            id: newFrameId,
            type: "frame",
            style: {
              position: "absolute",
              left: `${canvasX}px`,
              top: `${canvasY}px`,
              width: `${width / transform.scale}px`,
              height: `${height / transform.scale}px`,
              backgroundColor: "#97cffc",
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            inViewport: false,
          };

          nodeDisp.addNode(newFrame, null, null, false);

          // Process contained elements if any
          if (containedElements.length > 0) {
            for (const item of containedElements) {
              // Update position to be centered in the frame
              nodeDisp.updateNodeStyle([item.node.id], {
                position: "relative",
                left: "",
                top: "",
              });

              // Then make it a child of the frame
              nodeDisp.moveNode(item.node.id, true, {
                targetId: newFrameId,
                position: "inside",
              });
            }
          }
        }
      }

      nodeDisp.syncViewports();

      // Hide the style helper
      dragDisp.hideStyleHelper();

      // Reset state
      setBox(null);
      targetFrameRef.current = null;
      setIsFrameModeActive(false);

      window.dispatchEvent(new Event("resize"));
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
    isFrameModeActive,
    transform,
    nodeDisp,
    nodeState.nodes,
    setIsFrameModeActive,
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

export default FrameCreator;
