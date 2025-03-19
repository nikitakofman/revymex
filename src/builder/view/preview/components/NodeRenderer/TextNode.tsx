import React, { useMemo } from "react";
import { usePreview } from "../../preview-context";
import { findNodeById } from "../../utils/nodeUtils";
import {
  generateResponsiveCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";

type TextNodeProps = {
  nodeId: string;
};

export const TextNode: React.FC<TextNodeProps> = ({ nodeId }) => {
  const { nodeTree, viewportBreakpoints, transformNode } = usePreview();

  // Find this node from the context
  const node = useMemo(
    () => findNodeById(nodeTree, nodeId),
    [nodeTree, nodeId]
  );

  if (!node) return null;

  const { src, text, backgroundImage, backgroundVideo, ...styleProps } =
    node.style;

  const responsiveCSS = generateResponsiveCSS(node, viewportBreakpoints);
  const mediaQueryContent = generateMediaQueryContent(
    node,
    viewportBreakpoints
  );

  // Handle click for dynamic nodes
  const handleClick = () => {
    if (node.isDynamic) {
      transformNode(nodeId, "click");
    }
  };

  return (
    <React.Fragment>
      {responsiveCSS && <style>{responsiveCSS}</style>}
      {mediaQueryContent && <style>{mediaQueryContent}</style>}

      <div
        id={`node-${nodeId}`}
        data-node-id={nodeId}
        data-node-type={node.type}
        data-is-dynamic={node.isDynamic ? "true" : undefined}
        className={`node node-${node.type} ${
          node.isDynamic ? "node-dynamic" : ""
        }`}
        style={{
          ...(styleProps as React.CSSProperties),
          cursor: node.isDynamic ? "pointer" : undefined,
        }}
        onClick={node.isDynamic ? handleClick : undefined}
      >
        {/* Primary text content */}
        {text && (
          <div
            id={`node-${nodeId}-content`}
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
              id={`node-${nodeId}-content-${viewport}`}
              style={{ display: "none", width: "100%", height: "100%" }}
              dangerouslySetInnerHTML={{ __html: styles.text || "" }}
            />
          ))}
      </div>
    </React.Fragment>
  );
};
