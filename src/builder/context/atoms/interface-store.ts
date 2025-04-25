// interface-store.ts
import { atom, createStore } from "jotai/vanilla";
import { atomFamily, selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

// Create a separate store just for interface state - export as a const to guarantee a single instance
export const interfaceStore = createStore();

// Define the interface state structure
export interface InterfaceState {
  isInsertOpen: boolean;
  isLayersOpen: boolean;
  isCmsOpen: boolean;
  isPreviewOpen: boolean;
  isPagesOpen: boolean;
  isLibraryOpen: boolean;
  isUIKitsOpen: boolean;
  isTyping: boolean;
  previewWidth: number | null;
}

// Base atoms for interface state
export const _internalInterfaceStateAtom = atom<InterfaceState>({
  isInsertOpen: false,
  isLayersOpen: false,
  isCmsOpen: false,
  isPreviewOpen: false,
  isPagesOpen: false,
  isLibraryOpen: false,
  isUIKitsOpen: false,
  isTyping: false,
  previewWidth: null,
});

// Individual property atoms for fine-grained subscriptions
export const isInsertOpenAtom = selectAtom(
  _internalInterfaceStateAtom,
  (state) => state.isInsertOpen
);

export const isLayersOpenAtom = selectAtom(
  _internalInterfaceStateAtom,
  (state) => state.isLayersOpen
);

export const isCmsOpenAtom = selectAtom(
  _internalInterfaceStateAtom,
  (state) => state.isCmsOpen
);

export const isPreviewOpenAtom = selectAtom(
  _internalInterfaceStateAtom,
  (state) => state.isPreviewOpen
);

export const isPagesOpenAtom = selectAtom(
  _internalInterfaceStateAtom,
  (state) => state.isPagesOpen
);

export const isLibraryOpenAtom = selectAtom(
  _internalInterfaceStateAtom,
  (state) => state.isLibraryOpen
);

export const isUIKitsOpenAtom = selectAtom(
  _internalInterfaceStateAtom,
  (state) => state.isUIKitsOpen
);

export const isTypingAtom = selectAtom(
  _internalInterfaceStateAtom,
  (state) => state.isTyping
);

export const previewWidthAtom = selectAtom(
  _internalInterfaceStateAtom,
  (state) => state.previewWidth
);

// Create a singleton instance of interface operations
const interfaceOperations = {
  // Toggle operations with mutual exclusivity
  toggleInsert: () => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => {
      const newState = { ...prev, isInsertOpen: !prev.isInsertOpen };

      // Close other panels if this one is opening
      if (newState.isInsertOpen) {
        newState.isLayersOpen = false;
        newState.isCmsOpen = false;
        newState.isPagesOpen = false;
        newState.isLibraryOpen = false;
        newState.isUIKitsOpen = false;
        newState.isPreviewOpen = false;
      }

      return newState;
    });
  },

  toggleLayers: () => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => {
      const newState = { ...prev, isLayersOpen: !prev.isLayersOpen };

      // Close other panels if this one is opening
      if (newState.isLayersOpen) {
        newState.isInsertOpen = false;
        newState.isCmsOpen = false;
        newState.isPagesOpen = false;
        newState.isLibraryOpen = false;
        newState.isUIKitsOpen = false;
        newState.isPreviewOpen = false;
      }

      return newState;
    });
  },

  toggleCms: () => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => {
      const newState = { ...prev, isCmsOpen: !prev.isCmsOpen };

      // Close other panels if this one is opening
      if (newState.isCmsOpen) {
        newState.isInsertOpen = false;
        newState.isLayersOpen = false;
        newState.isPagesOpen = false;
        newState.isLibraryOpen = false;
        newState.isUIKitsOpen = false;
        newState.isPreviewOpen = false;
      }

      return newState;
    });
  },

  togglePages: () => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => {
      const newState = { ...prev, isPagesOpen: !prev.isPagesOpen };

      // Close other panels if this one is opening
      if (newState.isPagesOpen) {
        newState.isInsertOpen = false;
        newState.isLayersOpen = false;
        newState.isCmsOpen = false;
        newState.isLibraryOpen = false;
        newState.isUIKitsOpen = false;
        newState.isPreviewOpen = false;
      }

      return newState;
    });
  },

  toggleLibrary: () => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => {
      const newState = { ...prev, isLibraryOpen: !prev.isLibraryOpen };

      // Close other panels if this one is opening
      if (newState.isLibraryOpen) {
        newState.isInsertOpen = false;
        newState.isLayersOpen = false;
        newState.isCmsOpen = false;
        newState.isPagesOpen = false;
        newState.isUIKitsOpen = false;
        newState.isPreviewOpen = false;
      }

      return newState;
    });
  },

  toggleUIKits: () => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => {
      const newState = { ...prev, isUIKitsOpen: !prev.isUIKitsOpen };

      // Close other panels if this one is opening
      if (newState.isUIKitsOpen) {
        newState.isInsertOpen = false;
        newState.isLayersOpen = false;
        newState.isCmsOpen = false;
        newState.isPagesOpen = false;
        newState.isLibraryOpen = false;
        newState.isPreviewOpen = false;
      }

      return newState;
    });
  },

  togglePreview: () => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => {
      const newState = { ...prev, isPreviewOpen: !prev.isPreviewOpen };

      // Close other panels if this one is opening
      if (newState.isPreviewOpen) {
        newState.isInsertOpen = false;
        newState.isLayersOpen = false;
        newState.isCmsOpen = false;
        newState.isPagesOpen = false;
        newState.isLibraryOpen = false;
        newState.isUIKitsOpen = false;
      }

      return newState;
    });
  },

  // Simple toggle for typing state
  toggleIsTyping: () => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isTyping: !prev.isTyping,
    }));
  },

  // Direct setters
  setIsTyping: (isTyping: boolean) => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isTyping,
    }));
  },

  setPreviewWidth: (width: number | null) => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      previewWidth: width,
    }));
  },

  // Getter for the full state
  getInterfaceState: () => {
    return interfaceStore.get(_internalInterfaceStateAtom);
  },

  // Direct setters for individual properties
  setIsInsertOpen: (isOpen: boolean) => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isInsertOpen: isOpen,
    }));
  },

  setIsLayersOpen: (isOpen: boolean) => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isLayersOpen: isOpen,
    }));
  },

  setIsCmsOpen: (isOpen: boolean) => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isCmsOpen: isOpen,
    }));
  },

  setIsPreviewOpen: (isOpen: boolean) => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isPreviewOpen: isOpen,
    }));
  },

  setIsPagesOpen: (isOpen: boolean) => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isPagesOpen: isOpen,
    }));
  },

  setIsLibraryOpen: (isOpen: boolean) => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isLibraryOpen: isOpen,
    }));
  },

  setIsUIKitsOpen: (isOpen: boolean) => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isUIKitsOpen: isOpen,
    }));
  },

  // Close all panels
  closeAllPanels: () => {
    interfaceStore.set(_internalInterfaceStateAtom, (prev) => ({
      ...prev,
      isInsertOpen: false,
      isLayersOpen: false,
      isCmsOpen: false,
      isPreviewOpen: false,
      isPagesOpen: false,
      isLibraryOpen: false,
      isUIKitsOpen: false,
    }));
  },
};

