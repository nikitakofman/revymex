import { atom, createStore } from "jotai/vanilla";
import { selectAtom } from "jotai/utils";
import { useAtomValue } from "jotai";
import { useCallback } from "react";

export const snapGuidesStore = createStore();

export interface SnapPoint {
  position: number;
  edge: string;
  distance: number;
}

export interface SnapGuidesState {
  enabled: boolean;

  snapThreshold: number;
  snapHoldDistance: number;

  activeGuides: {
    horizontal: Array<number>;
    vertical: Array<number>;
  };

  activeSnapPoints: {
    horizontal: SnapPoint | null;
    vertical: SnapPoint | null;
  };

  allSnapPositions: {
    horizontal: Array<number>;
    vertical: Array<number>;
  };
}

const initialSnapGuidesState: SnapGuidesState = {
  enabled: true,
  snapThreshold: 5,
  snapHoldDistance: 10,
  activeGuides: {
    horizontal: [],
    vertical: [],
  },
  activeSnapPoints: {
    horizontal: null,
    vertical: null,
  },
  allSnapPositions: {
    horizontal: [],
    vertical: [],
  },
};

export const _internalSnapGuidesStateAtom = atom<SnapGuidesState>(
  initialSnapGuidesState
);

export const enabledAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.enabled
);

export const snapThresholdAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.snapThreshold
);

export const snapHoldDistanceAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.snapHoldDistance
);

export const activeGuidesAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.activeGuides
);

export const activeSnapPointsAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.activeSnapPoints
);

export const allSnapPositionsAtom = selectAtom(
  _internalSnapGuidesStateAtom,
  (state) => state.allSnapPositions
);

const snapGuidesOperations = {
  setEnabled: (enabled: boolean) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      enabled,
    }));
  },

  setSnapThreshold: (snapThreshold: number) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      snapThreshold,
    }));
  },

  setSnapHoldDistance: (snapHoldDistance: number) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      snapHoldDistance,
    }));
  },

  setActiveGuides: (activeGuides: {
    horizontal: Array<number>;
    vertical: Array<number>;
  }) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      activeGuides,
    }));
  },

  setActiveSnapPoints: (activeSnapPoints: {
    horizontal: SnapPoint | null;
    vertical: SnapPoint | null;
  }) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      activeSnapPoints,
    }));
  },

  setAllSnapPositions: (allSnapPositions: {
    horizontal: Array<number>;
    vertical: Array<number>;
  }) => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      allSnapPositions,
    }));
  },

  resetGuides: () => {
    snapGuidesStore.set(_internalSnapGuidesStateAtom, (prev) => ({
      ...prev,
      activeGuides: { horizontal: [], vertical: [] },
      activeSnapPoints: { horizontal: null, vertical: null },
    }));
  },

  getState: () => {
    return snapGuidesStore.get(_internalSnapGuidesStateAtom);
  },
};

export const snapOps = snapGuidesOperations;

export const useSnapGuidesEnabled = () => {
  return useAtomValue(enabledAtom, { store: snapGuidesStore });
};

export const useSnapThreshold = () => {
  return useAtomValue(snapThresholdAtom, { store: snapGuidesStore });
};

export const useSnapHoldDistance = () => {
  return useAtomValue(snapHoldDistanceAtom, { store: snapGuidesStore });
};

export const useActiveGuides = () => {
  return useAtomValue(activeGuidesAtom, { store: snapGuidesStore });
};

export const useActiveSnapPoints = () => {
  return useAtomValue(activeSnapPointsAtom, { store: snapGuidesStore });
};

export const useAllSnapPositions = () => {
  return useAtomValue(allSnapPositionsAtom, { store: snapGuidesStore });
};

export const useSnapGuidesState = () => {
  return useAtomValue(_internalSnapGuidesStateAtom, {
    store: snapGuidesStore,
  });
};

export const useGetSnapGuidesState = () => {
  return useCallback(() => {
    return snapGuidesStore.get(_internalSnapGuidesStateAtom);
  }, []);
};

export const useGetSnapGuidesEnabled = () => {
  return useCallback(() => {
    return snapGuidesStore.get(_internalSnapGuidesStateAtom).enabled;
  }, []);
};

export const useGetActiveSnapPoints = () => {
  return useCallback(() => {
    return snapGuidesStore.get(_internalSnapGuidesStateAtom).activeSnapPoints;
  }, []);
};

export const debugSnapGuidesStore = () => {
  console.log(
    "Snap Guides Store State:",
    snapGuidesStore.get(_internalSnapGuidesStateAtom)
  );
};
