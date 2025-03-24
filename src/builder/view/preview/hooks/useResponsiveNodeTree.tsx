import { useMemo } from "react";
import { Node, ResponsiveNode, Viewport } from "../types";

export const useResponsiveNodeTree = (
  nodes: Node[],
  viewportBreakpoints: Viewport[]
) => {
  // Using useMemo at the top level of the hook (not inside another hook)
  return useMemo(() => {
    // Build the responsive node tree
    return buildResponsiveNodeTree(nodes, viewportBreakpoints);
  }, [nodes, viewportBreakpoints]);
};

// Extract the tree building logic to a separate function outside of any hooks
export const buildResponsiveNodeTree = (nodes, viewportBreakpoints) => {
  // First identify all unique shared components
  const sharedIdMap = new Map();

  // Map sharedIds to arrays of node ids
  nodes.forEach((node) => {
    if (node.sharedId && !node.isViewport) {
      if (!sharedIdMap.has(node.sharedId)) {
        sharedIdMap.set(node.sharedId, []);
      }
      sharedIdMap.get(node.sharedId).push(node.id);
    }
  });

  // Create a mapping of nodes by ID
  const nodesById = new Map();
  nodes.forEach((node) => {
    nodesById.set(node.id, node);
  });

  // Find the primary viewport (largest width)
  const primaryViewportId = viewportBreakpoints[0]?.id || "";

  // Find nodes that are direct children of the primary viewport
  const primaryViewportChildren = nodes.filter(
    (node) => node.parentId === primaryViewportId
  );

  // Process each primary node and build the responsive tree
  const processNode = (node) => {
    // Initialize the responsive node
    const responsiveNode = {
      ...node,
      responsiveStyles: {},
      children: [],
    };

    // If this node has a sharedId, collect complete styles from all viewports
    if (node.sharedId) {
      const sharedNodeIds = sharedIdMap.get(node.sharedId) || [];

      // For each viewport, find the correct node instance and collect ALL styles
      viewportBreakpoints.forEach((viewport) => {
        // Find the node for this viewport and sharedId
        const nodeForViewport = sharedNodeIds
          .map((id) => nodesById.get(id))
          .find((n) => {
            if (!n) return false;

            // Find its parent viewport
            let currentNode = n;
            while (currentNode && currentNode.parentId) {
              const parent = nodesById.get(currentNode.parentId);
              if (parent?.isViewport && parent.id === viewport.id) {
                return true;
              }
              currentNode = parent;
            }
            return false;
          });

        // If we found a node for this viewport, store ALL its styles
        if (nodeForViewport) {
          // Store the complete style object for this viewport
          responsiveNode.responsiveStyles[viewport.width] = {
            ...nodeForViewport.style,
          };
        }
      });
    }

    // Process children
    const childNodes = nodes.filter(
      (childNode) => childNode.parentId === node.id
    );

    responsiveNode.children = childNodes.map(processNode);

    return responsiveNode;
  };

  // Process the top-level nodes and build the tree
  return primaryViewportChildren.map(processNode);
};
