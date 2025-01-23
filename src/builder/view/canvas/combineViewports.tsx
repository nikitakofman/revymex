import React, { useMemo } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";

interface ResponsiveNode {
  id: string;
  type: string;
  style?: React.CSSProperties;
  src?: string;
  text?: string;
  viewportStyles: {
    [viewport: number]: React.CSSProperties & { src?: string };
  };
  parentId?: string | null;
}

function combineNodes(nodes: Node[]): ResponsiveNode[] {
  // Get all viewports sorted by width (desktop to mobile)
  const viewports = nodes
    .filter((n) => n.isViewport)
    .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0));

  const idToSharedId = new Map<string, string>();
  const sharedIdToParentId = new Map<string, string>();

  // First pass: build ID mappings
  nodes.forEach((node) => {
    if (node.sharedId) {
      idToSharedId.set(node.id, node.sharedId);
      if (node.parentId) {
        const parentSharedId = nodes.find(
          (n) => n.id === node.parentId
        )?.sharedId;
        if (parentSharedId) {
          sharedIdToParentId.set(node.sharedId, parentSharedId);
        }
      }
    }
  });

  const result = new Map<string, ResponsiveNode>();

  // Helper function to process a node and its children
  const processNode = (node: Node, viewportWidth: number) => {
    if (!node.sharedId) return;

    const parentSharedId = node.parentId
      ? idToSharedId.get(node.parentId)
      : null;

    if (result.has(node.sharedId)) {
      // Add this viewport's styles to existing node
      result.get(node.sharedId)!.viewportStyles[viewportWidth] = {
        ...node.style,
        src: node.style.src,
      };
    } else {
      // Create new responsive node
      result.set(node.sharedId, {
        id: node.sharedId,
        type: node.type,
        parentId: parentSharedId,
        viewportStyles: {
          [viewportWidth]: {
            ...node.style,
            src: node.style.src,
          },
        },
      });
    }

    // Process children
    const children = nodes.filter((n) => n.parentId === node.id);
    children.forEach((child) => processNode(child, viewportWidth));
  };

  // Process each viewport
  viewports.forEach((viewport) => {
    // Start with viewport node and process its entire tree
    processNode(viewport, viewport.viewportWidth!);

    // Get all nodes in this viewport
    const viewportNodes = nodes.filter(
      (n) =>
        n.parentId === viewport.id ||
        (n.parentId &&
          nodes.some(
            (parent) =>
              parent.id === n.parentId && parent.parentId === viewport.id
          ))
    );

    // Process each node
    viewportNodes.forEach((node) => {
      processNode(node, viewport.viewportWidth!);
    });
  });

  return Array.from(result.values());
}

const convertStyleToCss = (
  style: React.CSSProperties & { src?: string }
): string => {
  return Object.entries(style)
    .filter(([key, value]) => value !== "" && key !== "src") // Exclude src from CSS
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      return `  ${cssKey}: ${value};`;
    })
    .join("\n");
};

