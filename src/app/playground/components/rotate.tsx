import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

/** Rotate a point (x, y) around the origin by +angleDeg */
function rotatePoint(x, y, angleDeg) {
  const rad = (Math.PI / 180) * angleDeg;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

/** Rotate a point (x, y) around the origin by -angleDeg (inverse rotation) */
function inverseRotatePoint(x, y, angleDeg) {
  return rotatePoint(x, y, -angleDeg);
}

/** The green box in the canvas. */
const Box = ({ style, onMouseDown }) => (
  <div
    style={{
      width: 400,
      height: 800,
      backgroundColor: "#4CAF50",
      border: "2px solid #2E7D32",
      position: "absolute",
      userSelect: "none",
      cursor: "move",
      transformOrigin: "top left",
      ...style,
    }}
    onMouseDown={onMouseDown}
  />
);

/**
 * The floating ghost box rendered via a portal during drag.
 * It appears in front of everything, pinned to a fixed position on screen
 * with the correct rotation & scale so that the grabbed point remains under the cursor.
 */
const DraggedBoxPortal = ({
  isDragging,
  boxWidth,
  boxHeight,
  rotation,
  scale,
  screenX,
  screenY,
}) => {
  // If not dragging, render nothing
  if (!isDragging) return null;

  // Create the ghost box
  return createPortal(
    <div
      style={{
        // We'll position this 'container' at top-left (0,0),
        // then use transform to place it at (screenX, screenY).
        position: "fixed",
        left: 0,
        top: 0,
        // We move & scale & rotate around the top-left corner:
        transform: `translate(${screenX}px, ${screenY}px)
                    scale(${scale})
                    rotate(${rotation}deg)`,
        transformOrigin: "top left",
        pointerEvents: "none", // let mouse events pass through the ghost
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: boxWidth,
          height: boxHeight,
          backgroundColor: "red",
          border: "2px solid #2E7D32",
        }}
      />
    </div>,
    document.body
  );
};

const InfiniteCanvas = () => {
  // --- Box rotation + position in "canvas coordinates" ---
  const [rotation, setRotation] = useState(0);
  const [boxPos, setBoxPos] = useState({ x: 100, y: 100 }); // top-left corner in canvas coords

  // --- Dragging state ---
  const [isDragging, setIsDragging] = useState(false);
  // The unrotated offset from the box's top-left corner to the grab point
  const [dragLocalOffset, setDragLocalOffset] = useState({ x: 0, y: 0 });
  // Where we put the box in canvas coords while dragging (used to finalize on mouse up)
  const [dragCanvasPos, setDragCanvasPos] = useState({ x: 0, y: 0 });
  // The computed position of the ghost box in screen coords (for the portal)
  const [dragScreenPos, setDragScreenPos] = useState({ x: 0, y: 0 });

  // --- Pan/zoom transformation on the entire canvas ---
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);

  /** Convert (clientX, clientY) to "canvas" coords by undoing pan/zoom. */
  const getCanvasCoords = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    // Undo the translation & scale
    return {
      x: (screenX - transform.x) / transform.scale,
      y: (screenY - transform.y) / transform.scale,
    };
  };

  /** Convert a point in "canvas" coords to "screen" coords (clientX, clientY). */
  const toScreenCoords = (canvasX, canvasY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: rect.left + transform.x + canvasX * transform.scale,
      y: rect.top + transform.y + canvasY * transform.scale,
    };
  };

  // --- Panning logic ---
  const handleCanvasMouseDown = (e) => {
    // Middle button (1) or right button (2) to pan
    if (e.button !== 1 && e.button !== 2) return;
    e.preventDefault();
    setIsPanning(true);
    setIsDragging(false); // Stop any box dragging if we were dragging
    setPanStart({
      x: e.clientX - transform.x,
      y: e.clientY - transform.y,
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    // If we were dragging, finalize the box position
    if (isDragging) {
      setIsDragging(false);
      // Commit the dragCanvasPos as the real boxPos
      setBoxPos(dragCanvasPos);
    }
  };

  const handleWheel = (e) => {
    // Only zoom if Ctrl is pressed
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = -e.deltaY;
    const scaleFactor = delta > 0 ? 1.1 : 0.9;

    // Zoom around the mouse pointer
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform((prev) => ({
      scale: prev.scale * scaleFactor,
      x: prev.x + (mouseX - mouseX * scaleFactor),
      y: prev.y + (mouseY - mouseY * scaleFactor),
    }));
  };

  // --- Box dragging logic ---
  const handleBoxMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click for box drag
    e.preventDefault();
    e.stopPropagation();

    // Begin dragging
    setIsDragging(true);
    setIsPanning(false);

    // Current mouse coords in canvas space
    const { x: cx, y: cy } = getCanvasCoords(e.clientX, e.clientY);

    // The local offset of the grab point in the box's *rotated* space
    const offsetX = cx - boxPos.x;
    const offsetY = cy - boxPos.y;

    // Convert that to the box's unrotated local coords
    const unrotatedOffset = inverseRotatePoint(offsetX, offsetY, rotation);
    setDragLocalOffset(unrotatedOffset);

    // We'll store the box's current position as the "starting" point
    setDragCanvasPos(boxPos);

    // Hide the real box in canvas (we do that by final render style)
  };

  const handleBoxMouseMove = (e) => {
    if (!isDragging) return;

    // Mouse position in canvas coords
    const { x: cx, y: cy } = getCanvasCoords(e.clientX, e.clientY);

    // Rotate the stored unrotated offset forward by `rotation`
    const rotatedOffset = rotatePoint(
      dragLocalOffset.x,
      dragLocalOffset.y,
      rotation
    );

    // The new top-left of the box in canvas coords
    const newBoxX = cx - rotatedOffset.x;
    const newBoxY = cy - rotatedOffset.y;

    // Update the "dragCanvasPos" which we will commit on mouse up
    const newPos = { x: newBoxX, y: newBoxY };
    setDragCanvasPos(newPos);

    // Convert that same position to screen coords
    const screenPos = toScreenCoords(newBoxX, newBoxY);

    // We'll store it for the ghost portal
    setDragScreenPos({ x: screenPos.x, y: screenPos.y });
  };

  // --- Render ---
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar with rotation input */}
      <div
        style={{
          padding: "10px",
          borderBottom: "1px solid #ddd",
          backgroundColor: "white",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <label>
          Rotation (degrees):
          <input
            type="number"
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value) || 0)}
            style={{
              marginLeft: "8px",
              width: "80px",
              padding: "4px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </label>
      </div>

      {/* The main "infinite" canvas area */}
      <div
        ref={canvasRef}
        style={{
          flex: 1,
          backgroundColor: "#f0f0f0",
          overflow: "hidden",
          position: "relative",
          cursor: isPanning ? "grabbing" : "default",
          touchAction: "none",
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={(e) => {
          handleCanvasMouseMove(e);
          handleBoxMouseMove(e);
        }}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()} // disable right-click menu
      >
        {/* Our panned+zoomed "world" */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {/* A simple grid background */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `
                linear-gradient(to right, #ddd 1px, transparent 1px),
                linear-gradient(to bottom, #ddd 1px, transparent 1px)
              `,
              backgroundSize: "20px 20px",
            }}
          />

          {/* The real box in the canvas (hidden while dragging) */}
          <Box
            style={{
              left: boxPos.x,
              top: boxPos.y,
              rotate: `${rotation}deg`,
              visibility: isDragging ? "hidden" : "visible",
            }}
            onMouseDown={handleBoxMouseDown}
          />
        </div>

        {/* The draggable ghost box in a portal (only shown while dragging) */}
        <DraggedBoxPortal
          isDragging={isDragging}
          boxWidth={400}
          boxHeight={800}
          rotation={rotation}
          scale={transform.scale}
          screenX={dragScreenPos.x}
          screenY={dragScreenPos.y}
        />
      </div>
    </div>
  );
};

export default InfiniteCanvas;
