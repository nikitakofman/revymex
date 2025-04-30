// src/builder/context/rules/node-operations.ts
import { Node } from "@/builder/reducer/nodeDispatcher";
import {
  NodeId,
  nodeStore,
  nodeIdsAtom,
  nodeBasicsAtom,
  nodeParentAtom,
  nodeStyleAtom,
  nodeFlagsAtom,
  nodeSharedInfoAtom,
  changedNodesAtom,
  batchNodeUpdates,
} from "../";

/**
 * Types of node operations that can be performed
 */
export type NodeOperationType =
  | "insert"
  | "remove"
  | "move"
  | "update"
  | "reorder";

/**
 * Base interface for all node operations
 */
export interface NodeOperation {
  type: NodeOperationType;
  nodeId: NodeId;
  reason?: string;
}

/**
 * Insert a node at a specific index in a parent
 */
export interface InsertNodeOperation extends NodeOperation {
  type: "insert";
  node: Node;
  parentId: NodeId | null;
  index: number;
}

/**
 * Remove a node from the tree
 */
export interface RemoveNodeOperation extends NodeOperation {
  type: "remove";
}

/**
 * Move a node to a new parent or position
 */
export interface MoveNodeOperation extends NodeOperation {
  type: "move";
  targetId?: NodeId | null;
  position?: "before" | "after" | "inside" | null;
  index?: number;
  inViewport?: boolean;
  newPosition?: { x: number; y: number };
}

/**
 * Update node properties
 */
export interface UpdateNodeOperation extends NodeOperation {
  type: "update";
  updates: Partial<Node>;
}

/**
 * Change order among siblings
 */
export interface ReorderNodeOperation extends NodeOperation {
  type: "reorder";
  parentId: NodeId | null;
  index: number;
}

/**
 * Union of all operation types
 */
export type NodeOperations =
  | InsertNodeOperation
  | RemoveNodeOperation
  | MoveNodeOperation
  | UpdateNodeOperation
  | ReorderNodeOperation;

/**
 * Apply a batch of node operations to the store
 */
export function applyNodeOperations(operations: NodeOperations[]): void {
  batchNodeUpdates(() => {
    // Track which nodes were changed for efficient updates
    const changedNodeIds = new Set<NodeId>();

    // Apply each operation in order
    operations.forEach((operation) => {
      switch (operation.type) {
        case "insert":
          applyInsertOperation(operation, changedNodeIds);
          break;
        case "remove":
          applyRemoveOperation(operation, changedNodeIds);
          break;
        case "move":
          applyMoveOperation(operation, changedNodeIds);
          break;
        case "update":
          applyUpdateOperation(operation, changedNodeIds);
          break;
        case "reorder":
          applyReorderOperation(operation, changedNodeIds);
          break;
      }
    });

    // Update the changed nodes atom once at the end
    nodeStore.set(changedNodesAtom, (prev: Set<NodeId>) => {
      const newSet = new Set(prev);
      changedNodeIds.forEach((id) => newSet.add(id));
      return newSet;
    });
  });
}

/**
 * Apply an insert operation to add a node
 */
