import { atom, createStore } from "jotai/vanilla";
import { atomFamily } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { CSSProperties, useCallback } from "react";
import { NodeState } from "@/builder/reducer/nodeDispatcher";
import { unstable_batchedUpdates } from "react-dom";
import {
  childrenMapAtom,
  hierarchyStore,
  parentMapAtom,
} from "./hierarchy-store";

export type NodeId = string | number;

export interface Position {
  x: number;
  y: number;
}

export interface VariantInfo {
  name: string;
  id: string;
}

export interface NodeBasics {
  id: NodeId;
  type: "frame" | "image" | "text" | "placeholder" | string;
  customName?: string;
}

export interface NodeStyle extends CSSProperties {
  src?: string;
  text?: string;
  backgroundImage?: string;
  isVideoBackground?: boolean;
  backgroundVideo?: string;
  isAbsoluteInFrame?: string;
  isFakeFixed?: string;
}

export interface NodeDynamicState {
  hovered?: NodeStyle;
}

export interface NodeFlags {
  isLocked?: boolean;
  inViewport?: boolean;
  isViewport?: boolean;
  viewportName?: string;
  viewportWidth?: number;
  isDynamic?: boolean;
  isAbsoluteInFrame?: boolean;
  isFixedInFrame?: boolean;
  isVariant?: boolean;
}

export interface NodeSyncFlags {
  independentStyles?: Record<string, boolean>;
  unsyncFromParentViewport?: Record<string, boolean>;
  variantIndependentSync?: Record<string, boolean>;
  lowerSyncProps?: Record<string, boolean>;
}

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

export interface NodeVariantInfo {
  variantParentId?: NodeId;
  variantInfo?: VariantInfo;
  variantResponsiveId?: string;
}

export interface NodeSharedInfo {
  sharedId?: string;
}

export const nodeStore = createStore();

export const nodeIdsAtom = atom<NodeId[]>([]);

export const changedNodesAtom = atom<Set<NodeId>>(new Set());

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

export const nodeBasicsAtom = atomFamily((id: NodeId) =>
  atom<NodeBasics>({
    id: id,
    type: "frame",
  })
);

export const nodeStyleAtom = atomFamily((id: NodeId) => atom<NodeStyle>({}));

export const nodeDynamicStateAtom = atomFamily((id: NodeId) =>
  atom<NodeDynamicState>({})
);

export const nodeFlagsAtom = atomFamily((id: NodeId) =>
  atom<NodeFlags>({
    inViewport: true,
  })
);

export function getCurrentNodes() {
  const nodeState = nodeStore.get(nodeStateAtom);
  return nodeState.nodes;
}

/**
 * Get a subset of the node state for use in drag operations
 * Avoids passing the entire node state when only nodes are needed
 */
export function getNodeStateForDrag() {
  return {
    nodes: getCurrentNodes(),
  };
}

export const nodeSyncFlagsAtom = atomFamily((id: NodeId) =>
  atom<NodeSyncFlags>({
    independentStyles: {},
    unsyncFromParentViewport: {},
    variantIndependentSync: {},
    lowerSyncProps: {},
  })
);

export const nodeParentAtom = atomFamily((id: NodeId) =>
  atom<NodeId | null>(null)
);

export const nodeSharedInfoAtom = atomFamily((id: NodeId) =>
  atom<NodeSharedInfo>({})
);

export const nodeDynamicInfoAtom = atomFamily((id: NodeId) =>
  atom<NodeDynamicInfo>({})
);

export const nodeVariantInfoAtom = atomFamily((id: NodeId) =>
  atom<NodeVariantInfo>({})
);

export const viewportOrderAtom = atom((get) => {
  const nodeIds = get(nodeIdsAtom);

  const viewports = [];
  for (const id of nodeIds) {
    const flags = get(nodeFlagsAtom(id));
    if (flags.isViewport) {
      viewports.push({ id, width: flags.viewportWidth || 0 });
    }
  }

  viewports.sort((a, b) => b.width - a.width);

  return viewports.map((v) => v.id);
});

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

export const viewportRootsAtom = atom((get) => {
  const nodeIds = get(nodeIdsAtom);
  const roots = new Map<NodeId, Set<NodeId>>();

  const viewportIds = [];
  for (const id of nodeIds) {
    const flags = get(nodeFlagsAtom(id));
    if (flags.isViewport) {
      viewportIds.push(id);
      roots.set(id, new Set());
    }
  }

  for (const id of nodeIds) {
    const parentId = get(nodeParentAtom(id));
    if (parentId && roots.has(parentId)) {
      roots.get(parentId)?.add(id);
    }
  }

  return roots;
});

