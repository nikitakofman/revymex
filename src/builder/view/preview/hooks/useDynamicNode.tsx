import { useState, useEffect, useCallback } from "react";
import { ResponsiveNode } from "../types";
import {
  findNodeById,
  replaceNode,
  processInitialDynamicNodes,
} from "../utils/nodeUtils";

/**
 * Hook to manage dynamic nodes and their interactions
 */
export const useDynamicNodes = (initialNodes: ResponsiveNode[]) => {
  // Track the current state of nodes (including any active variants)
  const [activeNodes, setActiveNodes] = useState<ResponsiveNode[]>([]);

  // Process initial nodes when they change
  useEffect(() => {
    // Process any "load" dynamic connections
    const processed = processInitialDynamicNodes(initialNodes);
    setActiveNodes(processed);
  }, [initialNodes]);

  // Handle node interactions
  const handleNodeInteraction = useCallback(
    (sourceId: string, eventType: string) => {
      // Find the source node
      const sourceNode = findNodeById(activeNodes, sourceId);
      if (!sourceNode?.isDynamic || !sourceNode.dynamicConnections) return;

      // Find matching connection for this event type
      const connection = sourceNode.dynamicConnections.find(
        (conn) => conn.sourceId === sourceId && conn.type === eventType
      );

      if (!connection) return;

      // Find the target node - look in initial nodes to get the original definition
      const targetNode = findNodeById(initialNodes, connection.targetId);
      if (!targetNode) return;

      // Replace the source node with the target node in our active nodes
      const updatedNodes = replaceNode(activeNodes, sourceId, targetNode);
      setActiveNodes(updatedNodes);
    },
    [activeNodes, initialNodes]
  );

  // Reset to initial state
  const resetDynamicNodes = useCallback(() => {
    const processed = processInitialDynamicNodes(initialNodes);
    setActiveNodes(processed);
  }, [initialNodes]);

  return {
    activeNodes,
    handleNodeInteraction,
    resetDynamicNodes,
  };
};