function applyInsertOperation(
  operation: InsertNodeOperation,
  changedNodeIds: Set<NodeId>
): void {
  const { node, parentId, index } = operation;

  // Get all node IDs
  const nodeIds = nodeStore.get(nodeIdsAtom);

  // Get siblings with the same parent
  const siblingsWithIndices = nodeIds
    .filter((id) => {
      const nodeParent = nodeStore.get(nodeParentAtom(id));
      return nodeParent === parentId;
    })
    .map((id, idx) => ({ id, index: idx }));

  // Determine insertion position in the overall node array
  let insertionIndex = nodeIds.length; // Default to end of array

  if (siblingsWithIndices.length > 0) {
    if (index >= siblingsWithIndices.length) {
      // After the last sibling
      const lastSiblingId =
        siblingsWithIndices[siblingsWithIndices.length - 1].id;
      insertionIndex = nodeIds.indexOf(lastSiblingId) + 1;
    } else {
      // At the specified position
      const targetSiblingId = siblingsWithIndices[index].id;
      insertionIndex = nodeIds.indexOf(targetSiblingId);
    }
  }

  // Update the node IDs atom with the new node ID
  const newNodeIds = [...nodeIds];
  newNodeIds.splice(insertionIndex, 0, node.id);
  nodeStore.set(nodeIdsAtom, newNodeIds);

  // Basic properties
  nodeStore.set(nodeBasicsAtom(node.id), {
    id: node.id,
    type: node.type,
    customName: node.customName,
  });

  // Style
  nodeStore.set(nodeStyleAtom(node.id), node.style || {});

  // Parent
  nodeStore.set(nodeParentAtom(node.id), parentId);

  // Flags
  nodeStore.set(nodeFlagsAtom(node.id), {
    isLocked: node.isLocked,
    inViewport: node.inViewport !== false,
    isViewport: node.isViewport,
    viewportName: node.viewportName,
    viewportWidth: node.viewportWidth,
    isAbsoluteInFrame: node.isAbsoluteInFrame,
  });

  // Shared info (if applicable)
  if (node.sharedId) {
    nodeStore.set(nodeSharedInfoAtom(node.id), { sharedId: node.sharedId });
  }

  // Mark as changed
  changedNodeIds.add(node.id);

  // Also mark parent as changed since its children list changes
  if (parentId) {
    changedNodeIds.add(parentId);
  }
}

/**
 * Apply a remove operation to delete a node
 */
function applyRemoveOperation(
  operation: RemoveNodeOperation,
  changedNodeIds: Set<NodeId>
): void {
  const { nodeId } = operation;

  // Get parent ID before removing (so we can mark it as changed)
  const parentId = nodeStore.get(nodeParentAtom(nodeId));

  // Update the node IDs atom by removing this ID
  const nodeIds = nodeStore.get(nodeIdsAtom);
  const newNodeIds = nodeIds.filter((id) => id !== nodeId);
  nodeStore.set(nodeIdsAtom, newNodeIds);

  // No need to remove individual atoms as they'll be garbage collected
  // when no longer referenced

  // Mark parent as changed since its children list changes
  if (parentId) {
    changedNodeIds.add(parentId);
  }
}

/**
 * Apply a move operation to relocate a node
 */
