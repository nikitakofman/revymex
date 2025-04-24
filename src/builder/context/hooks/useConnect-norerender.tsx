import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { useDragStart } from "../dnd/useDragStart";
import { findParentViewport } from "../utils";
import { hoverOps } from "../atoms/hover-store";
import { selectOps, useGetSelectedIds } from "../atoms/select-store";

// Create a simple cache for event handlers only
const handlerCache = new Map();

export const useConnect = () => {
  // Use the basic useBuilder hook without global subscriptions
  const {
    dragDisp,
    dragState,
    nodeDisp,
    nodeState,
    isMovingCanvas,
    isFrameModeActive,
    isTextModeActive,
    interfaceDisp,
    isMoveCanvasMode,
    setNodeStyle,
    isEditingText,
  } = useBuilder();

  const handleDragStart = useDragStart();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  const { setHoverNodeId } = hoverOps;
  const { selectNode, addToSelection, clearSelection, setSelectNodeId } =
    selectOps;

  // Use the imperative getter pattern
  const getSelectedIds = useGetSelectedIds();

  // Helper function to check if near edge
  const isNearEdge = useCallback(
    (e: React.MouseEvent, element: HTMLElement, threshold: number = 2.5) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if we're near any edge
      const nearLeft = x <= threshold;
      const nearRight = x >= rect.width - threshold;
      const nearTop = y <= threshold;
      const nearBottom = y >= rect.height - threshold;

      return nearLeft || nearRight || nearTop || nearBottom;
    },
    []
  );

  // Memoize these utility functions
  const getNodeViewportId = useCallback(
    (node: Node): string | null => {
      // First check explicit dynamicViewportId
      if (node.dynamicViewportId) {
        return node.dynamicViewportId as string;
      }

      // Then check parent chain
      return findParentViewport(node.parentId, nodeState.nodes);
    },
    [nodeState.nodes]
  );

  // Find the top-level dynamic parent in the same viewport as the node
  const findDynamicParentInSameViewport = useCallback(
    (node: Node): Node | null => {
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
    },
    [nodeState.nodes, getNodeViewportId]
  );

  // The core connect function wrapped in useCallback
  return useCallback(
    (node: Node) => {
      const nodeId = node.id;

      // NEW APPROACH: Split handlers (which can be cached) from visual props (which change with style)

      // 1. Get or create event handlers (these rarely need to change)
      const handlerKey = `${nodeId}-${dragState.dynamicModeNodeId}`;

      if (!handlerCache.has(handlerKey)) {
        // Create new handlers and cache them
        const handlers = {
          onMouseDown: (e: React.MouseEvent) => {
            if (isMoveCanvasMode) return;
            if (
              e.button === 2 ||
              isFrameModeActive ||
              isTextModeActive ||
              isEditingText
            )
              return;

            interfaceDisp.toggleLayers();
            e.preventDefault();
            e.stopPropagation();

            mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

            // Get the current selection state
            const selectedIds = getSelectedIds();
            const isAlreadySelected = selectedIds.includes(nodeId);

            // Find the dynamic parent in the same viewport
            const dynamicParentInSameViewport =
              findDynamicParentInSameViewport(node);

            // Handle selection based on if we're in dynamic mode
            if (!dragState.dynamicModeNodeId && dynamicParentInSameViewport) {
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
                addToSelection(nodeId);
              } else {
                setSelectNodeId(nodeId);
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
                    const isEdge =
                      currentTarget && isNearEdge(e, currentTarget);

                    if (!isResizeHandle && !isEdge) {
                      console.log("START DRAG");
                      handleDragStart(e, undefined, node);
                    }
                  }
                }
              };

              window.addEventListener("mousemove", mouseMoveHandlerRef.current);
            }
          },

          onMouseUp: (e: React.MouseEvent) => {
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

            if (mouseDownPosRef.current) {
              const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
              const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);

              if (dx < 5 && dy < 5) {
                // Find the dynamic parent in the same viewport
                const dynamicParentInSameViewport =
                  findDynamicParentInSameViewport(node);

                if (
                  !dragState.dynamicModeNodeId &&
                  dynamicParentInSameViewport
                ) {
                  // If not in dynamic mode and we have a viewport-specific dynamic parent, select it
                  if (!e.shiftKey) {
                    setSelectNodeId(dynamicParentInSameViewport.id);
                  } else {
                    addToSelection(dynamicParentInSameViewport.id);
                  }
                } else {
                  // Normal selection handling
                  if (!e.shiftKey) {
                    setSelectNodeId(nodeId);
                  } else {
                    addToSelection(nodeId);
                  }
                }
              }
            }

            mouseDownPosRef.current = null;
          },

          onDoubleClick: (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // First check if this node is already dynamic
            if (node.isDynamic) {
              if (!dragState.dynamicModeNodeId) {
                // Store dynamic state for this node
                nodeDisp.storeDynamicNodeState(nodeId);

                setNodeStyle({ position: "absolute" }, [nodeId], true);

                // Determine the correct viewport ID
                const parentViewportId =
                  node.dynamicViewportId ||
                  findParentViewport(node.originalParentId, nodeState.nodes) ||
                  findParentViewport(node.parentId, nodeState.nodes);

                if (parentViewportId) {
                  console.log(
                    `Setting active viewport to: ${parentViewportId}`
                  );
                  dragDisp.switchDynamicViewport(parentViewportId);
                } else {
                  console.warn(
                    "Could not determine viewport for node:",
                    nodeId
                  );
                  dragDisp.switchDynamicViewport("viewport-1440");
                }

                dragDisp.setDynamicModeNodeId(nodeId);
              }
              return;
            }

            // Find dynamic parent in the same viewport
            const dynamicParentInSameViewport =
              findDynamicParentInSameViewport(node);

            if (dynamicParentInSameViewport) {
              if (!dragState.dynamicModeNodeId) {
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
                  console.log(
                    `Setting active viewport to: ${parentViewportId}`
                  );
                  dragDisp.switchDynamicViewport(parentViewportId);
                } else {
                  console.warn(
                    "Could not determine viewport for node:",
                    dynamicParentInSameViewport.id
                  );
                  dragDisp.switchDynamicViewport("viewport-1440");
                }

                dragDisp.setDynamicModeNodeId(dynamicParentInSameViewport.id);
              }
            }
          },

          onContextMenu: (e: React.MouseEvent) => {
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
              !dragState.dynamicModeNodeId && dynamicParentInSameViewport
                ? dynamicParentInSameViewport.id
                : nodeId;

            // Get current selected IDs
            const selectedIds = getSelectedIds();

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

            dragDisp.setContextMenu(
              e.clientX,
              e.clientY,
              targetNodeId as string
            );
          },

          onMouseOver: (e: React.MouseEvent) => {
            if (
              e.target === e.currentTarget &&
              !dragState.dragSource &&
              !isMovingCanvas
            ) {
              // Find dynamic parent in this specific viewport
              const dynamicParentInSameViewport =
                findDynamicParentInSameViewport(node);

              if (dragState.dynamicModeNodeId) {
                // In dynamic mode, hover over the actual node
                requestAnimationFrame(() => {
                  setHoverNodeId(nodeId);
                });
              } else if (node.isDynamic) {
                // For dynamic nodes themselves, hover on the node
                requestAnimationFrame(() => {
                  setHoverNodeId(nodeId);
                });
              } else if (dynamicParentInSameViewport) {
                // If this is a child of a dynamic node, hover on the parent in the same viewport
                requestAnimationFrame(() => {
                  setHoverNodeId(dynamicParentInSameViewport.id);
                });
              } else {
                // Regular node - hover on itself
                requestAnimationFrame(() => {
                  setHoverNodeId(nodeId);
                });
              }
            }
          },

          onMouseOut: (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) {
              setHoverNodeId(null);
            }
          },

          draggable: false,
        };

        // Cache the handlers
        handlerCache.set(handlerKey, handlers);
      }

      // 2. Process style properties (these change frequently and shouldn't be cached)
      const { border, borderWidth, borderStyle, borderColor, ...otherStyles } =
        node.style || {};

      const hasBorder = border || borderWidth || borderStyle || borderColor;

      if (hasBorder) {
        const styleId = `border-style-${nodeId}`;
        let styleTag = document.getElementById(styleId);
        if (!styleTag) {
          styleTag = document.createElement("style");
          styleTag.id = styleId;
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = `
        [data-node-id="${nodeId}"] {
          position: relative;
        }
        [data-node-id="${nodeId}"]::after {
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
      };

      // 3. Combine handlers (cached) with visual props (always fresh)
      return {
        ...handlerCache.get(handlerKey),
        "data-node-id": nodeId,
        "data-node-type": node.type,
        style: computedStyles,
      };
    },
    [
      dragState,
      nodeState.nodes,
      handleDragStart,
      dragDisp,
      nodeDisp,
      isMovingCanvas,
      isFrameModeActive,
      isMoveCanvasMode,
      isTextModeActive,
      setNodeStyle,
      isEditingText,
      setHoverNodeId,
      findDynamicParentInSameViewport,
      isNearEdge,
      interfaceDisp,
      getSelectedIds,
    ]
  );
};

// Add a utility to help with debugging
export const clearConnectCache = () => {
  handlerCache.clear();
  console.log("Connect handler cache cleared");
};
