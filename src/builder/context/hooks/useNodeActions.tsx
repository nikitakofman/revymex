// useNodeActions.ts
import { useCallback, useRef } from "react";
import {
  NodeId,
  useGetAllNodes,
  useGetNodeSharedInfo,
  useGetNodeFlags,
} from "@/builder/context/atoms/node-store";
import {
  removeNode,
  duplicateNode,
  getNodeById,
} from "@/builder/context/atoms/node-store/operations/insert-operations";
import { useGetDescendants } from "@/builder/context/atoms/node-store/hierarchy-store";
import { selectOps, useGetSelectedIds } from "../atoms/select-store";
import {
  dragOps,
  useGetAdditionalDraggedNodes,
  useGetDraggedNode,
  useGetIsDragging,
} from "../atoms/drag-store";
import { useTransform } from "../atoms/canvas-interaction-store";

export const useNodeActions = () => {
  const containerRef = useRef(null);
  const getAllNodes = useGetAllNodes();
  const getDescendants = useGetDescendants();
  const getNodeSharedInfo = useGetNodeSharedInfo();
  const getNodeFlags = useGetNodeFlags();

  const currentSelectedIds = useGetSelectedIds();
  const getIsDragging = useGetIsDragging();
  const getDraggedNode = useGetDraggedNode();
  const getAdditionalDraggedNodes = useGetAdditionalDraggedNodes();

  const transform = useTransform();
  const { clearSelection, addToSelection } = selectOps;

  const STORAGE_KEY = "builder_clipboard";

  // Helper to collect all child nodes recursively
  const getAllChildNodes = useCallback(
    (nodeId: string): NodeId[] => {
      return Array.from(getDescendants(nodeId));
    },
    [getDescendants]
  );

  // Delete nodes action
  const handleDelete = useCallback(() => {
    const selectedIds = currentSelectedIds();
    if (!selectedIds?.length) return;

    const nodesToRemove = new Set<NodeId>();

    // First collect all nodes to be deleted (selected nodes and their children)
    selectedIds.forEach((nodeId) => {
      nodesToRemove.add(nodeId);

      // Also collect all descendants
      const descendants = getDescendants(nodeId);
      descendants.forEach((id) => nodesToRemove.add(id));
    });

    // Check if any nodes are in viewports
    const nodesInViewport = Array.from(nodesToRemove).some((id) => {
      const flags = getNodeFlags(id);
      return flags.inViewport;
    });

    // Collect all shared IDs that need syncing for removal
    const sharedIdsToRemove = new Set<string>();

    if (nodesInViewport) {
      Array.from(nodesToRemove).forEach((id) => {
        const sharedInfo = getNodeSharedInfo(id);
        if (sharedInfo.sharedId) {
          sharedIdsToRemove.add(sharedInfo.sharedId);
        }
      });
    }

    // Find all nodes with matching shared IDs across viewports
    if (sharedIdsToRemove.size > 0) {
      const allNodes = getAllNodes();
      allNodes.forEach((node) => {
        if (node.sharedId && sharedIdsToRemove.has(node.sharedId)) {
          nodesToRemove.add(node.id);

          // Also add children of these shared nodes
          const descendants = getDescendants(node.id);
          descendants.forEach((id) => nodesToRemove.add(id));
        }
      });
    }

    // Sort nodes to ensure children are removed before parents
    // This avoids orphaned nodes
    const nodeIds = Array.from(nodesToRemove);
    const allNodes = getAllNodes();

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

    // Remove the nodes in the correct order
    nodeIds.forEach((id) => {
      removeNode(id);
    });

    // Clear selection
    selectOps.clearSelection();
  }, [
    currentSelectedIds,
    getDescendants,
    getNodeFlags,
    getNodeSharedInfo,
    getAllNodes,
  ]);

  // Dramatically simplified duplicate nodes action using duplicateNode operation

  // Copy to clipboard action
  const handleCopy = useCallback(() => {
    const selectedIds = currentSelectedIds();
    const allNodes = getAllNodes();

    const selectedNodes = selectedIds
      .map((id) => allNodes.find((n) => n.id === id))
      .filter((n) => n !== undefined);

    if (selectedNodes.length === 0) return;

    // Store the selected nodes and their children
    const allNodesToCopy = [];
    selectedNodes.forEach((node) => {
      allNodesToCopy.push(node);
      const children = getAllChildNodes(node.id);
      const childNodes = children
        .map((id) => allNodes.find((n) => n.id === id))
        .filter(Boolean);
      allNodesToCopy.push(...childNodes);
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
  }, [currentSelectedIds, getAllNodes, getAllChildNodes]);

  // Paste from clipboard action
  const handlePaste = useCallback(
    (x?: number, y?: number) => {
      const clipboardJson = localStorage.getItem(STORAGE_KEY);
      if (!clipboardJson) return;

      try {
        const clipboardData = JSON.parse(clipboardJson);
        const copiedNodes = clipboardData.nodes;

        if (!copiedNodes?.length) return;

        // Find root nodes (those with no parent in the copied set)
        const rootNodes = copiedNodes.filter(
          (node) => !copiedNodes.find((n) => n.id === node.parentId)
        );

        // Calculate position for pasting
        const rect = containerRef.current?.getBoundingClientRect();

        // Process each root node separately for precise positioning
        const newNodeIds = [];
        const idMapping = new Map();

        // Find the top-left most node to use as reference point
        const referenceNode = rootNodes.reduce((ref, node) => {
          const nodeLeft = parseFloat(node.style.left) || 0;
          const nodeTop = parseFloat(node.style.top) || 0;
          const refLeft = parseFloat(ref?.style.left) || Infinity;
          const refTop = parseFloat(ref?.style.top) || Infinity;

          if (
            nodeLeft < refLeft ||
            (nodeLeft === refLeft && nodeTop < refTop)
          ) {
            return node;
          }
          return ref;
        }, rootNodes[0]);

        const referenceLeft = parseFloat(referenceNode.style.left) || 0;
        const referenceTop = parseFloat(referenceNode.style.top) || 0;

        // Process root nodes
        for (const rootNode of rootNodes) {
          // Calculate paste position
          let offsetPosition = { x: 50, y: 0 }; // Default offset

          if (x !== undefined && y !== undefined && rect) {
            // Use cursor position for pasting
            const originalLeft = parseFloat(rootNode.style.left) || 0;
            const originalTop = parseFloat(rootNode.style.top) || 0;

            // Calculate position relative to reference node
            const relativeX = originalLeft - referenceLeft;
            const relativeY = originalTop - referenceTop;

            // Use cursor position as base and maintain relative positions
            const canvasX =
              (x - rect.left - transform.x) / transform.scale + relativeX;
            const canvasY =
              (y - rect.top - transform.y) / transform.scale + relativeY;

            // Create absolute position offset from original
            offsetPosition = {
              x: canvasX - originalLeft,
              y: canvasY - originalTop,
            };
          }

          // Duplicate the node and its children
          const newNodeId = duplicateNode(
            rootNode.id, // Source node
            null, // Place at root level
            0, // At the beginning
            {
              includeChildren: true,
              newSharedId: false, // No shared ID for pasted nodes
              offsetPosition,
            }
          );

          if (newNodeId) {
            newNodeIds.push(newNodeId);
            idMapping.set(rootNode.id, newNodeId);
          }
        }

        // Select the new nodes
        if (newNodeIds.length > 0) {
          clearSelection();
          newNodeIds.forEach((id) => addToSelection(id));
          return newNodeIds[0];
        }

        return null;
      } catch (error) {
        console.error("Failed to paste from clipboard:", error);
        return null;
      }
    },
    [transform, clearSelection, addToSelection, containerRef]
  );

  // Return the simplified API
  return {
    handleDelete,

    getAllChildNodes,
    handleCopy,
    handlePaste,
  };
};
