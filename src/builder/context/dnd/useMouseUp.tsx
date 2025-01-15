import { useBuilder } from "@/builder/context/builderState";
import { isOverDropzone } from "./utils";
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
      const overViewport = isOverDropzone(e, "viewport");

      if (overViewport) {
        const { targetId, position } = dragState.dropInfo;

        nodeDisp.addNode(
          {
            ...draggedNode,
            inViewport: true,
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
          position
        );
      } else if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const finalX =
          (e.clientX - containerRect.left - transform.x) / transform.scale;
        const finalY =
          (e.clientY - containerRect.top - transform.y) / transform.scale;

        nodeDisp.addNode(
          {
            ...draggedNode,
            inViewport: false,
            position: { x: finalX, y: finalY },
            style: {
              ...draggedNode.style,
              position: "absolute",
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
      nodeDisp.insertAtIndex(draggedNode, placeholderIndex);

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
      const overViewport = isOverDropzone(e, "viewport");

      if (overViewport) {
        const { targetId, position } = dragState.dropInfo;
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
