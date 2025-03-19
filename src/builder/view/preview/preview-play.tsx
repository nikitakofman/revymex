import React, { useMemo } from "react";
import { Node } from "./types";
import { generateViewportContainerRules } from "./utils/cssUtils";
import { NodeTreeRenderer } from "./components/NodeRenderer/node-tree-renderer";
import { PreviewProvider, usePreview } from "./preview-context";
import { DebugContext } from "./debug-context";
import { PreviewStyles } from "./preview-styles";

type PreviewPlayProps = {
  nodes: Node[];
};

const PreviewPlay: React.FC<PreviewPlayProps> = ({ nodes }) => {
  return (
    <PreviewProvider nodes={nodes}>
      <PreviewContent />
    </PreviewProvider>
  );
};

const PreviewContent: React.FC = () => {
  const { originalNodes, viewportBreakpoints } = usePreview();

  // Generate CSS for viewports
  const viewportContainerRules = useMemo(() => {
    return generateViewportContainerRules(viewportBreakpoints, originalNodes);
  }, [viewportBreakpoints, originalNodes]);

  return (
    <div
      className="preview-container"
      style={{ width: "100vw", overflow: "hidden" }}
    >
      <PreviewStyles />
      <style>{viewportContainerRules}</style>
      <div className="viewport-container">
        <NodeTreeRenderer />
        {/* <DebugContext /> */}
      </div>
    </div>
  );
};

export default PreviewPlay;
