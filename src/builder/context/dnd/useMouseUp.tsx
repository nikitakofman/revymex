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

    // Handle absolute-in-frame elements differently
    if (dragSource === "absolute-in-frame" && startingParentId) {
      // The position was already updated during mousemove
      // Just check if we should convert back to pixels
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
          handleCanvasDrop(e, draggedNode, containerRef, getTransform);

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
      handleCanvasDrop(e, draggedNode, containerRef, getTransform);

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

  function handleCanvasDrop(e, draggedNode, containerRef, getTransform) {
    const transform = getTransform();
    const draggedNodeId = draggedNode.node.id;

    if (containerRef.current && e) {
      const containerRect = containerRef.current.getBoundingClientRect();

      const canvasX =
        (e.clientX - containerRect.left - transform.x) / transform.scale;
      const canvasY =
        (e.clientY - containerRect.top - transform.y) / transform.scale;

      const finalX = canvasX - draggedNode.offset.mouseX / transform.scale;
      const finalY = canvasY - draggedNode.offset.mouseY / transform.scale;

      moveNode(draggedNodeId, null);

      // Use dontSync option for canvas drops
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
