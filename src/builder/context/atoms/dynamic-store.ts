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
import { moveNode } from "./node-store/operations/insert-operations";
import { updateNodeFlags } from "./node-store/operations/update-operations";

export const dynamicStore = createStore();

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
  // Track temporary positions while in dynamic mode
  dynamicPositions: Record<
    string | number,
    {
      left: string;
      top: string;
    }
  >;
  // Store original parent relationships
  originalParents: Record<
    string | number,
    {
      parentId: string | number | null;
      inViewport: boolean;
      originalPosition?: string;
      originalLeft?: string;
      originalTop?: string;
      originalZIndex?: string;
    }
  >;
  // Track which nodes were detached for dynamic mode
  detachedNodes: Set<string | number>;
}

const initialDynamicState: DynamicState = {
  dynamicModeNodeId: null,
  activeViewportInDynamicMode: null,
  storedNodePositions: {},
  dynamicPositions: {},
  originalParents: {},
  detachedNodes: new Set(),
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

export const originalParentsAtom = selectAtom(
  _internalDynamicStateAtom,
  (state) => state.originalParents
);

export const detachedNodesAtom = selectAtom(
  _internalDynamicStateAtom,
  (state) => state.detachedNodes
);

const dynamicOperations = {
  // Store the original position properties and parent relationship before entering dynamic mode
  storeDynamicNodeState: (nodeId: NodeId) => {
    if (!nodeId) return;

    // Get node information from nodeStore
    const nodeStyle = nodeStore.get(nodeStyleAtom(nodeId));
    const nodeSharedInfo = nodeStore.get(nodeSharedInfoAtom(nodeId));
    const nodeFlags = nodeStore.get(nodeFlagsAtom(nodeId));
    const nodeParent = nodeStore.get(nodeParentAtom(nodeId));

    // Store original position properties and parent relationship
    dynamicStore.set(_internalDynamicStateAtom, (prev) => {
      const storedNodePositions = { ...prev.storedNodePositions };
      const originalParents = { ...prev.originalParents };

      // Store this node's position, left, top, and parent relationship
      storedNodePositions[nodeId] = {
        position: nodeStyle.position,
        left: nodeStyle.left,
        top: nodeStyle.top,
      };

      originalParents[nodeId] = {
        parentId: nodeParent,
        inViewport: !!nodeFlags.inViewport,
        originalPosition: nodeStyle.position,
        originalLeft: nodeStyle.left,
        originalTop: nodeStyle.top,
        originalZIndex: nodeStyle.zIndex,
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
              const sharedNodeParent = nodeStore.get(nodeParentAtom(id));
              const sharedNodeFlags = nodeStore.get(nodeFlagsAtom(id));

              storedNodePositions[id] = {
                position: sharedNodeStyle.position,
                left: sharedNodeStyle.left,
                top: sharedNodeStyle.top,
              };

              originalParents[id] = {
                parentId: sharedNodeParent,
                inViewport: !!sharedNodeFlags.inViewport,
                originalPosition: sharedNodeStyle.position,
                originalLeft: sharedNodeStyle.left,
                originalTop: sharedNodeStyle.top,
                originalZIndex: sharedNodeStyle.zIndex,
              };
            }
          }
        }
      }

      return {
        ...prev,
        storedNodePositions,
        originalParents,
      };
    });

    console.log("Stored original position and parent for node:", nodeId);
  },

  // New method to detach a node from its parent for dynamic mode
  detachNodeForDynamicMode: (nodeId: NodeId) => {
    if (!nodeId) return;

    console.log("Detaching node for dynamic mode:", nodeId);

    // First ensure we've stored the original state
    const currentState = dynamicStore.get(_internalDynamicStateAtom);
    if (!currentState.originalParents[nodeId]) {
      dynamicOperations.storeDynamicNodeState(nodeId);
    }

    // Detach the node by setting its parent to null
    moveNode(nodeId, null);

    // Mark this node as detached
    dynamicStore.set(_internalDynamicStateAtom, (prev) => {
      const detachedNodes = new Set(prev.detachedNodes);
      detachedNodes.add(nodeId);
      return {
        ...prev,
        detachedNodes,
      };
    });

    // Make sure the node is positioned absolutely
    updateNodeStyle(nodeId, {
      position: "absolute",
      pointerEvents: "auto",
    });

    // Make sure inViewport flag is false (since it's now on canvas)
    updateNodeFlags(nodeId, { inViewport: false });
  },

  // Restore a detached node to its original parent
  restoreDetachedNode: (nodeId: NodeId) => {
    const currentState = dynamicStore.get(_internalDynamicStateAtom);
    const originalInfo = currentState.originalParents[nodeId];

    if (!originalInfo) {
      console.warn("No original parent information found for:", nodeId);
      return;
    }

    console.log("Restoring node to original parent:", nodeId, originalInfo);

    // First restore the node to its original parent
    if (originalInfo.parentId) {
      moveNode(nodeId, originalInfo.parentId);
    }

    // Restore original positioning and style
    updateNodeStyle(nodeId, {
      position: originalInfo.originalPosition || "",
      left: originalInfo.originalLeft || "",
      top: originalInfo.originalTop || "",
      zIndex: originalInfo.originalZIndex || "",
      pointerEvents: "", // Reset pointer events
    });

    // Restore original viewport flag
    updateNodeFlags(nodeId, { inViewport: originalInfo.inViewport });

    // Mark as no longer detached
    dynamicStore.set(_internalDynamicStateAtom, (prev) => {
      const detachedNodes = new Set(prev.detachedNodes);
      detachedNodes.delete(nodeId);
      return {
        ...prev,
        detachedNodes,
      };
    });
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

  // Restore all nodes to their original parents when exiting dynamic mode
  restoreAllDynamicNodes: () => {
    const state = dynamicStore.get(_internalDynamicStateAtom);

    console.log("Restoring all detached nodes to original parents");

    // Restore all detached nodes
    for (const nodeId of state.detachedNodes) {
      dynamicOperations.restoreDetachedNode(nodeId);
    }

    // Clear out all dynamic mode state
    dynamicStore.set(_internalDynamicStateAtom, (prev) => ({
      ...prev,
      originalParents: {},
      detachedNodes: new Set(),
      dynamicPositions: {},
      storedNodePositions: {},
      dynamicModeNodeId: null,
      activeViewportInDynamicMode: null,
    }));

    console.log("Restored all dynamic mode state");
  },

  // Set dynamic mode with a specific node ID
  setDynamicModeNodeId: (
    nodeId: string | number | null,
    defaultViewportId?: string | number
  ) => {
    const currentNodeId = dynamicStore.get(
      _internalDynamicStateAtom
    ).dynamicModeNodeId;

    // If exiting dynamic mode (current is not null, new one is null)
    if (currentNodeId && !nodeId) {
      console.log("Exiting dynamic mode, restoring all nodes");
      dynamicOperations.restoreAllDynamicNodes();
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

  // Check if a node is currently detached for dynamic mode
  isNodeDetachedForDynamicMode: (nodeId: NodeId) => {
    const state = dynamicStore.get(_internalDynamicStateAtom);
    return state.detachedNodes.has(nodeId);
  },
};

export const dynamicOps = dynamicOperations;

// Add hooks for the new atoms
export const useOriginalParents = () => {
  return useAtomValue(originalParentsAtom, { store: dynamicStore });
};

export const useDetachedNodes = () => {
  return useAtomValue(detachedNodesAtom, { store: dynamicStore });
};

export const useDynamicPositions = () => {
  return useAtomValue(dynamicPositionsAtom, { store: dynamicStore });
};

export const useGetDynamicPositions = () => {
  return useCallback(() => {
    return dynamicStore.get(_internalDynamicStateAtom).dynamicPositions;
  }, []);
};

export const useGetOriginalParents = () => {
  return useCallback(() => {
    return dynamicStore.get(_internalDynamicStateAtom).originalParents;
  }, []);
};

export const useGetDetachedNodes = () => {
  return useCallback(() => {
    return dynamicStore.get(_internalDynamicStateAtom).detachedNodes;
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
