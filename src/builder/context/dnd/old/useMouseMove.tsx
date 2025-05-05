import {
  useBuilderDynamic,
  useBuilderRefs,
} from "@/builder/context/builderState";
import {
  getDropPosition,
  computeFrameDropIndicator,
  computeSiblingReorderResult,
  getFilteredElementsUnderMouseDuringDrag,
  getCalibrationAdjustedPosition,
  isWithinViewport,
  isAbsoluteInFrame,
} from "../utils";
import { useEffect, useRef } from "react";
import {
  LEFT_EDGE_SIZE,
  RIGHT_EDGE_SIZE,
  useAutoScroll,
  VERTICAL_EDGE_SIZE,
} from "../hooks/useAutoScroll";
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
} from "../atoms/drag-store";
import { visualOps } from "../atoms/visual-store";
import { useGetTransform } from "../atoms/canvas-interaction-store";
import {
  NodeId,
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeDynamicInfo,
} from "../atoms/node-store";
import {
  addNode,
  insertAtIndex,
  moveNode,
  removeNode,
} from "../atoms/node-store/operations/insert-operations";
import {
  useGetNodeParent,
  useGetNodeChildren,
  useRootNodes,
} from "../atoms/node-store/hierarchy-store";

// Helper to compute the furthest (root) container id for a given parent id.
const getRootContainerId = (
  parentId: NodeId,
  getNodeParent: (id: NodeId) => NodeId | null
): NodeId | null => {
  let currentId: NodeId | null = parentId;

  // Traverse up until there is no parent
  while (currentId !== null) {
    const parent = getNodeParent(currentId);
    if (parent === null) break;
    currentId = parent;
  }

  return currentId;
};

