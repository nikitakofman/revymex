import { nodeIdsAtom } from "..";
import { NodeId, nodeStore, nodeSharedInfoAtom } from "../";
import { CSSProperties } from "react";

// Rule creator helper function
const r = <T>(rule: T) => rule;

// Type for a style rule
interface StyleRule {
  name: string;
  description: string;
  condition: (nodeId: NodeId, style: CSSProperties) => boolean;
  operations: (nodeId: NodeId, style: CSSProperties) => StyleOperation[];
  after?: (nodeId: NodeId, style: CSSProperties) => void;
}

// Type for style operations
interface StyleOperation {
  type: "update";
  targetId: NodeId;
  style: CSSProperties;
  reason: string;
}

// Simple rule to update style on all nodes with the same sharedId
export const STYLE_RULES: StyleRule[] = [
  r({
    name: "update-shared-nodes",
    description: "Update style on all nodes with the same sharedId",
    condition: (nodeId, style) => {
      // Check if node has a sharedId
      const nodeSharedInfo = nodeStore.get(nodeSharedInfoAtom(nodeId));
      return !!nodeSharedInfo.sharedId;
    },
    operations: (nodeId, style) => {
      // Get node's sharedId
      const nodeSharedInfo = nodeStore.get(nodeSharedInfoAtom(nodeId));
      const sharedId = nodeSharedInfo.sharedId;
      if (!sharedId) return [];

      // Find all nodes with the same sharedId
      const operations: StyleOperation[] = [];

      // Get all nodes with this sharedId
      const sharedNodes = findNodesWithSharedId(sharedId);

      // Create operations to update style for each node except the source node
      sharedNodes
        .filter((id) => id !== nodeId)
        .forEach((targetId) => {
          operations.push({
            type: "update",
            targetId,
            style,
            reason: `Syncing style to shared node ${targetId}`,
          });
        });

      return operations;
    },
  }),
];

// Helper function to find nodes with the same sharedId
function findNodesWithSharedId(sharedId: string): NodeId[] {
  // This is a simple implementation - in a real app, you'd want to use a more efficient lookup
  const result: NodeId[] = [];

  // Get all node IDs from the store
  const allNodeIds = nodeStore.get(nodeIdsAtom);

  // Check each node's sharedId
  allNodeIds.forEach((id) => {
    const nodeSharedInfo = nodeStore.get(nodeSharedInfoAtom(id));
    if (nodeSharedInfo.sharedId === sharedId) {
      result.push(id);
    }
  });

  return result;
}
