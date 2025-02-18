import { useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { findIndexWithinParent } from "../dnd/utils";

export const useKeyboardDrag = () => {
  const { dragState, nodeState, dragDisp, nodeDisp, transform, containerRef } =
    useBuilder();
  const isAltPressedRef = useRef(false);

  // Helper to collect all child nodes recursively
  const getAllChildNodes = (nodeId: string, nodes: Node[]): Node[] => {
    const directChildren = nodes.filter((n) => n.parentId === nodeId);
    let allChildren: Node[] = [...directChildren];

    directChildren.forEach((child) => {
      const childrenOfChild = getAllChildNodes(child.id, nodes);
      allChildren = [...allChildren, ...childrenOfChild];
    });

    return allChildren;
  };

  // Modified cloneNode to return all clones created, not just the root
  const cloneNode = (
    originalNode: Node,
    existingNodes: Node[],
    cloneMap: Map<string, Node> = new Map()
  ): { rootClone: Node; allClones: Node[] } => {
    // Generate new unique IDs
    const newId = nanoid();
    const newSharedId = originalNode.sharedId ? nanoid() : undefined;

    // Create deep clone with new IDs
    const clone: Node = {
      ...originalNode,
      id: newId,
      sharedId: newSharedId,
      style: { ...originalNode.style },
      parentId: originalNode.parentId,
      inViewport: originalNode.inViewport,
    };

    // Store in the map for lookup
    cloneMap.set(originalNode.id, clone);

    // Track all clones created in this operation
    const allClones: Node[] = [clone];

    // Check for child nodes
    const childNodes = existingNodes.filter(
      (n) => n.parentId === originalNode.id
    );

    if (childNodes.length > 0) {
      childNodes.forEach((child) => {
        const { rootClone: clonedChild, allClones: childClones } = cloneNode(
          child,
          existingNodes,
          cloneMap
        );

        // Update parentId to reference the new parent
        clonedChild.parentId = newId;

        // Add all created clones to our collection
        allClones.push(...childClones);
      });
    }

    return { rootClone: clone, allClones };
  };

  const handleDuplication = () => {
    if (!dragState.isDragging || !dragState.draggedNode) return;

    try {
      const mainNode = dragState.draggedNode.node;

      // Different handling for viewport nodes vs canvas nodes
      if (mainNode.inViewport) {
        // Handle viewport duplication
        handleViewportDuplication(mainNode);
      } else {
        // Handle canvas duplication
        handleCanvasDuplication(mainNode);
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

  const handleCanvasDuplication = (mainNode: Node) => {
    const mainDragPreview = document.querySelector(
      `[data-node-dragged="${mainNode.id}"]`
    );
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (!mainDragPreview || !containerRect) return;

    // Calculate the main dragged node's position
    const mainRect = mainDragPreview.getBoundingClientRect();
    const mainX =
      (mainRect.left - containerRect.left - transform.x) / transform.scale;
    const mainY =
      (mainRect.top - containerRect.top - transform.y) / transform.scale;

    // Track all nodes created during cloning
    const allClonedNodesByNode = new Map<string, Node[]>();
    const rootClonedNodes = new Map<string, Node>();

    // Clone the main node with all its children
    const { rootClone: mainClone, allClones: mainAllClones } = cloneNode(
      mainNode,
      nodeState.nodes
    );
    allClonedNodesByNode.set(mainNode.id, mainAllClones);
    rootClonedNodes.set(mainNode.id, mainClone);

    // Set its absolute position where the mouse currently is
    mainClone.style = {
      ...mainClone.style,
      position: "absolute",
      left: `${mainX}px`,
      top: `${mainY}px`,
    };

    // Handle additional dragged nodes if any
    if (dragState.additionalDraggedNodes?.length) {
      // For each additional node being dragged
      dragState.additionalDraggedNodes.forEach((info) => {
        const additionalNode = info.node;

        // Clone the additional node with all its children
        const { rootClone: additionalClone, allClones: additionalAllClones } =
          cloneNode(additionalNode, nodeState.nodes);

        allClonedNodesByNode.set(additionalNode.id, additionalAllClones);
        rootClonedNodes.set(additionalNode.id, additionalClone);

        if (!additionalNode.inViewport) {
          // Calculate position based on the original offset from main node
          // This preserves the relative positioning between nodes
          const originalMainLeft =
            parseFloat(mainNode.style.left as string) || 0;
          const originalMainTop = parseFloat(mainNode.style.top as string) || 0;
          const originalAddLeft =
            parseFloat(additionalNode.style.left as string) || 0;
          const originalAddTop =
            parseFloat(additionalNode.style.top as string) || 0;

          // Calculate the relative offset from main node in original positions
          const relativeX = originalAddLeft - originalMainLeft;
          const relativeY = originalAddTop - originalMainTop;

          // Apply the same relative offset to the new position
          const newX = mainX + relativeX;
          const newY = mainY + relativeY;

          // Set absolute position
          additionalClone.style = {
            ...additionalClone.style,
            position: "absolute",
            left: `${newX}px`,
            top: `${newY}px`,
          };
        }
      });
    }

    // Now insert all cloned nodes to the state
    // First add all root nodes
    for (const [originalNodeId, rootClone] of rootClonedNodes.entries()) {
      const allClones = allClonedNodesByNode.get(originalNodeId) || [];

      // Add main clone first (root level)
      if (!rootClone.inViewport) {
        nodeDisp.insertAtIndex(rootClone, 0, null);
      }

      // Copy dimensions for the root node
      const originalNode = nodeState.nodes.find((n) => n.id === originalNodeId);
      if (originalNode) {
        copyDimensions(originalNode, rootClone);
      }

      // Add all child clones
      const childClones = allClones.filter(
        (clone) => clone.id !== rootClone.id
      );
      for (const childClone of childClones) {
        nodeDisp.insertAtIndex(childClone, 0, childClone.parentId);

        // Find the original child to copy dimensions from
        const originalChildren = getAllChildNodes(
          originalNodeId,
          nodeState.nodes
        );
        const originalChild = originalChildren.find(
          (n) => n.parentId === originalNode?.id && n.type === childClone.type
        );

        if (originalChild) {
          copyDimensions(originalChild, childClone);
        }
      }
    }
  };

  const handleViewportDuplication = (mainNode: Node) => {
    // Track all nodes created during cloning
    const allClonedNodes: Node[] = [];
    const rootClonedNodes: Node[] = [];

    // Get all nodes to duplicate
    const nodesToDuplicate = [mainNode];

    // Add additional selected nodes
    if (dragState.additionalDraggedNodes?.length) {
      dragState.additionalDraggedNodes.forEach((info) => {
        nodesToDuplicate.push(info.node);
      });
    }

    // Clone all top-level nodes with their children
    nodesToDuplicate.forEach((node) => {
      const { rootClone, allClones } = cloneNode(node, nodeState.nodes);
      rootClonedNodes.push(rootClone);
      allClonedNodes.push(...allClones);

      // Copy dimensions for the root node
      copyDimensions(node, rootClone);
    });

    // First insert all root nodes to maintain correct order
    rootClonedNodes.forEach((rootClone) => {
      const originalNode = nodesToDuplicate.find(
        (n) =>
          n.type === rootClone.type &&
          n.parentId === rootClone.parentId &&
          !rootClonedNodes.includes(n as Node)
      );

      if (originalNode) {
        const originalIndex = findIndexWithinParent(
          nodeState.nodes,
          originalNode.id,
          originalNode.parentId
        );
        nodeDisp.insertAtIndex(rootClone, originalIndex, rootClone.parentId);
      }
    });

    // Then insert all child nodes
    const childNodes = allClonedNodes.filter(
      (node) => !rootClonedNodes.includes(node)
    );
    childNodes.forEach((childNode) => {
      nodeDisp.insertAtIndex(childNode, 0, childNode.parentId);

      // Find original child to copy dimensions
      const originalParentId = nodesToDuplicate.find(
        (n) =>
          allClonedNodes.find((clone) => clone.id === childNode.parentId)
            ?.type === n.type
      )?.id;

      if (originalParentId) {
        const originalChildren = getAllChildNodes(
          originalParentId,
          nodeState.nodes
        );
        const originalChild = originalChildren.find(
          (child) => child.type === childNode.type
        );

        if (originalChild) {
          copyDimensions(originalChild, childNode);
        }
      }
    });

    // For viewport nodes, sync after duplication
    nodeDisp.syncViewports();
  };

  // Helper function to copy dimensions from original to clone
  const copyDimensions = (originalNode: Node, clonedNode: Node) => {
    const originalDimensions = dragState.nodeDimensions[originalNode.id];
    if (originalDimensions) {
      dragDisp.setNodeDimensions(clonedNode.id, {
        ...originalDimensions,
        width: originalDimensions.finalWidth,
        height: originalDimensions.finalHeight,
        finalWidth: originalDimensions.finalWidth,
        finalHeight: originalDimensions.finalHeight,
        isFillMode: false,
      });
    }
  };

  // Reset flags when drag ends
  useEffect(() => {
    if (!dragState.isDragging) {
      dragDisp.setDuplicatedFromAlt(false);
    }
  }, [dragState.isDragging]);

  // Handle Alt key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault();
        isAltPressedRef.current = true;

        if (dragState.isDragging) {
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
    if (dragState.isDragging && isAltPressedRef.current) {
      handleDuplication();
    }
  }, [dragState.isDragging]);

  return {
    isAltPressed: isAltPressedRef.current,
    isDuplicating: dragState.duplicatedFromAlt,
  };
};
