import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { useDragStart } from "../dnd/useDragStart";

export const useConnect = () => {
  const {
    dragDisp,
    dragState,
    nodeDisp,
    nodeState,
    isMovingCanvas,
    selectedIdsRef,
    isFrameModeActive,
    isTextModeActive,
    interfaceDisp,
  } = useBuilder();
  const handleDragStart = useDragStart();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  const isNearEdge = (
    e: React.MouseEvent,
    element: HTMLElement,
    threshold: number = 2.5
  ) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if we're near any edge
    const nearLeft = x <= threshold;
    const nearRight = x >= rect.width - threshold;
    const nearTop = y <= threshold;
    const nearBottom = y >= rect.height - threshold;

    return nearLeft || nearRight || nearTop || nearBottom;
  };

  return useCallback(
    (node: Node) => {
      const handleMouseDown = (e: React.MouseEvent) => {
        // Check if click is on a resize handle
        const target = e.target as HTMLElement;

        if (e.button === 2 || isFrameModeActive || isTextModeActive) {
          return;
        }

        interfaceDisp.toggleLayers();

        console.log("mouse down now");

        // First check for explicit resize handles
        const resizeHandle = target.closest('[data-resize-handle="true"]');

        // Then check if we're near an edge
        const isEdgeClick = isNearEdge(e, target);

        if (resizeHandle || isEdgeClick) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

        const isAlreadySelected = dragState.selectedIds.includes(node.id);

        // Rest of your existing handleMouseDown code...
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
          if (isAlreadySelected && dragState.selectedIds.length > 1) {
            // Don't change the selection - the node is already part of multi-selection
            // We simply do nothing here to preserve all selected nodes
          } else if (e.shiftKey) {
            // Add to selection with shift key
            dragDisp.addToSelection(node.id);
          } else {
            // Otherwise select just this node
            dragDisp.selectNode(node.id);
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

              // Check both resize handle and edges before starting drag
              const currentTarget = document.elementFromPoint(
                moveEvent.clientX,
                moveEvent.clientY
              ) as HTMLElement;
              const isResizeHandle = currentTarget?.closest(
                '[data-resize-handle="true"]'
              );
              const isEdge = currentTarget && isNearEdge(e, currentTarget);

              if (!isResizeHandle && !isEdge) {
                handleDragStart(e, undefined, node);
              }
            }
          }
        };

        window.addEventListener("mousemove", mouseMoveHandlerRef.current);
      };

      // Rest of your existing component code...
      const handleMouseUp = (e: React.MouseEvent) => {
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

        // Check if the clicked node is already in the selection
        const isNodeSelected = dragState.selectedIds.includes(targetNodeId);

        // If node is not selected and not holding shift, select only this node
        if (!isNodeSelected && !e.shiftKey) {
          dragDisp.clearSelection();

          dragDisp.selectNode(targetNodeId);
        }
        // If node is not selected and holding shift, add to selection
        else if (!isNodeSelected && e.shiftKey) {
          dragDisp.addToSelection(targetNodeId);
        }
        // If node is already selected, keep the current selection
        // This maintains multi-selection when right-clicking on a selected node

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
      dragState.hoverNodeId,
      nodeState.nodes,
      nodeDisp,
      dragState.dragSource,
      isMovingCanvas,
    ]
  );
};
