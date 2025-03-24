import React, { useMemo } from "react";
import { Node } from "./types";
import { generateViewportContainerRules } from "./utils/cssUtils";
import { NodeTreeRenderer } from "./components/NodeRenderer/node-tree-renderer";
import { PreviewProvider, usePreview } from "./preview-context";
import { PreviewStyles } from "./preview-styles";
import Image from "next/image";
import { ViewportBackgroundStyles } from "./utils/viewportBackgroundStyles";

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

  // Find all viewport nodes to render backgrounds
  const viewportNodes = useMemo(() => {
    return originalNodes.filter((node) => node.isViewport);
  }, [originalNodes]);

  return (
    <div
      className="preview-container"
      style={{ width: "100vw", overflow: "hidden" }}
    >
      <PreviewStyles />
      <style>{viewportContainerRules}</style>
      <ViewportBackgroundStyles />

      <div className="viewport-container">
        {/* Render viewport backgrounds */}
        {viewportNodes.map((viewport) => (
          <React.Fragment key={viewport.id}>
            {viewport.style.backgroundImage && (
              <div
                className={`viewport-container-bg-${viewport.id}`}
                style={{
                  display: "none", // Initially hidden, shown by media queries
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  overflow: "hidden",
                  height: "100%",
                  width: "100%",
                }}
              >
                <Image
                  alt=""
                  src={viewport.style.backgroundImage}
                  fill
                  sizes="100vw"
                  style={{
                    objectFit: "cover",
                    pointerEvents: "none",
                  }}
                />
              </div>
            )}
            {viewport.style.backgroundVideo && (
              <div
                className={`viewport-container-bg-${viewport.id}`}
                style={{
                  display: "none", // Initially hidden, shown by media queries
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  overflow: "hidden",
                  height: "100%",
                  width: "100%",
                }}
              >
                <video
                  src={viewport.style.backgroundVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none",
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}

        <NodeTreeRenderer />
      </div>
    </div>
  );
};

export default PreviewPlay;
