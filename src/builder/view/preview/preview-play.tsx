import React, { useMemo } from "react";
import { Node } from "./types";
import { generateViewportContainerRules } from "./utils/cssUtils";
import { NodeTreeRenderer } from "./components/NodeRenderer/node-tree-renderer";
import { PreviewProvider, usePreview } from "./preview-context";
import { PreviewStyles } from "./preview-styles";
import Image from "next/image";
import { ViewportBackgroundStyles } from "./utils/viewportBackgroundStyles";
import useDynamicFontLoader from "./hooks/useDynamicFont";

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

  useDynamicFontLoader(originalNodes);

  const enhancedTransitionCSS = `
  .dynamic-node {
    transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1.0) !important;
  }
  
  .dynamic-child {
    transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1.0) !important;
  }
`;

  //   const forcedTransitionCSS = `
  //   [data-node-id] {
  //     transition-property: all !important;
  //     transition-duration: 0.5s !important;
  //     transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important;
  //     transition-delay: 0s !important;
  //   }

  //   .dynamic-child {
  //     will-change: transform, opacity, background-color, width, height !important;
  //   }
  // `;

  return (
    <div
      className="preview-container"
      style={{ width: "100vw", overflow: "hidden" }}
    >
      <PreviewStyles />
      <style>{viewportContainerRules}</style>
      {/* <style dangerouslySetInnerHTML={{ __html: forcedTransitionCSS }} /> */}

      <style>{enhancedTransitionCSS}</style>
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
