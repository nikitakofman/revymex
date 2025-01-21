import { useBuilder } from "@/builder/context/builderState";
import { isOverDropzone, isWithinViewport } from "./utils";
import { useRef } from "react";

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

    if (dragState.draggedItem) {
      const { targetId, position, dropX, dropY } = dragState.dropInfo;

      console.log("targetId", targetId);

      console.log("targetid", dragState.dropInfo);
      if (targetId) {
        console.log("IF TARGET ID", targetId);

        const shouldBeInViewport = isWithinViewport(targetId, nodeState.nodes);

        console.log("shouldBeInViewport", shouldBeInViewport);

        nodeDisp.addNode(
          {
            ...draggedNode,
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
          shouldBeInViewport
        );
      } else {
        const containerRect = containerRef.current?.getBoundingClientRect();

        const itemWidth = parseInt(draggedNode.style.width as string) || 150;
        const itemHeight = parseInt(draggedNode.style.height as string) || 150;

        const relativeX = dropX! - containerRect!.left;
        const relativeY = dropY! - containerRect!.top;

        const adjustedX =
          (relativeX - transform.x) / transform.scale - itemWidth / 2;
        const adjustedY =
          (relativeY - transform.y) / transform.scale - itemHeight / 2;

        nodeDisp.addNode(
          {
            ...draggedNode,
            style: {
              ...draggedNode.style,
              position: "absolute",
              left: `${adjustedX}px`,
              top: `${adjustedY}px`,
            },
          },
          null,
          null
        );
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
    } else {
      const { targetId, position } = dragState.dropInfo;

      if (targetId) {
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

        nodeDisp.moveNode(realNodeId, false, {
          newPosition: { x: finalX, y: finalY },
        });
      }
    }

    dragDisp.hideLineIndicator();
    dragDisp.resetDragState();
    originalIndexRef.current = null;
  };
};
