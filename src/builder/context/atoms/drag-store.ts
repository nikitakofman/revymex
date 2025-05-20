import { atom, createStore } from "jotai/vanilla";
import { selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Node } from "../../reducer/nodeDispatcher";
import { NodeId } from "./node-store";

export const dragStore = createStore();

export interface Offset {
  x: number;
  y: number;
  mouseX: number;
  mouseY: number;
  width?: number;
  height?: number;
  rotate?: string;
  isSimpleRotation?: boolean;
  nodeType?: string;
  placeholderId?: string | null;
  startingParentId?: string | null;
  dimensionUnits?: any;
  isAbsoluteInFrame?: boolean;
  originalPositionType?: string;
  initialPosition?: {
    left: number;
    top: number;
  };
  parentRotation?: number;
  elementQuery?: object;
}

export interface DraggedNodeInfo {
  node: Node;
  offset: Offset;
}

export interface PlaceholderInfo {
  mainPlaceholderId: string;
  nodeOrder: string[];
  additionalPlaceholders: Array<{
    placeholderId: string;
    nodeId: string;
  }>;
  targetId: string;
  position: "before" | "after" | "inside";
  x?: number;
  y?: number;
}

export interface DropInfo {
  targetId: string | number | null;
  position: "before" | "after" | "inside" | null;
  dropX?: number;
  dropY?: number;
}

export interface DragBackToParentInfo {
  isDraggingBackToParent: boolean;
  originalParentId: NodeId | null;
  draggedNodesOriginalIndices: Map<NodeId, number>;
}

export interface DragState {
  isDragging: boolean;
  isOverCanvas: boolean;
  draggedNodes: Array<{
    node: Node;
    offset: Offset;
  }>;
  draggedItem: string | null;
  dropInfo: DropInfo | null;
  lastMouseX: number;
  lastMouseY: number;
  dragSource:
    | "canvas"
    | "viewport"
    | "toolbar"
    | "parent"
    | "dynamic"
    | "absolute-in-frame"
    | null;
  dragPositions: { x: number; y: number } | null;
  placeholderInfo: PlaceholderInfo | null;
  nodeDimensions: Record<
    string,
    {
      width: string;
      height: string;
      isFillMode: boolean;
      finalWidth: string;
      finalHeight: string;
    }
  >;
  dynamicModeNodeId: string | null;
  duplicatedFromAlt: boolean;
  recordingSessionId: string | null;

  dragBackToParentInfo: DragBackToParentInfo;
}

const initialDragState: DragState = {
  isDragging: false,
  isOverCanvas: false,
  draggedNodes: [],
  draggedItem: null,
  dropInfo: null,
  lastMouseX: 0,
  lastMouseY: 0,
  dragSource: null,
  dragPositions: null,
  placeholderInfo: null,
  nodeDimensions: {},
  dynamicModeNodeId: null,
  duplicatedFromAlt: false,
  recordingSessionId: null,

  dragBackToParentInfo: {
    isDraggingBackToParent: false,
    originalParentId: null,
    draggedNodesOriginalIndices: new Map(),
  },
};

export const _internalDragStateAtom = atom<DragState>(initialDragState);

export const isDraggingAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.isDragging
);

export const isOverCanvasAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.isOverCanvas
);

export const draggedNodesAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.draggedNodes
);

export const dragBackToParentInfoAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.dragBackToParentInfo
);

export const isDraggingBackToParentAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.dragBackToParentInfo.isDraggingBackToParent
);

export const originalParentIdAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.dragBackToParentInfo.originalParentId
);

export const draggedNodesOriginalIndicesAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.dragBackToParentInfo.draggedNodesOriginalIndices
);

export const primaryDraggedNodeAtom = selectAtom(
  _internalDragStateAtom,
  (state) => (state.draggedNodes.length > 0 ? state.draggedNodes[0] : null)
);

export const draggedItemAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.draggedItem
);

export const dropInfoAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.dropInfo
);

export const lastMousePositionAtom = selectAtom(
  _internalDragStateAtom,
  (state) => ({ x: state.lastMouseX, y: state.lastMouseY })
);

export const dragSourceAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.dragSource
);

export const dragPositionsAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.dragPositions
);

export const placeholderInfoAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.placeholderInfo
);

export const nodeDimensionsAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.nodeDimensions
);

export const duplicatedFromAltAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.duplicatedFromAlt
);

export const recordingSessionIdAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.recordingSessionId
);

