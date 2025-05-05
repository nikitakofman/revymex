import { useRef } from "react";
import { useBuilderRefs } from "@/builder/context/builderState";
import {
  findIndexWithinParent,
  findParentViewport,
  isAbsoluteInFrame,
  isWithinViewport,
} from "../utils";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { nanoid } from "nanoid";
import { createPlaceholder } from "./createPlaceholder";
import {
  dragOps,
  useGetAdditionalDraggedNodes,
  useGetDraggedItem,
  useGetDraggedNode,
  useGetDragSource,
  useGetDropInfo,
  useGetDynamicModeNodeId,
  useGetIsDragging,
  useGetNodeDimensions,
  useGetPlaceholderInfo,
  useGetRecordingSessionId,
} from "../atoms/drag-store";
import { visualOps } from "../atoms/visual-store";
import { useGetTransform } from "../atoms/canvas-interaction-store";
import { useGetActiveViewportInDynamicMode } from "../atoms/dynamic-store";
import {
  NodeId,
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeDynamicInfo,
  useGetNodeSharedInfo,
} from "../atoms/node-store";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";
import {
  updateNodeFlags,
  updateNodeDynamicInfo,
  updateNodeSharedInfo,
} from "../atoms/node-store/operations/update-operations";
import {
  addNode,
  insertAtIndex,
  moveNode,
  removeNode,
  reorderChildren,
} from "../atoms/node-store/operations/insert-operations";
import {
  hierarchyStore,
  childrenMapAtom,
  useGetNodeChildren,
  useGetNodeParent,
} from "../atoms/node-store/hierarchy-store";
import { selectOps } from "../atoms/select-store";

