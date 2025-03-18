import React, { useState, useCallback, useEffect } from "react";
import { Node } from "./types";
import { useViewport } from "./hooks/useViewport";
import { useResponsiveNodeTree } from "./hooks/useResponsiveNodeTree";
import { generateViewportContainerRules } from "./utils/cssUtils";
import { NodeRenderer } from "./components/NodeRenderer";
import { findNodeById, replaceNode } from "./utils/nodeUtils";

type PreviewPlayProps = {
  nodes: Node[];
};

const PreviewPlay: React.FC<PreviewPlayProps> = ({ nodes }) => {
  // Hooks for viewport and responsive tree
  const { currentViewport, viewportBreakpoints } = useViewport(nodes);
  const initialNodeTree = useResponsiveNodeTree(nodes, viewportBreakpoints);

  const viewportContainerRules = generateViewportContainerRules(
    viewportBreakpoints,
    nodes
  );

  // State to track transformed dynamic nodes
  const [nodeTree, setNodeTree] = useState(initialNodeTree);

  // Event handler for dynamic node clicks
  const handleDynamicNodeClick = useCallback(
    (event: MouseEvent) => {
      // Find the closest node element
      const nodeElement = (event.target as HTMLElement).closest(
        "[data-node-id]"
      );
      console.log("Click detected, nodeElement:", nodeElement);
      if (!nodeElement) return;

      const nodeId = nodeElement.getAttribute("data-node-id");
      console.log("Node ID:", nodeId);
      if (!nodeId) return;

      // Find the node in our tree
      const node = findNodeById(nodeTree, nodeId);
      console.log("Found node:", node);
      if (!node?.isDynamic || !node.dynamicConnections) {
        console.log("Node is not dynamic or has no connections");
        return;
      }

      // Find matching connection for click event
      const connection = node.dynamicConnections.find(
        (conn) => conn.sourceId === nodeId && conn.type === "click"
      );
      console.log("Found connection:", connection);
      if (!connection) return;

      // Find target node from the original tree
      const targetNode = findNodeById(initialNodeTree, connection.targetId);
      console.log("Target node:", targetNode);
      if (!targetNode) return;

      // Clone the target node and preserve dynamic properties
      const transformedNode = {
        ...targetNode,
        isDynamic: node.isDynamic,
        dynamicConnections: node.dynamicConnections,
        dynamicPosition: node.dynamicPosition,
        // Preserve any other dynamic properties...
      };
      console.log("Transformed node:", transformedNode);

      // Replace the node in the tree
      const updatedTree = replaceNode(nodeTree, nodeId, transformedNode);
      console.log("Updated tree:", updatedTree);
      setNodeTree(updatedTree);
    },
    [nodeTree, initialNodeTree]
  );

  // Set up event listeners
  useEffect(() => {
    document.addEventListener("click", handleDynamicNodeClick);

    return () => {
      document.removeEventListener("click", handleDynamicNodeClick);
    };
  }, [handleDynamicNodeClick]);

  return (
    <div
      className="preview-container"
      style={{ width: "100vw", overflow: "hidden" }}
    >
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
        }
        .preview-container {
          width: 100%;
          box-sizing: border-box;
        }
        .viewport-container {
          width: 100%;
          box-sizing: border-box;
          min-height: 100vh;
        }
        /* Force CSS property application in responsive designs */
        @media (min-width: 0px) {
          .node-frame {
            background-color: inherit !important;
          }
        }
        /* Force video object-fit */
        video.node-video {
          object-fit: cover !important;
        }
      `}</style>
      <style>{viewportContainerRules}</style>
      <div className="viewport-container">
        {nodeTree.map((node) => (
          <NodeRenderer
            key={node.id}
            node={node}
            currentViewport={currentViewport}
            viewportBreakpoints={viewportBreakpoints}
          />
        ))}
      </div>
    </div>
  );
};

export default PreviewPlay;
