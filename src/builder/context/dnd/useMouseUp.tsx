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

export const useMouseUp = () => {
  // Get non-reactive getters
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

    // Get node info
    const allNodes = getCurrentNodes();
    const draggedNodeData = allNodes.find((n) => n.id === draggedNodeId);

    // Get info about starting source
    const dragStartingParent =
      draggedNode.offset.startingParentId || getNodeParent(draggedNodeId);
    const dragStartingViewport = findTopViewport(dragStartingParent);

    // Determine if starting from a viewport
    const isDraggingFromViewport = !!dragStartingViewport;

    // Handle drop based on dropInfo for canvas drags
    if (dragSource === "canvas" && dropInfo?.targetId && dropInfo.position) {
      const targetId = dropInfo.targetId.toString();

      // Check if this is a viewport operation
      const isTargetInViewport = checkIsViewportOperation(
        targetId,
        getNodeParent
      );

      if (dropInfo.position === "inside") {
        // Add as a child to the target
        console.log("dropping here?");
        moveNode(draggedNodeId, targetId);

        // If we're in a viewport, sync the viewports
        if (isTargetInViewport) {
          console.log("dropping here in viewport?");

          syncViewports(draggedNodeId, targetId);
        }
      } else {
        // Get parent of the target node
        const targetParentId = getNodeParent(targetId);
        if (!targetParentId) {
          handleCanvasDrop(e, draggedNode, containerRef, getTransform);

          // If dragging from viewport to canvas, handle shared ID removal
          if (isDraggingFromViewport && draggedNodeData?.sharedId) {
            syncViewports(
              draggedNodeId,
              dragStartingViewport || dragStartingParent
            );
          }
        } else {
          // Get siblings to find index
          const siblings = getNodeChildren(targetParentId);
          const targetIndex = siblings.indexOf(targetId);

          // Insert before or after based on position
          const insertIndex =
            dropInfo.position === "after" ? targetIndex + 1 : targetIndex;
          insertAtIndex(draggedNodeId, targetParentId, insertIndex);

          // If parent is in a viewport, sync the viewports
          const isInViewport = checkIsViewportOperation(
            targetParentId,
            getNodeParent
          );
          if (isInViewport) {
            syncViewports(draggedNodeId, targetParentId, insertIndex);
          }

          // Update style to relative for frame children
          updateNodeStyle(draggedNodeId, {
            position: "relative",
            left: "",
            top: "",
            zIndex: "",
          });

          // Update viewport flag
          updateNodeFlags(draggedNodeId, {
            inViewport: isNodeInViewport(targetParentId, getNodeParent),
          });

          // Early return since we've handled the drop
          resetDragState();
          return;
        }
      }

      // Update style to relative for frame children
      updateNodeStyle(draggedNodeId, {
        position: "relative",
        left: "",
        top: "",
        zIndex: "",
      });

      // Update viewport flag
      updateNodeFlags(draggedNodeId, {
        inViewport: isNodeInViewport(targetId, getNodeParent),
      });

      // Reset and early return
      resetDragState();
      return;
    }
    // If there's a dragged node and placeholder in normal container
    else if (draggedNode.offset.placeholderId && !isOverCanvas) {
      const { placeholderId } = draggedNode.offset;

      // Find the placeholder's parent and position
      const placeholderParentId = getNodeParent(placeholderId);

      if (placeholderParentId) {
        // Get siblings to find index
        const siblings = getNodeChildren(placeholderParentId);
        const placeholderIndex = siblings.indexOf(placeholderId);

        if (placeholderIndex !== -1) {
          // Move the dragged node to placeholder position
          moveNode(draggedNodeId, placeholderParentId, placeholderIndex);

          // Check if this is a viewport operation
          const isInViewport = checkIsViewportOperation(
            placeholderParentId,
            getNodeParent
          );

          if (isInViewport) {
            syncViewports(draggedNodeId, placeholderParentId, placeholderIndex);
          }

          // Remove the placeholder
          removeNode(placeholderId);

          // Update viewport flag
          updateNodeFlags(draggedNodeId, {
            inViewport: isNodeInViewport(placeholderParentId, getNodeParent),
          });

          // Update style to relative for frame children
          updateNodeStyle(draggedNodeId, {
            position: "relative",
            left: "",
            top: "",
            zIndex: "",
          });
        }
      }
    }
    // Handle dropping on canvas
    else if (isOverCanvas) {
      handleCanvasDrop(e, draggedNode, containerRef, getTransform);

      // If dragging from viewport to canvas, handle shared ID removal
      if (isDraggingFromViewport && draggedNodeData?.sharedId) {
        syncViewports(
          draggedNodeId,
          dragStartingViewport || dragStartingParent
        );
      }

      // Update viewport flag
      updateNodeFlags(draggedNodeId, {
        inViewport: false,
      });
    }

    // Reset all state
    resetDragState();
  };

  // Helper function to find top-level viewport for a node
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

  // Enhanced viewport check function with debug logs
  function checkIsViewportOperation(nodeId, getNodeParent) {
    if (!nodeId) return false;

    // Check if the node itself is a viewport
    if (nodeId.includes("viewport")) {
      return true;
    }

    // Check if any ancestor is a viewport
    let current = nodeId;
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops

    while (current && depth < maxDepth) {
      if (current.includes("viewport")) {
        return true;
      }
      current = getNodeParent(current);
      depth++;
    }
    return false;
  }

  // Helper function to check if a node is in a viewport
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

  // Helper function to handle canvas drops
  function handleCanvasDrop(e, draggedNode, containerRef, getTransform) {
    const transform = getTransform();
    const draggedNodeId = draggedNode.node.id;

    if (containerRef.current && e) {
      const containerRect = containerRef.current.getBoundingClientRect();

      // Calculate exact canvas position
      const canvasX =
        (e.clientX - containerRect.left - transform.x) / transform.scale;
      const canvasY =
        (e.clientY - containerRect.top - transform.y) / transform.scale;

      // Account for the initial mouse offset
      const finalX = canvasX - draggedNode.offset.mouseX / transform.scale;
      const finalY = canvasY - draggedNode.offset.mouseY / transform.scale;

      // Move to root level and apply absolute positioning
      moveNode(draggedNodeId, null);

      updateNodeStyle(draggedNodeId, {
        position: "absolute",
        left: `${finalX}px`,
        top: `${finalY}px`,
      });

      updateNodeFlags(draggedNodeId, {
        inViewport: false,
      });
    }
  }

  // Helper function to reset all drag state
  function resetDragState() {
    dragOps.setDraggedNode(null, {
      x: 0,
      y: 0,
      mouseX: 0,
      mouseY: 0,
      placeholderId: null,
      startingParentId: null,
    });
    dragOps.setIsDragging(false);
    dragOps.setIsOverCanvas(false);
    dragOps.setDragSource(null);
    dragOps.setDropInfo(null, null);
    visualOps.hideLineIndicator();
  }
};
