import { useBuilder } from "@/builder/context/builderState";
import {
  findIndexWithinParent,
  findParentViewport,
  getCalibrationAdjustedPosition,
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
  } = useBuilder();

  const originalIndexRef = useRef<number | null>(null);
  const { stopAutoScroll } = useAutoScroll();

  return () => {
    if (!dragState.isDragging || !dragState.draggedNode) {
      return;
    }

    stopAutoScroll();

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
      // Get target position from placeholder
      const targetIndex = findIndexWithinParent(
        nodeState.nodes.filter((n) => n.id !== draggedNode.id), // Filter out dragged node
        placeholderNode.id,
        placeholderNode.parentId
      );

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

      // Calculate centered position by subtracting half width/height
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

      console.log("IN HERE I DROP FROM CANVAS");

      nodeDisp.addNode(newNode, null, null, false);
    } else if (containerRef.current) {
      const rect = document
        .querySelector(`[data-node-id="${realNodeId}"]`)
        ?.getBoundingClientRect();

      const containerRect = containerRef.current.getBoundingClientRect();
      let finalX =
        (rect!.left - containerRect.left - transform.x) / transform.scale;
      let finalY =
        (rect!.top - containerRect.top - transform.y) / transform.scale;

      const adjustedPosition = getCalibrationAdjustedPosition(
        { x: finalX, y: finalY },
        draggedNode.style.rotate,
        transform
      );
      finalX = adjustedPosition.x;
      finalY = adjustedPosition.y;

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

      setNodeStyle(
        { position: "absolute", left: `${finalX}px`, top: `${finalY}px` },
        [realNodeId]
      );

      nodeDisp.moveNode(realNodeId, false, {
        newPosition: { x: finalX, y: finalY },
      });
    }

    dragDisp.hideLineIndicator();
    dragDisp.resetDragState();
    originalIndexRef.current = null;
  };
};
