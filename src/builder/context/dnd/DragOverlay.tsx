import React, { useEffect, useState } from "react";
import {
  useDraggedNode,
  useIsDragging,
  useDragSource,
  useIsOverCanvas,
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
  const dragged = useDraggedNode();
  const dragging = useIsDragging();
  const dragSource = useDragSource();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const transform = useTransform();
  const isOverCanvas = useIsOverCanvas();

  // Listen to global mousemove
  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    document.addEventListener("mousemove", h);
    return () => document.removeEventListener("mousemove", h);
  }, []);

  // Don't render if we don't have a dragged node or we're not dragging
  if (!dragged || !dragging) return null;

  // Don't render the overlay if we're dragging directly on canvas
  if (dragSource === "canvas") return null;

  // Unpack what useDragStart gave us
  const { mouseX, mouseY, width, height, rotate, isSimpleRotation } =
    dragged.offset;

  // Convert the canvas-offset back to current screen pixels
  let left = mouse.x - mouseX;
  let top = mouse.y - mouseY;

  if (isSimpleRotation) {
    // Calculate rotation adjustments for 2D rotation
    const rotRad = (deg(rotate) * Math.PI) / 180;

    // Calculate effective dimensions after rotation
    const effW =
      Math.abs(width * Math.cos(rotRad)) + Math.abs(height * Math.sin(rotRad));
    const effH =
      Math.abs(height * Math.cos(rotRad)) + Math.abs(width * Math.sin(rotRad));

    // Calculate shift caused by rotation
    const rotShiftX = (effW - width) / 2;
    const rotShiftY = (effH - height) / 2;

    // Add rotation shift
    left += rotShiftX * transform.scale;
    top += rotShiftY * transform.scale;
  }

  return (
    <div
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
};

export default DragOverlay;
