import { useBuilder } from "@/builder/context/builderState";
import {
  getDropPosition,
  computeFrameDropIndicator,
  computeSiblingReorderResult,
  getFilteredElementsUnderMouseDuringDrag,
  getCalibrationAdjustedPosition,
  isWithinViewport,
  findIndexWithinParent,
  isAbsoluteInFrame,
} from "../utils";
import { useEffect, useRef } from "react";
import {
  LEFT_EDGE_SIZE,
  RIGHT_EDGE_SIZE,
  useAutoScroll,
  VERTICAL_EDGE_SIZE,
} from "../hooks/useAutoScroll";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { createPlaceholder } from "./createPlaceholder";
import {
  dragOps,
  useGetAdditionalDraggedNodes,
  useGetDraggedItem,
  useGetDraggedNode,
  useGetDragSource,
  useGetDropInfo,
  useGetIsDragging,
  useGetNodeDimensions,
  useGetPlaceholderInfo,
} from "../atoms/drag-store";
import { visualOps } from "../atoms/visual-store";

// Helper to compute the furthest (root) container id for a given parent id.
const getRootContainerId = (
  parentId: string | number,
  nodes: Node[]
): string | number | null => {
  let currentId: string | number | null = parentId;
  let parent = nodes.find((n) => n.id === currentId);
  // Traverse up until there is no parent.
  while (parent && parent.parentId) {
    currentId = parent.parentId;
    parent = nodes.find((n) => n.id === currentId);
  }
  return currentId;
};

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
    draggingOverCanvasRef,
    hasLeftViewportRef,
  } = useBuilder();

  const getDraggedNode = useGetDraggedNode();

  const getIsDragging = useGetIsDragging();

  const getDraggedItem = useGetDraggedItem();

  const getAdditionalDraggedNodes = useGetAdditionalDraggedNodes();

  const getDropInfo = useGetDropInfo();

  const getDragSource = useGetDragSource();

  const getPlaceholderInfo = useGetPlaceholderInfo();

  const getNodeDimensions = useGetNodeDimensions();

  const { startAutoScroll, updateScrollPosition, stopAutoScroll } =
    useAutoScroll();
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const originalIndexRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);

  // Flag to ensure placeholders are only inserted once per re-entry.
  const hasReenteredContainerRef = useRef(false);

  // Remember the last drop info (target id & position) before leaving a container.
  const lastPlaceholderPositionRef = useRef<{
    targetId: string | number;
    position: "before" | "after" | "inside";
  } | null>(null);

  // Original container data storage.
  // We now store both:
  // - originalParentId: the immediate parent of the dragged node (for correct insertion)
  // - rootContainerId: the furthest parent in the chain.
  const originalViewportDataRef = useRef<{
    originalParentId: string | number | null;
    rootContainerId: string | number | null;
    nodesToRestore: Array<{
      nodeId: string | number;
      parentId: string | number | null;
      index: number;
      siblings: Array<string | number>;
    }>;
  } | null>(null);

  // Helper function to check if node is absolutely positioned within a frame

  // Helper function to check if node is absolutely positioned within a frame by ID
  const isNodeAbsoluteInFrame = (nodeId: string | number) => {
    const node = nodeState.nodes.find((n) => n.id === nodeId);
    return node ? isAbsoluteInFrame(node) : false;
  };

  // On drag start, store the original container info.
  useEffect(() => {
    const isDragging = getIsDragging();

    const draggedNode = getDraggedNode();

    const additionalDraggedNodes = getAdditionalDraggedNodes();

    if (isDragging && draggedNode && !originalViewportDataRef.current) {
      const mainNode = draggedNode.node;
      const siblings = nodeState.nodes
        .filter((n) => n.parentId === mainNode.parentId && n.id !== mainNode.id)
        .map((n) => n.id);

      const originalParentId = mainNode.parentId; // immediate parent
      const rootContainerId = getRootContainerId(
        originalParentId,
        nodeState.nodes
      );

      const nodesToRestore = [
        {
          nodeId: mainNode.id,
          parentId: originalParentId,
          index: findIndexWithinParent(
            nodeState.nodes,
            mainNode.id,
            originalParentId
          ),
          siblings,
        },
      ];

      if (additionalDraggedNodes?.length) {
        additionalDraggedNodes.forEach((info) => {
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
        originalParentId,
        rootContainerId,
        nodesToRestore,
      };
    }

    // Reset when drag ends.
    if (!isDragging) {
      originalViewportDataRef.current = null;
      hasLeftViewportRef.current = false;
      lastPlaceholderPositionRef.current = null;
      hasReenteredContainerRef.current = false;
    }
  }, [
    getIsDragging,
    getDraggedNode,
    nodeState.nodes,
    getAdditionalDraggedNodes,
  ]);

  // Helper: Check if the mouse is inside an element's bounds.
  const isOverContainer = (e: MouseEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  };

  // Helper: Get non-absolute siblings for a parent
  const getNonAbsoluteSiblings = (parentId: string | number | null) => {
    if (!parentId) return [];

    return nodeState.nodes.filter(
      (n) =>
        n.parentId === parentId &&
        // Filter out absolute positioned nodes
        !isAbsoluteInFrame(n) &&
        // Filter out placeholders
        n.type !== "placeholder"
    );
  };

  // Modified computeSiblingReorderResult that ignores absolute-in-frame elements
  const computeModifiedSiblingReorderResult = (
    draggedNode: Node,
    nodes: Node[],
    parentElement: Element,
    mouseX: number,
    mouseY: number,
    prevMouseX: number,
    prevMouseY: number
  ) => {
    // Only use siblings that are not absolute-in-frame
    const siblings = getNonAbsoluteSiblings(draggedNode.parentId);

    if (siblings.length === 0) {
      // If no valid siblings, return result for parent's inside position
      return {
        targetId: draggedNode.parentId!,
        position: "inside" as "before" | "after" | "inside",
      };
    }

    // Use the existing computeSiblingReorderResult but with filtered siblings
    return computeSiblingReorderResult(
      draggedNode,
      // Create modified node array with only non-absolute siblings
      nodes.filter(
        (n) =>
          n.id === draggedNode.id ||
          siblings.some((s) => s.id === n.id) ||
          n.id === draggedNode.parentId
      ),
      parentElement,
      mouseX,
      mouseY,
      prevMouseX,
      prevMouseY
    );
  };

  return (e: MouseEvent) => {
    e.preventDefault();

    const isDragging = getIsDragging();

    const placeholderInfo = getPlaceholderInfo();

    const nodeDimensions = getNodeDimensions();

    if (isDragging) {
      dragOps.setLastMousePosition(e.clientX, e.clientY);
    }

    const currentDraggedNode = getDraggedNode();

    if (
      !isDragging ||
      !currentDraggedNode ||
      !contentRef.current ||
      !containerRef.current
    ) {
      if (isAutoScrollingRef.current) {
        stopAutoScroll();
        isAutoScrollingRef.current = false;
      }
      return;
    }

    const draggedNode = currentDraggedNode.node;
    const containerRect = containerRef.current.getBoundingClientRect();

    const rect = document
      .querySelector(`[data-node-dragged]`)
      ?.getBoundingClientRect();
    let finalX: number, finalY: number;
    if (rect) {
      finalX = (rect.left - containerRect.left - transform.x) / transform.scale;
      finalY = (rect.top - containerRect.top - transform.y) / transform.scale;
      const adjustedPosition = getCalibrationAdjustedPosition(
        { x: finalX, y: finalY },
        draggedNode.style.rotate,
        transform
      );
      finalX = Math.round(adjustedPosition.x);
      finalY = Math.round(adjustedPosition.y);

      // console.log("is over canvas?");
      dragOps.setDragPositions(finalX, finalY);
    }

    const dragSource = getDragSource();

    // Handle absolute positioning in frames
    if (dragSource === "absolute-in-frame" || isAbsoluteInFrame(draggedNode)) {
      // Get the parent frame element
      const parentElement = document.querySelector(
        `[data-node-id="${draggedNode.parentId}"]`
      ) as HTMLElement | null;

      if (parentElement) {
        const parentRect = parentElement.getBoundingClientRect();

        // Check if mouse is still over parent frame
        const isOverParent =
          e.clientX >= parentRect.left &&
          e.clientX <= parentRect.right &&
          e.clientY >= parentRect.top &&
          e.clientY <= parentRect.bottom;

        if (isOverParent) {
          // Calculate position relative to parent frame
          const relativeX = (e.clientX - parentRect.left) / transform.scale;
          const relativeY = (e.clientY - parentRect.top) / transform.scale;

          // Update drag positions for visual feedback
          dragOps.setDragPositions(relativeX, relativeY);

          console.log(" drop info 20 ?");

          // Set drop info with parent as target and "absolute-inside" position mode
          dragOps.setDropInfo(
            draggedNode.parentId,
            "absolute-inside",
            relativeX,
            relativeY
          );

          // No need for reordering indicators
          visualOps.hideLineIndicator();

          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        } else {
          // Mouse left parent frame - convert to canvas absolute positioning
          const canvasX =
            (e.clientX - containerRect.left - transform.x) / transform.scale;
          const canvasY =
            (e.clientY - containerRect.top - transform.y) / transform.scale;

          dragOps.setDragPositions(canvasX, canvasY);

          console.log(" drop info 1 ?");

          dragOps.setDropInfo(null, null, canvasX, canvasY);
          dragOps.setIsOverCanvas(true);

          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
      }
    }

    // Handle auto-scrolling
    const isNearEdge = (
      clientX: number,
      clientY: number,
      containerRect: DOMRect
    ) => {
      const isNearLeftEdge = clientX <= containerRect.left + LEFT_EDGE_SIZE;
      const isNearRightEdge = clientX >= containerRect.right - RIGHT_EDGE_SIZE;

      const isNearHorizontalEdge = isNearLeftEdge || isNearRightEdge;

      const isNearVerticalEdge =
        clientY <= containerRect.top + VERTICAL_EDGE_SIZE ||
        clientY >= containerRect.bottom - VERTICAL_EDGE_SIZE;

      return isNearHorizontalEdge || isNearVerticalEdge;
    };

    const draggedItem = getDraggedItem();

    if (!draggedItem) {
      if (isNearEdge(e.clientX, e.clientY, containerRect)) {
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
    }

    const canvasX =
      (e.clientX - containerRect.left - transform.x) / transform.scale;
    const canvasY =
      (e.clientY - containerRect.top - transform.y) / transform.scale;

    // --- DRAG VIA GRIP HANDLE (moving within container) ---
    if (dragSource === "gripHandle") {
      const draggedElement = document.querySelector(
        `[data-node-id="${draggedNode.id}"]`
      ) as HTMLElement | null;
      if (!draggedElement) return;

      const parentElement = document.querySelector(
        `[data-node-id="${draggedNode.parentId}"]`
      );
      if (parentElement) {
        // Use modified reorder function that ignores absolute-in-frame elements
        const reorderResult = computeModifiedSiblingReorderResult(
          draggedNode,
          nodeState.nodes,
          parentElement,
          e.clientX,
          e.clientY,
          prevMousePosRef.current.x,
          prevMousePosRef.current.y
        );

        if (reorderResult) {
          // Make sure target is not an absolute-in-frame element
          if (
            reorderResult.position !== "inside" &&
            isNodeAbsoluteInFrame(reorderResult.targetId)
          ) {
            // Skip absolute targets for before/after positions
            prevMousePosRef.current = { x: e.clientX, y: e.clientY };
            return;
          }

          lastPlaceholderPositionRef.current = {
            targetId: reorderResult.targetId,
            position: reorderResult.position,
          };

          if (placeholderInfo) {
            const allDraggedNodes = [
              {
                nodeId: draggedNode.id,
                placeholderId: placeholderInfo.mainPlaceholderId,
              },
              ...placeholderInfo.additionalPlaceholders,
            ];
            const sortedNodes = allDraggedNodes.sort((a, b) => {
              const orderA = placeholderInfo!.nodeOrder.indexOf(a.nodeId);
              const orderB = placeholderInfo!.nodeOrder.indexOf(b.nodeId);
              return orderA - orderB;
            });
            nodeDisp.moveNode(sortedNodes[0].placeholderId, true, {
              targetId: reorderResult.targetId,
              position: reorderResult.position,
            });
            for (let i = 1; i < sortedNodes.length; i++) {
              nodeDisp.moveNode(sortedNodes[i].placeholderId, true, {
                targetId: sortedNodes[i - 1].placeholderId,
                position: "after",
              });
            }
          } else {
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

      console.log(" drop info 2 ?");

      const dropInfo = getDropInfo();
      dragOps.setDropInfo(
        dropInfo.targetId,
        dropInfo.position,
        canvasX,
        canvasY
      );
      return;
    }

    // --- DRAGGED ITEM (e.g. new element) handling ---
    if (draggedItem) {
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
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
          console.log(" drop info 3 ?");

          dragOps.setDropInfo(null, null, canvasX, canvasY);
          return;
        }
        if (!targetNode) {
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
        if (nodeType === "image" || nodeType === "video") {
          const rect = dropTargetElement.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distanceFromCenter = Math.sqrt(
            Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
          );
          const threshold = Math.min(rect.width, rect.height) * 0.4;
          if (distanceFromCenter < threshold) {
            console.log(" drop info 4 ?");

            dragOps.setDropInfo(targetId, "inside", canvasX, canvasY);
            visualOps.hideLineIndicator();
          } else {
            const { position, lineIndicator } = getDropPosition(
              e.clientY,
              rect,
              nodeType
            );
            if (position !== "inside") {
              visualOps.setLineIndicator(lineIndicator);
            }
            console.log(" drop info 5 ?");

            dragOps.setDropInfo(targetId, position, canvasX, canvasY);
          }
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // Get only non-absolute frame children for drop indicators
        const frameChildren = nodeState.nodes.filter(
          (child) => child.parentId === targetId && !isAbsoluteInFrame(child)
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
          console.log(" drop info 6 ?");

          dragOps.setDropInfo(
            result.dropInfo.targetId,
            result.dropInfo.position,
            canvasX,
            canvasY
          );
          if (result.lineIndicator.show) {
            visualOps.setLineIndicator(result.lineIndicator);
          } else {
            visualOps.hideLineIndicator();
          }
        }
        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      } else {
        visualOps.hideLineIndicator();

        console.log(" drop info 7 ?");

        dragOps.setDropInfo(null, null, canvasX, canvasY);
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

    const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
    const viewportElement = elementsUnder.find((el) =>
      el.getAttribute("data-node-id")?.includes("viewport")
    );
    const frameInViewportElements = elementsUnder.filter((el) => {
      const nodeId = el.getAttribute("data-node-id");
      if (!nodeId || nodeId.includes("viewport")) return false;
      const node = nodeState.nodes.find((n) => n.id.toString() === nodeId);
      return node && isWithinViewport(nodeId, nodeState.nodes);
    });
    const isOverViewportArea =
      viewportElement || frameInViewportElements.length > 0;
    const isReorderingNode =
      dragSource === "viewport" &&
      (draggedNode.inViewport || originalIndexRef.current !== null);

    // --- RE-ENTERING THE ORIGINAL CONTAINER ---
    // Now, instead of checking only the immediate parent, we check if the pointer is over the root container.
    if (
      originalViewportDataRef.current &&
      !placeholderInfo &&
      originalViewportDataRef.current.rootContainerId && // use the root container
      !hasReenteredContainerRef.current &&
      hasLeftViewportRef.current
    ) {
      const rootContainerElement = document.querySelector(
        `[data-node-id="${originalViewportDataRef.current.rootContainerId}"]`
      ) as HTMLElement | null;
      if (rootContainerElement && isOverContainer(e, rootContainerElement)) {
        console.log(
          "Re-entering original container (via root container) with stored placeholder data"
        );
        const originalData = originalViewportDataRef.current;
        const mainNodeInfo = originalData.nodesToRestore.find(
          (info) => info.nodeId === draggedNode.id
        );
        if (mainNodeInfo) {
          // Note: We still use the original immediate parent for insertion.
          const parentId = mainNodeInfo.parentId;
          let targetId: string | number | null = null;
          let position: "before" | "after" | "inside" = "inside";
          if (lastPlaceholderPositionRef.current) {
            targetId = lastPlaceholderPositionRef.current.targetId;
            position = lastPlaceholderPositionRef.current.position;
          } else {
            // Get only non-absolute siblings for positioning
            const currentSiblings = nodeState.nodes
              .filter(
                (n) =>
                  n.parentId === parentId &&
                  n.type !== "placeholder" &&
                  !isAbsoluteInFrame(n)
              )
              .map((n) => n.id);

            if (currentSiblings.length > 0) {
              const originalIndex = mainNodeInfo.index;
              if (originalIndex === 0) {
                targetId = currentSiblings[0];
                position = "before";
              } else if (originalIndex >= currentSiblings.length) {
                targetId = currentSiblings[currentSiblings.length - 1];
                position = "after";
              } else {
                targetId =
                  currentSiblings[
                    Math.min(originalIndex, currentSiblings.length - 1)
                  ];
                position = "before";
              }
            } else {
              targetId = parentId;
              position = "inside";
            }
          }
          const mainDimensions = nodeDimensions[draggedNode.id];
          const mainPlaceholder = createPlaceholder({
            node: draggedNode,
            element: draggedElement,
            transform,
            finalWidth: mainDimensions?.finalWidth,
            finalHeight: mainDimensions?.finalHeight,
          });
          if (targetId) {
            nodeDisp.insertAtIndex(mainPlaceholder, 0, parentId);
            nodeDisp.moveNode(mainPlaceholder.id, true, { targetId, position });
          } else {
            nodeDisp.insertAtIndex(mainPlaceholder, 0, parentId);
          }
          const additionalPlaceholders: Array<{
            placeholderId: string;
            nodeId: string | number;
          }> = [];

          const additionalDraggedNodes = getAdditionalDraggedNodes();

          if (additionalDraggedNodes?.length) {
            additionalDraggedNodes.forEach((info) => {
              const additionalNode = info.node;
              const originalAdditionalInfo = originalData.nodesToRestore.find(
                (d) => d.nodeId === additionalNode.id
              );
              if (!originalAdditionalInfo) return;
              const additionalElement = document.querySelector(
                `[data-node-id="${additionalNode.id}"]`
              ) as HTMLElement;
              if (additionalElement) {
                const dimensions = nodeDimensions[additionalNode.id];
                const additionalPlaceholder = createPlaceholder({
                  node: additionalNode,
                  element: additionalElement,
                  transform,
                  finalWidth: dimensions?.finalWidth,
                  finalHeight: dimensions?.finalHeight,
                });
                const additionalParentId = originalAdditionalInfo.parentId;
                const additionalOriginalIndex = originalAdditionalInfo.index;
                let additionalTargetId: string | number | null = null;
                let additionalPosition: "before" | "after" | "inside" =
                  "inside";
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
                  // Get only non-absolute siblings
                  const addSiblings = nodeState.nodes
                    .filter(
                      (n) =>
                        n.parentId === additionalParentId &&
                        n.type !== "placeholder" &&
                        !isAbsoluteInFrame(n)
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
          const nodeOrder = [
            draggedNode.id,
            ...(additionalDraggedNodes?.map((info) => info.node.id) || []),
          ];
          dragOps.setPlaceholderInfo({
            mainPlaceholderId: mainPlaceholder.id,
            nodeOrder,
            additionalPlaceholders,
          });
          hasLeftViewportRef.current = false;
          hasReenteredContainerRef.current = true;
        }
      }
    }

    if (isReorderingNode) {
      console.log(" REORDERING NODE ???");
      const parentElement = document.querySelector(
        `[data-node-id="${draggedNode.parentId}"]`
      );
      if (!parentElement) return;

      // Use the modified reorder function that ignores absolute-in-frame elements
      const reorderResult = computeModifiedSiblingReorderResult(
        draggedNode,
        nodeState.nodes,
        parentElement,
        e.clientX,
        e.clientY,
        prevMousePosRef.current.x,
        prevMousePosRef.current.y
      );

      if (reorderResult) {
        lastPlaceholderPositionRef.current = {
          targetId: reorderResult.targetId,
          position: reorderResult.position,
        };

        if (placeholderInfo) {
          const allDraggedNodes = [
            {
              nodeId: draggedNode.id,
              placeholderId: placeholderInfo.mainPlaceholderId,
            },
            ...placeholderInfo.additionalPlaceholders,
          ];
          const sortedNodes = allDraggedNodes.sort((a, b) => {
            const orderA = placeholderInfo!.nodeOrder.indexOf(a.nodeId);
            const orderB = placeholderInfo!.nodeOrder.indexOf(b.nodeId);
            return orderA - orderB;
          });
          nodeDisp.moveNode(sortedNodes[0].placeholderId, true, {
            targetId: reorderResult.targetId,
            position: reorderResult.position,
          });
          for (let i = 1; i < sortedNodes.length; i++) {
            nodeDisp.moveNode(sortedNodes[i].placeholderId, true, {
              targetId: sortedNodes[i - 1].placeholderId,
              position: "after",
            });
          }
        } else {
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

        dragOps.setDropInfo(
          reorderResult.targetId,
          reorderResult.position,
          canvasX,
          canvasY
        );
      }
      visualOps.hideLineIndicator();

      // If no reorderResult, still set a default dropInfo to ensure it's never null
      if (!reorderResult) {
        dragOps.setDropInfo(null, null, canvasX, canvasY);
      }
      visualOps.hideLineIndicator();
    } else {
      visualOps.hideLineIndicator();
      const filteredElements = elementsUnder.filter((el) => {
        const closestNode = el.closest(`[data-node-id="${draggedNode.id}"]`);
        return !closestNode;
      });

      console.log("here?");

      console.log("elementsUdner");

      const frameElement = filteredElements.find(
        (el) =>
          el.getAttribute("data-node-type") === "frame" ||
          el.getAttribute("data-node-type") === "image" ||
          el.getAttribute("data-node-type") === "video"
      );

      if (frameElement) {
        if (draggedNode.isViewport) {
          console.log(" drop info 8 ?");

          dragOps.setDropInfo(null, null, canvasX, canvasY);
          visualOps.hideLineIndicator();
          return;
        }

        const frameId = frameElement.getAttribute("data-node-id")!;
        const nodeType = frameElement.getAttribute("data-node-type");

        // Handle image/video elements as special drop targets
        if (nodeType === "image" || nodeType === "video") {
          const rect = frameElement.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distanceFromCenter = Math.sqrt(
            Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
          );
          const threshold = Math.min(rect.width, rect.height) * 0.4;

          if (distanceFromCenter < threshold) {
            console.log(" drop info 9 ?");

            dragOps.setDropInfo(frameId, "inside", canvasX, canvasY);
            visualOps.hideLineIndicator();
          } else {
            const { position, lineIndicator } = getDropPosition(
              e.clientY,
              rect,
              nodeType
            );
            if (position !== "inside") {
              visualOps.setLineIndicator(lineIndicator);
            }

            console.log(" drop info 10 ?");

            dragOps.setDropInfo(frameId, position, canvasX, canvasY);
          }
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // Get only non-absolute frame children
        const frameChildren = nodeState.nodes.filter(
          (child) => child.parentId === frameId && !isAbsoluteInFrame(child)
        );
        const frameNode = nodeState.nodes.find((n) => n.id === frameId);
        if (frameNode?.isDynamic && !dragState.dynamicModeNodeId) {
          console.log(" drop info 11 ?");

          dragOps.setDropInfo(null, null, canvasX, canvasY);
          visualOps.hideLineIndicator();
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
            console.log(" drop info 12 ?");

            dragOps.setDropInfo(
              result.dropInfo.targetId,
              result.dropInfo.position,
              canvasX,
              canvasY
            );
            visualOps.setLineIndicator(result.lineIndicator);
          } else {
            console.log(" drop info 13 ?");

            dragOps.setDropInfo(null, null, canvasX, canvasY);
            visualOps.hideLineIndicator();
          }
        } else {
          const result = computeFrameDropIndicator(
            frameElement,
            [],
            e.clientX,
            e.clientY
          );
          if (result) {
            console.log(" drop info 14 ?");

            dragOps.setDropInfo(
              result.dropInfo.targetId,
              result.dropInfo.position,
              canvasX,
              canvasY
            );
            visualOps.hideLineIndicator();
          }
        }
        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Find siblings but skip absolute-in-frame ones for line indicators
      const siblingElement = filteredElements.find((el) => {
        if (!el.hasAttribute("data-node-id")) return false;

        // Skip placeholder elements
        if (el.getAttribute("data-node-type") === "placeholder") return false;

        // Skip absolute-in-frame elements
        const nodeId = el.getAttribute("data-node-id");
        if (nodeId && isNodeAbsoluteInFrame(nodeId)) return false;

        return true;
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
          visualOps.setLineIndicator(lineIndicator);
        }

        console.log(" drop info 15 ?");

        dragOps.setDropInfo(siblingId, position, canvasX, canvasY);
      } else {
        console.log(" drop info 16 ?");

        dragOps.setDropInfo(null, null, canvasX, canvasY);
      }
    }

    if (overCanvas) {
      dragOps.setIsOverCanvas(true);
      if (dragSource === "viewport" && originalViewportDataRef.current) {
        console.log("Dragging over canvas from viewport");
        hasLeftViewportRef.current = true;

        // Only clear placeholders when dragging over canvas
        const allPlaceholders = nodeState.nodes.filter(
          (n) => n.type === "placeholder"
        );

        allPlaceholders.forEach((placeholder) => {
          nodeDisp.removeNode(placeholder.id);
        });

        if (placeholderInfo) {
          dragOps.setPlaceholderInfo(null);
        }

        // Flag that we've left the viewport but don't remove shared IDs yet
        hasReenteredContainerRef.current = false;
      }

      // Move the node to follow the cursor on the canvas
      nodeDisp.moveNode(draggedNode.id, false);
      visualOps.hideLineIndicator();

      console.log(" drop info 19 ?");

      dragOps.setDropInfo(null, null, canvasX, canvasY);
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      // Disable viewport syncing since we've left the viewport
      // but don't delete counterparts yet
      return;
    }

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
