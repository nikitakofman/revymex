"use client";

import React, { useState, useEffect } from "react";

const DragDropPOC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dropIndicator, setDropIndicator] = useState({
    show: false,
    left: 0,
    height: 0,
  });
  const [dropPosition, setDropPosition] = useState("");

  const handleMouseDown = (e) => {
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    setMousePos({ x: mouseX, y: mouseY });

    // Find the parent frame and all child frames
    const parentFrame = document.getElementById("parent-frame");
    if (!parentFrame) return;

    const childFrames = Array.from(parentFrame.children).filter((child) =>
      child.classList.contains("frame")
    );
    const parentRect = parentFrame.getBoundingClientRect();

    // Create drop zones between frames
    const dropZones = [];

    // Add first edge
    dropZones.push({
      x: parentRect.left,
      width: 20,
      position: "Before Frame 1",
    });

    // Add zones between frames
    childFrames.forEach((frame, index) => {
      if (index < childFrames.length - 1) {
        const currentFrame = frame.getBoundingClientRect();
        const nextFrame = childFrames[index + 1].getBoundingClientRect();

        dropZones.push({
          x: currentFrame.right,
          width: nextFrame.left - currentFrame.right,
          position: `Between Frame ${index + 1} and Frame ${index + 2}`,
        });
      }
    });

    // Add last edge
    dropZones.push({
      x: parentRect.right - 20,
      width: 20,
      position: `After Frame ${childFrames.length}`,
    });

    // Check if mouse is in any drop zone
    const activeZone = dropZones.find(
      (zone) =>
        mouseX >= zone.x &&
        mouseX <= zone.x + zone.width &&
        mouseY >= parentRect.top &&
        mouseY <= parentRect.bottom
    );

    if (activeZone) {
      setDropIndicator({
        show: true,
        left: activeZone.x,
        height: parentRect.height,
      });
      setDropPosition(activeZone.position);
    } else {
      setDropIndicator({
        show: false,
        left: 0,
        height: 0,
      });
      setDropPosition("");
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDropIndicator({ show: false, left: 0, height: 0 });
    setDropPosition("");
  };

  // Add event listeners to document
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="w-full h-screen p-8">
      {/* Draggable element */}
      <div
        className="w-24 h-24 bg-blue-500 rounded cursor-move mb-8 flex items-center justify-center text-white"
        onMouseDown={handleMouseDown}
      >
        Drag me
      </div>

      {/* Parent frame with three child frames */}
      <div
        id="parent-frame"
        className="w-full h-96 border-2 border-gray-300 p-4 flex flex-row gap-4 relative"
      >
        {/* Child frames */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="frame flex-1 border-2 border-dashed border-gray-300 rounded flex items-center justify-center"
          >
            Frame {i}
          </div>
        ))}

        {/* Drop indicator */}
        {dropIndicator.show && (
          <div
            className="absolute w-1 bg-blue-500"
            style={{
              left: `${dropIndicator.left}px`,
              height: `${dropIndicator.height}px`,
              top: 0,
            }}
          />
        )}
      </div>

      {/* Debug info */}
      <div className="mt-8 p-4  rounded">
        <h3 className="font-bold mb-2">Debug Info:</h3>
        <p>
          Mouse Position: {mousePos.x}, {mousePos.y}
        </p>
        <p>Dragging: {isDragging ? "Yes" : "No"}</p>
        {dropPosition && (
          <p className="font-medium text-blue-600">Position: {dropPosition}</p>
        )}
      </div>
    </div>
  );
};

export default DragDropPOC;
