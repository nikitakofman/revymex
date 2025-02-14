import { useBuilder } from "@/builder/context/builderState";
import {
  findIndexWithinParent,
  findParentViewport,
  isWithinViewport,
} from "./utils";
import { useRef } from "react";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useAutoScroll } from "../hooks/useAutoScroll";

export const useMouseUp = () => {
  const {
    dragState,
    dragDisp,
    nodeDisp,
    containerRef,
    transform,
    nodeState,
    setNodeStyle,
    stopRecording,
  } = useBuilder();

  const originalIndexRef = useRef<number | null>(null);
  const { stopAutoScroll } = useAutoScroll();

  const handleMediaToFrameTransformation = (
    mediaNode: Node,
    droppedNode: Node,
    position: string
  ) => {
    if (position !== "inside") return false;

    const frameNode: Node = {
      ...mediaNode,
      type: "frame",
      style: {
        ...mediaNode.style,
        // Set the appropriate background property based on type
        ...(mediaNode.type === "video"
          ? {
              backgroundVideo: mediaNode.style.src,
            }
          : { backgroundImage: mediaNode.style.src }),
        src: undefined,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    };

    // First replace the media with a frame
    nodeDisp.replaceNode(mediaNode.id, frameNode);

    // Then add the dropped node as a child
    const childNode = {
      ...droppedNode,
      sharedId: nanoid(),
      style: {
        ...droppedNode.style,
        position: "relative",
        zIndex: "",
        transform: "",
        left: "",
        top: "",
      },
      parentId: frameNode.id,
      inViewport: frameNode.inViewport || false,
    };

    nodeDisp.addNode(
      childNode,
      frameNode.id,
      "inside",
      frameNode.inViewport || false
    );

    return true;
  };

  return () => {
    if (!dragState.isDragging || !dragState.draggedNode) {
      return;
    }

    stopAutoScroll();

    const draggedNode = dragState.draggedNode.node;
    const realNodeId = draggedNode.id;
    const sharedId = nanoid();

    const dropWidth =
      dragState.originalWidthHeight.width !== 0
        ? dragState.originalWidthHeight.width
        : draggedNode.style.width;

    const dropHeight =
      dragState.originalWidthHeight.height !== 0
        ? dragState.originalWidthHeight.height
        : draggedNode.style.height;

    const sourceViewportId: string | number | null = findParentViewport(
      draggedNode.parentId,
      nodeState.nodes
    );

    if (dragState.dropInfo.targetId) {
      const { targetId, position } = dragState.dropInfo;
      const targetNode = nodeState.nodes.find((n) => n.id === targetId);

      // Handle image transformation first
      if (
        (targetNode?.type === "image" || targetNode?.type === "video") &&
        dragState.draggedItem
      ) {
        console.log("Attempting image transformation");
        const newNode = {
          ...draggedNode,
          sharedId,
          style: {
            ...draggedNode.style,
            width: dropWidth,
            height: dropHeight,
          } as Node["style"],
        };

        const transformed = handleMediaToFrameTransformation(
          targetNode,
          newNode,
          position
        );

        if (transformed) {
          if (!dragState.dynamicModeNodeId) {
            nodeDisp.syncViewports();
          }
          dragDisp.hideLineIndicator();
          dragDisp.resetDragState();
          stopRecording(dragState.recordingSessionId);
          return;
        }
      }

      // Regular drop handling
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
            width: dropWidth,
            height: dropHeight,
          } as Node["style"],
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
            ...(dragState.originalWidthHeight.isFillMode
              ? {
                  flex: "1 0 0px",
                }
              : {}),
          },
          [realNodeId],
          undefined
        );
      }

      if (!dragState.dynamicModeNodeId) {
        nodeDisp.syncViewports();
      }
      dragDisp.hideLineIndicator();
      dragDisp.resetDragState();
      originalIndexRef.current = null;
      stopRecording(dragState.recordingSessionId as string);
      return;
    }

    const placeholderIndex = nodeState.nodes.findIndex(
      (node) => node.type === "placeholder"
    );

    if (placeholderIndex !== -1) {
      const placeholderId = nodeState.nodes[placeholderIndex].id;
      const placeholderNode = nodeState.nodes[placeholderIndex];

      const targetIndex = findIndexWithinParent(
        nodeState.nodes.filter((n) => n.id !== draggedNode.id),
        placeholderNode.id,
        placeholderNode.parentId
      );

      nodeDisp.removeNode(placeholderId);

      nodeDisp.reorderNode(
        draggedNode.id,
        placeholderNode.parentId,
        targetIndex
      );

      setNodeStyle(
        {
          position: "relative",
          zIndex: "",
          transform: "",
          left: "",
          top: "",
          ...(dragState.originalWidthHeight.isFillMode && {
            flex: "1 0 0px",
          }),
          width: dropWidth,
          height: dropHeight,
        },
        [realNodeId],
        undefined
      );

      if (sourceViewportId) {
        nodeDisp.syncFromViewport(sourceViewportId);
      }
    } else if (dragState.draggedItem && !draggedNode.dynamicParentId) {
      const { dropX, dropY } = dragState.dropInfo;
      const itemWidth = parseInt(draggedNode.style.width as string) || 150;
      const itemHeight = parseInt(draggedNode.style.height as string) || 150;

      const centeredX = dropX! - itemWidth / 2;
      const centeredY = dropY! - itemHeight / 2;

      const newNode = {
        ...draggedNode,
        style: {
          ...draggedNode.style,
          position: "absolute",
          left: `${centeredX}px`,
          top: `${centeredY}px`,
        } as Node["style"],
      };

      if (dragState.dynamicModeNodeId) {
        newNode.dynamicPosition = { x: centeredX, y: centeredY };
        newNode.dynamicParentId = dragState.dynamicModeNodeId;
      }

      nodeDisp.addNode(newNode, null, null, false);
    } else if (containerRef.current) {
      const draggedElement = document.querySelector("[data-node-dragged]");

      if (draggedElement && containerRef.current) {
        const draggedRect = draggedElement.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const canvasX =
          (draggedRect.left - containerRect.left - transform.x) /
          transform.scale;
        const canvasY =
          (draggedRect.top - containerRect.top - transform.y) / transform.scale;

        if (dragState.dynamicModeNodeId) {
          nodeDisp.updateDynamicPosition(draggedNode.id, {
            x: canvasX,
            y: canvasY,
          });
          if (draggedNode.id !== dragState.dynamicModeNodeId) {
            nodeDisp.updateNode(draggedNode.id, {
              dynamicParentId: dragState.dynamicModeNodeId,
            });
          }
        }

        setNodeStyle(
          {
            position: "absolute",
            left: `${canvasX}px`,
            top: `${canvasY}px`,
          },
          [draggedNode.id]
        );

        nodeDisp.moveNode(draggedNode.id, false, {
          newPosition: {
            x: canvasX,
            y: canvasY,
          },
        });
      }
    }

    stopRecording(dragState.recordingSessionId);
    dragDisp.hideLineIndicator();
    dragDisp.resetDragState();
    originalIndexRef.current = null;
  };
};
