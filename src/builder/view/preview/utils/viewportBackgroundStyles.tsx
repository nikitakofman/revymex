import React, { useMemo } from "react";
import { usePreview } from "../preview-context";

/**
 * Component to generate responsive viewport background styles
 */
export const ViewportBackgroundStyles: React.FC = () => {
  const { viewportBreakpoints, originalNodes } = usePreview();

  // Generate CSS rules for viewport backgrounds
  const backgroundStyles = useMemo(() => {
    if (!viewportBreakpoints.length) return "";

    const viewportNodes = originalNodes.filter((node) => node.isViewport);
    if (!viewportNodes.length) return "";

    return viewportBreakpoints
      .map((viewport, index, array) => {
        const viewportNode = viewportNodes.find(
          (node) => node.id === viewport.id
        );
        if (!viewportNode) return "";

        // Skip if no background media
        if (
          !viewportNode.style.backgroundImage &&
          !viewportNode.style.backgroundVideo
        ) {
          return "";
        }

        // Create the media query
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
  .viewport-container-bg-${viewport.id} {
    display: block !important;
  }
  /* Hide other viewport backgrounds */
  ${viewportNodes
    .filter((node) => node.id !== viewport.id)
    .map((node) => `.viewport-container-bg-${node.id}`)
    .join(", ")} {
    display: none !important;
  }
}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }, [viewportBreakpoints, originalNodes]);

  if (!backgroundStyles) {
    return null;
  }

  return <style>{backgroundStyles}</style>;
};
