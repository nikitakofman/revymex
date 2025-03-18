import { useMemo } from "react";
import { Node, ResponsiveNode, Viewport } from "../types";

export const useResponsiveNodeTree = (
  nodes: Node[],
  viewportBreakpoints: Viewport[]
) => {
  return useMemo(() => {
    // First identify all unique shared components
    const sharedIdMap = new Map<string, string[]>();

    // Map sharedIds to arrays of node ids
    nodes.forEach((node) => {
      if (node.sharedId && !node.isViewport) {
        if (!sharedIdMap.has(node.sharedId)) {
          sharedIdMap.set(node.sharedId, []);
        }
        sharedIdMap.get(node.sharedId)!.push(node.id);
      }
    });

    // Create a mapping of nodes by ID
    const nodesById = new Map<string, Node>();
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
    const processNode = (node: Node): ResponsiveNode => {
      // Initialize the responsive node
      const responsiveNode: ResponsiveNode = {
        ...node,
        responsiveStyles: {},
        children: [],
      };

      // If this node has a sharedId, collect styles from all viewports
      if (node.sharedId) {
        const sharedNodeIds = sharedIdMap.get(node.sharedId) || [];

        // For each viewport, find the correct node instance and collect styles
        viewportBreakpoints.forEach((viewport) => {
          // Find the node for this viewport and sharedId
          const nodeForViewport = sharedNodeIds
            .map((id) => nodesById.get(id))
            .find((n) => {
              if (!n) return false;

              // Find its parent viewport
              let currentNode: Node | undefined = n;
              while (currentNode && currentNode.parentId) {
                const parent = nodesById.get(currentNode.parentId);
                if (parent?.isViewport && parent.id === viewport.id) {
                  return true;
                }
                currentNode = parent;
              }
              return false;
            });

          // If we found a node for this viewport
          if (nodeForViewport) {
            // For primary viewport, collect all styles
            // For other viewports, only collect independent styles
            const isPrimaryViewport = viewport.id === primaryViewportId;
            const styles = {};

            Object.entries(nodeForViewport.style).forEach(([key, value]) => {
              if (
                isPrimaryViewport ||
                !nodeForViewport.independentStyles ||
                nodeForViewport.independentStyles[key]
              ) {
                styles[key] = value;
              }
            });

            // Store styles for this viewport
            if (Object.keys(styles).length > 0) {
              responsiveNode.responsiveStyles[viewport.width] = styles;
            }
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
  }, [nodes, viewportBreakpoints]);
};
