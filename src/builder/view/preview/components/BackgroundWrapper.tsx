import React from "react";
import { ResponsiveNode, Viewport } from "../types";
import Image from "next/image";

type BackgroundWrapperProps = {
  node: ResponsiveNode;
  currentViewport: number;
  viewportBreakpoints: Viewport[];
};

export const BackgroundWrapper: React.FC<BackgroundWrapperProps> = ({
  node,
  currentViewport,
  viewportBreakpoints,
}) => {
  // Start with default background media from the node's style
  let backgroundImage = node.style.backgroundImage;
  let backgroundVideo = node.style.backgroundVideo;

  // Determine if we need to use a different background based on current viewport
  const sortedViewports = [...viewportBreakpoints].sort(
    (a, b) => a.width - b.width
  );

  // Find appropriate background for current viewport
  for (let i = 0; i < sortedViewports.length; i++) {
    const viewport = sortedViewports[i];
    const nextViewport = sortedViewports[i + 1];

    // Check if we're in this viewport's range
    const inViewportRange =
      (i === 0 && currentViewport < viewport.width) || // Mobile
      (i === sortedViewports.length - 1 && currentViewport >= viewport.width) || // Desktop
      (nextViewport &&
        currentViewport >= viewport.width &&
        currentViewport < nextViewport.width); // Tablet

    if (inViewportRange) {
      // Get the styles for this viewport
      const viewportStyles = node.responsiveStyles[viewport.width];
      if (viewportStyles) {
        // Override with responsive background if available
        if (viewportStyles.backgroundImage) {
          backgroundImage = viewportStyles.backgroundImage;
        }
        if (viewportStyles.backgroundVideo) {
          backgroundVideo = viewportStyles.backgroundVideo;
        }
      }
      break;
    }
  }

  // If we have neither background image nor video, return null
  if (!backgroundImage && !backgroundVideo) return null;

  return (
    <div
      data-background-wrapper="true"
      id={`node-${node.id}-bg-wrapper`}
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        overflow: "hidden",
      }}
    >
      {backgroundImage && (
        <Image
          alt=""
          loading="lazy"
          src={backgroundImage}
          style={{
            position: "absolute",
            height: "100%",
            width: "100%",
            inset: 0,
            objectFit: "cover",
            color: "transparent",
            borderRadius: "inherit",
            pointerEvents: "none",
          }}
        />
      )}

      {backgroundVideo && (
        <video
          key={`bg-video-${node.id}-${backgroundVideo}`}
          src={backgroundVideo}
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "inherit",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};
