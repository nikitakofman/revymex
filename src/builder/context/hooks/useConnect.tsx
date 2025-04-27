import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { useDragStart } from "../dnd/useDragStart";
import { findParentViewport } from "../utils";
import {
  _internalHoverNodeIdAtom,
  hoverOps,
  useGetHoveredNodeId,
} from "../atoms/hover-store";
import {
  _internalSelectNodeIdAtom,
  selectOps,
  useGetSelectedIds,
} from "../atoms/select-store";
import { interfaceOps } from "../atoms/interface-store";
import { useGetDragSource, useGetDynamicModeNodeId } from "../atoms/drag-store";
import { contextMenuOps } from "../atoms/context-menu-store";
import {
  useGetIsEditingText,
  useGetIsFrameModeActive,
  useGetIsMoveCanvasMode,
  useGetIsMovingCanvas,
  useGetIsTextModeActive,
} from "../atoms/canvas-interaction-store";
import { dynamicOps } from "../atoms/dynamic-store";

export const useConnect = () => {
  // Use the basic useBuilder hook without global subscriptions
  const { nodeState, nodeDisp, setNodeStyle } = useBuilder();

  console.log(`Use Connect re-rendering`, new Date().getTime());

  const handleDragStart = useDragStart();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  const { setHoverNodeId } = hoverOps;
  const { addToSelection, clearSelection, setSelectNodeId } = selectOps;

  const getDragSource = useGetDragSource();
  const getMovingCanvas = useGetIsMovingCanvas();
  const getIsMoveCanvasMode = useGetIsMoveCanvasMode();
  const getIsFrameModeActive = useGetIsFrameModeActive();
  const getIsTextModeActive = useGetIsTextModeActive();
  const getIsEditingText = useGetIsEditingText();
  const getHoverNodeId = useGetHoveredNodeId();

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

  // Get the viewport ID for a node
  const getNodeViewportId = (node: Node): string | null => {
    // First check explicit dynamicViewportId
    if (node.dynamicViewportId) {
      return node.dynamicViewportId as string;
    }

    // Then check parent chain
    return findParentViewport(node.parentId, nodeState.nodes);
  };

  // Find the top-level dynamic parent in the same viewport as the node
  const findDynamicParentInSameViewport = (node: Node): Node | null => {
    // Get the viewport for this node
    const nodeViewportId = getNodeViewportId(node);
    if (!nodeViewportId) return null;

    // If node itself is dynamic and in this viewport, return it
    if (node.isDynamic && node.dynamicViewportId === nodeViewportId) {
      return node;
    }

    // Get all dynamic nodes in this specific viewport
    const dynamicNodesInViewport = nodeState.nodes.filter(
      (n) => n.isDynamic && n.dynamicViewportId === nodeViewportId
    );

    if (dynamicNodesInViewport.length === 0) return null;

    // Try to find a direct dynamic parent reference
    if (node.dynamicParentId) {
      const directDynamicParent = dynamicNodesInViewport.find(
        (n) => n.id === node.dynamicParentId
      );
      if (directDynamicParent) return directDynamicParent;
    }

    // Try to find a parent in the node hierarchy
    let current = node;
    let visited = new Set<string | number>();

    while (current && current.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = nodeState.nodes.find((n) => n.id === current.parentId);
      if (!parent) break;

      // Check if this parent is dynamic and in the same viewport
      if (parent.isDynamic && parent.dynamicViewportId === nodeViewportId) {
        return parent;
      }

      current = parent;
    }

    // If no direct parent is found, try other relationships
    // First by sharedId
    if (node.sharedId) {
      for (const dynamicNode of dynamicNodesInViewport) {
        if (dynamicNode.sharedId === node.sharedId) {
          return dynamicNode;
        }
      }
    }

    // Then by dynamicFamilyId
    if (node.dynamicFamilyId) {
      for (const dynamicNode of dynamicNodesInViewport) {
        if (dynamicNode.dynamicFamilyId === node.dynamicFamilyId) {
          return dynamicNode;
        }
      }
    }

    // Finally by variantResponsiveId
    if (node.variantResponsiveId) {
      for (const dynamicNode of dynamicNodesInViewport) {
        if (dynamicNode.variantResponsiveId === node.variantResponsiveId) {
          return dynamicNode;
        }
      }
    }

    return null;
  };

  const currentSelectedIds = useGetSelectedIds();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  return useCallback(
    (node: Node) => {
      // Subscribe to node-specific hover and selection state
      // This is the crucial addition that fixes the issue

      const isFrameModeActive = getIsFrameModeActive();
      const dynamicModeNodeId = getDynamicModeNodeId();

      const handleMouseDown = (e: React.MouseEvent) => {
        const selectedIds = currentSelectedIds();
        const isMoveCanvasMode = getIsMoveCanvasMode();
        const isTextModeActive = getIsTextModeActive();
        const isEditingText = getIsEditingText();
        // Skip all drag handling if in move canvas mode
        if (isMoveCanvasMode) {
          return;
        }

        if (
          e.button === 2 ||
          isFrameModeActive ||
          isTextModeActive ||
          isEditingText
        ) {
          return;
        }

        interfaceOps.toggleLayers();

        e.preventDefault();
        e.stopPropagation();

        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

        const isAlreadySelected = selectOps.getSelectedIds().includes(node.id);

        // Find the dynamic parent in the same viewport
        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(node);

        // Handle selection based on if we're in dynamic mode
        if (!dynamicModeNodeId && dynamicParentInSameViewport) {
          // If not in dynamic mode and we have a viewport-specific dynamic parent, select it
          if (!e.shiftKey) {
            setSelectNodeId(dynamicParentInSameViewport.id);
          } else {
            addToSelection(dynamicParentInSameViewport.id);
          }
        } else {
          // Normal selection handling
          if (isAlreadySelected && selectedIds.length > 1) {
            // Don't change multi-selection
          } else if (e.shiftKey) {
            addToSelection(node.id);
          } else {
            setSelectNodeId(node.id);
          }
        }

        // Only set up drag handler if node is not locked
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

                // Check for resize handle and edges
                const currentTarget = document.elementFromPoint(
                  moveEvent.clientX,
                  moveEvent.clientY
                ) as HTMLElement;
                const isResizeHandle = currentTarget?.closest(
                  '[data-resize-handle="true"]'
                );
                const isEdge = currentTarget && isNearEdge(e, currentTarget);

                if (!isResizeHandle && !isEdge) {
                  console.log("START DRAG");
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
            // Find the dynamic parent in the same viewport
            const dynamicParentInSameViewport =
              findDynamicParentInSameViewport(node);

            if (!dynamicModeNodeId && dynamicParentInSameViewport) {
              // If not in dynamic mode and we have a viewport-specific dynamic parent, select it
              if (!e.shiftKey) {
                setSelectNodeId(dynamicParentInSameViewport.id);
              } else {
                addToSelection(dynamicParentInSameViewport.id);
              }
            } else {
              // Normal selection handling
              if (!e.shiftKey) {
                setSelectNodeId(node.id);
              } else {
                addToSelection(node.id);
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
          if (!dynamicModeNodeId) {
            // Store dynamic state for this node
            nodeDisp.storeDynamicNodeState(node.id);

            setNodeStyle({ position: "absolute" }, [node.id], true);

            // Determine the correct viewport ID
            const parentViewportId =
              node.dynamicViewportId ||
              findParentViewport(node.originalParentId, nodeState.nodes) ||
              findParentViewport(node.parentId, nodeState.nodes);

            if (parentViewportId) {
              console.log(`Setting active viewport to: ${parentViewportId}`);
              dynamicOps.switchDynamicViewport(parentViewportId);
            } else {
              console.warn("Could not determine viewport for node:", node.id);
              dynamicOps.switchDynamicViewport("viewport-1440");
            }

            dynamicOps.setDynamicModeNodeId(node.id);
          }
          return;
        }

        // Find dynamic parent in the same viewport
        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(node);

        if (dynamicParentInSameViewport) {
          if (!dynamicModeNodeId) {
            // Store dynamic state for this node
            nodeDisp.storeDynamicNodeState(dynamicParentInSameViewport.id);

            setNodeStyle(
              { position: "absolute" },
              [dynamicParentInSameViewport.id],
              true
            );

            // Determine the correct viewport ID
            const parentViewportId =
              dynamicParentInSameViewport.dynamicViewportId ||
              findParentViewport(
                dynamicParentInSameViewport.originalParentId,
                nodeState.nodes
              ) ||
              findParentViewport(
                dynamicParentInSameViewport.parentId,
                nodeState.nodes
              );

            if (parentViewportId) {
              console.log(`Setting active viewport to: ${parentViewportId}`);
              dynamicOps.switchDynamicViewport(parentViewportId);
            } else {
              console.warn(
                "Could not determine viewport for node:",
                dynamicParentInSameViewport.id
              );
              dynamicOps.switchDynamicViewport("viewport-1440");
            }

            dynamicOps.setDynamicModeNodeId(dynamicParentInSameViewport.id);
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

        // Find the dynamic parent in the same viewport
        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(node);

        // Determine target node for context menu
        const targetNodeId =
          !dynamicModeNodeId && dynamicParentInSameViewport
            ? dynamicParentInSameViewport.id
            : node.id;
        const selectedIds = currentSelectedIds();
        // Check if the target is already selected
        const isNodeSelected = selectedIds.includes(targetNodeId);

        // If not selected and not holding shift, select only this node
        if (!isNodeSelected && !e.shiftKey) {
          clearSelection();
          setSelectNodeId(targetNodeId);
        }
        // If not selected and holding shift, add to selection
        else if (!isNodeSelected && e.shiftKey) {
          addToSelection(targetNodeId);
        }
        // Otherwise keep current selection

        contextMenuOps.setContextMenu(
          e.clientX,
          e.clientY,
          targetNodeId as string
        );
      };

      // Optimized hover handling for dynamic nodes and their children
      const handleMouseOver = (e: React.MouseEvent) => {
        const dragSource = getDragSource();

        const isMovingCanvas = getMovingCanvas();

        if (e.target === e.currentTarget && !dragSource && !isMovingCanvas) {
          // Get the viewport ID for this node
          const nodeViewportId = getNodeViewportId(node);

          // Find dynamic parent in this specific viewport
          const dynamicParentInSameViewport =
            findDynamicParentInSameViewport(node);

          if (dynamicModeNodeId) {
            // In dynamic mode, hover over the actual node
            requestAnimationFrame(() => {
              setHoverNodeId(node.id);
            });
          } else if (node.isDynamic) {
            // For dynamic nodes themselves, hover on the node
            requestAnimationFrame(() => {
              setHoverNodeId(node.id);
            });
          } else if (dynamicParentInSameViewport) {
            // If this is a child of a dynamic node, hover on the parent in the same viewport
            requestAnimationFrame(() => {
              setHoverNodeId(dynamicParentInSameViewport.id);
            });
          } else {
            // Regular node - hover on itself
            requestAnimationFrame(() => {
              setHoverNodeId(node.id);
            });
          }
        }
      };

      // Modified mouseOut handling to keep hover effect on dynamic parent
      const handleMouseOut = (e: React.MouseEvent) => {
        const hoveredNodeId = getHoverNodeId();
        if (e.target === e.currentTarget) {
          const currentHoverId = hoveredNodeId;
          console.log("moussing out");
          // Find dynamic parent in this specific viewport
          const dynamicParentInSameViewport =
            findDynamicParentInSameViewport(node);

          // Only clear hover in specific cases:

          // Case 1: We're currently hovering this exact node
          if (currentHoverId === node.id) {
            setHoverNodeId(null);
          }
          // Case 2: We're in dynamic mode (has different hover behavior)
          else if (dynamicModeNodeId) {
            setHoverNodeId(null);
          }
          // Case 3: If current hover is NOT our dynamic parent, clear it
          // This prevents clearing hover when moving between children of the same parent
          else if (
            dynamicParentInSameViewport &&
            currentHoverId !== dynamicParentInSameViewport.id
          ) {
            setHoverNodeId(null);
          }

          // Otherwise keep the hover (especially when it's on the dynamic parent)
          setHoverNodeId(null);
        }
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

      // Apply hover and selection styles directly based on state
      const computedStyles = {
        ...otherStyles,
        // Apply hover style from dynamicState if relevant
      };

      return {
        "data-node-id": node.id,
        "data-node-type": node.type,
        onMouseDown: handleMouseDown,
        onMouseUp: handleMouseUp,
        onDoubleClick: handleDoubleClick,
        onContextMenu: handleContextMenu,
        onMouseOver: handleMouseOver,
        onMouseOut: handleMouseOut,
        draggable: false,
        style: computedStyles,
      };
    },
    [
      handleDragStart,
      nodeDisp,

      getIsFrameModeActive,
      getIsMoveCanvasMode,
      getIsTextModeActive,
      getIsEditingText,
      setNodeStyle,
      setHoverNodeId,
    ]
  );
};
