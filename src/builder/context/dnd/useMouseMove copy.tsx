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

  // Original node data storage with full hierarchy information
  const originalNodeDataRef = useRef<{
    dragSource: string;
    originalNodes: Array<{
      nodeId: string | number;
      parentId: string | number | null;
      index: number;
      siblingIds: Array<string | number>; // All sibling IDs in order
      hierarchyChain: Array<string | number>; // Full parent hierarchy chain up to root
    }>;
  } | null>(null);

  useEffect(() => {
    if (
      dragState.isDragging &&
      dragState.placeholderInfo &&
      dragState.placeholderInfo.mainPlaceholderId
    ) {
      const mainPlaceholder = nodeState.nodes.find(
        (n) => n.id === dragState.placeholderInfo?.mainPlaceholderId
      );

      if (!mainPlaceholder) return;

      // Find current position information
      const targetId = dragState.dropInfo?.targetId || null;
      const position = dragState.dropInfo?.position || "inside";

      // Store current position data
      lastPlaceholderStateRef.current = {
        mainPlaceholderId: mainPlaceholder.id,
        additionalPlaceholders:
          dragState.placeholderInfo.additionalPlaceholders || [],
        mainParentId: mainPlaceholder.parentId,
        mainPosition: { targetId, position },
        nodeOrder: [...dragState.placeholderInfo.nodeOrder],
      };
    }
  }, [dragState.placeholderInfo, dragState.isDragging, nodeState.nodes]);

  const hasLeftParentRef = useRef(false);

  const lastPlaceholderStateRef = useRef<{
    mainPlaceholderId: string | number;
    additionalPlaceholders: Array<{
      placeholderId: string;
      nodeId: string | number;
    }>;
    mainParentId: string | number | null;
    mainPosition: {
      targetId: string | number | null;
      position: "before" | "after" | "inside";
    };
    nodeOrder: Array<string | number>;
  } | null>(null);

  // Initialize node data when drag starts
  useEffect(() => {
    if (
      dragState.isDragging &&
      (dragState.dragSource === "viewport" ||
        dragState.dragSource === "canvas") &&
      dragState.draggedNode &&
      (dragState.draggedNode.node.parentId ||
        dragState.dragSource === "viewport") &&
      !originalNodeDataRef.current
    ) {
      // Helper to get full hierarchy chain for a node
      const getNodeHierarchy = (
        nodeId: string | number
      ): Array<string | number> => {
        const chain: Array<string | number> = [];

        let currentId = nodeId;
        let currentNode = nodeState.nodes.find((n) => n.id === currentId);

        // Traverse up until we reach the root
        while (currentNode) {
          if (currentNode.parentId) {
            chain.unshift(currentNode.parentId);
            currentId = currentNode.parentId;
            currentNode = nodeState.nodes.find((n) => n.id === currentId);
          } else {
            break;
          }
        }

        return chain;
      };

      const collectNodeData = (nodeId: string | number) => {
        const node = nodeState.nodes.find((n) => n.id === nodeId);
        if (!node || (!node.parentId && dragState.dragSource !== "viewport"))
          return null;

        // Get ALL siblings including the node itself, in exact order
        const allSiblings = nodeState.nodes
          .filter((n) => n.parentId === node.parentId)
          .sort((a, b) => {
            const aIndex = findIndexWithinParent(
              nodeState.nodes,
              a.id,
              node.parentId
            );
            const bIndex = findIndexWithinParent(
              nodeState.nodes,
              b.id,
              node.parentId
            );
            return aIndex - bIndex;
          })
          .map((n) => n.id);

        // Find exact index of the node among its siblings
        const exactIndex = allSiblings.findIndex((id) => id === nodeId);

        // Get the full hierarchy chain
        const hierarchyChain = getNodeHierarchy(nodeId);

        return {
          nodeId,
          parentId: node.parentId,
          index: exactIndex,
          siblingIds: allSiblings,
          hierarchyChain,
        };
      };

      // Collect data for main node
      const mainNodeData = collectNodeData(dragState.draggedNode.node.id);
      const originalNodes = mainNodeData ? [mainNodeData] : [];

      // Collect data for all additional nodes
      if (dragState.additionalDraggedNodes?.length) {
        dragState.additionalDraggedNodes.forEach((info) => {
          const nodeData = collectNodeData(info.node.id);
          if (nodeData) {
            originalNodes.push(nodeData);
          }
        });
      }

      if (originalNodes.length > 0) {
        originalNodeDataRef.current = {
          dragSource: dragState.dragSource,
          originalNodes,
        };
        console.log("Stored original node data with hierarchy:", originalNodes);
      }
    }

    if (!dragState.isDragging) {
      originalNodeDataRef.current = null;
      hasLeftParentRef.current = false;
      lastPlaceholderStateRef.current = null;
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

    // Check if we're over any part of the original hierarchy
    const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);

    // Is user re-entering any part of the original hierarchy?
    let isOverHierarchy = false;
    let hierarchyElementId: string | number | null = null;

    if (originalNodeDataRef.current?.originalNodes.length > 0) {
      // Get the main node information including hierarchy
      const mainNodeInfo = originalNodeDataRef.current.originalNodes[0];

      if (mainNodeInfo) {
        // Check if we're over ANY element in the hierarchy chain
        for (const elementUnder of elementsUnder) {
          const elementId = elementUnder.getAttribute("data-node-id");
          if (!elementId) continue;

          // Check if this element is in the hierarchy chain
          if (
            // Check for parent
            elementId === mainNodeInfo.parentId?.toString() ||
            // Check for viewport (special case)
            (mainNodeInfo.hierarchyChain.length === 0 &&
              originalNodeDataRef.current.dragSource === "viewport" &&
              elementId.includes("viewport")) ||
            // Check for any ancestor in the hierarchy chain
            mainNodeInfo.hierarchyChain.some(
              (id) => id.toString() === elementId
            )
          ) {
            isOverHierarchy = true;
            hierarchyElementId = elementId;
            break;
          }
        }
      }
    }

    // Original reordering logic - for when we're already in a parent
    const isReorderingNode =
      dragState.dragSource !== "canvas" ||
      draggedNode.parentId !== null ||
      originalIndexRef.current !== null;

    // Detect re-entry into ANY part of original hierarchy after being detached
    if (
      isOverHierarchy &&
      hasLeftParentRef.current &&
      originalNodeDataRef.current &&
      !dragState.placeholderInfo
    ) {
      console.log(
        `Re-entering original hierarchy via element: ${hierarchyElementId}`
      );
      const originalData = originalNodeDataRef.current;

      // Find main node data
      const mainNodeInfo = originalData.originalNodes.find(
        (info) => info.nodeId === dragState.draggedNode.node.id
      );

      if (mainNodeInfo) {
        console.log("Recreating placeholder for node", mainNodeInfo);

        // Get main node element
        const mainNode = dragState.draggedNode.node;
        const mainElement = document.querySelector(
          `[data-node-id="${mainNode.id}"]`
        ) as HTMLElement;

        if (mainElement) {
          // Check if we have last placeholder position info
          if (lastPlaceholderStateRef.current) {
            console.log("Using last known placeholder position");
            const lastState = lastPlaceholderStateRef.current;

            // Get main dimensions
            const mainDimensions = dragState.nodeDimensions[mainNode.id];

            // Create main placeholder
            const mainPlaceholder = createPlaceholder({
              node: mainNode,
              element: mainElement,
              transform,
              finalWidth: mainDimensions?.finalWidth,
              finalHeight: mainDimensions?.finalHeight,
            });

            // Insert placeholder using last known parent
            nodeDisp.insertAtIndex(mainPlaceholder, 0, lastState.mainParentId);

            // Move to last known position
            if (lastState.mainPosition.targetId) {
              console.log(
                `Moving placeholder to ${lastState.mainPosition.position} of ${lastState.mainPosition.targetId}`
              );
              nodeDisp.moveNode(mainPlaceholder.id, true, {
                targetId: lastState.mainPosition.targetId,
                position: lastState.mainPosition.position,
              });
            }

            // Handle additional nodes if any
            const additionalPlaceholders: Array<{
              placeholderId: string;
              nodeId: string | number;
            }> = [];

            if (dragState.additionalDraggedNodes?.length) {
              // Process additional nodes using their last known positions
              for (const info of dragState.additionalDraggedNodes) {
                const additionalNode = info.node;
                const lastNodeInfo = lastState.additionalPlaceholders.find(
                  (p) => p.nodeId === additionalNode.id
                );

                if (!lastNodeInfo) continue;

                const additionalElement = document.querySelector(
                  `[data-node-id="${additionalNode.id}"]`
                ) as HTMLElement;

                if (!additionalElement) continue;

                const dimensions = dragState.nodeDimensions[additionalNode.id];
                const additionalNodeInfo = originalData.originalNodes.find(
                  (d) => d.nodeId === additionalNode.id
                );

                if (!additionalNodeInfo) continue;

                const additionalPlaceholder = createPlaceholder({
                  node: additionalNode,
                  element: additionalElement,
                  transform,
                  finalWidth: dimensions?.finalWidth,
                  finalHeight: dimensions?.finalHeight,
                });

                // Get the parent from original info
                const additionalParentId = additionalNodeInfo.parentId;

                // Insert at original parent
                nodeDisp.insertAtIndex(
                  additionalPlaceholder,
                  0,
                  additionalParentId
                );

                additionalPlaceholders.push({
                  placeholderId: additionalPlaceholder.id,
                  nodeId: additionalNode.id,
                });
              }

              // After all placeholders are created, set positions based on the original order
              const sortedNodes = additionalPlaceholders.sort((a, b) => {
                const orderA = lastState.nodeOrder.indexOf(a.nodeId);
                const orderB = lastState.nodeOrder.indexOf(b.nodeId);
                return orderA - orderB;
              });

              // Position additional nodes in correct order, first node comes after main placeholder
              if (sortedNodes.length > 0) {
                nodeDisp.moveNode(sortedNodes[0].placeholderId, true, {
                  targetId: mainPlaceholder.id,
                  position: "after",
                });
              }

              // Position remaining nodes in sequence
              for (let i = 1; i < sortedNodes.length; i++) {
                nodeDisp.moveNode(sortedNodes[i].placeholderId, true, {
                  targetId: sortedNodes[i - 1].placeholderId,
                  position: "after",
                });
              }
            }

            // Set placeholder info
            dragDisp.setPlaceholderInfo({
              mainPlaceholderId: mainPlaceholder.id,
              nodeOrder: lastState.nodeOrder,
              additionalPlaceholders,
            });
          } else {
            // ORIGINAL LOGIC (Fallback if we don't have last placeholder state)
            // Get original parent and create placeholder
            const parentId = mainNodeInfo.parentId;
            const mainDimensions = dragState.nodeDimensions[mainNode.id];

            const mainPlaceholder = createPlaceholder({
              node: mainNode,
              element: mainElement,
              transform,
              finalWidth: mainDimensions?.finalWidth,
              finalHeight: mainDimensions?.finalHeight,
            });

            // Calculate EXACT position based on original siblings
            let targetId: string | number | null = null;
            let position: "before" | "after" | "inside" = "inside";

            // Get all the current siblings that still exist (excluding dragged nodes)
            const allDraggedNodeIds = [
              mainNode.id,
              ...(dragState.additionalDraggedNodes?.map(
                (info) => info.node.id
              ) || []),
            ];

            const originalSiblings = mainNodeInfo.siblingIds;
            const remainingSiblings = originalSiblings.filter(
              (id) =>
                !allDraggedNodeIds.includes(id) &&
                nodeState.nodes.some(
                  (n) => n.id === id && n.parentId === parentId
                )
            );

            console.log("Original siblings:", originalSiblings);
            console.log("Remaining siblings:", remainingSiblings);
            console.log("Original index:", mainNodeInfo.index);

            if (remainingSiblings.length > 0) {
              // Find the sibling that should come after our placeholder
              let insertBeforeIndex = -1;

              // If we're at index 0, insert at the beginning
              if (mainNodeInfo.index === 0) {
                targetId = remainingSiblings[0];
                position = "before";
              }
              // Otherwise find the right position
              else {
                // Find the first remaining sibling that was after our node
                for (
                  let i = mainNodeInfo.index;
                  i < originalSiblings.length;
                  i++
                ) {
                  const siblingId = originalSiblings[i];
                  if (remainingSiblings.includes(siblingId)) {
                    insertBeforeIndex = i;
                    break;
                  }
                }

                if (insertBeforeIndex >= 0) {
                  // We found a sibling that was after our node
                  targetId = originalSiblings[insertBeforeIndex];
                  position = "before";
                } else {
                  // No siblings after our node, so append to the last one
                  targetId = remainingSiblings[remainingSiblings.length - 1];
                  position = "after";
                }
              }
            } else {
              // No siblings left, insert directly into parent
              targetId = parentId;
              position = "inside";
            }

            // Insert the placeholder
            nodeDisp.insertAtIndex(mainPlaceholder, 0, parentId);

            if (targetId) {
              console.log(`Moving placeholder to ${position} of ${targetId}`);
              nodeDisp.moveNode(mainPlaceholder.id, true, {
                targetId,
                position,
              });
            }

            // Now handle additional nodes if any
            const additionalPlaceholders: Array<{
              placeholderId: string;
              nodeId: string | number;
            }> = [];

            if (dragState.additionalDraggedNodes?.length) {
              // Process each additional node with the same logic
              for (const info of dragState.additionalDraggedNodes) {
                const additionalNode = info.node;
                const additionalNodeInfo = originalData.originalNodes.find(
                  (d) => d.nodeId === additionalNode.id
                );

                if (!additionalNodeInfo) continue;

                const additionalElement = document.querySelector(
                  `[data-node-id="${additionalNode.id}"]`
                ) as HTMLElement;

                if (!additionalElement) continue;

                const additionalParentId = additionalNodeInfo.parentId;
                const dimensions = dragState.nodeDimensions[additionalNode.id];

                const additionalPlaceholder = createPlaceholder({
                  node: additionalNode,
                  element: additionalElement,
                  transform,
                  finalWidth: dimensions?.finalWidth,
                  finalHeight: dimensions?.finalHeight,
                });

                // Get all the siblings for this node
                const additionalOriginalSiblings =
                  additionalNodeInfo.siblingIds;
                const additionalRemainingSiblings =
                  additionalOriginalSiblings.filter(
                    (id) =>
                      !allDraggedNodeIds.includes(id) &&
                      nodeState.nodes.some(
                        (n) => n.id === id && n.parentId === additionalParentId
                      )
                  );

                let addTargetId: string | number | null = null;
                let addPosition: "before" | "after" | "inside" = "inside";

                if (additionalRemainingSiblings.length > 0) {
                  // Find correct placement with same logic as main node
                  let insertBeforeIndex = -1;

                  if (additionalNodeInfo.index === 0) {
                    addTargetId = additionalRemainingSiblings[0];
                    addPosition = "before";
                  } else {
                    for (
                      let i = additionalNodeInfo.index;
                      i < additionalOriginalSiblings.length;
                      i++
                    ) {
                      const siblingId = additionalOriginalSiblings[i];
                      if (additionalRemainingSiblings.includes(siblingId)) {
                        insertBeforeIndex = i;
                        break;
                      }
                    }

                    if (insertBeforeIndex >= 0) {
                      addTargetId =
                        additionalOriginalSiblings[insertBeforeIndex];
                      addPosition = "before";
                    } else {
                      addTargetId =
                        additionalRemainingSiblings[
                          additionalRemainingSiblings.length - 1
                        ];
                      addPosition = "after";
                    }
                  }
                } else {
                  addTargetId = additionalParentId;
                  addPosition = "inside";
                }

                nodeDisp.insertAtIndex(
                  additionalPlaceholder,
                  0,
                  additionalParentId
                );

                if (addTargetId) {
                  nodeDisp.moveNode(additionalPlaceholder.id, true, {
                    targetId: addTargetId,
                    position: addPosition,
                  });
                }

                additionalPlaceholders.push({
                  placeholderId: additionalPlaceholder.id,
                  nodeId: additionalNode.id,
                });
              }
            }

            // Set placeholder info
            const nodeOrder = [
              mainNode.id,
              ...(dragState.additionalDraggedNodes?.map(
                (info) => info.node.id
              ) || []),
            ];

            dragDisp.setPlaceholderInfo({
              mainPlaceholderId: mainPlaceholder.id,
              nodeOrder,
              additionalPlaceholders,
            });
          }

          // Reset flag since we're back with proper placeholders
          hasLeftParentRef.current = false;
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

      // Mark that we've left the parent (this works for both viewport and canvas frames)
      if (
        (dragState.dragSource === "viewport" ||
          draggedNode.parentId !== null) &&
        originalNodeDataRef.current
      ) {
        hasLeftParentRef.current = true;

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
