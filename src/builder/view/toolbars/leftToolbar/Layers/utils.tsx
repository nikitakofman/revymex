import { Transform } from "@/builder/context/utils";
import {
  Node,
  NodeDispatcher,
  NodeState,
} from "@/builder/reducer/nodeDispatcher";
import { Frame, Box, Type, ImageIcon, Component } from "lucide-react";
import { nanoid } from "nanoid";

// Constants for DnD
export const DND_HOVER_TIMEOUT = 500; // ms until a hover opens a collapsed node

export const buildTreeFromNodes = (
  nodes: Node[],
  isDynamicMode: boolean,
  dynamicNodeId: string | number | null,
  activeViewportId: string | number | null
) => {
  // Filter out placeholder nodes
  let filteredNodes = nodes.filter((node) => node.type !== "placeholder");

  if (isDynamicMode && dynamicNodeId) {
    // Get the dynamic node
    const dynamicNode = filteredNodes.find((node) => node.id === dynamicNodeId);
    if (!dynamicNode) return [];

    const familyId = dynamicNode.dynamicFamilyId;
    if (!familyId) return [dynamicNode]; // If no family ID, just show the node itself

    // Track nodes to keep
    const nodesToKeep = new Set<string | number>();

    // Step 1: Find the specific base node for this viewport
    let baseNode;

    if (activeViewportId === "viewport-1440") {
      // For Desktop, use the main dynamic node or find one without viewportId
      baseNode = filteredNodes.find(
        (node) =>
          node.isDynamic &&
          node.dynamicFamilyId === familyId &&
          (!node.dynamicViewportId ||
            node.dynamicViewportId === activeViewportId)
      );
    } else {
      // For other viewports, find the base node that matches this viewport exactly
      baseNode = filteredNodes.find(
        (node) =>
          node.isDynamic &&
          node.dynamicFamilyId === familyId &&
          (node.dynamicViewportId === activeViewportId ||
            node.parentId === activeViewportId)
      );
    }

    // If we found a base node, add it and its children
    if (baseNode) {
      nodesToKeep.add(baseNode.id);

      // FIRST FIX: Use a recursive function to collect all descendants
      const addAllDescendants = (parentId: string | number) => {
        filteredNodes.forEach((node) => {
          if (node.parentId === parentId) {
            nodesToKeep.add(node.id);
            // Recursively add this node's children too
            addAllDescendants(node.id);
          }
        });
      };

      // Add all descendants of this base node, not just direct children
      addAllDescendants(baseNode.id);

      // Find ALL variants for this base node (not just one)
      const variants = filteredNodes.filter(
        (node) =>
          node.isVariant &&
          (node.dynamicParentId === baseNode.id ||
            node.variantParentId === baseNode.id) &&
          (!node.dynamicViewportId ||
            node.dynamicViewportId === activeViewportId)
      );

      // Add all variants and their children
      variants.forEach((variant) => {
        nodesToKeep.add(variant.id);

        // Use the same recursive function to add all descendants
        addAllDescendants(variant.id);
      });

      // SECOND FIX: Add any top-level nodes in the dynamic canvas
      filteredNodes.forEach((node) => {
        // If the node has no parent but has a dynamicParentId pointing to our base node
        if (!node.parentId && node.dynamicParentId === baseNode.id) {
          nodesToKeep.add(node.id);
          // Also add any children it might have
          addAllDescendants(node.id);
        }
      });
    }

    // Only keep nodes we explicitly marked
    filteredNodes = filteredNodes.filter((node) => nodesToKeep.has(node.id));
  } else {
    // For non-dynamic mode, filter out dynamic-related nodes
    filteredNodes = filteredNodes.filter((node) => {
      if (node.dynamicParentId) return false;
      if (node.isVariant) return false;
      if (node.originalState) return false;
      return true;
    });
  }

  // Build tree from filtered nodes
  const nodeMap = new Map();
  let tree: Node[] = [];

  filteredNodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  filteredNodes.forEach((node) => {
    const mappedNode = nodeMap.get(node.id);
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId);
      parent.children.push(mappedNode);
    } else {
      tree.push(mappedNode);
    }
  });

  // Sort the tree
  tree = tree.sort((a, b) => {
    if (isDynamicMode) {
      if (a.id === dynamicNodeId) return -1;
      if (b.id === dynamicNodeId) return 1;

      // Base nodes before variants
      if (a.isDynamic && b.isVariant) return -1;
      if (a.isVariant && b.isDynamic) return 1;
    }

    // Viewports at top
    if (a.isViewport && !b.isViewport) return -1;
    if (!a.isViewport && b.isViewport) return 1;

    return 0;
  });

  return tree;
};

export const getElementIcon = (
  type: string,
  isSelected: boolean,
  node?: any
) => {
  // Check if this is a top-level component (dynamic node or variant)
  if (node && (node.isDynamic || (node.isVariant && !node.parentId))) {
    // Return a special component icon
    return (
      <Component
        className={`w-4 h-4 ${
          isSelected ? "text-white" : "text-[var(--text-secondary)]"
        } dark:group-hover:text-white`}
      />
    );
  }

  // Regular element icons (unchanged)
  switch (type) {
    case "frame":
      return (
        <Frame
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } dark:group-hover:text-white`}
        />
      );
    case "text":
      return (
        <Type
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } dark:group-hover:text-white`}
        />
      );
    case "image":
      return (
        <ImageIcon
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } dark:group-hover:text-white`}
        />
      );
    default:
      return (
        <Box
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } group-hover:text-white`}
        />
      );
  }
};

// Find root canvas node or create one at a reasonable position if dropping outside viewport
export const findOrCreateCanvasPosition = (
  canvasElement: HTMLElement | null,
  nodeState: NodeState,
  transform: Transform
) => {
  if (!canvasElement) return { x: 50, y: 50 }; // Default fallback

  const rect = canvasElement.getBoundingClientRect();
  const viewportNodes = nodeState.nodes.filter((n: Node) => n.isViewport);

  // Find the lowest viewport to place canvas elements below
  let lowestY = 0;
  viewportNodes.forEach((node: Node) => {
    const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
    if (nodeElement) {
      const viewRect = nodeElement.getBoundingClientRect();
      const bottom =
        (viewRect.bottom - rect.top - transform.y) / transform.scale;
      if (bottom > lowestY) lowestY = bottom;
    }
  });

  return {
    x: 50,
    y: lowestY + 50, // Position below the viewport with some padding
  };
};

// Helper to check if node is a child of dragged item
export const isChildOfDragged = (
  nodeId: string | number,
  draggedId: string | number,
  nodes: Node[]
): boolean => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  if (node.parentId === draggedId) return true;
  if (node.parentId) return isChildOfDragged(node.parentId, draggedId, nodes);
  return false;
};

export const firstLetterUpperCase = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Helper to find the viewport of a node
export const getNodeViewport = (
  nodeId: string | number,
  nodeState: NodeState
): string | number | null => {
  let currentId = nodeId;
  // Loop up through parents to find viewport
  while (currentId) {
    const currentNode = nodeState.nodes.find((n: Node) => n.id === currentId);
    if (!currentNode) return null;

    // If we found a viewport, return its ID
    if (currentNode.isViewport) return currentNode.id;

    // If we've reached a node with no parent, it's not in a viewport
    if (!currentNode.parentId) return null;

    // Move up to the parent
    currentId = currentNode.parentId;
  }
  return null;
};
