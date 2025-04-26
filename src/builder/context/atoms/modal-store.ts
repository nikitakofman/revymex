// src/builder/context/atoms/modal-store.ts
import { atom, createStore } from "jotai/vanilla";
import { selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

// Create a separate store for modal state
export const modalStore = createStore();

// Type definitions
export interface ConnectionTypeModalState {
  show: boolean;
  position: { x: number; y: number };
  sourceId: string | number | null;
  targetId: string | number | null;
}

export interface ViewportModalState {
  show: boolean;
  position: {
    x: number;
    y: number;
  };
}

export interface EditViewportModalState {
  show: boolean;
  viewportId: string | number | null;
  position: {
    x: number;
    y: number;
  };
}

export interface ModalState {
  connectionTypeModal: ConnectionTypeModalState;
  viewportModal: ViewportModalState;
  editViewportModal: EditViewportModalState;
}

// Initial state
const initialModalState: ModalState = {
  connectionTypeModal: {
    show: false,
    position: { x: 0, y: 0 },
    sourceId: null,
    targetId: null,
  },
  viewportModal: {
    show: false,
    position: { x: 0, y: 0 },
  },
  editViewportModal: {
    show: false,
    viewportId: null,
    position: { x: 0, y: 0 },
  },
};

// Base atom for modal state
export const _internalModalStateAtom = atom<ModalState>(initialModalState);

// Individual property atoms for fine-grained subscriptions
export const connectionTypeModalAtom = selectAtom(
  _internalModalStateAtom,
  (state) => state.connectionTypeModal
);

export const viewportModalAtom = selectAtom(
  _internalModalStateAtom,
  (state) => state.viewportModal
);

export const editViewportModalAtom = selectAtom(
  _internalModalStateAtom,
  (state) => state.editViewportModal
);

// Additional derived atoms for specific states
export const isConnectionTypeModalShownAtom = selectAtom(
  connectionTypeModalAtom,
  (modal) => modal.show
);

export const isViewportModalShownAtom = selectAtom(
  viewportModalAtom,
  (modal) => modal.show
);

export const isEditViewportModalShownAtom = selectAtom(
  editViewportModalAtom,
  (modal) => modal.show
);

// Create a singleton instance of modal operations
const modalOperations = {
  // Connection Type Modal operations
  showConnectionTypeModal: (
    sourceId: string | number,
    targetId: string | number,
    position: { x: number; y: number }
  ) => {
    modalStore.set(_internalModalStateAtom, (prev) => ({
      ...prev,
      connectionTypeModal: {
        show: true,
        position,
        sourceId,
        targetId,
      },
    }));
  },

  hideConnectionTypeModal: () => {
    modalStore.set(_internalModalStateAtom, (prev) => ({
      ...prev,
      connectionTypeModal: {
        ...prev.connectionTypeModal,
        show: false,
      },
    }));
  },

  // Viewport Modal operations
  showViewportModal: (position: { x: number; y: number }) => {
    modalStore.set(_internalModalStateAtom, (prev) => ({
      ...prev,
      viewportModal: {
        show: true,
        position,
      },
    }));
  },

  hideViewportModal: () => {
    modalStore.set(_internalModalStateAtom, (prev) => ({
      ...prev,
      viewportModal: {
        ...prev.viewportModal,
        show: false,
      },
    }));
  },

  // Edit Viewport Modal operations
  showEditViewportModal: (
    viewportId: string | number,
    position: { x: number; y: number }
  ) => {
    modalStore.set(_internalModalStateAtom, (prev) => ({
      ...prev,
      editViewportModal: {
        show: true,
        viewportId,
        position,
      },
    }));
  },

  hideEditViewportModal: () => {
    modalStore.set(_internalModalStateAtom, (prev) => ({
      ...prev,
      editViewportModal: {
        ...prev.editViewportModal,
        show: false,
      },
    }));
  },

  // Reset all modals
  resetAllModals: () => {
    modalStore.set(_internalModalStateAtom, initialModalState);
  },

  // Utility to get full state
  getState: () => {
    return modalStore.get(_internalModalStateAtom);
  },
};

// Export the singleton instance directly
export const modalOps = modalOperations;

// Hooks for components to use the modal state
export const useConnectionTypeModal = () => {
  return useAtomValue(connectionTypeModalAtom, { store: modalStore });
};

export const useViewportModal = () => {
  return useAtomValue(viewportModalAtom, { store: modalStore });
};

export const useEditViewportModal = () => {
  return useAtomValue(editViewportModalAtom, { store: modalStore });
};

export const useIsConnectionTypeModalShown = () => {
  return useAtomValue(isConnectionTypeModalShownAtom, { store: modalStore });
};

export const useIsViewportModalShown = () => {
  return useAtomValue(isViewportModalShownAtom, { store: modalStore });
};

export const useIsEditViewportModalShown = () => {
  return useAtomValue(isEditViewportModalShownAtom, { store: modalStore });
};

// Full state hook
export const useModalState = () => {
  return useAtomValue(_internalModalStateAtom, { store: modalStore });
};

// Imperative getters
export const useGetModalState = () => {
  return useCallback(() => {
    return modalStore.get(_internalModalStateAtom);
  }, []);
};

export const useGetConnectionTypeModal = () => {
  return useCallback(() => {
    return modalStore.get(_internalModalStateAtom).connectionTypeModal;
  }, []);
};

export const useGetViewportModal = () => {
  return useCallback(() => {
    return modalStore.get(_internalModalStateAtom).viewportModal;
  }, []);
};

export const useGetEditViewportModal = () => {
  return useCallback(() => {
    return modalStore.get(_internalModalStateAtom).editViewportModal;
  }, []);
};

// Optional set functions for components that need to directly update state
export const useSetModalState = () => {
  return useSetAtom(_internalModalStateAtom, { store: modalStore });
};

// Debug function
export const debugModalStore = () => {
  console.log("Modal Store State:", modalStore.get(_internalModalStateAtom));
};
