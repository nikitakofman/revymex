// src/builder/context/atoms/node-store.ts
import { atom, createStore } from "jotai/vanilla";
import { atomFamily, selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { CSSProperties, useCallback } from "react";
import { NodeState } from "@/builder/reducer/nodeDispatcher";
import { unstable_batchedUpdates } from "react-dom";

// Define type for node ID - can be string or number
export type NodeId = string | number;

// Core interfaces for node properties
// ==================================

export interface Position {
  x: number;
  y: number;
}

export interface VariantInfo {
  name: string;
  id: string;
}

// Basic node properties
export interface NodeBasics {
  id: NodeId;
  type: "frame" | "image" | "text" | "placeholder" | string;
  customName?: string;
}

// Style-related properties
export interface NodeStyle extends CSSProperties {
  src?: string;
  text?: string;
  backgroundImage?: string;
  isVideoBackground?: boolean;
  backgroundVideo?: string;
}

// Dynamic state (e.g., hover effects)
export interface NodeDynamicState {
  hovered?: NodeStyle;
}

// Flag-related properties
export interface NodeFlags {
  isLocked?: boolean;
  inViewport?: boolean;
  isViewport?: boolean;
  viewportName?: string;
  viewportWidth?: number;
  isDynamic?: boolean;
  isAbsoluteInFrame?: boolean;
  isVariant?: boolean;
}

// Sync flags for style independence
export interface NodeSyncFlags {
  independentStyles?: Record<string, boolean>;
  unsyncFromParentViewport?: Record<string, boolean>;
  variantIndependentSync?: Record<string, boolean>;
  lowerSyncProps?: Record<string, boolean>;
}

// Dynamic component information
export interface NodeDynamicInfo {
  dynamicParentId?: NodeId;
  dynamicViewportId?: NodeId;
  dynamicConnections?: {
    sourceId: NodeId;
    targetId: NodeId;
    type: "click" | "hover" | "mouseLeave";
  }[];
  dynamicPosition?: Position;
  dynamicFamilyId?: string;
  originalParentId?: string;
  originalState?: {
    parentId: NodeId | null;
    inViewport: boolean;
  };
}

// Variant-related information
export interface NodeVariantInfo {
  variantParentId?: NodeId;
  variantInfo?: VariantInfo;
  variantResponsiveId?: string;
}

// Shared ID information
export interface NodeSharedInfo {
  sharedId?: string;
}

// Create a separate store for nodes
export const nodeStore = createStore();

// Base atoms
// ==================================

// List of all node IDs in the store
export const nodeIdsAtom = atom<NodeId[]>([]);

// Tracking changed nodes (for optimizations)
export const changedNodesAtom = atom<Set<NodeId>>(new Set());

// Metadata about node operations
export const nodeMetadataAtom = atom<{
  lastAddedNodeInfo?: {
    nodeId: NodeId;
    sharedId: string;
    parentId: NodeId | null;
    position: string;
    targetId: NodeId;
    exactIndex: number;
    viewportInfo: {
      sourceViewport: NodeId | null;
    };
  };
}>({});

// Granular atom families
// ==================================

// Atom family for basic node properties
export const nodeBasicsAtom = atomFamily((id: NodeId) =>
  atom<NodeBasics>({
    id: id,
    type: "frame", // Default type
  })
);

// Atom family for node styles
export const nodeStyleAtom = atomFamily((id: NodeId) => atom<NodeStyle>({}));

// Atom family for dynamic state
export const nodeDynamicStateAtom = atomFamily((id: NodeId) =>
  atom<NodeDynamicState>({})
);

// Atom family for node flags
export const nodeFlagsAtom = atomFamily((id: NodeId) =>
  atom<NodeFlags>({
    inViewport: true, // Default to true
  })
);

// Atom family for sync flags
export const nodeSyncFlagsAtom = atomFamily((id: NodeId) =>
  atom<NodeSyncFlags>({
    independentStyles: {},
    unsyncFromParentViewport: {},
    variantIndependentSync: {},
    lowerSyncProps: {},
  })
);

// Atom family for parent-child relationships
export const nodeParentAtom = atomFamily((id: NodeId) =>
  atom<NodeId | null>(null)
);

// Atom family for shared information
export const nodeSharedInfoAtom = atomFamily((id: NodeId) =>
  atom<NodeSharedInfo>({})
);

// Atom family for dynamic information
export const nodeDynamicInfoAtom = atomFamily((id: NodeId) =>
  atom<NodeDynamicInfo>({})
);

// Atom family for variant information
export const nodeVariantInfoAtom = atomFamily((id: NodeId) =>
  atom<NodeVariantInfo>({})
);

// Derived atoms for relationships and indexing
// ==================================

// Atom family for children of a node (derived from parent relationships)
export const nodeChildrenAtom = atomFamily((parentId: NodeId | null) =>
  selectAtom(nodeIdsAtom, (ids) => {
    // Filter nodes that have this parent
    return ids.filter((id) => {
      // Access nodeParentAtom directly from store to avoid circular dependency
      const parent = nodeStore.get(nodeParentAtom(id));
      return parent === parentId;
    });
  })
);

// Index/position of a child within its parent's children
export const nodeOrderAtom = atomFamily((id: NodeId) =>
  atom((get) => {
    const parentId = get(nodeParentAtom(id));
    if (parentId === null) return 0;

    const siblings = get(nodeChildrenAtom(parentId));
    return siblings.indexOf(id);
  })
);

// Viewports in order (desktop to mobile)
export const viewportOrderAtom = atom((get) => {
  const nodeIds = get(nodeIdsAtom);

  // Get all viewport nodes and sort by width (descending)
  const viewports = [];
  for (const id of nodeIds) {
    const flags = get(nodeFlagsAtom(id));
    if (flags.isViewport) {
      viewports.push({ id, width: flags.viewportWidth || 0 });
    }
  }

  // Sort by width (descending)
  viewports.sort((a, b) => b.width - a.width);

  return viewports.map((v) => v.id);
});

// Shared ID buckets - maps sharedId to set of node IDs
export const sharedIdBucketsAtom = atom((get) => {
  const nodeIds = get(nodeIdsAtom);
  const buckets = new Map<string, Set<NodeId>>();

  for (const id of nodeIds) {
    const sharedInfo = get(nodeSharedInfoAtom(id));
    if (sharedInfo.sharedId) {
      if (!buckets.has(sharedInfo.sharedId)) {
        buckets.set(sharedInfo.sharedId, new Set());
      }
      buckets.get(sharedInfo.sharedId)?.add(id);
    }
  }

  return buckets;
});

// Dynamic family index - maps familyId to set of node IDs
export const dynamicFamilyIndexAtom = atom((get) => {
  const nodeIds = get(nodeIdsAtom);
  const index = new Map<string, Set<NodeId>>();

  for (const id of nodeIds) {
    const dynamicInfo = get(nodeDynamicInfoAtom(id));
    if (dynamicInfo.dynamicFamilyId) {
      if (!index.has(dynamicInfo.dynamicFamilyId)) {
        index.set(dynamicInfo.dynamicFamilyId, new Set());
      }
      index.get(dynamicInfo.dynamicFamilyId)?.add(id);
    }
  }

  return index;
});

// Viewport roots - maps viewportId to children IDs
export const viewportRootsAtom = atom((get) => {
  const nodeIds = get(nodeIdsAtom);
  const roots = new Map<NodeId, Set<NodeId>>();

  // First collect viewport nodes
  const viewportIds = [];
  for (const id of nodeIds) {
    const flags = get(nodeFlagsAtom(id));
    if (flags.isViewport) {
      viewportIds.push(id);
      roots.set(id, new Set());
    }
  }

  // Then collect direct children of each viewport
  for (const id of nodeIds) {
    const parentId = get(nodeParentAtom(id));
    if (parentId && roots.has(parentId)) {
      roots.get(parentId)?.add(id);
    }
  }

  return roots;
});

// Get nodes in a specific viewport
export const nodesInViewportAtom = atomFamily((viewportId: NodeId) =>
  atom((get) => {
    const nodeIds = get(nodeIdsAtom);
    const result = new Set<NodeId>();

    // Helper function to check if a node is in this viewport
    const isInViewport = (nodeId: NodeId): boolean => {
      const parentId = get(nodeParentAtom(nodeId));
      if (parentId === viewportId) return true;
      if (parentId === null) return false;

      return isInViewport(parentId);
    };

    // Collect all nodes in this viewport
    for (const id of nodeIds) {
      if (isInViewport(id)) {
        result.add(id);
      }
    }

    return result;
  })
);

// Batch update utilities
// ==================================

// Batch node updates
export function batchNodeUpdates(callback: () => void) {
  unstable_batchedUpdates(callback);
}

// Hooks for components
// ==================================

// Basic properties hooks
export const useNodeBasics = (id: NodeId) => {
  return useAtomValue(nodeBasicsAtom(id), { store: nodeStore });
};

export const useUpdateNodeBasics = (id: NodeId) => {
  return useSetAtom(nodeBasicsAtom(id), { store: nodeStore });
};

// Style hooks
export const useNodeStyle = (id: NodeId) => {
  return useAtomValue(nodeStyleAtom(id), { store: nodeStore });
};

export const useUpdateNodeStyle = (id: NodeId) => {
  return useSetAtom(nodeStyleAtom(id), { store: nodeStore });
};

// Dynamic state hooks
export const useNodeDynamicState = (id: NodeId) => {
  return useAtomValue(nodeDynamicStateAtom(id), { store: nodeStore });
};

export const useUpdateNodeDynamicState = (id: NodeId) => {
  return useSetAtom(nodeDynamicStateAtom(id), { store: nodeStore });
};

// Flag hooks
export const useNodeFlags = (id: NodeId) => {
  return useAtomValue(nodeFlagsAtom(id), { store: nodeStore });
};

export const useUpdateNodeFlags = (id: NodeId) => {
  return useSetAtom(nodeFlagsAtom(id), { store: nodeStore });
};

// Sync flag hooks
export const useNodeSyncFlags = (id: NodeId) => {
  return useAtomValue(nodeSyncFlagsAtom(id), { store: nodeStore });
};

export const useUpdateNodeSyncFlags = (id: NodeId) => {
  return useSetAtom(nodeSyncFlagsAtom(id), { store: nodeStore });
};

// Parent-child relationship hooks
export const useNodeParent = (id: NodeId) => {
  return useAtomValue(nodeParentAtom(id), { store: nodeStore });
};

export const useUpdateNodeParent = (id: NodeId) => {
  return useSetAtom(nodeParentAtom(id), { store: nodeStore });
};

export const useNodeChildren = (parentId: NodeId | null) => {
  return useAtomValue(nodeChildrenAtom(parentId), { store: nodeStore });
};

// Order hooks
export const useNodeOrder = (id: NodeId) => {
  return useAtomValue(nodeOrderAtom(id), { store: nodeStore });
};

// Shared info hooks
export const useNodeSharedInfo = (id: NodeId) => {
  return useAtomValue(nodeSharedInfoAtom(id), { store: nodeStore });
};

export const useUpdateNodeSharedInfo = (id: NodeId) => {
  return useSetAtom(nodeSharedInfoAtom(id), { store: nodeStore });
};

// Dynamic info hooks
export const useNodeDynamicInfo = (id: NodeId) => {
  return useAtomValue(nodeDynamicInfoAtom(id), { store: nodeStore });
};

export const useUpdateNodeDynamicInfo = (id: NodeId) => {
  return useSetAtom(nodeDynamicInfoAtom(id), { store: nodeStore });
};

// Variant info hooks
export const useNodeVariantInfo = (id: NodeId) => {
  return useAtomValue(nodeVariantInfoAtom(id), { store: nodeStore });
};

export const useUpdateNodeVariantInfo = (id: NodeId) => {
  return useSetAtom(nodeVariantInfoAtom(id), { store: nodeStore });
};

// Hooks for derived atoms
export const useViewportOrder = () => {
  return useAtomValue(viewportOrderAtom, { store: nodeStore });
};

export const useSharedIdBuckets = () => {
  return useAtomValue(sharedIdBucketsAtom, { store: nodeStore });
};

export const useDynamicFamilyIndex = () => {
  return useAtomValue(dynamicFamilyIndexAtom, { store: nodeStore });
};

export const useViewportRoots = () => {
  return useAtomValue(viewportRootsAtom, { store: nodeStore });
};

export const useNodesInViewport = (viewportId: NodeId) => {
  return useAtomValue(nodesInViewportAtom(viewportId), { store: nodeStore });
};

// Non-reactive getter functions - won't cause re-renders
export const useGetNodeBasics = () => {
  return useCallback((id: NodeId) => {
    return nodeStore.get(nodeBasicsAtom(id));
  }, []);
};

export const useGetNodeStyle = () => {
  return useCallback((id: NodeId) => {
    return nodeStore.get(nodeStyleAtom(id));
  }, []);
};

export const useGetNodeFlags = () => {
  return useCallback((id: NodeId) => {
    return nodeStore.get(nodeFlagsAtom(id));
  }, []);
};

export const useGetNodeParent = () => {
  return useCallback((id: NodeId) => {
    return nodeStore.get(nodeParentAtom(id));
  }, []);
};

export const useGetNodeChildren = () => {
  return useCallback((parentId: NodeId | null) => {
    return nodeStore.get(nodeChildrenAtom(parentId));
  }, []);
};

export const useGetNodeIds = () => {
  return useCallback(() => {
    return nodeStore.get(nodeIdsAtom);
  }, []);
};

export const useGetChangedNodes = () => {
  return useCallback(() => {
    return nodeStore.get(changedNodesAtom);
  }, []);
};

export const useNodeIds = () => {
  return useAtomValue(nodeIdsAtom, { store: nodeStore });
};

// Get node shared info (non-reactive)
export const useGetNodeSharedInfo = () => {
  return useCallback((id: NodeId) => {
    return nodeStore.get(nodeSharedInfoAtom(id));
  }, []);
};

// Get node dynamic info (non-reactive)
export const useGetNodeDynamicInfo = () => {
  return useCallback((id: NodeId) => {
    return nodeStore.get(nodeDynamicInfoAtom(id));
  }, []);
};

// Get node variant info (non-reactive)
export const useGetNodeVariantInfo = () => {
  return useCallback((id: NodeId) => {
    return nodeStore.get(nodeVariantInfoAtom(id));
  }, []);
};

// Get node sync flags (non-reactive)
export const useGetNodeSyncFlags = () => {
  return useCallback((id: NodeId) => {
    return nodeStore.get(nodeSyncFlagsAtom(id));
  }, []);
};

// Get node dynamic state (non-reactive)
export const useGetNodeDynamicState = () => {
  return useCallback((id: NodeId) => {
    return nodeStore.get(nodeDynamicStateAtom(id));
  }, []);
};

// Initialize the store
nodeStore.set(nodeIdsAtom, []);
nodeStore.set(changedNodesAtom, new Set());

export function initNodeStateFromInitialState(initialState: NodeState) {
  // Add node IDs to the store
  nodeStore.set(
    nodeIdsAtom,
    initialState.nodes.map((node) => node.id)
  );

  // Initialize each node's atoms
  initialState.nodes.forEach((node) => {
    // Basics
    nodeStore.set(nodeBasicsAtom(node.id), {
      id: node.id,
      type: node.type,
      customName: node.customName,
    });

    // Style
    nodeStore.set(nodeStyleAtom(node.id), node.style || {});

    // Flags
    nodeStore.set(nodeFlagsAtom(node.id), {
      isLocked: node.isLocked,
      inViewport: node.inViewport !== false,
      isViewport: node.isViewport,
      viewportName: node.viewportName,
      viewportWidth: node.viewportWidth,
      isDynamic: node.isDynamic,
      isAbsoluteInFrame: node.isAbsoluteInFrame,
      isVariant: node.isVariant,
    });

    // Parent
    nodeStore.set(nodeParentAtom(node.id), node.parentId || null);

    // Shared info
    if (node.sharedId) {
      nodeStore.set(nodeSharedInfoAtom(node.id), { sharedId: node.sharedId });
    }

    // Dynamic state
    if (node.dynamicState) {
      nodeStore.set(nodeDynamicStateAtom(node.id), node.dynamicState);
    }

    // Dynamic info
    const dynamicInfo = {
      dynamicParentId: node.dynamicParentId,
      dynamicViewportId: node.dynamicViewportId,
      dynamicConnections: node.dynamicConnections,
      dynamicPosition: node.dynamicPosition,
      dynamicFamilyId: node.dynamicFamilyId,
      originalParentId: node.originalParentId,
      originalState: node.originalState,
    };

    if (Object.values(dynamicInfo).some((val) => val !== undefined)) {
      nodeStore.set(nodeDynamicInfoAtom(node.id), dynamicInfo);
    }

    // Variant info
    const variantInfo = {
      variantParentId: node.variantParentId,
      variantInfo: node.variantInfo,
      variantResponsiveId: node.variantResponsiveId,
    };

    if (Object.values(variantInfo).some((val) => val !== undefined)) {
      nodeStore.set(nodeVariantInfoAtom(node.id), variantInfo);
    }

    // Sync flags
    nodeStore.set(nodeSyncFlagsAtom(node.id), {
      independentStyles: node.independentStyles || {},
      unsyncFromParentViewport: node.unsyncFromParentViewport || {},
      variantIndependentSync: node.variantIndependentSync || {},
      lowerSyncProps: node.lowerSyncProps || {},
    });
  });
}
