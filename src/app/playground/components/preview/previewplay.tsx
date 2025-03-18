import React, { useMemo } from "react";

type NodeType = {
  id: string;
  type: string;
  style: React.CSSProperties & {
    src?: string;
    text?: string;
    backgroundImage?: string;
    isVideoBackground?: boolean;
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
      isVideoBackground?: boolean;
      backgroundVideo?: string;
    }
  >;
  children: ResponsiveNode[];
};

const PreviewPlay = ({ nodes }) => {
  // Convert style object to CSS string
  const convertStyleToCss = (
    style: React.CSSProperties & {
      src?: string;
      text?: string;
      backgroundImage?: string;
      isVideoBackground?: boolean;
      backgroundVideo?: string;
    }
  ): string => {
    return Object.entries(style)
      .filter(([key, value]) => {
        return (
          value !== "" &&
          key !== "src" &&
          key !== "text" &&
          key !== "isVideoBackground" &&
          key !== "backgroundVideo" &&
          // Include backgroundImage in CSS only if it's a URL, not a data URL
          !(
            key === "backgroundImage" &&
            typeof value === "string" &&
            (value.startsWith("data:") || value === "none" || value === "")
          )
        );
      })
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();

        // Special handling for backgroundImage to ensure it's formatted as a URL
        if (
          key === "backgroundImage" &&
          typeof value === "string" &&
          !value.includes("url(")
        ) {
          return `  ${cssKey}: url("${value}");`;
        }

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
              key !== "isVideoBackground" &&
              key !== "backgroundVideo"
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

        // Create a copy of styles without text, src, and video-related properties
        const {
          text,
          src,
          isVideoBackground,
          backgroundVideo,
          ...stylesToApply
        } = styles;

        // For frame/container elements, make sure critical styles like backgroundColor have !important
        const modifiedStyles = { ...stylesToApply };
        if (node.type === "frame" && modifiedStyles.backgroundColor) {
          modifiedStyles.backgroundColor = `${modifiedStyles.backgroundColor} !important`;
        }

        // Handle background image separately to ensure proper URL formatting
        if (
          styles.backgroundImage &&
          typeof styles.backgroundImage === "string"
        ) {
          if (
            !styles.backgroundImage.includes("url(") &&
            !styles.backgroundImage.startsWith("none") &&
            !styles.backgroundImage.startsWith("")
          ) {
            modifiedStyles.backgroundImage = `url("${styles.backgroundImage}")`;
          }
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

  // Generate background related HTML/CSS for frames (background images and videos)
  const generateBackgroundContent = (node: ResponsiveNode) => {
    // Set up background content for primary style
    let backgroundContent = null;

    // Handle video background
    if (node.style.isVideoBackground && node.style.backgroundVideo) {
      backgroundContent = (
        <video
          id={`node-${node.id}-bg-video`}
          className="node-background-video"
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: -1,
          }}
        >
          <source src={node.style.backgroundVideo} type="video/mp4" />
        </video>
      );
    }
    // For image backgrounds, handle via CSS which is already done in generateResponsiveCSS

    // Generate responsive background content
    const responsiveBackgrounds = Object.entries(node.responsiveStyles)
      .map(([viewport, styles]) => {
        const viewportWidth = parseInt(viewport);
        const viewportIndex = viewportBreakpoints.findIndex(
          (vb) => vb.width === viewportWidth
        );

        // Skip if this viewport doesn't have a specific background
        if (!styles.isVideoBackground && !styles.backgroundImage) return null;

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

        // For video backgrounds in responsive viewports
        if (styles.isVideoBackground && styles.backgroundVideo) {
          return (
            <React.Fragment key={`bg-video-${viewport}`}>
              <style>{`
              ${mediaQuery} {
                #node-${node.id}-bg-video {
                  display: none !important;
                }
                #node-${node.id}-bg-video-${viewportWidth} {
                  display: block !important;
                }
              }
            `}</style>
              <video
                id={`node-${node.id}-bg-video-${viewportWidth}`}
                className="node-background-video"
                autoPlay
                loop
                muted
                playsInline
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  zIndex: -1,
                  display: "none",
                }}
              >
                <source src={styles.backgroundVideo} type="video/mp4" />
              </video>
            </React.Fragment>
          );
        }

        // For image backgrounds, handle via CSS which is already done in generateResponsiveCSS
        return null;
      })
      .filter(Boolean);

    return (
      <>
        {backgroundContent}
        {responsiveBackgrounds}
      </>
    );
  };

  // Recursive render function for nodes
  const renderNode = (node: ResponsiveNode) => {
    // Extract src and text from style for special handling
    const {
      src,
      text,
      backgroundImage,
      isVideoBackground,
      backgroundVideo,
      ...styleProps
    } = node.style;

    // Handle special styling for different node types
    if (node.type === "image") {
      styleProps.objectFit = styleProps.objectFit || "cover";
    }

    // Generate responsive CSS for this node
    const responsiveCSS = generateResponsiveCSS(node);

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

        // Handle src changes for videos
        if (node.type === "video" && styles.src && styles.src !== src) {
          mediaContent.push(`
  ${mediaQuery} {
    #node-${node.id}-video-source-primary {
      display: none !important;
    }
    #node-${node.id}-video-source-${viewportWidth} {
      display: block !important;
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

    // Handle backgroundImage
    if (
      backgroundImage &&
      typeof backgroundImage === "string" &&
      !backgroundImage.includes("url(") &&
      backgroundImage !== "none" &&
      backgroundImage !== ""
    ) {
      styleProps.backgroundImage = `url("${backgroundImage}")`;
    }

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
            style={styleProps as React.CSSProperties}
          />
        </React.Fragment>
      );
    }

    // Render video elements
    if (node.type === "video") {
      // Collect all responsive video sources
      const videoSources = Object.entries(node.responsiveStyles)
        .filter(([_, styles]) => styles.src && styles.src !== src)
        .map(([viewport, styles]) => (
          <source
            key={`video-source-${viewport}`}
            id={`node-${node.id}-video-source-${viewport}`}
            src={styles.src}
            type="video/mp4"
            style={{ display: "none" }}
          />
        ));

      return (
        <React.Fragment key={node.id}>
          {responsiveCSS && <style>{responsiveCSS}</style>}
          {mediaQueryContent && <style>{mediaQueryContent}</style>}

          <video
            id={`node-${node.id}`}
            className="node node-video"
            autoPlay
            loop
            muted
            playsInline
            controls={styleProps.controls || false}
            style={styleProps as React.CSSProperties}
          >
            <source
              id={`node-${node.id}-video-source-primary`}
              src={src}
              type="video/mp4"
            />
            {videoSources}
          </video>
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
        {mediaQueryContent && <style>{mediaQueryContent}</style>}

        <div
          id={`node-${node.id}`}
          className={`node node-${node.type}`}
          style={styleProps as React.CSSProperties}
        >
          {/* Background content (videos or images) */}
          {node.type === "frame" &&
            (isVideoBackground || backgroundImage) &&
            generateBackgroundContent(node)}

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
        /* Default styles for background containers */
        .node-background-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }
      `}</style>
      <style>{viewportContainerRules}</style>
      <div className="viewport-container">
        {responsiveNodeTree.map(renderNode)}
      </div>

      {/* Debug tools - uncomment when debugging */}
      {/* <div style={{ 
        position: 'fixed', 
        bottom: '10px', 
        right: '10px', 
        background: 'rgba(0,0,0,0.7)', 
        color: 'white', 
        padding: '10px',
        zIndex: 9999,
        fontSize: '12px'
      }}>
        <div>Viewport Width: <span id="debug-width">{typeof window !== 'undefined' ? window.innerWidth : '--'}</span>px</div>
        <div>Breakpoints: {viewportBreakpoints.map(v => v.width).join(', ')}px</div>
      </div> */}
    </div>
  );
};

export default PreviewPlay;
