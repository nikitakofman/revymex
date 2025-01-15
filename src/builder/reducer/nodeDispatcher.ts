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
  src?: string;
  text?: string;
  children?: Node[];
  position?: Position;
  inViewport?: boolean;
}

export interface NodeState {
  nodes: Node[];
  selectedNodeIds: (string | number)[] | null;
}

/**
 * IMPORTANT CHANGE:
 *   We no longer store a 'private state: NodeState' reference.
 *   Instead, we ONLY store 'private setState', and always use
 *   the functional update form.
 */
export class NodeDispatcher {
  constructor(
    private setState: React.Dispatch<React.SetStateAction<NodeState>>
  ) {}

  addNode(
    node: Node,
    targetId: number | null,
    position: "before" | "after" | "inside" | null
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        if (!targetId) {
          draft.nodes.push(node);
          return;
        }
        const targetIndex = draft.nodes.findIndex((n) => n.id === targetId);
        if (targetIndex === -1) {
          draft.nodes.push(node);
          return;
        }
        if (position === "inside") {
          draft.nodes.push(node);
          return;
        }
        const insertIndex =
          position === "after" ? targetIndex + 1 : targetIndex;
        draft.nodes.splice(insertIndex, 0, node);
      })
    );
  }

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

  moveNode(
    nodeId: string | number,
    inViewport: boolean,
    options?: {
      targetId?: number | null;
      position?: "before" | "after" | "inside" | null;
      newPosition?: Position;
    }
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        if (!inViewport) {
          const idx = draft.nodes.findIndex((n) => n.id === nodeId);
          if (idx === -1) return;
          const removed = draft.nodes.splice(idx, 1)[0];
          removed.inViewport = false;
          removed.style.position = "absolute";
          if (options?.newPosition) {
            removed.position = options.newPosition;
          }
          draft.nodes.push(removed);
          return;
        }

        // Inside is unimplemented in this snippet, so skip it
        if (options?.position === "inside" && options?.targetId != null) {
          return;
        }

        if (
          options?.targetId != null &&
          (options.position === "before" || options.position === "after")
        ) {
          const currentIdx = draft.nodes.findIndex((n) => n.id === nodeId);
          if (currentIdx === -1) return;
          const [removed] = draft.nodes.splice(currentIdx, 1);
          removed.inViewport = true;
          removed.style.position = "relative";

          const targetIdx = draft.nodes.findIndex(
            (n) => n.id === options.targetId
          );
          if (targetIdx === -1) {
            draft.nodes.push(removed);
            return;
          }
          const insertIdx =
            options.position === "after" ? targetIdx + 1 : targetIdx;
          draft.nodes.splice(insertIdx, 0, removed);
          return;
        }

        // Just move it to the end
        const idx = draft.nodes.findIndex((n) => n.id === nodeId);
        if (idx !== -1) {
          const [removed] = draft.nodes.splice(idx, 1);
          removed.inViewport = true;
          removed.style.position = "relative";
          draft.nodes.push(removed);
        }
      })
    );
  }

  setNodes(nodes: Node[]) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.nodes = nodes;
      })
    );
  }

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

  insertAtIndex(node: Node, index: number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        if (index < 0 || index > draft.nodes.length) {
          draft.nodes.push(node);
        } else {
          draft.nodes.splice(index, 0, node);
        }
      })
    );
  }
}
