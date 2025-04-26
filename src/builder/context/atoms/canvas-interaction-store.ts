// src/builder/context/atoms/canvas-interaction-store.ts
import { atom, createStore } from "jotai/vanilla";
import { selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

// Create a separate store for canvas interaction state
export const canvasInteractionStore = createStore();

// Type definitions
export interface TransformState {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasInteractionState {
  // Canvas transform and movement
  transform: TransformState;
  isMovingCanvas: boolean;
  isMiddleMouseDown: boolean;
  isMoveCanvasMode: boolean;

  // Element manipulation states
  isResizing: boolean;
  isAdjustingGap: boolean;
  isRotating: boolean;
  isAdjustingBorderRadius: boolean;
  isDraggingChevrons: boolean;

  // Tool mode states
  isFrameModeActive: boolean;
  isTextModeActive: boolean;

  // Text editing states
  isEditingText: boolean;
  isTextMenuOpen: boolean;
  isFontSizeHandleActive: boolean;

  // Selection box state
  isSelectionBoxActive: boolean;
}

// Initial state
const initialCanvasInteractionState: CanvasInteractionState = {
  transform: { x: 480, y: 200, scale: 0.3 },
  isMovingCanvas: false,
  isMiddleMouseDown: false,
  isMoveCanvasMode: false,

  isResizing: false,
  isAdjustingGap: false,
  isRotating: false,
  isAdjustingBorderRadius: false,
  isDraggingChevrons: false,

  isFrameModeActive: false,
  isTextModeActive: false,

  isEditingText: false,
  isTextMenuOpen: false,
  isFontSizeHandleActive: false,

  isSelectionBoxActive: false,
};

// Base atom for canvas interaction state
export const _internalCanvasInteractionStateAtom = atom<CanvasInteractionState>(
  initialCanvasInteractionState
);

// Individual property atoms for fine-grained subscriptions
export const transformAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.transform
);

export const isMovingCanvasAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isMovingCanvas
);

export const isMiddleMouseDownAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isMiddleMouseDown
);

export const isMoveCanvasModeAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isMoveCanvasMode
);

export const isResizingAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isResizing
);

export const isAdjustingGapAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isAdjustingGap
);

export const isRotatingAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isRotating
);

export const isAdjustingBorderRadiusAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isAdjustingBorderRadius
);

export const isDraggingChevronsAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isDraggingChevrons
);

export const isFrameModeActiveAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isFrameModeActive
);

export const isTextModeActiveAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isTextModeActive
);

export const isEditingTextAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isEditingText
);

export const isTextMenuOpenAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isTextMenuOpen
);

export const isFontSizeHandleActiveAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isFontSizeHandleActive
);

export const isSelectionBoxActiveAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) => state.isSelectionBoxActive
);

// Compound selectors for common interaction groups
export const isAnyResizeActiveAtom = selectAtom(
  _internalCanvasInteractionStateAtom,
  (state) =>
    !state.isResizing &&
    !state.isAdjustingGap &&
    !state.isRotating &&
    !state.isAdjustingBorderRadius
);

// Create a singleton instance of canvas interaction operations
const canvasInteractionOperations = {
  // Transform operations
  setTransform: (transform: TransformState) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      transform,
    }));
  },

  updateTransform: (transformUpdate: Partial<TransformState>) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      transform: {
        ...prev.transform,
        ...transformUpdate,
      },
    }));
  },

  // Canvas movement operations
  setIsMovingCanvas: (isMovingCanvas: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isMovingCanvas,
    }));
  },

  setIsMiddleMouseDown: (isMiddleMouseDown: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isMiddleMouseDown,
    }));
  },

  setIsMoveCanvasMode: (isMoveCanvasMode: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isMoveCanvasMode,
    }));
  },

  // Element manipulation operations
  setIsResizing: (isResizing: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isResizing,
    }));
  },

  setIsAdjustingGap: (isAdjustingGap: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isAdjustingGap,
    }));
  },

  setIsRotating: (isRotating: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isRotating,
    }));
  },

  setIsAdjustingBorderRadius: (isAdjustingBorderRadius: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isAdjustingBorderRadius,
    }));
  },

  setIsDraggingChevrons: (isDraggingChevrons: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isDraggingChevrons,
    }));
  },

  // Tool mode operations
  setIsFrameModeActive: (isFrameModeActive: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isFrameModeActive,
    }));
  },

  setIsTextModeActive: (isTextModeActive: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isTextModeActive,
    }));
  },

  // Text editing operations
  setIsEditingText: (isEditingText: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isEditingText,
    }));
  },

  setIsTextMenuOpen: (isTextMenuOpen: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isTextMenuOpen,
    }));
  },

  setIsFontSizeHandleActive: (isFontSizeHandleActive: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isFontSizeHandleActive,
    }));
  },

  // Selection box operation
  setIsSelectionBoxActive: (isSelectionBoxActive: boolean) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isSelectionBoxActive,
    }));
  },

  // Batch update operations
  setPartialState: (state: Partial<CanvasInteractionState>) => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      ...state,
    }));
  },

  // Reset operations
  resetState: () => {
    canvasInteractionStore.set(
      _internalCanvasInteractionStateAtom,
      initialCanvasInteractionState
    );
  },

  resetInteractionStates: () => {
    canvasInteractionStore.set(_internalCanvasInteractionStateAtom, (prev) => ({
      ...prev,
      isResizing: false,
      isAdjustingGap: false,
      isRotating: false,
      isAdjustingBorderRadius: false,
      isDraggingChevrons: false,
      isMovingCanvas: false,
      isMiddleMouseDown: false,
      isSelectionBoxActive: false,
    }));
  },

  // Utility to get full state
  getState: () => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom);
  },
};

