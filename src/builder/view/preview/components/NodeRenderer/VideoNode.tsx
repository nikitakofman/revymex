import React, { useMemo } from "react";
import { usePreview } from "../../preview-context";
import { findNodeById } from "../../utils/nodeUtils";
import {
  generateResponsiveCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";

type VideoNodeProps = {
  nodeId: string;
};

export const VideoNode: React.FC<VideoNodeProps> = ({ nodeId }) => {
  const { nodeTree, viewportBreakpoints, currentViewport, transformNode } =
    usePreview();

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

  // Determine which src to use based on current viewport width
  const videoSrc = useMemo(() => {
    let currentSrc = src;

    // Sort viewports from smallest to largest
    const sortedViewports = [...viewportBreakpoints].sort(
      (a, b) => a.width - b.width
    );

    // Find the appropriate src for current viewport
    for (let i = 0; i < sortedViewports.length; i++) {
      const viewport = sortedViewports[i];
      const nextViewport = sortedViewports[i + 1];

      // Check if we're in this viewport's range
      if (
        (i === 0 && currentViewport < viewport.width) || // Mobile
        (i === sortedViewports.length - 1 &&
          currentViewport >= viewport.width) || // Desktop
        (nextViewport &&
          currentViewport >= viewport.width &&
          currentViewport < nextViewport.width) // Tablet or other
      ) {
        // Use the styles from this viewport if they exist and have a src
        const viewportStyles = node.responsiveStyles[viewport.width];
        if (viewportStyles?.src) {
          currentSrc = viewportStyles.src;
        }
        break;
      }
    }

    return currentSrc;
  }, [node, viewportBreakpoints, currentViewport, src]);

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

      <video
        key={`video-${nodeId}-${videoSrc}`} // Force re-render when src changes
        id={`node-${nodeId}`}
        data-node-id={nodeId}
        data-node-type={node.type}
        data-is-dynamic={node.isDynamic ? "true" : undefined}
        className={`node node-video ${node.isDynamic ? "node-dynamic" : ""}`}
        src={videoSrc}
        autoPlay={styleProps.autoplay || false}
        loop={styleProps.loop || false}
        muted={styleProps.muted || true}
        controls={styleProps.controls || false}
        style={
          {
            objectFit: styleProps.objectFit || "cover",
            objectPosition: styleProps.objectPosition || "center",
          } as React.CSSProperties
        }
        onClick={node.isDynamic ? handleClick : undefined}
      />
    </React.Fragment>
  );
};