export const nodesInViewportAtom = atomFamily((viewportId: NodeId) =>
  atom((get) => {
    const nodeIds = get(nodeIdsAtom);
    const result = new Set<NodeId>();

    const isInViewport = (nodeId: NodeId): boolean => {
      const parentId = get(nodeParentAtom(nodeId));
      if (parentId === viewportId) return true;
      if (parentId === null) return false;

      return isInViewport(parentId);
    };

    for (const id of nodeIds) {
      if (isInViewport(id)) {
        result.add(id);
      }
    }

    return result;
  })
);

export const nodeStateAtom = atom((get) => {
  const nodeIds = get(nodeIdsAtom);
  const nodes = [];

  for (const id of nodeIds) {
    const basics = get(nodeBasicsAtom(id));
    const style = get(nodeStyleAtom(id));
    const flags = get(nodeFlagsAtom(id));
    const parentId = get(nodeParentAtom(id));
    const sharedInfo = get(nodeSharedInfoAtom(id));
    const dynamicInfo = get(nodeDynamicInfoAtom(id));
    const variantInfo = get(nodeVariantInfoAtom(id));
    const syncFlags = get(nodeSyncFlagsAtom(id));

    nodes.push({
      ...basics,
      style,
      ...flags,
      parentId,
      ...sharedInfo,
      ...dynamicInfo,
      ...variantInfo,
      ...syncFlags,
    });
  }

  return {
    nodes,
  };
});

export function batchNodeUpdates(callback: () => void) {
  unstable_batchedUpdates(callback);
}

export const useNodeBasics = (id: NodeId) => {
  return useAtomValue(nodeBasicsAtom(id), { store: nodeStore });
};

export const useUpdateNodeBasics = (id: NodeId) => {
  return useSetAtom(nodeBasicsAtom(id), { store: nodeStore });
};

export const useNodeStyle = (id: NodeId) => {
  return useAtomValue(nodeStyleAtom(id), { store: nodeStore });
};

export const useUpdateNodeStyle = (id: NodeId) => {
  return useSetAtom(nodeStyleAtom(id), { store: nodeStore });
};

export const useNodeDynamicState = (id: NodeId) => {
  return useAtomValue(nodeDynamicStateAtom(id), { store: nodeStore });
};

export const useUpdateNodeDynamicState = (id: NodeId) => {
  return useSetAtom(nodeDynamicStateAtom(id), { store: nodeStore });
};

export const useNodeFlags = (id: NodeId) => {
  return useAtomValue(nodeFlagsAtom(id), { store: nodeStore });
};

export const useUpdateNodeFlags = (id: NodeId) => {
  return useSetAtom(nodeFlagsAtom(id), { store: nodeStore });
};

export const useNodeSyncFlags = (id: NodeId) => {
  return useAtomValue(nodeSyncFlagsAtom(id), { store: nodeStore });
};

export const useUpdateNodeSyncFlags = (id: NodeId) => {
  return useSetAtom(nodeSyncFlagsAtom(id), { store: nodeStore });
};

export const useNodeParent = (id: NodeId) => {
  return useAtomValue(nodeParentAtom(id), { store: nodeStore });
};

export const useUpdateNodeParent = (id: NodeId) => {
  return useSetAtom(nodeParentAtom(id), { store: nodeStore });
};

export const useNodeSharedInfo = (id: NodeId) => {
  return useAtomValue(nodeSharedInfoAtom(id), { store: nodeStore });
};

export const useUpdateNodeSharedInfo = (id: NodeId) => {
  return useSetAtom(nodeSharedInfoAtom(id), { store: nodeStore });
};

export const useNodeDynamicInfo = (id: NodeId) => {
  return useAtomValue(nodeDynamicInfoAtom(id), { store: nodeStore });
};

export const useUpdateNodeDynamicInfo = (id: NodeId) => {
  return useSetAtom(nodeDynamicInfoAtom(id), { store: nodeStore });
};

export const useNodeVariantInfo = (id: NodeId) => {
  return useAtomValue(nodeVariantInfoAtom(id), { store: nodeStore });
};

