import React from "react";
import { ResponsiveNode, Viewport } from "../../types";
import {
  generateResponsiveCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";

type VideoNodeProps = {
  node: ResponsiveNode;
  currentViewport: number;
  viewportBreakpoints: Viewport[];
};

export const VideoNode: React.FC<VideoNodeProps> = ({
  node,
  currentViewport,
  viewportBreakpoints,
}) => {
  const { src, text, backgroundImage, backgroundVideo, ...styleProps } =
    node.style;
  const responsiveCSS = generateResponsiveCSS(node, viewportBreakpoints);
  const mediaQueryContent = generateMediaQueryContent(
    node,
    viewportBreakpoints
  );

  // Determine which src to use based on current viewport width
  let videoSrc = src;

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
      (i === sortedViewports.length - 1 && currentViewport >= viewport.width) || // Desktop
      (nextViewport &&
        currentViewport >= viewport.width &&
        currentViewport < nextViewport.width) // Tablet or other
    ) {
      // Use the styles from this viewport if they exist and have a src
      const viewportStyles = node.responsiveStyles[viewport.width];
      if (viewportStyles?.src) {
        videoSrc = viewportStyles.src;
      }
      break;
    }
  }

  return (
    <React.Fragment>
      {responsiveCSS && <style>{responsiveCSS}</style>}
      {mediaQueryContent && <style>{mediaQueryContent}</style>}

      <video
        key={`video-${node.id}-${videoSrc}`} // Force re-render when src changes
        id={`node-${node.id}`}
        className="node node-video"
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        controls={styleProps.controls || false}
        style={
          {
            ...styleProps,
            objectFit: styleProps.objectFit || "cover",
          } as React.CSSProperties
        }
      />
    </React.Fragment>
  );
};
