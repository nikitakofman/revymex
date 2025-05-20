import { useGetTransform } from "../atoms/canvas-interaction-store";
import {
  dragOps,
  useGetDraggedNodes,
  useGetIsOverCanvas,
  useGetDragSource,
  useGetDropInfo,
} from "../atoms/drag-store";
import {
  useGetNodeParent,
  useGetNodeChildren,
} from "../atoms/node-store/hierarchy-store";
import {
  moveNode,
  removeNode,
  insertAtIndex,
} from "../atoms/node-store/operations/insert-operations";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";
import { updateNodeFlags } from "../atoms/node-store/operations/update-operations";
import { useBuilderRefs } from "@/builder/context/builderState";
import { visualOps } from "../atoms/visual-store";
import { syncViewports } from "../atoms/node-store/operations/sync-operations";
import {
  getCurrentNodes,
  useGetNodeStyle,
  useGetNodeFlags,
} from "../atoms/node-store";
import {
  restoreOriginalDimensions,
  getDraggedNodesPositions,
  restoreDimensionsForDraggedNodes,
} from "./dnd-utils";
import { snapOps } from "../atoms/snap-guides-store";
import { useGetDynamicModeNodeId } from "../atoms/dynamic-store";

export const useMouseUp = () => {
  const getDraggedNodes = useGetDraggedNodes();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getIsOverCanvas = useGetIsOverCanvas();
  const getTransform = useGetTransform();
  const getDragSource = useGetDragSource();
  const getDropInfo = useGetDropInfo();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  const { containerRef, transitioningToCanvasRef, transitioningToParentRef } =
    useBuilderRefs();

  function getDraggedInOriginalOrder() {
    const draggedNodes = getDraggedNodes();
    const placeholderInfo = dragOps.getState().placeholderInfo;

    if (!placeholderInfo?.nodeOrder || draggedNodes.length <= 1) {
      return draggedNodes;
    }

    const order = placeholderInfo.nodeOrder;
    return order
      .map((id) => draggedNodes.find((d) => d.node.id === id))
      .filter(Boolean) as typeof draggedNodes;
  }

  /**
   * Returns the dragged nodes sorted by their visual position
   * rather than selection / DOM order.
   */
  function getDraggedInVisualOrder(flexDir: string) {
    const dragged = getDraggedNodes();

    const rects = dragged.map((d) => {
      const el = document.querySelector(
        `[data-node-id="${d.node.id}"]`
      ) as HTMLElement | null;
      const { left = 0, top = 0 } = el?.getBoundingClientRect() ?? {};
      return { d, left, top };
    });

    const isRow = flexDir.startsWith("row");
    rects.sort((a, b) => (isRow ? a.left - b.left : a.top - b.top));

    if (flexDir.endsWith("reverse")) rects.reverse();

    return rects.map((r) => r.d);
  }

  return (e: MouseEvent) => {
    const draggedNodes = getDraggedNodes();
    if (draggedNodes.length === 0) return;

    // Get dynamic mode state
    const dynamicModeNodeId = getDynamicModeNodeId
      ? getDynamicModeNodeId()
      : null;
    const isInDynamicMode = !!dynamicModeNodeId;

    const primaryNode = draggedNodes[0];
    const isMultiDrag = draggedNodes.length > 1;

    const isOverCanvas = getIsOverCanvas();
    const dragSource = getDragSource();
    const dropInfo = getDropInfo();
    const draggedNodeId = primaryNode.node.id;
    const isAbsoluteInFrame = primaryNode.offset.isAbsoluteInFrame;
    const startingParentId = primaryNode.offset.startingParentId;

    const targetId = dropInfo?.targetId?.toString();
    const targetEl = targetId
      ? (document.querySelector(
          `[data-node-id="${targetId}"]`
        ) as HTMLElement | null)
      : null;
    const targetStyles = targetEl ? window.getComputedStyle(targetEl) : null;
    const targetIsFlex =
      targetStyles && /(flex|inline-flex)/.test(targetStyles.display);
    const flexDir = targetIsFlex ? targetStyles.flexDirection || "row" : null;

    const allNodes = getCurrentNodes();
    const draggedNodeData = allNodes.find((n) => n.id === draggedNodeId);

    // Check if this is a dynamic variant
    const isDynamicVariant =
      draggedNodeData?.isVariant && draggedNodeData?.isDynamic;

    console.log(
      "Mouse up - Dynamic mode:",
      isInDynamicMode,
      "Is variant:",
      isDynamicVariant
    );

    const allNodePositions = getDraggedNodesPositions(draggedNodes);

    const placeholderInfo = dragOps.getState().placeholderInfo;
    const allPlaceholderIds =
      placeholderInfo?.additionalPlaceholders?.map((p) => p.placeholderId) ||
      [];

    const hasMultiplePlaceholders = allPlaceholderIds.length > 1;

    const dragStartingParent =
      primaryNode.offset.startingParentId || getNodeParent(draggedNodeId);
    const dragStartingViewport = findTopViewport(dragStartingParent);
    const isDraggingFromViewport = !!dragStartingViewport;

    // Skip all canvas drop operations if in dynamic mode and handling a variant
    if (isInDynamicMode && isDynamicVariant && isOverCanvas) {
      console.log("Skipping canvas drop for dynamic variant");

      // Just update the visual style without moving the node
      draggedNodes.forEach((draggedNode) => {
        const nodeId = draggedNode.node.id;
        const nodePosition = allNodePositions[nodeId];

        if (nodePosition) {
          // Apply visual style changes only
          updateNodeStyle(
            nodeId,
            {
              position: "absolute",
              left: nodePosition.left,
              top: nodePosition.top,
            },
            { dontSync: true }
          );
        }
      });

      // Clean up any placeholders
      if (primaryNode.offset.placeholderId) {
        removeNode(primaryNode.offset.placeholderId);

        if (hasMultiplePlaceholders) {
          allPlaceholderIds.forEach((id) => {
            if (id !== primaryNode.offset.placeholderId) {
              removeNode(id);
            }
          });
        }
      }

      // Reset drag state
      resetDragState();
      return;
    }

    if (dragSource === "absolute-in-frame" && startingParentId) {
      const { activeSnapPoints } = snapOps.getState();

      const ordered = getDraggedInOriginalOrder();
      ordered.forEach((nodeInfo) => {
        const nodeId = nodeInfo.node.id;
        const nodePosition = allNodePositions[nodeId];

        if (nodePosition) {
          let finalX = parseInt(nodePosition.left, 10);
          let finalY = parseInt(nodePosition.top, 10);

          if (nodeId === primaryNode.node.id) {
            if (
              activeSnapPoints.horizontal &&
              activeSnapPoints.horizontal.edge === "left" &&
              Math.abs(finalX - activeSnapPoints.horizontal.position) <= 5
            ) {
              finalX = Math.round(activeSnapPoints.horizontal.position);
            }

            if (
              activeSnapPoints.vertical &&
              activeSnapPoints.vertical.edge === "top" &&
              Math.abs(finalY - activeSnapPoints.vertical.position) <= 5
            ) {
              finalY = Math.round(activeSnapPoints.vertical.position);
            }
          }

          updateNodeStyle(
            nodeId,
            {
              position: nodeInfo.offset.originalPositionType || "absolute",
              left: `${finalX}px`,
              top: `${finalY}px`,
              isAbsoluteInFrame: "true",
            },
            { dontSync: true }
          );

          if (nodeInfo.offset.dimensionUnits) {
            restoreOriginalDimensions(nodeId, nodeInfo.offset.dimensionUnits);
          }
        }
      });

      if (primaryNode.offset.placeholderId) {
        removeNode(primaryNode.offset.placeholderId);

        if (hasMultiplePlaceholders) {
          allPlaceholderIds.forEach((id) => {
            if (id !== primaryNode.offset.placeholderId) {
              removeNode(id);
            }
          });
        }
      }

      resetDragState();
      return;
    }

    if (dragSource === "canvas" && dropInfo?.targetId && dropInfo.position) {
      const targetId = dropInfo.targetId.toString();

      const isTargetInViewport = checkIsViewportOperation(
        targetId,
        getNodeParent
      );

      if (dropInfo.position === "inside") {
        const ordered =
          targetIsFlex && dragSource === "canvas"
            ? getDraggedInVisualOrder(flexDir!)
            : getDraggedInOriginalOrder();

        ordered.forEach((nodeInfo) => {
          moveNode(nodeInfo.node.id, targetId);
        });

        if (isTargetInViewport) {
          ordered.forEach((nodeInfo) => {
            updateNodeStyle(
              nodeInfo.node.id,
              {
                position: "relative",
                left: "",
                top: "",
                zIndex: "",
                isAbsoluteInFrame: "false",
              },
              { dontSync: true }
            );
          });

          ordered.forEach((nodeInfo) => {
            syncViewports(nodeInfo.node.id, targetId);
          });
        } else {
          ordered.forEach((nodeInfo) => {
            updateNodeStyle(
              nodeInfo.node.id,
              {
                position: "relative",
                left: "",
                top: "",
                zIndex: "",
                isAbsoluteInFrame: "false",
              },
              { dontSync: true }
            );
          });
        }

        restoreDimensionsForDraggedNodes(draggedNodes);
      } else {
        const targetParentId = getNodeParent(targetId);
        if (!targetParentId) {
          handleCanvasDropForNodes(
            e,
            draggedNodes,
            containerRef,
            getTransform,
            allNodePositions,
            isDraggingFromViewport,
            isInDynamicMode,
            isDynamicVariant
          );

          if (isDraggingFromViewport && draggedNodeData?.sharedId) {
            const ordered = getDraggedInOriginalOrder();
            ordered.forEach((nodeInfo) => {
              const nodeData = allNodes.find((n) => n.id === nodeInfo.node.id);
              if (nodeData?.sharedId) {
                syncViewports(
                  nodeInfo.node.id,
                  dragStartingViewport || dragStartingParent
                );
              }
            });
          }
        } else {
          const siblings = getNodeChildren(targetParentId);
          const targetIndex = siblings.indexOf(targetId);

          const insertIndex =
            dropInfo.position === "after" ? targetIndex + 1 : targetIndex;

          const parentEl = document.querySelector(
            `[data-node-id="${targetParentId}"]`
          ) as HTMLElement | null;
          const parentStyles = parentEl
            ? window.getComputedStyle(parentEl)
            : null;
          const parentIsFlex =
            parentStyles && /(flex|inline-flex)/.test(parentStyles.display);
          const parentFlexDir = parentIsFlex
            ? parentStyles.flexDirection || "row"
            : null;

          const ordered =
            parentIsFlex && dragSource === "canvas"
              ? getDraggedInVisualOrder(parentFlexDir!)
              : getDraggedInOriginalOrder();

          ordered.forEach((nodeInfo, i) => {
            insertAtIndex(nodeInfo.node.id, targetParentId, insertIndex + i);
          });

          const isInViewport = checkIsViewportOperation(
            targetParentId,
            getNodeParent
          );

          if (isInViewport) {
            ordered.forEach((nodeInfo) => {
              updateNodeStyle(
                nodeInfo.node.id,
                {
                  position: "relative",
                  left: "",
                  top: "",
                  zIndex: "",
                  isAbsoluteInFrame: "false",
                },
                { dontSync: true }
              );
            });

            ordered.forEach((nodeInfo, i) => {
              syncViewports(nodeInfo.node.id, targetParentId, insertIndex + i);
            });
          } else {
            ordered.forEach((nodeInfo) => {
              updateNodeStyle(
                nodeInfo.node.id,
                {
                  position: "relative",
                  left: "",
                  top: "",
                  zIndex: "",
                  isAbsoluteInFrame: "false",
                },
                { dontSync: true }
              );
            });
          }

          const inViewport = isNodeInViewport(targetParentId, getNodeParent);
          ordered.forEach((nodeInfo) => {
            updateNodeFlags(nodeInfo.node.id, {
              inViewport: inViewport,
            });
          });

          restoreDimensionsForDraggedNodes(draggedNodes);

          if (primaryNode.offset.placeholderId) {
            removeNode(primaryNode.offset.placeholderId);

            if (hasMultiplePlaceholders) {
              allPlaceholderIds.forEach((id) => {
                if (id !== primaryNode.offset.placeholderId) {
                  removeNode(id);
                }
              });
            }
          }

          resetDragState();
          return;
        }
      }

      const inViewport = isNodeInViewport(targetId, getNodeParent);
      const ordered = getDraggedInOriginalOrder();
      ordered.forEach((nodeInfo) => {
        updateNodeFlags(nodeInfo.node.id, {
          inViewport: inViewport,
        });
      });

      if (primaryNode.offset.placeholderId) {
        removeNode(primaryNode.offset.placeholderId);

        if (hasMultiplePlaceholders) {
          allPlaceholderIds.forEach((id) => {
            if (id !== primaryNode.offset.placeholderId) {
              removeNode(id);
            }
          });
        }
      }

      resetDragState();
      return;
    } else if (primaryNode.offset.placeholderId && !isOverCanvas) {
      const { placeholderId } = primaryNode.offset;
      const placeholderParentId = getNodeParent(placeholderId);

      if (placeholderParentId) {
        const phInfo = dragOps.getState().placeholderInfo!;

        const parentEl = document.querySelector(
          `[data-node-id="${placeholderParentId}"]`
        ) as HTMLElement | null;
        const parentStyles = parentEl
          ? window.getComputedStyle(parentEl)
          : null;
        const parentIsFlex =
          parentStyles && /(flex|inline-flex)/.test(parentStyles.display);
        const parentFlexDir = parentIsFlex
          ? parentStyles.flexDirection || "row"
          : null;

        const visualOrdered =
          parentIsFlex && dragSource === "canvas"
            ? getDraggedInVisualOrder(parentFlexDir!)
            : getDraggedInOriginalOrder();

        const placeholderIdsInOrder = phInfo.nodeOrder
          .map((id) =>
            id === draggedNodeId
              ? placeholderId
              : phInfo.additionalPlaceholders.find((p) => p.nodeId === id)
                  ?.placeholderId
          )
          .filter(Boolean);

        placeholderIdsInOrder.forEach((phId, i) => {
          const idx = getNodeChildren(placeholderParentId).indexOf(phId);
          moveNode(visualOrdered[i].node.id, placeholderParentId, idx);
          removeNode(phId);
        });

        const isInViewport = checkIsViewportOperation(
          placeholderParentId,
          getNodeParent
        );

        if (isInViewport) {
          visualOrdered.forEach((nodeInfo) => {
            updateNodeStyle(
              nodeInfo.node.id,
              {
                position: "relative",
                left: "",
                top: "",
                zIndex: "",
                isAbsoluteInFrame: "false",
              },
              { dontSync: true }
            );
          });

          visualOrdered.forEach((nodeInfo, i) => {
            const nodeId = nodeInfo.node.id;
            const nodeIndex =
              getNodeChildren(placeholderParentId).indexOf(nodeId);
            syncViewports(nodeId, placeholderParentId, nodeIndex);
          });
        } else {
          visualOrdered.forEach((nodeInfo) => {
            updateNodeStyle(
              nodeInfo.node.id,
              {
                position: "relative",
                left: "",
                top: "",
                zIndex: "",
                isAbsoluteInFrame: "false",
              },
              { dontSync: true }
            );
          });
        }

        const inViewport = isNodeInViewport(placeholderParentId, getNodeParent);
        visualOrdered.forEach((nodeInfo) => {
          updateNodeFlags(nodeInfo.node.id, {
            inViewport: inViewport,
          });
        });

        restoreDimensionsForDraggedNodes(draggedNodes);
      }
    } else if (isOverCanvas) {
      handleCanvasDropForNodes(
        e,
        draggedNodes,
        containerRef,
        getTransform,
        allNodePositions,
        isDraggingFromViewport,
        isInDynamicMode,
        isDynamicVariant
      );

      if (isDraggingFromViewport && draggedNodeData?.sharedId) {
        const ordered = getDraggedInOriginalOrder();
        ordered.forEach((nodeInfo) => {
          const nodeData = allNodes.find((n) => n.id === nodeInfo.node.id);
          if (nodeData?.sharedId) {
            syncViewports(
              nodeInfo.node.id,
              dragStartingViewport || dragStartingParent
            );
          }
        });
      }

      const ordered = getDraggedInOriginalOrder();
      ordered.forEach((nodeInfo) => {
        if (
          !nodeInfo.offset.isAbsoluteInFrame ||
          !nodeInfo.offset.startingParentId
        ) {
          updateNodeFlags(nodeInfo.node.id, {
            inViewport: false,
          });
        }
      });
    }

    if (primaryNode.offset.placeholderId) {
      removeNode(primaryNode.offset.placeholderId);

      if (hasMultiplePlaceholders) {
        allPlaceholderIds.forEach((id) => {
          if (id !== primaryNode.offset.placeholderId) {
            removeNode(id);
          }
        });
      }
    }

    resetDragState();
  };

  function handleCanvasDropForNodes(
    e,
    draggedNodes,
    containerRef,
    getTransform,
    nodePositions,
    isDraggingFromViewport,
    isInDynamicMode = false,
    isDynamicVariant = false
  ) {
    const transform = getTransform();
    const containerRect = containerRef.current?.getBoundingClientRect();

    const placeholderInfo = dragOps.getState().placeholderInfo;

    const ordered =
      placeholderInfo?.nodeOrder && draggedNodes.length > 1
        ? placeholderInfo.nodeOrder
            .map((id) => draggedNodes.find((d) => d.node.id === id))
            .filter(Boolean)
        : draggedNodes;

    ordered.forEach((draggedNode, index) => {
      const nodeId = draggedNode.node.id;
      const currentPosition = nodePositions[nodeId];

      // CRITICAL: Skip moveNode for dynamic variants or in dynamic mode
      if (
        !isInDynamicMode &&
        !isDynamicVariant &&
        (!draggedNode.offset.isAbsoluteInFrame ||
          !draggedNode.offset.startingParentId)
      ) {
        console.log(`Moving node ${nodeId} to canvas (null parent)`);
        moveNode(nodeId, null);
      } else {
        console.log(
          `Skipping moveNode for ${nodeId} - in dynamic mode or is variant`
        );
      }

      let finalX, finalY;

      if (
        currentPosition &&
        typeof currentPosition.left === "string" &&
        typeof currentPosition.top === "string" &&
        currentPosition.left.endsWith("px") &&
        currentPosition.top.endsWith("px")
      ) {
        finalX = parseFloat(currentPosition.left);
        finalY = parseFloat(currentPosition.top);
      } else if (containerRect && e) {
        if (index === 0) {
          const canvasX =
            (e.clientX - containerRect.left - transform.x) / transform.scale;
          const canvasY =
            (e.clientY - containerRect.top - transform.y) / transform.scale;

          finalX = Math.round(
            canvasX - draggedNode.offset.mouseX / transform.scale
          );
          finalY = Math.round(
            canvasY - draggedNode.offset.mouseY / transform.scale
          );
        } else {
          const primaryNode = draggedNodes[0];
          const primaryEl = document.querySelector(
            `[data-node-id="${primaryNode.node.id}"]`
          );
          const currentEl = document.querySelector(
            `[data-node-id="${nodeId}"]`
          );

          if (primaryEl && currentEl) {
            const primaryRect = primaryEl.getBoundingClientRect();
            const currentRect = currentEl.getBoundingClientRect();

            const offsetX =
              (currentRect.left - primaryRect.left) / transform.scale;
            const offsetY =
              (currentRect.top - primaryRect.top) / transform.scale;

            const canvasX =
              (e.clientX - containerRect.left - transform.x) / transform.scale;
            const canvasY =
              (e.clientY - containerRect.top - transform.y) / transform.scale;

            const primaryX = Math.round(
              canvasX - primaryNode.offset.mouseX / transform.scale
            );
            const primaryY = Math.round(
              canvasY - primaryNode.offset.mouseY / transform.scale
            );

            finalX = primaryX + offsetX;
            finalY = primaryY + offsetY;
          } else {
            const canvasX =
              (e.clientX - containerRect.left - transform.x) / transform.scale;
            const canvasY =
              (e.clientY - containerRect.top - transform.y) / transform.scale;

            finalX =
              Math.round(
                canvasX - draggedNode.offset.mouseX / transform.scale
              ) +
              index * 10;
            finalY =
              Math.round(
                canvasY - draggedNode.offset.mouseY / transform.scale
              ) +
              index * 10;
          }
        }
      } else {
        const currentStyles = draggedNode.node.style;
        finalX =
          typeof currentStyles.left === "string" &&
          currentStyles.left.endsWith("px")
            ? parseFloat(currentStyles.left)
            : 0;
        finalY =
          typeof currentStyles.top === "string" &&
          currentStyles.top.endsWith("px")
            ? parseFloat(currentStyles.top)
            : 0;
      }

      const { activeSnapPoints } = snapOps.getState();
      if (index === 0) {
        if (
          activeSnapPoints.horizontal &&
          activeSnapPoints.horizontal.edge === "left" &&
          Math.abs(finalX - activeSnapPoints.horizontal.position) <= 5
        ) {
          finalX = Math.round(activeSnapPoints.horizontal.position);
        }

        if (
          activeSnapPoints.vertical &&
          activeSnapPoints.vertical.edge === "top" &&
          Math.abs(finalY - activeSnapPoints.vertical.position) <= 5
        ) {
          finalY = Math.round(activeSnapPoints.vertical.position);
        }
      }

      finalX = isNaN(finalX) ? 0 : Math.round(finalX);
      finalY = isNaN(finalY) ? 0 : Math.round(finalY);

      if (isInDynamicMode || isDynamicVariant) {
        // For dynamic mode or variants, just update the position without changing parent relationships
        updateNodeStyle(
          nodeId,
          {
            position: "absolute",
            left: `${finalX}px`,
            top: `${finalY}px`,
          },
          { dontSync: true }
        );
      } else if (
        draggedNode.offset.isAbsoluteInFrame &&
        draggedNode.offset.startingParentId
      ) {
        updateNodeStyle(
          nodeId,
          {
            position: draggedNode.offset.originalPositionType || "absolute",
            left: `${finalX}px`,
            top: `${finalY}px`,
            isAbsoluteInFrame: "true",
          },
          { dontSync: true }
        );
      } else {
        updateNodeStyle(
          nodeId,
          {
            position: "absolute",
            left: `${finalX}px`,
            top: `${finalY}px`,
            isAbsoluteInFrame: "false",
          },
          { dontSync: true }
        );

        // Only update flags for non-dynamic nodes
        if (!isInDynamicMode && !isDynamicVariant) {
          updateNodeFlags(nodeId, {
            inViewport: false,
          });
        }
      }

      if (draggedNode.offset.dimensionUnits) {
        restoreOriginalDimensions(nodeId, draggedNode.offset.dimensionUnits);
      }
    });
  }

  function findTopViewport(id: NodeId): NodeId | null {
    if (!id) return null;

    let current: NodeId | null = id;
    let lastViewport: NodeId | null = null;

    while (current != null) {
      if (typeof current === "string" && current.includes("viewport")) {
        lastViewport = current;
      }
      current = getNodeParent(current);
    }

    return lastViewport;
  }

  function checkIsViewportOperation(nodeId, getNodeParent) {
    if (!nodeId) return false;

    if (nodeId.includes("viewport")) {
      return true;
    }

    let current = nodeId;
    let depth = 0;
    const maxDepth = 10;

    while (current && depth < maxDepth) {
      if (current.includes("viewport")) {
        return true;
      }
      current = getNodeParent(current);
      depth++;
    }
    return false;
  }

  function isNodeInViewport(nodeId, getNodeParent) {
    if (!nodeId) return false;

    let current = nodeId;
    while (current) {
      if (current.includes("viewport")) {
        return true;
      }
      current = getNodeParent(current);
    }
    return false;
  }

  function resetDragState() {
    dragOps.setPlaceholderInfo(null);

    dragOps.setDraggedNodes([]);
    snapOps.setLimitToNodes(null);
    snapOps.setShowChildElements(false);
    dragOps.setIsDragging(false);
    dragOps.setIsOverCanvas(false);
    dragOps.setDragSource(null);
    dragOps.setDropInfo(null, null);
    visualOps.hideLineIndicator();

    dragOps.setDragBackToParentInfo({
      isDraggingBackToParent: false,
      originalParentId: null,
      draggedNodesOriginalIndices: new Map(),
    });

    if (transitioningToCanvasRef) transitioningToCanvasRef.current = false;
    if (transitioningToParentRef) transitioningToParentRef.current = false;
  }
};
