import { useRef } from "react";
import {
  useGetDraggedNodes,
  useGetIsDragging,
  dragOps,
  useGetDragSource,
  useGetDropInfo,
  useDragBackToParentInfo,
  useGetDragBackToParentInfo,
} from "../atoms/drag-store";
import { useBuilderRefs } from "@/builder/context/builderState";
import { useGetTransform } from "../atoms/canvas-interaction-store";
import {
  useGetNodeParent,
  useGetNodeChildren,
} from "../atoms/node-store/hierarchy-store";
import {
  moveNode,
  removeNode,
  addNode,
} from "../atoms/node-store/operations/insert-operations";
import { getFilteredElementsUnderMouseDuringDrag } from "../utils";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";
import { updateNodeFlags } from "../atoms/node-store/operations/update-operations";
import {
  getSiblingOrdering,
  TargetInfo,
  calculateSnappedPosition,
  extractNodeDimensions,
  screenToCanvas,
  getParentOffsetInCanvas,
} from "./dnd-utils";
import { snapOps } from "../atoms/snap-guides-store";
import { useGetNodeFlags, useGetNodeStyle } from "../atoms/node-store";
import { createPlaceholder } from "./createPlaceholder";

export const useMouseMove = () => {
  const getDraggedNodes = useGetDraggedNodes();
  const getIsDragging = useGetIsDragging();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getDragSource = useGetDragSource();
  const { containerRef, transitioningToCanvasRef, transitioningToParentRef } =
    useBuilderRefs();
  const getTransform = useGetTransform();
  const getDropInfo = useGetDropInfo();
  const getNodeFlags = useGetNodeFlags();
  const getNodeStyle = useGetNodeStyle();
  const getDragBackToParentInfo = useGetDragBackToParentInfo();

  const lastTarget = useRef<TargetInfo | null>(null);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const placeholderMovingRef = useRef(false);
  const lastMoveTimeRef = useRef(0);
  // Track last transition time to prevent too-rapid transitions
  const lastTransitionTimeRef = useRef(0);

  /**
   * Helper function to find the original parent's path
   * This builds a complete hierarchy of parents from the starting parent
   * up to the root, which we can use to determine if we're hovering over
   * any element in the hierarchy.
   */
  const getParentHierarchy = (startingParentId) => {
    if (!startingParentId) return [];

    const hierarchy = [startingParentId];
    let currentParent = startingParentId;

    // Build a path from startingParent up to root
    // Limited to 10 levels to prevent infinite loops
    for (let i = 0; i < 10; i++) {
      const parentId = getNodeParent(currentParent);
      if (!parentId) break;

      hierarchy.push(parentId);
      currentParent = parentId;
    }

    return hierarchy;
  };

  /**
   * Check if the mouse is over any element in the parent hierarchy
   * This allows us to detect when we're entering any part of the parent structure
   */
  const isOverParentHierarchy = (e, parentHierarchy) => {
    if (!parentHierarchy.length) return false;

    const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);

    // Check if we're over any element in the parent hierarchy
    for (const element of elementsUnder) {
      const nodeId = element.getAttribute("data-node-id");
      if (nodeId && parentHierarchy.includes(nodeId)) {
        return true;
      }
    }

    return false;
  };

  /**
   * Get path to original nested container
   * This returns the path from the starting parent to the root
   */
  const getPathToNestedContainer = (startingParentId) => {
    if (!startingParentId) return [];

    const path = [];
    let currentId = startingParentId;

    while (currentId) {
      path.unshift(currentId); // Add to front of array
      currentId = getNodeParent(currentId);
    }

    return path;
  };

  return (e: MouseEvent) => {
    if (!getIsDragging()) return;
    const dragBackInfo = getDragBackToParentInfo();

    const draggedNodes = getDraggedNodes();
    if (draggedNodes.length === 0) return;

    const primaryNode = draggedNodes[0];

    const dragSource = getDragSource();
    const draggedNodeId = primaryNode.node.id;
    const startingParentId = primaryNode.offset.startingParentId;

    const originalPositionType =
      primaryNode.offset.originalPositionType || "absolute";

    const isOverCanvas = getFilteredElementsUnderMouseDuringDrag(
      e,
      draggedNodeId,
      "canvas"
    );

    // Handle when we're dragging back to parent - keep the real node "attached" to the mouse
    const isDraggingBackToParent = dragBackInfo.isDraggingBackToParent;

    if (isDraggingBackToParent) {
      // This is similar to canvas dragging, but when we're in back-to-parent mode
      const containerRect = containerRef.current!.getBoundingClientRect();
      const transform = getTransform();

      const { x: mouseCX, y: mouseCY } = screenToCanvas(
        e,
        containerRect,
        transform
      );

      // Continue to update the real node positions
      draggedNodes.forEach((dragged, index) => {
        const rawCX = mouseCX - dragged.offset.mouseX / transform.scale;
        const rawCY = mouseCY - dragged.offset.mouseY / transform.scale;

        // Keep nodes moving with the mouse (similar to canvas drag)
        updateNodeStyle(
          dragged.node.id,
          {
            position: "absolute",
            left: `${Math.round(rawCX)}px`,
            top: `${Math.round(rawCY)}px`,
            zIndex: "9999", // Keep on top
            pointerEvents: "none", // Don't catch pointer events
          },
          { dontSync: true }
        );
      });

      // Update drag positions to move with mouse
      dragOps.setDragPositions(mouseCX, mouseCY);

      // Reduced throttling for placeholders to match regular drag overlay behavior
      const placeholderId = primaryNode.offset.placeholderId;
      if (placeholderId) {
        // Get placeholder info for multi-selection
        const placeholderInfo = dragOps.getState().placeholderInfo;

        // Reduced throttle time for more responsive reordering
        const now = Date.now();
        if (
          now - lastMoveTimeRef.current < 16 || // ~60fps update rate
          placeholderMovingRef.current
        ) {
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        lastMoveTimeRef.current = now;

        // Mark that we're processing a move
        placeholderMovingRef.current = true;

        try {
          // Use the existing getSiblingOrdering function
          const result = getSiblingOrdering(
            e,
            placeholderId,
            draggedNodeId,
            getNodeParent,
            getNodeChildren,
            getNodeStyle,
            lastTarget.current,
            prevMousePosRef.current,
            placeholderInfo
          );

          if (result) {
            const { targetInfo, parentId, isColumn } = result;

            // Skip if target hasn't changed
            if (
              lastTarget.current &&
              lastTarget.current.id === targetInfo.id &&
              lastTarget.current.pos === targetInfo.pos
            ) {
              placeholderMovingRef.current = false;
              prevMousePosRef.current = { x: e.clientX, y: e.clientY };
              return;
            }

            // Update the last target
            lastTarget.current = targetInfo;

            // Get the current children of the parent
            const ordered = getNodeChildren(parentId);

            // For multi-selection, use a more reliable approach
            if (
              placeholderInfo &&
              placeholderInfo.additionalPlaceholders &&
              placeholderInfo.additionalPlaceholders.length > 0
            ) {
              // Keep placeholders in the original sibling order - only if we have nodeOrder
              const placeholderIds =
                placeholderInfo.nodeOrder &&
                placeholderInfo.nodeOrder.length > 0
                  ? placeholderInfo.nodeOrder
                      .map((nodeId) => {
                        if (nodeId === draggedNodeId) return placeholderId; // main placeholder
                        const ph = placeholderInfo.additionalPlaceholders.find(
                          (p) => p.nodeId === nodeId
                        );
                        return ph?.placeholderId;
                      })
                      .filter(Boolean)
                  : placeholderInfo.additionalPlaceholders.map(
                      (p) => p.placeholderId
                    );

              // First, temporarily remove all placeholders from the parent to simplify logic
              placeholderIds.forEach((id) => {
                removeNode(id);
              });

              // Get the updated children list without placeholders
              const newOrdered = getNodeChildren(parentId);

              // Find the target's index in the CLEAN list
              const targetIdx = newOrdered.indexOf(targetInfo.id);

              // Calculate new insertion index
              let insertIdx =
                targetInfo.pos === "before" ? targetIdx : targetIdx + 1;

              // Ensure valid index (shouldn't happen, but just to be safe)
              if (insertIdx < 0) insertIdx = 0;
              if (insertIdx > newOrdered.length) insertIdx = newOrdered.length;

              // Now insert all placeholders one by one at the correct position
              placeholderIds.forEach((id, i) => {
                moveNode(id, parentId, insertIdx + i);
              });

              // Update drop info
              dragOps.setDropInfo(targetInfo.id, targetInfo.pos, 0, 0);
            } else {
              // Single placeholder case - much simpler
              const clean = ordered.filter(
                (id) => id !== placeholderId && !id.includes("placeholder")
              );
              const targetIdx = clean.indexOf(targetInfo.id);
              const newIdx =
                targetInfo.pos === "before" ? targetIdx : targetIdx + 1;

              const currentIdx = ordered.indexOf(placeholderId);
              if (currentIdx !== -1 && currentIdx !== newIdx) {
                moveNode(placeholderId, parentId, newIdx);
              }

              // Update drop info
              dragOps.setDropInfo(targetInfo.id, targetInfo.pos, 0, 0);
            }
          }
        } catch (err) {
          console.error("Error in reordering:", err);
        } finally {
          // Reduced the clearing time to match higher refresh rate
          setTimeout(() => {
            placeholderMovingRef.current = false;
          }, 16); // Matching the throttle timing
        }
      }

      // Check for transitions back to canvas
      if (isOverCanvas) {
        const now = Date.now();
        // Prevent too rapid transitions (200ms minimum between transitions)
        if (now - lastTransitionTimeRef.current < 200) {
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        lastTransitionTimeRef.current = now;

        // Reset transition flags immediately to allow for back-and-forth transitions
        if (transitioningToParentRef.current) {
          transitioningToParentRef.current = false;
        }

        if (transitioningToCanvasRef.current) {
          // Already transitioning
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        transitioningToCanvasRef.current = true;

        // Canvas-space mouse position
        const containerRect = containerRef.current!.getBoundingClientRect();
        const transform = getTransform();
        const { x: mouseCX, y: mouseCY } = screenToCanvas(
          e,
          containerRect,
          transform
        );

        // CRITICAL: Update drag state BEFORE any DOM changes
        dragOps.setIsOverCanvas(true);
        dragOps.setDragPositions(mouseCX, mouseCY);
        dragOps.setDragSource("canvas");
        dragOps.setIsDraggingBackToParent(false);

        // Remove placeholders
        const placeholderInfo = dragOps.getState().placeholderInfo;
        if (placeholderInfo) {
          // Remove main placeholder
          if (placeholderId) removeNode(placeholderId);

          // If multi-selection, also remove additional placeholders
          if (placeholderInfo.additionalPlaceholders) {
            placeholderInfo.additionalPlaceholders.forEach((ph) => {
              if (ph.placeholderId && ph.placeholderId !== placeholderId) {
                removeNode(ph.placeholderId);
              }
            });
          }
        }

        // Pre-compute every node's offset
        const originalStyles = new Map();

        draggedNodes.forEach((dragged) => {
          const el = document.querySelector(
            `[data-node-id="${dragged.node.id}"]`
          );
          if (el) {
            const computedStyle = window.getComputedStyle(el);
            originalStyles.set(dragged.node.id, {
              display: computedStyle.display,
              position: computedStyle.position,
            });
          }
        });

        const relOffsets = draggedNodes.map((d, i) => {
          if (i === 0) return { dx: 0, dy: 0 };

          const primaryEl = document.querySelector(
            `[data-node-id="${draggedNodes[0].node.id}"]`
          ) as HTMLElement | null;
          const currentEl = document.querySelector(
            `[data-node-id="${d.node.id}"]`
          ) as HTMLElement | null;

          if (!primaryEl || !currentEl) {
            return { dx: i * 10, dy: i * 10 }; // fallback
          }

          const p = primaryEl.getBoundingClientRect();
          const c = currentEl.getBoundingClientRect();
          const dx = (c.left - p.left) / transform.scale;
          const dy = (c.top - p.top) / transform.scale;
          return { dx, dy };
        });

        // Set all nodes to transition: none to prevent animation artifacts
        draggedNodes.forEach((dragged) => {
          updateNodeStyle(
            dragged.node.id,
            {
              transition: "none", // Prevent any CSS transitions
            },
            { dontSync: true }
          );
        });

        // Promote nodes to the canvas in a batch
        draggedNodes.forEach((dragged) => {
          moveNode(dragged.node.id, null);
          dragged.node.parentId = null;
        });

        // Position all nodes with their exact calculated coordinates
        draggedNodes.forEach((dragged, idx) => {
          // Get original display value
          const originalStyle = originalStyles.get(dragged.node.id);
          const originalDisplay = originalStyle?.display || "block";

          // Calculate absolute coords in canvas space
          const rawX =
            mouseCX -
            dragged.offset.mouseX / transform.scale +
            (relOffsets[idx]?.dx || 0);
          const rawY =
            mouseCY -
            dragged.offset.mouseY / transform.scale +
            (relOffsets[idx]?.dy || 0);

          // Style WITH explicit visibility and original display properties
          updateNodeStyle(
            dragged.node.id,
            {
              position: "absolute",
              left: `${Math.round(rawX)}px`,
              top: `${Math.round(rawY)}px`,
              isAbsoluteInFrame: "false",
              // Keep original display property
              display: originalDisplay,
              // Add visibility properties
              visibility: "visible",
              opacity: "1",
              zIndex: idx === 0 ? "1000" : `${1000 - idx * 10}`, // Proper stacking
              pointerEvents: "none", // Allow mouse events to pass through
            },
            { dontSync: true }
          );

          updateNodeFlags(dragged.node.id, { inViewport: false });
        });

        // Configure snap guides
        snapOps.configureForCanvasTransition();

        // Reset transition flag after a short delay
        setTimeout(() => {
          transitioningToCanvasRef.current = false;
        }, 100);

        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Enhanced drag-back-to-parent detection with hierarchy support
    if (dragSource === "canvas") {
      const originalParentId = dragBackInfo.originalParentId;
      const originalIndices = dragBackInfo.draggedNodesOriginalIndices;

      if (originalParentId) {
        // Get the complete path to the nested container - includes all parents
        const parentPath = getPathToNestedContainer(originalParentId);

        // Get the parent hierarchy (all containers from original parent up to root)
        const parentHierarchy = getParentHierarchy(originalParentId);

        // Check if mouse is over ANY element in the parent hierarchy
        // This activates as soon as we enter any part of the parent structure
        let isOverAnyParent = isOverParentHierarchy(e, parentHierarchy);

        // For logging - helps with debugging
        if (isOverAnyParent) {
          console.log("Over parent hierarchy:", parentHierarchy);
        }

        // Standard check for being directly over original parent
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);

        // First check for direct hit on original parent (keeping original logic)
        let isOverOriginalParent = elementsUnder.some((el) => {
          const nodeId = el.getAttribute("data-node-id");
          return nodeId === originalParentId;
        });

        // Use the broader parent hierarchy detection
        const shouldTransitionToParent =
          isOverAnyParent && !transitioningToParentRef.current;

        // Prevent rapid transitions
        const now = Date.now();
        if (
          shouldTransitionToParent &&
          now - lastTransitionTimeRef.current >= 200
        ) {
          lastTransitionTimeRef.current = now;
          transitioningToParentRef.current = true;

          // Reset the other transition flag immediately
          if (transitioningToCanvasRef.current) {
            transitioningToCanvasRef.current = false;
          }

          console.log("Transitioning back to parent:", originalParentId);

          // 1. Set dragging back to parent flag
          dragOps.setIsDraggingBackToParent(true);

          // 2. Change drag source back to parent or viewport
          const parentNodeFlags = getNodeFlags(originalParentId);
          const dragSourceType = parentNodeFlags.inViewport
            ? "viewport"
            : "parent";
          dragOps.setDragSource(dragSourceType);

          // 3. Reset canvas state
          dragOps.setIsOverCanvas(false);

          // 4. Get nodes sorted by original indices
          const originalIndices = dragBackInfo.draggedNodesOriginalIndices;
          let orderedDraggedNodes = [...draggedNodes];

          if (originalIndices.size > 0) {
            // Sort by original indices
            orderedDraggedNodes.sort((a, b) => {
              const indexA = originalIndices.get(a.node.id) ?? 999;
              const indexB = originalIndices.get(b.node.id) ?? 999;
              return indexA - indexB;
            });
          }

          // 5. Create new placeholders for each dragged node in the proper order
          const placeholders = [];
          let mainPlaceholder = null;

          // Create placeholders for each dragged node in the sorted order
          for (let i = 0; i < orderedDraggedNodes.length; i++) {
            const nodeInfo = orderedDraggedNodes[i];
            const currentId = nodeInfo.node.id;

            // Find the element in the DOM
            const element = document.querySelector(
              `[data-node-id="${currentId}"]`
            ) as HTMLElement;

            if (!element) continue;

            // Create placeholder
            const placeholder = createPlaceholder({
              node: nodeInfo.node,
              element,
              transform: getTransform(),
            });

            // Store placeholder with original index
            placeholders.push({
              id: placeholder.id,
              nodeId: currentId,
              index: originalIndices.get(currentId) ?? i,
            });

            // Set placeholder for primary node
            if (currentId === primaryNode.node.id) {
              mainPlaceholder = placeholder;
            }
          }

          // Sort placeholders by original index if needed
          placeholders.sort((a, b) => a.index - b.index);

          // FIXED APPROACH #1: Add all placeholders first, then reorder them
          // This avoids the stale parentChildren.length issue

          // Step 1: Add all placeholders to the parent container first
          placeholders.forEach((placeholder) => {
            addNode(placeholder.id, originalParentId);
          });

          // Step 2: Now reorder them to their correct positions
          placeholders.forEach((placeholder) => {
            // Now we can safely move to the original index
            moveNode(placeholder.id, originalParentId, placeholder.index);
          });

          // Update primary node offset with main placeholder
          if (mainPlaceholder) {
            const updatedPrimaryNode = {
              ...primaryNode,
              offset: {
                ...primaryNode.offset,
                placeholderId: mainPlaceholder.id,
                startingParentId: originalParentId,
              },
            };

            // Update all dragged nodes
            const updatedDraggedNodes = draggedNodes.map((node, idx) => {
              if (idx === 0) return updatedPrimaryNode;
              return {
                ...node,
                offset: {
                  ...node.offset,
                  startingParentId: originalParentId,
                },
              };
            });

            dragOps.setDraggedNodes(updatedDraggedNodes);
          }

          // Create placeholder info for the operation
          if (mainPlaceholder) {
            // Use the sorted order of node IDs
            const nodeOrder = orderedDraggedNodes.map((info) => info.node.id);

            const placeholderInfo = {
              mainPlaceholderId: mainPlaceholder.id,
              nodeOrder: nodeOrder,
              additionalPlaceholders: placeholders.map((p) => ({
                placeholderId: p.id,
                nodeId: p.nodeId,
              })),
              targetId: null,
              position: null,
            };

            // Store placeholder info in drag state
            dragOps.setPlaceholderInfo(placeholderInfo);
          }

          // Reset transitioning flag after a short delay
          setTimeout(() => {
            transitioningToParentRef.current = false;
          }, 100);

          return; // Skip the rest of the handler
        }
      }
    }

    if (dragSource === "absolute-in-frame" && startingParentId) {
      // Absolute-in-frame dragging code
      const transform = getTransform();
      const containerRect = containerRef.current!.getBoundingClientRect();
      const parentEl = document.querySelector(
        `[data-node-id="${startingParentId}"]`
      ) as HTMLElement;

      if (!parentEl) return;

      const { x: mouseCX, y: mouseCY } = screenToCanvas(
        e,
        containerRect,
        transform
      );

      const rawCX = mouseCX - primaryNode.offset.mouseX / transform.scale;
      const rawCY = mouseCY - primaryNode.offset.mouseY / transform.scale;

      const dropInfo = getDropInfo();
      const hasActiveDropZone = dropInfo && dropInfo.targetId !== null;

      const { enabled, activeSnapPoints } = hasActiveDropZone
        ? {
            enabled: false,
            activeSnapPoints: { horizontal: null, vertical: null },
          }
        : snapOps.getState();

      const dimensions = extractNodeDimensions(primaryNode.node.style);

      const mouseSpeed = {
        x: Math.abs(e.clientX - prevMousePosRef.current.x),
        y: Math.abs(e.clientY - prevMousePosRef.current.y),
      };

      const { x: snapCX, y: snapCY } = calculateSnappedPosition(
        rawCX,
        rawCY,
        dimensions,
        mouseSpeed,
        activeSnapPoints,
        enabled,
        hasActiveDropZone
      );

      const { x: parentCX, y: parentCY } = getParentOffsetInCanvas(
        parentEl,
        containerRect,
        transform
      );

      const relX = Math.round(snapCX - parentCX);
      const relY = Math.round(snapCY - parentCY);

      draggedNodes.forEach((dragged, index) => {
        const nodeId = dragged.node.id;
        const nodeElement = document.querySelector(
          `[data-node-id="${nodeId}"]`
        );
        if (!nodeElement) return;

        const style = window.getComputedStyle(nodeElement);
        const offsetX =
          index === 0
            ? 0
            : parseFloat(style.left) -
              parseFloat(
                window.getComputedStyle(
                  document.querySelector(`[data-node-id="${draggedNodeId}"]`)
                ).left
              );
        const offsetY =
          index === 0
            ? 0
            : parseFloat(style.top) -
              parseFloat(
                window.getComputedStyle(
                  document.querySelector(`[data-node-id="${draggedNodeId}"]`)
                ).top
              );

        updateNodeStyle(nodeId, {
          position: dragged.offset.originalPositionType || originalPositionType,
          left: `${relX + offsetX}px`,
          top: `${relY + offsetY}px`,
        });
      });

      dragOps.setDragPositions(mouseCX, mouseCY);
      dragOps.setLastMousePosition(e.clientX, e.clientY);
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    } else if (dragSource === "canvas") {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const transform = getTransform();

      const { x: mouseCX, y: mouseCY } = screenToCanvas(
        e,
        containerRect,
        transform
      );

      // Get drop info and active snap points once
      const dropInfo = getDropInfo();
      const hasActiveDropZone = dropInfo && dropInfo.targetId !== null;
      const { enabled, activeSnapPoints } = hasActiveDropZone
        ? {
            enabled: false,
            activeSnapPoints: { horizontal: null, vertical: null },
          }
        : snapOps.getState();

      // Calculate mouse speed once
      const mouseSpeed = {
        x: Math.abs(e.clientX - prevMousePosRef.current.x),
        y: Math.abs(e.clientY - prevMousePosRef.current.y),
      };

      // STEP 1: Calculate raw position for primary node
      const primaryRawX = mouseCX - primaryNode.offset.mouseX / transform.scale;
      const primaryRawY = mouseCY - primaryNode.offset.mouseY / transform.scale;

      // STEP 2: Calculate snapped position for primary node
      const dimensions = extractNodeDimensions(primaryNode.node.style);
      const { x: primarySnapX, y: primarySnapY } = calculateSnappedPosition(
        primaryRawX,
        primaryRawY,
        dimensions,
        mouseSpeed,
        activeSnapPoints,
        enabled,
        hasActiveDropZone
      );

      // STEP 3: Calculate the snap delta (difference between raw and snapped positions)
      const snapDeltaX = primarySnapX - primaryRawX;
      const snapDeltaY = primarySnapY - primaryRawY;

      // STEP 4: Apply the same snap delta to all nodes to maintain relative positions
      draggedNodes.forEach((dragged, index) => {
        // Calculate raw position for this node
        const rawX = mouseCX - dragged.offset.mouseX / transform.scale;
        const rawY = mouseCY - dragged.offset.mouseY / transform.scale;

        // Apply the same snap delta to maintain relative positions
        const finalX = rawX + snapDeltaX;
        const finalY = rawY + snapDeltaY;

        updateNodeStyle(
          dragged.node.id,
          {
            position: "absolute",
            left: `${Math.round(finalX)}px`,
            top: `${Math.round(finalY)}px`,
          },
          { dontSync: true }
        );
      });

      dragOps.setDragPositions(mouseCX, mouseCY);
      dragOps.setIsOverCanvas(isOverCanvas);
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const placeholderId = primaryNode.offset.placeholderId;
    if (!placeholderId) return;

    // Get placeholder info for multi-selection
    const placeholderInfo = dragOps.getState().placeholderInfo;
    const isMultiSelection =
      placeholderInfo &&
      placeholderInfo.additionalPlaceholders &&
      placeholderInfo.additionalPlaceholders.length > 0;

    // Better parent-to-canvas transition
    if (
      isOverCanvas &&
      (dragSource === "parent" || dragSource === "viewport")
    ) {
      // Prevent rapid transitions
      const now = Date.now();
      if (now - lastTransitionTimeRef.current < 200) {
        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      lastTransitionTimeRef.current = now;

      // Reset transition flags immediately to allow for back-and-forth transitions
      if (transitioningToParentRef.current) {
        transitioningToParentRef.current = false;
      }

      // Prevent multiple transitions
      if (transitioningToCanvasRef.current) {
        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      transitioningToCanvasRef.current = true;

      // Calculate canvas-space mouse position FIRST
      const containerRect = containerRef.current!.getBoundingClientRect();
      const transform = getTransform();

      // Canvas-space mouse position
      const { x: mouseCX, y: mouseCY } = screenToCanvas(
        e,
        containerRect,
        transform
      );

      // CRITICAL: Update drag state BEFORE any DOM changes
      // This immediately unmounts the overlay to prevent jumps
      dragOps.setIsOverCanvas(true);
      dragOps.setDragPositions(mouseCX, mouseCY);
      dragOps.setDragSource("canvas"); // This immediately unmounts DragOverlay

      // Remove placeholders AFTER drag state is updated
      // Remove main placeholder
      if (placeholderId) removeNode(placeholderId);

      // If multi-selection, also remove additional placeholders
      if (isMultiSelection && placeholderInfo) {
        placeholderInfo.additionalPlaceholders.forEach((ph) => {
          if (ph.placeholderId !== placeholderId) {
            removeNode(ph.placeholderId);
          }
        });
      }

      // Pre-compute every node's offset
      // Capture original styles
      const originalStyles = new Map();

      draggedNodes.forEach((dragged) => {
        const el = document.querySelector(
          `[data-node-id="${dragged.node.id}"]`
        );
        if (el) {
          const computedStyle = window.getComputedStyle(el);
          originalStyles.set(dragged.node.id, {
            display: computedStyle.display,
            position: computedStyle.position,
          });
        }
      });

      const relOffsets = draggedNodes.map((d, i) => {
        if (i === 0) return { dx: 0, dy: 0 };

        const primaryEl = document.querySelector(
          `[data-node-id="${draggedNodes[0].node.id}"]`
        ) as HTMLElement | null;
        const currentEl = document.querySelector(
          `[data-node-id="${d.node.id}"]`
        ) as HTMLElement | null;

        if (!primaryEl || !currentEl) {
          return { dx: i * 10, dy: i * 10 }; // fallback
        }

        const p = primaryEl.getBoundingClientRect();
        const c = currentEl.getBoundingClientRect();
        const dx = (c.left - p.left) / transform.scale;
        const dy = (c.top - p.top) / transform.scale;
        return { dx, dy };
      });

      // Set all nodes to transition: none to prevent animation artifacts
      draggedNodes.forEach((dragged) => {
        updateNodeStyle(
          dragged.node.id,
          {
            transition: "none", // Prevent any CSS transitions
          },
          { dontSync: true }
        );
      });

      // Promote nodes to the canvas in a batch
      draggedNodes.forEach((dragged) => {
        moveNode(dragged.node.id, null);
        dragged.node.parentId = null;
      });

      // Position all nodes with their exact calculated coordinates
      draggedNodes.forEach((dragged, idx) => {
        // Get original display value
        const originalStyle = originalStyles.get(dragged.node.id);
        const originalDisplay = originalStyle?.display || "block";

        // Calculate absolute coords in canvas space
        const rawX =
          mouseCX -
          dragged.offset.mouseX / transform.scale +
          (relOffsets[idx]?.dx || 0);
        const rawY =
          mouseCY -
          dragged.offset.mouseY / transform.scale +
          (relOffsets[idx]?.dy || 0);

        // Style WITH explicit visibility and original display properties
        updateNodeStyle(
          dragged.node.id,
          {
            position: "absolute",
            left: `${Math.round(rawX)}px`,
            top: `${Math.round(rawY)}px`,
            isAbsoluteInFrame: "false",
            // Keep original display property
            display: originalDisplay,
            // Add visibility properties
            visibility: "visible",
            opacity: "1",
            zIndex: idx === 0 ? "1000" : `${1000 - idx * 10}`, // Proper stacking
            pointerEvents: "none", // Allow mouse events to pass through
          },
          { dontSync: true }
        );

        updateNodeFlags(dragged.node.id, { inViewport: false });
      });

      // Configure snap guides
      snapOps.configureForCanvasTransition();

      // Reset transition flag after a shorter delay
      setTimeout(() => {
        transitioningToCanvasRef.current = false;
      }, 75); // Reduced from 100ms for better responsiveness

      return; // Don't fall through to sibling-ordering logic
    } else if (isOverCanvas) {
      // Regular transition to canvas (not from parent/viewport)
      // Remove all placeholders when transitioning to canvas
      if (placeholderId) removeNode(placeholderId);

      // If multi-selection, also remove additional placeholders
      if (isMultiSelection && placeholderInfo) {
        placeholderInfo.additionalPlaceholders.forEach((ph) => {
          if (ph.placeholderId !== placeholderId) {
            removeNode(ph.placeholderId);
          }
        });
      }

      const containerRect = containerRef.current!.getBoundingClientRect();
      const transform = getTransform();
      const { x, y } = screenToCanvas(e, containerRect, transform);

      dragOps.setIsOverCanvas(true);
      dragOps.setDragSource("canvas");
      dragOps.setDragPositions(x, y);
    } else {
      // SIBLING REORDERING LOGIC

      // Reduce throttling for more responsive reordering to match drag overlay
      const now = Date.now();
      if (now - lastMoveTimeRef.current < 16 || placeholderMovingRef.current) {
        return;
      }

      lastMoveTimeRef.current = now;

      // Mark that we're processing a move
      placeholderMovingRef.current = true;

      try {
        // Get sibling ordering for the primary placeholder
        // Use the existing implementation without modifications
        const result = getSiblingOrdering(
          e,
          placeholderId,
          draggedNodeId,
          getNodeParent,
          getNodeChildren,
          getNodeStyle,
          lastTarget.current,
          prevMousePosRef.current,
          placeholderInfo
        );

        if (result) {
          const { targetInfo, parentId, isColumn } = result;

          // Skip if target hasn't changed
          if (
            lastTarget.current &&
            lastTarget.current.id === targetInfo.id &&
            lastTarget.current.pos === targetInfo.pos
          ) {
            placeholderMovingRef.current = false;
            return;
          }

          // Update the last target
          lastTarget.current = targetInfo;

          // Get the current children of the parent
          const ordered = getNodeChildren(parentId);

          // For multi-selection, use a more reliable approach
          if (isMultiSelection && placeholderInfo) {
            // Keep placeholders in the original sibling order - only if we have nodeOrder
            const placeholderIds =
              placeholderInfo.nodeOrder && placeholderInfo.nodeOrder.length > 0
                ? placeholderInfo.nodeOrder
                    .map((nodeId) => {
                      if (nodeId === draggedNodeId) return placeholderId; // main placeholder
                      const ph = placeholderInfo.additionalPlaceholders.find(
                        (p) => p.nodeId === nodeId
                      );
                      return ph?.placeholderId;
                    })
                    .filter(Boolean)
                : placeholderInfo.additionalPlaceholders.map(
                    (p) => p.placeholderId
                  );

            // First, temporarily remove all placeholders from the parent to simplify logic
            placeholderIds.forEach((id) => {
              removeNode(id);
            });

            // Get the updated children list without placeholders
            const newOrdered = getNodeChildren(parentId);

            // Find the target's index in the CLEAN list
            const targetIdx = newOrdered.indexOf(targetInfo.id);

            // Calculate new insertion index
            let insertIdx =
              targetInfo.pos === "before" ? targetIdx : targetIdx + 1;

            // Ensure valid index (shouldn't happen, but just to be safe)
            if (insertIdx < 0) insertIdx = 0;
            if (insertIdx > newOrdered.length) insertIdx = newOrdered.length;

            // Now insert all placeholders one by one at the correct position
            placeholderIds.forEach((id, i) => {
              moveNode(id, parentId, insertIdx + i);
            });

            // Update drop info
            dragOps.setDropInfo(targetInfo.id, targetInfo.pos, 0, 0);
          } else {
            // Single placeholder case - much simpler
            const clean = ordered.filter(
              (id) => id !== placeholderId && !id.includes("placeholder")
            );
            const targetIdx = clean.indexOf(targetInfo.id);
            const newIdx =
              targetInfo.pos === "before" ? targetIdx : targetIdx + 1;

            const currentIdx = ordered.indexOf(placeholderId);
            if (currentIdx !== -1 && currentIdx !== newIdx) {
              moveNode(placeholderId, parentId, newIdx);
            }

            // Update drop info
            dragOps.setDropInfo(targetInfo.id, targetInfo.pos, 0, 0);
          }
        }
      } catch (err) {
        console.error("Error in reordering:", err);
      } finally {
        // Clear the flag very quickly to match drag overlay responsiveness
        setTimeout(() => {
          placeholderMovingRef.current = false;
        }, 16); // Match the throttle time for consistency
      }
    }

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
