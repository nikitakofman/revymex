import React from "react";
import { ResponsiveNode, Viewport } from "../../types";
import {
  generateResponsiveCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";

type TextNodeProps = {
  node: ResponsiveNode;
  viewportBreakpoints: Viewport[];
  eventHandlers?: Record<string, (e: React.SyntheticEvent) => void>;
};

export const TextNode: React.FC<TextNodeProps> = ({
  node,
  viewportBreakpoints,
  eventHandlers = {},
}) => {
  const { src, text, backgroundImage, backgroundVideo, ...styleProps } =
    node.style;
  const responsiveCSS = generateResponsiveCSS(node, viewportBreakpoints);
  const mediaQueryContent = generateMediaQueryContent(
    node,
    viewportBreakpoints
  );

  return (
    <React.Fragment>
      {responsiveCSS && <style>{responsiveCSS}</style>}
      {mediaQueryContent && <style>{mediaQueryContent}</style>}

      <div
        id={`node-${node.id}`}
        className="node node-text"
        style={styleProps as React.CSSProperties}
        {...eventHandlers}
      >
        {/* Primary text content */}
        {text && (
          <div
            id={`node-${node.id}-content`}
            dangerouslySetInnerHTML={{ __html: text }}
            style={{ width: "100%", height: "100%" }}
          />
        )}

        {/* Render all viewport-specific text versions (hidden by default) */}
        {Object.entries(node.responsiveStyles)
          .filter(([_, styles]) => styles.text && styles.text !== text)
          .map(([viewport, styles]) => (
            <div
              key={`content-${viewport}`}
              id={`node-${node.id}-content-${viewport}`}
              style={{ display: "none", width: "100%", height: "100%" }}
              dangerouslySetInnerHTML={{ __html: styles.text || "" }}
            />
          ))}
      </div>
    </React.Fragment>
  );
};