const dragOperations = {
  setIsDragging: (isDragging: boolean) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      isDragging,
    }));
  },

  setIsOverCanvas: (isOverCanvas: boolean) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      isOverCanvas,
    }));
  },

  setPartialDragState: (state: Partial<DragState>) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      ...state,
    }));
  },

  setDraggedNodes: (
    nodes: Array<{
      node: Node;
      offset: Offset;
    }>
  ) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      draggedNodes: nodes,
    }));
  },

  setDragBackToParentInfo: (info: Partial<DragBackToParentInfo>) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      dragBackToParentInfo: {
        ...prev.dragBackToParentInfo,
        ...info,
      },
    }));
  },

  setIsDraggingBackToParent: (isDraggingBackToParent: boolean) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      dragBackToParentInfo: {
        ...prev.dragBackToParentInfo,
        isDraggingBackToParent,
      },
    }));
  },

  setOriginalParentId: (originalParentId: NodeId | null) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      dragBackToParentInfo: {
        ...prev.dragBackToParentInfo,
        originalParentId,
      },
    }));
  },

  setDraggedNodesOriginalIndices: (indices: Map<NodeId, number>) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      dragBackToParentInfo: {
        ...prev.dragBackToParentInfo,
        draggedNodesOriginalIndices: indices,
      },
    }));
  },

  addDraggedNodeOriginalIndex: (nodeId: NodeId, index: number) => {
    dragStore.set(_internalDragStateAtom, (prev) => {
      const newIndices = new Map(
        prev.dragBackToParentInfo.draggedNodesOriginalIndices
      );
      newIndices.set(nodeId, index);
      return {
        ...prev,
        dragBackToParentInfo: {
          ...prev.dragBackToParentInfo,
          draggedNodesOriginalIndices: newIndices,
        },
      };
    });
  },

  resetDragBackToParentInfo: () => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      dragBackToParentInfo: {
        isDraggingBackToParent: false,
        originalParentId: null,
        draggedNodesOriginalIndices: new Map(),
      },
    }));
  },

  setDraggedNode: (node: Node, offset: Offset) => {
    dragStore.set(_internalDragStateAtom, (prev) => {
      const newDraggedNodes = [...prev.draggedNodes];

      if (newDraggedNodes.length === 0) {
        newDraggedNodes.push({ node, offset });
      } else {
        newDraggedNodes[0] = { node, offset };
      }

      return {
        ...prev,
        draggedNodes: newDraggedNodes,
      };
    });
  },

  setAdditionalDraggedNodes: (
    nodes: Array<{
      node: Node;
      offset: Offset;
    }>
  ) => {
    dragStore.set(_internalDragStateAtom, (prev) => {
      if (prev.draggedNodes.length === 0) {
        return prev;
      }

      return {
        ...prev,
        draggedNodes: [prev.draggedNodes[0], ...nodes],
      };
    });
  },

  addDraggedNode: (node: Node, offset: Offset) => {
    dragStore.set(_internalDragStateAtom, (prev) => {
      const existingIndex = prev.draggedNodes.findIndex(
        (item) => item.node.id === node.id
      );

      let newDraggedNodes = [...prev.draggedNodes];

      if (existingIndex >= 0) {
        newDraggedNodes[existingIndex] = { node, offset };
      } else {
        newDraggedNodes.push({ node, offset });
      }

      return {
        ...prev,
        draggedNodes: newDraggedNodes,
      };
    });
  },

  setDraggedItem: (item: string | null) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      draggedItem: item,
    }));
  },

  setDropInfo: (
    targetId: string | number | null,
    position: "before" | "after" | "inside" | null,
    dropX?: number,
    dropY?: number
  ) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      dropInfo: { targetId, position, dropX, dropY },
    }));
  },

  setLastMouseX: (lastMouseX: number) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      lastMouseX,
    }));
  },

  setLastMouseY: (lastMouseY: number) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      lastMouseY,
    }));
  },

  setLastMousePosition: (x: number, y: number) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      lastMouseX: x,
      lastMouseY: y,
    }));
  },

  setDragSource: (
    source:
      | "canvas"
      | "viewport"
      | "toolbar"
      | "parent"
      | "dynamic"
      | "absolute-in-frame"
      | null
  ) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      dragSource: source,
    }));
  },

  setDragPositions: (x: number, y: number) => {
    dragStore.set(_internalDragStateAtom, (prev) => {
      if (prev.draggedNodes.length === 0) return prev;
      return {
        ...prev,
        dragPositions: { x, y },
      };
    });
  },

  setPlaceholderInfo: (placeholderInfo: PlaceholderInfo | null) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      placeholderInfo,
    }));
  },

  clearPlaceholderInfo: () => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      placeholderInfo: null,
    }));
  },

  setNodeDimensions: (
    nodeId: string,
    dimensions: {
      width: string;
      height: string;
      isFillMode: boolean;
      finalWidth: string;
      finalHeight: string;
    }
  ) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      nodeDimensions: {
        ...prev.nodeDimensions,
        [nodeId]: dimensions,
      },
    }));
  },

  setDuplicatedFromAlt: (duplicatedFromAlt: boolean) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      duplicatedFromAlt,
    }));
  },

  setRecordingSessionId: (sessionId: string | null) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      recordingSessionId: sessionId,
    }));
  },

  resetDragState: () => {
    dragStore.set(_internalDragStateAtom, {
      ...initialDragState,

      nodeDimensions: dragStore.get(_internalDragStateAtom).nodeDimensions,
    });
  },

  getState: () => {
    return dragStore.get(_internalDragStateAtom);
  },
};

