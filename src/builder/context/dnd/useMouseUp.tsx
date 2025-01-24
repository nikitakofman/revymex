import { useBuilder } from "@/builder/context/builderState";
import { findParentViewport, isWithinViewport } from "./utils";
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

    // First handle dropping into frames - this should work the same way always
    if (dragState.dropInfo.targetId) {
      const { targetId, position } = dragState.dropInfo;
      const shouldBeInViewport = isWithinViewport(targetId, nodeState.nodes);

      if (dragState.draggedItem) {
        // New item from toolbar

        console.log("shouod be in viewport", shouldBeInViewport);
        nodeDisp.addNode(
          {
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
          },
          targetId,
          position,
          true
        );
      } else {
        // Moving existing item
        nodeDisp.moveNode(realNodeId, true, { targetId, position });
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

      nodeDisp.syncViewports();
      dragDisp.hideLineIndicator();
      dragDisp.resetDragState();
      originalIndexRef.current = null;
      return;
    }

    // Handle placeholder reordering
    const placeholderIndex = nodeState.nodes.findIndex(
      (node) => node.type === "placeholder"
    );

    if (placeholderIndex !== -1) {
      const placeholderId = nodeState.nodes[placeholderIndex].id;
      nodeDisp.removeNode(placeholderId);
      nodeDisp.removeNode(realNodeId);
      nodeDisp.insertAtIndex(
        draggedNode,
        placeholderIndex,
        draggedNode.parentId
      );

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
    } else if (dragState.draggedItem) {
      // Dropping new item in canvas
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

      // Only add dynamic position if in dynamic mode and dropping in canvas
      if (dragState.dynamicModeNodeId) {
        newNode.dynamicPosition = { x: adjustedX, y: adjustedY };
      }

      nodeDisp.addNode(newNode, null, null, false);
    } else if (containerRef.current) {
      // Moving existing item to canvas
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
