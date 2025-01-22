import { CSSProperties } from "react";
import { DragState } from "./dragDispatcher";
import { Position } from "./nodeDispatcher";

const VIEWPORT_GAP = 160; // Gap between viewports in pixels

export interface Node {
  id: string | number;
  type: "frame" | "image" | "text" | "placeholder" | string;
  style: CSSProperties;
  viewportStyles?: {
    [viewportId: string]: React.CSSProperties; // For when we export/preview
  };
  src?: string;
  text?: string;
  parentId?: string | number | null;
  position?: Position;
  inViewport?: boolean;
  isViewport?: boolean;
  viewportWidth?: number;
}

export interface NodeState {
  nodes: Node[];
  selectedNodeIds: (string | number)[] | null;
}

export const nodeInitialState: NodeState = {
  nodes: [
    {
      id: "viewport-1440",
      type: "frame",
      isViewport: true,
      viewportWidth: 1440,
      style: {
        width: "1440px",
        height: "1000px",
        position: "absolute",
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        left: "0px",
        top: "0px",
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
      },
      inViewport: false,
      parentId: null,
      position: { x: 100, y: 100 },
    },
    {
      id: "viewport-768",
      type: "frame",
      isViewport: true,
      viewportWidth: 768,
      style: {
        width: "768px",
        height: "1000px",
        position: "absolute",
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        left: `${1440 + VIEWPORT_GAP}px`,
        top: "0px",
      },
      inViewport: false,
      parentId: null,
      position: { x: 100 + 1440 + VIEWPORT_GAP, y: 100 },
    },
    {
      id: "viewport-375",
      type: "frame",
      isViewport: true,
      viewportWidth: 375,
      style: {
        width: "375px",
        height: "1000px",
        position: "absolute",
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        left: `${1440 + VIEWPORT_GAP + 768 + VIEWPORT_GAP}px`,
        top: "0px",
      },
      inViewport: false,
      parentId: null,
      position: { x: 100 + 1440 + VIEWPORT_GAP + 768 + VIEWPORT_GAP, y: 100 },
    },
  ],
  selectedNodeIds: null,
};

export const dragInitialState: DragState = {
  isDragging: false,
  draggedItem: null,
  draggedNode: null,
  dropInfo: {
    targetId: null,
    position: null,
  },
  selectedIds: [],
  originalParentId: null,
  placeholderId: null,
  originalIndex: null,
  lineIndicator: {
    show: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
  dragSource: null,
  snapGuides: [],
  styleHelper: {
    show: false,
    type: null,
    position: { x: 0, y: 0 },
    value: undefined,
    dimensions: undefined,
  },
};