const ResponsiveNode: React.FC<{
  node: ResponsiveNode;
  allNodes: ResponsiveNode[];
}> = ({ node, allNodes }) => {
  const children = allNodes.filter((n) => n.parentId === node.id);
  const viewportWidths = Object.keys(node.viewportStyles)
    .map((v) => parseInt(v))
    .sort((a, b) => b - a);

  const cssRules = viewportWidths
    .map((viewport, index) => {
      const styles = node.viewportStyles[viewport];
      let mediaQuery;

      if (index === viewportWidths.length - 1) {
        mediaQuery = `@media (max-width: ${viewportWidths[index - 1] - 1}px)`;
      } else if (index === 0) {
        mediaQuery = `@media (min-width: ${viewport}px)`;
      } else {
        const nextLargerViewport = viewportWidths[index - 1];
        mediaQuery = `@media (min-width: ${viewport}px) and (max-width: ${
          nextLargerViewport - 1
        }px)`;
      }

      // Create a clean version of styles for CSS conversion
      const cleanStyles = { ...styles };
      delete cleanStyles.src; // Remove src from CSS styles

      const cssStyles = convertStyleToCss(cleanStyles);

      return `${mediaQuery} {
      #${node.id} {
  ${cssStyles}
      }
    }`;
    })
    .join("\n\n");

  // Get current src based on viewport width
  const getCurrentSrc = () => {
    const currentViewport = window.innerWidth;
    const applicableViewport = viewportWidths.find(
      (width) => currentViewport >= width
    );
    return applicableViewport
      ? node.viewportStyles[applicableViewport].src
      : node.viewportStyles[viewportWidths[viewportWidths.length - 1]].src;
  };

  switch (node.type) {
    case "frame":
      const frameDefaultStyles = {
        position: "relative",
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        ...node.viewportStyles[viewportWidths[0]], // Apply largest viewport styles as default
      };

      return (
        <>
          <style>{cssRules}</style>
          <div id={node.id} style={frameDefaultStyles}>
            {children.map((child) => (
              <ResponsiveNode key={child.id} node={child} allNodes={allNodes} />
            ))}
          </div>
        </>
      );

    case "image":
      const defaultSrc =
        node.viewportStyles[viewportWidths[0]]?.src ||
        "https://batiment.imag.fr/img/imag.png";

      return (
        <>
          <style>{cssRules}</style>
          <picture>
            {viewportWidths.map((viewport, index) => {
              const nextViewport = viewportWidths[index + 1];
              const src = node.viewportStyles[viewport]?.src;
              if (!src) return null;

              if (index === 0) {
                return (
                  <source
                    key={viewport}
                    media={`(min-width: ${viewport}px)`}
                    srcSet={src}
                  />
                );
              } else {
                return (
                  <source
                    key={viewport}
                    media={`(min-width: ${viewport}px) and (max-width: ${
                      viewportWidths[index - 1] - 1
                    }px)`}
                    srcSet={src}
                  />
                );
              }
            })}
            <img
              id={node.id}
              src={defaultSrc}
              style={{ position: "relative" }}
              alt=""
            />
          </picture>
        </>
      );

    case "text":
      return (
        <>
          <style>{cssRules}</style>
          <div id={node.id} style={{ position: "relative" }}>
            {node.text}
          </div>
        </>
      );

    default:
      return null;
  }
};

export const ResponsivePreview: React.FC<{ nodes: Node[] }> = ({ nodes }) => {
  const viewportWidths = useMemo(
    () =>
      nodes
        .filter((n) => n.isViewport)
        .map((n) => n.viewportWidth!)
        .sort((a, b) => b - a),
    [nodes]
  );

  const viewportStyles = useMemo(() => {
    const viewports = nodes
      .filter((n) => n.isViewport)
      .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0));

    return viewports.reduce((acc, viewport) => {
      acc[viewport.viewportWidth!] = {
        ...viewport.style,
        width: "100%",
        position: "relative",
        left: "auto",
        top: "auto",
      };
      return acc;
    }, {} as { [key: number]: React.CSSProperties });
  }, [nodes]);

  const responsiveNodes = useMemo(() => {
    return combineNodes(nodes);
  }, [nodes]);

  const viewportCssRules = Object.entries(viewportStyles)
    .sort(([a], [b]) => parseInt(b) - parseInt(a))
    .map(([viewport, styles], index, array) => {
      const viewportWidth = parseInt(viewport);
      let mediaQuery;

      if (index === array.length - 1) {
        mediaQuery = `@media (max-width: ${array[index - 1][0] - 1}px)`;
      } else if (index === 0) {
        mediaQuery = `@media (min-width: ${viewportWidth}px)`;
      } else {
        const nextLargerViewport = parseInt(array[index - 1][0]);
        mediaQuery = `@media (min-width: ${viewportWidth}px) and (max-width: ${
          nextLargerViewport - 1
        }px)`;
      }

      return `${mediaQuery} {
    .viewport-container {
  ${convertStyleToCss(styles)}
    }
  }`;
    })
    .join("\n\n");

  const rootNodes = responsiveNodes.filter((n) => !n.parentId);

  return (
    <>
      <style>{viewportCssRules}</style>
      <div className="viewport-container" style={{ position: "relative" }}>
        {rootNodes.map((node) => (
          <ResponsiveNode
            key={node.id}
            node={node}
            allNodes={responsiveNodes}
          />
        ))}
      </div>
    </>
  );
};
