import { useBuilder } from "@/builder/context/builderState";
import {
  getDropPosition,
  computeFrameDropIndicator,
  computeSiblingReorderResult,
  getFilteredElementsUnderMouseDuringDrag,
  getCalibrationAdjustedPosition,
  isWithinViewport,
  findIndexWithinParent,
} from "./utils";
import { useEffect, useRef } from "react";
import { EDGE_SIZE, useAutoScroll } from "../hooks/useAutoScroll";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { createPlaceholder } from "./createPlaceholder";
import { nanoid } from "nanoid";

export const useMouseMove = () => {
  const {
    dragState,
    transform,
    contentRef,
    nodeDisp,
    dragDisp,
    nodeState,
    containerRef,
    setNodeStyle,
  } = useBuilder();

  const { startAutoScroll, updateScrollPosition, stopAutoScroll } =
    useAutoScroll();
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const originalIndexRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);

  // Original viewport data storage with exact indexes
  const originalViewportDataRef = useRef<{
    originalParentId: string | number | null;
    nodesToRestore: Array<{
      nodeId: string | number;
      parentId: string | number | null;
      index: number;
      siblings: Array<string | number>; // Store siblings to accurately determine position
    }>;
  } | null>(null);

  const hasLeftViewportRef = useRef(false);

  // Initialize viewport data when drag starts
  useEffect(() => {
    if (
      dragState.isDragging &&
      dragState.dragSource === "viewport" &&
      dragState.draggedNode &&
      !originalViewportDataRef.current
    ) {
      // Store main node data with siblings
      const mainNode = dragState.draggedNode.node;
      const siblings = nodeState.nodes
        .filter((n) => n.parentId === mainNode.parentId && n.id !== mainNode.id)
        .map((n) => n.id);

      const nodesToRestore = [
        {
          nodeId: mainNode.id,
          parentId: mainNode.parentId,
          index: findIndexWithinParent(
            nodeState.nodes,
            mainNode.id,
            mainNode.parentId
          ),
          siblings,
        },
      ];

      // Store data for additional nodes
      if (dragState.additionalDraggedNodes?.length) {
        dragState.additionalDraggedNodes.forEach((info) => {
          const node = info.node;
          const nodeSiblings = nodeState.nodes
            .filter((n) => n.parentId === node.parentId && n.id !== node.id)
            .map((n) => n.id);

          nodesToRestore.push({
            nodeId: node.id,
            parentId: node.parentId,
            index: findIndexWithinParent(
              nodeState.nodes,
              node.id,
              node.parentId
            ),
            siblings: nodeSiblings,
          });
        });
      }

      originalViewportDataRef.current = {
        originalParentId: mainNode.parentId,
        nodesToRestore,
      };
    }

    // Reset when drag ends
    if (!dragState.isDragging) {
      originalViewportDataRef.current = null;
      hasLeftViewportRef.current = false;
    }
  }, [
    dragState.isDragging,
    dragState.dragSource,
    dragState.draggedNode?.node.id,
  ]);

  return (e: MouseEvent) => {
    e.preventDefault();
    if (
      !dragState.isDragging ||
      !dragState.draggedNode ||
      !contentRef.current ||
      !containerRef.current
    ) {
      if (isAutoScrollingRef.current) {
        stopAutoScroll();
        isAutoScrollingRef.current = false;
      }
      return;
    }

    const draggedNode = dragState.draggedNode.node;
    const containerRect = containerRef.current.getBoundingClientRect();

    const rect = document
      .querySelector(`[data-node-dragged]`)
      ?.getBoundingClientRect();

    let finalX;
    let finalY;
    if (rect) {
      finalX =
        (rect!.left - containerRect.left - transform.x) / transform.scale;
      finalY = (rect!.top - containerRect.top - transform.y) / transform.scale;

      const adjustedPosition = getCalibrationAdjustedPosition(
        { x: finalX, y: finalY },
        draggedNode.style.rotate,
        transform
      );

      finalX = Math.round(adjustedPosition.x);
      finalY = Math.round(adjustedPosition.y);

      dragDisp.setDragPositions(finalX, finalY);
    }

    const isNearEdge =
      e.clientX <= containerRect.left + EDGE_SIZE ||
      e.clientX >= containerRect.right - EDGE_SIZE ||
      e.clientY <= containerRect.top + EDGE_SIZE ||
      e.clientY >= containerRect.bottom - EDGE_SIZE;

    if (isNearEdge) {
      if (!isAutoScrollingRef.current) {
        startAutoScroll(e.clientX, e.clientY, containerRef.current);
        isAutoScrollingRef.current = true;
      } else {
        updateScrollPosition(e.clientX, e.clientY);
      }
    } else if (isAutoScrollingRef.current) {
      stopAutoScroll();
      isAutoScrollingRef.current = false;
    }

    const canvasX =
      (e.clientX - containerRect.left - transform.x) / transform.scale;
    const canvasY =
      (e.clientY - containerRect.top - transform.y) / transform.scale;

    if (dragState.dragSource === "gripHandle") {
      const draggedElement = document.querySelector(
        `[data-node-id="${draggedNode.id}"]`
      ) as HTMLElement | null;

      if (!draggedElement) return;

      const parentElement = document.querySelector(
        `[data-node-id="${draggedNode.parentId}"]`
      );

      if (parentElement) {
        const reorderResult = computeSiblingReorderResult(
          draggedNode,
          nodeState.nodes,
          parentElement,
          e.clientX,
          e.clientY,
          prevMousePosRef.current.x,
          prevMousePosRef.current.y
        );
        if (reorderResult) {
          if (dragState.placeholderInfo) {
            // Get all nodes and placeholders info
            const allDraggedNodes = [
              {
                nodeId: draggedNode.id,
                placeholderId: dragState.placeholderInfo.mainPlaceholderId,
              },
              ...dragState.placeholderInfo.additionalPlaceholders,
            ];

            // Sort based on the original stored order
            const sortedNodes = allDraggedNodes.sort((a, b) => {
              const orderA = dragState.placeholderInfo!.nodeOrder.indexOf(
                a.nodeId
              );
              const orderB = dragState.placeholderInfo!.nodeOrder.indexOf(
                b.nodeId
              );
              return orderA - orderB;
            });

            // First move the first placeholder to establish the group position
            nodeDisp.moveNode(sortedNodes[0].placeholderId, true, {
              targetId: reorderResult.targetId,
              position: reorderResult.position,
            });

            // Then move each subsequent placeholder after the previous one
            for (let i = 1; i < sortedNodes.length; i++) {
              nodeDisp.moveNode(sortedNodes[i].placeholderId, true, {
                targetId: sortedNodes[i - 1].placeholderId,
                position: "after",
              });
            }
          } else {
            // Single node case
            const placeholder = nodeState.nodes.find(
              (n) => n.type === "placeholder"
            );
            if (placeholder) {
              nodeDisp.moveNode(placeholder.id, true, {
                targetId: reorderResult.targetId,
                position: reorderResult.position,
              });
            }
          }
        }
      }

      dragDisp.setDropInfo(
        dragState.dropInfo.targetId,
        dragState.dropInfo.position,
        canvasX,
        canvasY
      );
      return;
    }

    if (dragState.draggedItem) {
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);

      // Check for both frames and images as potential drop targets
      const dropTargetElement = elementsUnder.find(
        (el) =>
          el.getAttribute("data-node-type") === "frame" ||
          el.getAttribute("data-node-type") === "image" ||
          el.getAttribute("data-node-type") === "video"
      );

      if (dropTargetElement) {
        const targetId = dropTargetElement.getAttribute("data-node-id")!;
        const targetNode = nodeState.nodes.find(
          (n) => String(n.id) === targetId
        );
        const nodeType = dropTargetElement.getAttribute("data-node-type");

        if (targetNode?.isDynamic && !dragState.dynamicModeNodeId) {
          dragDisp.setDropInfo(null, null, canvasX, canvasY);
          return;
        }

        if (!targetNode) {
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // If it's an image, always set position to "inside" when hovering near center
        if (nodeType === "image" || nodeType === "video") {
          const rect = dropTargetElement.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distanceFromCenter = Math.sqrt(
            Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
          );
          const threshold = Math.min(rect.width, rect.height) * 0.4;

          if (distanceFromCenter < threshold) {
            dragDisp.setDropInfo(targetId, "inside", canvasX, canvasY);
            dragDisp.hideLineIndicator();
          } else {
            const { position, lineIndicator } = getDropPosition(
              e.clientY,
              rect,
              nodeType
            );
            if (position !== "inside") {
              dragDisp.setLineIndicator(lineIndicator);
            }
            dragDisp.setDropInfo(targetId, position, canvasX, canvasY);
          }
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // Existing frame handling logic
        const frameChildren = nodeState.nodes.filter(
          (child) => child.parentId === targetId
        );
        const childRects = frameChildren
          .map((childNode) => {
            const el = document.querySelector(
              `[data-node-id="${childNode.id}"]`
            ) as HTMLElement | null;
            return el
              ? { id: childNode.id, rect: el.getBoundingClientRect() }
              : null;
          })
          .filter((x): x is { id: string | number; rect: DOMRect } => !!x);

        const result = computeFrameDropIndicator(
          dropTargetElement,
          childRects,
          e.clientX,
          e.clientY
        );

        if (result) {
          dragDisp.setDropInfo(
            result.dropInfo.targetId,
            result.dropInfo.position,
            canvasX,
            canvasY
          );
          if (result.lineIndicator.show) {
            dragDisp.setLineIndicator(result.lineIndicator);
          } else {
            dragDisp.hideLineIndicator();
          }
        }

        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      } else {
        dragDisp.hideLineIndicator();
        dragDisp.setDropInfo(null, null, canvasX, canvasY);
      }
    }

    const overCanvas = getFilteredElementsUnderMouseDuringDrag(
      e,
      draggedNode.id,
      "canvas"
    );
    const draggedElement = document.querySelector(
      `[data-node-id="${draggedNode.id}"]`
    ) as HTMLElement | null;
    if (!draggedElement) return;

    // Check if we're over any viewport or frame in a viewport
    const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);

    // First check for direct viewport elements
    const viewportElement = elementsUnder.find((el) =>
      el.getAttribute("data-node-id")?.includes("viewport")
    );

    // Then check for frames within viewports
    const frameInViewportElements = elementsUnder.filter((el) => {
      const nodeId = el.getAttribute("data-node-id");
      if (!nodeId || nodeId.includes("viewport")) return false;

      const node = nodeState.nodes.find((n) => n.id.toString() === nodeId);
      return node && isWithinViewport(nodeId, nodeState.nodes);
    });

    const isOverViewportArea =
      viewportElement || frameInViewportElements.length > 0;

    // Original reordering logic - for when we're already in viewport
    const isReorderingNode =
      dragState.dragSource === "viewport" &&
      (draggedNode.inViewport || originalIndexRef.current !== null);

    // Detect re-entry into viewport after being on canvas
    if (
      isOverViewportArea &&
      hasLeftViewportRef.current &&
      originalViewportDataRef.current &&
      !dragState.placeholderInfo
    ) {
      console.log(
        "Re-entering viewport with node that originated from viewport"
      );
      const originalData = originalViewportDataRef.current;
      const mainNodeInfo = originalData.nodesToRestore.find(
        (info) => info.nodeId === dragState.draggedNode.node.id
      );

      if (mainNodeInfo) {
        // RECREATE PLACEHOLDERS WITH ACCURATE POSITIONS
        // 1. Get main node and its element
        const mainNode = dragState.draggedNode.node;
        const mainElement = document.querySelector(
          `[data-node-id="${mainNode.id}"]`
        ) as HTMLElement;

        if (mainElement) {
          // Get main node's parent and current siblings
          const parentId = mainNodeInfo.parentId;

          // Determine the target position
          let targetId: string | number | null = null;
          let position: "before" | "after" | "inside" = "inside";

          // Get the current siblings in the parent (excluding placeholders)
          const currentSiblings = nodeState.nodes
            .filter((n) => n.parentId === parentId && n.type !== "placeholder")
            .map((n) => n.id);

          // If there are current siblings, determine where to insert
          if (currentSiblings.length > 0) {
            // Calculate proper insertion position based on original index
            const originalIndex = mainNodeInfo.index;

            if (originalIndex === 0) {
              // It was first - insert before the current first sibling
              targetId = currentSiblings[0];
              position = "before";
            } else if (originalIndex >= currentSiblings.length) {
              // It was last or beyond - insert after the last sibling
              targetId = currentSiblings[currentSiblings.length - 1];
              position = "after";
            } else {
              // It was in the middle - insert before the node at that index
              targetId =
                currentSiblings[
                  Math.min(originalIndex, currentSiblings.length - 1)
                ];
              position = "before";
            }
          } else {
            // No siblings, insert directly inside parent
            targetId = parentId;
            position = "inside";
          }

          // 2. Get dimensions
          const mainDimensions = dragState.nodeDimensions[mainNode.id];

          // 3. Create main placeholder
          const mainPlaceholder = createPlaceholder({
            node: mainNode,
            element: mainElement,
            transform,
            finalWidth: mainDimensions?.finalWidth,
            finalHeight: mainDimensions?.finalHeight,
          });

          // 4. Insert placeholder at the calculated position
          if (targetId) {
            nodeDisp.insertAtIndex(mainPlaceholder, 0, parentId);
            nodeDisp.moveNode(mainPlaceholder.id, true, {
              targetId,
              position,
            });
          } else {
            // Fallback - just insert at beginning
            nodeDisp.insertAtIndex(mainPlaceholder, 0, parentId);
          }

          // 5. Create placeholders for additional nodes if any
          const additionalPlaceholders: Array<{
            placeholderId: string;
            nodeId: string | number;
          }> = [];

          if (dragState.additionalDraggedNodes?.length) {
            // Create and position each additional placeholder
            dragState.additionalDraggedNodes.forEach((info) => {
              const additionalNode = info.node;
              const originalAdditionalInfo = originalData.nodesToRestore.find(
                (d) => d.nodeId === additionalNode.id
              );

              if (!originalAdditionalInfo) return;

              const additionalElement = document.querySelector(
                `[data-node-id="${additionalNode.id}"]`
              ) as HTMLElement;

              if (additionalElement) {
                const dimensions = dragState.nodeDimensions[additionalNode.id];
                const additionalPlaceholder = createPlaceholder({
                  node: additionalNode,
                  element: additionalElement,
                  transform,
                  finalWidth: dimensions?.finalWidth,
                  finalHeight: dimensions?.finalHeight,
                });

                // Calculate original relative position for this node
                const additionalParentId = originalAdditionalInfo.parentId;
                const additionalOriginalIndex = originalAdditionalInfo.index;

                let additionalTargetId: string | number | null = null;
                let additionalPosition: "before" | "after" | "inside" =
                  "inside";

                // If same parent as main node, position after main placeholder
                if (additionalParentId === parentId) {
                  if (additionalPlaceholders.length > 0) {
                    additionalTargetId =
                      additionalPlaceholders[additionalPlaceholders.length - 1]
                        .placeholderId;
                    additionalPosition = "after";
                  } else {
                    additionalTargetId = mainPlaceholder.id;
                    additionalPosition = "after";
                  }
                } else {
                  // Different parent - handle original position in that parent
                  const addSiblings = nodeState.nodes
                    .filter(
                      (n) =>
                        n.parentId === additionalParentId &&
                        n.type !== "placeholder"
                    )
                    .map((n) => n.id);

                  if (addSiblings.length > 0) {
                    if (additionalOriginalIndex === 0) {
                      additionalTargetId = addSiblings[0];
                      additionalPosition = "before";
                    } else if (additionalOriginalIndex >= addSiblings.length) {
                      additionalTargetId = addSiblings[addSiblings.length - 1];
                      additionalPosition = "after";
                    } else {
                      additionalTargetId =
                        addSiblings[
                          Math.min(
                            additionalOriginalIndex,
                            addSiblings.length - 1
                          )
                        ];
                      additionalPosition = "before";
                    }
                  } else {
                    additionalTargetId = additionalParentId;
                    additionalPosition = "inside";
                  }
                }

                // Insert the placeholder
                nodeDisp.insertAtIndex(
                  additionalPlaceholder,
                  0,
                  additionalParentId
                );

                if (additionalTargetId) {
                  nodeDisp.moveNode(additionalPlaceholder.id, true, {
                    targetId: additionalTargetId,
                    position: additionalPosition,
                  });
                }

                additionalPlaceholders.push({
                  placeholderId: additionalPlaceholder.id,
                  nodeId: additionalNode.id,
                });
              }
            });
          }

          // 6. Set placeholder info
          const nodeOrder = [
            mainNode.id,
            ...(dragState.additionalDraggedNodes?.map((info) => info.node.id) ||
              []),
          ];

          dragDisp.setPlaceholderInfo({
            mainPlaceholderId: mainPlaceholder.id,
            nodeOrder,
            additionalPlaceholders,
          });

          // 7. Reset flag since we're back in viewport with proper placeholders
          hasLeftViewportRef.current = false;
        }
      }
    }

    if (isReorderingNode) {
      const parentElement = document.querySelector(
        `[data-node-id="${draggedNode.parentId}"]`
      );

      if (!parentElement) return;

      const reorderResult = computeSiblingReorderResult(
        draggedNode,
        nodeState.nodes,
        parentElement,
        e.clientX,
        e.clientY,
        prevMousePosRef.current.x,
        prevMousePosRef.current.y
      );

      if (reorderResult) {
        if (dragState.placeholderInfo) {
          // Get all nodes and placeholders info
          const allDraggedNodes = [
            {
              nodeId: draggedNode.id,
              placeholderId: dragState.placeholderInfo.mainPlaceholderId,
            },
            ...dragState.placeholderInfo.additionalPlaceholders,
          ];

          // Sort based on the original stored order
          const sortedNodes = allDraggedNodes.sort((a, b) => {
            const orderA = dragState.placeholderInfo!.nodeOrder.indexOf(
              a.nodeId
            );
            const orderB = dragState.placeholderInfo!.nodeOrder.indexOf(
              b.nodeId
            );
            return orderA - orderB;
          });

          // First move the first placeholder to establish the group position
          nodeDisp.moveNode(sortedNodes[0].placeholderId, true, {
            targetId: reorderResult.targetId,
            position: reorderResult.position,
          });

          // Then move each subsequent placeholder after the previous one
          for (let i = 1; i < sortedNodes.length; i++) {
            nodeDisp.moveNode(sortedNodes[i].placeholderId, true, {
              targetId: sortedNodes[i - 1].placeholderId,
              position: "after",
            });
          }
        } else {
          // Single node case
          const placeholder = nodeState.nodes.find(
            (n) => n.type === "placeholder"
          );
          if (placeholder) {
            nodeDisp.moveNode(placeholder.id, true, {
              targetId: reorderResult.targetId,
              position: reorderResult.position,
            });
          }
        }
      }
      dragDisp.hideLineIndicator();
    } else {
      dragDisp.hideLineIndicator();
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      const filteredElements = elementsUnder.filter((el) => {
        const closestNode = el.closest(`[data-node-id="${draggedNode.id}"]`);
        return !closestNode;
      });

      const frameElement = filteredElements.find(
        (el) => el.getAttribute("data-node-type") === "frame"
      );

      if (frameElement) {
        if (draggedNode.isViewport) {
          dragDisp.setDropInfo(null, null, canvasX, canvasY);
          dragDisp.hideLineIndicator();
          return;
        }

        const frameId = frameElement.getAttribute("data-node-id")!;
        const frameChildren = nodeState.nodes.filter(
          (child) => child.parentId === frameId
        );
        const frameNode = nodeState.nodes.find((n) => n.id === frameId);

        if (frameNode?.isDynamic && !dragState.dynamicModeNodeId) {
          dragDisp.setDropInfo(null, null, canvasX, canvasY);
          dragDisp.hideLineIndicator();
          return;
        }

        const hasChildren = frameChildren.length > 0;
        if (hasChildren) {
          const childRects = frameChildren
            .map((childNode) => {
              const el = document.querySelector(
                `[data-node-id="${childNode.id}"]`
              ) as HTMLElement | null;
              return el
                ? { id: childNode.id, rect: el.getBoundingClientRect() }
                : null;
            })
            .filter((x): x is { id: string | number; rect: DOMRect } => !!x);

          const result = computeFrameDropIndicator(
            frameElement,
            childRects,
            e.clientX,
            e.clientY
          );

          if (result && result.lineIndicator.show) {
            dragDisp.setDropInfo(
              result.dropInfo.targetId,
              result.dropInfo.position,
              canvasX,
              canvasY
            );
            dragDisp.setLineIndicator(result.lineIndicator);
          } else {
            dragDisp.setDropInfo(null, null, canvasX, canvasY);
            dragDisp.hideLineIndicator();
          }
        } else {
          const result = computeFrameDropIndicator(
            frameElement,
            [],
            e.clientX,
            e.clientY
          );

          if (result) {
            dragDisp.setDropInfo(
              result.dropInfo.targetId,
              result.dropInfo.position,
              canvasX,
              canvasY
            );
            dragDisp.hideLineIndicator();
          }
        }

        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const siblingElement = filteredElements.find((el) => {
        if (!el.hasAttribute("data-node-id")) return false;
        return el.getAttribute("data-node-type") !== "placeholder";
      });

      if (siblingElement) {
        const siblingId = siblingElement.getAttribute("data-node-id")!;
        const nodeType = siblingElement.getAttribute("data-node-type");
        const rect = siblingElement.getBoundingClientRect();

        const { position, lineIndicator } = getDropPosition(
          e.clientY,
          rect,
          nodeType
        );

        if (position !== "inside") {
          dragDisp.setLineIndicator(lineIndicator);
        }
        dragDisp.setDropInfo(siblingId, position, canvasX, canvasY);
      } else {
        dragDisp.setDropInfo(null, null, canvasX, canvasY);
      }
    }

    if (overCanvas) {
      dragDisp.setIsOverCanvas(true);

      // Mark that we've left the viewport (only if we were originally from viewport)
      if (
        dragState.dragSource === "viewport" &&
        originalViewportDataRef.current
      ) {
        hasLeftViewportRef.current = true;

        // Remove any existing placeholders (to allow future recreation)
        const allPlaceholders = nodeState.nodes.filter(
          (n) => n.type === "placeholder"
        );
        allPlaceholders.forEach((placeholder) => {
          nodeDisp.removeNode(placeholder.id);
        });

        // Clear placeholder info to ensure we can recreate later
        if (dragState.placeholderInfo) {
          dragDisp.setPlaceholderInfo(null);
        }
      }

      nodeDisp.moveNode(draggedNode.id, false);
      dragDisp.hideLineIndicator();
      dragDisp.setDropInfo(null, null, canvasX, canvasY);

      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (
        !dragState.dynamicModeNodeId &&
        (!draggedNode.isDynamic || draggedNode.inViewport)
      ) {
        nodeDisp.syncViewports();
      }
      return;
    }

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