export const useMouseUp = () => {
  const { hasLeftViewportRef, containerRef } = useBuilderRefs();

  const originalIndexRef = useRef<number | null>(null);
  const { stopAutoScroll } = useAutoScroll();

  // Store last added node ID for post-processing
  const lastAddedNodeIdRef = useRef<string | null>(null);

  // Use non-reactive getters
  const getIsDragging = useGetIsDragging();
  const getDraggedNode = useGetDraggedNode();
  const getDraggedItem = useGetDraggedItem();
  const getAdditionalDraggedNodes = useGetAdditionalDraggedNodes();
  const getDropInfo = useGetDropInfo();
  const getDragSource = useGetDragSource();
  const getPlaceholderInfo = useGetPlaceholderInfo();
  const getNodeDimensions = useGetNodeDimensions();
  const getTransform = useGetTransform();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();
  const getActiveViewportInDynamicMode = useGetActiveViewportInDynamicMode();
  const getRecordingSessionId = useGetRecordingSessionId();

  // Add node state getters
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();
  const getNodeSharedInfo = useGetNodeSharedInfo();

  // Helper function to check if a node is within a viewport
  const checkIsWithinViewport = (nodeId: NodeId): boolean => {
    const parentId = getNodeParent(nodeId);
    if (!parentId) return false;

    const parentFlags = getNodeFlags(parentId);
    if (parentFlags.isViewport) return true;

    // Recursively check parent
    return checkIsWithinViewport(parentId);
  };

  // Helper function to find parent viewport ID
  const findParentViewportId = (nodeId: NodeId): NodeId | null => {
    const parentId = getNodeParent(nodeId);
    if (!parentId) return null;

    const parentFlags = getNodeFlags(parentId);
    if (parentFlags.isViewport) return parentId;

    // Recursively check parent
    return findParentViewportId(parentId);
  };

  return () => {
    const dragSource = getDragSource();
    const isDragging = getIsDragging();
    const currentDraggedNode = getDraggedNode();
    const dropInfo = getDropInfo();
    const placeholderInfo = getPlaceholderInfo();
    const nodeDimensions = getNodeDimensions();
    const transform = getTransform();
    const dynamicModeNodeId = getDynamicModeNodeId();
    const activeViewportInDynamicMode = getActiveViewportInDynamicMode();
    const recordingSessionId = getRecordingSessionId();

    console.log(" FAMM????", isDragging, currentDraggedNode);
    if (!isDragging || !currentDraggedNode) {
      return;
    }

    const draggedItem = getDraggedItem();

    stopAutoScroll();
    // Reset last added node ref at the beginning of the drop
    lastAddedNodeIdRef.current = null;

    const draggedNode = currentDraggedNode.node;
    const realNodeId = draggedNode.id;
    const sharedId = nanoid();

    // Get styles and dimensions
    const nodeStyle = getNodeStyle(realNodeId);
    const dropWidth = nodeStyle.width;
    const dropHeight = nodeStyle.height;

    // Get node information
    const nodeFlags = getNodeFlags(realNodeId);
    const nodeDynamicInfo = getNodeDynamicInfo(realNodeId);
    const nodeSharedInfo = getNodeSharedInfo(realNodeId);

    // Find parent viewport ID
    const sourceViewportId = findParentViewportId(realNodeId);

    // Determine if we're adding a new element or repositioning an existing one
    const isNewElement = !!draggedItem;

    const additionalDraggedNodes = getAdditionalDraggedNodes();

    // ============================================
    // Absolute positioning (inside frames or canvas)
    // ============================================
    if (dragSource === "absolute-in-frame" || nodeFlags.isAbsoluteInFrame) {
      // If dropped with target and position "absolute-inside", update the node inside its frame
      if (dropInfo.targetId && dropInfo.position === "absolute-inside") {
        const parentId = dropInfo.targetId;
        const parentFlags = getNodeFlags(parentId);

        // Calculate the position adjusted by the grab offset
        const relativeX = dropInfo.dropX || 0;
        const relativeY = dropInfo.dropY || 0;
        const finalX = relativeX - currentDraggedNode.offset.mouseX;
        const finalY = relativeY - currentDraggedNode.offset.mouseY;

        // Update style with absolute positioning
        updateNodeStyle(realNodeId, {
          position: "absolute",
          left: `${finalX}px`,
          top: `${finalY}px`,
        });

        // Move the node to the new parent
        moveNode(realNodeId, parentId);

        // Update flags
        updateNodeFlags(realNodeId, {
          isAbsoluteInFrame: true,
          inViewport: checkIsWithinViewport(parentId),
        });

        // Handle any additional dragged nodes similarly
        if (additionalDraggedNodes?.length) {
          additionalDraggedNodes.forEach((info) => {
            const offsetX = info.offset.x - currentDraggedNode.offset.x || 0;
            const offsetY = info.offset.y - currentDraggedNode.offset.y || 0;

            updateNodeStyle(info.node.id, {
              position: "absolute",
              left: `${finalX + offsetX}px`,
              top: `${finalY + offsetY}px`,
            });

            moveNode(info.node.id, parentId);

            updateNodeFlags(info.node.id, {
              isAbsoluteInFrame: true,
              inViewport: checkIsWithinViewport(parentId),
            });
          });
        }

        visualOps.hideLineIndicator();
        dragOps.resetDragState();

        // Always sync new elements to all viewports
        if (isNewElement && !dynamicModeNodeId) {
          // Since we can't sync using nodeDisp, mark for future implementation
          console.log("Element needs syncing:", realNodeId);
        }
        return;
      } else {
        // Dropped outside the frame on canvas: convert to regular canvas element
        const { dropX, dropY } = dropInfo;

        if (dropX !== undefined && dropY !== undefined) {
          const finalX = dropX - currentDraggedNode.offset.mouseX;
          const finalY = dropY - currentDraggedNode.offset.mouseY;

          updateNodeStyle(realNodeId, {
            position: "absolute",
            left: `${finalX}px`,
            top: `${finalY}px`,
          });

          // Move to root (no parent)
          moveNode(realNodeId, null);

          // Update flags
          updateNodeFlags(realNodeId, {
            isAbsoluteInFrame: false,
            inViewport: false,
          });

          if (additionalDraggedNodes?.length) {
            additionalDraggedNodes.forEach((info) => {
              const offsetX = info.offset.x - currentDraggedNode.offset.x || 0;
              const offsetY = info.offset.y - currentDraggedNode.offset.y || 0;
              const additionalX = finalX + offsetX;
              const additionalY = finalY + offsetY;

              updateNodeStyle(info.node.id, {
                position: "absolute",
                left: `${additionalX}px`,
                top: `${additionalY}px`,
              });

              moveNode(info.node.id, null);

              updateNodeFlags(info.node.id, {
                isAbsoluteInFrame: false,
                inViewport: false,
              });
            });
          }

          visualOps.hideLineIndicator();
          dragOps.resetDragState();

          if (isNewElement && !dynamicModeNodeId) {
            // Since we can't sync using nodeDisp, mark for future implementation
            console.log("Element needs syncing:", realNodeId);
          }
          return;
        }
      }
    }

    // ============================================
    // Handling drops onto a target container
    // ============================================
    if (dropInfo.targetId) {
      const { targetId, position } = dropInfo;
      const targetFlags = getNodeFlags(targetId);
      const targetDynamicInfo = getNodeDynamicInfo(targetId);

      // Check if target is within viewport
      const shouldBeInViewport = checkIsWithinViewport(targetId);

      if (draggedItem) {
        // Adding a new element from the toolbar or canvas

        // Update style for new element
        updateNodeStyle(realNodeId, {
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
        });

        // Generate new shared ID
        const newSharedId = nanoid();
        updateNodeSharedInfo(realNodeId, {
          sharedId: newSharedId,
        });

        // Store the new node's ID for later sync
        lastAddedNodeIdRef.current = realNodeId;

        // Add to target
        if (position === "inside") {
          addNode(realNodeId, targetId);
        } else {
          const targetParentId = getNodeParent(targetId);
          if (!targetParentId) return;

          const targetIndex = getNodeChildren(targetParentId).indexOf(targetId);
          const insertIndex =
            position === "after" ? targetIndex + 1 : targetIndex;

          insertAtIndex(realNodeId, targetParentId, insertIndex);
        }

        // Update viewport flag
        updateNodeFlags(realNodeId, {
          inViewport: shouldBeInViewport,
        });

        // Select the new node
        selectOps.setSelectedIds([realNodeId]);

        // Sync with standard viewports if not in dynamic mode
        if (!dynamicModeNodeId) {
          // Since we can't sync using nodeDisp, mark for future implementation
          console.log("Element needs syncing with children:", realNodeId);
        }
      } else {
        // Repositioning an existing element

        // Check if target has dynamic parent
        const isTargetDynamic = !!(
          targetFlags.isDynamic ||
          targetDynamicInfo.dynamicFamilyId ||
          targetDynamicInfo.dynamicParentId
        );

        // Detect different types of moves
        const draggedFromCanvas =
          !nodeFlags.inViewport && !getNodeParent(realNodeId);
        const movingToViewport = checkIsWithinViewport(targetId);
        const isCanvasToViewportMove = draggedFromCanvas && movingToViewport;
        const movingToViewportComponent = checkIsWithinViewport(targetId);

        // Move the node to the target
        if (position === "inside") {
          moveNode(realNodeId, targetId);
        } else {
          const targetParentId = getNodeParent(targetId);
          if (!targetParentId) return;

          const targetIndex = getNodeChildren(targetParentId).indexOf(targetId);
          const insertIndex =
            position === "after" ? targetIndex + 1 : targetIndex;

          moveNode(realNodeId, targetParentId, insertIndex);
        }

        // Move additional nodes
        if (additionalDraggedNodes?.length) {
          additionalDraggedNodes.forEach((info, index) => {
            if (index === 0) {
              // First additional node goes after the main node
              const mainNodeParentId = getNodeParent(realNodeId);
              if (!mainNodeParentId) return;

              const mainNodeIndex =
                getNodeChildren(mainNodeParentId).indexOf(realNodeId);
              moveNode(info.node.id, mainNodeParentId, mainNodeIndex + 1);
            } else {
              // Subsequent nodes go after the previous one
              const prevNodeId = additionalDraggedNodes[index - 1].node.id;
              const prevNodeParentId = getNodeParent(prevNodeId);
              if (!prevNodeParentId) return;

              const prevNodeIndex =
                getNodeChildren(prevNodeParentId).indexOf(prevNodeId);
              moveNode(info.node.id, prevNodeParentId, prevNodeIndex + 1);
            }

            // Update dynamic parent if needed
            if (targetDynamicInfo.dynamicParentId) {
              if (dynamicModeNodeId && activeViewportInDynamicMode) {
                updateNodeDynamicInfo(info.node.id, {
                  dynamicParentId: targetDynamicInfo.dynamicParentId,
                  dynamicViewportId: activeViewportInDynamicMode,
                });
              } else {
                updateNodeDynamicInfo(info.node.id, {
                  dynamicParentId: targetDynamicInfo.dynamicParentId,
                });
              }
            }

            // Reset style to relative
            updateNodeStyle(info.node.id, {
              position: "relative",
              zIndex: "",
              left: "",
              top: "",
              ...(info.node.style.flex === "1 0 0px" && { flex: "1 0 0px" }),
            });

            // Update flags
            updateNodeFlags(info.node.id, {
              inViewport: shouldBeInViewport,
            });
          });
        }

        // Update dynamic parent if needed
        if (targetDynamicInfo.dynamicParentId) {
          updateNodeDynamicInfo(realNodeId, {
            dynamicParentId: targetDynamicInfo.dynamicParentId,
          });
        }

        // Reset main node style to relative
        updateNodeStyle(realNodeId, {
          position: "relative",
          zIndex: "",
          left: "",
          top: "",
          ...(nodeStyle.flex === "1 0 0px" ? { flex: "1 0 0px" } : {}),
        });

        // Update flags
        updateNodeFlags(realNodeId, {
          inViewport: shouldBeInViewport,
        });

        // Sync logic for viewport components
        if (movingToViewportComponent && !dynamicModeNodeId) {
          // Ensure the node has a sharedId for syncing
          if (!nodeSharedInfo.sharedId) {
            const newSharedId = nanoid();
            updateNodeSharedInfo(realNodeId, {
              sharedId: newSharedId,
            });

            updateNodeFlags(realNodeId, {
              inViewport: true,
            });
          }

          // Ensure all additional nodes have sharedIds
          if (additionalDraggedNodes?.length) {
            additionalDraggedNodes.forEach((info) => {
              const additionalSharedInfo = getNodeSharedInfo(info.node.id);
              if (!additionalSharedInfo.sharedId) {
                const newSharedId = nanoid();
                updateNodeSharedInfo(info.node.id, {
                  sharedId: newSharedId,
                });

                updateNodeFlags(info.node.id, {
                  inViewport: true,
                });
              }
            });
          }

          // Since we can't sync using nodeDisp, mark for future implementation
          console.log("Element needs syncing with children:", realNodeId);
        }
        // For repositioning on canvas, no need to sync
      }

      visualOps.hideLineIndicator();
      dragOps.resetDragState();
      originalIndexRef.current = null;
      return;
    }

    // ============================================
    // Handling placeholder-based drops
    // ============================================
    const placeholderElements = document.querySelectorAll(
      '[data-node-type="placeholder"]'
    );
    if (placeholderElements.length > 0) {
      if (placeholderInfo) {
        const allDraggedNodes = [
          {
            nodeId: draggedNode.id,
            placeholderId: placeholderInfo.mainPlaceholderId,
          },
          ...placeholderInfo.additionalPlaceholders,
        ].sort((a, b) => {
          const orderA = placeholderInfo.nodeOrder.indexOf(a.nodeId);
          const orderB = placeholderInfo.nodeOrder.indexOf(b.nodeId);
          return orderA - orderB;
        });

        // Create dimensions map for all nodes
        const nodeDimensionsMap = new Map();
        allDraggedNodes.forEach((info) => {
          const nodeStyle = getNodeStyle(info.nodeId);
          nodeDimensionsMap.set(info.nodeId, {
            width: nodeStyle.width,
            height: nodeStyle.height,
            isFillMode: nodeStyle.flex === "1 0 0px",
          });
        });

        // Get first placeholder
        const firstPlaceholderParent = getNodeParent(
          allDraggedNodes[0].placeholderId
        );
        if (!firstPlaceholderParent) return;

        const placeholderIndex = getNodeChildren(
          firstPlaceholderParent
        ).indexOf(allDraggedNodes[0].placeholderId);

        // Remove all placeholders
        allDraggedNodes.forEach((info) => {
          removeNode(info.placeholderId);
        });

        if (placeholderIndex === 0) {
          // Get all non-placeholder siblings
          const siblings = getNodeChildren(firstPlaceholderParent).filter(
            (id) => {
              const nodeType = getNodeBasics(id).type;
              return (
                nodeType !== "placeholder" &&
                !allDraggedNodes.some((d) => d.nodeId === id)
              );
            }
          );

          if (siblings.length > 0) {
            // First sibling exists, move before it
            const firstSiblingId = siblings[0];

            // Move nodes sequentially
            allDraggedNodes.forEach((info, index) => {
              if (index === 0) {
                // Move before first sibling
                moveNode(
                  info.nodeId,
                  firstPlaceholderParent,
                  getNodeChildren(firstPlaceholderParent).indexOf(
                    firstSiblingId
                  )
                );
              } else {
                // Move after previous node
                const prevNodeParent = getNodeParent(
                  allDraggedNodes[index - 1].nodeId
                );
                if (!prevNodeParent) return;

                const prevIndex = getNodeChildren(prevNodeParent).indexOf(
                  allDraggedNodes[index - 1].nodeId
                );
                moveNode(info.nodeId, prevNodeParent, prevIndex + 1);
              }

              // Update style
              const dimensions = nodeDimensionsMap.get(info.nodeId);
              updateNodeStyle(info.nodeId, {
                position: "relative",
                zIndex: "",
                left: "",
                top: "",
                ...(dimensions?.isFillMode && { flex: "1 0 0px" }),
                width: dimensions?.width || dropWidth,
                height: dimensions?.height || dropHeight,
              });
            });
          } else {
            // No siblings, move as first children
            allDraggedNodes.forEach((info, index) => {
              if (index === 0) {
                // Add as first child
                moveNode(info.nodeId, firstPlaceholderParent, 0);
              } else {
                // Move after previous node
                const prevNodeParent = getNodeParent(
                  allDraggedNodes[index - 1].nodeId
                );
                if (!prevNodeParent) return;

                const prevIndex = getNodeChildren(prevNodeParent).indexOf(
                  allDraggedNodes[index - 1].nodeId
                );
                moveNode(info.nodeId, prevNodeParent, prevIndex + 1);
              }

              // Update style
              const dimensions = nodeDimensionsMap.get(info.nodeId);
              updateNodeStyle(info.nodeId, {
                position: "relative",
                zIndex: "",
                left: "",
                top: "",
                ...(dimensions?.isFillMode && { flex: "1 0 0px" }),
                width: dimensions?.width || dropWidth,
                height: dimensions?.height || dropHeight,
              });
            });
          }
        } else {
          // For non-first positions
          const firstPlaceholderChildren = getNodeChildren(
            firstPlaceholderParent
          );
          if (
            placeholderIndex > 0 &&
            placeholderIndex <= firstPlaceholderChildren.length
          ) {
            const targetNode = firstPlaceholderChildren[placeholderIndex - 1];

            allDraggedNodes.forEach((info, index) => {
              if (index === 0) {
                // Move after target
                moveNode(info.nodeId, firstPlaceholderParent, placeholderIndex);
              } else {
                // Move after previous node
                const prevNodeParent = getNodeParent(
                  allDraggedNodes[index - 1].nodeId
                );
                if (!prevNodeParent) return;

                const prevIndex = getNodeChildren(prevNodeParent).indexOf(
                  allDraggedNodes[index - 1].nodeId
                );
                moveNode(info.nodeId, prevNodeParent, prevIndex + 1);
              }

              // Update style
              const dimensions = nodeDimensionsMap.get(info.nodeId);
              updateNodeStyle(info.nodeId, {
                position: "relative",
                zIndex: "",
                left: "",
                top: "",
                ...(dimensions?.isFillMode && { flex: "1 0 0px" }),
                width: dimensions?.width,
                height: dimensions?.height,
              });
            });
          }
        }

        // Sync positions if needed (for nodes that came from viewports)
        if (sourceViewportId) {
          // Since we can't sync using nodeDisp, mark for future implementation
          allDraggedNodes.forEach((info) => {
            console.log("Node position needs syncing:", info.nodeId);
          });
        }
      } else {
        // Simple single placeholder case
        const placeholderId =
          placeholderElements[0].getAttribute("data-node-id");
        if (!placeholderId) return;

        const placeholderParent = getNodeParent(placeholderId);
        if (!placeholderParent) return;

        // Get position in parent
        const placeholderIndex =
          getNodeChildren(placeholderParent).indexOf(placeholderId);

        // Check for same position drop
        const originalParentId = getNodeParent(realNodeId);
        const originalIndex = originalParentId
          ? getNodeChildren(originalParentId).indexOf(realNodeId)
          : -1;

        const isSameParent = originalParentId === placeholderParent;
        const placeholderOriginalIndex = placeholderIndex;
        const isSamePosition =
          isSameParent && originalIndex === placeholderOriginalIndex;

        // Remove placeholder
        removeNode(placeholderId);

        console.log("WE HERE???");

        // Get dimensions to restore
        const dimensions = nodeDimensions[realNodeId];

        if (isSamePosition) {
          // Just restore dimensions if position didn't change
          if (dimensions) {
            updateNodeStyle(realNodeId, {
              ...(dimensions.width && { width: dimensions.width }),
              ...(dimensions.height && { height: dimensions.height }),
              ...(dimensions.isFillMode && { flex: "1 0 0px" }),
            });
          }
        } else {
          // Position changed, move node and update style
          moveNode(realNodeId, placeholderParent, placeholderIndex);

          updateNodeStyle(realNodeId, {
            position: "relative",
            ...(dimensions?.isFillMode && { flex: "1 0 0px" }),
            width: dimensions?.width,
            height: dimensions?.height,
          });
        }

        // Sync position if from viewport
        if (sourceViewportId) {
          // Since we can't sync using nodeDisp, mark for future implementation
          console.log("Node position needs syncing:", realNodeId);
        }
      }

      visualOps.hideLineIndicator();
      dragOps.resetDragState();
      originalIndexRef.current = null;
      return;
    }

    // ============================================
    // Handling drops from viewports to canvas
    // ============================================
    if (
      hasLeftViewportRef.current &&
      dragSource === "viewport" &&
      nodeSharedInfo.sharedId &&
      !dropInfo.targetId // Confirm we're dropping directly on canvas, not on a target
    ) {
      // Position the node at its current drag position
      const { dropX, dropY } = dropInfo;
      if (dropX !== undefined && dropY !== undefined) {
        const finalX = dropX - currentDraggedNode.offset.mouseX;
        const finalY = dropY - currentDraggedNode.offset.mouseY;

        updateNodeStyle(realNodeId, {
          position: "absolute",
          left: `${finalX}px`,
          top: `${finalY}px`,
        });

        moveNode(realNodeId, null);

        // Update flags and clear shared ID
        updateNodeFlags(realNodeId, {
          inViewport: false,
        });

        if (!dynamicModeNodeId) {
          updateNodeSharedInfo(realNodeId, {
            sharedId: undefined,
          });

          updateNodeDynamicInfo(realNodeId, {
            dynamicViewportId: null,
            dynamicParentId: null,
            variantResponsiveId: null,
          });
        } else {
          // In dynamic mode
          updateNodeDynamicInfo(realNodeId, {
            dynamicParentId: dynamicModeNodeId,
            dynamicFamilyId: null,
            dynamicViewportId: activeViewportInDynamicMode,
          });
        }

        // Position additional nodes
        if (additionalDraggedNodes?.length) {
          additionalDraggedNodes.forEach((info) => {
            const offsetX = info.offset.x - currentDraggedNode.offset.x || 0;
            const offsetY = info.offset.y - currentDraggedNode.offset.y || 0;

            const additionalX = finalX + offsetX;
            const additionalY = finalY + offsetY;

            updateNodeStyle(info.node.id, {
              position: "absolute",
              left: `${additionalX}px`,
              top: `${additionalY}px`,
            });

            moveNode(info.node.id, null);

            // Update flags and clear shared ID
            updateNodeFlags(info.node.id, {
              inViewport: false,
            });

            const additionalSharedInfo = getNodeSharedInfo(info.node.id);
            if (additionalSharedInfo.sharedId && !dynamicModeNodeId) {
              updateNodeSharedInfo(info.node.id, {
                sharedId: undefined,
              });

              updateNodeDynamicInfo(info.node.id, {
                dynamicViewportId: null,
                dynamicParentId: null,
                variantResponsiveId: null,
              });
            } else if (dynamicModeNodeId) {
              // In dynamic mode
              updateNodeDynamicInfo(info.node.id, {
                dynamicParentId: dynamicModeNodeId,
                dynamicFamilyId: null,
                dynamicViewportId: activeViewportInDynamicMode,
              });
            }
          });
        }
      }

      // Reset viewport reference flags
      hasLeftViewportRef.current = false;

      visualOps.hideLineIndicator();
      dragOps.resetDragState();
      originalIndexRef.current = null;
      return;
    }

    // ============================================
    // Handling drops on the canvas for new elements
    // ============================================
    else if (draggedItem) {
      const { dropX, dropY } = dropInfo;
      if (dropX === undefined || dropY === undefined) return;

      const itemWidth = parseInt(String(nodeStyle.width)) || 150;
      const itemHeight = parseInt(String(nodeStyle.height)) || 150;

      const centeredX = dropX - itemWidth / 2;
      const centeredY = dropY - itemHeight / 2;

      // Update style with absolute positioning
      updateNodeStyle(realNodeId, {
        position: "absolute",
        left: `${centeredX}px`,
        top: `${centeredY}px`,
      });

      // Add dynamic position if in dynamic mode
      if (dynamicModeNodeId) {
        updateNodeDynamicInfo(realNodeId, {
          dynamicPosition: { x: centeredX, y: centeredY },
          dynamicParentId: dynamicModeNodeId,
          dynamicViewportId: activeViewportInDynamicMode,
        });
      }

      // Move to root (no parent)
      moveNode(realNodeId, null);

      // Select the new node
      selectOps.setSelectedIds([realNodeId]);

      // Sync if not in dynamic mode
      if (!dynamicModeNodeId) {
        // Since we can't sync using nodeDisp, mark for future implementation
        console.log("Element needs syncing with children:", realNodeId);
      }

      visualOps.hideLineIndicator();
      dragOps.resetDragState();
      originalIndexRef.current = null;
      hasLeftViewportRef.current = false;
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

        // Get stored dimensions from drag start
        const dimensions = nodeDimensions[draggedNode.id];

        // Update style with absolute positioning and restore dimensions
        updateNodeStyle(realNodeId, {
          position: "absolute",
          left: `${mainNodeX}px`,
          top: `${mainNodeY}px`,
          ...(dimensions?.isFillMode && { flex: "1 0 0px" }),
          ...(dimensions?.width?.includes && dimensions.width.includes("%")
            ? { width: dimensions.width }
            : {}),
          ...(dimensions?.height?.includes && dimensions.height.includes("%")
            ? { height: dimensions.height }
            : {}),
        });

        // Move to root (no parent)
        moveNode(realNodeId, null);

        // Handle additional dragged nodes
        if (additionalDraggedNodes?.length) {
          additionalDraggedNodes.forEach((info) => {
            const additionalElement = document.querySelector(
              `[data-node-dragged="${info.node.id}"]`
            );

            if (additionalElement) {
              const additionalRect = additionalElement.getBoundingClientRect();

              // Calculate position
              const additionalFlags = getNodeFlags(info.node.id);

              if (additionalFlags.inViewport || getNodeParent(info.node.id)) {
                const additionalX =
                  (additionalRect.left - containerRect.left - transform.x) /
                  transform.scale;
                const additionalY =
                  (additionalRect.top - containerRect.top - transform.y) /
                  transform.scale;

                // Get dimensions for additional node
                const addDimensions = nodeDimensions[info.node.id];

                // Update style with absolute positioning
                updateNodeStyle(info.node.id, {
                  position: "absolute",
                  left: `${additionalX}px`,
                  top: `${additionalY}px`,
                  ...(addDimensions?.isFillMode && { flex: "1 0 0px" }),
                  ...(addDimensions?.width?.includes &&
                  addDimensions.width.includes("%")
                    ? { width: addDimensions.width }
                    : {}),
                  ...(addDimensions?.height?.includes &&
                  addDimensions.height.includes("%")
                    ? { height: addDimensions.height }
                    : {}),
                });

                // Move to root
                moveNode(info.node.id, null);
              } else {
                // Calculate relative position from main node
                const additionalStyle = getNodeStyle(info.node.id);
                const mainNodeStyle = getNodeStyle(realNodeId);

                const originalLeft =
                  parseFloat(String(additionalStyle.left)) || 0;
                const originalTop =
                  parseFloat(String(additionalStyle.top)) || 0;
                const mainNodeLeft =
                  parseFloat(String(mainNodeStyle.left)) || 0;
                const mainNodeTop = parseFloat(String(mainNodeStyle.top)) || 0;

                const distanceX = originalLeft - mainNodeLeft;
                const distanceY = originalTop - mainNodeTop;

                const finalX = mainNodeX + distanceX;
                const finalY = mainNodeY + distanceY;

                // Get dimensions for additional node
                const addDimensions = nodeDimensions[info.node.id];

                // Update style with absolute positioning
                updateNodeStyle(info.node.id, {
                  position: "absolute",
                  left: `${finalX}px`,
                  top: `${finalY}px`,
                  ...(addDimensions?.isFillMode && { flex: "1 0 0px" }),
                  ...(addDimensions?.width?.includes &&
                  addDimensions.width.includes("%")
                    ? { width: addDimensions.width }
                    : {}),
                  ...(addDimensions?.height?.includes &&
                  addDimensions.height.includes("%")
                    ? { height: addDimensions.height }
                    : {}),
                });

                // Move to root
                moveNode(info.node.id, null);
              }
            }
          });
        }
      }

      visualOps.hideLineIndicator();
      dragOps.resetDragState();
      originalIndexRef.current = null;
      hasLeftViewportRef.current = false;
    }

    (() => {
      // Remove any remaining placeholders
      const placeholderElements = document.querySelectorAll(
        '[data-node-type="placeholder"]'
      );
      console.log(
        "Cleanup - removing placeholders:",
        placeholderElements.length
      );

      placeholderElements.forEach((el) => {
        const placeholderId = el.getAttribute("data-node-id");
        if (placeholderId) {
          console.log("Removing placeholder:", placeholderId);
          removeNode(placeholderId);
        }
      });

      visualOps.hideLineIndicator();
      dragOps.resetDragState();
      originalIndexRef.current = null;
      hasLeftViewportRef.current = false;
    })();
  };
};
