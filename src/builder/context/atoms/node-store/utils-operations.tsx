// src/builder/context/atoms/node-operations/utils-operations.ts
import { Node } from "@/builder/context/atoms/node-store";
import {
  nodesArrayAtom,
  nodeStore,
  nodeMapAtom,
  siblingsIndexAtom,
  viewportRootsAtom,
  sharedIdBucketsAtom,
  dynamicFamilyIndexAtom,
} from "../node-store";

// Helper functions optimized to use the new data structure with O(1) lookups

export const findParentViewport = (
  nodeId: string | number | null | undefined,
  allNodes: Record<string | number, Node>,
  viewportRoots?: Set<string | number>
): string | number | null => {
  if (!nodeId) return null;

  // Use viewportRoots for fast viewport checks
  const viewports = viewportRoots || nodeStore.get(viewportRootsAtom);

  // Traverse up the parent chain until we find a viewport
  let currentId = nodeId;
  while (currentId) {
    // O(1) check if this node is a viewport
    if (viewports.has(currentId)) {
      return currentId;
    }

    const node = allNodes[currentId];
    if (!node) break;

    currentId = node.parentId;
  }

  return null;
};

export const isParentVariant = (
  parentId: string | number | null | undefined,
  allNodes: Record<string | number, Node>
): boolean => {
  if (!parentId) return false;

  // Direct map lookup - O(1)
  const parent = allNodes[parentId];
  return parent ? parent.isVariant : false;
};

export const isParentDynamic = (
  parentId: string | number | null | undefined,
  allNodes: Record<string | number, Node>
): boolean => {
  if (!parentId) return false;

  // Direct map lookup - O(1)
  const parent = allNodes[parentId];
  return parent ? parent.isDynamic : false;
};

export const isAncestorVariant = (
  parentId: string | number | null | undefined,
  allNodes: Record<string | number, Node>
): boolean => {
  if (!parentId) return false;

  let current = parentId;
  while (current) {
    // Direct map lookup - O(1)
    const node = allNodes[current];
    if (!node) break;

    if (node.isVariant) return true;
    current = node.parentId;
  }

  return false;
};

export const isAncestorDynamic = (
  parentId: string | number | null | undefined,
  allNodes: Record<string | number, Node>
): boolean => {
  if (!parentId) return false;

  let current = parentId;
  while (current) {
    // Direct map lookup - O(1)
    const node = allNodes[current];
    if (!node) break;

    if (node.isDynamic) return true;
    current = node.parentId;
  }

  return false;
};

export const findRootBaseNodeAncestor = (
  nodeId: string | number | null | undefined,
  allNodes: Record<string | number, Node>
): Node | null => {
  if (!nodeId) return null;

  let current = nodeId;
  let lastDynamic = null;

  while (current) {
    // Direct map lookup - O(1)
    const node = allNodes[current];
    if (!node) break;

    if (node.isDynamic) {
      lastDynamic = node;
    }

    if (!node.parentId) break;
    current = node.parentId;
  }

  return lastDynamic;
};

export const buildPathFromRoot = (
  rootId: string | number,
  targetId: string | number,
  allNodes: Record<string | number, Node>
): Node[] => {
  const path: Node[] = [];
  let current = targetId;

  // Traverse up from target to root, adding nodes to path
  while (current && current !== rootId) {
    // Direct map lookup - O(1)
    const node = allNodes[current];
    if (!node) break;

    path.unshift(node);
    current = node.parentId;
  }

  // Add the root node
  const rootNode = allNodes[rootId];
  if (rootNode) {
    path.unshift(rootNode);
  }

  return path;
};

export const followPathInViewport = (
  rootId: string | number,
  path: Node[],
  allNodes: Record<string | number, Node>,
  sharedIdBuckets?: Map<string, Set<string | number>>
): Node | null => {
  if (path.length <= 1) return null;

  // Use sharedIdBuckets for fast shared ID lookups
  const sharedIds = sharedIdBuckets || nodeStore.get(sharedIdBucketsAtom);
  let currentId = rootId;

  // Skip the first node (root)
  for (let i = 1; i < path.length; i++) {
    const pathNode = path[i];
    if (!pathNode.sharedId) return null;

    // Get all nodes with this sharedId - O(1)
    const nodesWithSharedId = sharedIds.get(pathNode.sharedId) || new Set();
    let matchingChild = null;

    // Find the one that's a child of currentId
    for (const id of nodesWithSharedId) {
      const node = allNodes[id];
      if (node && node.parentId === currentId) {
        matchingChild = node;
        break;
      }
    }

    if (!matchingChild) return null;

    currentId = matchingChild.id;

    // If this is the last node, return it
    if (i === path.length - 1) {
      return matchingChild;
    }
  }

  return null;
};

