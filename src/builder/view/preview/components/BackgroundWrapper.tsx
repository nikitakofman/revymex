import React, { useMemo } from "react";
import Image from "next/image";
import { usePreview } from "../preview-context";
import { findNodeById } from "../utils/nodeUtils";

type BackgroundWrapperProps = {
  nodeId: string;
};

export const BackgroundWrapper: React.FC<BackgroundWrapperProps> = ({
  nodeId,
}) => {
  const { nodeTree, viewportBreakpoints, currentViewport } = usePreview();

  // Find this node from the context
  const node = useMemo(
    () => findNodeById(nodeTree, nodeId),
    [nodeTree, nodeId]
  );

  // Determine background media based on current viewport - only if node exists
  const backgroundData = useMemo(() => {
    if (!node)
      return { backgroundImage: undefined, backgroundVideo: undefined };

    // Start with default background media from the node's style
    let currentBgImage = node.style.backgroundImage;
    let currentBgVideo = node.style.backgroundVideo;

    // Sort viewports from smallest to largest
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
        (i === sortedViewports.length - 1 &&
          currentViewport >= viewport.width) || // Desktop
        (nextViewport &&
          currentViewport >= viewport.width &&
          currentViewport < nextViewport.width); // Tablet

      if (inViewportRange) {
        // Get the styles for this viewport
        const viewportStyles = node.responsiveStyles[viewport.width];
        if (viewportStyles) {
          // Override with responsive background if available
          if (viewportStyles.backgroundImage) {
            currentBgImage = viewportStyles.backgroundImage;
          }
          if (viewportStyles.backgroundVideo) {
            currentBgVideo = viewportStyles.backgroundVideo;
          }
        }
        break;
      }
    }

    return {
      backgroundImage: currentBgImage,
      backgroundVideo: currentBgVideo,
    };
  }, [node, viewportBreakpoints, currentViewport]);

  const { backgroundImage, backgroundVideo } = backgroundData;

  // If node doesn't exist or we have neither background image nor video, return null
  if (!node || (!backgroundImage && !backgroundVideo)) return null;

  return (
    <div
      data-background-wrapper="true"
      id={`node-${nodeId}-bg-wrapper`}
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        overflow: "hidden",
      }}
    >
      {backgroundImage && (
        <div
          style={{
            position: "absolute",
            height: "100%",
            width: "100%",
            inset: 0,
            overflow: "hidden",
            borderRadius: "inherit",
          }}
        >
          <Image
            alt=""
            loading="lazy"
            src={backgroundImage}
            fill={true}
            sizes="100vw"
            style={{
              objectFit: "cover",
              color: "transparent",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {backgroundVideo && (
        <video
          key={`bg-video-${nodeId}-${backgroundVideo}`}
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
