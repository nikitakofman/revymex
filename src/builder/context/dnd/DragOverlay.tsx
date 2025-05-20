import React, { useEffect, useState } from "react";
import {
  useDraggedNodes,
  useIsDragging,
  useDragSource,
  useIsOverCanvas,
  useIsDraggingBackToParent,
} from "../atoms/drag-store";
import { NodeComponent } from "@/builder/registry/renderNodes";
import { useTransform } from "../atoms/canvas-interaction-store";

/* Helper function to parse rotation value */
const deg = (rotate: string | number | undefined) => {
  if (!rotate) return 0;
  if (typeof rotate === "number") return rotate;
  const m = rotate.match(/(-?\d+\.?\d*)(deg|rad)?/);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return m[2] === "rad" ? v * (180 / Math.PI) : v;
};

const DragOverlay = () => {
  const draggedNodes = useDraggedNodes();
  const dragging = useIsDragging();
  const dragSource = useDragSource();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const transform = useTransform();
  const isOverCanvas = useIsOverCanvas();
  const isDraggingBackToParent = useIsDraggingBackToParent();

  // Listen to global mousemove
  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    document.addEventListener("mousemove", h);
    return () => document.removeEventListener("mousemove", h);
  }, []);

  // Don't render if we don't have dragged nodes or we're not dragging
  if (draggedNodes.length === 0 || !dragging) return null;

  // KEY CHANGE: Don't render the overlay if:
  // 1. We're dragging directly on canvas, OR
  // 2. We're dragging back to parent (let the real node be visible)
  if (
    dragSource === "canvas" ||
    dragSource === "absolute-in-frame" ||
    isDraggingBackToParent
  )
    return null;

  // Get the primary dragged node for position reference
  const primaryNode = draggedNodes[0];

  // Render overlays for all dragged nodes
  return (
    <>
      {draggedNodes.map((dragged, index) => {
        // Unpack what useDragStart gave us
        const { mouseX, mouseY, width, height, rotate, isSimpleRotation } =
          dragged.offset;

        // FIXED: Use constant offsets captured at drag start
        // but use let instead of const since we need to modify these values
        let left = mouse.x - mouseX;
        let top = mouse.y - mouseY;

        if (isSimpleRotation) {
          // Calculate rotation adjustments for 2D rotation
          const rotRad = (deg(rotate) * Math.PI) / 180;

          // Calculate effective dimensions after rotation
          const effW =
            Math.abs(width * Math.cos(rotRad)) +
            Math.abs(height * Math.sin(rotRad));
          const effH =
            Math.abs(height * Math.cos(rotRad)) +
            Math.abs(width * Math.sin(rotRad));

          // Calculate shift caused by rotation
          const rotShiftX = (effW - width) / 2;
          const rotShiftY = (effH - height) / 2;

          // Add rotation shift
          left += rotShiftX * transform.scale;
          top += rotShiftY * transform.scale;
        }

        return (
          <div
            key={dragged.node.id}
            style={{
              position: "fixed",
              left: `${left}px`,
              top: `${top}px`,
              pointerEvents: "none",
              zIndex: 9999,
            }}
            data-drag-overlay
            data-node-dragged={dragged.node.id}
          >
            <div
              style={{
                transform: `scale(${transform.scale})`,
                transformOrigin: "top left",
              }}
            >
              <NodeComponent
                nodeId={dragged.node.id}
                filter="outOfViewport"
                preview={true}
                style={!isSimpleRotation ? { transform: "none" } : undefined}
              />
            </div>
          </div>
        );
      })}
    </>
  );
};

export default DragOverlay;
