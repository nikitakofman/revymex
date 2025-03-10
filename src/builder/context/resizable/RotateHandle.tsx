import React, { useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";

const SNAP_ANGLE = 15; // Defines the increment for snapping (15 degrees)

interface RotateHandleProps {
  node: Node;
  elementRef: React.RefObject<HTMLDivElement>;
  groupBounds?: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
  isGroupSelection?: boolean;
}

export const RotateHandle: React.FC<RotateHandleProps> = ({
  node,
  elementRef,
  groupBounds,
  isGroupSelection = false,
}) => {
  const {
    setNodeStyle,
    transform,
    setIsRotating,
    isRotating,
    dragDisp,
    startRecording,
    stopRecording,
    dragState,
    nodeState,
  } = useBuilder();
  const initialMouseAngleRef = useRef<number>(0);
  const initialRotationRef = useRef<number>(0);
  const initialRotationsRef = useRef<Map<string | number, number>>(new Map());

  const getElementCenter = () => {
    if (isGroupSelection && groupBounds) {
      // For group selection, use the center of group bounds
      return {
        x:
          (groupBounds.left + groupBounds.width / 2) * transform.scale +
          transform.x,
        y:
          (groupBounds.top + groupBounds.height / 2) * transform.scale +
          transform.y,
      };
    }

    // For single element, use its center
    if (!elementRef.current) return { x: 0, y: 0 };
    const rect = elementRef.current.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const snapToAngle = (angle: number, isShiftKey: boolean): number => {
    if (!isShiftKey) return angle;
    return Math.round(angle / SNAP_ANGLE) * SNAP_ANGLE;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sessionId = startRecording();
    setIsRotating(true);

    const center = getElementCenter();
    const dx = e.clientX - center.x;
    const dy = e.clientY - center.y;
    initialMouseAngleRef.current = Math.atan2(dy, dx);

    // Store the initial rotation for reference
    let currentRotation = 0;
    if (node.style.rotate) {
      const match = node.style.rotate.match(/([-\d.]+)deg/);
      if (match) {
        currentRotation = parseFloat(match[1]);
      }
    }
    initialRotationRef.current = currentRotation;

    // For group rotation, store initial rotation of all selected nodes
    initialRotationsRef.current.clear();
    if (isGroupSelection) {
      dragState.selectedIds.forEach((id) => {
        const selectedNode = nodeState.nodes.find((n) => n.id === id);
        if (selectedNode) {
          let rotation = 0;
          if (selectedNode.style.rotate) {
            const match = selectedNode.style.rotate.match(/([-\d.]+)deg/);
            if (match) {
              rotation = parseFloat(match[1]);
            }
          }
          initialRotationsRef.current.set(id, rotation);
        }
      });
    }

    dragDisp.updateStyleHelper({
      type: "rotate",
      position: { x: e.clientX, y: e.clientY },
      value: currentRotation,
    });

    const handleMouseMove = (e: MouseEvent) => {
      const center = getElementCenter();
      const dx = e.clientX - center.x;
      const dy = e.clientY - center.y;
      const currentMouseAngle = Math.atan2(dy, dx);
      const deltaAngleDeg =
        ((currentMouseAngle - initialMouseAngleRef.current) * 180) / Math.PI;

      // Update UI helper
      dragDisp.updateStyleHelper({
        type: "rotate",
        position: { x: e.clientX, y: e.clientY },
        value: initialRotationRef.current + deltaAngleDeg,
      });

      // Handle multiple nodes for group rotation
      if (isGroupSelection) {
        dragState.selectedIds.forEach((nodeId) => {
          const initialRotation = initialRotationsRef.current.get(nodeId) || 0;
          let newRotation = initialRotation + deltaAngleDeg;

          if (e.shiftKey) {
            newRotation = snapToAngle(newRotation, true);
          }

          // Normalize rotation
          newRotation = ((newRotation % 360) + 360) % 360;

          // Apply rotation to each node individually to improve performance
          if (
            Math.abs(newRotation) < 0.5 ||
            Math.abs(newRotation - 360) < 0.5
          ) {
            setNodeStyle({ rotate: undefined }, [nodeId], false);
          } else {
            setNodeStyle({ rotate: `${newRotation}deg` }, [nodeId], false);
          }
        });
      } else {
        // Single node rotation (original logic)
        let newRotation = initialRotationRef.current + deltaAngleDeg;

        if (e.shiftKey) {
          newRotation = snapToAngle(newRotation, true);
        }

        // Normalize rotation
        newRotation = ((newRotation % 360) + 360) % 360;

        // Apply rotation
        if (Math.abs(newRotation) < 0.5 || Math.abs(newRotation - 360) < 0.5) {
          setNodeStyle({ rotate: undefined }, [node.id], true);
        } else {
          setNodeStyle({ rotate: `${newRotation}deg` }, [node.id], true);
        }
      }
    };

    const handleMouseUp = () => {
      setIsRotating(false);
      dragDisp.hideStyleHelper();
      stopRecording(sessionId);
      initialRotationsRef.current.clear();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Don't render if this isn't the primary selected node in a group
  if (isGroupSelection && node.id !== dragState.selectedIds[0]) {
    return null;
  }

  // Skip for viewport nodes in single selection mode
  if (!isGroupSelection && node.id.includes("viewport")) {
    return null;
  }

  // Calculate scaled dimensions
  const handleSize = 8 / transform.scale;
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
        backgroundColor: "white",
        border: `${borderWidth}px solid   ${
          node.isDynamic || node.dynamicParentId
            ? "var(--accent-secondary)"
            : "var(--accent)"
        },`,
        cursor: isRotating ? "grabbing" : "grab",
        zIndex: 1001,
        pointerEvents: "auto",
        transformOrigin: "center",
      }}
    />
  );
};