// Export the singleton instance directly
export const interfaceOps = interfaceOperations;

// Hooks for components to use the interface state
export const useInterfaceState = () => {
  const state = useAtomValue(_internalInterfaceStateAtom, {
    store: interfaceStore,
  });
  return state;
};

// Individual hooks for specific properties
export const useIsInsertOpen = () => {
  return useAtomValue(isInsertOpenAtom, { store: interfaceStore });
};

export const useIsLayersOpen = () => {
  return useAtomValue(isLayersOpenAtom, { store: interfaceStore });
};

export const useIsCmsOpen = () => {
  return useAtomValue(isCmsOpenAtom, { store: interfaceStore });
};

export const useIsPreviewOpen = () => {
  return useAtomValue(isPreviewOpenAtom, { store: interfaceStore });
};

export const useIsPagesOpen = () => {
  return useAtomValue(isPagesOpenAtom, { store: interfaceStore });
};

export const useIsLibraryOpen = () => {
  return useAtomValue(isLibraryOpenAtom, { store: interfaceStore });
};

export const useIsUIKitsOpen = () => {
  return useAtomValue(isUIKitsOpenAtom, { store: interfaceStore });
};

export const useIsTyping = () => {
  return useAtomValue(isTypingAtom, { store: interfaceStore });
};

export const usePreviewWidth = () => {
  return useAtomValue(previewWidthAtom, { store: interfaceStore });
};

// Imperative getters
export const useGetInterfaceState = () => {
  return useCallback(() => {
    return interfaceStore.get(_internalInterfaceStateAtom);
  }, []);
};

export const useGetIsInsertOpen = () => {
  return useCallback(() => {
    return interfaceStore.get(_internalInterfaceStateAtom).isInsertOpen;
  }, []);
};

export const useGetIsLayersOpen = () => {
  return useCallback(() => {
    return interfaceStore.get(_internalInterfaceStateAtom).isLayersOpen;
  }, []);
};

// Optional set functions for components that need to directly update state
export const useSetInterfaceState = () => {
  return useSetAtom(_internalInterfaceStateAtom, { store: interfaceStore });
};

// Debug function
export const debugInterfaceStore = () => {
  console.log(
    "Interface Store State:",
    interfaceStore.get(_internalInterfaceStateAtom)
  );
};

// Initialize the store with default values
interfaceStore.set(_internalInterfaceStateAtom, {
  isInsertOpen: false,
  isLayersOpen: false,
  isCmsOpen: false,
  isPreviewOpen: false,
  isPagesOpen: false,
  isLibraryOpen: false,
  isUIKitsOpen: false,
  isTyping: false,
  previewWidth: null,
});

// Optional listener for debugging
if (process.env.NODE_ENV === "development") {
  interfaceStore.sub(_internalInterfaceStateAtom, () => {
    console.log(
      "Interface state changed:",
      interfaceStore.get(_internalInterfaceStateAtom)
    );
  });
}
