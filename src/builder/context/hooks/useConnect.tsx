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
import { dynamicOps, useDynamicModeNodeId } from "../atoms/dynamic-store";
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
  const dynamicModeNodeId = useDynamicModeNodeId();

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

      const findTopLevelDynamicParent = (nodeId: NodeId): NodeId | null => {
        const dynamicInfo = getNodeDynamicInfo(nodeId);

        // If this node has a dynamicFamilyId but is NOT a top-level dynamic node
        if (dynamicInfo.dynamicFamilyId && !dynamicInfo.isTopLevelDynamicNode) {
          const allNodes = getCurrentNodes();
          const topLevelParent = allNodes.find(
            (node) =>
              node.isDynamic &&
              node.dynamicFamilyId === dynamicInfo.dynamicFamilyId &&
              node.isTopLevelDynamicNode === true
          );

          return topLevelParent ? topLevelParent.id : null;
        }

        return null;
      };

      const handleMouseDown = (e: React.MouseEvent) => {
        const selectedIds = currentSelectedIds();
        const isMoveCanvasMode = getIsMoveCanvasMode();
        const isTextModeActive = getIsTextModeActive();
        const isEditingText = getIsEditingText();
        const isFrameModeActive = getIsFrameModeActive();

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

        // Check if we should select the top-level dynamic parent instead
        let targetNodeId = nodeId;
        if (!dynamicModeNodeId) {
          const topLevelParent = findTopLevelDynamicParent(nodeId);
          if (topLevelParent) {
            targetNodeId = topLevelParent;
          }
        }

        const isAlreadySelected = selectOps
          .getSelectedIds()
          .includes(targetNodeId);

        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(targetNodeId);

        if (!dynamicModeNodeId && dynamicParentInSameViewport) {
          if (!e.shiftKey) {
            setSelectNodeId(dynamicParentInSameViewport);
          } else {
            addToSelection(dynamicParentInSameViewport);
          }
        } else {
          if (isAlreadySelected && selectedIds.length > 1) {
            // Do nothing on initial click if already selected in multi-selection
          } else if (e.shiftKey) {
            addToSelection(targetNodeId);
          } else {
            setSelectNodeId(targetNodeId);
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

                  // Check if we should drag the top-level dynamic parent instead
                  let dragNodeId = nodeId;
                  let dragFlags = flags;
                  let dragDynamicInfo = dynamicInfo;
                  let dragParentId = parentId;
                  let dragStyle = style;

                  if (!dynamicModeNodeId) {
                    const topLevelParent = findTopLevelDynamicParent(nodeId);
                    if (topLevelParent) {
                      console.log(
                        "Redirecting drag to top-level parent:",
                        topLevelParent
                      );
                      dragNodeId = topLevelParent;
                      dragFlags = getNodeFlags(topLevelParent);
                      dragDynamicInfo = getNodeDynamicInfo(topLevelParent);
                      dragParentId = getNodeParent(topLevelParent);
                      dragStyle = getNodeStyle(topLevelParent);
                    }
                  }

                  const nodeData = {
                    id: dragNodeId,
                    ...dragFlags,
                    ...dragDynamicInfo,
                    parentId: dragParentId,
                    style: dragStyle,
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
            // Check if we should select the top-level dynamic parent instead
            let targetNodeId = nodeId;
            if (!dynamicModeNodeId) {
              const topLevelParent = findTopLevelDynamicParent(nodeId);
              if (topLevelParent) {
                targetNodeId = topLevelParent;
              }
            }

            const dynamicParentInSameViewport =
              findDynamicParentInSameViewport(targetNodeId);

            if (!dynamicModeNodeId && dynamicParentInSameViewport) {
              if (!e.shiftKey) {
                setSelectNodeId(dynamicParentInSameViewport);
              } else {
                addToSelection(dynamicParentInSameViewport);
              }
            } else {
              if (!e.shiftKey) {
                setSelectNodeId(targetNodeId);
              } else {
                addToSelection(targetNodeId);
              }
            }
          }
        }

        mouseDownPosRef.current = null;
      };

      const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        console.log("Double click on node:", nodeId);

        // Check if we should handle double-click on the top-level dynamic parent instead
        let targetNodeId = nodeId;
        let targetDynamicInfo = dynamicInfo;
        let targetIsDynamic = isDynamic;

        if (!dynamicModeNodeId) {
          const topLevelParent = findTopLevelDynamicParent(nodeId);
          if (topLevelParent) {
            targetNodeId = topLevelParent;
            targetDynamicInfo = getNodeDynamicInfo(topLevelParent);
            const targetFlags = getNodeFlags(topLevelParent);
            targetIsDynamic = targetFlags.isDynamic || false;
            console.log(
              "Redirecting double-click to top-level parent:",
              topLevelParent
            );
          }
        }

        if (targetIsDynamic) {
          if (!dynamicModeNodeId) {
            console.log("Node is dynamic, setting as dynamic mode node");

            // Find parent viewport
            const allNodes = getCurrentNodes();
            const targetParentId = getNodeParent(targetNodeId);
            const parentViewportId =
              targetDynamicInfo.dynamicViewportId ||
              findParentViewport(
                targetDynamicInfo.originalParentId,
                allNodes
              ) ||
              findParentViewport(targetParentId, allNodes);

            if (parentViewportId) {
              console.log(`Setting active viewport to: ${parentViewportId}`);
              dynamicOps.switchDynamicViewport(parentViewportId);
            } else {
              console.warn(
                "Could not determine viewport for node:",
                targetNodeId
              );
              dynamicOps.switchDynamicViewport("viewport-1440");
            }

            // Get the family ID to identify all related dynamic nodes
            const familyId = targetDynamicInfo.dynamicFamilyId;

            if (familyId) {
              // Find all related dynamic nodes that are marked as top-level
              const topLevelNodes = allNodes.filter(
                (node) =>
                  node.isDynamic &&
                  node.dynamicFamilyId === familyId &&
                  node.isTopLevelDynamicNode === true
              );

              console.log(
                `Found ${topLevelNodes.length} top-level dynamic nodes in the same family`
              );

              // IMPORTANT: First store all original positions BEFORE making any detachment
              topLevelNodes.forEach((node) => {
                console.log(
                  `Storing original position for top-level node: ${node.id}`
                );
                // Store the current state (with the original position and parent)
                dynamicOps.storeDynamicNodeState(node.id);
              });

              // Now AFTER storing, detach only the top-level dynamic nodes
              topLevelNodes.forEach((node) => {
                console.log(
                  `Detaching top-level node for dynamic mode: ${node.id}`
                );
                // Detach from parent and set as absolute position
                dynamicOps.detachNodeForDynamicMode(node.id);
              });
            } else {
              // If no family ID, just handle the current node
              console.log(
                "No family ID found, checking if current node is top-level"
              );

              // Check if this node is a top-level dynamic node
              if (targetDynamicInfo.isTopLevelDynamicNode) {
                // IMPORTANT: First store original position BEFORE detaching
                dynamicOps.storeDynamicNodeState(targetNodeId);
                // Detach node from parent for dynamic mode
                dynamicOps.detachNodeForDynamicMode(targetNodeId);
              } else {
                console.log("Node is not marked as top-level, not detaching");
              }
            }

            // Finally set the dynamic mode node ID
            dynamicOps.setDynamicModeNodeId(targetNodeId, parentViewportId);
          }
          return;
        }

        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(targetNodeId);

        if (dynamicParentInSameViewport && !dynamicModeNodeId) {
          console.log("Found dynamic parent:", dynamicParentInSameViewport);

          const parentDynamicInfo = getNodeDynamicInfo(
            dynamicParentInSameViewport
          );
          const parentNodeParentId = getNodeParent(dynamicParentInSameViewport);

          const allNodes = getCurrentNodes();
          const parentViewportId =
            parentDynamicInfo.dynamicViewportId ||
            findParentViewport(parentDynamicInfo.originalParentId, allNodes) ||
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

          // Get the family ID to identify all related dynamic nodes
          const familyId = parentDynamicInfo.dynamicFamilyId;

          if (familyId) {
            // Find only top-level dynamic nodes with the isTopLevelDynamicNode flag
            const topLevelNodes = allNodes.filter(
              (node) =>
                node.isDynamic &&
                node.dynamicFamilyId === familyId &&
                node.isTopLevelDynamicNode === true
            );

            console.log(
              `Found ${topLevelNodes.length} top-level dynamic nodes in the same family`
            );

            // IMPORTANT: First store all original positions BEFORE making any detachment
            topLevelNodes.forEach((node) => {
              console.log(
                `Storing original position for top-level node: ${node.id}`
              );
              // Store the current state (with the original position and parent)
              dynamicOps.storeDynamicNodeState(node.id);
            });

            // Now AFTER storing, detach only the top-level dynamic nodes
            topLevelNodes.forEach((node) => {
              console.log(
                `Detaching top-level node for dynamic mode: ${node.id}`
              );
              // Detach from parent and set as absolute position
              dynamicOps.detachNodeForDynamicMode(node.id);
            });
          } else {
            // If no family ID, check if this node is top-level
            console.log("No family ID found, checking if parent is top-level");

            // Check if the dynamic parent is a top-level dynamic node
            if (parentDynamicInfo.isTopLevelDynamicNode) {
              // IMPORTANT: First store original position BEFORE detaching
              dynamicOps.storeDynamicNodeState(dynamicParentInSameViewport);
              // Detach node from parent for dynamic mode
              dynamicOps.detachNodeForDynamicMode(dynamicParentInSameViewport);
            } else {
              console.log("Parent is not marked as top-level, not detaching");
            }
          }

          // Finally set the dynamic mode node ID
          dynamicOps.setDynamicModeNodeId(
            dynamicParentInSameViewport,
            parentViewportId
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

        // Check if we should select the top-level dynamic parent instead
        let targetNodeId = nodeId;
        if (!dynamicModeNodeId) {
          const topLevelParent = findTopLevelDynamicParent(nodeId);
          if (topLevelParent) {
            targetNodeId = topLevelParent;
          }
        }

        const dynamicParentInSameViewport =
          findDynamicParentInSameViewport(targetNodeId);

        const finalTargetNodeId =
          !dynamicModeNodeId && dynamicParentInSameViewport
            ? dynamicParentInSameViewport
            : targetNodeId;

        const selectedIds = currentSelectedIds();
        const isNodeSelected = selectedIds.includes(finalTargetNodeId);

        if (!isNodeSelected && !e.shiftKey) {
          clearSelection();
          setSelectNodeId(finalTargetNodeId);
        } else if (!isNodeSelected && e.shiftKey) {
          addToSelection(finalTargetNodeId);
        }

        contextMenuOps.setContextMenu(
          e.clientX,
          e.clientY,
          finalTargetNodeId as string
        );
      };

      const handleMouseOver = (e: React.MouseEvent) => {
        const dragSource = getDragSource();
        const isMovingCanvas = getMovingCanvas();

        if (e.target === e.currentTarget && !dragSource && !isMovingCanvas) {
          // If NOT in dynamic mode, check if this node is a child of a dynamic node
          if (!dynamicModeNodeId) {
            const dynamicInfo = getNodeDynamicInfo(nodeId);

            // Check if this node has a dynamicFamilyId but is NOT a top-level dynamic node
            if (
              dynamicInfo.dynamicFamilyId &&
              !dynamicInfo.isTopLevelDynamicNode
            ) {
              // Find the top-level dynamic parent in the same family
              const allNodes = getCurrentNodes();
              const topLevelParent = allNodes.find(
                (node) =>
                  node.isDynamic &&
                  node.dynamicFamilyId === dynamicInfo.dynamicFamilyId &&
                  node.isTopLevelDynamicNode === true
              );

              if (topLevelParent) {
                // Transfer hover to the top-level dynamic parent
                requestAnimationFrame(() => {
                  setHoverNodeId(topLevelParent.id);
                });
                return;
              }
            }
          }

          // Original hover logic for other cases
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

          // If NOT in dynamic mode, check if we need to handle dynamic family hover
          if (!dynamicModeNodeId) {
            const dynamicInfo = getNodeDynamicInfo(nodeId);

            // If this is a child of a dynamic node (not top-level)
            if (
              dynamicInfo.dynamicFamilyId &&
              !dynamicInfo.isTopLevelDynamicNode
            ) {
              // Find the top-level dynamic parent
              const allNodes = getCurrentNodes();
              const topLevelParent = allNodes.find(
                (node) =>
                  node.isDynamic &&
                  node.dynamicFamilyId === dynamicInfo.dynamicFamilyId &&
                  node.isTopLevelDynamicNode === true
              );

              // Clear hover if the current hover is the top-level parent
              if (topLevelParent && currentHoverId === topLevelParent.id) {
                setHoverNodeId(null);
                return;
              }
            }
          }

          // Original mouse out logic
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
      dynamicModeNodeId,
    ]
  );
};
