import React, { useState, useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { computeFrameDropIndicator } from "../utils";

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

export const TextCreator: React.FC = () => {
  const {
    containerRef,
    nodeDisp,
    transform,
    nodeState,
    setNodeStyle,
    isTextModeActive,
    setIsTextModeActive,
  } = useBuilder();
  const [box, setBox] = useState<DrawingBoxState | null>(null);
  const targetFrameRef = useRef<{ id: string; element: Element } | null>(null);

  // Handle T key press to activate text creation mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t" && !e.repeat) {
        setIsTextModeActive(true);
        document.body.style.cursor = "crosshair";
        Object.assign(document.body.style, preventSelectStyle);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t") {
        setIsTextModeActive(false);
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
      // Cleanup styles if component unmounts while text mode is active
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

        // Check if we're inside a frame
        const targetFrame = targetFrameRef.current;

        // Calculate font size based on height (using about 70% of height as a reasonable font size)
        const scaledHeight = height / transform.scale;
        const calculatedFontSize = Math.max(
          12,
          Math.min(200, Math.floor(scaledHeight * 0.7))
        );

        // Create text with font size in a span element instead of on the paragraph
        const defaultText = `<p class="text-inherit" style="text-align: center"><span style="color: #000000; font-size: ${calculatedFontSize}px">Text</span></p>`;

        let newNodeId: string;

        if (targetFrame) {
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

      // Reset state
      setBox(null);
      targetFrameRef.current = null;
      setIsTextModeActive(false);
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
    isTextModeActive,
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
      className="absolute pointer-events-none border border-green-500 bg-green-500/10"
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
