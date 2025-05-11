// insert-operations.ts
import {
  NodeId,
  nodeStore,
  nodeBasicsAtom,
  nodeStyleAtom,
  nodeFlagsAtom,
  nodeParentAtom,
  nodeSharedInfoAtom,
  nodeSyncFlagsAtom,
  nodeIdsAtom,
  getCurrentNodes,
  useGetNode,
} from "../";
import {
  hierarchyStore,
  childrenMapAtom,
  parentMapAtom,
} from "../hierarchy-store";
import { batchNodeUpdates } from "../";
import { nanoid } from "nanoid";
import { duplicateNodeToViewport, syncViewports } from "./sync-operations";
import { createNodeInStore } from "./global-operations";
import { updateNodeStyle } from "./style-operations";
import { updateNodeFlags } from "./update-operations";

/**
 * Adds a node to a parent
 * @param nodeId ID of the node to add
 * @param parentId ID of the parent node, or null for root nodes
 */
export function addNode(nodeId: NodeId, parentId: NodeId | null) {
  batchNodeUpdates(() => {
    nodeStore.set(nodeParentAtom(nodeId), parentId);

    hierarchyStore.set(childrenMapAtom, (prevMap) => {
      const newMap = new Map(prevMap);

      if (!newMap.has(parentId)) {
        newMap.set(parentId, []);
      }

      const parentChildren = [...(newMap.get(parentId) || [])];
      parentChildren.push(nodeId);
      newMap.set(parentId, parentChildren);

      if (!newMap.has(nodeId)) {
        newMap.set(nodeId, []);
      }

      return newMap;
    });

    hierarchyStore.set(parentMapAtom, (prevMap) => {
      const newMap = new Map(prevMap);
      newMap.set(nodeId, parentId);
      return newMap;
    });
  });
}

/**
 * Insert a node at a specific index among its siblings
 * @param nodeId ID of the node to insert
 * @param parentId ID of the parent node, or null for root nodes
 * @param index Position to insert at (0-based)
 */
export function insertAtIndex(
  nodeId: NodeId,
  parentId: NodeId | null,
  index: number
) {
  batchNodeUpdates(() => {
    nodeStore.set(nodeParentAtom(nodeId), parentId);

    hierarchyStore.set(childrenMapAtom, (prevMap) => {
      const newMap = new Map(prevMap);

      const currentParentId = hierarchyStore.get(parentMapAtom).get(nodeId);
      if (currentParentId !== undefined && currentParentId !== parentId) {
        const oldParentChildren = [...(newMap.get(currentParentId) || [])];
        const nodeIndex = oldParentChildren.indexOf(nodeId);
        if (nodeIndex !== -1) {
          oldParentChildren.splice(nodeIndex, 1);
          newMap.set(currentParentId, oldParentChildren);
        }
      }

      if (!newMap.has(parentId)) {
        newMap.set(parentId, []);
      }

      if (currentParentId === parentId) {
        const parentChildren = [...(newMap.get(parentId) || [])];

        const currentIndex = parentChildren.indexOf(nodeId);
        if (currentIndex !== -1) {
          parentChildren.splice(currentIndex, 1);
        }

        parentChildren.splice(index, 0, nodeId);
        newMap.set(parentId, parentChildren);
      } else {
        const parentChildren = [...(newMap.get(parentId) || [])];

        const insertIndex = Math.min(index, parentChildren.length);
        parentChildren.splice(insertIndex, 0, nodeId);
        newMap.set(parentId, parentChildren);

        if (!newMap.has(nodeId)) {
          newMap.set(nodeId, []);
        }
      }

      return newMap;
    });

    hierarchyStore.set(parentMapAtom, (prevMap) => {
      const newMap = new Map(prevMap);
      newMap.set(nodeId, parentId);
      return newMap;
    });
  });
}

/**
 * Remove a node and all its descendants from the hierarchy
 * @param nodeId ID of the node to remove
 */
