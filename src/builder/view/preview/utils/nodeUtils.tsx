// nodeUtils.ts
import { ResponsiveNode } from "../types";

/**
 * Recursively find a node by its ID.
 */
export const findNodeById = (
  nodes: ResponsiveNode[],
  nodeId: string
): ResponsiveNode | undefined => {
  if (!nodes || !nodeId) return undefined;
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children && node.children.length > 0) {
      const childMatch = findNodeById(node.children, nodeId);
      if (childMatch) return childMatch;
    }
  }
  return undefined;
};

/**
 * Recursively replace a node in the tree with a new node.
 *
 * Unlike before, we do not force the source node's id if the target is different.
 */
export const replaceNode = (
  nodes: ResponsiveNode[],
  nodeIdToReplace: string,
  replacementNode: ResponsiveNode
): ResponsiveNode[] => {
  return nodes.map((node) => {
    if (node.id === nodeIdToReplace) {
      // Copy target's style; if the source was relative and target is absolute,
      // force relative by removing left/top/right/bottom.
      const targetStyle = { ...replacementNode.style };
      if (
        node.style.position === "relative" &&
        targetStyle.position === "absolute"
      ) {
        targetStyle.position = "relative";
        delete targetStyle.left;
        delete targetStyle.top;
        delete targetStyle.right;
        delete targetStyle.bottom;
      }
      return {
        ...replacementNode,
        parentId: node.parentId,
        style: targetStyle,
      };
    }
    if (node.children && node.children.length > 0) {
      const newChildren = replaceNode(
        node.children,
        nodeIdToReplace,
        replacementNode
      );
      if (newChildren !== node.children) {
        return { ...node, children: newChildren };
      }
    }
    return node;
  });
};

/**
 * Process "load" dynamic connections on initial render.
 */
export const processInitialDynamicNodes = (
  nodes: ResponsiveNode[]
): ResponsiveNode[] => {
  let processedNodes = [...nodes];
  nodes.forEach((node) => {
    if (node.isDynamic && node.dynamicConnections) {
      const loadConnection = node.dynamicConnections.find(
        (conn) => conn.type === "load"
      );
      if (loadConnection) {
        const targetNode = findNodeById(nodes, loadConnection.targetId);
        if (targetNode) {
          processedNodes = processedNodes.map((n) =>
            n.id === node.id ? targetNode : n
          );
        }
      }
    }
    if (node.children && node.children.length > 0) {
      const processedChildren = processInitialDynamicNodes(node.children);
      if (processedChildren !== node.children) {
        processedNodes = processedNodes.map((n) =>
          n.id === node.id ? { ...n, children: processedChildren } : n
        );
      }
    }
  });
  return processedNodes;
};
