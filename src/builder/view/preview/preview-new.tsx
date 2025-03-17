import React, { useMemo, useEffect, useState } from "react";

type NodeType = {
  id: string;
  type: string;
  style: React.CSSProperties & {
    src?: string;
    text?: string;
    backgroundImage?: string;
    backgroundVideo?: string;
  };
  isViewport?: boolean;
  viewportWidth?: number;
  viewportName?: string;
  parentId: string | null;
  inViewport: boolean;
  sharedId?: string;
  independentStyles?: Record<string, boolean>;
  position?: {
    x: number;
    y: number;
  };
};

type ResponsiveNode = NodeType & {
  responsiveStyles: Record<
    number,
    React.CSSProperties & {
      src?: string;
      text?: string;
      backgroundImage?: string;
      backgroundVideo?: string;
    }
  >;
  children: ResponsiveNode[];
};

const PreviewPlay = ({ nodes }) => {
  // Keep track of current viewport size
  const [currentViewport, setCurrentViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );

  // Force update on viewport change
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setCurrentViewport(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Convert style object to CSS string
  const convertStyleToCss = (
    style: React.CSSProperties & {
      src?: string;
      text?: string;
      backgroundImage?: string;
      backgroundVideo?: string;
    }
  ): string => {
    return Object.entries(style)
      .filter(([key, value]) => {
        return (
          value !== "" &&
          key !== "src" &&
          key !== "text" &&
          key !== "backgroundVideo" &&
          // Exclude backgroundImage from CSS, we'll handle it with the backgroundWrapper
          key !== "backgroundImage"
        );
      })
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        return `  ${cssKey}: ${value};`;
      })
      .join("\n");
  };

  // Get sorted viewport breakpoints
  const viewportBreakpoints = useMemo(() => {
    return nodes
      .filter((node) => node.isViewport)
      .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0))
      .map((viewport) => ({
        id: viewport.id,
        width: viewport.viewportWidth || 0,
        name: viewport.viewportName || "",
      }));
  }, []);

  // Generate viewport container styles
  const viewportContainerRules = useMemo(() => {
    if (viewportBreakpoints.length === 0) return "";

    return viewportBreakpoints
      .map((viewport, index, array) => {
        const viewportNode = nodes.find((node) => node.id === viewport.id);
        if (!viewportNode) return "";

        // Create a clean style object without position attributes from the builder
        const cleanStyle = { ...viewportNode.style };

        // Remove builder-specific positioning properties
        delete cleanStyle.left;
        delete cleanStyle.top;
        delete cleanStyle.position;
        delete cleanStyle.width; // Remove fixed width
        delete cleanStyle.height; // Allow content to determine height

        // Set actual container styles
        cleanStyle.width = "100%"; // Always 100% for all viewports
        cleanStyle.margin = "0 auto";

        let mediaQuery;
        if (index === 0) {
          // Largest viewport (desktop)
          mediaQuery = `@media (min-width: ${viewport.width}px)`;
        } else if (index === array.length - 1) {
          // Smallest viewport (mobile)
          mediaQuery = `@media (max-width: ${array[index - 1].width - 1}px)`;
        } else {
          // Middle viewports (tablet, etc.)
          mediaQuery = `@media (min-width: ${
            viewport.width
          }px) and (max-width: ${array[index - 1].width - 1}px)`;
        }

        return `${mediaQuery} {
  .viewport-container {
${convertStyleToCss(cleanStyle)}
  }
}`;
      })
      .join("\n\n");
  }, [viewportBreakpoints]);

  // Build the responsive node tree
  const responsiveNodeTree = useMemo(() => {
    // First identify all unique shared components
    const sharedIdMap = new Map<string, string[]>();

    // Map sharedIds to arrays of node ids
    nodes.forEach((node) => {
      if (node.sharedId && !node.isViewport) {
        if (!sharedIdMap.has(node.sharedId)) {
          sharedIdMap.set(node.sharedId, []);
        }
        sharedIdMap.get(node.sharedId)!.push(node.id);
      }
    });

    // Create a mapping of nodes by ID
    const nodesById = new Map<string, NodeType>();
    nodes.forEach((node) => {
      nodesById.set(node.id, node);
    });

    // Find the primary viewport (largest width)
    const primaryViewportId = viewportBreakpoints[0]?.id || "";

    // Find nodes that are direct children of the primary viewport
    const primaryViewportChildren = nodes.filter(
      (node) => node.parentId === primaryViewportId
    );

    // Process each primary node and build the responsive tree
    const processNode = (node: NodeType): ResponsiveNode => {
      // Initialize the responsive node
      const responsiveNode: ResponsiveNode = {
        ...node,
        responsiveStyles: {},
        children: [],
      };

      // If this node has a sharedId, collect styles from all viewports
      if (node.sharedId) {
        const sharedNodeIds = sharedIdMap.get(node.sharedId) || [];

        // For each viewport, find the correct node instance and collect styles
        viewportBreakpoints.forEach((viewport) => {
          // Find the node for this viewport and sharedId
          const nodeForViewport = sharedNodeIds
            .map((id) => nodesById.get(id))
            .find((n) => {
              if (!n) return false;

              // Find its parent viewport
              let currentNode: NodeType | undefined = n;
              while (currentNode && currentNode.parentId) {
                const parent = nodesById.get(currentNode.parentId);
                if (parent?.isViewport && parent.id === viewport.id) {
                  return true;
                }
                currentNode = parent;
              }
              return false;
            });

          // If we found a node for this viewport
          if (nodeForViewport) {
            // For primary viewport, collect all styles
            // For other viewports, only collect independent styles
            const isPrimaryViewport = viewport.id === primaryViewportId;
            const styles: Record<string, any> = {};

            Object.entries(nodeForViewport.style).forEach(([key, value]) => {
              if (
                isPrimaryViewport ||
                !nodeForViewport.independentStyles ||
                nodeForViewport.independentStyles[key]
              ) {
                styles[key] = value;
              }
            });

            // Store styles for this viewport
            if (Object.keys(styles).length > 0) {
              responsiveNode.responsiveStyles[viewport.width] = styles;
            }
          }
        });
      }

      // Process children
      const childNodes = nodes.filter(
        (childNode) => childNode.parentId === node.id
      );

      responsiveNode.children = childNodes.map(processNode);

      return responsiveNode;
    };

    // Process the top-level nodes and build the tree
    return primaryViewportChildren.map(processNode);
  }, [viewportBreakpoints]);

  // Generate CSS for responsive nodes
  const generateResponsiveCSS = (node: ResponsiveNode): string => {
    if (Object.keys(node.responsiveStyles).length === 0) return "";

    const cssRules = viewportBreakpoints
      .map((viewport, index, array) => {
        const styles = node.responsiveStyles[viewport.width];
        if (
          !styles ||
          Object.keys(styles).filter(
            (key) =>
              key !== "src" &&
              key !== "text" &&
              key !== "backgroundVideo" &&
              key !== "backgroundImage"
          ).length === 0
        )
          return "";

        let mediaQuery;
        if (index === 0) {
          mediaQuery = `@media (min-width: ${viewport.width}px)`;
        } else if (index === array.length - 1) {
          mediaQuery = `@media (max-width: ${array[index - 1].width - 1}px)`;
        } else {
          mediaQuery = `@media (min-width: ${
            viewport.width
          }px) and (max-width: ${array[index - 1].width - 1}px)`;
        }

        // Create a copy of styles without special properties
        const {
          text,
          src,
          backgroundVideo,
          backgroundImage,
          ...stylesToApply
        } = styles;

        // For frame/container elements, make sure critical styles like backgroundColor have !important
        const modifiedStyles = { ...stylesToApply };
        if (node.type === "frame" && modifiedStyles.backgroundColor) {
          modifiedStyles.backgroundColor = `${modifiedStyles.backgroundColor} !important`;
        }

        return `${mediaQuery} {
  #node-${node.id} {
${convertStyleToCss(modifiedStyles)}
  }
}`;
      })
      .filter(Boolean)
      .join("\n\n");

    return cssRules;
  };

  // Generate CSS for responsive background image changes
  const generateBackgroundImageCSS = (node: ResponsiveNode): string => {
    if (Object.keys(node.responsiveStyles).length === 0) return "";

    const cssRules = viewportBreakpoints
      .map((viewport, index, array) => {
        const styles = node.responsiveStyles[viewport.width];
        if (!styles || !styles.backgroundImage) return "";

        let mediaQuery;
        if (index === 0) {
          mediaQuery = `@media (min-width: ${viewport.width}px)`;
        } else if (index === array.length - 1) {
          mediaQuery = `@media (max-width: ${array[index - 1].width - 1}px)`;
        } else {
          mediaQuery = `@media (min-width: ${
            viewport.width
          }px) and (max-width: ${array[index - 1].width - 1}px)`;
        }

        return `${mediaQuery} {
  #node-${node.id}-bg-wrapper img {
    content: url("${styles.backgroundImage}");
  }
}`;
      })
      .filter(Boolean)
      .join("\n\n");

    return cssRules;
  };

  // Render background wrapper with responsive handling for both images and videos
  const renderBackgroundWrapper = (
    node: ResponsiveNode,
    currentViewport: number
  ) => {
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
          <img
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
            // Key forces recreation when source changes
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

  // Recursive render function for nodes
  const renderNode = (node: ResponsiveNode) => {
    // Extract special properties from style
    const { src, text, backgroundImage, backgroundVideo, ...styleProps } =
      node.style;

    // Generate responsive CSS for this node
    const responsiveCSS = generateResponsiveCSS(node);

    // Generate responsive background image CSS if applicable
    const backgroundImageCSS =
      node.type === "frame" && backgroundImage
        ? generateBackgroundImageCSS(node)
        : "";

    // Get current viewport styles for src and text
    const mediaQueryContent = Object.entries(node.responsiveStyles)
      .map(([viewport, styles]) => {
        const viewportWidth = parseInt(viewport);
        const viewportIndex = viewportBreakpoints.findIndex(
          (vb) => vb.width === viewportWidth
        );

        let mediaQuery;
        if (viewportIndex === 0) {
          mediaQuery = `@media (min-width: ${viewportWidth}px)`;
        } else if (viewportIndex === viewportBreakpoints.length - 1) {
          mediaQuery = `@media (max-width: ${
            viewportBreakpoints[viewportIndex - 1].width - 1
          }px)`;
        } else {
          mediaQuery = `@media (min-width: ${viewportWidth}px) and (max-width: ${
            viewportBreakpoints[viewportIndex - 1].width - 1
          }px)`;
        }

        // Generate dynamic content based on viewport
        let mediaContent = [];

        // Handle src changes for images
        if (node.type === "image" && styles.src && styles.src !== src) {
          mediaContent.push(`
  ${mediaQuery} {
    #node-${node.id} {
      content: url("${styles.src}");
    }
  }`);
        }

        // Handle text changes - need to include the entire HTML for text content changes
        if (styles.text && styles.text !== text) {
          mediaContent.push(`
  /* Dynamic text content for ${
    viewportBreakpoints.find((vb) => vb.width === viewportWidth)?.name
  } */
  ${mediaQuery} {
    #node-${node.id}-content {
      display: none !important;
    }
    #node-${node.id}-content-${viewportWidth} {
      display: block !important;
    }
  }`);
        }

        return mediaContent.join("\n");
      })
      .filter(Boolean)
      .join("\n");

    // Render image elements
    if (node.type === "image") {
      return (
        <React.Fragment key={node.id}>
          {responsiveCSS && <style>{responsiveCSS}</style>}
          {mediaQueryContent && <style>{mediaQueryContent}</style>}

          <img
            id={`node-${node.id}`}
            className="node node-image"
            src={src}
            alt=""
            style={
              {
                ...styleProps,
                objectFit: styleProps.objectFit || "cover",
              } as React.CSSProperties
            }
          />
        </React.Fragment>
      );
    }

    // Render video elements
    if (node.type === "video") {
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
          (i === sortedViewports.length - 1 &&
            currentViewport >= viewport.width) || // Desktop
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

      // Force key to change when src changes to ensure React recreates the video element
      return (
        <React.Fragment key={node.id}>
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
    }

    // For text elements
    if (node.type === "text") {
      return (
        <React.Fragment key={node.id}>
          {responsiveCSS && <style>{responsiveCSS}</style>}
          {mediaQueryContent && <style>{mediaQueryContent}</style>}

          <div
            id={`node-${node.id}`}
            className="node node-text"
            style={styleProps as React.CSSProperties}
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
    }

    // For frame and other container elements
    return (
      <React.Fragment key={node.id}>
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
          {(backgroundImage || backgroundVideo) &&
            renderBackgroundWrapper(node, currentViewport)}

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

  return (
    <div
      className="preview-container"
      style={{ width: "100vw", overflow: "hidden" }}
    >
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
        }
        .preview-container {
          width: 100%;
          box-sizing: border-box;
        }
        .viewport-container {
          width: 100%;
          box-sizing: border-box;
          min-height: 100vh;
        }
        /* Force CSS property application in responsive designs */
        @media (min-width: 0px) {
          .node-frame {
            background-color: inherit !important;
          }
        }
        /* Force video object-fit */
        video.node-video {
          object-fit: cover !important;
        }
      `}</style>
      <style>{viewportContainerRules}</style>
      <div className="viewport-container">
        {responsiveNodeTree.map(renderNode)}
      </div>
    </div>
  );
};

export default PreviewPlay;
