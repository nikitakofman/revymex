// select-store.ts
import { atom, createStore } from "jotai/vanilla";
import { atomFamily, selectAtom } from "jotai/utils";
import { useAtomValue } from "jotai";
import { useCallback } from "react";

// Create a separate store just for selection state - export as a const to guarantee a single instance
export const selectStore = createStore();

// Base atoms for selection state
export const _internalSelectedIdsAtom = atom<string[]>([]);
export const _internalTempSelectedIdsAtom = atom<string[]>([]);
export const _internalSelectNodeIdAtom = atom<string | null>(null);

// Per-node atoms for checking if a node is selected
export const isNodeSelectedAtom = atomFamily((nodeId: string | number) =>
  selectAtom(_internalSelectedIdsAtom, (selectedIds) =>
    selectedIds.includes(String(nodeId))
  )
);

// Per-node atoms for checking if a node is temp selected
export const isNodeTempSelectedAtom = atomFamily((nodeId: string | number) =>
  selectAtom(_internalTempSelectedIdsAtom, (tempSelectedIds) =>
    tempSelectedIds.includes(String(nodeId))
  )
);

// Read-only atoms for components that need the actual selection info
export const selectedIdsAtom = atom((get) => get(_internalSelectedIdsAtom));
export const tempSelectedIdsAtom = atom((get) =>
  get(_internalTempSelectedIdsAtom)
);
export const selectNodeIdAtom = atom((get) => get(_internalSelectNodeIdAtom));

// Create a singleton instance of selection operations
const selectOperations = {
  // Get current selection states
  getSelectedIds: () => {
    const ids = selectStore.get(_internalSelectedIdsAtom);
    return ids;
  },
  getTempSelectedIds: () => {
    return selectStore.get(_internalTempSelectedIdsAtom);
  },
  getSelectNodeId: () => {
    return selectStore.get(_internalSelectNodeIdAtom);
  },

  // Single node selection
  selectNode: (nodeId: string | number) => {
    selectStore.set(_internalSelectedIdsAtom, [String(nodeId)]);
    selectStore.set(_internalSelectNodeIdAtom, String(nodeId));
  },

  // Add to multi-selection
  addToSelection: (nodeId: string | number) => {
    const currentSelectedIds = selectStore.get(_internalSelectedIdsAtom);
    if (!currentSelectedIds.includes(String(nodeId))) {
      selectStore.set(_internalSelectedIdsAtom, [
        ...currentSelectedIds,
        String(nodeId),
      ]);
    }
  },

  // Set entire selection
  setSelectedIds: (ids: (string | number)[]) => {
    const stringIds = ids.map((id) => String(id));
    selectStore.set(_internalSelectedIdsAtom, stringIds);
  },

  // Clear selection
  clearSelection: () => {
    selectStore.set(_internalSelectedIdsAtom, []);
  },

  // Temp selection operations
  setTempSelectedIds: (ids: (string | number)[]) => {
    selectStore.set(
      _internalTempSelectedIdsAtom,
      ids.map((id) => String(id))
    );
  },

  // Clear temp selection
  clearTempSelection: () => {
    selectStore.set(_internalTempSelectedIdsAtom, []);
  },

  // Set current select node ID (for context menu etc.)
  setSelectNodeId: (nodeId: string | null) => {
    // IMPORTANT: This should also update the selection, not just the node ID
    selectStore.set(_internalSelectNodeIdAtom, nodeId);

    // Also update the selection if nodeId is not null
    if (nodeId !== null) {
      selectStore.set(_internalSelectedIdsAtom, [String(nodeId)]);
    } else {
      // If nodeId is null, clear the selection
      selectStore.set(_internalSelectedIdsAtom, []);
    }
  },
};

// Export the singleton instance directly
export const selectOps = selectOperations;

// Custom hooks for components to use the selection state

// Check if a specific node is selected
export const useNodeSelected = (nodeId: string | number) => {
  const isSelected = useAtomValue(isNodeSelectedAtom(nodeId), {
    store: selectStore,
  });
  return isSelected;
};

// Check if a specific node is temporarily selected
export const useNodeTempSelected = (nodeId: string | number) => {
  return useAtomValue(isNodeTempSelectedAtom(nodeId), { store: selectStore });
};

// Get the full array of selected IDs
export const useSelectedIds = () => {
  const ids = useAtomValue(selectedIdsAtom, { store: selectStore });
  return ids;
};

// Get the full array of temporarily selected IDs
export const useTempSelectedIds = () => {
  return useAtomValue(tempSelectedIdsAtom, { store: selectStore });
};

// Get the current focus node ID (for context menu etc.)
export const useSelectNodeId = () => {
  return useAtomValue(selectNodeIdAtom, { store: selectStore });
};

// Imperative getter for selected IDs
export function useGetSelectedIds() {
  return useCallback(() => selectStore.get(_internalSelectedIdsAtom), []);
}

// Imperative getter for temporary selected IDs
export function useGetTempSelectedIds() {
  return useCallback(() => selectStore.get(_internalTempSelectedIdsAtom), []);
}

// Add a DEBUG function to help diagnose store issues
export const debugSelectStore = () => {};

// Initialize the store with empty arrays
selectStore.set(_internalSelectedIdsAtom, []);
selectStore.set(_internalTempSelectedIdsAtom, []);
selectStore.set(_internalSelectNodeIdAtom, null);

// Setup a listener for selection changes
selectStore.sub(_internalSelectedIdsAtom, () => {});

export const selectionCountAtom = selectAtom(
  _internalSelectedIdsAtom,
  (ids) => ids.length
);

// Primary selected ID
export const primarySelectedIdAtom = selectAtom(
  _internalSelectedIdsAtom,
  (ids) => ids[0] ?? null
);
