import React, { useEffect, useMemo } from "react";
import { BackgroundWrapper } from "../BackgroundWrapper";
import { NodeRenderer } from ".";
import { usePreview } from "../../preview-context";
import { findNodeById } from "../../utils/nodeUtils";
import {
  generateResponsiveCSS,
  generateBackgroundImageCSS,
  generateMediaQueryContent,
  debugResponsiveNode,
} from "../../utils/cssUtils";

type FrameNodeProps = {
  nodeId: string;
};

export const FrameNode: React.FC<FrameNodeProps> = ({ nodeId }) => {
  const { nodeTree, viewportBreakpoints } = usePreview();

  // Find this node from the context
  const node = useMemo(
    () => findNodeById(nodeTree, nodeId),
    [nodeTree, nodeId]
  );

  useEffect(() => {
    if (node) {
      // Debug the responsive styles for this node
      debugResponsiveNode(node);
    }
  }, [node]);
  if (!node) return null;

  // Extract styles
  const { src, text, backgroundImage, backgroundVideo, ...styleProps } =
    node.style;

  // Generate CSS
  const responsiveCSS = generateResponsiveCSS(node, viewportBreakpoints);
  const backgroundImageCSS = backgroundImage
    ? generateBackgroundImageCSS(node, viewportBreakpoints)
    : "";
  const mediaQueryContent = generateMediaQueryContent(
    node,
    viewportBreakpoints
  );

  // Check if this node has children to render
  const hasChildren = node.children && node.children.length > 0;

  // Check if frame has both text content and a child text node
  // If so, we'll only render the child text node to avoid duplication
  const hasTextContent = Boolean(text);
  const hasTextChild =
    hasChildren && node.children.some((child) => child.type === "text");
  const shouldRenderOwnText = hasTextContent && !hasTextChild;

  return (
    <React.Fragment>
      {responsiveCSS && <style>{responsiveCSS}</style>}
      {backgroundImageCSS && <style>{backgroundImageCSS}</style>}
      {mediaQueryContent && <style>{mediaQueryContent}</style>}

      <div
        id={`node-${nodeId}`}
        data-node-id={nodeId}
        data-node-type={node.type}
        data-has-children={hasChildren ? "true" : undefined}
        className={`node node-${node.type}`}
        style={
          {
            // ...(styleProps as React.CSSProperties),
            // // Force background color to be visible
            // backgroundColor: styleProps.backgroundColor || "transparent",
          }
        }
      >
        {/* Background wrapper for image/video backgrounds */}
        {(backgroundImage || backgroundVideo) && (
          <BackgroundWrapper nodeId={nodeId} />
        )}

        {/* Only render text content if there's no child text node */}
        {shouldRenderOwnText && (
          <div
            id={`node-${nodeId}-content`}
            dangerouslySetInnerHTML={{ __html: text }}
          />
        )}

        {/* Render all viewport-specific text versions (hidden by default) */}
        {shouldRenderOwnText &&
          Object.entries(node.responsiveStyles || {})
            .filter(([_, styles]) => styles.text && styles.text !== text)
            .map(([viewport, styles]) => (
              <div
                key={`content-${viewport}`}
                id={`node-${nodeId}-content-${viewport}`}
                style={{ display: "none" }}
                dangerouslySetInnerHTML={{ __html: styles.text || "" }}
              />
            ))}

        {/* Render children */}
        {hasChildren &&
          node.children.map((child) => (
            <NodeRenderer key={child.id} nodeId={child.id} />
          ))}
      </div>
    </React.Fragment>
  );
};
