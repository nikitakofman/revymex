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

  setDynamicModeNodeId(
    nodeId: string | number | null,
    resetNodePositions?: () => void,
    defaultViewportId?: string | number
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        if (!nodeId && resetNodePositions) {
          resetNodePositions();
          // Clear active viewport when exiting dynamic mode
          draft.activeViewportInDynamicMode = null;
        } else if (nodeId && defaultViewportId) {
          // Set default viewport when entering dynamic mode
          draft.activeViewportInDynamicMode = defaultViewportId;
        }
        draft.dynamicModeNodeId = nodeId;
      })
    );
  }

  showConnectionTypeModal(
    sourceId: string | number,
    targetId: string | number,
    position: { x: number; y: number }
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.connectionTypeModal = {
          show: true,
          position,
          sourceId,
          targetId,
        };
      })
    );
  }

  /**
   * Sets the active viewport in dynamic mode
   * @param viewportId The ID of the viewport to switch to
   */
  switchDynamicViewport(viewportId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.activeViewportInDynamicMode = viewportId;

        // If we have a selection, maintain it
        // This ensures UI elements stay selected when switching viewports
        if (draft.selectedIds.length > 0) {
          const currentSelection = [...draft.selectedIds];
          draft.selectedIds = currentSelection;
        }
      })
    );
  }

  // Method to hide the connection type modal
  hideConnectionTypeModal() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.connectionTypeModal.show = false;
      })
    );
  }
}
