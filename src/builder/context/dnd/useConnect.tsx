import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { useDragStart } from "./useDragStart";

export const useConnect = () => {
  const { dragDisp, dragState, isMovingCanvas } = useBuilder();
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

      return {
        "data-node-id": node.id,
        "data-node-type": node.type,
        onMouseDown: handleMouseDown,
        onMouseUp: handleMouseUp,
        draggable: false,
        style: {
          ...node.style,
          userSelect: "none",
          WebkitUserDrag: "none",
        },
      };
    },
    [handleDragStart, dragDisp, dragState.selectedIds, isMovingCanvas]
  );
};
