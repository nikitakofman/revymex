import { Node } from "./nodeDispatcher";

const VIEWPORT_GAP = 160;

export interface NodeState {
  nodes: Node[];
  selectedNodeIds: (string | number)[] | null;
}

export const nodeInitialState: NodeState = {
  nodes: [
    {
      id: "viewport-1440",
      type: "frame",
      style: {
        width: "1440px",
        height: "1000px",
        position: "absolute",
        backgroundColor: "white",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        left: "0px",
        top: "0px",
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        isAbsoluteInFrame: "false",
      },
      parentId: null,
      children: [],
      sharedId: "desfaultSharedIdview8",
      isViewport: true,
      viewportWidth: 1440,
      viewportName: "Desktop",
      inViewport: false,
      syncFlags: {
        independentStyles: {},
        unsyncFromParentViewport: {},
        variantIndependentSync: {},
        lowerSyncProps: {},
      },
      dynamicState: {},
    },
    {
      id: "viewport-768",
      type: "frame",
      style: {
        width: "768px",
        height: "1000px",
        position: "absolute",
        backgroundColor: "white",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        left: `${1440 + VIEWPORT_GAP}px`,
        top: "0px",
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        isAbsoluteInFrame: "false",
      },
      parentId: null,
      sharedId: "desfaultSharedIdview8",
      isViewport: true,
      viewportWidth: 768,
      viewportName: "Tablet",
      inViewport: false,
      syncFlags: {
        independentStyles: {
          isAbsoluteInFrame: true,
          position: true,
          left: true,
          top: true,
        },
        unsyncFromParentViewport: {
          isAbsoluteInFrame: true,
          position: true,
          left: true,
          top: true,
        },
        variantIndependentSync: {},
        lowerSyncProps: {},
      },
      dynamicState: {},
    },
    {
      id: "viewport-375",
      type: "frame",
      style: {
        width: "375px",
        height: "1000px",
        position: "absolute",
        backgroundColor: "white",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        left: `${1440 + VIEWPORT_GAP + 768 + VIEWPORT_GAP}px`,
        top: "0px",
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        isAbsoluteInFrame: "false",
      },
      parentId: null,
      sharedId: "desfaultSharedIdview8",
      isViewport: true,
      viewportWidth: 375,
      viewportName: "Mobile",
      inViewport: false,
      syncFlags: {
        independentStyles: {
          isAbsoluteInFrame: true,
          position: true,
          left: true,
          top: true,
        },
        unsyncFromParentViewport: {
          isAbsoluteInFrame: true,
          position: true,
          left: true,
          top: true,
        },
        variantIndependentSync: {},
        lowerSyncProps: {},
      },
      dynamicState: {},
    },
  ],
  selectedNodeIds: null,
};
