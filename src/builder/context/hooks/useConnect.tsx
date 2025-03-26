import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { useDragStart } from "../dnd/useDragStart";
import { findParentViewport } from "../utils";

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
    isMoveCanvasMode,
    setNodeStyle,
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

  // Helper function to find dynamic parent in hierarchy
  const findDynamicParent = (node: Node): Node | null => {
    if (node.isDynamic) return node;
    if (!node.parentId) return null;
    const parent = nodeState.nodes.find((n) => n.id === node.parentId);
    if (!parent) return null;
    return parent.isDynamic ? parent : findDynamicParent(parent);
  };

  return useCallback(
    (node: Node) => {
      const handleMouseDown = (e: React.MouseEvent) => {
        // Skip all drag handling if in move canvas mode
        if (isMoveCanvasMode) {
          return;
        }

        // Check if click is on a resize handle
        const target = e.target as HTMLElement;

        if (e.button === 2 || isFrameModeActive || isTextModeActive) {
          return;
        }

        interfaceDisp.toggleLayers();

        // // First check for explicit resize handles
        // const resizeHandle = target.closest('[data-resize-handle="true"]');

        // // Then check if we're near an edge
        // const isEdgeClick = isNearEdge(e, target);

        // if (resizeHandle || isEdgeClick) {
        //   e.preventDefault();
        //   e.stopPropagation();
        //   return;
        // }

        e.preventDefault();
        e.stopPropagation();

        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

        const isAlreadySelected = dragState.selectedIds.includes(node.id);

        // Handle selection for all nodes (including locked ones)
        const parentNode = node.parentId
          ? nodeState.nodes.find((n) => n.id === node.parentId)
          : null;

        // Find dynamic parent in hierarchy or by dynamicParentId
        const dynamicParentByRef = node.dynamicParentId
          ? nodeState.nodes.find(
              (n) => n.id === node.dynamicParentId && n.isDynamic
            )
          : null;

        const dynamicParentInHierarchy = findDynamicParent(node);
        const dynamicParent = dynamicParentByRef || dynamicParentInHierarchy;

        if (
          !dragState.dynamicModeNodeId &&
          (parentNode?.isDynamic || dynamicParent)
        ) {
          // If not in dynamic mode and clicking on a dynamic node or its child, select the dynamic parent
          const targetNodeId = dynamicParent?.id || parentNode?.id;
          if (!e.shiftKey && targetNodeId) {
            dragDisp.selectNode(targetNodeId);
          } else if (targetNodeId) {
            dragDisp.addToSelection(targetNodeId);
          }
        } else {
          if (isAlreadySelected && dragState.selectedIds.length > 1) {
            // Don't change the selection - the node is already part of multi-selection
          } else if (e.shiftKey) {
            // Add to selection with shift key
            dragDisp.addToSelection(node.id);
          } else {
            // Otherwise select just this node
            dragDisp.selectNode(node.id);
          }
        }

        // Only set up the mousemove handler for dragging if the node is not locked
        if (!node.isLocked) {
          mouseMoveHandlerRef.current = (moveEvent: MouseEvent) => {
            if (mouseDownPosRef.current) {
              const dx = Math.abs(
                moveEvent.clientX - mouseDownPosRef.current.x
              );
              const dy = Math.abs(
                moveEvent.clientY - mouseDownPosRef.current.y
              );

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
        }
      };

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

            // Find dynamic parent in hierarchy or by dynamicParentId
            const dynamicParentByRef = node.dynamicParentId
              ? nodeState.nodes.find(
                  (n) => n.id === node.dynamicParentId && n.isDynamic
                )
              : null;

            const dynamicParentInHierarchy = findDynamicParent(node);
            const dynamicParent =
              dynamicParentByRef || dynamicParentInHierarchy;

            if (
              !dragState.dynamicModeNodeId &&
              (parentNode?.isDynamic || dynamicParent)
            ) {
              const targetNodeId = dynamicParent?.id || parentNode?.id;
              if (!e.shiftKey && targetNodeId) {
                dragDisp.selectNode(targetNodeId);
              } else if (targetNodeId) {
                dragDisp.addToSelection(targetNodeId);
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

        // First check if this node is already dynamic
        if (node.isDynamic) {
          if (!dragState.dynamicModeNodeId) {
            // Store dynamic state for this node
            nodeDisp.storeDynamicNodeState(node.id);

            setNodeStyle(
              {
                position: "absolute",
              },
              [node.id],
              true
            );
            // Determine the correct viewport ID
            // Try dynamicViewportId first, then originalParentId, then parentId
            const parentViewportId =
              node.dynamicViewportId ||
              findParentViewport(node.originalParentId, nodeState.nodes) ||
              findParentViewport(node.parentId, nodeState.nodes);

            if (parentViewportId) {
              console.log(`Setting active viewport to: ${parentViewportId}`);
              dragDisp.switchDynamicViewport(parentViewportId);
            } else {
              console.warn("Could not determine viewport for node:", node.id);
              // Fallback to desktop viewport if no other viewport is found
              dragDisp.switchDynamicViewport("viewport-1440");
            }
            dragDisp.setDynamicModeNodeId(
              dragState.dynamicModeNodeId ? null : node.id
            );
          }

          return;
        }

        // Next, check for a referenced dynamic parent
        const dynamicParentByRef = node.dynamicParentId
          ? nodeState.nodes.find(
              (n) => n.id === node.dynamicParentId && n.isDynamic
            )
          : null;

        // Finally, check for a dynamic parent in the hierarchy
        const dynamicParentInHierarchy = findDynamicParent(node);

        // Use the first one we find
        const dynamicNode = dynamicParentByRef || dynamicParentInHierarchy;

        if (dynamicNode) {
          if (!dragState.dynamicModeNodeId) {
            nodeDisp.storeDynamicNodeState(dynamicNode.id);

            // Determine the correct viewport ID using multiple fallbacks
            const parentViewportId =
              dynamicNode.dynamicViewportId ||
              findParentViewport(
                dynamicNode.originalParentId,
                nodeState.nodes
              ) ||
              findParentViewport(dynamicNode.parentId, nodeState.nodes);

            if (parentViewportId) {
              console.log(`Setting active viewport to: ${parentViewportId}`);
              dragDisp.switchDynamicViewport(parentViewportId);
            } else {
              console.warn(
                "Could not determine viewport for node:",
                dynamicNode.id
              );
              // Fallback to desktop viewport if no other viewport is found
              dragDisp.switchDynamicViewport("viewport-1440");
            }
            dragDisp.setDynamicModeNodeId(
              dragState.dynamicModeNodeId ? null : dynamicNode.id
            );
          }
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

        // Find dynamic parent in hierarchy or by dynamicParentId
        const dynamicParentByRef = node.dynamicParentId
          ? nodeState.nodes.find(
              (n) => n.id === node.dynamicParentId && n.isDynamic
            )
          : null;

        const dynamicParentInHierarchy = findDynamicParent(node);
        const dynamicParent = dynamicParentByRef || dynamicParentInHierarchy;

        const targetNodeId =
          !dragState.dynamicModeNodeId &&
          (parentNode?.isDynamic || dynamicParent)
            ? dynamicParent?.id || parentNode?.id
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
            // Determine if this is a child of a dynamic node
            const isDynamicChild =
              !node.isDynamic &&
              (!!node.dynamicParentId || !!findDynamicParent(node));

            // Only set hover for nodes that are either:
            // 1. In dynamic mode (all nodes can be hovered), OR
            // 2. Dynamic nodes themselves (can always be hovered), OR
            // 3. NOT children of dynamic nodes when not in dynamic mode
            if (
              dragState.dynamicModeNodeId ||
              node.isDynamic ||
              !isDynamicChild
            ) {
              requestAnimationFrame(() => {
                dragDisp.setHoverNodeId(node.id);
              });
            }
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
          ...(dragState.dynamicState === "hovered" && node.dynamicState?.hovered
            ? {
                ...node.dynamicState.hovered,
                // Override with original position values
                position: node.style.position,
                left: node.style.left,
                top: node.style.top,
                right: node.style.right,
                bottom: node.style.bottom,
              }
            : {}),
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
      dragState.dynamicState,
      dragState.selectedIds,
      interfaceDisp,
      isFrameModeActive,
      isMoveCanvasMode,
      isTextModeActive,
      findDynamicParent,
    ]
  );
};
