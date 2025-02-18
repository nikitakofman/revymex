import { produce } from "immer";
import { Node } from "./nodeDispatcher";
import { LineIndicatorState } from "../context/builderState";

export interface DropInfo {
  targetId: string | number | null;
  position: "before" | "after" | "inside" | null;
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
  type: "dimensions" | "gap" | "rotate" | "radius" | null;
  position: { x: number; y: number };
  value?: number;
  dimensions?: {
    width: number;
    height: number;
    unit: "px" | "%";
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
    | null;
  snapGuides: SnapGuideLine[];
  originalParentId: string | number | null;
  styleHelper: StyleHelper;
  dynamicModeNodeId?: string | number | null;
  contextMenu: {
    show: boolean;
    x: number;
    y: number;
    nodeId: string | null;
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

  setIsSelectionBoxActive(isActive: boolean) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.isSelectionBoxActive = isActive;
      })
    );
  }

  setTempSelectedIds(ids: string[]) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.tempSelectedIds = ids;
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

  selectNode(nodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.selectedIds = [nodeId];
      })
    );
  }

  addToSelection(nodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        if (!draft.selectedIds.includes(nodeId)) {
          draft.selectedIds.push(nodeId);
        }
      })
    );
  }

  setSelectedIds(ids: (string | number)[]) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.selectedIds = ids;
      })
    );
  }

  removeFromSelection(nodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.selectedIds = draft.selectedIds.filter((id) => id !== nodeId);
      })
    );
  }

  clearSelection() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.selectedIds = [];
      })
    );
  }

  setContextMenu(x: number, y: number, nodeId: string | null) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.contextMenu = { show: true, x, y, nodeId };
      })
    );
  }

  hideContextMenu() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.contextMenu = null;
      })
    );
  }

  setLineIndicator(lineIndicator: LineIndicatorState) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.lineIndicator = lineIndicator;
      })
    );
  }

  setRecordingSessionId(sessionId: string | null) {
    this.setState((prev) => ({
      ...prev,
      recordingSessionId: sessionId,
    }));
  }

  hideLineIndicator() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.lineIndicator = {
          show: false,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        };
      })
    );
  }

  setDragSource(
    source: "canvas" | "viewport" | "toolbar" | "parent" | "dynamic" | null
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.dragSource = source;
      })
    );
  }

  setSnapGuides(lines: SnapGuideLine[]) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.snapGuides = lines;
      })
    );
  }

  clearSnapGuides() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.snapGuides = [];
      })
    );
  }

  updateStyleHelper(params: {
    type: "dimensions" | "gap" | "rotate" | "radius";
    position: { x: number; y: number };
    value?: number;
    dimensions?: {
      width: number;
      height: number;
      unit: "px" | "%";
      widthUnit?: string;
      heightUnit?: string;
    };
  }) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.styleHelper = {
          show: true,
          type: params.type,
          position: params.position,
          value: params.value,
          dimensions: params.dimensions,
        };
      })
    );
  }

  hideStyleHelper() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.styleHelper = {
          show: false,
          type: null,
          position: { x: 0, y: 0 },
          value: undefined,
          dimensions: undefined,
        };
      })
    );
  }

  setDynamicModeNodeId(
    nodeId: string | number | null,
    resetNodePositions?: () => void
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        if (!nodeId && resetNodePositions) {
          resetNodePositions();
        }
        draft.dynamicModeNodeId = nodeId;
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

  setIsOverCanvas(isOverCanvas: boolean) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.isOverCanvas = isOverCanvas;
      })
    );
  }

  setHoverNodeId(nodeId: string | number | null) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.hoverNodeId = nodeId;
      })
    );
  }

  setOriginalWidthHeight(width: number, height: number, isFillMode: boolean) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.originalWidthHeight = { width, height, isFillMode };
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

  setDuplicatedFromAlt(duplicatedFromAlt: boolean) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.duplicatedFromAlt = duplicatedFromAlt;
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
      })
    );
  }
}
