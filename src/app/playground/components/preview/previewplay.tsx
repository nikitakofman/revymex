import React, { useMemo } from "react";
import { nodes } from "./nodes";

type NodeType = {
  id: string;
  type: string;
  style: React.CSSProperties & {
    src?: string;
    text?: string;
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
    }
  >;
  children: ResponsiveNode[];
};

const PreviewPlay = () => {
  // Convert style object to CSS string
  const convertStyleToCss = (
    style: React.CSSProperties & { src?: string; text?: string }
  ): string => {
    return Object.entries(style)
      .filter(([key, value]) => value !== "" && key !== "src" && key !== "text")
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

        // For each shared node instance
        sharedNodeIds.forEach((nodeId) => {
          const sharedNode = nodesById.get(nodeId);
          if (!sharedNode) return;

          // Find which viewport this node belongs to
          let currentNode: NodeType | undefined = sharedNode;
          let viewportId: string | null = null;

          // Traverse up to find the viewport
          while (currentNode && !viewportId) {
            if (currentNode.parentId) {
              const parent = nodesById.get(currentNode.parentId);
              if (parent?.isViewport) {
                viewportId = parent.id;
              }
              currentNode = parent;
            } else {
              break;
            }
          }

          // If we found a viewport and it has a width
          if (viewportId) {
            const viewport = nodes.find((n) => n.id === viewportId);
            const viewportWidth = viewport?.viewportWidth;

            if (viewportWidth) {
              // First, initialize the responsive styles for this viewport if not already done
              if (!responsiveNode.responsiveStyles[viewportWidth]) {
                responsiveNode.responsiveStyles[viewportWidth] = {};
              }

              // Then copy all styles from the shared node with the appropriate rules
              const isPrimaryNode = nodeId === node.id;

              Object.entries(sharedNode.style).forEach(([key, value]) => {
                // Include styles if:
                // 1. This is the primary node (base styles)
                // 2. No independentStyles specified (legacy mode)
                // 3. This style is marked as independent for this node
                if (
                  isPrimaryNode ||
                  !sharedNode.independentStyles ||
                  sharedNode.independentStyles[key]
                ) {
                  responsiveNode.responsiveStyles[viewportWidth][key] = value;
                }
              });
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
          Object.keys(styles).filter((key) => key !== "src" && key !== "text")
            .length === 0
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

        // Create a copy of styles without text and src
        const { text, src, ...stylesToApply } = styles;

        return `${mediaQuery} {
  #node-${node.id} {
${convertStyleToCss(stylesToApply)}
  }
}`;
      })
      .filter(Boolean)
      .join("\n\n");

    return cssRules;
  };

  // Recursive render function for nodes
  const renderNode = (node: ResponsiveNode) => {
    // Extract src and text from style for special handling
    const { src, text, ...styleProps } = node.style;

    // Add default object-fit: cover for all images
    if (node.type === "image") {
      styleProps.objectFit = styleProps.objectFit || "cover";
    }

    // Handle responsive styles
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

    // Render image elements differently from other elements
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
      `}</style>
      <style>{viewportContainerRules}</style>
      <div className="viewport-container">
        {responsiveNodeTree.map(renderNode)}
      </div>
    </div>
  );
};

export default PreviewPlay;