export function removeNode(nodeId: NodeId) {
  batchNodeUpdates(() => {
    const descendantsToRemove = new Set<NodeId>();
    const collectDescendants = (id: NodeId) => {
      descendantsToRemove.add(id);
      const childrenMap = hierarchyStore.get(childrenMapAtom);
      const children = childrenMap.get(id) || [];
      children.forEach(collectDescendants);
    };

    collectDescendants(nodeId);

    const parentMap = hierarchyStore.get(parentMapAtom);
    const currentParentId = parentMap.get(nodeId);

    hierarchyStore.set(childrenMapAtom, (prevMap) => {
      const newMap = new Map(prevMap);

      if (currentParentId !== undefined) {
        const parentChildren = [...(newMap.get(currentParentId) || [])];
        const nodeIndex = parentChildren.indexOf(nodeId);
        if (nodeIndex !== -1) {
          parentChildren.splice(nodeIndex, 1);
          newMap.set(currentParentId, parentChildren);
        }
      }

      descendantsToRemove.forEach((id) => {
        newMap.delete(id);
      });

      return newMap;
    });

    hierarchyStore.set(parentMapAtom, (prevMap) => {
      const newMap = new Map(prevMap);

      descendantsToRemove.forEach((id) => {
        newMap.delete(id);
      });

      return newMap;
    });

    // Remove from node IDs list
    nodeStore.set(nodeIdsAtom, (prev) => {
      return prev.filter((id) => !descendantsToRemove.has(id));
    });

    // Remove actual node data from store (basics, style, flags, etc.)
    // This is left as a future enhancement but ideally should remove all atoms for each node
  });
}

/**
 * Move a node to a new parent
 * @param nodeId ID of the node to move
 * @param newParentId ID of the new parent, or null for root nodes
 * @param index Optional index for placement (appends at end if not specified)
 */
export function moveNode(
  nodeId: NodeId,
  newParentId: NodeId | null,
  index?: number
) {
  batchNodeUpdates(() => {
    const parentMap = hierarchyStore.get(parentMapAtom);
    const currentParentId = parentMap.get(nodeId);

    if (index === undefined) {
      const childrenMap = hierarchyStore.get(childrenMapAtom);
      const newParentChildren = childrenMap.get(newParentId) || [];
      index = newParentChildren.length;
    }

    if (currentParentId === newParentId) {
      return reorderChildren(newParentId, nodeId, index);
    }

    nodeStore.set(nodeParentAtom(nodeId), newParentId);

    hierarchyStore.set(childrenMapAtom, (prevMap) => {
      const newMap = new Map(prevMap);

      if (currentParentId !== undefined) {
        const oldParentChildren = [...(newMap.get(currentParentId) || [])];
        const nodeIndex = oldParentChildren.indexOf(nodeId);
        if (nodeIndex !== -1) {
          oldParentChildren.splice(nodeIndex, 1);
          newMap.set(currentParentId, oldParentChildren);
        }
      }

      if (!newMap.has(newParentId)) {
        newMap.set(newParentId, []);
      }

      const newParentChildren = [...(newMap.get(newParentId) || [])];

      const insertIndex = Math.min(index, newParentChildren.length);
      newParentChildren.splice(insertIndex, 0, nodeId);
      newMap.set(newParentId, newParentChildren);

      return newMap;
    });

    hierarchyStore.set(parentMapAtom, (prevMap) => {
      const newMap = new Map(prevMap);
      newMap.set(nodeId, newParentId);
      return newMap;
    });
  });
}

/**
 * Reorder a specific child within its parent's children
 * @param parentId ID of the parent node
 * @param nodeId ID of the child to reorder
 * @param newIndex New position for the child (0-based)
 */
export function reorderChildren(
  parentId: NodeId | null,
  nodeId: NodeId,
  newIndex: number
) {
  batchNodeUpdates(() => {
    hierarchyStore.set(childrenMapAtom, (prevMap) => {
      const newMap = new Map(prevMap);

      if (!newMap.has(parentId)) {
        newMap.set(parentId, []);
        return newMap;
      }

      const children = [...(newMap.get(parentId) || [])];
      const currentIndex = children.indexOf(nodeId);

      if (currentIndex !== -1 && currentIndex !== newIndex) {
        children.splice(currentIndex, 1);

        const boundedIndex = Math.min(newIndex, children.length);
        children.splice(boundedIndex, 0, nodeId);

        newMap.set(parentId, children);
      }

      return newMap;
    });
  });
}

