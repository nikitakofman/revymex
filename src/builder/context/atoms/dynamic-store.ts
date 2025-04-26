// src/builder/context/atoms/dynamic-store.ts
import { atom, createStore } from "jotai/vanilla";
import { selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

// Create a separate store for dynamic mode state
export const dynamicStore = createStore();

// Type definitions
export interface DynamicState {
  // Dynamic mode states
  dynamicModeNodeId: string | number | null;
  activeViewportInDynamicMode: string | number | null;
}

// Initial state
const initialDynamicState: DynamicState = {
  dynamicModeNodeId: null,
  activeViewportInDynamicMode: null,
};

// Base atom for dynamic state
export const _internalDynamicStateAtom =
  atom<DynamicState>(initialDynamicState);

// Individual property atoms for fine-grained subscriptions
export const dynamicModeNodeIdAtom = selectAtom(
  _internalDynamicStateAtom,
  (state) => state.dynamicModeNodeId
);

export const activeViewportInDynamicModeAtom = selectAtom(
  _internalDynamicStateAtom,
  (state) => state.activeViewportInDynamicMode
);

export const connectionTypeModalAtom = selectAtom(
  _internalDynamicStateAtom,
  (state) => state.connectionTypeModal
);

// Create a singleton instance of dynamic mode operations
const dynamicOperations = {
  // Dynamic mode operations
  setDynamicModeNodeId: (
    nodeId: string | number | null,
    resetNodePositions?: () => void,
    defaultViewportId?: string | number
  ) => {
    dynamicStore.set(_internalDynamicStateAtom, (prev) => {
      // If exiting dynamic mode and resetting positions
      if (!nodeId && resetNodePositions) {
        resetNodePositions();
        return {
          ...prev,
          dynamicModeNodeId: null,
          activeViewportInDynamicMode: null,
        };
      }
      // If entering dynamic mode with a default viewport
      else if (nodeId && defaultViewportId) {
        return {
          ...prev,
          dynamicModeNodeId: nodeId,
          activeViewportInDynamicMode: defaultViewportId,
        };
      }
      // Just update the nodeId
      else {
        return {
          ...prev,
          dynamicModeNodeId: nodeId,
        };
      }
    });
  },

  /**
   * Sets the active viewport in dynamic mode
   * @param viewportId The ID of the viewport to switch to
   */
  switchDynamicViewport: (viewportId: string | number) => {
    dynamicStore.set(_internalDynamicStateAtom, (prev) => ({
      ...prev,
      activeViewportInDynamicMode: viewportId,
    }));
  },

  // Utility to get full state
  getState: () => {
    return dynamicStore.get(_internalDynamicStateAtom);
  },
};

// Export the singleton instance directly
export const dynamicOps = dynamicOperations;

// Hooks for components to use the dynamic state
export const useDynamicModeNodeId = () => {
  return useAtomValue(dynamicModeNodeIdAtom, { store: dynamicStore });
};

export const useActiveViewportInDynamicMode = () => {
  return useAtomValue(activeViewportInDynamicModeAtom, { store: dynamicStore });
};

// Full state hook
export const useDynamicStateAll = () => {
  return useAtomValue(_internalDynamicStateAtom, { store: dynamicStore });
};

// Imperative getters
export const useGetDynamicState = () => {
  return useCallback(() => {
    return dynamicStore.get(_internalDynamicStateAtom);
  }, []);
};

export const useGetDynamicModeNodeId = () => {
  return useCallback(() => {
    return dynamicStore.get(_internalDynamicStateAtom).dynamicModeNodeId;
  }, []);
};

export const useGetActiveViewportInDynamicMode = () => {
  return useCallback(() => {
    return dynamicStore.get(_internalDynamicStateAtom)
      .activeViewportInDynamicMode;
  }, []);
};

// Optional set functions for components that need to directly update state
export const useSetDynamicState = () => {
  return useSetAtom(_internalDynamicStateAtom, { store: dynamicStore });
};

// Debug function
export const debugDynamicStore = () => {
  console.log(
    "Dynamic Store State:",
    dynamicStore.get(_internalDynamicStateAtom)
  );
};
