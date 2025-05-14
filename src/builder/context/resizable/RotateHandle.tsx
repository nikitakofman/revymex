import React, { useRef } from "react";
import { useGetSelectedIds } from "../atoms/select-store";
import { visualOps } from "../atoms/visual-store";
import {
  canvasOps,
  useIsRotating,
  useTransform,
} from "../atoms/canvas-interaction-store";
import {
  NodeId,
  useNodeStyle,
  useNodeFlags,
  useGetNodeStyle,
  getCurrentNodes,
} from "../atoms/node-store";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";

const SNAP_ANGLE = 15; // Defines the increment for snapping (15 degrees)

interface RotateHandleProps {
  nodeId: NodeId;
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
  nodeId,
  elementRef,
  groupBounds,
  isGroupSelection = false,
}) => {
  // Get node data directly from atoms
  const style = useNodeStyle(nodeId);
  const flags = useNodeFlags(nodeId);
  const { isDynamic = false } = flags;
  const dynamicParentId = flags.dynamicParentId || null;

  const isRotating = useIsRotating();
  const transform = useTransform();
  const currentSelectedIds = useGetSelectedIds();
  const getNodeStyle = useGetNodeStyle();

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

    canvasOps.setIsRotating(true);

    const center = getElementCenter();
    const dx = e.clientX - center.x;
    const dy = e.clientY - center.y;
    initialMouseAngleRef.current = Math.atan2(dy, dx);

    // Store the initial rotation for reference
    let currentRotation = 0;
    if (style.rotate) {
      const match = style.rotate.match(/([-\d.]+)deg/);
      if (match) {
        currentRotation = parseFloat(match[1]);
      }
    }
    initialRotationRef.current = currentRotation;

    const selectedIds = currentSelectedIds();

    // For group rotation, store initial rotation of all selected nodes
    initialRotationsRef.current.clear();
    if (isGroupSelection) {
      const allNodes = getCurrentNodes();

      selectedIds.forEach((id) => {
        const nodeStyle = getNodeStyle(id);
        let rotation = 0;

        if (nodeStyle.rotate) {
          const match = nodeStyle.rotate.match(/([-\d.]+)deg/);
          if (match) {
            rotation = parseFloat(match[1]);
          }
        }
        initialRotationsRef.current.set(id, rotation);
      });
    }

    visualOps.updateStyleHelper({
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
      visualOps.updateStyleHelper({
        type: "rotate",
        position: { x: e.clientX, y: e.clientY },
        value: initialRotationRef.current + deltaAngleDeg,
      });

      // Handle multiple nodes for group rotation
      if (isGroupSelection) {
        // Use selectedIds from the hook
        selectedIds.forEach((id) => {
          const initialRotation = initialRotationsRef.current.get(id) || 0;
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
            // Use updateNodeStyle instead of setNodeStyle for single node updates
            updateNodeStyle(id, { rotate: undefined });
          } else {
            updateNodeStyle(id, { rotate: `${newRotation}deg` });
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

        // Apply rotation - using updateNodeStyle instead of setNodeStyle
        if (Math.abs(newRotation) < 0.5 || Math.abs(newRotation - 360) < 0.5) {
          updateNodeStyle(nodeId, { rotate: undefined });
        } else {
          updateNodeStyle(nodeId, { rotate: `${newRotation}deg` });
        }
      }
    };

    const handleMouseUp = () => {
      canvasOps.setIsRotating(false);
      visualOps.hideStyleHelper();
      initialRotationsRef.current.clear();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };
  const selectedIds = currentSelectedIds();

  // Don't render if this isn't the primary selected node in a group
  // Use selectedIds from the hook
  if (isGroupSelection && nodeId !== selectedIds[0]) {
    return null;
  }

  // Skip for viewport nodes in single selection mode
  if (!isGroupSelection && nodeId.includes("viewport")) {
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
        border: `${borderWidth}px solid ${
          isDynamic || dynamicParentId
            ? "var(--accent-secondary)"
            : "var(--accent)"
        }`,
        cursor: isRotating ? "grabbing" : "grab",
        zIndex: 1001,
        pointerEvents: "auto",
        transformOrigin: "center",
      }}
    />
  );
};