function applyMoveOperation(
  operation: MoveNodeOperation,
  changedNodeIds: Set<NodeId>
): void {
  const { nodeId, targetId, position, index, inViewport, newPosition } =
    operation;

  // Get current node IDs
  const nodeIds = nodeStore.get(nodeIdsAtom);

  // First, get the current parent to mark it as changed later
  const currentParentId = nodeStore.get(nodeParentAtom(nodeId));

  // Remove the node from its current position
  const newNodeIds = nodeIds.filter((id) => id !== nodeId);

  // Determine new parent and insertion position
  let newParentId = currentParentId;
  let insertionIndex = newNodeIds.length; // Default to end

  if (!inViewport) {
    // Moving to canvas - no parent
    newParentId = null;

    // Update style for absolute positioning if moving to canvas
    nodeStore.set(nodeStyleAtom(nodeId), (prevStyle) => ({
      ...prevStyle,
      position: "absolute",
      ...(newPosition
        ? {
            left: `${newPosition.x}px`,
            top: `${newPosition.y}px`,
          }
        : {}),
    }));

    // Update inViewport flag
    nodeStore.set(nodeFlagsAtom(nodeId), (prevFlags) => ({
      ...prevFlags,
      inViewport: false,
    }));
  } else if (targetId != null && position) {
    // Moving relative to another node
    if (position === "inside") {
      // Inside target - target becomes parent
      newParentId = targetId;

      // Find position after all existing children
      const targetChildren = nodeIds.filter(
        (id) => nodeStore.get(nodeParentAtom(id)) === targetId
      );

      if (targetChildren.length > 0) {
        const lastChildIndex = newNodeIds.indexOf(
          targetChildren[targetChildren.length - 1]
        );
        insertionIndex = lastChildIndex + 1;
      } else {
        const targetIndex = newNodeIds.indexOf(targetId);
        insertionIndex = targetIndex + 1;
      }
    } else {
      // Before or after target - same parent as target
      const targetParentId = nodeStore.get(nodeParentAtom(targetId));
      newParentId = targetParentId;

      // Find index of target
      const targetIndex = newNodeIds.indexOf(targetId);
      insertionIndex = position === "after" ? targetIndex + 1 : targetIndex;
    }

    // Update style for relative positioning
    nodeStore.set(nodeStyleAtom(nodeId), (prevStyle) => ({
      ...prevStyle,
      position: "relative",
      left: undefined,
      top: undefined,
    }));

    // Update inViewport flag
    nodeStore.set(nodeFlagsAtom(nodeId), (prevFlags) => ({
      ...prevFlags,
      inViewport: true,
    }));
  } else if (typeof index === "number") {
    // Moving to a specific index within current parent
    const siblings = nodeIds.filter(
      (id) => nodeStore.get(nodeParentAtom(id)) === newParentId && id !== nodeId
    );

    if (index < siblings.length) {
      insertionIndex = newNodeIds.indexOf(siblings[index]);
    } else if (siblings.length > 0) {
      insertionIndex = newNodeIds.indexOf(siblings[siblings.length - 1]) + 1;
    }
  }

  // Update parent
  nodeStore.set(nodeParentAtom(nodeId), newParentId);

  // Insert node at new position
  newNodeIds.splice(insertionIndex, 0, nodeId);
  nodeStore.set(nodeIdsAtom, newNodeIds);

  // Mark as changed
  changedNodeIds.add(nodeId);

  // Mark old and new parents as changed
  if (currentParentId) {
    changedNodeIds.add(currentParentId);
  }
  if (newParentId && newParentId !== currentParentId) {
    changedNodeIds.add(newParentId);
  }
}

/**
 * Apply an update operation to modify node properties
 */
function applyUpdateOperation(
  operation: UpdateNodeOperation,
  changedNodeIds: Set<NodeId>
): void {
  const { nodeId, updates } = operation;

  // Apply each property update to the appropriate atom
  if (updates.type !== undefined || updates.customName !== undefined) {
    nodeStore.set(nodeBasicsAtom(nodeId), (prevBasics) => ({
      ...prevBasics,
      ...(updates.type !== undefined ? { type: updates.type } : {}),
      ...(updates.customName !== undefined
        ? { customName: updates.customName }
        : {}),
    }));
  }

  if (updates.style !== undefined) {
    nodeStore.set(nodeStyleAtom(nodeId), (prevStyle) => ({
      ...prevStyle,
      ...updates.style,
    }));
  }

  if (updates.parentId !== undefined) {
    nodeStore.set(nodeParentAtom(nodeId), updates.parentId);
  }

  if (
    updates.isLocked !== undefined ||
    updates.inViewport !== undefined ||
    updates.isViewport !== undefined ||
    updates.viewportName !== undefined ||
    updates.viewportWidth !== undefined ||
    updates.isAbsoluteInFrame !== undefined
  ) {
    nodeStore.set(nodeFlagsAtom(nodeId), (prevFlags) => ({
      ...prevFlags,
      ...(updates.isLocked !== undefined ? { isLocked: updates.isLocked } : {}),
      ...(updates.inViewport !== undefined
        ? { inViewport: updates.inViewport }
        : {}),
      ...(updates.isViewport !== undefined
        ? { isViewport: updates.isViewport }
        : {}),
      ...(updates.viewportName !== undefined
        ? { viewportName: updates.viewportName }
        : {}),
      ...(updates.viewportWidth !== undefined
        ? { viewportWidth: updates.viewportWidth }
        : {}),
      ...(updates.isAbsoluteInFrame !== undefined
        ? { isAbsoluteInFrame: updates.isAbsoluteInFrame }
        : {}),
    }));
  }

  if (updates.sharedId !== undefined) {
    nodeStore.set(nodeSharedInfoAtom(nodeId), { sharedId: updates.sharedId });
  }

  // Mark as changed
  changedNodeIds.add(nodeId);
}

