import { Node, ResponsiveNode } from "../types";

/**
 * Utility function to find a node by ID in a tree structure
 */
export const findNodeById = (
  nodes: ResponsiveNode[],
  nodeId: string
): ResponsiveNode | undefined => {
  // First check at the top level
  const directMatch = nodes.find((node) => node.id === nodeId);
  if (directMatch) {
    return directMatch;
  }

  // Then recursively check children
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const childMatch = findNodeById(node.children, nodeId);
      if (childMatch) {
        return childMatch;
      }
    }
  }

  return undefined;
};

/**
 * Recursively replace a node in the tree with a new node
 */
export const replaceNode = (
  nodes: ResponsiveNode[],
  nodeIdToReplace: string,
  replacementNode: ResponsiveNode
): ResponsiveNode[] => {
  return nodes.map((node) => {
    // If this is the node to replace, return the replacement
    if (node.id === nodeIdToReplace) {
      // Ensure the replacement maintains the same parent
      return {
        ...replacementNode,
        parentId: node.parentId,
      };
    }

    // If this node has children, process them recursively
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: replaceNode(node.children, nodeIdToReplace, replacementNode),
      };
    }

    // Otherwise return the node unchanged
    return node;
  });
};

/**
 * Process a node tree to activate any "load" dynamic connections
 */
export const processInitialDynamicNodes = (
  nodes: ResponsiveNode[]
): ResponsiveNode[] => {
  let processedNodes = [...nodes];

  // Find all nodes with "load" dynamic connections
  nodes.forEach((node) => {
    if (node.isDynamic && node.dynamicConnections) {
      const loadConnection = node.dynamicConnections.find(
        (conn) => conn.sourceId === node.id && conn.type === "load"
      );

      if (loadConnection) {
        const targetNode = findNodeById(nodes, loadConnection.targetId);
        if (targetNode) {
          processedNodes = replaceNode(processedNodes, node.id, targetNode);
        }
      }
    }

    // Also check children recursively
    if (node.children && node.children.length > 0) {
      const processedChildren = processInitialDynamicNodes(node.children);
      if (processedChildren !== node.children) {
        const nodeIndex = processedNodes.findIndex((n) => n.id === node.id);
        if (nodeIndex !== -1) {
          processedNodes[nodeIndex] = {
            ...processedNodes[nodeIndex],
            children: processedChildren,
          };
        }
      }
    }
  });

  return processedNodes;
};
