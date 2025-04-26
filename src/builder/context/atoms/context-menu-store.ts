// src/builder/context/atoms/context-menu-store.ts
import { atom, createStore } from "jotai/vanilla";
import { selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

// Create a separate store for context menu state
export const contextMenuStore = createStore();

// Type definitions
export interface ContextMenuState {
  nodeContextMenu: {
    show: boolean;
    x: number;
    y: number;
    nodeId: string | null;
    isViewportHeader: boolean;
  } | null;
  viewportContextMenu: {
    show: boolean;
    viewportId: string | number | null;
    position: {
      x: number;
      y: number;
    };
  };
}

// Initial state
const initialContextMenuState: ContextMenuState = {
  nodeContextMenu: null,
  viewportContextMenu: {
    show: false,
    viewportId: null,
    position: {
      x: 0,
      y: 0,
    },
  },
};

// Base atom for context menu state
export const _internalContextMenuStateAtom = atom<ContextMenuState>(
  initialContextMenuState
);

// Individual property atoms for fine-grained subscriptions
export const nodeContextMenuAtom = selectAtom(
  _internalContextMenuStateAtom,
  (state) => state.nodeContextMenu
);

export const viewportContextMenuAtom = selectAtom(
  _internalContextMenuStateAtom,
  (state) => state.viewportContextMenu
);

// Create a singleton instance of context menu operations
const contextMenuOperations = {
  setContextMenu: (
    x: number,
    y: number,
    nodeId: string | null,
    isViewportHeader: boolean = false
  ) => {
    contextMenuStore.set(_internalContextMenuStateAtom, (prev) => ({
      ...prev,
      nodeContextMenu: { show: true, x, y, nodeId, isViewportHeader },
    }));
  },

  hideContextMenu: () => {
    contextMenuStore.set(_internalContextMenuStateAtom, (prev) => ({
      ...prev,
      nodeContextMenu: null,
    }));
  },

  showViewportContextMenu: (
    viewportId: string | number,
    position: { x: number; y: number }
  ) => {
    contextMenuStore.set(_internalContextMenuStateAtom, (prev) => ({
      ...prev,
      viewportContextMenu: {
        show: true,
        viewportId,
        position,
      },
    }));
  },

  hideViewportContextMenu: () => {
    contextMenuStore.set(_internalContextMenuStateAtom, (prev) => ({
      ...prev,
      viewportContextMenu: {
        ...prev.viewportContextMenu,
        show: false,
      },
    }));
  },

  resetContextMenuState: () => {
    contextMenuStore.set(
      _internalContextMenuStateAtom,
      initialContextMenuState
    );
  },

  // Utility to get full state
  getContextMenuState: () => {
    return contextMenuStore.get(_internalContextMenuStateAtom);
  },
};

// Export the singleton instance directly
export const contextMenuOps = contextMenuOperations;

// Hooks for components to use the context menu state
export const useNodeContextMenu = () => {
  return useAtomValue(nodeContextMenuAtom, { store: contextMenuStore });
};

export const useViewportContextMenu = () => {
  return useAtomValue(viewportContextMenuAtom, { store: contextMenuStore });
};

// Full state hook
export const useContextMenuState = () => {
  return useAtomValue(_internalContextMenuStateAtom, {
    store: contextMenuStore,
  });
};

// Imperative getters
export const useGetContextMenuState = () => {
  return useCallback(() => {
    return contextMenuStore.get(_internalContextMenuStateAtom);
  }, []);
};

export const useGetNodeContextMenu = () => {
  return useCallback(() => {
    return contextMenuStore.get(_internalContextMenuStateAtom).nodeContextMenu;
  }, []);
};

export const useGetViewportContextMenu = () => {
  return useCallback(() => {
    return contextMenuStore.get(_internalContextMenuStateAtom)
      .viewportContextMenu;
  }, []);
};

// Optional set functions for components that need to directly update state
export const useSetContextMenuState = () => {
  return useSetAtom(_internalContextMenuStateAtom, { store: contextMenuStore });
};

// Debug function
export const debugContextMenuStore = () => {
  console.log(
    "Context Menu Store State:",
    contextMenuStore.get(_internalContextMenuStateAtom)
  );
};
