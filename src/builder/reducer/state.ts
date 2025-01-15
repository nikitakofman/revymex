import { DragState } from "./dragDispatcher";
import { NodeState } from "./nodeDispatcher";

export const nodeInitialState: NodeState = {
  nodes: [
    {
      id: 1,
      type: "frame",
      style: {
        width: "150px",
        height: "150px",
        backgroundColor: "red",
        position: "relative",
      },
      children: [],
      inViewport: true,
    },
    {
      id: 2,
      type: "frame",
      style: {
        width: "150px",
        height: "150px",
        backgroundColor: "blue",
        position: "relative",
      },
      children: [],
      inViewport: true,
    },
    {
      id: 3,
      type: "image",
      src: "https://hatrabbits.com/wp-content/uploads/2017/01/random.jpg",
      style: {
        width: "150px",
        height: "150px",
        position: "relative",
      },
      inViewport: true,
    },
    {
      id: 4,
      type: "text",
      text: "hello world",
      style: {
        width: "150px",
        height: "150px",
        fontSize: "30px",
        backgroundColor: "yellow",
        position: "relative",
      },
      inViewport: true,
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
  placeholderId: null,
  originalIndex: null,
  lineIndicator: { show: false, x: 0, y: 0, width: 0, height: 0 },
  dragSource: null,
  snapGuides: [],
};
