import React, { useState, useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import {
  computeFrameDropIndicator,
  handleMediaToFrameTransformation,
} from "@/builder/context/utils";

interface DrawingBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDrawing: boolean;
}

export const FrameCreator: React.FC = () => {
  const {
    containerRef,
    nodeDisp,
    transform,
    nodeState,
    isFrameModeActive,
    setIsFrameModeActive,
    dragDisp,
    isResizing,
    isRotating,
    isAdjustingGap,
    dragState,
  } = useBuilder();
  const [box, setBox] = useState<DrawingBoxState | null>(null);
  const targetFrameRef = useRef<{ id: string; element: Element } | null>(null);

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
            const node = nodeState.nodes.find((n) => n.id === frameId);
            if (node) {
              return { id: frameId, element: frameEl };
            }
          }
        }
      }
      return null;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!isFrameModeActive) return;

      if (isResizing || isRotating || isAdjustingGap) return;

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
      dragDisp.updateStyleHelper({
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
      dragDisp.updateStyleHelper({
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

      const rect = canvas.getBoundingClientRect();
      const finalX = e.clientX - rect.left;
      const finalY = e.clientY - rect.top;

      // Calculate dimensions
      const left = Math.min(box.startX, finalX);
      const top = Math.min(box.startY, finalY);
      const width = Math.abs(finalX - box.startX);
      const height = Math.abs(finalY - box.startY);

      // Check if we're in dynamic mode
      const inDynamicMode = !!dragState.dynamicModeNodeId;
      const dynamicParentId = dragState.dynamicModeNodeId;

      // Variables to track encapsulated dynamic elements and frame info
      let encapsulatedDynamicElements = [];
      let newFrameId = null;
      let newFrameSharedId = nanoid(); // Generate a shared ID for frames

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
        const allElements = nodeState.nodes.filter(
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
              const mediaNode = nodeState.nodes.find((n) => n.id === mediaId);
              if (mediaNode) {
                mediaElement = { node: mediaNode, element: mediaEl };
                break;
              }
            }
          }
        }

        if (mediaElement) {
          // We're drawing over a media element - transform it to a frame
          const newFrame: Node = {
            id: nanoid(),
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
              dynamicViewportId: dragState.activeViewportInDynamicMode,
            }),
          };

          // Use the centralized transformation utility
          const transformed = handleMediaToFrameTransformation(
            mediaElement.node,
            newFrame,
            nodeDisp,
            "inside"
          );

          if (transformed) {
            newFrameId = newFrame.id;

            // Process other contained elements if any (except the media element)
            if (containedElements.length > 0) {
              const newFrameNode = nodeState.nodes.find(
                (n) => n.id === newFrame.id
              );
              if (newFrameNode) {
                for (const item of containedElements) {
                  // Skip the media element itself
                  if (item.node.id === mediaElement.node.id) continue;

                  // Update position to be relative within the new frame
                  nodeDisp.updateNodeStyle([item.node.id], {
                    position: "relative",
                    left: "",
                    top: "",
                  });

                  // Move the whole hierarchy as is (maintains parent-child relationships)
                  nodeDisp.moveNode(item.node.id, true, {
                    targetId: newFrame.id,
                    position: "inside",
                  });

                  // Handle dynamic connection targets
                  if (item.isDynamicTarget) {
                    // Update connections to point to the new frame instead
                    updateDynamicConnections(
                      item.node.id,
                      newFrame.id,
                      item.dynamicConnections
                    );
                  }
                }
              }
            }
          }
        } else if (targetFrame) {
          // Drawing over a frame - insert as child
          const frameChildren = nodeState.nodes
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

          const newFrame: Node = {
            id: nanoid(),
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
              dynamicViewportId: dragState.activeViewportInDynamicMode,
            }),
          };

          const dropIndicator = computeFrameDropIndicator(
            targetFrame.element,
            frameChildren,
            e.clientX,
            e.clientY
          );

          newFrameId = newFrame.id;

          if (dropIndicator?.dropInfo) {
            nodeDisp.addNode(
              newFrame,
              dropIndicator.dropInfo.targetId,
              dropIndicator.dropInfo.position,
              true
            );
          } else {
            // This is the critical line that ensures the frame is added as a child of the target frame
            nodeDisp.addNode(newFrame, targetFrame.id, "inside", true);
          }

          // Process contained elements if any
          if (containedElements.length > 0) {
            for (const item of containedElements) {
              // Update position to be relative within the new frame
              nodeDisp.updateNodeStyle([item.node.id], {
                position: "relative",
                left: "",
                top: "",
              });

              // Move node to the new frame, maintaining hierarchy
              nodeDisp.moveNode(item.node.id, true, {
                targetId: newFrameId,
                position: "inside",
              });

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
          const newFrame: Node = {
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
              dynamicViewportId: dragState.activeViewportInDynamicMode,
            }),
          };

          nodeDisp.addNode(newFrame, null, null, false);

          // Process contained elements if any
          if (containedElements.length > 0) {
            for (const item of containedElements) {
              // Update position to be relative within the new frame
              nodeDisp.updateNodeStyle([item.node.id], {
                position: "relative",
                left: "",
                top: "",
              });

              // Move the whole hierarchy as is
              nodeDisp.moveNode(item.node.id, true, {
                targetId: newFrameId,
                position: "inside",
              });

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

      if (!dragState.dynamicModeNodeId) {
        // Sync viewports to create duplicates
        nodeDisp.syncViewports();

        // After syncing viewports, fix the parent-child relationships for dynamic elements
        if (encapsulatedDynamicElements.length > 0 && newFrameSharedId) {
          // Extract the dynamic shared IDs
          const dynamicSharedIds = encapsulatedDynamicElements
            .map((item) => item.node.sharedId)
            .filter(Boolean);

          // If we have dynamic elements and a frame, fix their parenting directly
          if (dynamicSharedIds.length > 0) {
            // Step 1: Get all viewports
            const viewports = nodeState.nodes.filter((n) => n.isViewport);

            // Step 2: Get all frames with the target shared ID
            const frames = nodeState.nodes.filter(
              (n) => n.sharedId === newFrameSharedId
            );

            // Step 3: Group frames by viewport
            const framesByViewport = new Map();
            for (const frame of frames) {
              // Find which viewport contains this frame
              let viewportId = null;
              let currentId = frame.parentId;

              while (currentId) {
                const parent = nodeState.nodes.find((n) => n.id === currentId);
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
              const dynamicNodes = nodeState.nodes.filter(
                (n) => n.sharedId === dynamicSharedId
              );

              for (const dynamicNode of dynamicNodes) {
                // Find which viewport contains this dynamic node
                let viewportId = null;
                let currentId = dynamicNode.parentId;

                while (currentId) {
                  const parent = nodeState.nodes.find(
                    (n) => n.id === currentId
                  );
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
                    nodeDisp.updateNode(dynamicNode.id, {
                      parentId: frameId,
                      style: {
                        ...dynamicNode.style,
                        position: "relative",
                        left: "",
                        top: "",
                      },
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Hide the style helper
      dragDisp.hideStyleHelper();

      // Reset state
      setBox(null);
      targetFrameRef.current = null;
      setIsFrameModeActive(false);

      window.dispatchEvent(new Event("resize"));
    };

    // Helper function to update dynamic connections to point to a new target
    const updateDynamicConnections = (
      oldTargetId: string | number,
      newTargetId: string | number,
      connections: Array<{
        sourceId: string | number;
        type: "click" | "hover" | "mouseLeave";
      }>
    ) => {
      // For each source node that had a connection to the old target
      connections.forEach((conn) => {
        const sourceNode = nodeState.nodes.find((n) => n.id === conn.sourceId);
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

          // Update the source node with the modified connections
          nodeDisp.updateNode(conn.sourceId, {
            dynamicConnections: updatedConnections,
          });
        }
      });
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Make sure to hide the style helper when unmounting
      dragDisp.hideStyleHelper();
    };
  }, [
    containerRef,
    box?.isDrawing,
    isFrameModeActive,
    transform,
    nodeDisp,
    nodeState.nodes,
    setIsFrameModeActive,
    dragDisp,
    isResizing,
    isRotating,
    isAdjustingGap,
    box?.startX,
    box?.startY,
    dragState.dynamicModeNodeId,
    dragState.activeViewportInDynamicMode,
  ]);

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
