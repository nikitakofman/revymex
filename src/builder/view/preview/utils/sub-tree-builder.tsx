import { Node, ResponsiveNode } from "../types";

/**
 * Builds a responsive node subtree starting from a specific node ID.
 * This function processes all children recursively and creates a complete
 * responsive hierarchy.
 *
 * @param rootId The ID of the root node to build the subtree from
 * @param originalNodes The flat array of all original nodes
 * @returns A ResponsiveNode subtree, or undefined if the root node is not found
 */
export const buildResponsiveSubtree = (
  rootId: string,
  originalNodes: Node[]
): ResponsiveNode | undefined => {
  // Find the root node
  const rootNode = originalNodes.find((node) => node.id === rootId);
  if (!rootNode) {
    console.warn(`Root node ${rootId} not found in original nodes`);
    return undefined;
  }

  // Process node recursively, including all children
  const processNode = (node: Node): ResponsiveNode => {
    // Create the responsive node
    const responsiveNode: ResponsiveNode = {
      ...node,
      responsiveStyles: {},
      children: [],
    };

    // Find all direct children of this node
    const childNodes = originalNodes.filter(
      (childNode) => childNode.parentId === node.id
    );

    // Process children recursively
    if (childNodes.length > 0) {
      console.log(`Node ${node.id} has ${childNodes.length} direct children`);
      responsiveNode.children = childNodes.map(processNode);
    }

    return responsiveNode;
  };

  // Build the complete subtree
  return processNode(rootNode);
};
