// snap-guides-store.ts
import { atom, createStore } from "jotai/vanilla";
import { useAtomValue } from "jotai";
import { selectAtom } from "jotai/utils";

// Create a separate store for snap guides
export const snapGuidesStore = createStore();

// State types
interface SnapPoint {
  position: number;
  distance: number;
  edge: string;
}

// Interface for spacing guides
interface SpacingGuide {
  axis: "h" | "v"; // horizontal = between columns
  pos1: number; // world-space position of first edge
  pos2: number; // world-space position of second edge
  distance: number; // px between them
}

interface SnapGuidesState {
  enabled: boolean;
  snapThreshold: number;
  allSnapPositions: {
    horizontal: number[];
    vertical: number[];
  };
  activeGuides: {
    horizontal: number[];
    vertical: number[];
  };
  activeSnapPoints: {
    horizontal: SnapPoint | null;
    vertical: SnapPoint | null;
  };
  showChildElements: boolean; // Added this property
  limitToNodes: string[] | null; // Added to limit snapping to specific nodes
  waitForResizeMove: boolean; // Flag to wait for movement before showing guides
  resizeDirection: string | null; // Track which direction is being resized
  spacingGuide: SpacingGuide | null; // Track equal spacing guides
}

// Initial state
const initialSnapGuidesState: SnapGuidesState = {
  enabled: true,
  snapThreshold: 8, // Pixels within which snapping occurs
  allSnapPositions: { horizontal: [], vertical: [] },
  activeGuides: { horizontal: [], vertical: [] },
  activeSnapPoints: { horizontal: null, vertical: null },
  showChildElements: false, // Default to false (show only top-level elements)
  limitToNodes: null, // Default to null (no limiting)
  waitForResizeMove: false, // Default to not waiting
  resizeDirection: null, // No active resize direction initially
  spacingGuide: null, // No active spacing guide initially
};

// Base atom for snap guides state
export const _internalSnapGuidesStateAtom = atom<SnapGuidesState>(
  initialSnapGuidesState
);

// Selectors for individual parts of the state
export const enabledAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.enabled
);

export const snapThresholdAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.snapThreshold
);

export const allSnapPositionsAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.allSnapPositions
);

export const activeGuidesAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.activeGuides
);

export const activeSnapPointsAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.activeSnapPoints
);

export const showChildElementsAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.showChildElements
);

export const limitToNodesAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.limitToNodes
);

export const waitForResizeMoveAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.waitForResizeMove
);

export const resizeDirectionAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.resizeDirection
);

// Selector for spacing guide
export const spacingGuideAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.spacingGuide
);

// Operations for the snap guides store
const snapGuidesOperations = {
  // Enable/disable snap guides
  setEnabled: (enabled: boolean) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      enabled,
    }));
  },

  // Set snap threshold
  setSnapThreshold: (snapThreshold: number) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      snapThreshold,
    }));
  },

  // Set all available snap positions
  setAllSnapPositions: (positions: {
    horizontal: number[];
    vertical: number[];
  }) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      allSnapPositions: positions,
    }));
  },

  // Set active guides for visual display
  setActiveGuides: (guides: { horizontal: number[]; vertical: number[] }) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      activeGuides: guides,
    }));
  },

  // Set active snap points for snapping calculations
  setActiveSnapPoints: (points: {
    horizontal: SnapPoint | null;
    vertical: SnapPoint | null;
  }) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      activeSnapPoints: points,
    }));
  },

  // Reset active guides and snap points
  resetGuides: () => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      activeGuides: { horizontal: [], vertical: [] },
      activeSnapPoints: { horizontal: null, vertical: null },
      spacingGuide: null, // Also reset spacing guide
    }));
  },

  // Set whether to show child elements or just top-level elements
  setShowChildElements: (showChildElements: boolean) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      showChildElements,
    }));
  },

  // Set limit to specific nodes
  setLimitToNodes: (nodeIds: string[] | null) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      limitToNodes: nodeIds,
    }));
  },

  // Set wait for resize move flag
  setWaitForResizeMove: (flag: boolean) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      waitForResizeMove: flag,
    }));
  },

  // Set resize direction
  setResizeDirection: (direction: string | null) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      resizeDirection: direction,
    }));
  },

  configureForCanvasTransition: () => {
    // Reset any existing guides
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      // For canvas mode: don't show child elements, no node limitations
      showChildElements: false,
      limitToNodes: null,
      // Reset guides and snap points
      activeGuides: { horizontal: [], vertical: [] },
      activeSnapPoints: { horizontal: null, vertical: null },
      spacingGuide: null,
      // Reset resize-related flags
      waitForResizeMove: false,
      resizeDirection: null,
    }));
  },

  // Set spacing guide
  setSpacingGuide: (guide: SpacingGuide | null) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      spacingGuide: guide,
    }));
  },

  // Get the current state
  getState: () => {
    return snapGuidesStore.get(_internalSnapGuidesStateAtom);
  },
};

// Export operations as a singleton
export const snapOps = snapGuidesOperations;

// Hooks for components
export const useSnapEnabled = () => {
  return useAtomValue(enabledAtom, { store: snapGuidesStore });
};

export const useSnapThreshold = () => {
  return useAtomValue(snapThresholdAtom, { store: snapGuidesStore });
};

export const useAllSnapPositions = () => {
  return useAtomValue(allSnapPositionsAtom, { store: snapGuidesStore });
};

export const useActiveGuides = () => {
  return useAtomValue(activeGuidesAtom, { store: snapGuidesStore });
};

export const useActiveSnapPoints = () => {
  return useAtomValue(activeSnapPointsAtom, { store: snapGuidesStore });
};

export const useShowChildElements = () => {
  return useAtomValue(showChildElementsAtom, { store: snapGuidesStore });
};

export const useLimitToNodes = () => {
  return useAtomValue(limitToNodesAtom, { store: snapGuidesStore });
};

export const useWaitForResizeMove = () => {
  return useAtomValue(waitForResizeMoveAtom, { store: snapGuidesStore });
};

export const useResizeDirection = () => {
  return useAtomValue(resizeDirectionAtom, { store: snapGuidesStore });
};

// Hook for spacing guide
export const useSpacingGuide = () => {
  return useAtomValue(spacingGuideAtom, { store: snapGuidesStore });
};
