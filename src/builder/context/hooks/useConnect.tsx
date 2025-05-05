import { useCallback, useRef } from "react";
import { useBuilderDynamic } from "@/builder/context/builderState";
import { useDragStart } from "../dnd/useDragStart";
import { findParentViewport } from "../utils";
import { hoverOps, useGetHoveredNodeId } from "../atoms/hover-store";
import { selectOps, useGetSelectedIds } from "../atoms/select-store";
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
import {
  NodeId,
  useGetNodeBasics,
  useGetNodeFlags,
  useGetNodeParent,
  useGetNodeSharedInfo,
  useGetNodeDynamicInfo,
} from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";

export const useConnect = () => {
  // Use the basic useBuilder hook without global subscriptions
  const { nodeState, nodeDisp } = useBuilderDynamic();

  // console.log(`Use Connect re-rendering`, new Date().getTime());

  // Get getter functions for node data
  const getNodeBasics = useGetNodeBasics();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeSharedInfo = useGetNodeSharedInfo();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();

  const handleDragStart = useDragStart();

  // const handleDragStart = useDragStart();
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
  const getNodeViewportId = (nodeId: NodeId): string | null => {
    // Get node flags to check for dynamic info
    const dynamicInfo = getNodeDynamicInfo(nodeId);
    const parentId = getNodeParent(nodeId);

    // First check explicit dynamicViewportId
    if (dynamicInfo.dynamicViewportId) {
      return dynamicInfo.dynamicViewportId as string;
    }

    // Then check parent chain
    return findParentViewport(parentId, nodeState.nodes);
  };

  // Find the top-level dynamic parent in the same viewport as the node
  const findDynamicParentInSameViewport = (nodeId: NodeId): NodeId | null => {
    // Get basic node info
    const basics = getNodeBasics(nodeId);
    const flags = getNodeFlags(nodeId);
    const parentId = getNodeParent(nodeId);
    const sharedInfo = getNodeSharedInfo(nodeId);
    const dynamicInfo = getNodeDynamicInfo(nodeId);

    // Get the viewport for this node
    const nodeViewportId = getNodeViewportId(nodeId);
    if (!nodeViewportId) return null;

    // If node itself is dynamic and in this viewport, return it
    if (flags.isDynamic && dynamicInfo.dynamicViewportId === nodeViewportId) {
      return nodeId;
    }

    // Get all dynamic nodes in this specific viewport
    const dynamicNodesInViewport = nodeState.nodes.filter(
      (n) => n.isDynamic && n.dynamicViewportId === nodeViewportId
    );

    if (dynamicNodesInViewport.length === 0) return null;

    // Try to find a direct dynamic parent reference
    if (dynamicInfo.dynamicParentId) {
      const directDynamicParent = dynamicNodesInViewport.find(
        (n) => n.id === dynamicInfo.dynamicParentId
      );
      if (directDynamicParent) return directDynamicParent.id;
    }

    // Try to find a parent in the node hierarchy
    let currentId = nodeId;
    let visited = new Set<string | number>();

    while (currentId && getNodeParent(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      const parentId = getNodeParent(currentId);
      if (!parentId) break;

      const parentFlags = getNodeFlags(parentId);
      const parentDynamicInfo = getNodeDynamicInfo(parentId);

      // Check if this parent is dynamic and in the same viewport
      if (
        parentFlags.isDynamic &&
        parentDynamicInfo.dynamicViewportId === nodeViewportId
      ) {
        return parentId;
      }

      currentId = parentId;
    }

    // If no direct parent is found, try other relationships
    // First by sharedId
    if (sharedInfo.sharedId) {
      for (const dynamicNode of dynamicNodesInViewport) {
        if (dynamicNode.sharedId === sharedInfo.sharedId) {
          return dynamicNode.id;
        }
      }
    }

    // Then by dynamicFamilyId
    if (dynamicInfo.dynamicFamilyId) {
      for (const dynamicNode of dynamicNodesInViewport) {
        if (dynamicNode.dynamicFamilyId === dynamicInfo.dynamicFamilyId) {
          return dynamicNode.id;
        }
      }
    }

    // Finally by variantResponsiveId
    if (dynamicInfo.variantResponsiveId) {
      for (const dynamicNode of dynamicNodesInViewport) {
        if (
          dynamicNode.variantResponsiveId === dynamicInfo.variantResponsiveId
        ) {
          return dynamicNode.id;
        }
      }
    }

    return null;
  };

  const currentSelectedIds = useGetSelectedIds();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  return useCallback(
    (nodeId: NodeId) => {
      // Get node basic info from atoms
      const flags = getNodeFlags(nodeId);
      const parentId = getNodeParent(nodeId);
      const dynamicInfo = getNodeDynamicInfo(nodeId);
      const style = nodeState.nodes.find((n) => n.id === nodeId)?.style || {};

      // Extract commonly used flags
      const { isLocked, isDynamic } = flags;
      const {
        originalParentId,
        dynamicParentId,
        dynamicViewportId,
        variantResponsiveId,
      } = dynamicInfo;

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
        let isDragStarted = false; // Track if drag has been started

        const isAlreadySelected = selectOps.getSelectedIds().includes(nodeId);

        // Find the dynamic parent in the same viewport
        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(nodeId);

        // Handle selection based on if we're in dynamic mode
        if (!dynamicModeNodeId && dynamicParentInSameViewport) {
          // If not in dynamic mode and we have a viewport-specific dynamic parent, select it
          if (!e.shiftKey) {
            setSelectNodeId(dynamicParentInSameViewport);
          } else {
            addToSelection(dynamicParentInSameViewport);
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
        if (!isLocked) {
          const handleMouseMove = (moveEvent: MouseEvent) => {
            if (mouseDownPosRef.current && !isDragStarted) {
              const dx = Math.abs(
                moveEvent.clientX - mouseDownPosRef.current.x
              );
              const dy = Math.abs(
                moveEvent.clientY - mouseDownPosRef.current.y
              );

              // Increase threshold to prevent accidental dragging
              if (dx > 2 || dy > 2) {
                isDragStarted = true;

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
                  // Create minimal node object with necessary properties
                  const nodeData = {
                    id: nodeId,
                    ...flags,
                    ...dynamicInfo,
                    parentId,
                    style,
                  };
                  // Use the new rules-based drag start
                  handleDragStart(e, undefined, nodeData);
                }

                // Remove this listener once drag is started
                window.removeEventListener("mousemove", handleMouseMove);
              }
            }
          };

          const handleMouseUp = () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            mouseDownPosRef.current = null;
            isDragStarted = false;
          };

          mouseMoveHandlerRef.current = handleMouseMove;
          window.addEventListener("mousemove", handleMouseMove);
          window.addEventListener("mouseup", handleMouseUp);
        }
      };

      const handleMouseUp = (e: React.MouseEvent) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (mouseMoveHandlerRef.current) {
          window.removeEventListener("mousemove", mouseMoveHandlerRef.current);
          window.removeEventListener("mouseup", handleMouseUp);
          mouseMoveHandlerRef.current = null;
        }

        if (mouseDownPosRef.current) {
          const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
          const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);

          if (dx < 5 && dy < 5) {
            // Find the dynamic parent in the same viewport
            const dynamicParentInSameViewport =
              findDynamicParentInSameViewport(nodeId);

            if (!dynamicModeNodeId && dynamicParentInSameViewport) {
              // If not in dynamic mode and we have a viewport-specific dynamic parent, select it
              if (!e.shiftKey) {
                setSelectNodeId(dynamicParentInSameViewport);
              } else {
                addToSelection(dynamicParentInSameViewport);
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
      };

      const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // First check if this node is already dynamic
        if (isDynamic) {
          if (!dynamicModeNodeId) {
            // Store dynamic state for this node
            nodeDisp.storeDynamicNodeState(nodeId);

            // Use updateNodeStyle instead of setNodeStyle
            updateNodeStyle(nodeId, { position: "absolute" });

            // Determine the correct viewport ID
            const parentViewportId =
              dynamicViewportId ||
              findParentViewport(originalParentId, nodeState.nodes) ||
              findParentViewport(parentId, nodeState.nodes);

            if (parentViewportId) {
              console.log(`Setting active viewport to: ${parentViewportId}`);
              dynamicOps.switchDynamicViewport(parentViewportId);
            } else {
              console.warn("Could not determine viewport for node:", nodeId);
              dynamicOps.switchDynamicViewport("viewport-1440");
            }

            dynamicOps.setDynamicModeNodeId(nodeId);
          }
          return;
        }

        // Find dynamic parent in the same viewport
        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(nodeId);

        if (dynamicParentInSameViewport) {
          if (!dynamicModeNodeId) {
            // Store dynamic state for this node
            nodeDisp.storeDynamicNodeState(dynamicParentInSameViewport);

            // Use updateNodeStyle instead of setNodeStyle
            updateNodeStyle(dynamicParentInSameViewport, {
              position: "absolute",
            });

            // Get dynamic parent data
            const parentDynamicInfo = getNodeDynamicInfo(
              dynamicParentInSameViewport
            );
            const parentBasics = getNodeBasics(dynamicParentInSameViewport);
            const parentNodeParentId = getNodeParent(
              dynamicParentInSameViewport
            );

            // Determine the correct viewport ID
            const parentViewportId =
              parentDynamicInfo.dynamicViewportId ||
              findParentViewport(
                parentDynamicInfo.originalParentId,
                nodeState.nodes
              ) ||
              findParentViewport(parentNodeParentId, nodeState.nodes);

            if (parentViewportId) {
              console.log(`Setting active viewport to: ${parentViewportId}`);
              dynamicOps.switchDynamicViewport(parentViewportId);
            } else {
              console.warn(
                "Could not determine viewport for node:",
                dynamicParentInSameViewport
              );
              dynamicOps.switchDynamicViewport("viewport-1440");
            }

            dynamicOps.setDynamicModeNodeId(dynamicParentInSameViewport);
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
          findDynamicParentInSameViewport(nodeId);

        // Determine target node for context menu
        const targetNodeId =
          !dynamicModeNodeId && dynamicParentInSameViewport
            ? dynamicParentInSameViewport
            : nodeId;
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
          const nodeViewportId = getNodeViewportId(nodeId);

          // Find dynamic parent in this specific viewport
          const dynamicParentInSameViewport =
            findDynamicParentInSameViewport(nodeId);

          if (dynamicModeNodeId) {
            // In dynamic mode, hover over the actual node
            requestAnimationFrame(() => {
              setHoverNodeId(nodeId);
            });
          } else if (isDynamic) {
            // For dynamic nodes themselves, hover on the node
            requestAnimationFrame(() => {
              setHoverNodeId(nodeId);
            });
          } else if (dynamicParentInSameViewport) {
            // If this is a child of a dynamic node, hover on the parent in the same viewport
            requestAnimationFrame(() => {
              setHoverNodeId(dynamicParentInSameViewport);
            });
          } else {
            // Regular node - hover on itself
            requestAnimationFrame(() => {
              setHoverNodeId(nodeId);
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
            findDynamicParentInSameViewport(nodeId);

          // Only clear hover in specific cases:

          // Case 1: We're currently hovering this exact node
          if (currentHoverId === nodeId) {
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
            currentHoverId !== dynamicParentInSameViewport
          ) {
            setHoverNodeId(null);
          }

          // Otherwise keep the hover (especially when it's on the dynamic parent)
          setHoverNodeId(null);
        }
      };

      // Get style for border handling
      const { border, borderWidth, borderStyle, borderColor, ...otherStyles } =
        style;

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
            border-radius: ${style.borderRadius || 0};
            pointer-events: none;
            z-index: 1;
            box-sizing: border-box;
          }
        `;
      }

      return {
        "data-node-id": nodeId,
        "data-node-type": getNodeBasics(nodeId).type,
        onMouseDown: handleMouseDown,
        onMouseUp: handleMouseUp,
        onDoubleClick: handleDoubleClick,
        onContextMenu: handleContextMenu,
        onMouseOver: handleMouseOver,
        onMouseOut: handleMouseOut,
        draggable: false,
      };
    },
    [
      nodeDisp,
      getIsFrameModeActive,
      getIsMoveCanvasMode,
      getIsTextModeActive,
      getIsEditingText,
      setHoverNodeId,
      nodeState.nodes,
    ]
  );
};
