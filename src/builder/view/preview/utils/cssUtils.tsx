import { NodeStyle, ResponsiveNode, Viewport } from "../types";

export const convertStyleToCss = (style: NodeStyle): string => {
  // Make a copy of the style object to avoid modifying the original
  const processedStyle = { ...style };

  // If isFakeFixed is true, change position to fixed
  if (
    processedStyle.isFakeFixed === "true" &&
    processedStyle.position === "absolute"
  ) {
    processedStyle.position = "fixed";
  }

  return Object.entries(processedStyle)
    .filter(([key, value]) => {
      return (
        value !== "" &&
        key !== "src" &&
        key !== "text" &&
        key !== "backgroundVideo" &&
        key !== "backgroundImage" &&
        key !== "isFakeFixed" // Exclude the isFakeFixed flag from the output CSS
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
      delete cleanStyle.isFakeFixed; // Remove the isFakeFixed flag

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

      // FIXED: Adjust media query boundaries to avoid exact breakpoint values
      if (index === 0) {
        // Largest breakpoint (e.g., Desktop)
        mediaQuery = `@media (min-width: ${
          nextBreakpoint ? nextBreakpoint.width : 0
        }px)`;
      } else if (index === array.length - 1) {
        // Smallest breakpoint (e.g., Mobile)
        mediaQuery = `@media (max-width: ${viewport.width - 0.02}px)`;
      } else {
        // Middle breakpoints (e.g., Tablet)
        const nextWidth = array[index + 1] ? array[index + 1].width : 0;
        mediaQuery = `@media (min-width: ${nextWidth}px) and (max-width: ${
          viewport.width - 0.02
        }px)`;
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

      // FIXED: Adjust media query boundaries to avoid exact breakpoint values
      if (index === 0) {
        // Largest breakpoint (e.g., Desktop)
        mediaQuery = `@media (min-width: ${
          nextBreakpoint ? nextBreakpoint.width : 0
        }px)`;
      } else if (index === array.length - 1) {
        // Smallest breakpoint (e.g., Mobile)
        mediaQuery = `@media (max-width: ${viewport.width - 0.02}px)`;
      } else {
        // Middle breakpoints (e.g., Tablet)
        const nextWidth = array[index + 1] ? array[index + 1].width : 0;
        mediaQuery = `@media (min-width: ${nextWidth}px) and (max-width: ${
          viewport.width - 0.02
        }px)`;
      }

      // Process the styles to handle isFakeFixed
      const processedStyles = { ...styles };
      if (
        processedStyles.isFakeFixed === "true" &&
        processedStyles.position === "absolute"
      ) {
        processedStyles.position = "fixed";
      }

      // Filter out any special properties that aren't CSS styles
      const {
        text,
        src,
        backgroundVideo,
        backgroundImage,
        isFakeFixed,
        ...stylesToApply
      } = processedStyles;

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

// Updated background image CSS generation with fixed media queries
export const generateBackgroundImageCSS = (node, viewportBreakpoints) => {
  if (!node.responsiveStyles || Object.keys(node.responsiveStyles).length === 0)
    return "";

  const cssRules = viewportBreakpoints
    .map((viewport, index, array) => {
      const styles = node.responsiveStyles[viewport.width];
      if (!styles || !styles.backgroundImage) return "";

      let mediaQuery;
      const nextBreakpoint = array[index + 1];

      // FIXED: Adjust media query boundaries to avoid exact breakpoint values
      if (index === 0) {
        // Largest breakpoint (e.g., Desktop)
        mediaQuery = `@media (min-width: ${
          nextBreakpoint ? nextBreakpoint.width : 0
        }px)`;
      } else if (index === array.length - 1) {
        // Smallest breakpoint (e.g., Mobile)
        mediaQuery = `@media (max-width: ${viewport.width - 0.02}px)`;
      } else {
        // Middle breakpoints (e.g., Tablet)
        const nextWidth = array[index + 1] ? array[index + 1].width : 0;
        mediaQuery = `@media (min-width: ${nextWidth}px) and (max-width: ${
          viewport.width - 0.02
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

// Updated media query content generation with fixed boundaries
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

      // FIXED: Adjust media query boundaries to avoid exact breakpoint values
      if (viewportIndex === 0) {
        // Largest breakpoint (e.g., Desktop)
        mediaQuery = `@media (min-width: ${
          nextBreakpoint ? nextBreakpoint.width : 0
        }px)`;
      } else if (viewportIndex === viewportBreakpoints.length - 1) {
        // Smallest breakpoint (e.g., Mobile)
        mediaQuery = `@media (max-width: ${viewportWidth - 0.02}px)`;
      } else {
        // Middle breakpoints (e.g., Tablet)
        const nextWidth = viewportBreakpoints[viewportIndex + 1]
          ? viewportBreakpoints[viewportIndex + 1].width
          : 0;
        mediaQuery = `@media (min-width: ${nextWidth}px) and (max-width: ${
          viewportWidth - 0.02
        }px)`;
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

// Generate enhanced responsive CSS that uses !important to overcome specificity issues
export const generateEnhancedResponsiveCSS = (node, viewportBreakpoints) => {
  if (!node || !node.sharedId) return "";

  // Get all responsive nodes
  const responsiveBreakpoints = [];

  // Sort breakpoints from largest to smallest
  const sortedBreakpoints = [...viewportBreakpoints].sort(
    (a, b) => b.width - a.width
  );

  // Create CSS rules for each viewport with non-overlapping bounds and !important
  let cssRules = "";

  // Desktop styles (largest viewport)
  const desktopBreakpoint = sortedBreakpoints[0];
  if (desktopBreakpoint) {
    // Process styles for fixed positioning
    const baseStyles = { ...node.style };
    if (
      baseStyles.isFakeFixed === "true" &&
      baseStyles.position === "absolute"
    ) {
      baseStyles.position = "fixed";
    }
    delete baseStyles.isFakeFixed; // Remove the flag

    // Desktop styles with non-overlapping boundaries
    cssRules += `
      @media (min-width: ${
        sortedBreakpoints[1] ? sortedBreakpoints[1].width : 0
      }px) {
        #dynamic-node-${node.id} {
          width: ${baseStyles.width || "auto"} !important;
          height: ${baseStyles.height || "auto"} !important;
          background-color: ${
            baseStyles.backgroundColor || "transparent"
          } !important;
          ${
            baseStyles.position
              ? `position: ${baseStyles.position} !important;`
              : ""
          }
          ${
            baseStyles.flexDirection
              ? `flex-direction: ${baseStyles.flexDirection} !important;`
              : ""
          }
          ${
            baseStyles.padding
              ? `padding: ${baseStyles.padding} !important;`
              : ""
          }
          ${baseStyles.margin ? `margin: ${baseStyles.margin} !important;` : ""}
          ${
            baseStyles.borderRadius
              ? `border-radius: ${baseStyles.borderRadius} !important;`
              : ""
          }
        }
      }
    `;
  }

  // Middle and mobile breakpoints with non-overlapping boundaries
  for (let i = 1; i < sortedBreakpoints.length; i++) {
    const currentBreakpoint = sortedBreakpoints[i];
    const nextBreakpoint = sortedBreakpoints[i + 1];

    // Find the responsive node for this breakpoint
    const responsiveNode = node;

    if (responsiveNode) {
      // Process styles for fixed positioning
      const nodeStyles = { ...responsiveNode.style };
      if (
        nodeStyles.isFakeFixed === "true" &&
        nodeStyles.position === "absolute"
      ) {
        nodeStyles.position = "fixed";
      }
      delete nodeStyles.isFakeFixed; // Remove the flag

      // Use exact pixel boundaries to prevent overlap
      const minWidth = nextBreakpoint ? nextBreakpoint.width : 0;
      const maxWidth = currentBreakpoint.width - 0.02; // Avoid exact boundary

      let mediaQuery;
      if (i === sortedBreakpoints.length - 1) {
        // Smallest breakpoint (Mobile)
        mediaQuery = `@media (max-width: ${maxWidth}px)`;
      } else {
        // Middle breakpoints
        mediaQuery = `@media (min-width: ${minWidth}px) and (max-width: ${maxWidth}px)`;
      }

      cssRules += `
        ${mediaQuery} {
          #dynamic-node-${node.id} {
            width: ${nodeStyles.width || "auto"} !important;
            height: ${nodeStyles.height || "auto"} !important;
            background-color: ${
              nodeStyles.backgroundColor || "transparent"
            } !important;
            ${
              nodeStyles.position
                ? `position: ${nodeStyles.position} !important;`
                : ""
            }
            ${
              nodeStyles.flexDirection
                ? `flex-direction: ${nodeStyles.flexDirection} !important;`
                : ""
            }
            ${
              nodeStyles.padding
                ? `padding: ${nodeStyles.padding} !important;`
                : ""
            }
            ${
              nodeStyles.margin
                ? `margin: ${nodeStyles.margin} !important;`
                : ""
            }
            ${
              nodeStyles.borderRadius
                ? `border-radius: ${nodeStyles.borderRadius} !important;`
                : ""
            }
          }
        }
      `;
    }
  }

  return cssRules;
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
    if (styles.isFakeFixed === "true") {
      console.log(`    Position: fixed (using isFakeFixed)`);
    } else {
      console.log(`    Position: ${styles.position || "default"}`);
    }
  });
};
