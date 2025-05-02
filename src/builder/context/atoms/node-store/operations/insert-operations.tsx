import { NodeId, nodeStore, nodeParentAtom } from "../";
import {
  hierarchyStore,
  childrenMapAtom,
  parentMapAtom,
} from "../hierarchy-store";
import { batchNodeUpdates } from "../";

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

    // Removed: nodeStore.set(changedNodesAtom, ...)
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

    // Removed: nodeStore.set(changedNodesAtom, ...)
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

    // Removed: nodeStore.set(changedNodesAtom, ...)
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

    // Removed: nodeStore.set(changedNodesAtom, ...)
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

    // Removed: nodeStore.set(changedNodesAtom, ...)
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

      // Removed: nodeStore.set(changedNodesAtom, ...)
    }
  });
}
