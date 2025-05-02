// src/builder/context/atoms/node-hierarchy-store.ts
import { atom, createStore } from "jotai/vanilla";
import { atomFamily, selectAtom } from "jotai/utils";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { NodeId } from ".";

// Create a separate store for hierarchy
export const hierarchyStore = createStore();

// Map from parent ID to array of child IDs in order
export const childrenMapAtom = atom<Map<NodeId | null, NodeId[]>>(new Map());

// Map from child ID to parent ID for quick lookups
export const parentMapAtom = atom<Map<NodeId, NodeId | null>>(new Map());

// Root nodes (nodes with no parent)
export const rootNodesAtom = selectAtom(childrenMapAtom, (map) => {
  return map.get(null) || [];
});

// Get children of a specific node (for more granular reactivity)
export const nodeChildrenAtom = atomFamily((parentId: NodeId | null) =>
  selectAtom(
    childrenMapAtom,
    (map) => map.get(parentId) || [],
    // Add comparator to maintain reference equality when array contents don't change
    (prev, next) =>
      prev === next ||
      (prev.length === next.length && prev.every((id, i) => id === next[i]))
  )
);

// Hooks for components to use
export const useRootNodes = () => {
  return useAtomValue(rootNodesAtom, { store: hierarchyStore });
};

export const useNodeChildren = (parentId: NodeId | null) => {
  return useAtomValue(nodeChildrenAtom(parentId), { store: hierarchyStore });
};

export const useNodeParent = (nodeId: NodeId) => {
  return useAtomValue(
    selectAtom(parentMapAtom, (map) => map.get(nodeId) || null),
    { store: hierarchyStore }
  );
};

// Non-reactive getters
export const useGetNodeChildren = () => {
  return useCallback((parentId: NodeId | null): NodeId[] => {
    const childrenMap = hierarchyStore.get(childrenMapAtom);
    return childrenMap.get(parentId) || [];
  }, []);
};

export const useGetNodeParent = () => {
  return useCallback((nodeId: NodeId): NodeId | null => {
    const parentMap = hierarchyStore.get(parentMapAtom);
    return parentMap.get(nodeId) || null;
  }, []);
};

export const useGetDescendants = () => {
  return useCallback((nodeId: NodeId): Set<NodeId> => {
    const descendants = new Set<NodeId>();
    const collectDescendants = (id: NodeId) => {
      const childrenMap = hierarchyStore.get(childrenMapAtom);
      const children = childrenMap.get(id) || [];

      children.forEach((childId) => {
        descendants.add(childId);
        collectDescendants(childId);
      });
    };

    collectDescendants(nodeId);
    return descendants;
  }, []);
};

// Initialize the store
hierarchyStore.set(
  childrenMapAtom,
  new Map([
    [null, []], // Start with empty root nodes
  ])
);
hierarchyStore.set(parentMapAtom, new Map());
