import React, { useState, useEffect, useRef } from "react";
import { useBuilderRefs } from "@/builder/context/builderState";
import { nanoid } from "nanoid";
import {
  computeFrameDropIndicator,
  handleMediaToFrameTransformation,
} from "@/builder/context/utils";
import { visualOps } from "@/builder/context/atoms/visual-store";
import {
  canvasOps,
  useGetIsAdjustingBorderRadius,
  useGetIsAdjustingGap,
  useGetIsFrameModeActive,
  useGetIsResizing,
  useGetIsRotating,
  useGetTransform,
  useIsFrameModeActive,
} from "@/builder/context/atoms/canvas-interaction-store";
import { useGetDynamicModeNodeId } from "@/builder/context/atoms/drag-store";
import { useGetActiveViewportInDynamicMode } from "@/builder/context/atoms/dynamic-store";

// Import the new store operations
import {
  NodeId,
  getCurrentNodes,
  useGetAllNodes,
  useGetNodeParent,
  batchNodeUpdates,
  nodeStore,
  nodeIdsAtom,
  nodeBasicsAtom,
  nodeStyleAtom,
  nodeFlagsAtom,
  nodeSharedInfoAtom,
  nodeDynamicInfoAtom,
  nodeParentAtom,
} from "@/builder/context/atoms/node-store";

import {
  addNode,
  moveNode,
  insertAtIndex,
} from "@/builder/context/atoms/node-store/operations/insert-operations";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import { updateNodeFlags } from "@/builder/context/atoms/node-store/operations/update-operations";
import { syncViewports } from "@/builder/context/atoms/node-store/operations/sync-operations";
import {
  hierarchyStore,
  childrenMapAtom,
  parentMapAtom,
} from "@/builder/context/atoms/node-store/hierarchy-store";

interface DrawingBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDrawing: boolean;
}

