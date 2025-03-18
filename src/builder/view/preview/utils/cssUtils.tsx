import { NodeStyle, ResponsiveNode, Viewport } from "../types";

export const convertStyleToCss = (style: NodeStyle): string => {
  return Object.entries(style)
    .filter(([key, value]) => {
      return (
        value !== "" &&
        key !== "src" &&
        key !== "text" &&
        key !== "backgroundVideo" &&
        key !== "backgroundImage"
      );
    })
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      return `  ${cssKey}: ${value};`;
    })
    .join("\n");
};

// Generates CSS for viewports
export const generateViewportContainerRules = (
  viewportBreakpoints: Viewport[],
  nodes: any[]
) => {
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
      delete cleanStyle.width;
      delete cleanStyle.height;

      // Set actual container styles
      cleanStyle.width = "100%";
      cleanStyle.margin = "0 auto";

      let mediaQuery;
      if (index === 0) {
        mediaQuery = `@media (min-width: ${viewport.width}px)`;
      } else if (index === array.length - 1) {
        mediaQuery = `@media (max-width: ${array[index - 1].width - 1}px)`;
      } else {
        mediaQuery = `@media (min-width: ${viewport.width}px) and (max-width: ${
          array[index - 1].width - 1
        }px)`;
      }

      return `${mediaQuery} {
  .viewport-container {
${convertStyleToCss(cleanStyle)}
  }
}`;
    })
    .join("\n\n");
};

// Generate CSS for responsive nodes
export const generateResponsiveCSS = (
  node: ResponsiveNode,
  viewportBreakpoints: Viewport[]
) => {
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
        mediaQuery = `@media (min-width: ${viewport.width}px) and (max-width: ${
          array[index - 1].width - 1
        }px)`;
      }

      // Create a copy of styles without special properties
      const { text, src, backgroundVideo, backgroundImage, ...stylesToApply } =
        styles;

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
export const generateBackgroundImageCSS = (
  node: ResponsiveNode,
  viewportBreakpoints: Viewport[]
) => {
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
        mediaQuery = `@media (min-width: ${viewport.width}px) and (max-width: ${
          array[index - 1].width - 1
        }px)`;
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

// Generate CSS for responsive text and image content
export const generateMediaQueryContent = (
  node: ResponsiveNode,
  viewportBreakpoints: Viewport[]
) => {
  const { src, text } = node.style;

  return Object.entries(node.responsiveStyles)
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
};
