import { useBuilder } from "@/builder/context/builderState";
import {
  findIndexWithinParent,
  findParentViewport,
  isAbsoluteInFrame,
  isWithinViewport,
} from "../utils";
import { useRef, useEffect } from "react";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { handleMediaToFrameTransformation } from "../utils";
import produce from "immer";

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
    draggingOverCanvasRef,
    hasLeftViewportRef,
  } = useBuilder();

  const originalIndexRef = useRef<number | null>(null);
  const { stopAutoScroll } = useAutoScroll();

  // Store last added node ID for post-processing (used to store ordering info in NodeDispatcher)
  const lastAddedNodeIdRef = useRef<string | null>(null);

  return () => {
    if (!dragState.isDragging || !dragState.draggedNode) {
      return;
    }

    stopAutoScroll();
    // Reset last added node ref at the beginning of the drop
    lastAddedNodeIdRef.current = null;

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

    // Determine if we're adding a new element or repositioning an existing one
    const isNewElement = !!dragState.draggedItem;

    // ============================================
    // Absolute positioning (inside frames or canvas)
    // ============================================
    if (
      dragState.dragSource === "absolute-in-frame" ||
      isAbsoluteInFrame(draggedNode)
    ) {
      // If dropped with target and position "absolute-inside", update the node inside its frame
      if (
        dragState.dropInfo.targetId &&
        dragState.dropInfo.position === "absolute-inside"
      ) {
        const parentId = dragState.dropInfo.targetId;
        const parentNode = nodeState.nodes.find((n) => n.id === parentId);

        if (parentNode) {
          // Calculate the position adjusted by the grab offset
          const relativeX = dragState.dropInfo.dropX || 0;
          const relativeY = dragState.dropInfo.dropY || 0;
          const finalX = relativeX - dragState.draggedNode.offset.mouseX;
          const finalY = relativeY - dragState.draggedNode.offset.mouseY;

          setNodeStyle(
            {
              position: "absolute",
              left: `${finalX}px`,
              top: `${finalY}px`,
            },
            [draggedNode.id],
            false
          );

          // Update node properties for absolute positioning inside a frame
          nodeDisp.updateNode(draggedNode.id, {
            parentId: parentId,
            isAbsoluteInFrame: true,
            inViewport: isWithinViewport(parentId, nodeState.nodes),
          });

          // If the parent is dynamic, mark the node for later syncing
          const isDynamicParent =
            parentNode.isDynamic ||
            (parentNode.isVariant && parentNode.dynamicParentId);
          if (isDynamicParent) {
            lastAddedNodeIdRef.current = draggedNode.id;
          }

          // Handle any additional dragged nodes similarly
          if (dragState.additionalDraggedNodes?.length) {
            dragState.additionalDraggedNodes.forEach((info, index) => {
              const offsetX =
                info.offset.x - dragState.draggedNode.offset.x || 0;
              const offsetY =
                info.offset.y - dragState.draggedNode.offset.y || 0;

              setNodeStyle(
                {
                  position: "absolute",
                  left: `${finalX + offsetX}px`,
                  top: `${finalY + offsetY}px`,
                },
                [info.node.id],
                false
              );

              nodeDisp.updateNode(info.node.id, {
                parentId: parentId,
                isAbsoluteInFrame: true,
                inViewport: isWithinViewport(parentId, nodeState.nodes),
              });
            });
          }

          dragDisp.hideLineIndicator();
          dragDisp.resetDragState();
          stopRecording(dragState.recordingSessionId);

          // Always sync new elements to all viewports
          if (isNewElement && !dragState.dynamicModeNodeId) {
            setTimeout(() => {
              nodeDisp.syncDroppedNodeWithChildren(realNodeId);
            }, 0);
          }
          return;
        }
      } else {
        // Dropped outside the frame on canvas: convert to regular canvas element
        const { dropX, dropY } = dragState.dropInfo;

        console.log("HERE2");

        if (dropX !== undefined && dropY !== undefined) {
          const finalX = dropX - dragState.draggedNode.offset.mouseX;
          const finalY = dropY - dragState.draggedNode.offset.mouseY;

          setNodeStyle(
            {
              position: "absolute",
              left: `${finalX}px`,
              top: `${finalY}px`,
            },
            [draggedNode.id],
            false
          );

          nodeDisp.updateNode(draggedNode.id, {
            parentId: null,
            isAbsoluteInFrame: false,
            inViewport: false,
          });

          nodeDisp.updateNodePosition(draggedNode.id, {
            x: finalX,
            y: finalY,
          });

          if (dragState.additionalDraggedNodes?.length) {
            dragState.additionalDraggedNodes.forEach((info) => {
              const offsetX =
                info.offset.x - dragState.draggedNode.offset.x || 0;
              const offsetY =
                info.offset.y - dragState.draggedNode.offset.y || 0;
              const additionalX = finalX + offsetX;
              const additionalY = finalY + offsetY;

              setNodeStyle(
                {
                  position: "absolute",
                  left: `${additionalX}px`,
                  top: `${additionalY}px`,
                },
                [info.node.id],
                false
              );

              nodeDisp.updateNode(info.node.id, {
                parentId: null,
                isAbsoluteInFrame: false,
                inViewport: false,
              });

              nodeDisp.updateNodePosition(info.node.id, {
                x: additionalX,
                y: additionalY,
              });
            });
          }

          dragDisp.hideLineIndicator();
          dragDisp.resetDragState();
          stopRecording(dragState.recordingSessionId);

          if (isNewElement && !dragState.dynamicModeNodeId) {
            setTimeout(() => {
              nodeDisp.syncDroppedNodeWithChildren(realNodeId);
            }, 0);
          }
          return;
        }
      }
    }

    // ============================================
    // Handling drops onto a target container
    // ============================================
    if (dragState.dropInfo.targetId) {
      console.log("HERE3");

      const { targetId, position } = dragState.dropInfo;
      const targetNode = nodeState.nodes.find((n) => n.id === targetId);

      // First, handle media transformation for image or video nodes
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
          if (isNewElement && !dragState.dynamicModeNodeId) {
            setTimeout(() => {
              nodeDisp.syncDroppedNodeWithChildren(realNodeId);
            }, 0);
          }
          dragDisp.hideLineIndicator();
          dragDisp.resetDragState();
          stopRecording(dragState.recordingSessionId);
          return;
        }
      }

      console.log("HERE4");

      // Regular drop handling onto a target container
      const shouldBeInViewport = isWithinViewport(targetId, nodeState.nodes);
      const targetFrame = nodeState.nodes.find((n) => n.id === targetId);
      const activeViewportId = dragState.activeViewportInDynamicMode;

      if (dragState.draggedItem) {
        // Adding a new element from the toolbar or canvas

        console.log("HERE5");

        const newNode = {
          ...draggedNode,
          sharedId: nanoid(), // always generate a new sharedId
          style: {
            ...draggedNode.style,
            position: "relative",
            zIndex: "",
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

        // Store the new node's ID for later sync (its ordering info will be captured inside addNode)
        lastAddedNodeIdRef.current = newNode.id;

        // IMPORTANT: addNode now captures the exact index where the node is inserted.
        nodeDisp.addNode(newNode, targetId, position, shouldBeInViewport);
        dragDisp.setSelectedIds([newNode.id]);

        if (!dragState.dynamicModeNodeId) {
          setTimeout(() => {
            // Enhanced sync will use the stored ordering info (_lastAddedNodeInfo)
            nodeDisp.syncDroppedNodeWithChildren(realNodeId);
          }, 0);
        }
      } else {
        console.log("HERE6");

        // Repositioning an existing element
        const targetNode = nodeState.nodes.find((n) => n.id === targetId);
        const isTargetDynamic =
          (targetNode?.isDynamic ||
            targetNode?.dynamicFamilyId ||
            targetNode?.dynamicParentId) !== undefined;

        // Detect different types of moves that need special handling
        const draggedFromCanvas =
          !draggedNode.inViewport && draggedNode.parentId === null;
        const movingToViewport = isWithinViewport(targetId, nodeState.nodes);
        const isCanvasToViewportMove = draggedFromCanvas && movingToViewport;

        // Also detect moves to any component within a viewport
        const movingToViewportComponent = isWithinViewport(
          targetId,
          nodeState.nodes
        );

        nodeDisp.moveNode(
          realNodeId,
          true,
          { targetId, position },
          isTargetDynamic
        );
        if (dragState.additionalDraggedNodes?.length) {
          dragState.additionalDraggedNodes.forEach((info, index) => {
            if (index === 0) {
              nodeDisp.moveNode(info.node.id, true, {
                targetId: realNodeId,
                position: "after",
              });
            } else {
              const previousNodeId =
                dragState.additionalDraggedNodes[index - 1].node.id;
              nodeDisp.moveNode(info.node.id, true, {
                targetId: previousNodeId,
                position: "after",
              });
            }

            if (
              targetFrame?.dynamicParentId &&
              dragState.dynamicModeNodeId &&
              activeViewportId
            ) {
              nodeDisp.updateNode(info.node.id, {
                dynamicParentId: targetFrame.dynamicParentId,
                dynamicViewportId: activeViewportId,
              });
            } else if (targetFrame?.dynamicParentId) {
              nodeDisp.updateNode(info.node.id, {
                dynamicParentId: targetFrame.dynamicParentId,
              });
            }

            // Apply updated viewport styles to additional nodes
            setNodeStyle(
              {
                position: "relative",
                zIndex: "",
                left: "",
                top: "",
                ...(info.node.style.flex === "1 0 0px" && { flex: "1 0 0px" }),
              },
              [info.node.id],
              false
            );

            if (targetFrame?.dynamicParentId) {
              nodeDisp.updateNode(info.node.id, {
                dynamicParentId: targetFrame.dynamicParentId,
              });

              // If target is dynamic or variant, mark for synchronization
              if (
                targetFrame.isDynamic ||
                (targetFrame.isVariant && targetFrame.dynamicParentId)
              ) {
                lastAddedNodeIdRef.current = info.node.id;
              }
            }
          });
        }

        console.log("HERE7?");

        if (targetFrame?.dynamicParentId) {
          nodeDisp.updateNode(realNodeId, {
            dynamicParentId: targetFrame.dynamicParentId,
          });

          if (
            targetFrame.isDynamic ||
            (targetFrame.isVariant && targetFrame.dynamicParentId)
          ) {
            lastAddedNodeIdRef.current = realNodeId;
          }
        }

        setNodeStyle(
          {
            position: "relative",
            zIndex: "",
            left: "",
            top: "",
            ...(dragState.originalWidthHeight.isFillMode
              ? { flex: "1 0 0px" }
              : {}),
          },
          [realNodeId],
          false
        );

        // ENHANCED SYNC LOGIC: Use syncDroppedNodeWithChildren for ALL moves to viewport components
        if (movingToViewportComponent && !dragState.dynamicModeNodeId) {
          // Get the moved node with its updated parent
          const movedNode = nodeState.nodes.find((n) => n.id === realNodeId);

          if (movedNode) {
            // Ensure the node has a sharedId for syncing
            if (!movedNode.sharedId) {
              const newSharedId = nanoid();
              nodeDisp.updateNode(realNodeId, {
                sharedId: newSharedId,
                inViewport: true,
              });
            }

            // Collect IDs of any additional nodes that were moved
            const additionalNodeIds = [];
            if (dragState.additionalDraggedNodes?.length) {
              additionalNodeIds.push(
                ...dragState.additionalDraggedNodes.map((info) => info.node.id)
              );

              // Ensure all additional nodes have sharedIds
              dragState.additionalDraggedNodes.forEach((info) => {
                if (!info.node.sharedId) {
                  const newSharedId = nanoid();
                  nodeDisp.updateNode(info.node.id, {
                    sharedId: newSharedId,
                    inViewport: true,
                  });
                }
              });
            }

            // Sync immediately instead of using setTimeout
            nodeDisp.syncDroppedNodeWithChildren(realNodeId, additionalNodeIds);
          }
        }
        // For repositioning on canvas, only sync the position changes
        else if (!isNewElement && !dragState.dynamicModeNodeId) {
          nodeDisp.syncNodePosition(realNodeId);
          nodeDisp.removePlaceholders();
        }
      }
      console.log("HERE7");

      dragDisp.hideLineIndicator();
      dragDisp.resetDragState();
      originalIndexRef.current = null;
      stopRecording(dragState.recordingSessionId as string);
      return;
    }

    // ============================================
    // Handling placeholder-based drops
    // ============================================
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

        console.log("HERE9");

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

        console.log("HERE8");

        // Remove all placeholders
        allDraggedNodes.forEach((info) => {
          const placeholder = nodeState.nodes.find(
            (n) => n.id === info.placeholderId
          );
          if (placeholder) {
            nodeDisp.removeNode(placeholder.id);
            nodeDisp.removePlaceholders();
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
            // Move nodes sequentially before the first non-dragged sibling
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
                  left: "",
                  top: "",
                  ...(dimensions?.isFillMode && { flex: "1 0 0px" }),
                  width: dimensions?.width || dropWidth,
                  height: dimensions?.height || dropHeight,
                },
                [info.nodeId],
                false
              );
            });
          } else {
            console.log("HERE10");

            // If no siblings exist, move as first children
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
                  left: "",
                  top: "",
                  ...(dimensions?.isFillMode && { flex: "1 0 0px" }),
                  width: dimensions?.width || dropWidth,
                  height: dimensions?.height || dropHeight,
                },
                [info.nodeId],
                false
              );
            });
          }
        } else {
          console.log("HERE11");

          // For non-first positions
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
                left: "",
                top: "",
                ...(dimensions?.isFillMode && { flex: "1 0 0px" }),
                width: dimensions?.width,
                height: dimensions?.height,
              },
              [info.nodeId],
              false
            );
          });
        }

        console.log("HERE112");

        // For repositioning via placeholders, only sync the position changes
        if (sourceViewportId) {
          allDraggedNodes.forEach((info) => {
            nodeDisp.syncNodePosition(info.nodeId);
          });
        }
      } else {
        console.log("HERE1132");

        const placeholderId = nodeState.nodes[placeholderIndex].id;
        const placeholderNode = nodeState.nodes[placeholderIndex];

        // NEW: Check if element is being dropped in the same position
        const originalNode = nodeState.nodes.find(
          (n) => n.id === draggedNode.id
        );
        const originalParentId = originalNode?.parentId;
        const originalIndex = findIndexWithinParent(
          nodeState.nodes,
          draggedNode.id,
          originalParentId
        );

        const targetIndex = findIndexWithinParent(
          nodeState.nodes.filter((n) => n.id !== draggedNode.id),
          placeholderNode.id,
          placeholderNode.parentId
        );

        // Check if we're dropping in the same place
        const isSameParent = originalParentId === placeholderNode.parentId;

        // Get original index of placeholderNode without filtering the array
        const placeholderOriginalIndex = findIndexWithinParent(
          nodeState.nodes,
          placeholderNode.id,
          placeholderNode.parentId
        );

        // Compare original index with placeholder index
        // When placeholder replaces the node, its index is the same as the original node's index
        const isSamePosition =
          isSameParent && originalIndex === placeholderOriginalIndex;

        // Always remove placeholder
        nodeDisp.removeNode(placeholderId);

        nodeDisp.removePlaceholders();

        console.log("moussing up here ? ");

        window.dispatchEvent(new Event("resize"));

        // Get dimensions we need to restore
        const dimensions = dragState.nodeDimensions[realNodeId];

        if (isSamePosition) {
          // Instead of using setNodeStyle which adds unsync flags,
          // update ONLY the dimensions directly
          if (dimensions) {
            // Create a style update with just the dimension properties
            const styleUpdates = {
              ...(dimensions.width && { width: dimensions.width }),
              ...(dimensions.height && { height: dimensions.height }),
              ...(dimensions.isFillMode && { flex: "1 0 0px" }),
            };

            if (Object.keys(styleUpdates).length > 0) {
              // Pass preventUnsync=true as the final parameter to avoid adding flags
              setNodeStyle(
                styleUpdates,
                [realNodeId],
                false, // Don't sync viewports
                true // Prevent adding unsync flags
              );
            }
          }
        } else {
          // Position actually changed, do regular reordering and style changes
          nodeDisp.reorderNode(
            draggedNode.id,
            placeholderNode.parentId,
            targetIndex
          );
          // Apply full style with unsync flags since position changed

          setNodeStyle(
            {
              position: "relative",
              zIndex: "",
              left: "",
              top: "",
              ...(dimensions?.isFillMode && { flex: "1 0 0px" }),
              width: dimensions?.width,
              height: dimensions?.height,
            },
            [realNodeId],
            false,
            true // Always prevent adding unsync flags when restoring after drag
          );
        }

        if (sourceViewportId) {
          nodeDisp.syncNodePosition(realNodeId);
        }
      }

      dragDisp.hideLineIndicator();
      dragDisp.resetDragState();
      originalIndexRef.current = null;
      stopRecording(dragState.recordingSessionId);
      return;
    }

    // ============================================
    // Handling drops from viewports to canvas
    // ============================================
    if (
      hasLeftViewportRef.current &&
      dragState.dragSource === "viewport" &&
      draggedNode.sharedId &&
      !dragState.dropInfo.targetId // Confirm we're dropping directly on canvas, not on a target
    ) {
      // Find and remove all shared ID counterparts
      const sharedIdCounterparts = nodeState.nodes.filter(
        (n) => n.sharedId === draggedNode.sharedId && n.id !== draggedNode.id
      );

      console.log("HEREOOO");

      // Remove all counterparts
      sharedIdCounterparts.forEach((counterpart) => {
        // First find and remove any children of these counterparts
        const childrenToRemove = nodeState.nodes.filter(
          (n) => n.parentId === counterpart.id
        );

        // Remove children first (to avoid orphaned nodes)
        childrenToRemove.forEach((child) => {
          nodeDisp.removeNode(child.id);
        });

        // Then remove the counterpart itself
        nodeDisp.removeNode(counterpart.id);
      });

      if (dragState.dynamicModeNodeId) {
        console.log("indynamicmode");
        console.log(
          "dragState.activeViewportInDynamicMode",
          dragState.dynamicModeNodeId
        );
        console.log("draggedNode.id", dragState.activeViewportInDynamicMode);
        // Update the node to be a direct child of the current active viewport

        nodeDisp.updateNode(draggedNode.id, {
          dynamicParentId: dragState.dynamicModeNodeId,
          dynamicFamilyId: null,
          // Keep it in the dynamic environment
          dynamicViewportId: dragState.activeViewportInDynamicMode,
        });
      } else {
        // Clear sharedId from the dragged node to make it a standalone element
        nodeDisp.updateNode(draggedNode.id, {
          sharedId: undefined,
          inViewport: false,
          dynamicViewportId: null,
          dynamicParentId: null,
          variantResponsiveId: null,
        });
      }

      // Handle additional dragged nodes if needed
      if (dragState.additionalDraggedNodes?.length) {
        dragState.additionalDraggedNodes.forEach((info) => {
          const additionalNode = info.node;

          // Clear shared IDs for additional nodes too
          if (additionalNode.sharedId) {
            const additionalCounterparts = nodeState.nodes.filter(
              (n) =>
                n.sharedId === additionalNode.sharedId &&
                n.id !== additionalNode.id
            );

            // Remove counterparts of additional nodes
            additionalCounterparts.forEach((counterpart) => {
              const childrenToRemove = nodeState.nodes.filter(
                (n) => n.parentId === counterpart.id
              );
              childrenToRemove.forEach((child) => {
                nodeDisp.removeNode(child.id);
              });
              nodeDisp.removeNode(counterpart.id);
            });

            // Clear shared ID and other properties
            nodeDisp.updateNode(additionalNode.id, {
              sharedId: undefined,
              inViewport: false,
              dynamicViewportId: null,
              dynamicParentId: null,
              variantResponsiveId: null,
            });
          }
        });
      }

      // Position the node at its current drag position
      const { dropX, dropY } = dragState.dropInfo;
      if (dropX !== undefined && dropY !== undefined) {
        const finalX = dropX - dragState.draggedNode.offset.mouseX;
        const finalY = dropY - dragState.draggedNode.offset.mouseY;

        setNodeStyle(
          {
            position: "absolute",
            left: `${finalX}px`,
            top: `${finalY}px`,
          },
          [draggedNode.id],
          false
        );

        nodeDisp.updateNodePosition(draggedNode.id, {
          x: finalX,
          y: finalY,
        });

        // Position additional nodes based on their offset from the main node
        if (dragState.additionalDraggedNodes?.length) {
          dragState.additionalDraggedNodes.forEach((info) => {
            const offsetX = info.offset.x - dragState.draggedNode.offset.x || 0;
            const offsetY = info.offset.y - dragState.draggedNode.offset.y || 0;

            const additionalX = finalX + offsetX;
            const additionalY = finalY + offsetY;

            setNodeStyle(
              {
                position: "absolute",
                left: `${additionalX}px`,
                top: `${additionalY}px`,
              },
              [info.node.id],
              false
            );

            nodeDisp.updateNodePosition(info.node.id, {
              x: additionalX,
              y: additionalY,
            });
          });
        }
      }

      // Reset viewport reference flags
      hasLeftViewportRef.current = false;

      dragDisp.hideLineIndicator();
      dragDisp.resetDragState();
      originalIndexRef.current = null;
      stopRecording(dragState.recordingSessionId);
      return;
    }

    // ============================================
    // Handling drops on the canvas for new elements
    // ============================================
    else if (dragState.draggedItem && !draggedNode.dynamicParentId) {
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

        if (dragState.activeViewportInDynamicMode) {
          newNode.dynamicViewportId = dragState.activeViewportInDynamicMode;
        }

        lastAddedNodeIdRef.current = newNode.id;
      }

      nodeDisp.addNode(newNode, null, null, false);
      dragDisp.setSelectedIds([newNode.id]);

      if (!dragState.dynamicModeNodeId) {
        setTimeout(() => {
          nodeDisp.syncDroppedNodeWithChildren(realNodeId);
        }, 0);
      }

      dragDisp.hideLineIndicator();
      dragDisp.resetDragState();
      originalIndexRef.current = null;
      hasLeftViewportRef.current = false;
      stopRecording(dragState.recordingSessionId);
      return;
    }

    // ============================================
    // Handling drops via dragging an existing element (using container ref)
    // ============================================
    else if (containerRef.current) {
      const draggedElement = document.querySelector(
        `[data-node-dragged="${draggedNode.id}"]`
      );

      if (draggedElement && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const mainDraggedRect = draggedElement.getBoundingClientRect();

        // Calculate the main node's true position after transform
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
          [draggedNode.id],
          false
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
                  [info.node.id],
                  false
                );

                nodeDisp.moveNode(info.node.id, false, {
                  newPosition: {
                    x: additionalX,
                    y: additionalY,
                  },
                });
              } else {
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
                  [info.node.id],
                  false
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

      dragDisp.hideLineIndicator();
      dragDisp.resetDragState();
      originalIndexRef.current = null;
      hasLeftViewportRef.current = false;
      stopRecording(dragState.recordingSessionId);
    }
  };
};