export const useMouseMove = () => {
  const { startRecording, stopRecording } = useBuilderDynamic();
  const { contentRef, containerRef, hasLeftViewportRef } = useBuilderRefs();

  // Get non-reactive getters
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();

  const currentTransform = useGetTransform();
  const getDraggedNode = useGetDraggedNode();
  const getIsDragging = useGetIsDragging();
  const getDraggedItem = useGetDraggedItem();
  const getAdditionalDraggedNodes = useGetAdditionalDraggedNodes();
  const getDropInfo = useGetDropInfo();
  const getDragSource = useGetDragSource();
  const getPlaceholderInfo = useGetPlaceholderInfo();
  const getNodeDimensions = useGetNodeDimensions();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  const { startAutoScroll, updateScrollPosition, stopAutoScroll } =
    useAutoScroll();
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const originalIndexRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);

  // Flag to ensure placeholders are only inserted once per re-entry.
  const hasReenteredContainerRef = useRef(false);

  // Remember the last drop info (target id & position) before leaving a container.
  const lastPlaceholderPositionRef = useRef<{
    targetId: NodeId;
    position: "before" | "after" | "inside";
  } | null>(null);

  // Add reference to track the last reorder target to avoid redundant updates
  const lastReorderRef = useRef<{
    targetId: NodeId;
    position: "before" | "after" | "inside";
  } | null>(null);

  // Helper to check if reorder target has changed
  const isSameReorderTarget = (
    result: {
      targetId: NodeId;
      position: "before" | "after" | "inside";
    } | null
  ) => {
    if (!result || !lastReorderRef.current) return false;
    return (
      result.targetId === lastReorderRef.current.targetId &&
      result.position === lastReorderRef.current.position
    );
  };

  // Original container data storage.
  const originalViewportDataRef = useRef<{
    originalParentId: NodeId | null;
    rootContainerId: NodeId | null;
    nodesToRestore: Array<{
      nodeId: NodeId;
      parentId: NodeId | null;
      index: number;
      siblings: Array<NodeId>;
    }>;
  } | null>(null);

  // Helper function to check if node is absolutely positioned within a frame by ID
  const isNodeAbsoluteInFrame = (nodeId: NodeId) => {
    const nodeFlags = getNodeFlags(nodeId);
    return nodeFlags.isAbsoluteInFrame === true;
  };

  // Helper function to check if a node is within a viewport
  const isNodeWithinViewport = (nodeId: NodeId): boolean => {
    if (!nodeId) return false;

    // Get node data (using individual calls instead of the hooks directly)
    const nodeFlags = getNodeFlags(nodeId);
    const nodeDynamicInfo = getNodeDynamicInfo(nodeId);

    // Direct checks
    if (nodeFlags.isViewport) return true;
    if (nodeFlags.inViewport) return true;

    // Dynamic node checks
    if (nodeDynamicInfo.dynamicViewportId) {
      // If it has a dynamicViewportId, it's logically within that viewport
      return true;
    }

    if (nodeDynamicInfo.originalState?.inViewport) {
      // If it was originally in a viewport (for dynamic nodes)
      return true;
    }

    // Check if parent is a dynamic node with viewport connection
    const parentId = getNodeParent(nodeId);
    if (parentId) {
      const parentDynamicInfo = getNodeDynamicInfo(parentId);

      if (
        parentDynamicInfo.dynamicViewportId ||
        parentDynamicInfo.originalState?.inViewport
      ) {
        return true;
      }

      // Recurse up the parent chain for traditional viewport relationships
      return isNodeWithinViewport(parentId);
    }

    return false;
  };

  // On drag start, store the original container info.
  useEffect(() => {
    const isDragging = getIsDragging();
    const draggedNode = getDraggedNode();
    const additionalDraggedNodes = getAdditionalDraggedNodes();

    if (isDragging && draggedNode && !originalViewportDataRef.current) {
      const mainNode = draggedNode.node;
      const parentId = getNodeParent(mainNode.id);

      // Get siblings from the hierarchy store
      const siblings = parentId
        ? getNodeChildren(parentId).filter((id) => id !== mainNode.id)
        : [];

      // Get the root container ID
      const rootContainerId = parentId
        ? getRootContainerId(parentId, getNodeParent)
        : null;

      // Find index within parent (children are already ordered)
      let index = 0;
      if (parentId) {
        const children = getNodeChildren(parentId);
        index = children.indexOf(mainNode.id);
        if (index === -1) index = 0;
      }

      const nodesToRestore = [
        {
          nodeId: mainNode.id,
          parentId,
          index,
          siblings,
        },
      ];

      if (additionalDraggedNodes?.length) {
        additionalDraggedNodes.forEach((info) => {
          const node = info.node;
          const nodeParentId = getNodeParent(node.id);

          // Get siblings for this node too
          const nodeSiblings = nodeParentId
            ? getNodeChildren(nodeParentId).filter((id) => id !== node.id)
            : [];

          // Find index within parent
          let nodeIndex = 0;
          if (nodeParentId) {
            const nodeChildren = getNodeChildren(nodeParentId);
            nodeIndex = nodeChildren.indexOf(node.id);
            if (nodeIndex === -1) nodeIndex = 0;
          }

          nodesToRestore.push({
            nodeId: node.id,
            parentId: nodeParentId,
            index: nodeIndex,
            siblings: nodeSiblings,
          });
        });
      }

      originalViewportDataRef.current = {
        originalParentId: parentId,
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
      lastReorderRef.current = null;
    }
  }, [
    getIsDragging,
    getDraggedNode,
    getAdditionalDraggedNodes,
    getNodeParent,
    getNodeChildren,
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
  const getNonAbsoluteSiblings = (parentId: NodeId | null) => {
    if (!parentId) return [];

    return getNodeChildren(parentId).filter((id) => {
      // Skip absolute positioned nodes and placeholders
      const nodeFlags = getNodeFlags(id);
      const nodeBasics = getNodeBasics(id);

      return !nodeFlags.isAbsoluteInFrame && nodeBasics.type !== "placeholder";
    });
  };

  // Modified computeSiblingReorderResult that ignores absolute-in-frame elements
  const computeModifiedSiblingReorderResult = (
    draggedNode: { id: NodeId },
    parentElement: Element,
    mouseX: number,
    mouseY: number,
    prevMouseX: number,
    prevMouseY: number
  ) => {
    const parentId = getNodeParent(draggedNode.id);

    // Only use siblings that are not absolute-in-frame
    const siblings = getNonAbsoluteSiblings(parentId);

    if (siblings.length === 0) {
      // If no valid siblings, return result for parent's inside position
      return {
        targetId: parentId!,
        position: "inside" as "before" | "after" | "inside",
      };
    }

    // Use DOM-based sibling positioning
    const siblingElements = siblings
      .map((id) => {
        const el = document.querySelector(`[data-node-id="${id}"]`);
        return el ? { id, element: el } : null;
      })
      .filter(Boolean);

    // Use the DOM positions to determine before/after position
    const mouseYDirection = mouseY - prevMouseY;
    const mouseXDirection = mouseX - prevMouseX;

    // Sort elements by their vertical position
    const sortedElements = siblingElements.sort((a, b) => {
      const rectA = a!.element.getBoundingClientRect();
      const rectB = b!.element.getBoundingClientRect();
      return rectA.top - rectB.top;
    });

    for (let i = 0; i < sortedElements.length; i++) {
      const el = sortedElements[i]!.element;
      const rect = el.getBoundingClientRect();

      // Simple midpoint check
      if (mouseY < rect.top + rect.height / 2) {
        return {
          targetId: sortedElements[i]!.id,
          position: "before" as "before" | "after" | "inside",
        };
      }
    }

    // If we get here, position after the last element
    return {
      targetId: sortedElements[sortedElements.length - 1]!.id,
      position: "after" as "before" | "after" | "inside",
    };
  };

  return (e: MouseEvent) => {
    e.preventDefault();

    const isDragging = getIsDragging();
    const placeholderInfo = getPlaceholderInfo();
    const nodeDimensions = getNodeDimensions();
    const dynamicModeNodeId = getDynamicModeNodeId();

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

    const transform = currentTransform();

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

      dragOps.setDragPositions(finalX, finalY);
    }

    const dragSource = getDragSource();

    // Handle absolute positioning in frames
    if (
      dragSource === "absolute-in-frame" ||
      getNodeFlags(draggedNode.id).isAbsoluteInFrame
    ) {
      // Get the parent frame element
      const parentId = getNodeParent(draggedNode.id);
      if (!parentId) return;

      const parentElement = document.querySelector(
        `[data-node-id="${parentId}"]`
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

          // Set drop info with parent as target and "absolute-inside" position mode
          dragOps.setDropInfo(
            parentId,
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

      const parentId = getNodeParent(draggedNode.id);
      if (!parentId) return;

      const parentElement = document.querySelector(
        `[data-node-id="${parentId}"]`
      );
      if (parentElement) {
        // Use modified reorder function that ignores absolute-in-frame elements
        const reorderResult = computeModifiedSiblingReorderResult(
          draggedNode,
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

          // Only update placeholder position if it's changed - FIX FOR JITTER
          if (!isSameReorderTarget(reorderResult)) {
            // Save the new reorder target
            lastReorderRef.current = {
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

              // Move the first placeholder to the target position
              moveNode(
                sortedNodes[0].placeholderId,
                reorderResult.position === "inside"
                  ? reorderResult.targetId
                  : getNodeParent(reorderResult.targetId),
                reorderResult.position === "inside"
                  ? undefined
                  : getNodeChildren(
                      getNodeParent(reorderResult.targetId)!
                    ).indexOf(reorderResult.targetId) +
                      (reorderResult.position === "after" ? 1 : 0)
              );

              // Move additional placeholders after the first one
              for (let i = 1; i < sortedNodes.length; i++) {
                moveNode(
                  sortedNodes[i].placeholderId,
                  getNodeParent(sortedNodes[i - 1].placeholderId)!,
                  getNodeChildren(
                    getNodeParent(sortedNodes[i - 1].placeholderId)!
                  ).indexOf(sortedNodes[i - 1].placeholderId) + 1
                );
              }
            } else {
              // Find placeholders using DOM query
              const placeholderElements = document.querySelectorAll(
                '[data-node-type="placeholder"]'
              );
              if (placeholderElements.length > 0) {
                const placeholderId =
                  placeholderElements[0].getAttribute("data-node-id");
                if (placeholderId) {
                  moveNode(
                    placeholderId,
                    reorderResult.position === "inside"
                      ? reorderResult.targetId
                      : getNodeParent(reorderResult.targetId),
                    reorderResult.position === "inside"
                      ? undefined
                      : getNodeChildren(
                          getNodeParent(reorderResult.targetId)!
                        ).indexOf(reorderResult.targetId) +
                          (reorderResult.position === "after" ? 1 : 0)
                  );
                }
              }
            }
          }
        }

        const dropInfo = getDropInfo();
        dragOps.setDropInfo(
          dropInfo.targetId,
          dropInfo.position,
          canvasX,
          canvasY
        );
        return;
      }
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
        const nodeType = dropTargetElement.getAttribute("data-node-type");

        // Check if target is a dynamic node
        const targetFlags = getNodeFlags(targetId);
        if (targetFlags.isDynamic && !dynamicModeNodeId) {
          dragOps.setDropInfo(null, null, canvasX, canvasY);
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
            dragOps.setDropInfo(targetId, position, canvasX, canvasY);
          }
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // Get only non-absolute frame children for drop indicators
        const children = getNodeChildren(targetId);
        const frameChildren = children.filter(
          (childId) => !isNodeAbsoluteInFrame(childId)
        );

        const childRects = frameChildren
          .map((childId) => {
            const el = document.querySelector(
              `[data-node-id="${childId}"]`
            ) as HTMLElement | null;
            return el
              ? { id: childId, rect: el.getBoundingClientRect() }
              : null;
          })
          .filter((x): x is { id: NodeId; rect: DOMRect } => !!x);

        const result = computeFrameDropIndicator(
          dropTargetElement,
          childRects,
          e.clientX,
          e.clientY
        );

        if (result) {
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

    // Check if elements are within a viewport
    const frameInViewportElements = elementsUnder.filter((el) => {
      const nodeId = el.getAttribute("data-node-id");
      if (!nodeId || nodeId.includes("viewport")) return false;
      return isNodeWithinViewport(nodeId);
    });

    const isOverViewportArea =
      viewportElement || frameInViewportElements.length > 0;

    // Check if reordering a node within its parent
    const nodeFlags = getNodeFlags(draggedNode.id);
    const isReorderingNode =
      dragSource === "viewport" &&
      (nodeFlags.inViewport || originalIndexRef.current !== null);

    // --- RE-ENTERING THE ORIGINAL CONTAINER ---
    if (
      originalViewportDataRef.current &&
      !placeholderInfo &&
      originalViewportDataRef.current.rootContainerId && // use the root container
      !hasReenteredContainerRef.current &&
      hasLeftViewportRef.current
    ) {
      const rootContainerId = originalViewportDataRef.current.rootContainerId;
      const rootContainerElement = document.querySelector(
        `[data-node-id="${rootContainerId}"]`
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
          // Use the original immediate parent for insertion
          const parentId = mainNodeInfo.parentId;
          if (!parentId) return;

          let targetId: NodeId | null = null;
          let position: "before" | "after" | "inside" = "inside";

          if (lastPlaceholderPositionRef.current) {
            targetId = lastPlaceholderPositionRef.current.targetId;
            position = lastPlaceholderPositionRef.current.position;
          } else {
            // Get only non-absolute siblings for positioning
            const currentSiblings = getNonAbsoluteSiblings(parentId);

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

          // Insert placeholder using hierarchy operations
          if (targetId) {
            if (position === "inside") {
              // Add as a child of the target
              addNode(mainPlaceholder.id, targetId);
            } else {
              // Add to parent at specific position
              const targetParentId = getNodeParent(targetId);
              if (!targetParentId) return;

              const targetIndex =
                getNodeChildren(targetParentId).indexOf(targetId);
              const insertIndex =
                position === "before" ? targetIndex : targetIndex + 1;

              insertAtIndex(mainPlaceholder.id, targetParentId, insertIndex);
            }
          } else {
            // Add as a child of the parent
            addNode(mainPlaceholder.id, parentId);
          }

          const additionalPlaceholders: Array<{
            placeholderId: string;
            nodeId: NodeId;
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
                if (!additionalParentId) return;

                const additionalOriginalIndex = originalAdditionalInfo.index;
                let additionalTargetId: NodeId | null = null;
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
                  const addSiblings =
                    getNonAbsoluteSiblings(additionalParentId);

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

                // Insert additional placeholder using hierarchy operations
                if (additionalTargetId) {
                  if (additionalPosition === "inside") {
                    // Add as a child of the target
                    addNode(additionalPlaceholder.id, additionalTargetId);
                  } else {
                    // Add to parent at specific position
                    const targetParentId = getNodeParent(additionalTargetId);
                    if (!targetParentId) return;

                    const targetIndex =
                      getNodeChildren(targetParentId).indexOf(
                        additionalTargetId
                      );
                    const insertIndex =
                      additionalPosition === "before"
                        ? targetIndex
                        : targetIndex + 1;

                    insertAtIndex(
                      additionalPlaceholder.id,
                      targetParentId,
                      insertIndex
                    );
                  }
                } else {
                  // Add as a child of the additional parent
                  addNode(additionalPlaceholder.id, additionalParentId);
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
            targetId: targetId || "",
            position,
          });

          hasLeftViewportRef.current = false;
          hasReenteredContainerRef.current = true;
        }
      }
    }

    if (isReorderingNode) {
      const parentId = getNodeParent(draggedNode.id);
      if (!parentId) return;

      const parentElement = document.querySelector(
        `[data-node-id="${parentId}"]`
      );
      if (!parentElement) return;

      // Use the modified reorder function that ignores absolute-in-frame elements
      const reorderResult = computeModifiedSiblingReorderResult(
        draggedNode,
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

        // Only update placeholder position if it's changed - FIX FOR JITTER
        if (!isSameReorderTarget(reorderResult)) {
          // Save the new reorder target
          lastReorderRef.current = {
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
              const orderA = placeholderInfo.nodeOrder.indexOf(a.nodeId);
              const orderB = placeholderInfo.nodeOrder.indexOf(b.nodeId);
              return orderA - orderB;
            });

            // Move the first placeholder to the target position using hierarchy operations
            if (reorderResult.position === "inside") {
              moveNode(sortedNodes[0].placeholderId, reorderResult.targetId);
            } else {
              const targetParentId = getNodeParent(reorderResult.targetId);
              if (!targetParentId) return;

              const targetChildren = getNodeChildren(targetParentId);
              const targetIndex = targetChildren.indexOf(
                reorderResult.targetId
              );
              const newIndex =
                reorderResult.position === "before"
                  ? targetIndex
                  : targetIndex + 1;

              moveNode(sortedNodes[0].placeholderId, targetParentId, newIndex);
            }

            // Move remaining placeholders to follow the first one
            for (let i = 1; i < sortedNodes.length; i++) {
              const previousId = sortedNodes[i - 1].placeholderId;
              const previousParentId = getNodeParent(previousId);
              if (!previousParentId) continue;

              const previousChildren = getNodeChildren(previousParentId);
              const previousIndex = previousChildren.indexOf(previousId);

              moveNode(
                sortedNodes[i].placeholderId,
                previousParentId,
                previousIndex + 1
              );
            }
          } else {
            // Find placeholders using DOM query
            const placeholderElements = document.querySelectorAll(
              '[data-node-type="placeholder"]'
            );
            if (placeholderElements.length > 0) {
              const placeholderId =
                placeholderElements[0].getAttribute("data-node-id");
              if (placeholderId) {
                if (reorderResult.position === "inside") {
                  moveNode(placeholderId, reorderResult.targetId);
                } else {
                  const targetParentId = getNodeParent(reorderResult.targetId);
                  if (!targetParentId) return;

                  const targetChildren = getNodeChildren(targetParentId);
                  const targetIndex = targetChildren.indexOf(
                    reorderResult.targetId
                  );
                  const newIndex =
                    reorderResult.position === "before"
                      ? targetIndex
                      : targetIndex + 1;

                  moveNode(placeholderId, targetParentId, newIndex);
                }
              }
            }
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

      const frameElement = filteredElements.find(
        (el) =>
          el.getAttribute("data-node-type") === "frame" ||
          el.getAttribute("data-node-type") === "image" ||
          el.getAttribute("data-node-type") === "video"
      );

      if (frameElement) {
        if (nodeFlags.isViewport) {
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

            dragOps.setDropInfo(frameId, position, canvasX, canvasY);
          }
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // Get only non-absolute frame children
        const frameChildren = getNodeChildren(frameId).filter(
          (childId) => !isNodeAbsoluteInFrame(childId)
        );

        const frameNodeFlags = getNodeFlags(frameId);
        if (frameNodeFlags.isDynamic && !dynamicModeNodeId) {
          dragOps.setDropInfo(null, null, canvasX, canvasY);
          visualOps.hideLineIndicator();
          return;
        }

        const hasChildren = frameChildren.length > 0;
        if (hasChildren) {
          const childRects = frameChildren
            .map((childId) => {
              const el = document.querySelector(
                `[data-node-id="${childId}"]`
              ) as HTMLElement | null;
              return el
                ? { id: childId, rect: el.getBoundingClientRect() }
                : null;
            })
            .filter((x): x is { id: NodeId; rect: DOMRect } => !!x);

          const result = computeFrameDropIndicator(
            frameElement,
            childRects,
            e.clientX,
            e.clientY
          );

          if (result && result.lineIndicator.show) {
            dragOps.setDropInfo(
              result.dropInfo.targetId,
              result.dropInfo.position,
              canvasX,
              canvasY
            );
            visualOps.setLineIndicator(result.lineIndicator);
          } else {
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

        dragOps.setDropInfo(siblingId, position, canvasX, canvasY);
      } else {
        dragOps.setDropInfo(null, null, canvasX, canvasY);
      }
    }

    if (overCanvas) {
      dragOps.setIsOverCanvas(true);
      if (dragSource === "viewport" && originalViewportDataRef.current) {
        console.log("Dragging over canvas from viewport");
        hasLeftViewportRef.current = true;

        // Find and remove all placeholders using DOM query
        const placeholderElements = document.querySelectorAll(
          '[data-node-type="placeholder"]'
        );
        placeholderElements.forEach((el) => {
          const nodeId = el.getAttribute("data-node-id");
          if (nodeId) removeNode(nodeId);
        });

        if (placeholderInfo) {
          dragOps.setPlaceholderInfo(null);
        }

        // Flag that we've left the viewport but don't remove shared IDs yet
        hasReenteredContainerRef.current = false;
      }

      visualOps.hideLineIndicator();
      dragOps.setDropInfo(null, null, canvasX, canvasY);
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