/**
 * Reorder multiple children of a parent at once
 * @param parentId ID of the parent node
 * @param newOrder New order of children IDs
 */
export function reorderAllChildren(
  parentId: NodeId | null,
  newOrder: NodeId[]
) {
  batchNodeUpdates(() => {
    const currentChildren =
      hierarchyStore.get(childrenMapAtom).get(parentId) || [];
    const currentSet = new Set(currentChildren);
    const newSet = new Set(newOrder);

    if (
      currentSet.size === newSet.size &&
      [...currentSet].every((id) => newSet.has(id))
    ) {
      hierarchyStore.set(childrenMapAtom, (prevMap) => {
        const newMap = new Map(prevMap);
        newMap.set(parentId, [...newOrder]);
        return newMap;
      });
    }
  });
}

export function duplicateNode(rootId: NodeId): NodeId {
  const allNodes = getCurrentNodes();
  const rootNode = allNodes.find((n) => n.id === rootId);
  if (!rootNode) return rootId;

  // 1. Create a shared ID mapping
  const sharedIdMap = new Map<string, string>();
  if (rootNode.sharedId) {
    sharedIdMap.set(rootNode.sharedId, `shared-${nanoid(8)}`);
  }

  // Map to keep track of original ID to new ID
  const idMap = new Map<NodeId, NodeId>();

  // 2. Duplicate the node in the current viewport
  const parentId = getParent(rootId);
  const siblingIndex = getIndex(rootId) + 1; // Insert after the original

  // Create the new node
  const newNodeId = nanoid();
  const newNode = {
    ...JSON.parse(JSON.stringify(rootNode)),
    id: newNodeId,
    parentId,
    sharedId: rootNode.sharedId
      ? sharedIdMap.get(rootNode.sharedId)
      : undefined,
  };

  // If it's a positioned node, offset it
  if (newNode.style && newNode.style.position === "absolute") {
    const left = parseFloat(newNode.style.left) || 0;
    const top = parseFloat(newNode.style.top) || 0;
    newNode.style.left = `${left + 20}px`;
    newNode.style.top = `${top + 20}px`;
  }

  // Create the node in the store
  createNodeInStore(newNode);
  insertAtIndex(newNodeId, parentId, siblingIndex);

  // Keep track of the mapping
  idMap.set(rootId, newNodeId);

  // 3. Duplicate all children recursively
  function duplicateChildren(originalId: NodeId, newParentId: NodeId) {
    const children = hierarchyStore.get(childrenMapAtom).get(originalId) || [];

    children.forEach((childId, index) => {
      const childNode = allNodes.find((n) => n.id === childId);
      if (!childNode) return;

      // Create shared ID mapping for this child if needed
      if (childNode.sharedId && !sharedIdMap.has(childNode.sharedId)) {
        sharedIdMap.set(childNode.sharedId, `shared-${nanoid(8)}`);
      }

      // Create new child node
      const newChildId = nanoid();
      const newChild = {
        ...JSON.parse(JSON.stringify(childNode)),
        id: newChildId,
        parentId: newParentId,
        sharedId: childNode.sharedId
          ? sharedIdMap.get(childNode.sharedId)
          : undefined,
      };

      // Create in store
      createNodeInStore(newChild);
      addNode(newChildId, newParentId);

      // Keep track of mapping
      idMap.set(childId, newChildId);

      // Recursively duplicate its children
      duplicateChildren(childId, newChildId);
    });
  }

  // Duplicate children in current viewport
  duplicateChildren(rootId, newNodeId);

  // 4. Find which viewport we're in
  const sourceViewport = findViewport(parentId);
  if (!sourceViewport || !isInViewport(parentId)) {
    // If not in a viewport, we're done
    return newNodeId;
  }

  // 5. Duplicate to all other viewports
  const viewports = getAllViewports();
  for (const viewport of viewports) {
    if (viewport === sourceViewport) continue;

    // Find corresponding parent in this viewport
    let targetParent: NodeId = viewport;
    if (parentId !== sourceViewport) {
      const parentNode = allNodes.find((n) => n.id === parentId);
      if (parentNode?.sharedId) {
        const matchingParent = allNodes.find(
          (n) =>
            n.sharedId === parentNode.sharedId && isDescendantOf(n.id, viewport)
        );
        if (matchingParent) {
          targetParent = matchingParent.id;
        }
      }
    }

    // Create root node in this viewport
    const viewportNodeId = nanoid();
    const viewportNode = {
      ...JSON.parse(JSON.stringify(newNode)),
      id: viewportNodeId,
      parentId: targetParent,
      inViewport: true,
      style: {
        ...newNode.style,
        position: "relative",
        left: "",
        top: "",
        zIndex: "",
      },
    };

    createNodeInStore(viewportNode);
    insertAtIndex(viewportNodeId, targetParent, siblingIndex);

    // Function to duplicate children in other viewports
    function duplicateChildrenToViewport(
      originalId: NodeId,
      viewportParentId: NodeId
    ) {
      const originalChildren =
        hierarchyStore.get(childrenMapAtom).get(originalId) || [];

      originalChildren.forEach((childId) => {
        const newSourceChildId = idMap.get(childId);
        if (!newSourceChildId) return;

        const sourceChild = allNodes.find((n) => n.id === childId);
        const newSourceChild = getCurrentNodes().find(
          (n) => n.id === newSourceChildId
        );
        if (!sourceChild || !newSourceChild) return;

        // Create child in this viewport
        const viewportChildId = nanoid();
        const viewportChild = {
          ...JSON.parse(JSON.stringify(newSourceChild)),
          id: viewportChildId,
          parentId: viewportParentId,
          inViewport: true,
          style: {
            ...newSourceChild.style,
            position: "relative",
            left: "",
            top: "",
            zIndex: "",
          },
        };

        createNodeInStore(viewportChild);
        addNode(viewportChildId, viewportParentId);

        // Recursively duplicate its children
        duplicateChildrenToViewport(childId, viewportChildId);
      });
    }

    // Duplicate children to this viewport
    duplicateChildrenToViewport(rootId, viewportNodeId);
  }

  return newNodeId;
}
/**
 * Walk the subtree rooted in `rootId` and return
 *   – `order`      : array with every node id (parents before children)
 *   – `sharedMap`  : Map<oldSharedId , freshSharedId>
 *   – `byParent`   : Map<parentId     , childId[]      >
 */
