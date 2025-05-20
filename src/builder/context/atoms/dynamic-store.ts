// Modified dynamic-store.ts with additional dynamicPositions tracking
import { atom, createStore } from "jotai/vanilla";
import { selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  NodeId,
  nodeStore,
  nodeStyleAtom,
  nodeParentAtom,
  nodeFlagsAtom,
  nodeSharedInfoAtom,
  sharedIdBucketsAtom,
} from "./node-store";
import { updateNodeStyle } from "./node-store/operations/style-operations";

export const dynamicStore = createStore();

// Adding dynamicPositions to store temporary positions in dynamic mode
export interface DynamicState {
  dynamicModeNodeId: string | number | null;
  activeViewportInDynamicMode: string | number | null;
  storedNodePositions: Record<
    string | number,
    {
      position?: string;
      left?: string;
      top?: string;
    }
  >;
  // New field for temporary positions while in dynamic mode
  dynamicPositions: Record<
    string | number,
    {
      left: string;
      top: string;
    }
  >;
}

const initialDynamicState: DynamicState = {
  dynamicModeNodeId: null,
  activeViewportInDynamicMode: null,
  storedNodePositions: {},
  dynamicPositions: {},
};

export const _internalDynamicStateAtom =
  atom<DynamicState>(initialDynamicState);

export const dynamicModeNodeIdAtom = selectAtom(
  _internalDynamicStateAtom,
  (state) => state.dynamicModeNodeId
);

export const activeViewportInDynamicModeAtom = selectAtom(
  _internalDynamicStateAtom,
  (state) => state.activeViewportInDynamicMode
);

export const storedNodePositionsAtom = selectAtom(
  _internalDynamicStateAtom,
  (state) => state.storedNodePositions
);

export const dynamicPositionsAtom = selectAtom(
  _internalDynamicStateAtom,
  (state) => state.dynamicPositions
);