export const dragOps = dragOperations;

export const useIsDragging = () => {
  return useAtomValue(isDraggingAtom, { store: dragStore });
};

export const useIsOverCanvas = () => {
  return useAtomValue(isOverCanvasAtom, { store: dragStore });
};

export const useDraggedNodes = () => {
  return useAtomValue(draggedNodesAtom, { store: dragStore });
};

export const useDragBackToParentInfo = () => {
  return useAtomValue(dragBackToParentInfoAtom, { store: dragStore });
};

export const useIsDraggingBackToParent = () => {
  return useAtomValue(isDraggingBackToParentAtom, { store: dragStore });
};

export const useOriginalParentId = () => {
  return useAtomValue(originalParentIdAtom, { store: dragStore });
};

export const useDraggedNodesOriginalIndices = () => {
  return useAtomValue(draggedNodesOriginalIndicesAtom, { store: dragStore });
};

export const useDraggedNode = () => {
  return useAtomValue(primaryDraggedNodeAtom, { store: dragStore });
};

export const useDraggedItem = () => {
  return useAtomValue(draggedItemAtom, { store: dragStore });
};

export const useDropInfo = () => {
  return useAtomValue(dropInfoAtom, { store: dragStore });
};

export const useLastMousePosition = () => {
  return useAtomValue(lastMousePositionAtom, { store: dragStore });
};

export const useDragSource = () => {
  return useAtomValue(dragSourceAtom, { store: dragStore });
};

export const useDragPositions = () => {
  return useAtomValue(dragPositionsAtom, { store: dragStore });
};

export const usePlaceholderInfo = () => {
  return useAtomValue(placeholderInfoAtom, { store: dragStore });
};

export const useNodeDimensions = () => {
  return useAtomValue(nodeDimensionsAtom, { store: dragStore });
};

export const useDuplicatedFromAlt = () => {
  return useAtomValue(duplicatedFromAltAtom, { store: dragStore });
};

export const useRecordingSessionId = () => {
  return useAtomValue(recordingSessionIdAtom, { store: dragStore });
};

export const useDragState = () => {
  return useAtomValue(_internalDragStateAtom, { store: dragStore });
};

export const useGetDragState = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom);
  }, []);
};

export const useGetIsOverCanvas = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).isOverCanvas;
  }, []);
};

export const useGetDragSource = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).dragSource;
  }, []);
};

export const useGetDraggedNodes = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).draggedNodes;
  }, []);
};

export const useGetDragBackToParentInfo = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).dragBackToParentInfo;
  }, []);
};

export const useGetIsDraggingBackToParent = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).dragBackToParentInfo
      .isDraggingBackToParent;
  }, []);
};

export const useGetOriginalParentId = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).dragBackToParentInfo
      .originalParentId;
  }, []);
};

export const useGetDraggedNodesOriginalIndices = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).dragBackToParentInfo
      .draggedNodesOriginalIndices;
  }, []);
};

export const useGetDraggedNode = () => {
  return useCallback(() => {
    const nodes = dragStore.get(_internalDragStateAtom).draggedNodes;
    return nodes.length > 0 ? nodes[0] : null;
  }, []);
};

export const useGetAdditionalDraggedNodes = () => {
  return useCallback(() => {
    const nodes = dragStore.get(_internalDragStateAtom).draggedNodes;
    return nodes.length > 1 ? nodes.slice(1) : null;
  }, []);
};

export const useGetIsDragging = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).isDragging;
  }, []);
};

export const useGetDraggedItem = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).draggedItem;
  }, []);
};

export const useGetPlaceholderInfo = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).placeholderInfo;
  }, []);
};

export const useGetDropInfo = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).dropInfo;
  }, []);
};

export const useGetDragPositions = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).dragPositions;
  }, []);
};

export const useGetNodeDimensions = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).nodeDimensions;
  }, []);
};

export const useGetDynamicModeNodeId = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).dynamicModeNodeId;
  }, []);
};

export const useGetDuplicatedFromAlt = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).duplicatedFromAlt;
  }, []);
};

export const useGetRecordingSessionId = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).recordingSessionId;
  }, []);
};

export const useSetDragState = () => {
  return useSetAtom(_internalDragStateAtom, { store: dragStore });
};

export const debugDragStore = () => {
  console.log("Drag Store State:", dragStore.get(_internalDragStateAtom));
};
