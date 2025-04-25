import { produce } from "immer";
import { Node } from "./nodeDispatcher";
import { LineIndicatorState } from "../context/builderState";

export interface DropInfo {
  targetId: string | number | null;
  position: "before" | "after" | "inside" | "absolute-inside" | null;
  dropX?: number;
  dropY?: number;
}

export interface DraggedNode {
  node: Node;
  offset: {
    x: number;
    y: number;
    mouseX: number;
    mouseY: number;
  };
}

export interface SnapGuideLine {
  orientation: "vertical" | "horizontal";
  position: number;
}

interface StyleHelper {
  show: boolean;
  type: "dimensions" | "gap" | "rotate" | "radius" | "fontSize" | null;
  position: { x: number; y: number };
  value?: number;
  unit?: string; // For font size, this would be "px" or "vw"
  isMixed?: boolean; // New property to indicate mixed font sizes
  dimensions?: {
    width: number;
    height: number;
    unit?: string;
    widthUnit?: string;
    heightUnit?: string;
  };
}

export interface DragState {
  isDragging: boolean;
  draggedItem: string | null;
  draggedNode: DraggedNode | null;
  additionalDraggedNodes?: Array<{
    node: Node;
    offset: {
      x: number;
      y: number;
      mouseX: number;
      mouseY: number;
    };
  }>;
  dropInfo: DropInfo;
  selectedIds: (string | number)[];
  placeholderId: string | number | null;
  originalIndex: number | null;
  lineIndicator: LineIndicatorState;
  dragSource:
    | "canvas"
    | "viewport"
    | "toolbar"
    | "parent"
    | "dynamic"
    | "gripHandle"
    | "absolute-in-frame"
    | null;
  snapGuides: SnapGuideLine[];
  originalParentId: string | number | null;
  styleHelper: StyleHelper;
  dynamicModeNodeId?: string | number | null;
  activeViewportInDynamicMode?: string | number | null;
  contextMenu?: {
    show: boolean;
    x: number;
    y: number;
    nodeId: string | null;
    isViewportHeader?: boolean;
  } | null;
  gripHandleDirection: "horizontal" | "vertical" | null;
  hoverNodeId: string | number | null;
  dragPositions: { x: number; y: number };
  isOverCanvas: boolean;
  recordingSessionId: string | null;
  originalWidthHeight: { width: number; height: number; isFillMode: boolean };
  isSelectionBoxActive: boolean;
  tempSelectedIds: string[];
  placeholderInfo: PlaceholderInfo | null;
  nodeDimensions: {
    [nodeId: string]: {
      width: string;
      height: string;
      isFillMode: boolean;
      finalWidth: string;
      finalHeight: string;
    };
  };
  duplicatedFromAlt: boolean;
  lastMouseX: number;
  lastMouseY: number;
  dynamicState: "normal" | "hovered";
  connectionTypeModal: {
    show: boolean;
    position: { x: number; y: number };
    sourceId: string | number | null;
    targetId: string | number | null;
  };
  viewportModal: {
    show: boolean;
    position: {
      x: number;
      y: number;
    };
  };
  editViewportModal: {
    show: boolean;
    viewportId: string | number | null;
    position: {
      x: number;
      y: number;
    };
  };
  viewportContextMenu: {
    show: boolean;
    viewportId: string | number | null;
    position: {
      x: number;
      y: number;
    };
  };
}

interface PlaceholderInfo {
  mainPlaceholderId: string;
  nodeOrder: string[];
  additionalPlaceholders: Array<{
    placeholderId: string;
    nodeId: string;
  }>;
}

export class DragDispatcher {
  constructor(
    private setState: React.Dispatch<React.SetStateAction<DragState>>
  ) {}

  setIsDragging(isDragging: boolean) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.isDragging = isDragging;
      })
    );
  }

  setPartialDragState(state: Partial<DragState>) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        Object.assign(draft, state);
      })
    );
  }

  setDraggedNode(
    node: Node,
    offset: {
      x: number;
      y: number;
      mouseX: number;
      mouseY: number;
      parentRotation?: number;
      elementQuery?: object;
    }
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.draggedNode = { node, offset };
      })
    );
  }

  setAdditionalDraggedNodes(
    nodes: Array<{
      node: Node;
      offset: {
        x: number;
        y: number;
        mouseX: number;
        mouseY: number;
      };
    }>
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.additionalDraggedNodes = nodes;
      })
    );
  }

  setDraggedItem(item: string | null) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.draggedItem = item;
      })
    );
  }

  setDropInfo(
    targetId: string | number | null,
    position: "before" | "after" | "inside" | null,
    dropX?: number,
    dropY?: number
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.dropInfo = { targetId, position, dropX, dropY };
      })
    );
  }

  setLastMouseX(lastMouseX: number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.lastMouseX = lastMouseX;
      })
    );
  }

  setLastMouseY(lastMouseY: number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.lastMouseY = lastMouseY;
      })
    );
  }

  setLastMousePosition(x: number, y: number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.lastMouseX = x;
        draft.lastMouseY = y;
      })
    );
  }

  setDragSource(
    source:
      | "canvas"
      | "viewport"
      | "toolbar"
      | "parent"
      | "dynamic"
      | "absolute-in-frame"
      | null
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.dragSource = source;
      })
    );
  }

  setDragPositions(x: number, y: number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        if (draft.draggedNode) {
          draft.dragPositions = { x, y };
        }
      })
    );
  }

  setPlaceholderInfo(placeholderInfo: PlaceholderInfo | null) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.placeholderInfo = placeholderInfo;
      })
    );
  }

  // Optionally, add a method to clear placeholder info
  clearPlaceholderInfo() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.placeholderInfo = null;
      })
    );
  }

  setNodeDimensions(
    nodeId: string,
    dimensions: {
      width: string;
      height: string;
      isFillMode: boolean;
      finalWidth: string;
      finalHeight: string;
    }
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.nodeDimensions[nodeId] = dimensions;
      })
    );
  }

  resetDragState() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.isDragging = false;
        draft.draggedItem = null;
        draft.draggedNode = null;
        draft.dropInfo = { targetId: null, position: null };
        draft.placeholderId = null;
        draft.originalIndex = null;
        draft.snapGuides = [];
        draft.dragSource = null;
        draft.styleHelper = {
          show: false,
          type: null,
          position: { x: 0, y: 0 },
          value: undefined,
          dimensions: undefined,
        };
        draft.isOverCanvas = false;
        draft.dragPositions = { x: 0, y: 0 };
        draft.originalWidthHeight = { width: 0, height: 0, isFillMode: false };
        draft.additionalDraggedNodes = undefined;
        draft.placeholderInfo = null;
        draft.nodeDimensions = {};
        // draft.activeViewportInDynamicMode = null;
      })
    );
  }
}
