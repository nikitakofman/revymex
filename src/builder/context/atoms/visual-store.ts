// visual-store.ts
import { atom, createStore } from "jotai/vanilla";
import { selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

// Create a separate store for visual state
export const visualStore = createStore();

// Types definitions
export interface StyleHelperDimensions {
  width: number;
  height: number;
  unit: "px" | "%";
  widthUnit?: string;
  heightUnit?: string;
}

export interface StyleHelperState {
  show: boolean;
  type: "dimensions" | "gap" | "rotate" | "radius" | "fontSize" | null;
  position: { x: number; y: number };
  value?: number;
  unit?: string;
  isMixed?: boolean;
  dimensions?: StyleHelperDimensions;
}

export interface LineIndicatorState {
  show: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapGuideLine {
  type: "horizontal" | "vertical";
  position: number;
  start: number;
  end: number;
}

export interface VisualState {
  styleHelper: StyleHelperState;
  lineIndicator: LineIndicatorState;
  snapGuides: SnapGuideLine[];
}

// Initial state
const initialVisualState: VisualState = {
  styleHelper: {
    show: false,
    type: null,
    position: { x: 0, y: 0 },
    value: undefined,
    dimensions: undefined,
  },
  lineIndicator: {
    show: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
  snapGuides: [],
};

// Base atom for visual state
export const _internalVisualStateAtom = atom<VisualState>(initialVisualState);

// Individual property atoms for fine-grained subscriptions
export const styleHelperAtom = selectAtom(
  _internalVisualStateAtom,
  (state) => state.styleHelper
);

export const lineIndicatorAtom = selectAtom(
  _internalVisualStateAtom,
  (state) => state.lineIndicator
);

export const snapGuidesAtom = selectAtom(
  _internalVisualStateAtom,
  (state) => state.snapGuides
);

// Create a singleton instance of visual operations
const visualOperations = {
  // Style Helper operations
  updateStyleHelper: (params: {
    type: "dimensions" | "gap" | "rotate" | "radius" | "fontSize";
    position: { x: number; y: number };
    value?: number;
    unit?: string;
    isMixed?: boolean;
    dimensions?: StyleHelperDimensions;
  }) => {
    visualStore.set(_internalVisualStateAtom, (prev) => ({
      ...prev,
      styleHelper: {
        show: true,
        type: params.type,
        position: params.position,
        value: params.value,
        unit: params.unit,
        isMixed: params.isMixed,
        dimensions: params.dimensions,
      },
    }));
  },

  hideStyleHelper: () => {
    visualStore.set(_internalVisualStateAtom, (prev) => ({
      ...prev,
      styleHelper: {
        show: false,
        type: null,
        position: { x: 0, y: 0 },
        value: undefined,
        dimensions: undefined,
      },
    }));
  },

  // Line Indicator operations
  setLineIndicator: (lineIndicator: LineIndicatorState) => {
    visualStore.set(_internalVisualStateAtom, (prev) => ({
      ...prev,
      lineIndicator,
    }));
  },

  hideLineIndicator: () => {
    visualStore.set(_internalVisualStateAtom, (prev) => ({
      ...prev,
      lineIndicator: {
        show: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    }));
  },

  // Snap Guides operations
  setSnapGuides: (lines: SnapGuideLine[]) => {
    visualStore.set(_internalVisualStateAtom, (prev) => ({
      ...prev,
      snapGuides: lines,
    }));
  },

  clearSnapGuides: () => {
    visualStore.set(_internalVisualStateAtom, (prev) => ({
      ...prev,
      snapGuides: [],
    }));
  },

  // Utility to get full state
  getVisualState: () => {
    return visualStore.get(_internalVisualStateAtom);
  },

  // Reset all visual state
  resetVisualState: () => {
    visualStore.set(_internalVisualStateAtom, initialVisualState);
  },
};

// Export the singleton instance directly
export const visualOps = visualOperations;

// Hooks for components to use the visual state
export const useStyleHelper = () => {
  return useAtomValue(styleHelperAtom, { store: visualStore });
};

export const useLineIndicator = () => {
  return useAtomValue(lineIndicatorAtom, { store: visualStore });
};

export const useSnapGuides = () => {
  return useAtomValue(snapGuidesAtom, { store: visualStore });
};

// Full state hooks
export const useVisualState = () => {
  return useAtomValue(_internalVisualStateAtom, { store: visualStore });
};

// Imperative getters
export const useGetVisualState = () => {
  return useCallback(() => {
    return visualStore.get(_internalVisualStateAtom);
  }, []);
};

export const useGetStyleHelper = () => {
  return useCallback(() => {
    return visualStore.get(_internalVisualStateAtom).styleHelper;
  }, []);
};

export const useGetLineIndicator = () => {
  return useCallback(() => {
    return visualStore.get(_internalVisualStateAtom).lineIndicator;
  }, []);
};

export const useGetSnapGuides = () => {
  return useCallback(() => {
    return visualStore.get(_internalVisualStateAtom).snapGuides;
  }, []);
};

// Optional set functions for components that need to directly update state
export const useSetVisualState = () => {
  return useSetAtom(_internalVisualStateAtom, { store: visualStore });
};

// Debug function
export const debugVisualStore = () => {
  console.log("Visual Store State:", visualStore.get(_internalVisualStateAtom));
};