export const FrameCreator: React.FC = () => {
  const { containerRef } = useBuilderRefs();
  const [box, setBox] = useState<DrawingBoxState | null>(null);
  const targetFrameRef = useRef<{ id: string; element: Element } | null>(null);

  // Use subscription hook for rendering decisions
  const isFrameModeActive = useIsFrameModeActive();

  // Use getter hooks for event handlers
  const getIsResizing = useGetIsResizing();
  const getIsAdjustingGap = useGetIsAdjustingGap();
  const getIsRotating = useGetIsRotating();
  const getIsAdjustingBorderRadius = useGetIsAdjustingBorderRadius();
  const getIsFrameModeActive = useGetIsFrameModeActive();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();
  const getActiveViewportInDynamicMode = useGetActiveViewportInDynamicMode();
  const getTransform = useGetTransform();

  // New hooks
  const getAllNodes = useGetAllNodes();
  const getNodeParent = useGetNodeParent();

  // Check if we can enable frame creation mode
  const canCreateFrame = () => {
    return (
      !getIsResizing() &&
      !getIsAdjustingGap() &&
      !getIsRotating() &&
      !getIsAdjustingBorderRadius()
    );
  };

  // Function to add a new node to the store
  const addNewNode = (node) => {
    batchNodeUpdates(() => {
      // Add node ID to the store
      nodeStore.set(nodeIdsAtom, (prev) => [...prev, node.id]);

      // Set basic properties
      nodeStore.set(nodeBasicsAtom(node.id), {
        id: node.id,
        type: node.type,
        customName: node.customName,
      });

      // Set style
      nodeStore.set(nodeStyleAtom(node.id), node.style || {});

      // Set flags
      nodeStore.set(nodeFlagsAtom(node.id), {
        isLocked: node.isLocked,
        inViewport: node.inViewport !== false,
        isViewport: node.isViewport,
        viewportName: node.viewportName,
        viewportWidth: node.viewportWidth,
        isDynamic: node.isDynamic,
        isAbsoluteInFrame: node.isAbsoluteInFrame,
        isVariant: node.isVariant,
      });

      // Set shared info
      if (node.sharedId) {
        nodeStore.set(nodeSharedInfoAtom(node.id), { sharedId: node.sharedId });
      }

      // Set dynamic info
      if (node.dynamicParentId || node.dynamicViewportId) {
        nodeStore.set(nodeDynamicInfoAtom(node.id), {
          dynamicParentId: node.dynamicParentId,
          dynamicViewportId: node.dynamicViewportId,
          dynamicPosition: node.dynamicPosition,
        });
      }

      // Add to parent-child relationship
      if (node.position === "inside" && node.targetId) {
        addNode(node.id, node.targetId);
      } else if (node.position && node.targetId) {
        const targetId = node.targetId;
        const siblings =
          hierarchyStore.get(childrenMapAtom).get(getNodeParent(targetId)) ||
          [];
        const targetIndex = siblings.indexOf(targetId);
        const insertIndex =
          node.position === "after" ? targetIndex + 1 : targetIndex;

        insertAtIndex(node.id, getNodeParent(targetId), insertIndex);
      } else {
        // Add to root if no position specified
        addNode(node.id, null);
      }
    });

    return node.id;
  };

  // Function to update dynamic connections
  const updateDynamicConnections = (
    oldTargetId: NodeId,
    newTargetId: NodeId,
    connections: Array<{
      sourceId: NodeId;
      type: "click" | "hover" | "mouseLeave";
    }>
  ) => {
    // For each source node that had a connection to the old target
    connections.forEach((conn) => {
      const sourceNodes = getAllNodes();
      const sourceNode = sourceNodes.find((n) => n.id === conn.sourceId);

      if (sourceNode && sourceNode.dynamicConnections) {
        // Create a new array of connections for this source, but with the target updated
        const updatedConnections = sourceNode.dynamicConnections.map(
          (existingConn) => {
            if (
              existingConn.targetId === oldTargetId &&
              existingConn.type === conn.type
            ) {
              // Update the target ID for this connection
              return {
                ...existingConn,
                targetId: newTargetId,
              };
            }
            return existingConn;
          }
        );

        // Update the dynamic connections in the store
        batchNodeUpdates(() => {
          nodeStore.set(nodeDynamicInfoAtom(conn.sourceId), (prev) => ({
            ...prev,
            dynamicConnections: updatedConnections,
          }));
        });
      }
    });
  };

  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;

    const findTargetFrame = (e: MouseEvent) => {
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of elementsUnder) {
        const frameEl = el.closest('[data-node-type="frame"]');
        if (frameEl && !frameEl.closest(".viewport-header")) {
          const frameId = frameEl.getAttribute("data-node-id");
          if (frameId) {
            const allNodes = getAllNodes();
            const node = allNodes.find((n) => n.id === frameId);
            if (node) {
              return { id: frameId, element: frameEl };
            }
          }
        }
      }
      return null;
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Get latest state values using getters
      const isFrameModeActive = getIsFrameModeActive();

      // Early return if frame mode isn't active
      if (!isFrameModeActive) return;

      // Check if we can create a frame
      if (!canCreateFrame()) return;

      targetFrameRef.current = findTargetFrame(e);

      const rect = canvas.getBoundingClientRect();
      setBox({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
        isDrawing: true,
      });

      // Initialize style helper
      visualOps.updateStyleHelper({
        type: "dimensions",
        position: { x: e.clientX, y: e.clientY },
        dimensions: {
          width: 0,
          height: 0,
          unit: "px",
        },
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!box?.isDrawing) return;

      const transform = getTransform();

      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      setBox((prev) => ({
        ...prev!,
        currentX: newX,
        currentY: newY,
      }));

      // Calculate real dimensions in pixels
      const width = Math.abs(newX - box.startX) / transform.scale;
      const height = Math.abs(newY - box.startY) / transform.scale;

      // Update style helper with current dimensions
      visualOps.updateStyleHelper({
        type: "dimensions",
        position: { x: e.clientX, y: e.clientY },
        dimensions: {
          width,
          height,
          unit: "px",
        },
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!box?.isDrawing) return;

      const transform = getTransform();

      const dynamicModeNodeId = getDynamicModeNodeId();
      const activeViewportInDynamicMode = getActiveViewportInDynamicMode();

      const rect = canvas.getBoundingClientRect();
      const finalX = e.clientX - rect.left;
      const finalY = e.clientY - rect.top;

      // Calculate dimensions
      const left = Math.min(box.startX, finalX);
      const top = Math.min(box.startY, finalY);
      const width = Math.abs(finalX - box.startX);
      const height = Math.abs(finalY - box.startY);

      // Check if we're in dynamic mode
      const inDynamicMode = !!dynamicModeNodeId;
      const dynamicParentId = dynamicModeNodeId;

      // Variables to track encapsulated dynamic elements and frame info
      let encapsulatedDynamicElements = [];
      let newFrameId = null;

      // FIX: Use a consistent prefix for shared IDs to make them more identifiable
      let newFrameSharedId = `frame-${nanoid(8)}`; // Generate a shared ID for frames

      if (width > 5 && height > 5) {
        const canvasX = (left - transform.x) / transform.scale;
        const canvasY = (top - transform.y) / transform.scale;

        // Define box for element detection
        const boxRect = {
          left: canvasX,
          top: canvasY,
          right: canvasX + width / transform.scale,
          bottom: canvasY + height / transform.scale,
        };

        // Find elements that will be encapsulated
        const allNodes = getAllNodes();
        const allElements = allNodes.filter(
          (node) => node.type !== "placeholder" && !node.isViewport
        );

        // Create a map of nodes and their direct children
        const nodeChildrenMap = new Map<
          string | number,
          Array<string | number>
        >();
        allElements.forEach((node) => {
          if (node.parentId) {
            const parentChildren = nodeChildrenMap.get(node.parentId) || [];
            parentChildren.push(node.id);
            nodeChildrenMap.set(node.parentId, parentChildren);
          }
        });

        // Find nodes that are dynamic connection targets
        const dynamicConnectionTargetMap = new Map<
          string | number,
          Array<{
            sourceId: string | number;
            type: "click" | "hover" | "mouseLeave";
          }>
        >();

        // Find all dynamic connections in all nodes
        allElements.forEach((node) => {
          if (node.dynamicConnections && node.dynamicConnections.length > 0) {
            node.dynamicConnections.forEach((conn) => {
              const targets =
                dynamicConnectionTargetMap.get(conn.targetId) || [];
              targets.push({
                sourceId: conn.sourceId,
                type: conn.type,
              });
              dynamicConnectionTargetMap.set(conn.targetId, targets);
            });
          }
        });

        // Find top-level nodes that are contained in the box
        const containedElements = [];
        const processedIds = new Set<string | number>();

        for (const node of allElements) {
          // Skip if already processed (as a child of another node)
          if (processedIds.has(node.id)) continue;

          const element = document.querySelector(
            `[data-node-id="${node.id}"]`
          ) as HTMLElement;
          if (!element) continue;

          // Get element bounds in canvas coordinates
          const elRect = element.getBoundingClientRect();
          const elCanvasX =
            (elRect.left - rect.left - transform.x) / transform.scale;
          const elCanvasY =
            (elRect.top - rect.top - transform.y) / transform.scale;
          const elCanvasRight = elCanvasX + elRect.width / transform.scale;
          const elCanvasBottom = elCanvasY + elRect.height / transform.scale;

          // Check if element is completely inside box
          const isContained =
            elCanvasX >= boxRect.left &&
            elCanvasY >= boxRect.top &&
            elCanvasRight <= boxRect.right &&
            elCanvasBottom <= boxRect.bottom;

          if (isContained) {
            // Find the top-most parent that is still fully contained in the box
            let currentNode = node;
            let topMostContainedParent = node;
            let parentElement: HTMLElement | null = null;

            // Traverse up the parent chain
            while (currentNode.parentId) {
              const parent = allElements.find(
                (n) => n.id === currentNode.parentId
              );
              if (!parent) break;

              parentElement = document.querySelector(
                `[data-node-id="${parent.id}"]`
              ) as HTMLElement;

              if (parentElement) {
                const parentRect = parentElement.getBoundingClientRect();
                const parentCanvasX =
                  (parentRect.left - rect.left - transform.x) / transform.scale;
                const parentCanvasY =
                  (parentRect.top - rect.top - transform.y) / transform.scale;
                const parentCanvasRight =
                  parentCanvasX + parentRect.width / transform.scale;
                const parentCanvasBottom =
                  parentCanvasY + parentRect.height / transform.scale;

                const isParentContained =
                  parentCanvasX >= boxRect.left &&
                  parentCanvasY >= boxRect.top &&
                  parentCanvasRight <= boxRect.right &&
                  parentCanvasBottom <= boxRect.bottom;

                if (isParentContained) {
                  // This parent is also contained, continue up
                  topMostContainedParent = parent;
                  currentNode = parent;
                  continue;
                }
              }

              // Parent is not contained or not found, stop here
              break;
            }

            // Only add top-most parent to contained elements
            // Mark all descendants as processed
            const markDescendantsAsProcessed = (nodeId: string | number) => {
              processedIds.add(nodeId);
              const children = nodeChildrenMap.get(nodeId) || [];
              children.forEach((childId) =>
                markDescendantsAsProcessed(childId)
              );
            };

            if (!processedIds.has(topMostContainedParent.id)) {
              // Check if this is a dynamic element
              const isDynamic = !!(
                topMostContainedParent.isDynamic ||
                topMostContainedParent.dynamicFamilyId
              );

              containedElements.push({
                node: topMostContainedParent,
                absolutePosition: {
                  left: elCanvasX,
                  top: elCanvasY,
                },
                // Track if this is a dynamic connection target
                isDynamicTarget: dynamicConnectionTargetMap.has(
                  topMostContainedParent.id
                ),
                dynamicConnections:
                  dynamicConnectionTargetMap.get(topMostContainedParent.id) ||
                  [],
                isDynamic,
              });
              markDescendantsAsProcessed(topMostContainedParent.id);
            }
          }
        }

        // Track any dynamic elements that will be encapsulated
        encapsulatedDynamicElements = containedElements.filter(
          (item) => item.node.isDynamic && item.node.sharedId
        );

        // Check if we're drawing over a media element
        const targetFrame = targetFrameRef.current;
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        let mediaElement = null;

        for (const el of elementsUnder) {
          const mediaEl = el.closest(
            '[data-node-type="image"], [data-node-type="video"]'
          );
          if (mediaEl) {
            const mediaId = mediaEl.getAttribute("data-node-id");
            if (mediaId) {
              const mediaNode = allNodes.find((n) => n.id === mediaId);
              if (mediaNode) {
                mediaElement = { node: mediaNode, element: mediaEl };
                break;
              }
            }
          }
        }

        if (mediaElement) {
          // We're drawing over a media element - transform it to a frame
          newFrameId = nanoid();
          const newFrame = {
            id: newFrameId,
            type: "frame",
            style: {
              position: "relative",
              width: `${width / transform.scale}px`,
              height: `${height / transform.scale}px`,
              backgroundColor: "#97cffc",
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            inViewport: mediaElement.node.inViewport,
            sharedId: newFrameSharedId, // Add shared ID for cross-viewport sync
            // If in dynamic mode, add the dynamic parent ID
            ...(inDynamicMode && { dynamicParentId }),
            ...(inDynamicMode && {
              dynamicViewportId: activeViewportInDynamicMode,
            }),
          };

          // Add the new frame
          addNewNode({
            ...newFrame,
            position: "inside",
            targetId: getNodeParent(mediaElement.node.id),
          });

          // Move the media element inside the frame
          moveNode(mediaElement.node.id, newFrameId);

          // Update media element style
          updateNodeStyle(mediaElement.node.id, {
            position: "relative",
            left: "",
            top: "",
            zIndex: "",
          });

          // Process other contained elements if any (except the media element)
          if (containedElements.length > 0) {
            for (const item of containedElements) {
              // Skip the media element itself
              if (item.node.id === mediaElement.node.id) continue;

              // Update position to be relative within the new frame
              updateNodeStyle(item.node.id, {
                position: "relative",
                left: "",
                top: "",
              });

              // Move the whole hierarchy as is (maintains parent-child relationships)
              moveNode(item.node.id, newFrameId);

              // Handle dynamic connection targets
              if (item.isDynamicTarget) {
                // Update connections to point to the new frame instead
                updateDynamicConnections(
                  item.node.id,
                  newFrameId,
                  item.dynamicConnections
                );
              }
            }
          }
        } else if (targetFrame) {
          // Drawing over a frame - insert as child
          const frameChildren = allNodes
            .filter((n) => n.parentId === targetFrame.id)
            .map((node) => {
              const el = document.querySelector(`[data-node-id="${node.id}"]`);
              return el
                ? { id: node.id, rect: el.getBoundingClientRect() }
                : null;
            })
            .filter(
              (item): item is { id: string | number; rect: DOMRect } =>
                item !== null
            );

          newFrameId = nanoid();
          const newFrame = {
            id: newFrameId,
            type: "frame",
            style: {
              position: "relative",
              width: `${width / transform.scale}px`,
              height: `${height / transform.scale}px`,
              backgroundColor: "#97cffc",
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            inViewport: true,
            sharedId: newFrameSharedId, // Add shared ID for cross-viewport sync
            // If in dynamic mode, add the dynamic parent ID
            ...(inDynamicMode && { dynamicParentId }),
            ...(inDynamicMode && {
              dynamicViewportId: activeViewportInDynamicMode,
            }),
          };

          const dropIndicator = computeFrameDropIndicator(
            targetFrame.element,
            frameChildren,
            e.clientX,
            e.clientY
          );

          if (dropIndicator?.dropInfo) {
            // Add to specific position
            addNewNode({
              ...newFrame,
              position: dropIndicator.dropInfo.position,
              targetId: dropIndicator.dropInfo.targetId,
            });
          } else {
            // Add as child of target frame
            addNewNode({
              ...newFrame,
              position: "inside",
              targetId: targetFrame.id,
            });
          }

          // Process contained elements if any
          if (containedElements.length > 0) {
            for (const item of containedElements) {
              // Update position to be relative within the new frame
              updateNodeStyle(item.node.id, {
                position: "relative",
                left: "",
                top: "",
              });

              // Move node to the new frame, maintaining hierarchy
              moveNode(item.node.id, newFrameId);

              // Handle dynamic connection targets
              if (item.isDynamicTarget) {
                // Update connections to point to the new frame instead
                updateDynamicConnections(
                  item.node.id,
                  newFrameId,
                  item.dynamicConnections
                );
              }
            }
          }
        } else {
          // Drawing on canvas - create absolute positioned frame
          newFrameId = nanoid();
          const newFrame = {
            id: newFrameId,
            type: "frame",
            style: {
              position: "absolute",
              left: `${canvasX}px`,
              top: `${canvasY}px`,
              width: `${width / transform.scale}px`,
              height: `${height / transform.scale}px`,
              backgroundColor: "#97cffc",
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            inViewport: false,
            sharedId: newFrameSharedId, // Add shared ID for cross-viewport sync
            // If in dynamic mode, add both the dynamic parent ID and dynamicPosition
            ...(inDynamicMode && {
              dynamicParentId,
              dynamicPosition: { x: canvasX, y: canvasY },
              dynamicViewportId: activeViewportInDynamicMode,
            }),
          };

          // Add to root
          addNewNode({
            ...newFrame,
            position: null,
            targetId: null,
          });

          // Process contained elements if any
          if (containedElements.length > 0) {
            for (const item of containedElements) {
              // Update position to be relative within the new frame
              updateNodeStyle(item.node.id, {
                position: "relative",
                left: "",
                top: "",
              });

              // Move the whole hierarchy as is
              moveNode(item.node.id, newFrameId);

              // Handle dynamic connection targets
              if (item.isDynamicTarget) {
                // Update connections to point to the new frame instead
                updateDynamicConnections(
                  item.node.id,
                  newFrameId,
                  item.dynamicConnections
                );
              }
            }
          }
        }
      }

      if (!dynamicModeNodeId) {
        // Sync viewports to create duplicates
        // FIX: Pass newFrameId and sharedId explicitly when syncing viewports
        if (newFrameId) {
          console.log(
            `Syncing frame ${newFrameId} with shared ID ${newFrameSharedId}`,
            getNodeParent(newFrameId)
          );
          syncViewports(newFrameId, getNodeParent(newFrameId));
        }

        // After syncing viewports, fix the parent-child relationships for dynamic elements
        if (encapsulatedDynamicElements.length > 0 && newFrameSharedId) {
          // Extract the dynamic shared IDs
          const dynamicSharedIds = encapsulatedDynamicElements
            .map((item) => item.node.sharedId)
            .filter(Boolean);

          // If we have dynamic elements and a frame, fix their parenting directly
          if (dynamicSharedIds.length > 0) {
            // Step 1: Get all viewports
            const allNodes = getAllNodes();
            const viewports = allNodes.filter((n) => n.isViewport);

            // Step 2: Get all frames with the target shared ID
            const frames = allNodes.filter(
              (n) => n.sharedId === newFrameSharedId
            );

            // Step 3: Group frames by viewport
            const framesByViewport = new Map();
            for (const frame of frames) {
              // Find which viewport contains this frame
              let viewportId = null;
              let currentId = frame.parentId;

              while (currentId) {
                const parent = allNodes.find((n) => n.id === currentId);
                if (!parent) break;

                if (parent.isViewport) {
                  viewportId = parent.id;
                  break;
                }

                currentId = parent.parentId;
              }

              if (viewportId) {
                framesByViewport.set(viewportId, frame.id);
              }
            }

            // Step 4: For each dynamic sharedId, find all instances and move them to the correct frame
            for (const dynamicSharedId of dynamicSharedIds) {
              const dynamicNodes = allNodes.filter(
                (n) => n.sharedId === dynamicSharedId
              );

              for (const dynamicNode of dynamicNodes) {
                // Find which viewport contains this dynamic node
                let viewportId = null;
                let currentId = dynamicNode.parentId;

                while (currentId) {
                  const parent = allNodes.find((n) => n.id === currentId);
                  if (!parent) break;

                  if (parent.isViewport) {
                    viewportId = parent.id;
                    break;
                  }

                  currentId = parent.parentId;
                }

                // If we found the viewport and there's a matching frame
                if (viewportId && framesByViewport.has(viewportId)) {
                  const frameId = framesByViewport.get(viewportId);

                  // Only move if it's not already in the correct frame
                  if (dynamicNode.parentId !== frameId) {
                    console.log(
                      `Moving dynamic node ${dynamicNode.id} to frame ${frameId} in viewport ${viewportId}`
                    );

                    // Move the node to the frame
                    moveNode(dynamicNode.id, frameId);

                    // Update the style
                    updateNodeStyle(dynamicNode.id, {
                      position: "relative",
                      left: "",
                      top: "",
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Hide the style helper
      visualOps.hideStyleHelper();

      // Reset state
      setBox(null);
      targetFrameRef.current = null;
      canvasOps.setIsFrameModeActive(false);

      window.dispatchEvent(new Event("resize"));
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Make sure to hide the style helper when unmounting
      visualOps.hideStyleHelper();
    };
  }, [
    containerRef,
    box?.isDrawing,
    box?.startX,
    box?.startY,
    getTransform,
    getIsResizing,
    getIsRotating,
    getIsAdjustingGap,
    getIsAdjustingBorderRadius,
    getIsFrameModeActive,
    getDynamicModeNodeId,
    getActiveViewportInDynamicMode,
    getAllNodes,
    getNodeParent,
  ]);

  // Early return if not in frame mode or not drawing
  if (!box?.isDrawing) return null;

  const left = Math.min(box.startX, box.currentX);
  const top = Math.min(box.startY, box.currentY);
  const width = Math.abs(box.currentX - box.startX);
  const height = Math.abs(box.currentY - box.startY);

  return (
    <div
      className="absolute pointer-events-none border border-blue-500 bg-blue-500/10"
      style={{
        left,
        top,
        width,
        height,
        zIndex: 1000,
        userSelect: "none",
      }}
    />
  );
};

export default FrameCreator;
