import { useCallback, useRef } from "react";
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
  useGetNodeStyle,
  getCurrentNodes,
} from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";

export const useConnect = () => {
  const getNodeBasics = useGetNodeBasics();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeSharedInfo = useGetNodeSharedInfo();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();
  const getNodeStyle = useGetNodeStyle();

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
  const currentSelectedIds = useGetSelectedIds();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  const isNearEdge = (
    e: React.MouseEvent,
    element: HTMLElement,
    threshold: number = 2.5
  ) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nearLeft = x <= threshold;
    const nearRight = x >= rect.width - threshold;
    const nearTop = y <= threshold;
    const nearBottom = y >= rect.height - threshold;

    return nearLeft || nearRight || nearTop || nearBottom;
  };

  const getNodeViewportId = (nodeId: NodeId): string | null => {
    const dynamicInfo = getNodeDynamicInfo(nodeId);
    const parentId = getNodeParent(nodeId);

    if (dynamicInfo.dynamicViewportId) {
      return dynamicInfo.dynamicViewportId as string;
    }

    const allNodes = getCurrentNodes();
    return findParentViewport(parentId, allNodes);
  };

  const findDynamicParentInSameViewport = (nodeId: NodeId): NodeId | null => {
    const basics = getNodeBasics(nodeId);
    const flags = getNodeFlags(nodeId);
    const parentId = getNodeParent(nodeId);
    const sharedInfo = getNodeSharedInfo(nodeId);
    const dynamicInfo = getNodeDynamicInfo(nodeId);

    const nodeViewportId = getNodeViewportId(nodeId);
    if (!nodeViewportId) return null;

    if (flags.isDynamic && dynamicInfo.dynamicViewportId === nodeViewportId) {
      return nodeId;
    }

    const allNodes = getCurrentNodes();

    const dynamicNodesInViewport = allNodes.filter(
      (n) => n.isDynamic && n.dynamicViewportId === nodeViewportId
    );

    if (dynamicNodesInViewport.length === 0) return null;

    if (dynamicInfo.dynamicParentId) {
      const directDynamicParent = dynamicNodesInViewport.find(
        (n) => n.id === dynamicInfo.dynamicParentId
      );
      if (directDynamicParent) return directDynamicParent.id;
    }

    let currentId = nodeId;
    let visited = new Set<string | number>();

    while (currentId && getNodeParent(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      const parentId = getNodeParent(currentId);
      if (!parentId) break;

      const parentFlags = getNodeFlags(parentId);
      const parentDynamicInfo = getNodeDynamicInfo(parentId);

      if (
        parentFlags.isDynamic &&
        parentDynamicInfo.dynamicViewportId === nodeViewportId
      ) {
        return parentId;
      }

      currentId = parentId;
    }

    if (sharedInfo.sharedId) {
      for (const dynamicNode of dynamicNodesInViewport) {
        if (dynamicNode.sharedId === sharedInfo.sharedId) {
          return dynamicNode.id;
        }
      }
    }

    if (dynamicInfo.dynamicFamilyId) {
      for (const dynamicNode of dynamicNodesInViewport) {
        if (dynamicNode.dynamicFamilyId === dynamicInfo.dynamicFamilyId) {
          return dynamicNode.id;
        }
      }
    }

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

  return useCallback(
    (nodeId: NodeId) => {
      const flags = getNodeFlags(nodeId);
      const parentId = getNodeParent(nodeId);
      const dynamicInfo = getNodeDynamicInfo(nodeId);

      const style = getNodeStyle(nodeId);

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
        let isDragStarted = false;

        const isAlreadySelected = selectOps.getSelectedIds().includes(nodeId);

        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(nodeId);

        if (!dynamicModeNodeId && dynamicParentInSameViewport) {
          if (!e.shiftKey) {
            setSelectNodeId(dynamicParentInSameViewport);
          } else {
            addToSelection(dynamicParentInSameViewport);
          }
        } else {
          if (isAlreadySelected && selectedIds.length > 1) {
          } else if (e.shiftKey) {
            addToSelection(nodeId);
          } else {
            setSelectNodeId(nodeId);
          }
        }

        if (!isLocked) {
          const handleMouseMove = (moveEvent: MouseEvent) => {
            if (mouseDownPosRef.current && !isDragStarted) {
              const dx = Math.abs(
                moveEvent.clientX - mouseDownPosRef.current.x
              );
              const dy = Math.abs(
                moveEvent.clientY - mouseDownPosRef.current.y
              );

              if (dx > 2 || dy > 2) {
                isDragStarted = true;

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

                  const nodeData = {
                    id: nodeId,
                    ...flags,
                    ...dynamicInfo,
                    parentId,
                    style,
                  };

                  handleDragStart(e, undefined, nodeData);
                }

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
            const dynamicParentInSameViewport =
              findDynamicParentInSameViewport(nodeId);

            if (!dynamicModeNodeId && dynamicParentInSameViewport) {
              if (!e.shiftKey) {
                setSelectNodeId(dynamicParentInSameViewport);
              } else {
                addToSelection(dynamicParentInSameViewport);
              }
            } else {
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

        if (isDynamic) {
          if (!dynamicModeNodeId) {
            updateNodeStyle(nodeId, { position: "absolute" });

            const allNodes = getCurrentNodes();
            const parentViewportId =
              dynamicViewportId ||
              findParentViewport(originalParentId, allNodes) ||
              findParentViewport(parentId, allNodes);

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

        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(nodeId);

        if (dynamicParentInSameViewport) {
          if (!dynamicModeNodeId) {
            // storeDynamicNodeState(dynamicParentInSameViewport);

            updateNodeStyle(dynamicParentInSameViewport, {
              position: "absolute",
            });

            const parentDynamicInfo = getNodeDynamicInfo(
              dynamicParentInSameViewport
            );
            const parentBasics = getNodeBasics(dynamicParentInSameViewport);
            const parentNodeParentId = getNodeParent(
              dynamicParentInSameViewport
            );

            const allNodes = getCurrentNodes();
            const parentViewportId =
              parentDynamicInfo.dynamicViewportId ||
              findParentViewport(
                parentDynamicInfo.originalParentId,
                allNodes
              ) ||
              findParentViewport(parentNodeParentId, allNodes);

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

        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(nodeId);

        const targetNodeId =
          !dynamicModeNodeId && dynamicParentInSameViewport
            ? dynamicParentInSameViewport
            : nodeId;
        const selectedIds = currentSelectedIds();

        const isNodeSelected = selectedIds.includes(targetNodeId);

        if (!isNodeSelected && !e.shiftKey) {
          clearSelection();
          setSelectNodeId(targetNodeId);
        } else if (!isNodeSelected && e.shiftKey) {
          addToSelection(targetNodeId);
        }

        contextMenuOps.setContextMenu(
          e.clientX,
          e.clientY,
          targetNodeId as string
        );
      };

      const handleMouseOver = (e: React.MouseEvent) => {
        const dragSource = getDragSource();
        const isMovingCanvas = getMovingCanvas();

        if (e.target === e.currentTarget && !dragSource && !isMovingCanvas) {
          const nodeViewportId = getNodeViewportId(nodeId);

          const dynamicParentInSameViewport =
            findDynamicParentInSameViewport(nodeId);

          if (dynamicModeNodeId) {
            requestAnimationFrame(() => {
              setHoverNodeId(nodeId);
            });
          } else if (isDynamic) {
            requestAnimationFrame(() => {
              setHoverNodeId(nodeId);
            });
          } else if (dynamicParentInSameViewport) {
            requestAnimationFrame(() => {
              setHoverNodeId(dynamicParentInSameViewport);
            });
          } else {
            requestAnimationFrame(() => {
              setHoverNodeId(nodeId);
            });
          }
        }
      };

      const handleMouseOut = (e: React.MouseEvent) => {
        const hoveredNodeId = getHoverNodeId();
        if (e.target === e.currentTarget) {
          const currentHoverId = hoveredNodeId;
          console.log("moussing out");

          const dynamicParentInSameViewport =
            findDynamicParentInSameViewport(nodeId);

          if (currentHoverId === nodeId) {
            setHoverNodeId(null);
          } else if (dynamicModeNodeId) {
            setHoverNodeId(null);
          } else if (
            dynamicParentInSameViewport &&
            currentHoverId !== dynamicParentInSameViewport
          ) {
            setHoverNodeId(null);
          }

          setHoverNodeId(null);
        }
      };

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
      getIsFrameModeActive,
      getIsMoveCanvasMode,
      getIsTextModeActive,
      getIsEditingText,
      setHoverNodeId,
      getDynamicModeNodeId,
    ]
  );
};
