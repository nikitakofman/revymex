// dragAtoms.ts - Add this to your existing atoms file
import { atom, createStore } from "jotai/vanilla";
import { atomFamily, selectAtom } from "jotai/utils";

// Create a separate store just for hover state
export const hoverStore = createStore();

// Base hover atom - internal implementation detail
export const _internalHoverNodeIdAtom = atom<string | null>(null);

// Write-only atom for setting hover state that ONLY updates the hover store
// This is the key to preventing cascading re-renders
export const setHoverNodeIdAtom = atom(
  null, // read function - not needed for write-only atom
  (_get, set, nodeId: string | null) => {
    // We can't directly specify the store in the set function, so we'll use the
    // hoverStore.set method directly in the updater functions where this is called
    set(_internalHoverNodeIdAtom, nodeId);
  }
);

// Per-node atoms for checking if a node is hovered - derived from the internal hover atom
export const isNodeHoveredAtom = atomFamily((nodeId: string | number) =>
  selectAtom(_internalHoverNodeIdAtom, (hoverId) => hoverId === nodeId)
);

// Read-only atom for components that need the actual ID, not just boolean
// This helps minimize re-renders to only components that explicitly need the ID
export const hoverNodeIdAtom = atom((get) => get(_internalHoverNodeIdAtom));

// Utility function to get/set hover state directly with the hover store
export const createHoverOperations = () => {
  return {
    setHoverNodeId: (nodeId: string | null) => {
      // Use the store's set method directly
      hoverStore.set(_internalHoverNodeIdAtom, nodeId);
    },
    getHoverNodeId: () => {
      return hoverStore.get(_internalHoverNodeIdAtom);
    },
  };
};
