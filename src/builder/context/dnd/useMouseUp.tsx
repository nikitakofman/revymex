import { useBuilder } from "@/builder/context/builderState";
import {
  findIndexWithinParent,
  findParentViewport,
  isWithinViewport,
} from "./utils";
import { useRef } from "react";
import { nanoid } from "nanoid";

export const useMouseUp = () => {
  const {
    dragState,
    dragDisp,
    nodeDisp,
    containerRef,
    transform,
    nodeState,
    setNodeStyle,
  } = useBuilder();

  const originalIndexRef = useRef<number | null>(null);

  return (e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedNode) {
      return;
    }

    const draggedNode = dragState.draggedNode.node;
    const realNodeId = draggedNode.id;
    const sharedId = nanoid();

    const sourceViewportId: string | number | null = findParentViewport(
      draggedNode.parentId,
      nodeState.nodes
    );

    if (dragState.dropInfo.targetId) {
      const { targetId, position } = dragState.dropInfo;
      const shouldBeInViewport = isWithinViewport(targetId, nodeState.nodes);

      const targetFrame = nodeState.nodes.find((n) => n.id === targetId);

      if (dragState.draggedItem) {
        const newNode = {
          ...draggedNode,
          sharedId,
          style: {
            ...draggedNode.style,
            position: "relative",
            zIndex: "",
            transform: "",
            left: "",
            top: "",
          },
        };

        if (targetFrame?.dynamicParentId) {
          newNode.dynamicParentId = targetFrame.dynamicParentId;
        }

        nodeDisp.addNode(newNode, targetId, position, shouldBeInViewport);
      } else {
        nodeDisp.moveNode(realNodeId, true, { targetId, position });

        if (targetFrame?.dynamicParentId) {
          nodeDisp.updateNode(realNodeId, {
            dynamicParentId: targetFrame.dynamicParentId,
          });
        }

        setNodeStyle(
          {
            position: "relative",
            zIndex: "",
            transform: "",
            left: "",
            top: "",
          },
          [realNodeId]
        );
      }

      if (!dragState.dynamicModeNodeId) {
        nodeDisp.syncViewports();
      }
      dragDisp.hideLineIndicator();
      dragDisp.resetDragState();
      originalIndexRef.current = null;
      return;
    }

    const placeholderIndex = nodeState.nodes.findIndex(
      (node) => node.type === "placeholder"
    );

    if (placeholderIndex !== -1) {
      const placeholderId = nodeState.nodes[placeholderIndex].id;
      const placeholderNode = nodeState.nodes[placeholderIndex];

      console.log("REODERING");

      console.log("placeholderId", placeholderId);
      console.log("placeholderNode", placeholderNode);
      // Get target position from placeholder
      const targetIndex = findIndexWithinParent(
        nodeState.nodes.filter((n) => n.id !== draggedNode.id), // Filter out dragged node
        placeholderNode.id,
        placeholderNode.parentId
      );

      console.log("tazret", targetIndex);

      nodeDisp.removeNode(placeholderId);
      nodeDisp.removeNode(realNodeId);

      // Use placeholder's target index
      nodeDisp.insertAtIndex(draggedNode, targetIndex, draggedNode.parentId);

      setNodeStyle(
        {
          position: "relative",
          zIndex: "",
          transform: "",
          left: "",
          top: "",
        },
        [realNodeId]
      );

      if (sourceViewportId) {
        nodeDisp.syncFromViewport(sourceViewportId);
      }
    } else if (dragState.draggedItem && !draggedNode.dynamicParentId) {
      const { dropX, dropY } = dragState.dropInfo;
      const containerRect = containerRef.current?.getBoundingClientRect();
      const itemWidth = parseInt(draggedNode.style.width as string) || 150;
      const itemHeight = parseInt(draggedNode.style.height as string) || 150;

      const relativeX = dropX! - containerRect!.left;
      const relativeY = dropY! - containerRect!.top;

      const adjustedX =
        (relativeX - transform.x) / transform.scale - itemWidth / 2;
      const adjustedY =
        (relativeY - transform.y) / transform.scale - itemHeight / 2;

      const newNode = {
        ...draggedNode,
        style: {
          ...draggedNode.style,
          position: "absolute",
          left: `${adjustedX}px`,
          top: `${adjustedY}px`,
        },
      };

      if (dragState.dynamicModeNodeId) {
        newNode.dynamicPosition = { x: adjustedX, y: adjustedY };
        newNode.dynamicParentId = dragState.dynamicModeNodeId;
      }

      nodeDisp.addNode(newNode, null, null, false);
    } else if (containerRef.current) {
      const rect = document
        .querySelector(`[data-node-id="${realNodeId}"]`)
        ?.getBoundingClientRect();
      if (!rect) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const finalX =
        (rect.left - containerRect.left - transform.x) / transform.scale;
      const finalY =
        (rect.top - containerRect.top - transform.y) / transform.scale;

      if (dragState.dynamicModeNodeId) {
        nodeDisp.updateDynamicPosition(draggedNode.id, {
          x: finalX,
          y: finalY,
        });
        if (draggedNode.id !== dragState.dynamicModeNodeId) {
          nodeDisp.updateNode(draggedNode.id, {
            dynamicParentId: dragState.dynamicModeNodeId,
          });
        }
      }

      nodeDisp.moveNode(realNodeId, false, {
        newPosition: { x: finalX, y: finalY },
      });
    }

    dragDisp.hideLineIndicator();
    dragDisp.resetDragState();
    originalIndexRef.current = null;
  };
};