function collectSubtree(rootId: NodeId) {
  const order: NodeId[] = [];
  const sharedMap = new Map<string, string>();
  const byParent = new Map<NodeId | null, NodeId[]>();

  (function dfs(id: NodeId) {
    order.push(id);

    const n = getCurrentNodes().find((n) => n.id === id)!;
    if (n.sharedId && !sharedMap.has(n.sharedId)) {
      sharedMap.set(n.sharedId, `shared-${nanoid(8)}`);
    }

    const kids = hierarchyStore.get(childrenMapAtom).get(id) || [];
    byParent.set(id, kids);
    kids.forEach(dfs);
  })(rootId);

  return { order, sharedMap, byParent };
}

/**
 * Clone a single node (not its children)
 */
function cloneNode(
  srcId: NodeId,
  dstParent: NodeId | null,
  index: number,
  sharedMap: Map<string, string>
): NodeId {
  const src = getCurrentNodes().find((n) => n.id === srcId)!;
  const id = nanoid();

  createNodeInStore({
    ...JSON.parse(JSON.stringify(src)),
    id,
    parentId: dstParent,
    sharedId: src.sharedId ? sharedMap.get(src.sharedId) : undefined,
  });

  insertAtIndex(id, dstParent, index);

  // viewport children must be relative
  if (isInViewport(dstParent)) {
    updateNodeStyle(id, {
      position: "relative",
      left: "",
      top: "",
      zIndex: "",
    });
    updateNodeFlags(id, { inViewport: true });
  }

  return id;
}

/**
 * Duplicate an entire subtree rooted at rootId
 * Creates copies in all viewports with consistent shared IDs
 * @param rootId ID of the root node to duplicate
 * @returns ID of the first cloned node (in current viewport)
 */
