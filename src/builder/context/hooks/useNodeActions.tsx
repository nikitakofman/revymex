// useNodeActions.ts
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { nanoid } from "nanoid";
import { findIndexWithinParent } from "../utils";

export const useNodeActions = () => {
  const { dragState, nodeState, dragDisp, nodeDisp, transform, containerRef } =
    useBuilder();

  const STORAGE_KEY = "builder_clipboard";

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

  // Clone node helper
  const cloneNode = (
    originalNode: Node,
    existingNodes: Node[],
    cloneMap: Map<string, Node> = new Map()
  ): { rootClone: Node; allClones: Node[] } => {
    const newId = nanoid();
    const newSharedId = originalNode.sharedId ? nanoid() : undefined;

    const clone: Node = {
      ...originalNode,
      id: newId,
      sharedId: newSharedId,
      style: { ...originalNode.style },
      parentId: originalNode.parentId,
      inViewport: originalNode.inViewport,
    };

    cloneMap.set(originalNode.id, clone);
    const allClones: Node[] = [clone];

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
        clonedChild.parentId = newId;
        allClones.push(...childClones);
      });
    }

    return { rootClone: clone, allClones };
  };

  // Copy dimensions helper
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

  // Delete nodes action
  const handleDelete = () => {
    if (!dragState.selectedIds?.length) return;

    const nodesToRemove = new Set<string | number>();

    // Step 1: First collect all nodes to be deleted (selected nodes and their children)
    dragState.selectedIds.forEach((nodeId) => {
      const node = nodeState.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      nodesToRemove.add(nodeId);

      // For each node, also collect all its children recursively
      const children = getAllChildNodes(nodeId, nodeState.nodes);
      children.forEach((child) => nodesToRemove.add(child.id));
    });

    // Step 2: Check if any nodes are in viewports
    const nodesInViewport = Array.from(nodesToRemove).some((id) => {
      const node = nodeState.nodes.find((n) => n.id === id);
      return node?.inViewport;
    });

    // Step 3: Collect all shared IDs for nodes in viewports
    const sharedIdsToRemove = new Set<string>();

    if (nodesInViewport) {
      Array.from(nodesToRemove).forEach((id) => {
        const node = nodeState.nodes.find((n) => n.id === id);
        if (node?.sharedId) {
          sharedIdsToRemove.add(node.sharedId);
        }
      });
    }

    // Step 4: Find all nodes with the same shared IDs across viewports
    if (sharedIdsToRemove.size > 0) {
      nodeState.nodes.forEach((node) => {
        if (node.sharedId && sharedIdsToRemove.has(node.sharedId)) {
          nodesToRemove.add(node.id);

          // Also add children of these shared nodes
          const children = getAllChildNodes(node.id, nodeState.nodes);
          children.forEach((child) => nodesToRemove.add(child.id));
        }
      });
    }

    // Step 5: Actually delete the nodes
    // Remove children first to avoid orphaned nodes
    const allNodes = [...nodeState.nodes];
    const nodeIds = Array.from(nodesToRemove);

    // Sort nodes so that children are removed before parents
    nodeIds.sort((idA, idB) => {
      const nodeA = allNodes.find((n) => n.id === idA);
      const nodeB = allNodes.find((n) => n.id === idB);

      if (!nodeA || !nodeB) return 0;

      // If B is a child of A, remove B first
      if (nodeB.parentId === nodeA.id) return 1;
      // If A is a child of B, remove A first
      if (nodeA.parentId === nodeB.id) return -1;

      return 0;
    });

    // Now remove the nodes in the correct order
    nodeIds.forEach((id) => {
      console.log(`Removing node ${id}`);
      nodeDisp.removeNode(id);
    });

    // Clear selection
    dragDisp.clearSelection();
  };

  // Duplicate nodes action
  const handleDuplicate = (fromContextMenu = false) => {
    try {
      // When duplicating from context menu, use selected nodes
      // When duplicating from drag, use dragged nodes
      let nodesToDuplicate: Node[] = [];

      if (fromContextMenu) {
        nodesToDuplicate = dragState.selectedIds
          .map((id) => nodeState.nodes.find((n) => n.id === id))
          .filter((n): n is Node => n !== undefined);
      } else {
        if (!dragState.isDragging || !dragState.draggedNode) return;
        nodesToDuplicate = [dragState.draggedNode.node];
        if (dragState.additionalDraggedNodes) {
          nodesToDuplicate.push(
            ...dragState.additionalDraggedNodes.map((info) => info.node)
          );
        }
      }

      if (nodesToDuplicate.length === 0) return;
      const mainNode = nodesToDuplicate[0];

      if (mainNode.inViewport || mainNode.parentId) {
        handleViewportDuplication(nodesToDuplicate, fromContextMenu);
      } else {
        if (fromContextMenu) {
          handleContextMenuCanvasDuplication(nodesToDuplicate);
        } else {
          handleCanvasDuplication(mainNode);
        }
      }

      dragDisp.setDuplicatedFromAlt(true);
      setTimeout(() => {
        dragDisp.setDuplicatedFromAlt(false);
      }, 0);
    } catch (error) {
      console.error("Error during duplication:", error);
    }
  };

  // New helper for context menu canvas duplication
  const handleContextMenuCanvasDuplication = (nodesToDuplicate: Node[]) => {
    const allClonedNodesByNode = new Map<string, Node[]>();
    const rootClonedNodes = new Map<string, Node>();

    // Clone all selected nodes
    nodesToDuplicate.forEach((node) => {
      const { rootClone, allClones } = cloneNode(node, nodeState.nodes);
      allClonedNodesByNode.set(node.id, allClones);
      rootClonedNodes.set(node.id, rootClone);

      // Get the original node's dimensions
      const dimensions = dragState.nodeDimensions[node.id];
      const nodeWidth = dimensions?.width || 0;

      // Position the clone to the right of the original
      const originalLeft = parseFloat(node.style.left as string) || 0;
      const originalTop = parseFloat(node.style.top as string) || 0;

      const originalWidth = parseFloat(node.style.width as string) || 0;

      rootClone.style = {
        ...rootClone.style,
        position: "absolute",
        left: `${originalLeft + originalWidth + 50}px`,
        top: `${originalTop}px`,
      };
    });

    // Insert all cloned nodes
    for (const [originalNodeId, rootClone] of rootClonedNodes.entries()) {
      const allClones = allClonedNodesByNode.get(originalNodeId) || [];

      nodeDisp.insertAtIndex(rootClone, 0, null);

      const originalNode = nodeState.nodes.find((n) => n.id === originalNodeId);
      if (originalNode) {
        copyDimensions(originalNode, rootClone);
      }

      // Handle children
      const childClones = allClones.filter(
        (clone) => clone.id !== rootClone.id
      );
      for (const childClone of childClones) {
        nodeDisp.insertAtIndex(childClone, 0, childClone.parentId);

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

  // Canvas duplication helper
  const handleCanvasDuplication = (mainNode: Node) => {
    const mainDragPreview = document.querySelector(
      `[data-node-dragged="${mainNode.id}"]`
    );
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (!mainDragPreview || !containerRect) return;

    // Calculate positions and create clones
    const mainRect = mainDragPreview.getBoundingClientRect();
    const mainX =
      (mainRect.left - containerRect.left - transform.x) / transform.scale;
    const mainY =
      (mainRect.top - containerRect.top - transform.y) / transform.scale;

    const allClonedNodesByNode = new Map<string, Node[]>();
    const rootClonedNodes = new Map<string, Node>();

    const { rootClone: mainClone, allClones: mainAllClones } = cloneNode(
      mainNode,
      nodeState.nodes
    );
    allClonedNodesByNode.set(mainNode.id, mainAllClones);
    rootClonedNodes.set(mainNode.id, mainClone);

    mainClone.style = {
      ...mainClone.style,
      position: "absolute",
      left: `${mainX}px`,
      top: `${mainY}px`,
    };

    // Handle additional selected nodes
    if (dragState.additionalDraggedNodes?.length) {
      dragState.additionalDraggedNodes.forEach((info) => {
        const additionalNode = info.node;
        const { rootClone: additionalClone, allClones: additionalAllClones } =
          cloneNode(additionalNode, nodeState.nodes);

        allClonedNodesByNode.set(additionalNode.id, additionalAllClones);
        rootClonedNodes.set(additionalNode.id, additionalClone);

        if (!additionalNode.inViewport) {
          const originalMainLeft =
            parseFloat(mainNode.style.left as string) || 0;
          const originalMainTop = parseFloat(mainNode.style.top as string) || 0;
          const originalAddLeft =
            parseFloat(additionalNode.style.left as string) || 0;
          const originalAddTop =
            parseFloat(additionalNode.style.top as string) || 0;

          const relativeX = originalAddLeft - originalMainLeft;
          const relativeY = originalAddTop - originalMainTop;

          const newX = mainX + relativeX;
          const newY = mainY + relativeY;

          additionalClone.style = {
            ...additionalClone.style,
            position: "absolute",
            left: `${newX}px`,
            top: `${newY}px`,
          };
        }
      });
    }

    // Insert all cloned nodes
    for (const [originalNodeId, rootClone] of rootClonedNodes.entries()) {
      const allClones = allClonedNodesByNode.get(originalNodeId) || [];

      if (!rootClone.inViewport) {
        nodeDisp.insertAtIndex(rootClone, 0, null);
      }

      const originalNode = nodeState.nodes.find((n) => n.id === originalNodeId);
      if (originalNode) {
        copyDimensions(originalNode, rootClone);
      }

      const childClones = allClones.filter(
        (clone) => clone.id !== rootClone.id
      );
      for (const childClone of childClones) {
        nodeDisp.insertAtIndex(childClone, 0, childClone.parentId);

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

  // Viewport duplication helper
  const handleViewportDuplication = (
    nodesToDuplicate: Node[],
    fromContextMenu = false
  ) => {
    const allClonedNodes: Node[] = [];
    const rootClonedNodes: Node[] = [];

    nodesToDuplicate.forEach((node) => {
      const { rootClone, allClones } = cloneNode(node, nodeState.nodes);
      rootClonedNodes.push(rootClone);
      allClonedNodes.push(...allClones);
      copyDimensions(node, rootClone);
    });

    // Insert root nodes
    rootClonedNodes.forEach((rootClone) => {
      const originalNode = nodesToDuplicate.find(
        (n) => n.type === rootClone.type && n.parentId === rootClone.parentId
      );

      if (originalNode) {
        const originalIndex = findIndexWithinParent(
          nodeState.nodes,
          originalNode.id,
          originalNode.parentId
        );
        // If from context menu, insert after the original node
        const targetIndex = fromContextMenu ? originalIndex + 1 : originalIndex;
        nodeDisp.insertAtIndex(rootClone, targetIndex, rootClone.parentId);
      }
    });

    // Insert child nodes
    const childNodes = allClonedNodes.filter(
      (node) => !rootClonedNodes.includes(node)
    );
    childNodes.forEach((childNode) => {
      nodeDisp.insertAtIndex(childNode, 0, childNode.parentId);

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

    nodeDisp.syncViewports();
  };

  const handleCopy = () => {
    const selectedNodes = dragState.selectedIds
      .map((id) => nodeState.nodes.find((n) => n.id === id))
      .filter((n): n is Node => n !== undefined);

    if (selectedNodes.length === 0) return;

    // Store the selected nodes and their children
    const allNodesToCopy: Node[] = [];
    selectedNodes.forEach((node) => {
      allNodesToCopy.push(node);
      const children = getAllChildNodes(node.id, nodeState.nodes);
      allNodesToCopy.push(...children);
    });

    // Create clipboard data structure
    const clipboardData = {
      nodes: allNodesToCopy,
      timestamp: Date.now(),
    };

    // Store in localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clipboardData));
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handlePaste = (x?: number, y?: number) => {
    const clipboardJson = localStorage.getItem(STORAGE_KEY);
    if (!clipboardJson) return;

    try {
      const clipboardData = JSON.parse(clipboardJson);
      const copiedNodes = clipboardData.nodes as Node[];

      if (!copiedNodes?.length) return;

      const rootNodes = copiedNodes.filter(
        (node) => !copiedNodes.find((n) => n.id === node.parentId)
      );

      const allClonedNodesByNode = new Map<string, Node[]>();
      const rootClonedNodes = new Map<string, Node>();
      const rect = containerRef.current?.getBoundingClientRect();

      // Find the top-left most node to use as reference point
      const referenceNode = rootNodes.reduce((ref, node) => {
        const nodeLeft = parseFloat(node.style.left as string) || 0;
        const nodeTop = parseFloat(node.style.top as string) || 0;
        const refLeft = parseFloat(ref?.style.left as string) || Infinity;
        const refTop = parseFloat(ref?.style.top as string) || Infinity;

        if (nodeLeft < refLeft || (nodeLeft === refLeft && nodeTop < refTop)) {
          return node;
        }
        return ref;
      }, rootNodes[0]);

      const referenceLeft = parseFloat(referenceNode.style.left as string) || 0;
      const referenceTop = parseFloat(referenceNode.style.top as string) || 0;

      // Clone all root nodes first
      rootNodes.forEach((node) => {
        const { rootClone, allClones } = cloneNode(node, nodeState.nodes);
        allClonedNodesByNode.set(node.id, allClones);
        rootClonedNodes.set(node.id, rootClone);

        if (!node.inViewport && !node.parentId) {
          if (x && y && rect) {
            // Calculate relative position from reference node
            const originalLeft = parseFloat(node.style.left as string) || 0;
            const originalTop = parseFloat(node.style.top as string) || 0;
            const relativeLeft = originalLeft - referenceLeft;
            const relativeTop = originalTop - referenceTop;

            // Apply relative position to new paste coordinates
            const canvasX = (x - rect.left - transform.x) / transform.scale;
            const canvasY = (y - rect.top - transform.y) / transform.scale;

            rootClone.style = {
              ...rootClone.style,
              position: "absolute",
              left: `${canvasX + relativeLeft}px`,
              top: `${canvasY + relativeTop}px`,
            };
          } else {
            // Original offset behavior
            const nodeWidth = parseFloat(node.style.width as string) || 0;
            const originalLeft = parseFloat(node.style.left as string) || 0;
            const originalTop = parseFloat(node.style.top as string) || 0;

            rootClone.style = {
              ...rootClone.style,
              position: "absolute",
              left: `${originalLeft + nodeWidth + 50}px`,
              top: `${originalTop}px`,
            };
          }
        }
      });

      // Rest of the function remains the same...
      for (const [originalNodeId, rootClone] of rootClonedNodes.entries()) {
        const allClones = allClonedNodesByNode.get(originalNodeId) || [];
        const originalNode = copiedNodes.find((n) => n.id === originalNodeId);

        if (!originalNode) continue;

        if (originalNode.inViewport || originalNode.parentId) {
          const siblingNodes = nodeState.nodes.filter(
            (n) => n.parentId === originalNode.parentId
          );
          const originalIndex = siblingNodes.findIndex(
            (n) => n.id === originalNode.id
          );
          nodeDisp.insertAtIndex(
            rootClone,
            originalIndex + 1,
            originalNode.parentId
          );
        } else {
          nodeDisp.insertAtIndex(rootClone, 0, null);
        }

        const childClones = allClones.filter(
          (clone) => clone.id !== rootClone.id
        );
        for (const childClone of childClones) {
          nodeDisp.insertAtIndex(childClone, 0, childClone.parentId);
        }
      }

      const hasViewportNodes = copiedNodes.some((node) => node.inViewport);
      if (hasViewportNodes) {
        nodeDisp.syncViewports();
      }

      const newNodeIds = Array.from(rootClonedNodes.values()).map(
        (node) => node.id
      );
      dragDisp.clearSelection();
      newNodeIds.forEach((id) => dragDisp.addToSelection(id));
    } catch (error) {
      console.error("Failed to paste from clipboard:", error);
    }
  };

  return {
    handleDelete,
    handleDuplicate,
    getAllChildNodes,
    handleCopy,
    handlePaste,
  };
};
