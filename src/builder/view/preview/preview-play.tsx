import React, { useMemo, forwardRef, useImperativeHandle } from "react";
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
  initialDynamicVariants?: { [nodeId: string]: any };
  onNodeEvent?: (nodeId: string, eventType: string) => void;
};

// Create a forwarded ref version of the component
const PreviewPlay = forwardRef<any, PreviewPlayProps>((props, ref) => {
  const { nodes, initialDynamicVariants, onNodeEvent } = props;

  return (
    <PreviewProvider
      nodes={nodes}
      initialDynamicVariants={initialDynamicVariants}
    >
      <PreviewContent onNodeEvent={onNodeEvent} ref={ref} />
    </PreviewProvider>
  );
});

// Make sure the component has a display name
PreviewPlay.displayName = "PreviewPlay";

// Create the content component with ref forwarding
const PreviewContent = forwardRef<
  any,
  { onNodeEvent?: (nodeId: string, eventType: string) => void }
>(({ onNodeEvent }, ref) => {
  const { originalNodes, viewportBreakpoints, transformNode } = usePreview();

  // Generate CSS for viewports
  const viewportContainerRules = useMemo(() => {
    return generateViewportContainerRules(viewportBreakpoints, originalNodes);
  }, [viewportBreakpoints, originalNodes]);

  // Find all viewport nodes to render backgrounds
  const viewportNodes = useMemo(() => {
    return originalNodes.filter((node) => node.isViewport);
  }, [originalNodes]);

  // Expose transformNode through the ref
  useImperativeHandle(ref, () => ({
    transformNode: (nodeId: string, eventType: string) => {
      if (transformNode) {
        transformNode(nodeId, eventType);
      }
      if (onNodeEvent) {
        onNodeEvent(nodeId, eventType);
      }
    },
  }));

  useDynamicFontLoader(originalNodes);

  // Enhanced CSS for better transitions, especially for text
  const enhancedTransitionCSS = `
      /* Base transitions for all dynamic elements */
      .dynamic-node {
        transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1.0) !important;
        will-change: transform, opacity, background-color, width, height !important;
      }
      
      .dynamic-child {
        transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1.0) !important;
        will-change: transform, opacity, background-color, width, height !important;
      }
      
      /* Special handling for text elements */
      .dynamic-text-content, 
      [data-child-type="text"] span {
        transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1.0) !important;
        will-change: color, font-size, font-weight, font-family, line-height !important;
      }
      
      /* Force hardware acceleration for smoother animations */
      .dynamic-node, 
      .dynamic-child,
      .dynamic-text-content, 
      [data-child-type="text"] span {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        backface-visibility: hidden;
        transform: translateZ(0);
      }
      
      /* Add animation keyframes for text properties */
      @keyframes textColorTransition {
        from { color: inherit; }
        to { color: inherit; }
      }
      
      @keyframes textSizeTransition {
        from { font-size: inherit; }
        to { font-size: inherit; }
      }
    `;

  return (
    <div
      className="preview-container"
      style={{ width: "100vw", overflow: "auto" }}
    >
      <PreviewStyles />
      <style>{viewportContainerRules}</style>
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
                  src={
                    viewport.style.backgroundImage.startsWith("url(")
                      ? viewport.style.backgroundImage.match(
                          /url\(['"]?(.*?)['"]?\)/i
                        )?.[1] || ""
                      : viewport.style.backgroundImage
                  }
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
});

// Make sure the inner component has a display name
PreviewContent.displayName = "PreviewContent";

export default PreviewPlay;
