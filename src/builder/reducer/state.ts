import { DragState } from "./dragDispatcher";
import { NodeState } from "./nodeDispatcher";

const VIEWPORT_GAP = 160; // Gap between viewports in pixels

export const nodeInitialState: NodeState = {
  nodes: [
    // {
    //   id: "1",
    //   type: "frame",
    //   style: {
    //     width: "150px",
    //     height: "150px",
    //     backgroundColor: "red",
    //     position: "relative",
    //   },
    //   inViewport: true,
    //   parentId: null, // top-level
    // },
    // {
    //   id: "2",
    //   type: "frame",
    //   style: {
    //     width: "150px",
    //     height: "150px",
    //     backgroundColor: "blue",
    //     position: "relative",
    //   },
    //   inViewport: true,
    //   parentId: null, // top-level
    // },
    // {
    //   id: "3",
    //   type: "image",
    //   src: "https://hatrabbits.com/wp-content/uploads/2017/01/random.jpg",
    //   style: {
    //     width: "150px",
    //     height: "150px",
    //     position: "relative",
    //   },
    //   inViewport: true,
    //   parentId: null, // top-level
    // },
    // {
    //   id: "4",
    //   type: "text",
    //   text: "hello world",
    //   style: {
    //     width: "150px",
    //     height: "150px",
    //     fontSize: "30px",
    //     backgroundColor: "yellow",
    //     position: "relative",
    //   },
    //   inViewport: true,
    //   parentId: null, // top-level
    // },
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
      },
      inViewport: false,
      parentId: null,
      position: { x: 100, y: 100 },
    },

    // Tablet Viewport (768px) - positioned after desktop + gap
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
        left: `${1440 + VIEWPORT_GAP}px`, // Desktop width + gap
        top: "0px",
      },
      inViewport: false,
      parentId: null,
      position: { x: 100 + 1440 + VIEWPORT_GAP, y: 100 },
    },

    // Mobile Viewport (375px) - positioned after desktop + gap + tablet + gap
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
        left: `${1440 + VIEWPORT_GAP + 768 + VIEWPORT_GAP}px`, // Desktop + gap + tablet + gap
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
  activeViewportId: null,
};