export const getEffectiveViewport = (
  nodeId: string | number,
  nodes: Record<string | number, Node>,
  viewportRoots?: Set<string | number>
) => {
  // Use viewportRoots for fast viewport checks
  const viewports = viewportRoots || nodeStore.get(viewportRootsAtom);

  // Traverse up the parent chain until we find a viewport
  let currentId = nodeId;
  while (currentId) {
    // O(1) check if this node is a viewport
    if (viewports.has(currentId)) {
      return currentId;
    }

    const node = nodes[currentId];
    if (!node || !node.parentId) return null;

    currentId = node.parentId;
  }

  return null;
};

export const getSubtree = (
  nodes: Record<string | number, Node>,
  rootId: string | number,
  includeRoot = false,
  siblingsIndex?: Map<string | number, SiblingInfo>
): Node[] => {
  const result: Node[] = [];
  const index = siblingsIndex || nodeStore.get(siblingsIndexAtom);

  if (includeRoot) {
    const rootNode = nodes[rootId];
    if (rootNode && rootNode.type !== "placeholder") {
      result.push(rootNode);
    }
  }

  const queue = [rootId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;

    // Get children using siblingsIndex - O(1) lookup per child
    const childrenInfos = Array.from(index.values()).filter(
      (info) => info.parentId === currentId
    );

    // Sort by index
    childrenInfos.sort((a, b) => a.indexInParent - b.indexInParent);

    for (const childInfo of childrenInfos) {
      const child = nodes[childInfo.nodeId];
      if (child && child.type !== "placeholder") {
        result.push(child);
        queue.push(child.id);
      }
    }
  }

  return result;
};

export const getAllDescendants = (
  nodeId: string | number,
  nodes: Record<string | number, Node>,
  siblingsIndex?: Map<string | number, SiblingInfo>
): Node[] => {
  const result: Node[] = [];
  const index = siblingsIndex || nodeStore.get(siblingsIndexAtom);
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    // Get children using siblingsIndex - O(1) lookup per child
    const childrenInfos = Array.from(index.values()).filter(
      (info) => info.parentId === currentId
    );

    for (const childInfo of childrenInfos) {
      const child = nodes[childInfo.nodeId];
      if (child) {
        result.push(child);
        queue.push(child.id);
      }
    }
  }

  return result;
};

// Utilities using the node store directly

export const getNodeViewportId = (
  nodeIdOrNode: string | number | Node,
  nodesMapping?: Record<string | number, Node>,
  viewportRoots?: Set<string | number>
) => {
  // If the input is already a node object
  let node: Node | null = null;

  if (typeof nodeIdOrNode === "object") {
    node = nodeIdOrNode;
  } else if (nodesMapping) {
    node = nodesMapping[nodeIdOrNode];
  } else {
    const nodeMap = nodeStore.get(nodeMapAtom);
    node = nodeMap[nodeIdOrNode];
  }

  if (!node) return null;

  // If node has a dynamicViewportId, use it
  if (node.dynamicViewportId) {
    return node.dynamicViewportId;
  }

  // Use viewportRoots for fast viewport checks
  const viewports = viewportRoots || nodeStore.get(viewportRootsAtom);

  // Otherwise traverse up to find a viewport
  let currentId = node.parentId;
  const nodes = nodesMapping || nodeStore.get(nodeMapAtom);

  while (currentId) {
    // O(1) lookup if this is a viewport
    if (viewports.has(currentId)) {
      return currentId;
    }

    const parent = nodes[currentId];
    if (!parent) break;

    if (parent.dynamicViewportId) {
      return parent.dynamicViewportId;
    }

    if (!parent.parentId) break;
    currentId = parent.parentId;
  }

  return null;
};

export const findBaseNodeRoot = (
  nodeId: string | number,
  nodes: Record<string | number, Node>,
  dynamicFamilyIndex?: Map<string | number, Set<string | number>>
) => {
  let current = nodes[nodeId];
  if (!current || !current.parentId) return null;

  // Check if this node has a dynamic family ID and use the index for fast lookup
  if (current.dynamicFamilyId) {
    const dynIndex =
      dynamicFamilyIndex || nodeStore.get(dynamicFamilyIndexAtom);
    const familyNodes = dynIndex.get(current.dynamicFamilyId);

    if (familyNodes) {
      // Find the root dynamic node in this family
      for (const familyNodeId of familyNodes) {
        const familyNode = nodes[familyNodeId];
        if (familyNode && familyNode.isDynamic) {
          // Found a dynamic node in this family - potential root
          return familyNode;
        }
      }
    }
  }

  // Fall back to parent traversal
  let path = [];

  while (current && current.parentId) {
    path.push(current);

    const parent = nodes[current.parentId];
    if (!parent) break;

    if (parent.isDynamic) {
      return parent;
    }

    current = parent;
  }

  return null;
};

