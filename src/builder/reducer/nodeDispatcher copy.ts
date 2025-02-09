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
  style: CSSProperties & { src?: string } & { text?: string };
  sharedId?: string;
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
  isDynamic?: boolean;
  dynamicParentId?: string | number;
  dynamicConnections?: {
    sourceId: string | number;
    targetId: string | number;
    type: "click" | "hover";
  }[];
  dynamicPosition?: Position;
  originalState?: {
    parentId: string | number | null;
    inViewport: boolean;
  };
}

export interface NodeState {
  nodes: Node[];
  selectedNodeIds: (string | number)[] | null;
}

export interface SetStateOptions {
  skipHistory?: boolean;
  batch?: boolean;
}

export type SetStateWithOptions = (
  updater: React.SetStateAction<NodeState>,
  options?: SetStateOptions
) => void;

interface MoveNodeOptions extends SetStateOptions {
  targetId?: string | number | null;
  position?: "before" | "after" | "inside" | null;
  newPosition?: Position;
}

export class NodeDispatcher {
  constructor(private setState: SetStateWithOptions) {}

  addNode(
    node: Node,
    targetId: string | number | null,
    position: "before" | "after" | "inside" | null,
    shouldBeInViewport: boolean,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
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
        }),
      options
    );
  }

  updateNodeStyle(
    nodeIds: (string | number)[],
    style: Partial<CSSProperties>,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const sourceNode = draft.nodes.find((n) => nodeIds.includes(n.id));
          if (!sourceNode) return;

          const viewportId = findParentViewport(
            sourceNode.parentId,
            draft.nodes
          );

          if (viewportId && viewportId !== "viewport-1440") {
            if (!sourceNode.independentStyles)
              sourceNode.independentStyles = {};

            Object.keys(style).forEach((prop) => {
              sourceNode.independentStyles![prop] = true;
            });
          }

          Object.assign(sourceNode.style, style);
        }),
      options
    );
  }

  updateNodeparent(
    nodeId: string | number,
    parentId: string | number | null,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const targetNode = draft.nodes.find((n) => n.id === nodeId);
          if (targetNode) {
            targetNode.parentId = parentId;
          }
        }),
      options
    );
  }

  /**
   * Update the absolute position (x,y) of a node. Just set node.position.
   */
  updateNodePosition(
    id: string | number,
    position: Position,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const targetNode = draft.nodes.find((n) => n.id === id);
          if (targetNode) {
            targetNode.position = position;
          }
        }),
      options
    );
  }

  /**
   * Move a node in or out of the viewport, or "before"/"after"/"inside" a target.
   */
  moveNode(
    nodeId: string | number,
    inViewport: boolean,
    options?: MoveNodeOptions
  ) {
    this.setState(
      (prev) =>
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
        }),
      options
    );
  }

  /**
   * Replace the entire node array.
   */
  setNodes(nodes: Node[], options?: SetStateOptions) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          draft.nodes = nodes;
        }),
      options
    );
  }

  /**
   * Remove a node by id from the array.
   */
  removeNode(nodeId: string | number, options?: SetStateOptions) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const idx = draft.nodes.findIndex((n) => n.id === nodeId);
          if (idx !== -1) {
            draft.nodes.splice(idx, 1);
          }
        }),
      options
    );
  }

  /**
   * Insert a node at a specific index in the array (root-level).
   */
  insertAtIndex(
    node: Node,
    index: number,
    parentId: string | number | null | undefined,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
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
        }),
      options
    );
  }

  updateDynamicPosition(
    id: string | number,
    position: Position,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const targetNode = draft.nodes.find((n) => n.id === id);
          if (targetNode) {
            targetNode.dynamicPosition = position;
          }
        }),
      options
    );
  }

  updateNodeDynamicStatus(nodeId: string | number, options?: SetStateOptions) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const mainNode = draft.nodes.find((n) => n.id === nodeId);
          if (!mainNode?.isDynamic) return;

          function updateChildren(parentId: string | number) {
            const children = draft.nodes.filter((n) => n.parentId === parentId);
            children.forEach((child) => {
              child.dynamicParentId = nodeId;
              updateChildren(child.id);
            });
          }

          updateChildren(nodeId);
        }),
      options
    );
  }

  storeDynamicNodeState(
    nodeId: string | number | null,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const node = draft.nodes.find((n) => n.id === nodeId);
          if (node) {
            // Store original state before making it absolute
            node.originalState = {
              parentId: node.parentId,
              inViewport: node.inViewport,
            } as Node["originalState"];
            // Set up for dynamic mode
            node.parentId = null;
            node.inViewport = false;
          }
        }),
      options
    );
  }

  resetDynamicNodePositions(options?: SetStateOptions) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const dynamicNodes = draft.nodes.filter((n) => n.dynamicPosition);

          dynamicNodes.forEach((node) => {
            // Restore the original state
            if (node.originalState) {
              node.parentId = node.originalState.parentId;
              node.inViewport = node.originalState.inViewport;
              node.style.position = "relative";
              node.style.left = "";
              node.style.top = "";
              node.style.zIndex = "";
              node.style.transform = "";
              // Clear the original state since we've restored it
              delete node.originalState;
            }
          });
        }),
      options
    );
  }

  syncViewports(options?: SetStateOptions) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const viewports = draft.nodes.filter((n) => n.isViewport);
          const desktop = viewports.find((v) => v.viewportWidth === 1440);
          if (!desktop) return;

          const desktopSubtree = getSubtree(draft.nodes, desktop.id);

          viewports.forEach((viewport) => {
            if (viewport.id === desktop.id) return;

            const oldSubtree = getSubtree(draft.nodes, viewport.id);
            const oldNodesBySharedId = new Map<string, Node>();

            for (const oldNode of oldSubtree) {
              if (oldNode.isViewport) continue;
              if (oldNode.sharedId) {
                oldNodesBySharedId.set(oldNode.sharedId, oldNode);
              }
            }

            for (const oldNode of oldSubtree) {
              if (oldNode.isViewport) continue;
              const removeIdx = draft.nodes.findIndex(
                (n) => n.id === oldNode.id
              );
              if (removeIdx !== -1) {
                draft.nodes.splice(removeIdx, 1);
              }
            }

            const idMap = new Map<string | number, string | number>();

            for (const desktopNode of desktopSubtree) {
              const oldNode = oldNodesBySharedId.get(
                desktopNode.sharedId || ""
              );
              const cloned: Node = {
                ...desktopNode,
                id: oldNode?.id || nanoid(),
                style: { ...desktopNode.style },
              };

              if (oldNode?.independentStyles) {
                Object.keys(oldNode.style).forEach((prop) => {
                  if (oldNode.independentStyles![prop]) {
                    cloned.style[prop] = oldNode.style[prop];
                    cloned.independentStyles = cloned.independentStyles || {};
                    cloned.independentStyles[prop] = true;
                  }
                });
              }

              idMap.set(desktopNode.id, cloned.id);
              draft.nodes.push(cloned);
            }

            for (const dNode of desktopSubtree) {
              const newId = idMap.get(dNode.id);
              if (!newId) continue;

              const clonedNode = draft.nodes.find((n) => n.id === newId);
              if (!clonedNode) continue;

              if (dNode.parentId === desktop.id) {
                clonedNode.parentId = viewport.id;
              } else {
                const newParent = idMap.get(dNode.parentId || "");
                clonedNode.parentId = newParent ?? null;
              }
            }
          });
        }),
      { ...options, skipHistory: true }
    );
  }

  updateNode(
    nodeId: string | number,
    props: Partial<Node>,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const node = draft.nodes.find((n) => n.id === nodeId);
          if (node) {
            Object.assign(node, props);
          }
        }),
      options
    );
  }

  reorderNode(
    nodeId: string | number,
    targetParentId: string | number,
    targetIndex: number,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          // Find the node
          const idx = draft.nodes.findIndex((n) => n.id === nodeId);
          if (idx === -1) return;
          const node = draft.nodes[idx];

          // Remove from old position
          draft.nodes.splice(idx, 1);

          // Find siblings in target parent
          const siblings = draft.nodes
            .map((n, idx) => ({ node: n, index: idx }))
            .filter((obj) => obj.node.parentId === targetParentId);

          // Calculate insert position
          let insertIndex;
          if (siblings.length === 0) {
            insertIndex = draft.nodes.length;
          } else if (targetIndex >= siblings.length) {
            insertIndex = siblings[siblings.length - 1].index + 1;
          } else {
            insertIndex = siblings[targetIndex].index;
          }

          // Update node properties
          node.parentId = targetParentId;
          node.inViewport = true;
          node.style.position = "relative";

          if (!node.sharedId) {
            node.sharedId = nanoid();
          }

          // Insert at new position
          draft.nodes.splice(insertIndex, 0, node);
        }),
      options
    );
  }

  /**
   * Sync from a given viewport to all the others, including desktop.
   * BFS from that viewport, replicate to other frames, but skip removing the viewport node itself.
   */
  syncFromViewport(
    sourceViewportId: string | number,
    options?: SetStateOptions
  ) {
    this.setState(
      (prev) =>
        produce(prev, (draft) => {
          const sourceSubtree = getSubtree(draft.nodes, sourceViewportId);

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

            for (const oldNode of oldSubtree) {
              if (oldNode.isViewport) continue;
              const idx = draft.nodes.findIndex((x) => x.id === oldNode.id);
              if (idx !== -1) {
                draft.nodes.splice(idx, 1);
              }
            }

            const idMap = new Map<string | number, string | number>();
            for (const srcNode of sourceSubtree) {
              const cloned: Node = {
                ...srcNode,
                id: nanoid(),
                style: { ...srcNode.style },
              };

              const oldVnode = oldMap.get(srcNode.sharedId as string);
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
        }),
      options
    );
  }
}

function getSubtree(
  nodes: Node[],
  rootId: string | number,
  includeRoot = false
): Node[] {
  const result: Node[] = [];

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
