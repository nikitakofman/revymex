import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { useDragStart } from "./useDragStart";

export const useConnect = () => {
  const { dragDisp, dragState } = useBuilder();
  const handleDragStart = useDragStart();
  const timeoutRef = useRef<any>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  return useCallback(
    (node: Node) => {
      const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent default drag behavior

        // Store initial mouse position
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

        // Start a timeout to detect click vs drag
        timeoutRef.current = setTimeout(() => {
          // If we reach here, it's a drag
          handleDragStart(e, undefined, node);
        }, 200); // 200ms threshold to distinguish click from drag
      };

      const handleMouseUp = (e: React.MouseEvent) => {
        // Clear the drag timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Check if it was a click (little to no movement)
        if (mouseDownPosRef.current) {
          const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
          const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);

          if (dx < 5 && dy < 5) {
            // threshold for considering it a click
            // Handle selection
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
          outline: dragState.selectedIds.includes(node.id)
            ? "2px solid #3b82f6"
            : undefined,
          userSelect: "none", // Prevent text selection
          WebkitUserDrag: "none", // Prevent image drag in webkit browsers
        },
      };
    },
    [handleDragStart, dragDisp, dragState.selectedIds]
  );
};
