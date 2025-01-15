import { produce } from "immer";
import { Node } from "./nodeDispatcher";
import { LineIndicatorState } from "../context/builderState";

export interface DropInfo {
  targetId: number | null;
  position: "before" | "after" | "inside" | null;
}

export interface DraggedNode {
  node: Node;
  offset: { x: number; y: number; mouseX: number; mouseY: number };
}

export interface SnapGuideLine {
  orientation: "vertical" | "horizontal";
  position: number; // x or y coordinate
}

export interface DragState {
  isDragging: boolean;
  draggedItem: string | null;
  draggedNode: DraggedNode | null;
  dropInfo: DropInfo;
  selectedIds: (string | number)[];
  placeholderId: string | number | null;
  originalIndex: number | null;
  lineIndicator: LineIndicatorState;
  dragSource: string | null;
  snapGuides: SnapGuideLine[];
}

/**
 * IMPORTANT CHANGE:
 *   We no longer store a 'private state: DragState' reference.
 *   Instead, we ONLY store 'private setState', and always use
 *   the functional update form.
 */
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

  setDraggedNode(
    node: Node,
    offset: { x: number; y: number; mouseX: number; mouseY: number }
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.draggedNode = { node, offset };
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
    targetId: number | null,
    position: "before" | "after" | "inside" | null
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.dropInfo = { targetId, position };
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

  setPlaceholderInfo(
    placeholderId: string | number | null,
    originalIndex: number | null
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.placeholderId = placeholderId;
        draft.originalIndex = originalIndex;
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

  setDragSource(source: string | null) {
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

  resetDragState() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.isDragging = false;
        draft.draggedItem = null;
        draft.draggedNode = null;
        draft.dropInfo = { targetId: null, position: null };
        draft.selectedIds = [];
        draft.placeholderId = null;
        draft.originalIndex = null;
        draft.snapGuides = [];
        draft.dragSource = null;
      })
    );
  }
}
