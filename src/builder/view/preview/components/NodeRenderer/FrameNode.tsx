import React from "react";
import { ResponsiveNode, Viewport } from "../../types";
import { BackgroundWrapper } from "../BackgroundWrapper";
import {
  generateResponsiveCSS,
  generateBackgroundImageCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";

type FrameNodeProps = {
  node: ResponsiveNode;
  currentViewport: number;
  viewportBreakpoints: Viewport[];
  renderNode: (node: ResponsiveNode) => React.ReactNode;
};

export const FrameNode: React.FC<FrameNodeProps> = ({
  node,
  currentViewport,
  viewportBreakpoints,
  renderNode,
}) => {
  const { src, text, backgroundImage, backgroundVideo, ...styleProps } =
    node.style;
  const responsiveCSS = generateResponsiveCSS(node, viewportBreakpoints);
  const backgroundImageCSS = backgroundImage
    ? generateBackgroundImageCSS(node, viewportBreakpoints)
    : "";
  const mediaQueryContent = generateMediaQueryContent(
    node,
    viewportBreakpoints
  );

  return (
    <React.Fragment>
      {responsiveCSS && <style>{responsiveCSS}</style>}
      {backgroundImageCSS && <style>{backgroundImageCSS}</style>}
      {mediaQueryContent && <style>{mediaQueryContent}</style>}

      <div
        id={`node-${node.id}`}
        data-node-id={node.id}
        data-node-type={node.type}
        className={`node node-${node.type}`}
        style={styleProps as React.CSSProperties}
      >
        {/* Background wrapper for image/video backgrounds */}
        {(backgroundImage || backgroundVideo) && (
          <BackgroundWrapper
            node={node}
            currentViewport={currentViewport}
            viewportBreakpoints={viewportBreakpoints}
          />
        )}

        {/* Primary text content if present */}
        {text && (
          <div
            id={`node-${node.id}-content`}
            dangerouslySetInnerHTML={{ __html: text }}
          />
        )}

        {/* Render all viewport-specific text versions (hidden by default) */}
        {Object.entries(node.responsiveStyles)
          .filter(([_, styles]) => styles.text && styles.text !== text)
          .map(([viewport, styles]) => (
            <div
              key={`content-${viewport}`}
              id={`node-${node.id}-content-${viewport}`}
              style={{ display: "none" }}
              dangerouslySetInnerHTML={{ __html: styles.text || "" }}
            />
          ))}

        {/* Render children */}
        {node.children.map(renderNode)}
      </div>
    </React.Fragment>
  );
};
