import React from "react";
import { Node } from "./types";
import { useViewport } from "./hooks/useViewport";
import { useResponsiveNodeTree } from "./hooks/useResponsiveNodeTree";
import { useDynamicNodes } from "./hooks/useDynamicNode";
import { generateViewportContainerRules } from "./utils/cssUtils";
import { NodeRenderer } from "./components/NodeRenderer";

type PreviewPlayProps = {
  nodes: Node[];
};

const PreviewPlay: React.FC<PreviewPlayProps> = ({ nodes }) => {
  // Hooks for viewport and responsive tree
  const { currentViewport, viewportBreakpoints } = useViewport(nodes);

  // Process nodes for dynamic behavior
  const { activeNodes, handleNodeInteraction } = useDynamicNodes(nodes);

  // Build responsive tree from the active nodes (which may include variants)
  const responsiveNodeTree = useResponsiveNodeTree(
    activeNodes,
    viewportBreakpoints
  );

  // Generate container CSS
  const viewportContainerRules = generateViewportContainerRules(
    viewportBreakpoints,
    nodes
  );

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
        /* Style for dynamic elements */
        .node-dynamic {
          cursor: pointer;
        }
      `}</style>
      <style>{viewportContainerRules}</style>
      <div className="viewport-container">
        {responsiveNodeTree.map((node) => (
          <NodeRenderer
            key={node.id}
            node={node}
            currentViewport={currentViewport}
            viewportBreakpoints={viewportBreakpoints}
            onInteraction={handleNodeInteraction}
            allNodes={responsiveNodeTree}
          />
        ))}
      </div>
    </div>
  );
};

export default PreviewPlay;
