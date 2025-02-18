import { useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { findIndexWithinParent } from "../dnd/utils";

export const useKeyboardDrag = () => {
  const { dragState, nodeState, dragDisp, nodeDisp, transform, containerRef } =
    useBuilder();
  const isAltPressedRef = useRef(false);
  const hasDuplicatedInCurrentDragRef = useRef(false);

  const cloneNode = (originalNode: Node, existingNodes: Node[]): Node => {
    // Generate new unique IDs
    const newId = nanoid();
    const newSharedId = originalNode.sharedId ? nanoid() : undefined;

    // Create deep clone with new IDs
    const clone: Node = {
      ...originalNode,
      id: newId,
      sharedId: newSharedId, // New shared ID if original had one
      style: { ...originalNode.style },
      parentId: originalNode.parentId,
      inViewport: originalNode.inViewport,
      // Keep other properties like isDynamic, type, etc.
    };

    // Check for child nodes
    const childNodes = existingNodes.filter(
      (n) => n.parentId === originalNode.id
    );
    if (childNodes.length > 0) {
      childNodes.forEach((child) => {
        const clonedChild = cloneNode(child, existingNodes);
        clonedChild.parentId = newId;
      });
    }

    return clone;
  };

  const handleDuplication = () => {
    if (!dragState.isDragging || !dragState.draggedNode) return;

    try {
      const mainNode = dragState.draggedNode.node;
      const mainDragPreview = document.querySelector(
        `[data-node-dragged="${mainNode.id}"]`
      );
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (!mainDragPreview || !containerRect) return;

      const mainRect = mainDragPreview.getBoundingClientRect();
      const currentX =
        (mainRect.left - containerRect.left - transform.x) / transform.scale;
      const currentY =
        (mainRect.top - containerRect.top - transform.y) / transform.scale;

      // Get all nodes to duplicate
      const nodesToDuplicate = [mainNode];
      const additionalOffsets: {
        [key: string]: { offsetX: number; offsetY: number };
      } = {};

      // Calculate relative offsets for additional nodes
      if (dragState.additionalDraggedNodes?.length) {
        dragState.additionalDraggedNodes.forEach((info) => {
          nodesToDuplicate.push(info.node);

          const additionalPreview = document.querySelector(
            `[data-node-dragged="${info.node.id}"]`
          );
          if (additionalPreview) {
            const additionalRect = additionalPreview.getBoundingClientRect();

            // Calculate offset relative to main dragged node
            additionalOffsets[info.node.id] = {
              offsetX: (additionalRect.left - mainRect.left) / transform.scale,
              offsetY: (additionalRect.top - mainRect.top) / transform.scale,
            };
          }
        });
      }

      const cloneNodes = (node: Node, x: number, y: number) => {
        const clone = cloneNode(node, nodeState.nodes);

        if (node.inViewport) {
          // Viewport handling remains the same
          clone.inViewport = true;
          clone.parentId = node.parentId;
          const originalIndex = findIndexWithinParent(
            nodeState.nodes,
            node.id,
            node.parentId
          );
          nodeDisp.insertAtIndex(clone, originalIndex, node.parentId);
        } else {
          // For canvas nodes, use relative positioning
          clone.style = {
            ...node.style,
            position: "absolute",
            left: `${x}px`,
            top: `${y}px`,
          };
          clone.inViewport = false;
          clone.parentId = null;
          nodeDisp.insertAtIndex(clone, 0, null);
        }

        // Copy dimensions
        const originalDimensions = dragState.nodeDimensions[node.id];
        if (originalDimensions) {
          dragDisp.setNodeDimensions(clone.id, {
            ...originalDimensions,
            width: originalDimensions.finalWidth,
            height: originalDimensions.finalHeight,
            finalWidth: originalDimensions.finalWidth,
            finalHeight: originalDimensions.finalHeight,
            isFillMode: false,
          });
        }

        return clone;
      };

      // Clone all nodes maintaining relative positions
      nodesToDuplicate.forEach((node, index) => {
        if (index === 0) {
          // Main node at current mouse position
          cloneNodes(node, currentX, currentY);
        } else {
          // Additional nodes positioned relative to main node
          const offset = additionalOffsets[node.id];
          if (offset) {
            const additionalX = currentX + offset.offsetX;
            const additionalY = currentY + offset.offsetY;
            cloneNodes(node, additionalX, additionalY);
          }
        }
      });

      // For viewport nodes, sync after duplication
      if (mainNode.inViewport) {
        nodeDisp.syncViewports();
      }

      // Reset duplicated flag for next duplication
      dragDisp.setDuplicatedFromAlt(true);
      setTimeout(() => {
        dragDisp.setDuplicatedFromAlt(false);
      }, 0);
    } catch (error) {
      console.error("Error during duplication:", error);
    }
  };

  // Reset flags when drag ends
  useEffect(() => {
    if (!dragState.isDragging) {
      hasDuplicatedInCurrentDragRef.current = false;
      dragDisp.setDuplicatedFromAlt(false);
    }
  }, [dragState.isDragging]);

  // Handle Alt key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault();
        isAltPressedRef.current = true;

        if (dragState.isDragging && !hasDuplicatedInCurrentDragRef.current) {
          handleDuplication();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        isAltPressedRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [dragState.isDragging]);

  // Handle drag start while Alt is pressed
  useEffect(() => {
    if (
      dragState.isDragging &&
      isAltPressedRef.current &&
      !hasDuplicatedInCurrentDragRef.current
    ) {
      handleDuplication();
    }
  }, [dragState.isDragging]);

  return {
    isAltPressed: isAltPressedRef.current,
    isDuplicating: dragState.duplicatedFromAlt,
  };
};
