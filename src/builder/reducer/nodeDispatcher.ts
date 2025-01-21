import { produce } from "immer";
import { CSSProperties } from "react";

export interface Position {
  x: number;
  y: number;
}

export interface Node {
  id: string | number;
  type: "frame" | "image" | "text" | "placeholder" | string;
  style: CSSProperties;
  viewportStyles?: {
    [viewportId: string]: React.CSSProperties;
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

export class NodeDispatcher {
  constructor(
    private setState: React.Dispatch<React.SetStateAction<NodeState>>
  ) {}

  addNode(
    node: Node,
    targetId: string | number | null,
    position: "before" | "after" | "inside" | null,
    shouldBeInViewport: boolean
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const newNode = {
          ...node,
          inViewport: shouldBeInViewport,
        };

        if (!targetId) {
          newNode.parentId = null;
          draft.nodes.push(newNode);
          return;
        }

        const targetIndex = draft.nodes.findIndex((n) => n.id === targetId);
        if (targetIndex === -1) {
          newNode.parentId = null;
          draft.nodes.push(newNode);
          return;
        }

        const targetNode = draft.nodes[targetIndex];

        if (position === "inside") {
          newNode.parentId = targetNode.id;
          draft.nodes.push(newNode);
          return;
        }

        newNode.parentId = targetNode.parentId;

        const siblingInfo = draft.nodes
          .map((n, idx) => ({ node: n, index: idx }))
          .filter((obj) => obj.node.parentId === targetNode.parentId);

        const siblingIndex = siblingInfo.findIndex(
          (obj) => obj.node.id === targetId
        );
        if (siblingIndex === -1) {
          draft.nodes.push(newNode);
          return;
        }

        const insertGlobalIndex =
          position === "after"
            ? siblingInfo[siblingIndex].index + 1
            : siblingInfo[siblingIndex].index;

        draft.nodes.splice(insertGlobalIndex, 0, newNode);
      })
    );
  }

  /**
   * Update style of multiple nodes by id, no recursion needed in a flat array.
   */
  updateNodeStyle(nodeIds: (string | number)[], style: Partial<CSSProperties>) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.nodes.forEach((node) => {
          if (nodeIds.includes(node.id)) {
            Object.assign(node.style, style);
          }
        });
      })
    );
  }

  updateNodeparent(nodeId: string | number, parentId: string | number | null) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const targetNode = draft.nodes.find((n) => n.id === nodeId);
        if (targetNode) {
          targetNode.parentId = parentId;
        }
      })
    );
  }

  /**
   * Update the absolute position (x,y) of a node. Just set node.position.
   */
  updateNodePosition(id: string | number, position: Position) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const targetNode = draft.nodes.find((n) => n.id === id);
        if (targetNode) {
          targetNode.position = position;
        }
      })
    );
  }

  /**
   * Move a node in or out of the viewport, or "before"/"after"/"inside" a target.
   */
  moveNode(
    nodeId: string | number,
    inViewport: boolean,
    options?: {
      targetId?: string | number | null;
      position?: "before" | "after" | "inside" | null;
      newPosition?: Position;
    }
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const idx = draft.nodes.findIndex((n) => n.id === nodeId);
        if (idx === -1) return;
        const node = draft.nodes[idx];

        if (!inViewport) {
          node.inViewport = false;
          node.style.position = "absolute";
          node.parentId = null;
          if (options?.newPosition) {
            node.position = options.newPosition;
          }

          return;
        }

        node.inViewport = true;
        node.style.position = "relative";

        if (options?.targetId != null && options.position) {
          draft.nodes.splice(idx, 1);

          const targetId = options.targetId;
          const position = options.position;
          const targetIndex = draft.nodes.findIndex((n) => n.id === targetId);
          if (targetIndex === -1) {
            node.parentId = null;
            draft.nodes.push(node);
            return;
          }
          const targetNode = draft.nodes[targetIndex];

          if (position === "inside") {
            node.parentId = targetNode.id;
            draft.nodes.push(node);
            return;
          }

          node.parentId = targetNode.parentId;

          const siblingIds = draft.nodes
            .map((n, i) => ({ node: n, index: i }))
            .filter((obj) => obj.node.parentId === targetNode.parentId);

          const siblingIdx = siblingIds.findIndex(
            (obj) => obj.node.id === targetId
          );
          if (siblingIdx === -1) {
            draft.nodes.push(node);
            return;
          }

          const insertGlobalIndex =
            position === "after"
              ? siblingIds[siblingIdx].index + 1
              : siblingIds[siblingIdx].index;

          draft.nodes.splice(insertGlobalIndex, 0, node);
          return;
        }

        draft.nodes.splice(idx, 1);
        draft.nodes.push(node);
      })
    );
  }

  /**
   * Replace the entire node array.
   */
  setNodes(nodes: Node[]) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.nodes = nodes;
      })
    );
  }

  /**
   * Remove a node by id from the array.
   */
  removeNode(nodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const idx = draft.nodes.findIndex((n) => n.id === nodeId);
        if (idx !== -1) {
          draft.nodes.splice(idx, 1);
        }
      })
    );
  }

  /**
   * Insert a node at a specific index in the array (root-level).
   */
  insertAtIndex(
    node: Node,
    index: number,
    parentId: string | number | null | undefined
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const newNode = { ...node, parentId };

        const siblings = draft.nodes
          .map((n, idx) => ({ node: n, index: idx }))
          .filter((obj) => obj.node.parentId === parentId);

        if (siblings.length === 0) {
          draft.nodes.push(newNode);
          return;
        }

        if (index >= siblings.length) {
          const lastSiblingGlobalIndex = siblings[siblings.length - 1].index;
          draft.nodes.splice(lastSiblingGlobalIndex + 1, 0, newNode);
        } else {
          const targetGlobalIndex = siblings[index].index;
          draft.nodes.splice(targetGlobalIndex, 0, newNode);
        }
      })
    );
  }
}
