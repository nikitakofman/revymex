import React, { useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";

const SNAP_ANGLE = 15; // Defines the increment for snapping (15 degrees)

export const RotateHandle: React.FC<{
  node: Node;
  elementRef: React.RefObject<HTMLDivElement>;
}> = ({ node, elementRef }) => {
  const { setNodeStyle, transform, setIsRotating, isRotating, dragDisp } =
    useBuilder();
  const initialMouseAngleRef = useRef<number>(0);
  const initialRotationRef = useRef<number>(0);

  const getElementCenter = () => {
    if (!elementRef.current) return { x: 0, y: 0 };
    const rect = elementRef.current.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const snapToAngle = (angle: number, isShiftKey: boolean): number => {
    if (!isShiftKey) return angle;

    // Simply round to nearest snap angle without any threshold
    return Math.round(angle / SNAP_ANGLE) * SNAP_ANGLE;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!elementRef.current) return;

    setIsRotating(true);
    const center = getElementCenter();
    const dx = e.clientX - center.x;
    const dy = e.clientY - center.y;
    initialMouseAngleRef.current = Math.atan2(dy, dx);

    let currentRotation = 0;
    if (node.style.rotate) {
      const match = node.style.rotate.match(/([-\d.]+)deg/);
      if (match) {
        currentRotation = parseFloat(match[1]);
      }
    }
    initialRotationRef.current = currentRotation;

    dragDisp.updateStyleHelper({
      type: "rotate",
      position: { x: e.clientX, y: e.clientY },
      value: currentRotation,
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (!elementRef.current) return;
      const center = getElementCenter();
      const dx = e.clientX - center.x;
      const dy = e.clientY - center.y;
      const currentMouseAngle = Math.atan2(dy, dx);
      const deltaAngleDeg =
        ((currentMouseAngle - initialMouseAngleRef.current) * 180) / Math.PI;

      // Normalize the rotation to be between 0 and 360 degrees
      let newRotation = initialRotationRef.current + deltaAngleDeg;
      newRotation = ((newRotation % 360) + 360) % 360;

      let displayRotation = newRotation;
      if (e.shiftKey) {
        // For shift key, directly snap to the nearest angle
        displayRotation = snapToAngle(newRotation, true);
        newRotation = displayRotation;
      }

      // Update the style helper with either snapped or smooth value
      dragDisp.updateStyleHelper({
        type: "rotate",
        position: { x: e.clientX, y: e.clientY },
        value: displayRotation,
      });

      // If rotation is very close to 0 or 360, remove the rotate property
      if (Math.abs(newRotation) < 0.5 || Math.abs(newRotation - 360) < 0.5) {
        setNodeStyle({ rotate: undefined }, undefined, true);
      } else {
        setNodeStyle({ rotate: `${newRotation}deg` }, undefined, true);
      }
    };

    const handleMouseUp = () => {
      setIsRotating(false);
      dragDisp.hideStyleHelper();

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Calculate scaled dimensions
  const handleSize = 10 / transform.scale;
  const handleOffset = 20 / transform.scale;
  const borderWidth = 1 / transform.scale;

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: "50%",
        top: `-${handleOffset}px`,
        transform: "translateX(-50%)",
        width: `${handleSize}px`,
        height: `${handleSize}px`,
        borderRadius: "50%",
        backgroundColor: node.isDynamic
          ? "var(--accent-secondary)"
          : "var(--accent)",
        border: `${borderWidth}px solid white`,
        cursor: isRotating ? "grabbing" : "grab",
        zIndex: 1001,
        pointerEvents: "auto",
        transformOrigin: "center",
      }}
    />
  );
};
