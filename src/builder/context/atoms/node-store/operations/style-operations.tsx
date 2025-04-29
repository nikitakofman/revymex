import { CSSProperties } from "react";
import {
  NodeId,
  nodeStore,
  nodeStyleAtom,
  changedNodesAtom,
  batchNodeUpdates,
} from "../";
import { STYLE_RULES } from "../rules/style-rules";

/**
 * Update a node's style and propagate changes to nodes with the same sharedId
 */
export function updateNodeStyle(nodeId: NodeId, style: CSSProperties): void {
  // Batch all operations to minimize re-renders
  batchNodeUpdates(() => {
    // First, update the source node's style
    nodeStore.set(nodeStyleAtom(nodeId), {
      ...nodeStore.get(nodeStyleAtom(nodeId)),
      ...style,
    });

    // Collect all operations from rules
    const operations: StyleOperation[] = [];

    // Apply rules to generate operations
    STYLE_RULES.forEach((rule) => {
      if (rule.condition(nodeId, style)) {
        const ruleOps = rule.operations(nodeId, style);
        operations.push(...ruleOps);

        // Execute any "after" hooks
        if (rule.after) {
          rule.after(nodeId, style);
        }
      }
    });

    // Apply all operations
    applyStyleOperations(operations);

    // Mark source node as changed
    nodeStore.set(changedNodesAtom, (prev) => {
      const newSet = new Set(prev);
      newSet.add(nodeId);
      return newSet;
    });
  });
}

// Type for style operations
interface StyleOperation {
  type: "update";
  targetId: NodeId;
  style: CSSProperties;
  reason: string;
}

/**
 * Apply a list of style operations to the node store
 */
function applyStyleOperations(operations: StyleOperation[]): void {
  // Track nodes that were changed
  const changedNodes = new Set<NodeId>();

  // Apply each operation
  operations.forEach((op) => {
    if (op.type === "update") {
      // Update the target node's style
      nodeStore.set(nodeStyleAtom(op.targetId), {
        ...nodeStore.get(nodeStyleAtom(op.targetId)),
        ...op.style,
      });

      // Mark node as changed
      changedNodes.add(op.targetId);
    }
  });

  // Update the changed nodes atom
  if (changedNodes.size > 0) {
    nodeStore.set(changedNodesAtom, (prev) => {
      const newSet = new Set(prev);
      changedNodes.forEach((id) => newSet.add(id));
      return newSet;
    });
  }
}

/**
 * React hook to update a node's style with synchronization
 */
export function useUpdateNodeStyleWithSync(nodeId: NodeId) {
  return (style: CSSProperties) => {
    updateNodeStyle(nodeId, style);
  };
}
