// hover-store.ts
import { atom, createStore } from "jotai/vanilla";
import { atomFamily, selectAtom } from "jotai/utils";
import { useAtomValue } from "jotai";

// Create a separate store just for hover state
export const hoverStore = createStore();

// Base hover atom - internal implementation detail
export const _internalHoverNodeIdAtom = atom<string | null>(null);

// Per-node atoms for checking if a node is hovered - derived from the internal hover atom
export const isNodeHoveredAtom = atomFamily((nodeId: string | number) =>
  selectAtom(_internalHoverNodeIdAtom, (hoverId) => hoverId === nodeId)
);

// Read-only atom for components that need the actual ID, not just boolean
export const hoverNodeIdAtom = atom((get) => get(_internalHoverNodeIdAtom));

// Create a singleton instance of the hover operations
const hoverOperations = {
  setHoverNodeId: (nodeId: string | null) => {
    console.log(`setHoverNodeId called with: ${nodeId}`);
    hoverStore.set(_internalHoverNodeIdAtom, nodeId);
    console.log(
      `Hover store updated. New value: ${hoverStore.get(
        _internalHoverNodeIdAtom
      )}`
    );
  },
  getHoverNodeId: () => {
    return hoverStore.get(_internalHoverNodeIdAtom);
  },
};

// Export the singleton instance directly
export const hoverOps = hoverOperations;

// Custom hook for components to check if a node is hovered
export const useNodeHovered = (nodeId: string | number) => {
  // This hook directly uses the isNodeHoveredAtom with the hoverStore
  return useAtomValue(isNodeHoveredAtom(nodeId), { store: hoverStore });
};

// Custom hook to get the current hovered node ID (if needed)
export const useHoveredNodeId = () => {
  return useAtomValue(hoverNodeIdAtom, { store: hoverStore });
};

// Initialize the store with null value
hoverStore.set(_internalHoverNodeIdAtom, null);