/**
 * Apply a reorder operation to change node order among siblings
 */
function applyReorderOperation(
  operation: ReorderNodeOperation,
  changedNodeIds: Set<NodeId>
): void {
  const { nodeId, parentId, index } = operation;

  // Get all node IDs
  const nodeIds = nodeStore.get(nodeIdsAtom);

  // Remove the node from its current position
  const nodeIndex = nodeIds.indexOf(nodeId);
  if (nodeIndex === -1) return; // Node not found

  // Create a new array without the node
  const newNodeIds = [...nodeIds];
  newNodeIds.splice(nodeIndex, 1);

  // Get siblings with the same parent
  const siblings = nodeIds.filter(
    (id) => id !== nodeId && nodeStore.get(nodeParentAtom(id)) === parentId
  );

  let insertionIndex: number;

  if (siblings.length === 0) {
    // No siblings, determine appropriate insertion point
    if (parentId) {
      // After parent
      const parentIndex = newNodeIds.indexOf(parentId);
      insertionIndex = parentIndex + 1;
    } else {
      // At the end
      insertionIndex = newNodeIds.length;
    }
  } else {
    // Determine insertion index based on siblings
    if (index >= siblings.length) {
      // After last sibling
      const lastSiblingIndex = newNodeIds.indexOf(
        siblings[siblings.length - 1]
      );
      insertionIndex = lastSiblingIndex + 1;
    } else {
      // At the specified position among siblings
      insertionIndex = newNodeIds.indexOf(siblings[index]);
    }
  }

  // Insert node at new position
  newNodeIds.splice(insertionIndex, 0, nodeId);
  nodeStore.set(nodeIdsAtom, newNodeIds);

  // Update parent if needed
  const currentParent = nodeStore.get(nodeParentAtom(nodeId));
  if (currentParent !== parentId) {
    nodeStore.set(nodeParentAtom(nodeId), parentId);
  }

  // Mark as changed
  changedNodeIds.add(nodeId);

  // Mark parent as changed
  if (parentId) {
    changedNodeIds.add(parentId);
  }
}

/**
 * Helper function to create an insert operation
 */
export function createInsertOperation(
  node: Node,
  parentId: NodeId | null,
  index: number
): InsertNodeOperation {
  return {
    type: "insert",
    nodeId: node.id,
    node,
    parentId,
    index,
  };
}

/**
 * Helper function to create a remove operation
 */
export function createRemoveOperation(nodeId: NodeId): RemoveNodeOperation {
  return {
    type: "remove",
    nodeId,
  };
}

/**
 * Helper function to create a move operation
 */
export function createMoveOperation(
  nodeId: NodeId,
  options: {
    targetId?: NodeId | null;
    position?: "before" | "after" | "inside" | null;
    index?: number;
    inViewport?: boolean;
    newPosition?: { x: number; y: number };
  }
): MoveNodeOperation {
  return {
    type: "move",
    nodeId,
    ...options,
  };
}

/**
 * Helper function to create an update operation
 */
export function createUpdateOperation(
  nodeId: NodeId,
  updates: Partial<Node>
): UpdateNodeOperation {
  return {
    type: "update",
    nodeId,
    updates,
  };
}

/**
 * Helper function to create a reorder operation
 */
export function createReorderOperation(
  nodeId: NodeId,
  parentId: NodeId | null,
  index: number
): ReorderNodeOperation {
  return {
    type: "reorder",
    nodeId,
    parentId,
    index,
  };
}
