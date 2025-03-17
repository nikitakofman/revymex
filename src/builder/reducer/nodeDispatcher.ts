import { original, produce } from "immer";
import { nanoid } from "nanoid";
import { CSSProperties } from "react";
import { findParentViewport } from "../context/utils";

export interface Position {
  x: number;
  y: number;
}

export interface VariantInfo {
  name: string;
  id: string;
}

export interface Node {
  id: string;
  type: "frame" | "image" | "text" | "placeholder" | string;
  customName?: string;
  dynamicState?: {
    hovered?: CSSProperties & {
      src?: string;
      text?: string;
      backgroundImage?: string;
      isVideoBackground?: boolean;
      backgroundVideo?: string;
    };
  };
  style: CSSProperties & {
    src?: string;
    text?: string;
    backgroundImage?: string;
    isVideoBackground?: boolean;
    backgroundVideo?: string;
  };
  isLocked?: boolean;
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
  viewportName?: string;
  viewportWidth?: number;
  isDynamic?: boolean;
  dynamicParentId?: string | number;
  dynamicConnections?: {
    sourceId: string | number;
    targetId: string | number;
    type: "click" | "hover" | "mouseLeave";
  }[];
  dynamicPosition?: Position;
  originalState?: {
    parentId: string | number | null;
    inViewport: boolean;
  };
  isAbsoluteInFrame?: boolean;
  isVariant?: boolean;
  variantParentId?: string | number;
  variantInfo?: VariantInfo;
}

export interface NodeState {
  nodes: Node[];
}

export interface SetStateOptions {
  skipHistory?: boolean;
  batch?: boolean;
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
        // Ensure node has a sharedId if it's going to be in a viewport
        const newNode = {
          ...node,
          inViewport: shouldBeInViewport,
          // Add a sharedId if missing and node will be in a viewport
          sharedId:
            shouldBeInViewport && !node.sharedId ? nanoid() : node.sharedId,
        };

        // Also clean up incompatible properties based on node type
        if (newNode.type === "image") {
          // Remove text property from image nodes
          if (newNode.style.text) delete newNode.style.text;
          if (newNode.text) delete newNode.text;
        } else if (newNode.type === "text") {
          // Remove src property from text nodes
          if (newNode.style.src) delete newNode.style.src;
          if (newNode.src) delete newNode.src;
        }

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

  updateNodeStyle(
    nodeIds: (string | number)[],
    style: Partial<CSSProperties>,
    dynamicState?: string
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find all nodes that match the nodeIds
        const nodesToUpdate = draft.nodes.filter((n) => nodeIds.includes(n.id));

        if (nodesToUpdate.length === 0) return;

        // Split style properties into positioning and non-positioning
        const positioningStyles: Partial<CSSProperties> = {};
        const otherStyles: Partial<CSSProperties> = {};

        // Extract positioning properties
        ["left", "top", "right", "bottom", "position"].forEach((prop) => {
          if (prop in style) {
            positioningStyles[prop] = style[prop];
          }
        });

        // All remaining properties go to otherStyles
        Object.assign(otherStyles, style);

        // Update each node
        nodesToUpdate.forEach((node) => {
          const viewportId = findParentViewport(node.parentId, draft.nodes);

          if (viewportId && viewportId !== "viewport-1440") {
            if (!node.independentStyles) node.independentStyles = {};

            // Update independentStyles for all style properties
            [
              ...Object.keys(positioningStyles),
              ...Object.keys(otherStyles),
            ].forEach((prop) => {
              node.independentStyles![prop] = true;
            });
          }

          // Always apply positioning styles to the normal state
          Object.assign(node.style, positioningStyles);

          // Apply other styles according to the dynamic state
          if (
            dynamicState === "hovered" &&
            Object.keys(otherStyles).length > 0
          ) {
            // Initialize dynamicState object if it doesn't exist
            if (!node.dynamicState) node.dynamicState = {};
            // Initialize hovered object if it doesn't exist
            if (!node.dynamicState.hovered) node.dynamicState.hovered = {};

            // Update the hovered styles with non-positioning properties
            Object.assign(node.dynamicState.hovered, otherStyles);
          } else {
            // Apply all styles to normal state if not in hover state
            Object.assign(node.style, otherStyles);
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

  reorderNode(
    nodeId: string | number,
    targetParentId: string | number,
    targetIndex: number
  ) {
    this.setState((prev) =>
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
      index?: number;
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

          // If index is provided, use it directly
          if (typeof options.index === "number") {
            const siblings = draft.nodes.filter(
              (n) => n.parentId === targetNode.parentId
            );
            const insertIndex = Math.min(options.index, siblings.length);
            const globalIndices = siblings.map((s) => draft.nodes.indexOf(s));
            const insertGlobalIndex =
              globalIndices[insertIndex] || draft.nodes.length;
            draft.nodes.splice(insertGlobalIndex, 0, node);
            return;
          }

          // Otherwise use before/after position
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

  updateDynamicPosition(id: string | number, position: Position) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const targetNode = draft.nodes.find((n) => n.id === id);
        if (targetNode) {
          targetNode.dynamicPosition = position;
        }
      })
    );
  }

  updateNodeDynamicStatus(nodeId: string | number) {
    this.setState((prev) =>
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
      })
    );
  }