export const followPathInVariant = (
  variantRootId: string | number,
  path: Node[],
  nodes: Record<string | number, Node>,
  sharedIdBuckets?: Map<string, Set<string | number>>,
  siblingsIndex?: Map<string | number, SiblingInfo>
) => {
  if (path.length === 0) {
    // If no path, the variant root is the target parent
    return nodes[variantRootId];
  }

  const sharedIds = sharedIdBuckets || nodeStore.get(sharedIdBucketsAtom);
  const index = siblingsIndex || nodeStore.get(siblingsIndexAtom);
  let current = nodes[variantRootId];

  if (!current) return null;

  // For each node in the path, find the corresponding child in the variant
  for (let i = 0; i < path.length; i++) {
    const pathNode = path[i];
    if (!pathNode.sharedId && !pathNode.variantResponsiveId) continue;

    let matchingChild = null;

    // Try to find by sharedId first
    if (pathNode.sharedId) {
      // Get all nodes with this sharedId - O(1)
      const nodesWithSharedId = sharedIds.get(pathNode.sharedId) || new Set();

      // Find children of current with matching sharedId
      for (const id of nodesWithSharedId) {
        const node = nodes[id];
        if (node && node.parentId === current.id) {
          matchingChild = node;
          break;
        }
      }
    }

    // If no direct match, try using variantResponsiveId
    if (!matchingChild && pathNode.variantResponsiveId) {
      // Get children of current
      const childrenInfos = Array.from(index.values()).filter(
        (info) => info.parentId === current.id
      );

      for (const childInfo of childrenInfos) {
        const child = nodes[childInfo.nodeId];
        if (
          child &&
          child.variantResponsiveId === pathNode.variantResponsiveId
        ) {
          matchingChild = child;
          break;
        }
      }
    }

    // If still no match, try a broader search
    if (!matchingChild && pathNode.sharedId) {
      // Get all nodes with this sharedId - O(1)
      const nodesWithSharedId = sharedIds.get(pathNode.sharedId) || new Set();

      for (const id of nodesWithSharedId) {
        const node = nodes[id];
        if (node && isDescendantOf(node.id, variantRootId, nodes)) {
          matchingChild = node;
          break;
        }
      }
    }

    if (!matchingChild) {
      // No match found
      return null;
    }

    current = matchingChild;
  }

  return current;
};

export const isDescendantOf = (
  childId: string | number,
  ancestorId: string | number,
  nodes: Record<string | number, Node>
): boolean => {
  let current = nodes[childId];
  if (!current || !current.parentId) return false;

  if (current.parentId === ancestorId) return true;

  return isDescendantOf(current.parentId, ancestorId, nodes);
};

export const findVariantAncestor = (
  nodeId: string | number,
  nodes: Record<string | number, Node>
) => {
  let current = nodes[nodeId];
  if (!current) return null;

  // If node itself is a variant, return it
  if (current.isVariant) return current;

  // Otherwise traverse up to find a variant ancestor
  let currentId = current.parentId;

  while (currentId) {
    const parent = nodes[currentId];
    if (!parent) break;

    if (parent.isVariant) {
      return parent;
    }

    if (!parent.parentId) break;
    currentId = parent.parentId;
  }

  return null;
};

export const isInDynamicFamily = (
  nodeId: string | number,
  dynamicModeNodeId: string | number,
  nodes: Record<string | number, Node>,
  dynamicFamilyIndex?: Map<string | number, Set<string | number>>
) => {
  // Get the dynamic family ID from the dynamic mode node
  const dynamicModeNode = nodes[dynamicModeNodeId];
  if (!dynamicModeNode || !dynamicModeNode.dynamicFamilyId) return false;

  const familyId = dynamicModeNode.dynamicFamilyId;

  // Use dynamic family index for fast family membership check
  const dynIndex = dynamicFamilyIndex || nodeStore.get(dynamicFamilyIndexAtom);
  const familyNodes = dynIndex.get(familyId);

  if (familyNodes && familyNodes.has(nodeId)) {
    return true;
  }

  // Check if the node or any of its ancestors is in this family
  let currentNodeId = nodeId;
  while (currentNodeId) {
    const currentNode = nodes[currentNodeId];
    if (!currentNode) break;

    // Direct check with the dynamic family index
    if (familyNodes && familyNodes.has(currentNodeId)) {
      return true;
    }

    // Check family ID directly
    if (currentNode.dynamicFamilyId === familyId) return true;

    // Check parent
    if (!currentNode.parentId) break;
    currentNodeId = currentNode.parentId;
  }

  return false;
};
