// src/builder/context/atoms/drag-store.ts
import { atom, createStore } from "jotai/vanilla";
import { selectAtom } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Node } from "../../reducer/nodeDispatcher";

// Create a separate store for drag state
export const dragStore = createStore();

// Type definitions
export interface Offset {
  x: number;
  y: number;
  mouseX: number;
  mouseY: number;
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

export interface DragState {
  isDragging: boolean;
  isOverCanvas: boolean;
  draggedNode: DraggedNodeInfo | null;
  draggedItem: string | null;
  additionalDraggedNodes: Array<{
    node: Node;
    offset: Offset;
  }> | null;
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
}

// Initial state
const initialDragState: DragState = {
  isDragging: false,
  isOverCanvas: false,
  draggedNode: null,
  draggedItem: null,
  additionalDraggedNodes: null,
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
};

// Base atom for drag state
export const _internalDragStateAtom = atom<DragState>(initialDragState);

// Individual property atoms for fine-grained subscriptions
export const isDraggingAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.isDragging
);

export const isOverCanvasAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.isOverCanvas
);

export const draggedNodeAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.draggedNode
);

export const draggedItemAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.draggedItem
);

export const additionalDraggedNodesAtom = selectAtom(
  _internalDragStateAtom,
  (state) => state.additionalDraggedNodes
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

// Create a singleton instance of drag operations
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

  setDraggedNode: (node: Node, offset: Offset) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      draggedNode: { node, offset },
    }));
  },

  setAdditionalDraggedNodes: (
    nodes: Array<{
      node: Node;
      offset: Offset;
    }>
  ) => {
    dragStore.set(_internalDragStateAtom, (prev) => ({
      ...prev,
      additionalDraggedNodes: nodes,
    }));
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
      if (!prev.draggedNode) return prev;
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
      // Preserve nodeDimensions as they might be needed across drags
      nodeDimensions: dragStore.get(_internalDragStateAtom).nodeDimensions,
    });
  },

  // Utility to get full state
  getDragState: () => {
    return dragStore.get(_internalDragStateAtom);
  },
};

// Export the singleton instance directly
export const dragOps = dragOperations;

// Hooks for components to use the drag state
export const useIsDragging = () => {
  return useAtomValue(isDraggingAtom, { store: dragStore });
};

export const useIsOverCanvas = () => {
  return useAtomValue(isOverCanvasAtom, { store: dragStore });
};

export const useDraggedNode = () => {
  return useAtomValue(draggedNodeAtom, { store: dragStore });
};

export const useDraggedItem = () => {
  return useAtomValue(draggedItemAtom, { store: dragStore });
};

export const useAdditionalDraggedNodes = () => {
  return useAtomValue(additionalDraggedNodesAtom, { store: dragStore });
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

// Full state hook
export const useDragState = () => {
  return useAtomValue(_internalDragStateAtom, { store: dragStore });
};

// Imperative getters
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

export const useGetAdditionalDraggedNodes = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).additionalDraggedNodes;
  }, []);
};

export const useGetIsDragging = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).isDragging;
  }, []);
};

export const useGetDraggedNode = () => {
  return useCallback(() => {
    return dragStore.get(_internalDragStateAtom).draggedNode;
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

// Optional set functions for components that need to directly update state
export const useSetDragState = () => {
  return useSetAtom(_internalDragStateAtom, { store: dragStore });
};

// Debug function
export const debugDragStore = () => {
  console.log("Drag Store State:", dragStore.get(_internalDragStateAtom));
};