export function duplicateSubtree(rootId: NodeId) {
  const { order, sharedMap, byParent } = collectSubtree(rootId);
  const sharedToCloneId = new Map<NodeId, NodeId>();

  // 1) clone the whole thing in the *current* viewport -------------
  const firstCloneId = cloneNode(
    // parent first
    rootId,
    getParent(rootId),
    getIndex(rootId) + 1,
    sharedMap
  );
  sharedToCloneId.set(rootId, firstCloneId);

  order.slice(1).forEach((childId) => {
    // then children
    const p = getParent(childId);
    const np = byParent.has(p) // original parent
      ? sharedToCloneId.get(p)! // → new parent
      : firstCloneId;
    const idx = getIndex(childId);
    const id = cloneNode(childId, np, idx, sharedMap);
    sharedToCloneId.set(childId, id);
  });

  // 2) replicate that clone to every other viewport ----------------
  const viewports = getAllViewports(); // ['desktop-vp', 'tablet-vp' …]
  const srcVp = findViewport(getParent(rootId))!;

  for (const vp of viewports) {
    if (vp === srcVp) continue;

    // where to insert?  – same shared parent, same index
    const srcParent = getParent(rootId);
    const vpParent =
      findNodeBySharedId(
        getCurrentNodes().find((n) => n.id === srcParent)!.sharedId,
        vp
      ) ?? vp; // fallback: viewport root
    const idx = getIndex(rootId);

    // build the whole subtree once, parent first
    const mapOrigToClone = new Map<NodeId, NodeId>();
    const cloneRoot = cloneNode(firstCloneId, vpParent, idx, sharedMap);
    mapOrigToClone.set(firstCloneId, cloneRoot);

    order.slice(1).forEach((orig) => {
      const origParent = getParent(orig);
      const newParent = mapOrigToClone.get(origParent)!;
      const i = getIndex(orig);
      const newId = cloneNode(
        sharedToCloneId.get(orig)!,
        newParent,
        i,
        sharedMap
      );
      mapOrigToClone.set(sharedToCloneId.get(orig)!, newId);
    });
  }

  return firstCloneId; // so the caller can select it
}

// ----- Helper functions -----

/**
 * Get a node's parent ID
 */
function getParent(nodeId: NodeId): NodeId | null {
  return hierarchyStore.get(parentMapAtom).get(nodeId) || null;
}

/**
 * Get a node's index among its siblings
 */
function getIndex(nodeId: NodeId): number {
  const parentId = getParent(nodeId);
  const siblings = hierarchyStore.get(childrenMapAtom).get(parentId) || [];
  return siblings.indexOf(nodeId);
}

/**
 * Find the viewport containing a node
 */
function findViewport(nodeId: NodeId | null): NodeId | null {
  if (!nodeId) return null;

  let current: NodeId | null = nodeId;
  while (current) {
    if (typeof current === "string" && current.includes("viewport")) {
      return current;
    }
    current = getParent(current);
  }

  return null;
}

/**
 * Check if a node is inside a viewport
 */
function isInViewport(nodeId: NodeId | null): boolean {
  return !!findViewport(nodeId);
}

/**
 * Get all viewport node IDs
 */
function getAllViewports(): NodeId[] {
  const viewports: NodeId[] = [];
  hierarchyStore.get(childrenMapAtom).forEach((_, key) => {
    if (typeof key === "string" && key.includes("viewport")) {
      viewports.push(key);
    }
  });
  return viewports;
}

/**
 * Find a node by its shared ID within a specific viewport
 */
function findNodeBySharedId(
  sharedId: string | undefined,
  viewportId: NodeId
): NodeId | null {
  if (!sharedId) return null;

  const allNodes = getCurrentNodes();
  const nodesWithSharedId = allNodes.filter((n) => n.sharedId === sharedId);

  for (const node of nodesWithSharedId) {
    if (isDescendantOf(node.id, viewportId)) {
      return node.id;
    }
  }

  return null;
}

/**
 * Check if a node is a descendant of another node
 */
function isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean {
  const parentMap = hierarchyStore.get(parentMapAtom);
  let current: NodeId | null | undefined = nodeId;
  while (current) {
    if (current === ancestorId) return true;
    current = parentMap.get(current);
  }
  return false;
}