export const useUpdateNodeVariantInfo = (id: NodeId) => {
  return useSetAtom(nodeVariantInfoAtom(id), { store: nodeStore });
};

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

export const useNodeState = () => {
  return useAtomValue(nodeStateAtom, { store: nodeStore });
};

export const useGetSharedNodes = () => {
  return useCallback((sharedId: string): NodeId[] => {
    const buckets = nodeStore.get(sharedIdBucketsAtom);
    return buckets.has(sharedId) ? Array.from(buckets.get(sharedId) || []) : [];
  }, []);
};

export const useGetNodeBasics = () => {
  return useCallback((id: NodeId): NodeBasics => {
    return nodeStore.get(nodeBasicsAtom(id));
  }, []);
};

export const useGetNodeStyle = () => {
  return useCallback((id: NodeId): NodeStyle => {
    return nodeStore.get(nodeStyleAtom(id));
  }, []);
};

export const useGetNodeFlags = () => {
  return useCallback((id: NodeId): NodeFlags => {
    return nodeStore.get(nodeFlagsAtom(id));
  }, []);
};

export const useGetNodeParent = () => {
  return useCallback((id: NodeId): NodeId | null => {
    return nodeStore.get(nodeParentAtom(id));
  }, []);
};

export const useGetNodeIds = () => {
  return useCallback((): NodeId[] => {
    return nodeStore.get(nodeIdsAtom);
  }, []);
};

export const useGetChangedNodes = () => {
  return useCallback((): Set<NodeId> => {
    return nodeStore.get(changedNodesAtom);
  }, []);
};

export const useNodeIds = () => {
  return useAtomValue(nodeIdsAtom, { store: nodeStore });
};

export const useGetNodeSharedInfo = () => {
  return useCallback((id: NodeId): NodeSharedInfo => {
    return nodeStore.get(nodeSharedInfoAtom(id));
  }, []);
};

export const useGetNodeDynamicInfo = () => {
  return useCallback((id: NodeId): NodeDynamicInfo => {
    return nodeStore.get(nodeDynamicInfoAtom(id));
  }, []);
};

export const useGetNodeVariantInfo = () => {
  return useCallback((id: NodeId): NodeVariantInfo => {
    return nodeStore.get(nodeVariantInfoAtom(id));
  }, []);
};

export const useGetNodeSyncFlags = () => {
  return useCallback((id: NodeId): NodeSyncFlags => {
    return nodeStore.get(nodeSyncFlagsAtom(id));
  }, []);
};

export const useGetNodeDynamicState = () => {
  return useCallback((id: NodeId): NodeDynamicState => {
    return nodeStore.get(nodeDynamicStateAtom(id));
  }, []);
};

export function useGetNodesForDrag() {
  const getAllNodes = useGetAllNodes();

  return useCallback(() => {
    return {
      nodes: getAllNodes(),
    };
  }, [getAllNodes]);
}

export const useGetNode = () => {
  return useCallback((id: NodeId) => {
    const basics = nodeStore.get(nodeBasicsAtom(id));
    const style = nodeStore.get(nodeStyleAtom(id));
    const flags = nodeStore.get(nodeFlagsAtom(id));
    const parentId = nodeStore.get(nodeParentAtom(id));
    const sharedInfo = nodeStore.get(nodeSharedInfoAtom(id));
    const dynamicInfo = nodeStore.get(nodeDynamicInfoAtom(id));
    const variantInfo = nodeStore.get(nodeVariantInfoAtom(id));
    const syncFlags = nodeStore.get(nodeSyncFlagsAtom(id));

    return {
      ...basics,
      style,
      ...flags,
      parentId,
      ...sharedInfo,
      ...dynamicInfo,
      ...variantInfo,
      ...syncFlags,
    };
  }, []);
};

export const useGetAllNodes = () => {
  return useCallback(() => {
    const nodeIds = nodeStore.get(nodeIdsAtom);
    return nodeIds.map((id) => {
      const basics = nodeStore.get(nodeBasicsAtom(id));
      const style = nodeStore.get(nodeStyleAtom(id));
      const flags = nodeStore.get(nodeFlagsAtom(id));
      const parentId = nodeStore.get(nodeParentAtom(id));
      const sharedInfo = nodeStore.get(nodeSharedInfoAtom(id));
      const dynamicInfo = nodeStore.get(nodeDynamicInfoAtom(id));
      const variantInfo = nodeStore.get(nodeVariantInfoAtom(id));
      const syncFlags = nodeStore.get(nodeSyncFlagsAtom(id));

      return {
        ...basics,
        style,
        ...flags,
        parentId,
        ...sharedInfo,
        ...dynamicInfo,
        ...variantInfo,
        ...syncFlags,
      };
    });
  }, []);
};

