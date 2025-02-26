import { Transform } from "@/builder/context/utils";
import {
  Node,
  NodeDispatcher,
  NodeState,
} from "@/builder/reducer/nodeDispatcher";
import { Frame, Box, Type, ImageIcon } from "lucide-react";
import { nanoid } from "nanoid";

// Constants for DnD
export const DND_HOVER_TIMEOUT = 500; // ms until a hover opens a collapsed node

export const buildTreeFromNodes = (
  nodes: Node[],
  isDynamicMode: boolean,
  dynamicNodeId: string | number | null
) => {
  let filteredNodes = nodes.filter((node) => node.type !== "placeholder");

  // Apply the same filtering logic regardless of viewport type
  if (isDynamicMode && dynamicNodeId) {
    const dynamicNode = filteredNodes.find((node) => node.id === dynamicNodeId);
    if (dynamicNode) {
      filteredNodes = filteredNodes.filter(
        (node) =>
          node.id === dynamicNodeId ||
          node.dynamicParentId === dynamicNodeId ||
          node.parentId === dynamicNodeId
      );
    }
  } else {
    filteredNodes = filteredNodes.filter((node) => {
      if (node.dynamicParentId) return false;
      if (!node.originalState) return true;
      return false;
    });
  }

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

  // Treat all viewports consistently in sorting
  tree = tree.sort((a, b) => {
    if (isDynamicMode) {
      if (a.id === dynamicNodeId) return -1;
      if (b.id === dynamicNodeId) return 1;
    }

    // Consistently place all viewports at the top
    if (a.isViewport && !b.isViewport) return -1;
    if (!a.isViewport && b.isViewport) return 1;

    const aHasChildren = nodeMap.get(a.id).children.length > 0;
    const bHasChildren = nodeMap.get(b.id).children.length > 0;

    if (
      a.type === "frame" &&
      aHasChildren &&
      (b.type !== "frame" || !bHasChildren)
    )
      return -1;
    if (
      b.type === "frame" &&
      bHasChildren &&
      (a.type !== "frame" || !aHasChildren)
    )
      return 1;

    if (a.type === "frame" && !aHasChildren && b.type !== "frame") return 1;
    if (b.type === "frame" && !bHasChildren && a.type !== "frame") return -1;

    return 0;
  });

  return tree;
};

export const getElementIcon = (type: string, isSelected: boolean) => {
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
