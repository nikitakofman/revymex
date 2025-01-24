import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { useDragStart } from "./useDragStart";

export const useConnect = () => {
  const { dragDisp, dragState, nodeDisp } = useBuilder(); // Add dragState from useBuilder
  const handleDragStart = useDragStart();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  return useCallback(
    (node: Node) => {
      const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

        timeoutRef.current = setTimeout(() => {
          handleDragStart(e, undefined, node);
        }, 100);
      };

      const handleMouseUp = (e: React.MouseEvent) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (mouseDownPosRef.current) {
          const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
          const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);

          if (dx < 5 && dy < 5) {
            if (!e.shiftKey) {
              dragDisp.selectNode(node.id);
            } else {
              dragDisp.addToSelection(node.id);
            }
          }
        }

        mouseDownPosRef.current = null;
      };

      const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (node.isDynamic) {
          if (!dragState.dynamicModeNodeId) {
            // Entering dynamic mode
            nodeDisp.storeDynamicNodeState(node.id);
            if (!node.dynamicPosition) {
              nodeDisp.updateNode(node.id, { dynamicPosition: { x: 0, y: 0 } });
            }
          }
          dragDisp.setDynamicModeNodeId(
            dragState.dynamicModeNodeId ? null : node.id
          );
        }
      };

      // Calculate the final style based on mode
      const baseStyle = {
        ...node.style,
        userSelect: "none",
        WebkitUserDrag: "none",
      };

      // When in dynamic mode, use dynamic positions
      const style =
        dragState.dynamicModeNodeId && node.dynamicPosition
          ? {
              ...baseStyle,
              position: "absolute",
              left: `${node.dynamicPosition.x}px`,
              top: `${node.dynamicPosition.y}px`,
            }
          : baseStyle;

      return {
        "data-node-id": node.id,
        "data-node-type": node.type,
        onMouseDown: handleMouseDown,
        onMouseUp: handleMouseUp,
        onDoubleClick: handleDoubleClick,
        draggable: false,
        style,
      };
    },
    [handleDragStart, dragDisp, dragState.dynamicModeNodeId] // Add dragState.dynamicModeNodeId to dependencies
  );
};