// Export the singleton instance directly
export const canvasOps = canvasInteractionOperations;

// Hooks for components to use the canvas interaction state
export const useTransform = () => {
  return useAtomValue(transformAtom, { store: canvasInteractionStore });
};

export const useIsMovingCanvas = () => {
  return useAtomValue(isMovingCanvasAtom, { store: canvasInteractionStore });
};

export const useIsMiddleMouseDown = () => {
  return useAtomValue(isMiddleMouseDownAtom, { store: canvasInteractionStore });
};

export const useIsMoveCanvasMode = () => {
  return useAtomValue(isMoveCanvasModeAtom, { store: canvasInteractionStore });
};

export const useIsResizing = () => {
  return useAtomValue(isResizingAtom, { store: canvasInteractionStore });
};

export const useIsAdjustingGap = () => {
  return useAtomValue(isAdjustingGapAtom, { store: canvasInteractionStore });
};

export const useIsRotating = () => {
  return useAtomValue(isRotatingAtom, { store: canvasInteractionStore });
};

export const useIsAdjustingBorderRadius = () => {
  return useAtomValue(isAdjustingBorderRadiusAtom, {
    store: canvasInteractionStore,
  });
};

export const useIsDraggingChevrons = () => {
  return useAtomValue(isDraggingChevronsAtom, {
    store: canvasInteractionStore,
  });
};

export const useIsFrameModeActive = () => {
  return useAtomValue(isFrameModeActiveAtom, { store: canvasInteractionStore });
};

export const useIsTextModeActive = () => {
  return useAtomValue(isTextModeActiveAtom, { store: canvasInteractionStore });
};

export const useIsEditingText = () => {
  return useAtomValue(isEditingTextAtom, { store: canvasInteractionStore });
};

export const useIsTextMenuOpen = () => {
  return useAtomValue(isTextMenuOpenAtom, { store: canvasInteractionStore });
};

export const useIsFontSizeHandleActive = () => {
  return useAtomValue(isFontSizeHandleActiveAtom, {
    store: canvasInteractionStore,
  });
};

export const useIsSelectionBoxActive = () => {
  return useAtomValue(isSelectionBoxActiveAtom, {
    store: canvasInteractionStore,
  });
};

export const useIsAnyResizeActive = () => {
  return useAtomValue(isAnyResizeActiveAtom, { store: canvasInteractionStore });
};

// Full state hook
export const useCanvasInteractionState = () => {
  return useAtomValue(_internalCanvasInteractionStateAtom, {
    store: canvasInteractionStore,
  });
};

// Imperative getters
export const useGetCanvasInteractionState = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom);
  }, []);
};

export const useGetTransform = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .transform;
  }, []);
};

export const useGetIsMovingCanvas = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isMovingCanvas;
  }, []);
};

export const useGetIsMiddleMouseDown = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isMiddleMouseDown;
  }, []);
};

export const useGetIsMoveCanvasMode = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isMoveCanvasMode;
  }, []);
};

export const useGetIsResizing = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isResizing;
  }, []);
};

export const useGetIsAdjustingGap = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isAdjustingGap;
  }, []);
};

export const useGetIsRotating = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isRotating;
  }, []);
};

export const useGetIsAdjustingBorderRadius = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isAdjustingBorderRadius;
  }, []);
};

export const useGetIsDraggingChevrons = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isDraggingChevrons;
  }, []);
};

export const useGetIsFrameModeActive = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isFrameModeActive;
  }, []);
};

export const useGetIsTextModeActive = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isTextModeActive;
  }, []);
};

export const useGetIsEditingText = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isEditingText;
  }, []);
};

export const useGetIsTextMenuOpen = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isTextMenuOpen;
  }, []);
};

export const useGetIsFontSizeHandleActive = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isFontSizeHandleActive;
  }, []);
};

export const useGetIsSelectionBoxActive = () => {
  return useCallback(() => {
    return canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
      .isSelectionBoxActive;
  }, []);
};

// Optional set functions for components that need to directly update state
export const useSetCanvasInteractionState = () => {
  return useSetAtom(_internalCanvasInteractionStateAtom, {
    store: canvasInteractionStore,
  });
};

// Debug function
export const debugCanvasInteractionStore = () => {
  console.log(
    "Canvas Interaction Store State:",
    canvasInteractionStore.get(_internalCanvasInteractionStateAtom)
  );
};