nodeStore.set(nodeIdsAtom, []);
nodeStore.set(changedNodesAtom, new Set());

export function initNodeStateFromInitialState(initialState: NodeState) {
  const nodeIds = initialState.nodes.map((node) => node.id);
  nodeStore.set(nodeIdsAtom, nodeIds);

  const childrenMap = new Map<NodeId | null, NodeId[]>();
  const parentMap = new Map<NodeId, NodeId | null>();

  childrenMap.set(null, []);

  initialState.nodes.forEach((node) => {});

  initialState.nodes.forEach((node, index) => {
    nodeStore.set(nodeBasicsAtom(node.id), {
      id: node.id,
      type: node.type,
      customName: node.customName,
    });

    nodeStore.set(nodeStyleAtom(node.id), node.style || {});

    const flags = {
      isLocked: node.isLocked,
      inViewport: node.inViewport !== false,
      isViewport: node.isViewport,
      viewportName: node.viewportName,
      viewportWidth: node.viewportWidth,
      isDynamic: node.isDynamic,
      isAbsoluteInFrame: node.isAbsoluteInFrame,
      isFixedInFrame: node.isFixedInFrame,
      isVariant: node.isVariant,
    };
    nodeStore.set(nodeFlagsAtom(node.id), flags);

    const parentId = node.parentId || null;
    nodeStore.set(nodeParentAtom(node.id), parentId);

    parentMap.set(node.id, parentId);

    if (!childrenMap.has(node.id)) {
      childrenMap.set(node.id, []);
    }

    if (parentId === null) {
      childrenMap.get(null)!.push(node.id);
    } else {
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }

      childrenMap.get(parentId)!.push(node.id);
    }

    if (node.sharedId) {
      nodeStore.set(nodeSharedInfoAtom(node.id), { sharedId: node.sharedId });
    }

    if (node.dynamicState) {
      nodeStore.set(nodeDynamicStateAtom(node.id), node.dynamicState);
    }

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

    const variantInfo = {
      variantParentId: node.variantParentId,
      variantInfo: node.variantInfo,
      variantResponsiveId: node.variantResponsiveId,
    };

    if (Object.values(variantInfo).some((val) => val !== undefined)) {
      nodeStore.set(nodeVariantInfoAtom(node.id), variantInfo);
    }

    nodeStore.set(nodeSyncFlagsAtom(node.id), {
      independentStyles: node.syncFlags?.independentStyles || {},
      unsyncFromParentViewport: node.syncFlags?.unsyncFromParentViewport || {},
      variantIndependentSync: node.syncFlags?.variantIndependentSync || {},
      lowerSyncProps: node.syncFlags?.lowerSyncProps || {},
    });
  });

  hierarchyStore.set(childrenMapAtom, childrenMap);
  hierarchyStore.set(parentMapAtom, parentMap);

  childrenMap.forEach((children, parent) => {
    if (parent !== null) {
      const parentNode = initialState.nodes.find((n) => n.id === parent);
      const parentType = parentNode?.type || "unknown";
      children.forEach((childId) => {
        const childNode = initialState.nodes.find((n) => n.id === childId);
        const childType = childNode?.type || "unknown";
      });
    }
  });

  const testCases = [
    {
      parent: "viewport-1440",
      expectedChildren: [
        "ez4VLzf45AS_tp7IoalXo",
        "gmzB5qAqsN86mljbgWz5D",
        "ThirdFrame_1440",
        "FourthFrame_1440",
      ],
    },
    { parent: "ThirdFrame_1440", expectedChildren: ["ThirdFrameImage_1440"] },
    { parent: "FourthFrame_1440", expectedChildren: ["NestedFrame_1440"] },
    { parent: "NestedFrame_1440", expectedChildren: ["NestedFrameImage_1440"] },
  ];

  testCases.forEach((testCase) => {
    const actualChildren = childrenMap.get(testCase.parent) || [];
    const matching = testCase.expectedChildren.every((child) =>
      actualChildren.includes(child)
    );
    if (!matching) {
    }
  });
}
