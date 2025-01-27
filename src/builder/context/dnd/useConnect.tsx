import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { useDragStart } from "./useDragStart";

export const useConnect = () => {
  const { dragDisp, dragState, nodeDisp, nodeState } = useBuilder();
  const handleDragStart = useDragStart();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  return useCallback(
    (node: Node) => {
      const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

        // Clear selection immediately unless shift is pressed
        if (!e.shiftKey) {
          dragDisp.clearSelection();
          // Select the current node immediately
          dragDisp.selectNode(node.id);
        }

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
            const parentNode = node.parentId
              ? nodeState.nodes.find((n) => n.id === node.parentId)
              : null;

            if (!dragState.dynamicModeNodeId && parentNode?.isDynamic) {
              if (!e.shiftKey) {
                dragDisp.selectNode(parentNode.id);
              } else {
                dragDisp.addToSelection(parentNode.id);
              }
            } else {
              if (!e.shiftKey) {
                dragDisp.selectNode(node.id);
              } else {
                dragDisp.addToSelection(node.id);
              }
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

      const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        const parentNode = node.parentId
          ? nodeState.nodes.find((n) => n.id === node.parentId)
          : null;
        const targetNodeId =
          !dragState.dynamicModeNodeId && parentNode?.isDynamic
            ? parentNode.id
            : node.id;

        if (!e.shiftKey) {
          dragDisp.clearSelection();
        }
        dragDisp.selectNode(targetNodeId);
        dragDisp.setContextMenu(e.clientX, e.clientY, targetNodeId);
      };

      return {
        "data-node-id": node.id,
        "data-node-type": node.type,
        onMouseDown: handleMouseDown,
        onMouseUp: handleMouseUp,
        onDoubleClick: handleDoubleClick,
        onContextMenu: handleContextMenu,
        draggable: false,
      };
    },
    [handleDragStart, dragDisp, dragState.dynamicModeNodeId, nodeState.nodes]
  );
};
