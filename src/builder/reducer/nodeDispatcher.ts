import { produce } from "immer";
import { nanoid } from "nanoid";
import { CSSProperties } from "react";
import { findParentViewport } from "../context/dnd/utils";

export interface Position {
  x: number;
  y: number;
}

export interface Node {
  id: string | number;
  type: "frame" | "image" | "text" | "placeholder" | string;
  style: CSSProperties;
  sharedId: string;
  independentStyles?: {
    [styleProperty: string]: boolean;
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
        const newNode = { ...node, inViewport: shouldBeInViewport };

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
        // Get source node being styled
        const sourceNode = draft.nodes.find((n) => nodeIds.includes(n.id));
        if (!sourceNode) return;

        // Find which viewport this node is in
        const viewportId = findParentViewport(sourceNode.parentId, draft.nodes);

        // If it's not desktop viewport, mark these style properties as independent
        if (viewportId && viewportId !== "viewport-1440") {
          if (!sourceNode.independentStyles) sourceNode.independentStyles = {};

          // Mark each changed style property as independent
          Object.keys(style).forEach((prop) => {
            sourceNode.independentStyles![prop] = true;
          });
        }

        // Apply style to source node
        Object.assign(sourceNode.style, style);
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

        if (!node.sharedId) {
          node.sharedId = nanoid();
        }

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

  syncViewports() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const viewports = draft.nodes.filter((n) => n.isViewport);
        const desktop = viewports.find((v) => v.viewportWidth === 1440);
        if (!desktop) return;

        // BFS from desktop
        const desktopSubtree = getSubtree(draft.nodes, desktop.id);

        // For each other viewport
        viewports.forEach((viewport) => {
          if (viewport.id === desktop.id) return; // skip the desktop

          // old subtree for this viewport
          const oldSubtree = getSubtree(draft.nodes, viewport.id);

          // gather oldNodes by sharedId
          const oldNodesBySharedId = new Map<string, Node>();
          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport) continue; // never remove the viewport frame
            if (oldNode.sharedId) {
              oldNodesBySharedId.set(oldNode.sharedId, oldNode);
            }
          }

          // remove the old children (not the viewport itself!)
          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport) continue;
            const removeIdx = draft.nodes.findIndex((n) => n.id === oldNode.id);
            if (removeIdx !== -1) {
              draft.nodes.splice(removeIdx, 1);
            }
          }

          // replicate from desktop
          const idMap = new Map<string | number, string | number>();

          for (const desktopNode of desktopSubtree) {
            // clone
            const cloned: Node = {
              ...desktopNode,
              id: nanoid(),
              style: { ...desktopNode.style },
            };

            // if old viewport node with same sharedId had "independent" props, keep them
            const oldVNode = oldNodesBySharedId.get(desktopNode.sharedId);
            if (oldVNode?.independentStyles) {
              for (const prop of Object.keys(oldVNode.style)) {
                if (oldVNode.independentStyles[prop]) {
                  cloned.style[prop] = oldVNode.style[prop];
                  cloned.independentStyles = cloned.independentStyles || {};
                  cloned.independentStyles[prop] = true;
                }
              }
            }

            idMap.set(desktopNode.id, cloned.id);
            draft.nodes.push(cloned);
          }

          // fix parent references in the cloned subtree
          for (const dNode of desktopSubtree) {
            const newId = idMap.get(dNode.id);
            if (!newId) continue;

            const clonedNode = draft.nodes.find((n) => n.id === newId);
            if (!clonedNode) continue;

            if (dNode.parentId === desktop.id) {
              // direct child => new parent is this viewport
              clonedNode.parentId = viewport.id;
            } else {
              // re-link to parent's new ID
              const newParent = idMap.get(dNode.parentId || "");
              clonedNode.parentId = newParent ?? null;
            }
          }
        });
      })
    );
  }

  /**
   * Sync from a given viewport to all the others, including desktop.
   * BFS from that viewport, replicate to other frames, but skip removing the viewport node itself.
   */
  syncFromViewport(sourceViewportId: string) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const sourceSubtree = getSubtree(draft.nodes, sourceViewportId);

        // find all other viewports
        const otherViewports = draft.nodes.filter(
          (v) => v.isViewport && v.id !== sourceViewportId
        );

        for (const viewport of otherViewports) {
          const oldSubtree = getSubtree(draft.nodes, viewport.id);
          const oldMap = new Map<string, Node>();
          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport) continue;
            if (oldNode.sharedId) {
              oldMap.set(oldNode.sharedId, oldNode);
            }
          }
          // remove old
          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport) continue;
            const idx = draft.nodes.findIndex((x) => x.id === oldNode.id);
            if (idx !== -1) {
              draft.nodes.splice(idx, 1);
            }
          }

          // replicate
          const idMap = new Map<string | number, string | number>();
          for (const srcNode of sourceSubtree) {
            const cloned: Node = {
              ...srcNode,
              id: nanoid(),
              style: { ...srcNode.style },
            };

            const oldVnode = oldMap.get(srcNode.sharedId);
            if (oldVnode?.independentStyles) {
              for (const prop of Object.keys(oldVnode.style)) {
                if (oldVnode.independentStyles[prop]) {
                  cloned.style[prop] = oldVnode.style[prop];
                  cloned.independentStyles = cloned.independentStyles || {};
                  cloned.independentStyles[prop] = true;
                }
              }
            }

            idMap.set(srcNode.id, cloned.id);
            draft.nodes.push(cloned);
          }
          // fix parents
          for (const srcNode of sourceSubtree) {
            const newId = idMap.get(srcNode.id);
            if (!newId) continue;

            const clonedNode = draft.nodes.find((n) => n.id === newId);
            if (!clonedNode) continue;

            if (srcNode.parentId === sourceViewportId) {
              clonedNode.parentId = viewport.id;
            } else {
              const newParent = idMap.get(srcNode.parentId || "");
              clonedNode.parentId = newParent ?? null;
            }
          }
        }
      })
    );
  }
}
/**
 * Returns all descendants of `rootId` (excluding the root itself),
 * skipping placeholder nodes. Uses BFS or DFS; BFS shown here.
 */
function getSubtree(
  nodes: Node[],
  rootId: string | number,
  includeRoot = false
): Node[] {
  const result: Node[] = [];

  // Optionally include the root itself
  if (includeRoot) {
    const rootNode = nodes.find(
      (n) => n.id === rootId && n.type !== "placeholder"
    );
    if (rootNode) {
      result.push(rootNode);
    }
  }

  const queue = [rootId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = nodes.filter(
      (n) => n.parentId === currentId && n.type !== "placeholder"
    );
    for (const child of children) {
      result.push(child);
      queue.push(child.id);
    }
  }
  return result;
}
function findNodeBySharedId(
  allNodes: Node[],
  viewportId: string | number,
  sharedId: string
): Node | undefined {
  // We'll do a quick scan of all nodes
  // and confirm it's within the viewport subtree.
  return allNodes.find((n) => {
    if (n.sharedId !== sharedId) return false;

    // Climb up n.parentId chain; if we reach viewportId, it's in that viewport
    let current: Node | undefined = n;
    while (current) {
      if (current.id === viewportId) {
        return true; // we found the viewport in the chain
      }
      current = allNodes.find((cand) => cand.id === current!.parentId);
    }
    return false;
  });
}
