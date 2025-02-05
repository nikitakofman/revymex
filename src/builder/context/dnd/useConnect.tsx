import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { useDragStart } from "./useDragStart";

export const useConnect = () => {
  const { dragDisp, dragState, nodeDisp, nodeState, isMovingCanvas } =
    useBuilder();
  const handleDragStart = useDragStart();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  return useCallback(
    (node: Node) => {
      const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

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

        mouseMoveHandlerRef.current = (moveEvent: MouseEvent) => {
          if (mouseDownPosRef.current) {
            const dx = Math.abs(moveEvent.clientX - mouseDownPosRef.current.x);
            const dy = Math.abs(moveEvent.clientY - mouseDownPosRef.current.y);

            if (dx > 1 || dy > 1) {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }

              if (mouseMoveHandlerRef.current) {
                window.removeEventListener(
                  "mousemove",
                  mouseMoveHandlerRef.current
                );
                mouseMoveHandlerRef.current = null;
              }
              handleDragStart(e, undefined, node);
            }
          }
        };

        window.addEventListener("mousemove", mouseMoveHandlerRef.current);
      };

      const handleMouseUp = (e: React.MouseEvent) => {
        // if (e.target !== e.currentTarget) {
        //   return;
        // }

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (mouseMoveHandlerRef.current) {
          window.removeEventListener("mousemove", mouseMoveHandlerRef.current);
          mouseMoveHandlerRef.current = null;
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
        dragDisp.setContextMenu(e.clientX, e.clientY, targetNodeId as string);
      };

      const { border, borderWidth, borderStyle, borderColor, ...otherStyles } =
        node.style || {};

      const hasBorder = border || borderWidth || borderStyle || borderColor;

      if (hasBorder) {
        const styleId = `border-style-${node.id}`;
        let styleTag = document.getElementById(styleId);
        if (!styleTag) {
          styleTag = document.createElement("style");
          styleTag.id = styleId;
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = `
          [data-node-id="${node.id}"] {
            position: relative;
          }
          [data-node-id="${node.id}"]::after {
            content: '';
            position: absolute;
            inset: 0;
            border-width: ${borderWidth || 0};
            border-style: ${borderStyle || "solid"};
            border-color: ${borderColor || "transparent"};
            border-radius: ${node.style.borderRadius || 0};
            pointer-events: none;
            z-index: 1;
            box-sizing: border-box;
          }
        `;
      }

      return {
        "data-node-id": node.id,
        "data-node-type": node.type,
        onMouseDown: handleMouseDown,
        onMouseUp: handleMouseUp,
        onDoubleClick: handleDoubleClick,
        onContextMenu: handleContextMenu,
        onMouseOver: (e: React.MouseEvent) => {
          if (
            e.target === e.currentTarget &&
            !dragState.dragSource &&
            !isMovingCanvas
          ) {
            requestAnimationFrame(() => {
              dragDisp.setHoverNodeId(node.id);
            });
          }
        },
        onMouseOut: (e: React.MouseEvent) => {
          if (
            e.target === e.currentTarget &&
            dragState.hoverNodeId === node.id
          ) {
            requestAnimationFrame(() => {
              dragDisp.setHoverNodeId(null);
            });
          }
        },
        draggable: false,
        style: {
          ...otherStyles,
        },
      };
    },
    [
      handleDragStart,
      dragDisp,
      dragState.dynamicModeNodeId,
      nodeState.nodes,
      nodeDisp,
      dragState.dragSource,
      isMovingCanvas,
    ]
  );
};
