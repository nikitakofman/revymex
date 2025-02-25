import { useBuilder } from "@/builder/context/builderState";
import {
  findIndexWithinParent,
  findParentViewport,
  isWithinViewport,
} from "../utils";
import { useRef } from "react";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { handleMediaToFrameTransformation } from "@/builder/view/toolbars/leftToolbar/Layers/utils";

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
    selectedIdsRef,
  } = useBuilder();

  const originalIndexRef = useRef<number | null>(null);
  const { stopAutoScroll } = useAutoScroll();

  return () => {
    if (!dragState.isDragging || !dragState.draggedNode) {
      return;
    }

    stopAutoScroll();

    console.log("SEL IDS REF", selectedIdsRef.current);

    // dragDisp.setSelectedIds(selectedIdsRef.current);

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
        const newNode = {
          ...draggedNode,
          sharedId,
          style: {
            ...draggedNode.style,
            width: dropWidth,
            height: dropHeight,
            gap: "0px",
            color: "black",
          } as Node["style"],
        };

        const transformed = handleMediaToFrameTransformation(
          targetNode,
          newNode,
          nodeDisp,
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
        console.log("dragState", dragState.draggedItem, draggedNode);
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
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: "0px",
            color: "black",
          } as Node["style"],
        };

        if (targetFrame?.dynamicParentId) {
          newNode.dynamicParentId = targetFrame.dynamicParentId;
        }

        nodeDisp.addNode(newNode, targetId, position, shouldBeInViewport);
        dragDisp.setSelectedIds([newNode.id]);
      } else {
        nodeDisp.moveNode(realNodeId, true, { targetId, position });

        if (dragState.additionalDraggedNodes?.length) {
          dragState.additionalDraggedNodes.forEach((info, index) => {
            if (index === 0) {
              // First additional node goes after main node
              nodeDisp.moveNode(info.node.id, true, {
                targetId: realNodeId,
                position: "after",
              });
            } else {
              // Subsequent nodes go after previous additional node
              const previousNodeId =
                dragState.additionalDraggedNodes[index - 1].node.id;
              nodeDisp.moveNode(info.node.id, true, {
                targetId: previousNodeId,
                position: "after",
              });
            }

            // Apply viewport styles to additional nodes
            setNodeStyle(
              {
                position: "relative",
                zIndex: "",
                transform: "",
                left: "",
                top: "",
                ...(info.node.style.flex === "1 0 0px" && {
                  flex: "1 0 0px",
                }),
              },
              [info.node.id],
              undefined
            );

            // Update dynamic parent if needed
            if (targetFrame?.dynamicParentId) {
              nodeDisp.updateNode(info.node.id, {
                dynamicParentId: targetFrame.dynamicParentId,
              });
            }
          });
        }

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
      if (dragState.placeholderInfo) {
        const allDraggedNodes = [
          {
            nodeId: draggedNode.id,
            placeholderId: dragState.placeholderInfo.mainPlaceholderId,
          },
          ...dragState.placeholderInfo.additionalPlaceholders,
        ].sort((a, b) => {
          const orderA = dragState.placeholderInfo!.nodeOrder.indexOf(a.nodeId);
          const orderB = dragState.placeholderInfo!.nodeOrder.indexOf(b.nodeId);
          return orderA - orderB;
        });

        const nodeDimensions = new Map();
        allDraggedNodes.forEach((info) => {
          const node = nodeState.nodes.find((n) => n.id === info.nodeId);
          if (node) {
            nodeDimensions.set(info.nodeId, {
              width: node.style.width,
              height: node.style.height,
              isFillMode: node.style.flex === "1 0 0px",
            });
          }
        });

        const firstPlaceholder = nodeState.nodes.find(
          (n) => n.id === allDraggedNodes[0].placeholderId
        );
        if (!firstPlaceholder) return;

        const parentId = firstPlaceholder.parentId;
        const currentNodes = nodeState.nodes.filter(
          (n) => n.parentId === parentId
        );
        const placeholderIndex = findIndexWithinParent(
          nodeState.nodes,
          firstPlaceholder.id,
          parentId
        );

        // Remove all placeholders
        allDraggedNodes.forEach((info) => {
          const placeholder = nodeState.nodes.find(
            (n) => n.id === info.placeholderId
          );
          if (placeholder) {
            nodeDisp.removeNode(placeholder.id);
          }
        });

        if (placeholderIndex === 0) {
          // Get all non-placeholder siblings first
          const siblings = nodeState.nodes.filter(
            (n) => n.parentId === parentId && n.type !== "placeholder"
          );

          // Find the first non-dragged sibling
          const firstSibling = siblings.find(
            (n) => !allDraggedNodes.some((d) => d.nodeId === n.id)
          );

          if (firstSibling) {
            // Move nodes in sequence before the first non-dragged sibling
            allDraggedNodes.forEach((info, index) => {
              if (index === 0) {
                nodeDisp.moveNode(info.nodeId, true, {
                  targetId: firstSibling.id,
                  position: "before",
                });
              } else {
                nodeDisp.moveNode(info.nodeId, true, {
                  targetId: allDraggedNodes[index - 1].nodeId,
                  position: "after",
                });
              }

              const dimensions = dragState.nodeDimensions[info.nodeId];
              setNodeStyle(
                {
                  position: "relative",
                  zIndex: "",
                  transform: "",
                  left: "",
                  top: "",
                  ...(dimensions?.isFillMode && {
                    flex: "1 0 0px",
                  }),
                  width: dimensions?.width || dropWidth,
                  height: dimensions?.height || dropHeight,
                },
                [info.nodeId],
                undefined
              );
            });
          } else {
            // If no siblings, move as first children

            allDraggedNodes.forEach((info, index) => {
              if (index === 0) {
                nodeDisp.moveNode(info.nodeId, true, {
                  targetId: parentId,
                  position: "inside",
                });
              } else {
                nodeDisp.moveNode(info.nodeId, true, {
                  targetId: allDraggedNodes[index - 1].nodeId,
                  position: "after",
                });
              }

              const dimensions = dragState.nodeDimensions[info.nodeId];
              setNodeStyle(
                {
                  position: "relative",
                  zIndex: "",
                  transform: "",
                  left: "",
                  top: "",
                  ...(dimensions?.isFillMode && {
                    flex: "1 0 0px",
                  }),
                  width: dimensions?.width || dropWidth,
                  height: dimensions?.height || dropHeight,
                },
                [info.nodeId],
                undefined
              );
            });
          }
        } else {
          // Existing logic for non-first positions
          const targetNode = currentNodes[placeholderIndex - 1];
          allDraggedNodes.forEach((info, index) => {
            if (index === 0) {
              nodeDisp.moveNode(info.nodeId, true, {
                targetId: targetNode.id,
                position: "after",
              });
            } else {
              nodeDisp.moveNode(info.nodeId, true, {
                targetId: allDraggedNodes[index - 1].nodeId,
                position: "after",
              });
            }

            const dimensions = dragState.nodeDimensions[info.nodeId];
            setNodeStyle(
              {
                position: "relative",
                zIndex: "",
                transform: "",
                left: "",
                top: "",
                ...(dimensions?.isFillMode && {
                  flex: "1 0 0px",
                }),
                width: dimensions?.width,
                height: dimensions?.height,
              },
              [info.nodeId],
              undefined
            );
          });
        }

        if (sourceViewportId) {
          nodeDisp.syncFromViewport(sourceViewportId);
        }
      } else {
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

        const dimensions = dragState.nodeDimensions[realNodeId];

        setNodeStyle(
          {
            position: "relative",
            zIndex: "",
            transform: "",
            left: "",
            top: "",
            ...(dimensions?.isFillMode && {
              flex: "1 0 0px",
            }),
            width: dimensions?.width,
            height: dimensions?.height,
          },
          [realNodeId],
          undefined
        );

        if (sourceViewportId) {
          nodeDisp.syncFromViewport(sourceViewportId);
        }
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
      dragDisp.setSelectedIds([newNode.id]);
    } else if (containerRef.current) {
      const draggedElement = document.querySelector(
        `[data-node-dragged="${draggedNode.id}"]`
      );

      if (draggedElement && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const mainDraggedRect = draggedElement.getBoundingClientRect();

        // Get the main node's true position after transform
        const mainNodeX =
          (mainDraggedRect.left - containerRect.left - transform.x) /
          transform.scale;
        const mainNodeY =
          (mainDraggedRect.top - containerRect.top - transform.y) /
          transform.scale;

        setNodeStyle(
          {
            position: "absolute",
            left: `${mainNodeX}px`,
            top: `${mainNodeY}px`,
          },
          [draggedNode.id]
        );

        nodeDisp.moveNode(draggedNode.id, false, {
          newPosition: {
            x: mainNodeX,
            y: mainNodeY,
          },
        });

        if (dragState.additionalDraggedNodes?.length) {
          dragState.additionalDraggedNodes.forEach((info) => {
            const additionalElement = document.querySelector(
              `[data-node-dragged="${info.node.id}"]`
            );

            if (additionalElement) {
              const additionalRect = additionalElement.getBoundingClientRect();

              if (info.node.inViewport || info.node.parentId) {
                // For nodes from viewport/frames, use their actual dragged positions
                const additionalX =
                  (additionalRect.left - containerRect.left - transform.x) /
                  transform.scale;
                const additionalY =
                  (additionalRect.top - containerRect.top - transform.y) /
                  transform.scale;

                setNodeStyle(
                  {
                    position: "absolute",
                    left: `${additionalX}px`,
                    top: `${additionalY}px`,
                  },
                  [info.node.id]
                );

                nodeDisp.moveNode(info.node.id, false, {
                  newPosition: {
                    x: additionalX,
                    y: additionalY,
                  },
                });
              } else {
                // For canvas nodes, maintain relative distances
                const originalLeft =
                  parseFloat(info.node.style.left as string) || 0;
                const originalTop =
                  parseFloat(info.node.style.top as string) || 0;
                const mainNodeLeft =
                  parseFloat(draggedNode.style.left as string) || 0;
                const mainNodeTop =
                  parseFloat(draggedNode.style.top as string) || 0;

                const distanceX = originalLeft - mainNodeLeft;
                const distanceY = originalTop - mainNodeTop;

                const finalX = mainNodeX + distanceX;
                const finalY = mainNodeY + distanceY;

                setNodeStyle(
                  {
                    position: "absolute",
                    left: `${finalX}px`,
                    top: `${finalY}px`,
                  },
                  [info.node.id]
                );

                nodeDisp.moveNode(info.node.id, false, {
                  newPosition: {
                    x: finalX,
                    y: finalY,
                  },
                });
              }
            }
          });
        }
      }
    }

    stopRecording(dragState.recordingSessionId);
    dragDisp.hideLineIndicator();
    dragDisp.resetDragState();
    originalIndexRef.current = null;
  };
};