  storeDynamicNodeState(nodeId: string | number | null) {
    this.setState((prev) =>
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
      })
    );
  }

  setCustomName(nodeId: string | number, customName: string) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // First find the node we're directly naming
        const node = draft.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Set its custom name
        node.customName = customName;

        // If this node has a sharedId, update all other nodes with the same sharedId
        if (node.sharedId) {
          draft.nodes.forEach((otherNode) => {
            if (
              otherNode.id !== nodeId &&
              otherNode.sharedId === node.sharedId
            ) {
              otherNode.customName = customName;
            }
          });
        }
      })
    );
  }

  resetDynamicNodePositions() {
    this.setState((prev) =>
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
      })
    );
  }

  duplicateDynamicElement(nodeId: string | number, elementWidth?: number) {
    let duplicateId = "";

    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the original node
        const originalNode = draft.nodes.find((n) => n.id === nodeId);
        if (!originalNode) return;

        // Determine if this is the main dynamic node
        const isMainDynamicNode =
          originalNode.isDynamic && !originalNode.dynamicParentId;

        // Set dynamicParentId to either the current node (if main) or keep the original's dynamicParentId
        const dynamicParentId = isMainDynamicNode
          ? nodeId
          : originalNode.dynamicParentId;

        // Create duplicate with proper properties
        duplicateId = nanoid();
        const duplicate: Node = {
          id: duplicateId,
          type: originalNode.type,
          style: {
            ...originalNode.style,
            left: `${
              parseFloat(originalNode.style.left) + elementWidth + 200
            }px`,
            top: `${parseFloat(originalNode.style.top)}px`,
          },
          // Never make the duplicate a main dynamic node
          isDynamic: false,
          // Set dynamicParentId to ensure it appears in dynamic editor
          dynamicParentId,
          // Keep it out of viewport
          inViewport: false,
          parentId: null,
        };

        // Copy over other important properties
        if (originalNode.customName)
          duplicate.customName = originalNode.customName;
        if (originalNode.src) duplicate.src = originalNode.src;
        if (originalNode.text) duplicate.text = originalNode.text;
        if (originalNode.dynamicState)
          duplicate.dynamicState = { ...originalNode.dynamicState };

        // Add to nodes array
        draft.nodes.push(duplicate);

        // If this is a frame, duplicate all its children
        if (originalNode.type === "frame") {
          const children = getSubtree(draft.nodes, nodeId, false);
          const idMap = new Map<string | number, string | number>();
          idMap.set(nodeId, duplicateId);

          children.forEach((child) => {
            const childDuplicateId = nanoid();

            // Create duplicate child with same properties
            const childDuplicate: Node = {
              id: childDuplicateId,
              type: child.type,
              style: { ...child.style },
              dynamicParentId,
              inViewport: false,
            };

            // Copy other important properties
            if (child.customName) childDuplicate.customName = child.customName;
            if (child.src) childDuplicate.src = child.src;
            if (child.text) childDuplicate.text = child.text;
            if (child.dynamicState)
              childDuplicate.dynamicState = { ...child.dynamicState };

            // Map parent relationships to keep structure
            const originalParentId = child.parentId;
            if (originalParentId) {
              const newParentId = idMap.get(originalParentId);
              if (newParentId) {
                childDuplicate.parentId = newParentId;
              }
            }

            idMap.set(child.id, childDuplicateId);
            draft.nodes.push(childDuplicate);
          });
        }
      })
    );

    return duplicateId;
  }

  /**
   * Add a single dynamic connection, allowing one connection per type per source node.
   * A node can have one click, one hover, and one mouseLeave connection, but not multiple of the same type.
   * @param sourceId Source node ID
   * @param targetId Target node ID
   * @param connectionType Connection type
   * @param dynamicModeNodeId ID of the main dynamic node
   */
  addUniqueDynamicConnection(
    sourceId: string | number,
    targetId: string | number,
    connectionType: "click" | "hover" | "mouseLeave",
    dynamicModeNodeId: string | number
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the source node
        const sourceNode = draft.nodes.find((n) => n.id === sourceId);
        if (!sourceNode) return;

        // Initialize dynamicConnections array if it doesn't exist
        if (!sourceNode.dynamicConnections) {
          sourceNode.dynamicConnections = [];
        }

        // Remove any existing connections of the same type from this source node
        sourceNode.dynamicConnections = sourceNode.dynamicConnections.filter(
          (conn) => conn.type !== connectionType
        );

        // Add the new connection
        sourceNode.dynamicConnections.push({
          sourceId,
          targetId,
          type: connectionType,
        });
      })
    );
  }

  /**
   * Clean up all dynamic connections in the system to ensure one connection per type per target.
   * This allows multiple connections to the same target as long as they have different types.
   * @param dynamicModeNodeId ID of the main dynamic node
   */
  cleanupDynamicConnections(dynamicModeNodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Get all nodes in the dynamic system
        const dynamicNodes = draft.nodes.filter(
          (n) =>
            n.dynamicParentId === dynamicModeNodeId ||
            n.id === dynamicModeNodeId
        );

        // Create a map to track connections by target ID and type
        // The key is a composite of targetId and connection type
        const targetTypeConnectionMap = new Map<
          string, // "targetId-type" as key
          {
            sourceId: string | number;
            targetId: string | number;
            type: "click" | "hover" | "mouseLeave";
          }
        >();

        // First, find all unique connections per target-type combination
        dynamicNodes.forEach((node) => {
          if (!node.dynamicConnections) return;

          node.dynamicConnections.forEach((conn) => {
            const compositeKey = `${conn.targetId}-${conn.type}`;
            targetTypeConnectionMap.set(compositeKey, {
              sourceId: conn.sourceId,
              targetId: conn.targetId,
              type: conn.type || "click", // Default to click if type is missing
            });
          });
        });

        // Clear all connections from all nodes
        dynamicNodes.forEach((node) => {
          if (node.dynamicConnections && node.dynamicConnections.length > 0) {
            node.dynamicConnections = [];
          }
        });

        // Add back unique connections based on target-type combinations
        targetTypeConnectionMap.forEach((conn) => {
          const sourceNode = draft.nodes.find((n) => n.id === conn.sourceId);
          if (sourceNode) {
            if (!sourceNode.dynamicConnections) {
              sourceNode.dynamicConnections = [];
            }
            sourceNode.dynamicConnections.push(conn);
          }
        });
      })
    );
  }

  syncViewports() {
    this.setState((prev) =>
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
            const removeIdx = draft.nodes.findIndex((n) => n.id === oldNode.id);
            if (removeIdx !== -1) {
              draft.nodes.splice(removeIdx, 1);
            }
          }

          const idMap = new Map<string | number, string | number>();

          for (const desktopNode of desktopSubtree) {
            const oldNode = oldNodesBySharedId.get(desktopNode.sharedId || "");
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
      })
    );
  }

  updateNode(nodeId: string | number, props: Partial<Node>) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const node = draft.nodes.find((n) => n.id === nodeId);
        if (node) {
          Object.assign(node, props);
        }
      })
    );
  }

  replaceNode(nodeId: string | number, newNode: Node) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const index = draft.nodes.findIndex((n) => n.id === nodeId);
        if (index !== -1) {
          draft.nodes[index] = {
            ...newNode,
            id: nodeId,
          };
        }
      })
    );
  }

  toggleNodeLock(nodeIds: (string | number)[]) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find all nodes that match the nodeIds
        const nodesToToggle = draft.nodes.filter((n) => nodeIds.includes(n.id));

        if (nodesToToggle.length === 0) return;

        // Check the first node's isLocked state to determine the new state
        // If any node is unlocked, we'll lock all nodes
        const anyUnlocked = nodesToToggle.some((node) => !node.isLocked);
        const newLockState = anyUnlocked;

        // Update each node
        nodesToToggle.forEach((node) => {
          node.isLocked = newLockState;
        });
      })
    );
  }

  createVariant(dynamicNodeId: string | number, variantName: string) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the main dynamic node
        const mainNode = draft.nodes.find((n) => n.id === dynamicNodeId);
        if (!mainNode || !mainNode.isDynamic) return;

        // Create unique ID for the variant
        const variantId = nanoid();
        const variantSlug = variantName.toLowerCase().replace(/\s+/g, "-");

        // Create a completely new node for the variant, instead of modifying the existing one
        const variantNode: Node = {
          id: variantId,
          type: mainNode.type,
          style: { ...mainNode.style },
          isDynamic: false,
          isVariant: true,
          variantParentId: mainNode.id,
          dynamicParentId: mainNode.id,
          // Critical: These must be explicitly set to match dropped elements
          inViewport: false,
          parentId: null,
          position: {
            x: (mainNode.position?.x || 0) + 500,
            y: (mainNode.position?.y || 0) + 200,
          },
          variantInfo: {
            name: variantName,
            id: variantSlug,
          },
        };

        // Only copy needed properties, not problematic ones
        if (mainNode.customName) variantNode.customName = mainNode.customName;
        if (mainNode.src) variantNode.src = mainNode.src;
        if (mainNode.text) variantNode.text = mainNode.text;
        if (mainNode.dynamicState)
          variantNode.dynamicState = { ...mainNode.dynamicState };

        // Add the variant node to the array
        draft.nodes.push(variantNode);

        // Now clone all children of the main node for the variant
        const mainChildren = getSubtree(draft.nodes, mainNode.id, false);

        // Track the mapping from original IDs to new variant IDs
        const idMap = new Map<string | number, string | number>();
        idMap.set(mainNode.id, variantId);

        // Clone each child node
        mainChildren.forEach((childNode) => {
          const childVariantId = nanoid();

          // Create the cloned child with just the needed properties
          const childVariant: Node = {
            id: childVariantId,
            type: childNode.type,
            style: { ...childNode.style },
            // Critical properties for variants
            dynamicParentId: mainNode.id,
            inViewport: false,
            isVariant: true,
            variantParentId: mainNode.id,
          };

          // Only copy needed properties
          if (childNode.customName)
            childVariant.customName = childNode.customName;
          if (childNode.src) childVariant.src = childNode.src;
          if (childNode.text) childVariant.text = childNode.text;
          if (childNode.dynamicState)
            childVariant.dynamicState = { ...childNode.dynamicState };

          // Map the original parent to the new parent in the variant tree
          const originalParentId = childNode.parentId;
          if (originalParentId) {
            const newParentId = idMap.get(originalParentId);
            if (newParentId) {
              childVariant.parentId = newParentId;
            }
          }

          // Store the ID mapping for this node
          idMap.set(childNode.id, childVariantId);

          // Add to the nodes array
          draft.nodes.push(childVariant);
        });
      })
    );
  }

  syncFromViewport(sourceViewportId: string | number) {
    this.setState((prev) =>
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
      })
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
