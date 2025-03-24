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

// Generate correct viewport container rules with background support
export const generateViewportContainerRules = (
  viewportBreakpoints: Viewport[],
  nodes: any[]
) => {
  if (viewportBreakpoints.length === 0) return "";

  let backgroundStyles = "";
  const mediaQueries = viewportBreakpoints
    .map((viewport, index, array) => {
      const viewportNode = nodes.find((node) => node.id === viewport.id);
      if (!viewportNode) return "";

      // Create a clean style object without position attributes from the builder
      const cleanStyle = { ...viewportNode.style };

      // Store the original height before removing positioning properties
      const viewportHeight = cleanStyle.height;

      // Check for background media
      const hasBackgroundImage = !!cleanStyle.backgroundImage;
      const hasBackgroundVideo = !!cleanStyle.backgroundVideo;

      // Remove builder-specific positioning properties
      delete cleanStyle.left;
      delete cleanStyle.top;
      delete cleanStyle.position;
      delete cleanStyle.width;
      delete cleanStyle.height;

      // Remove background media from inline styles (we'll handle them separately)
      delete cleanStyle.backgroundImage;
      delete cleanStyle.backgroundVideo;

      // Set actual container styles
      cleanStyle.width = "100%";
      cleanStyle.height = viewportHeight; // Add the height back
      cleanStyle.margin = "0 auto";
      cleanStyle.position = "relative"; // For background positioning

      let mediaQuery;
      const nextBreakpoint = array[index + 1];

      if (index === 0) {
        // Largest breakpoint (e.g., Desktop)
        mediaQuery = `@media (min-width: ${
          nextBreakpoint ? nextBreakpoint.width + 1 : 0
        }px)`;
      } else if (index === array.length - 1) {
        // Smallest breakpoint (e.g., Mobile)
        mediaQuery = `@media (max-width: ${viewport.width}px)`;
      } else {
        // Middle breakpoints (e.g., Tablet)
        const nextWidth = array[index + 1] ? array[index + 1].width + 1 : 0;
        mediaQuery = `@media (min-width: ${nextWidth}px) and (max-width: ${viewport.width}px)`;
      }

      // Add background media handling for each viewport
      if (hasBackgroundImage || hasBackgroundVideo) {
        backgroundStyles += `${mediaQuery} {
  .viewport-container-bg-${viewport.id} {
    display: block !important;
  }
}\n\n`;
      }

      return `${mediaQuery} {
  .viewport-container {
${convertStyleToCss(cleanStyle)}
  }
}`;
    })
    .join("\n\n");

  return mediaQueries + "\n\n" + backgroundStyles;
};

// Generate CSS for responsive nodes with fixed media queries
export const generateResponsiveCSS = (node, viewportBreakpoints) => {
  if (!node.responsiveStyles || Object.keys(node.responsiveStyles).length === 0)
    return "";

  const cssRules = viewportBreakpoints
    .map((viewport, index, array) => {
      // Get the complete styles for this viewport
      const styles = node.responsiveStyles[viewport.width];

      // Skip if no styles
      if (!styles || Object.keys(styles).length === 0) return "";

      // Construct the appropriate media query
      let mediaQuery;
      const nextBreakpoint = array[index + 1];

      if (index === 0) {
        // Largest breakpoint (e.g., Desktop)
        mediaQuery = `@media (min-width: ${
          nextBreakpoint ? nextBreakpoint.width + 1 : 0
        }px)`;
      } else if (index === array.length - 1) {
        // Smallest breakpoint (e.g., Mobile)
        mediaQuery = `@media (max-width: ${viewport.width}px)`;
      } else {
        // Middle breakpoints (e.g., Tablet)
        const nextWidth = array[index + 1] ? array[index + 1].width + 1 : 0;
        mediaQuery = `@media (min-width: ${nextWidth}px) and (max-width: ${viewport.width}px)`;
      }

      // Filter out any special properties that aren't CSS styles
      const { text, src, backgroundVideo, backgroundImage, ...stylesToApply } =
        styles;

      // Convert style object to CSS string
      const cssStyles = Object.entries(stylesToApply)
        .filter(([key, value]) => value !== "") // Skip empty values
        .map(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
          return `    ${cssKey}: ${value};`;
        })
        .join("\n");

      return `${mediaQuery} {
  #node-${node.id} {
${cssStyles}
  }
}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return cssRules;
};

// --- Updated background image CSS generation ---
export const generateBackgroundImageCSS = (node, viewportBreakpoints) => {
  if (!node.responsiveStyles || Object.keys(node.responsiveStyles).length === 0)
    return "";

  const cssRules = viewportBreakpoints
    .map((viewport, index, array) => {
      const styles = node.responsiveStyles[viewport.width];
      if (!styles || !styles.backgroundImage) return "";

      let mediaQuery;
      const nextBreakpoint = array[index + 1];

      if (index === 0) {
        // Largest breakpoint (e.g., Desktop)
        mediaQuery = `@media (min-width: ${
          nextBreakpoint ? nextBreakpoint.width + 1 : 0
        }px)`;
      } else if (index === array.length - 1) {
        // Smallest breakpoint (e.g., Mobile)
        mediaQuery = `@media (max-width: ${viewport.width}px)`;
      } else {
        // Middle breakpoints (e.g., Tablet)
        const nextWidth = array[index + 1] ? array[index + 1].width + 1 : 0;
        mediaQuery = `@media (min-width: ${nextWidth}px) and (max-width: ${viewport.width}px)`;
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

// --- Updated media query content generation ---
export const generateMediaQueryContent = (node, viewportBreakpoints) => {
  if (!node.responsiveStyles) return "";
  const { src, text } = node.style;

  return Object.entries(node.responsiveStyles)
    .map(([viewportWidthStr, styles]) => {
      const viewportWidth = parseInt(viewportWidthStr);
      const viewportIndex = viewportBreakpoints.findIndex(
        (vb) => vb.width === viewportWidth
      );

      if (viewportIndex === -1) return ""; // Skip if viewport not found

      let mediaQuery;
      const nextBreakpoint = viewportBreakpoints[viewportIndex + 1];

      if (viewportIndex === 0) {
        // Largest breakpoint (e.g., Desktop)
        mediaQuery = `@media (min-width: ${
          nextBreakpoint ? nextBreakpoint.width + 1 : 0
        }px)`;
      } else if (viewportIndex === viewportBreakpoints.length - 1) {
        // Smallest breakpoint (e.g., Mobile)
        mediaQuery = `@media (max-width: ${viewportWidth}px)`;
      } else {
        // Middle breakpoints (e.g., Tablet)
        const nextWidth = viewportBreakpoints[viewportIndex + 1]
          ? viewportBreakpoints[viewportIndex + 1].width + 1
          : 0;
        mediaQuery = `@media (min-width: ${nextWidth}px) and (max-width: ${viewportWidth}px)`;
      }

      // Generate dynamic content based on viewport
      const mediaContent = [];

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

// --- Optional debugging helper function ---
export const debugResponsiveNode = (node) => {
  if (!node.responsiveStyles) return;

  console.log(`Debugging responsive node ${node.id}:`);
  Object.entries(node.responsiveStyles).forEach(([viewport, styles]) => {
    console.log(`  Viewport ${viewport}px:`);
    console.log(`    Height: ${styles.height}`);
    console.log(`    Width: ${styles.width}`);
    console.log(`    Background: ${styles.backgroundColor}`);
  });
};
