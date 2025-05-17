import { useGetTransform } from "../atoms/canvas-interaction-store";
import {
  dragOps,
  useGetDraggedNode,
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
import { getCurrentNodes } from "../atoms/node-store";
import { restoreOriginalDimensions } from "./dnd-utils";
import { snapOps } from "../atoms/snap-guides-store";

export const useMouseUp = () => {
  const getDraggedNode = useGetDraggedNode();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getIsOverCanvas = useGetIsOverCanvas();
  const getTransform = useGetTransform();
  const getDragSource = useGetDragSource();
  const getDropInfo = useGetDropInfo();
  const { containerRef } = useBuilderRefs();

  return (e: MouseEvent) => {
    const draggedNode = getDraggedNode();
    if (!draggedNode) return;

    const isOverCanvas = getIsOverCanvas();
    const dragSource = getDragSource();
    const dropInfo = getDropInfo();
    const draggedNodeId = draggedNode.node.id;
    const isAbsoluteInFrame = draggedNode.offset.isAbsoluteInFrame;
    const startingParentId = draggedNode.offset.startingParentId;

    const allNodes = getCurrentNodes();
    const draggedNodeData = allNodes.find((n) => n.id === draggedNodeId);

    // For absolute-in-frame and canvas elements, we need to preserve the exact position
    // on mouse up to prevent position jumps. Get the current position from the DOM.
    let currentPosition = null;
    if (dragSource === "absolute-in-frame" || dragSource === "canvas") {
      const element = document.querySelector(
        `[data-node-id="${draggedNodeId}"]`
      );
      if (element) {
        const computedStyle = window.getComputedStyle(element);
        currentPosition = {
          left: computedStyle.left,
          top: computedStyle.top,
        };
      }
    }

    // Handle absolute-in-frame elements differently
    if (dragSource === "absolute-in-frame" && startingParentId) {
      // Preserve the exact position on mouse up
      if (currentPosition) {
        // Extract number values and ensure they're integers to prevent rounding issues
        let leftValue = parseInt(currentPosition.left, 10);
        let topValue = parseInt(currentPosition.top, 10);

        // Get any active snap points and use them if they exist
        const { activeSnapPoints } = snapOps.getState();

        // Apply the active snap points if available
        if (
          activeSnapPoints.horizontal &&
          activeSnapPoints.horizontal.edge === "left"
        ) {
          // For left edge snap, we need to calculate parent-relative coordinates
          const element = document.querySelector(
            `[data-node-id="${draggedNodeId}"]`
          );
          const parentEl = document.querySelector(
            `[data-node-id="${startingParentId}"]`
          );

          if (element && parentEl) {
            const transform = getTransform();
            const containerRect = containerRef.current!.getBoundingClientRect();
            const parentRect = parentEl.getBoundingClientRect();

            // Get parent position in canvas space
            const parentLeft =
              (parentRect.left - containerRect.left - transform.x) /
              transform.scale;

            // Calculate the snapped position relative to parent
            leftValue = Math.round(
              activeSnapPoints.horizontal.position - parentLeft
            );
          }
        }

        if (
          activeSnapPoints.vertical &&
          activeSnapPoints.vertical.edge === "top"
        ) {
          // For top edge snap, similar process
          const element = document.querySelector(
            `[data-node-id="${draggedNodeId}"]`
          );
          const parentEl = document.querySelector(
            `[data-node-id="${startingParentId}"]`
          );

          if (element && parentEl) {
            const transform = getTransform();
            const containerRect = containerRef.current!.getBoundingClientRect();
            const parentRect = parentEl.getBoundingClientRect();

            // Get parent position in canvas space
            const parentTop =
              (parentRect.top - containerRect.top - transform.y) /
              transform.scale;

            // Calculate the snapped position relative to parent
            topValue = Math.round(
              activeSnapPoints.vertical.position - parentTop
            );
          }
        }

        // Set the final position with the exact values to prevent jumps
        updateNodeStyle(
          draggedNodeId,
          {
            left: `${leftValue}px`,
            top: `${topValue}px`,
          },
          { dontSync: true }
        );
      }

      // Check if we should convert back to pixels
      if (draggedNode.offset.dimensionUnits) {
        restoreOriginalDimensions(
          draggedNodeId,
          draggedNode.offset.dimensionUnits
        );
      }

      resetDragState();
      return;
    }

    const dragStartingParent =
      draggedNode.offset.startingParentId || getNodeParent(draggedNodeId);
    const dragStartingViewport = findTopViewport(dragStartingParent);

    const isDraggingFromViewport = !!dragStartingViewport;

    if (dragSource === "canvas" && dropInfo?.targetId && dropInfo.position) {
      const targetId = dropInfo.targetId.toString();

      const isTargetInViewport = checkIsViewportOperation(
        targetId,
        getNodeParent
      );

      if (dropInfo.position === "inside") {
        console.log("dropping here?");
        moveNode(draggedNodeId, targetId);

        if (isTargetInViewport) {
          console.log("dropping here in viewport?");

          // Use dontSync when updating style to avoid cascading from sync
          updateNodeStyle(
            draggedNodeId,
            {
              position: "relative",
              left: "",
              top: "",
              zIndex: "",
              isAbsoluteInFrame: "false",
            },
            { dontSync: true }
          );

          // Then do a proper sync from the correct viewport
          syncViewports(draggedNodeId, targetId);
        } else {
          // For non-viewport, still use dontSync to prevent unwanted cascading
          updateNodeStyle(
            draggedNodeId,
            {
              position: "relative",
              left: "",
              top: "",
              zIndex: "",
              isAbsoluteInFrame: "false",
            },
            { dontSync: true }
          );
        }

        if (draggedNode.offset.dimensionUnits) {
          restoreOriginalDimensions(
            draggedNodeId,
            draggedNode.offset.dimensionUnits
          );
        }
      } else {
        const targetParentId = getNodeParent(targetId);
        if (!targetParentId) {
          handleCanvasDrop(
            e,
            draggedNode,
            containerRef,
            getTransform,
            currentPosition
          );

          if (isDraggingFromViewport && draggedNodeData?.sharedId) {
            syncViewports(
              draggedNodeId,
              dragStartingViewport || dragStartingParent
            );
          }
        } else {
          const siblings = getNodeChildren(targetParentId);
          const targetIndex = siblings.indexOf(targetId);

          const insertIndex =
            dropInfo.position === "after" ? targetIndex + 1 : targetIndex;
          insertAtIndex(draggedNodeId, targetParentId, insertIndex);

          const isInViewport = checkIsViewportOperation(
            targetParentId,
            getNodeParent
          );
          if (isInViewport) {
            // First update styles with dontSync to prevent cascading
            updateNodeStyle(
              draggedNodeId,
              {
                position: "relative",
                left: "",
                top: "",
                zIndex: "",
                isAbsoluteInFrame: "false",
              },
              { dontSync: true }
            );

            // Then do a proper sync from the correct position
            syncViewports(draggedNodeId, targetParentId, insertIndex);
          } else {
            // For non-viewport targets, still use dontSync
            updateNodeStyle(
              draggedNodeId,
              {
                position: "relative",
                left: "",
                top: "",
                zIndex: "",
                isAbsoluteInFrame: "false",
              },
              { dontSync: true }
            );
          }

          // Only update the inViewport flag, not isAbsoluteInFrame
          updateNodeFlags(draggedNodeId, {
            inViewport: isNodeInViewport(targetParentId, getNodeParent),
          });

          if (draggedNode.offset.dimensionUnits) {
            restoreOriginalDimensions(
              draggedNodeId,
              draggedNode.offset.dimensionUnits
            );
          }

          resetDragState();
          return;
        }
      }

      // Only update the inViewport flag, not isAbsoluteInFrame
      updateNodeFlags(draggedNodeId, {
        inViewport: isNodeInViewport(targetId, getNodeParent),
      });

      resetDragState();
      return;
    } else if (draggedNode.offset.placeholderId && !isOverCanvas) {
      const { placeholderId } = draggedNode.offset;

      const placeholderParentId = getNodeParent(placeholderId);

      if (placeholderParentId) {
        const siblings = getNodeChildren(placeholderParentId);
        const placeholderIndex = siblings.indexOf(placeholderId);

        if (placeholderIndex !== -1) {
          console.log("brouh");
          moveNode(draggedNodeId, placeholderParentId, placeholderIndex);

          const isInViewport = checkIsViewportOperation(
            placeholderParentId,
            getNodeParent
          );

          if (isInViewport) {
            // First update styles with dontSync
            updateNodeStyle(
              draggedNodeId,
              {
                position: "relative",
                left: "",
                top: "",
                zIndex: "",
                isAbsoluteInFrame: "false",
              },
              { dontSync: true }
            );

            // Then do a proper sync
            syncViewports(draggedNodeId, placeholderParentId, placeholderIndex);
          } else {
            // For non-viewport parents, still use dontSync
            updateNodeStyle(
              draggedNodeId,
              {
                position: "relative",
                left: "",
                top: "",
                zIndex: "",
                isAbsoluteInFrame: "false",
              },
              { dontSync: true }
            );
          }

          removeNode(placeholderId);

          // Only update the inViewport flag
          updateNodeFlags(draggedNodeId, {
            inViewport: isNodeInViewport(placeholderParentId, getNodeParent),
          });

          if (draggedNode.offset.dimensionUnits) {
            restoreOriginalDimensions(
              draggedNodeId,
              draggedNode.offset.dimensionUnits
            );
          }
        }
      }
    } else if (isOverCanvas) {
      handleCanvasDrop(
        e,
        draggedNode,
        containerRef,
        getTransform,
        currentPosition
      );

      if (isDraggingFromViewport && draggedNodeData?.sharedId) {
        syncViewports(
          draggedNodeId,
          dragStartingViewport || dragStartingParent
        );
      }

      // Only update the inViewport flag
      updateNodeFlags(draggedNodeId, {
        inViewport: false,
      });
    }

    resetDragState();
  };

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

  function handleCanvasDrop(
    e,
    draggedNode,
    containerRef,
    getTransform,
    currentPosition
  ) {
    const transform = getTransform();
    const draggedNodeId = draggedNode.node.id;

    moveNode(draggedNodeId, null);

    // Check if there are active snap points that should be preserved
    const { activeSnapPoints } = snapOps.getState();
    let finalX, finalY;

    // If we have current position from DOM, use those exact values (most accurate)
    if (currentPosition) {
      // Extract numeric values
      finalX = parseInt(currentPosition.left, 10);
      finalY = parseInt(currentPosition.top, 10);

      // Apply snap points if available and the element is close to them
      if (
        activeSnapPoints.horizontal &&
        activeSnapPoints.horizontal.edge === "left"
      ) {
        // Convert snap point to screen coordinates
        const snapPointScreen = activeSnapPoints.horizontal.position;

        // Only apply if the difference is small (within snap threshold)
        if (Math.abs(finalX - snapPointScreen) <= 5) {
          finalX = Math.round(snapPointScreen);
        }
      }

      if (
        activeSnapPoints.vertical &&
        activeSnapPoints.vertical.edge === "top"
      ) {
        // Convert snap point to screen coordinates
        const snapPointScreen = activeSnapPoints.vertical.position;

        // Only apply if the difference is small (within snap threshold)
        if (Math.abs(finalY - snapPointScreen) <= 5) {
          finalY = Math.round(snapPointScreen);
        }
      }
    } else if (containerRef.current && e) {
      // Calculate position from mouse event if we don't have the current position
      const containerRect = containerRef.current.getBoundingClientRect();

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

      // Apply snap points if available
      if (
        activeSnapPoints.horizontal &&
        activeSnapPoints.horizontal.edge === "left"
      ) {
        finalX = Math.round(activeSnapPoints.horizontal.position);
      }

      if (
        activeSnapPoints.vertical &&
        activeSnapPoints.vertical.edge === "top"
      ) {
        finalY = Math.round(activeSnapPoints.vertical.position);
      }
    } else {
      // Fallback (shouldn't happen)
      const currentStyles = draggedNode.node.style;
      finalX = parseInt(currentStyles.left, 10) || 0;
      finalY = parseInt(currentStyles.top, 10) || 0;
    }

    // Use dontSync option for canvas drops, and provide exact integer values
    updateNodeStyle(
      draggedNodeId,
      {
        position: "absolute",
        left: `${finalX}px`,
        top: `${finalY}px`,
        isAbsoluteInFrame: "false",
      },
      { dontSync: true }
    );

    // Only update the inViewport flag
    updateNodeFlags(draggedNodeId, {
      inViewport: false,
    });
  }

  function resetDragState() {
    dragOps.setDraggedNode(null, {
      x: 0,
      y: 0,
      mouseX: 0,
      mouseY: 0,
      placeholderId: null,
      startingParentId: null,
    });
    snapOps.setLimitToNodes(null);
    snapOps.setShowChildElements(false);
    dragOps.setIsDragging(false);
    dragOps.setIsOverCanvas(false);
    dragOps.setDragSource(null);
    dragOps.setDropInfo(null, null);
    visualOps.hideLineIndicator();
  }
};