const dynamicOperations = {
  // Store the original position properties before entering dynamic mode
  storeDynamicNodeState: (nodeId: NodeId) => {
    if (!nodeId) return;

    // Get node style from nodeStore
    const nodeStyle = nodeStore.get(nodeStyleAtom(nodeId));
    const nodeSharedInfo = nodeStore.get(nodeSharedInfoAtom(nodeId));

    // Store position properties
    dynamicStore.set(_internalDynamicStateAtom, (prev) => {
      const storedNodePositions = { ...prev.storedNodePositions };

      // Store this node's position, left, and top
      storedNodePositions[nodeId] = {
        position: nodeStyle.position,
        left: nodeStyle.left,
        top: nodeStyle.top,
      };

      // If node has sharedId, also store positions for all shared nodes
      if (nodeSharedInfo.sharedId) {
        const sharedIdBuckets = nodeStore.get(sharedIdBucketsAtom);
        const sharedNodes = sharedIdBuckets.get(nodeSharedInfo.sharedId);

        if (sharedNodes) {
          for (const id of sharedNodes) {
            if (id !== nodeId) {
              // Skip the original node we already stored
              const sharedNodeStyle = nodeStore.get(nodeStyleAtom(id));

              storedNodePositions[id] = {
                position: sharedNodeStyle.position,
                left: sharedNodeStyle.left,
                top: sharedNodeStyle.top,
              };
            }
          }
        }
      }

      return {
        ...prev,
        storedNodePositions,
      };
    });

    console.log("Stored original position for node:", nodeId);
  },

  // Set temporary dynamic position for a node (for dragging in dynamic mode)
  setDynamicPosition: (nodeId: NodeId, left: string, top: string) => {
    dynamicStore.set(_internalDynamicStateAtom, (prev) => {
      const dynamicPositions = { ...prev.dynamicPositions };
      dynamicPositions[nodeId] = { left, top };
      return {
        ...prev,
        dynamicPositions,
      };
    });
  },

  // Get dynamic position for a node if available
  getDynamicPosition: (nodeId: NodeId) => {
    const state = dynamicStore.get(_internalDynamicStateAtom);
    return state.dynamicPositions[nodeId];
  },

  // Clear dynamic position for a node
  clearDynamicPosition: (nodeId: NodeId) => {
    dynamicStore.set(_internalDynamicStateAtom, (prev) => {
      const dynamicPositions = { ...prev.dynamicPositions };
      delete dynamicPositions[nodeId];
      return {
        ...prev,
        dynamicPositions,
      };
    });
  },

  // Restore the original position properties when exiting dynamic mode
  restoreDynamicNodePositions: () => {
    const { storedNodePositions } = dynamicStore.get(_internalDynamicStateAtom);

    console.log("Stored positions to restore:", storedNodePositions);

    // If there are no stored positions, log warning and return
    if (Object.keys(storedNodePositions).length === 0) {
      console.warn("No stored positions found to restore");
      return;
    }

    // Batch update all stored node positions
    for (const [nodeId, state] of Object.entries(storedNodePositions)) {
      // Restore position properties
      const styleUpdates: Record<string, string | undefined> = {};

      if (state.position !== undefined) {
        styleUpdates.position = state.position;

        // IMPORTANT: If original position was "relative" or something other than "absolute",
        // we should clear left/top values to prevent unwanted offsets
        if (
          state.position === "relative" ||
          state.position === "static" ||
          (state.position !== "absolute" && state.position !== "fixed")
        ) {
          styleUpdates.left = "";
          styleUpdates.top = "";
        } else {
          // Only set left/top if the original position was absolute/fixed
          if (state.left !== undefined) {
            styleUpdates.left = state.left;
          }

          if (state.top !== undefined) {
            styleUpdates.top = state.top;
          }
        }
      } else {
        // If position wasn't stored, still restore left/top as they were
        if (state.left !== undefined) {
          styleUpdates.left = state.left;
        }

        if (state.top !== undefined) {
          styleUpdates.top = state.top;
        }
      }

      console.log(`Restoring position for node ${nodeId}:`, styleUpdates);
      updateNodeStyle(nodeId, styleUpdates);
    }

    // Clear stored positions after restoration
    dynamicStore.set(_internalDynamicStateAtom, (prev) => ({
      ...prev,
      storedNodePositions: {},
      dynamicPositions: {}, // Also clear dynamic positions
    }));

    console.log("Restored all node positions");
  },

  setDynamicModeNodeId: (
    nodeId: string | number | null,
    defaultViewportId?: string | number
  ) => {
    const currentNodeId = dynamicStore.get(
      _internalDynamicStateAtom
    ).dynamicModeNodeId;

    // If exiting dynamic mode (current is not null, new one is null)
    if (currentNodeId && !nodeId) {
      console.log("Exiting dynamic mode, restoring positions");
      dynamicOperations.restoreDynamicNodePositions();
    }

    dynamicStore.set(_internalDynamicStateAtom, (prev) => {
      if (!nodeId) {
        return {
          ...prev,
          dynamicModeNodeId: null,
          activeViewportInDynamicMode: null,
          dynamicPositions: {}, // Clear dynamic positions when exiting
        };
      } else if (nodeId && defaultViewportId) {
        return {
          ...prev,
          dynamicModeNodeId: nodeId,
          activeViewportInDynamicMode: defaultViewportId,
        };
      } else {
        return {
          ...prev,
          dynamicModeNodeId: nodeId,
        };
      }
    });
  },

  switchDynamicViewport: (viewportId: string | number | null) => {
    dynamicStore.set(_internalDynamicStateAtom, (prev) => ({
      ...prev,
      activeViewportInDynamicMode: viewportId,
    }));
  },

  getState: () => {
    return dynamicStore.get(_internalDynamicStateAtom);
  },
};

export const dynamicOps = dynamicOperations;

// Add hooks for the new dynamicPositions atom
export const useDynamicPositions = () => {
  return useAtomValue(dynamicPositionsAtom, { store: dynamicStore });
};

export const useGetDynamicPositions = () => {
  return useCallback(() => {
    return dynamicStore.get(_internalDynamicStateAtom).dynamicPositions;
  }, []);
};

// Keep all the existing hooks
export const useDynamicModeNodeId = () => {
  return useAtomValue(dynamicModeNodeIdAtom, { store: dynamicStore });
};

export const useActiveViewportInDynamicMode = () => {
  return useAtomValue(activeViewportInDynamicModeAtom, { store: dynamicStore });
};

export const useDynamicStateAll = () => {
  return useAtomValue(_internalDynamicStateAtom, { store: dynamicStore });
};

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

export const useSetDynamicState = () => {
  return useSetAtom(_internalDynamicStateAtom, { store: dynamicStore });
};
