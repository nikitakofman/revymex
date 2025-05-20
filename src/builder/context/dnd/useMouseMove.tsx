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

      // NEW SECTION: Also handle sibling reordering for the placeholders
      // when we're in dragging back to parent mode
      const placeholderId = primaryNode.offset.placeholderId;
      if (placeholderId) {
        // Get placeholder info for multi-selection
        const placeholderInfo = dragOps.getState().placeholderInfo;

        // Throttle the reordering to prevent glitches
        const now = Date.now();
        if (
          now - lastMoveTimeRef.current < 100 ||
          placeholderMovingRef.current
        ) {
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        lastMoveTimeRef.current = now;

        // Mark that we're processing a move
        placeholderMovingRef.current = true;

        try {
          // Get sibling ordering for the primary placeholder
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
          // Always clear the flag after a delay
          setTimeout(() => {
            placeholderMovingRef.current = false;
          }, 100);
        }
      }

      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Handle dragging back to original parent
    if (dragSource === "canvas") {
      const originalParentId = dragBackInfo.originalParentId;
      const originalIndices = dragBackInfo.draggedNodesOriginalIndices;

      if (originalParentId) {
        // Detect if over original parent
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        const isOverOriginalParent = elementsUnder.some((el) => {
          const nodeId = el.getAttribute("data-node-id");
          return nodeId === originalParentId;
        });

        console.log(
          "isOverOriginalParent",
          isOverOriginalParent,
          "originalParentId",
          originalParentId
        );

        // If over original parent and not already transitioning
        if (isOverOriginalParent && !transitioningToParentRef.current) {
          transitioningToParentRef.current = true;

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

          // 4. Create new placeholders for each dragged node
          const placeholders = [];
          let mainPlaceholder = null;

          // Sort dragged nodes by their original indices if available
          const orderedDraggedNodes = [...draggedNodes];

          if (originalIndices.size > 0) {
            orderedDraggedNodes.sort((a, b) => {
              const indexA = originalIndices.get(a.node.id) ?? 999;
              const indexB = originalIndices.get(b.node.id) ?? 999;
              return indexA - indexB;
            });
          }

          // Create a placeholder for each dragged node
          for (let i = 0; i < orderedDraggedNodes.length; i++) {
            const nodeInfo = orderedDraggedNodes[i];
            const currentId = nodeInfo.node.id;

            // Find the element in the DOM (should now be on canvas)
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

            placeholders.push({
              id: placeholder.id,
              nodeId: currentId,
              // If we have original index, use it
              index: originalIndices.get(currentId) ?? 0,
            });

            // Set main placeholder (for primary dragged node)
            if (currentId === primaryNode.node.id) {
              mainPlaceholder = placeholder;
            }
          }

          // Sort placeholders by original index
          placeholders.sort((a, b) => a.index - b.index);

          // Insert all placeholders in the parent at their original indices
          if (placeholders.length > 0) {
            // Get current parent children
            const parentChildren = getNodeChildren(originalParentId);

            for (let i = 0; i < placeholders.length; i++) {
              // Add placeholder to parent
              addNode(placeholders[i].id, originalParentId);

              // Position at original index if possible
              const targetIndex = Math.min(
                placeholders[i].index,
                parentChildren.length
              );
              moveNode(placeholders[i].id, originalParentId, targetIndex);
            }

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

      draggedNodes.forEach((dragged, index) => {
        const rawCX = mouseCX - dragged.offset.mouseX / transform.scale;
        const rawCY = mouseCY - dragged.offset.mouseY / transform.scale;

        const dropInfo = getDropInfo();
        const hasActiveDropZone = dropInfo && dropInfo.targetId !== null;

        const { enabled, activeSnapPoints } = hasActiveDropZone
          ? {
              enabled: false,
              activeSnapPoints: { horizontal: null, vertical: null },
            }
          : snapOps.getState();

        const dimensions = extractNodeDimensions(dragged.node.style);

        const mouseSpeed = {
          x: Math.abs(e.clientX - prevMousePosRef.current.x),
          y: Math.abs(e.clientY - prevMousePosRef.current.y),
        };

        const { x: finalX, y: finalY } = calculateSnappedPosition(
          rawCX,
          rawCY,
          dimensions,
          mouseSpeed,
          index === 0 ? activeSnapPoints : { horizontal: null, vertical: null },
          enabled,
          hasActiveDropZone
        );

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

    // Modified condition to handle both parent and viewport sources
    if (
      isOverCanvas &&
      (dragSource === "parent" || dragSource === "viewport")
    ) {
      // FIXED: Parent/viewport to canvas transition logic

      // Prevent multiple transitions
      if (transitioningToCanvasRef.current) return;
      transitioningToCanvasRef.current = true;

      /* ---------------------------------------------------------------------------
       *  0. Calculate canvas-space mouse position FIRST
       * ------------------------------------------------------------------------- */
      const containerRect = containerRef.current!.getBoundingClientRect();
      const transform = getTransform();

      // Canvas-space mouse position
      const { x: mouseCX, y: mouseCY } = screenToCanvas(
        e,
        containerRect,
        transform
      );

      /* ---------------------------------------------------------------------------
       *  1. CRITICAL FIX: Update drag state BEFORE any DOM changes
       *     This immediately unmounts the overlay to prevent jumps
       * ------------------------------------------------------------------------- */
      dragOps.setIsOverCanvas(true);
      dragOps.setDragPositions(mouseCX, mouseCY);
      dragOps.setDragSource("canvas"); // This immediately unmounts DragOverlay

      /* ---------------------------------------------------------------------------
       *  2. Remove placeholders AFTER drag state is updated
       * ------------------------------------------------------------------------- */
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

      /* ---------------------------------------------------------------------------
       *  3. Pre-compute every node's offset
       * ------------------------------------------------------------------------- */
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

      /* ---------------------------------------------------------------------------
       *  4. Set all nodes to transition: none to prevent animation artifacts
       * ------------------------------------------------------------------------- */
      draggedNodes.forEach((dragged) => {
        updateNodeStyle(
          dragged.node.id,
          {
            transition: "none", // Prevent any CSS transitions
          },
          { dontSync: true }
        );
      });

      /* ---------------------------------------------------------------------------
       *  5. Promote nodes to the canvas in a batch
       * ------------------------------------------------------------------------- */
      draggedNodes.forEach((dragged) => {
        moveNode(dragged.node.id, null);
        dragged.node.parentId = null;
      });

      /* ---------------------------------------------------------------------------
       *  6. Position all nodes with their exact calculated coordinates
       * ------------------------------------------------------------------------- */
      draggedNodes.forEach((dragged, idx) => {
        // Get original display value
        const originalStyle = originalStyles.get(dragged.node.id);
        const originalDisplay = originalStyle?.display || "block";

        // B. calculate absolute coords in canvas space
        const rawX =
          mouseCX -
          dragged.offset.mouseX / transform.scale +
          (relOffsets[idx]?.dx || 0);
        const rawY =
          mouseCY -
          dragged.offset.mouseY / transform.scale +
          (relOffsets[idx]?.dy || 0);

        // C. style WITH explicit visibility and original display properties
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
      // IMPROVED SIBLING REORDERING LOGIC - FIXED FOR ALL DIRECTIONS

      // Throttle the reordering to prevent glitches
      const now = Date.now();
      if (now - lastMoveTimeRef.current < 100 || placeholderMovingRef.current) {
        return;
      }

      lastMoveTimeRef.current = now;

      // Mark that we're processing a move
      placeholderMovingRef.current = true;

      try {
        // Get sibling ordering for the primary placeholder
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
        // Always clear the flag after a delay
        setTimeout(() => {
          placeholderMovingRef.current = false;
        }, 100);
      }
    }

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
