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
  const viewports = nodes
    .filter((n) => n.isViewport)
    .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0));

  const idToSharedId = new Map<string, string>();
  const sharedIdToParentId = new Map<string, string>();

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

  const processNode = (node: Node, viewportWidth: number) => {
    if (!node.sharedId) return;

    const parentSharedId = node.parentId
      ? idToSharedId.get(node.parentId)
      : null;

    if (result.has(node.sharedId)) {
      result.get(node.sharedId)!.viewportStyles[viewportWidth] = {
        ...node.style,
        src: node.style.src,
      };
    } else {
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

    const children = nodes.filter((n) => n.parentId === node.id);
    children.forEach((child) => processNode(child, viewportWidth));
  };

  viewports.forEach((viewport) => {
    processNode(viewport, viewport.viewportWidth!);

    const viewportNodes = nodes.filter(
      (n) =>
        n.parentId === viewport.id ||
        (n.parentId &&
          nodes.some(
            (parent) =>
              parent.id === n.parentId && parent.parentId === viewport.id
          ))
    );

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
    .filter(([key, value]) => value !== "" && key !== "src")
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
      const styles = { ...node.viewportStyles[viewport] };

      // Extract border properties except borderRadius
      const {
        border,
        borderTop,
        borderRight,
        borderBottom,
        borderLeft,
        borderWidth,
        borderStyle,
        borderColor,
        ...mainStyles
      } = styles;

      // Keep borderRadius in mainStyles for the element itself
      const { borderRadius } = styles;

      // Check if we have any border properties
      const hasBorder =
        border || borderWidth || borderStyle || borderColor || borderRadius;

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

      return `${mediaQuery} {
        #${node.id} {
          position: relative;
          ${convertStyleToCss(mainStyles)}
        }
        ${
          hasBorder
            ? `
        #${node.id}::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          border: ${border || ""};
          border-width: ${borderWidth || ""};
          border-style: ${borderStyle || "solid"};
          border-color: ${borderColor || "transparent"};
          border-radius: ${borderRadius || 0};
          box-sizing: border-box;
        }`
            : ""
        }
      }`;
    })
    .join("\n\n");

  const defaultStyles = node.viewportStyles[viewportWidths[0]];
  // Extract border properties except borderRadius
  const {
    border,
    borderTop,
    borderRight,
    borderBottom,
    borderLeft,
    borderWidth,
    borderStyle,
    borderColor,
    ...cleanStyles
  } = defaultStyles;

  // Keep borderRadius in the main element styles
  if (!cleanStyles.borderRadius) {
    delete cleanStyles.borderRadius;
  }

  switch (node.type) {
    case "frame":
      return (
        <>
          <style>{cssRules}</style>
          <div
            id={node.id}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              ...cleanStyles,
            }}
          >
            {children.map((child) => (
              <ResponsiveNode key={child.id} node={child} allNodes={allNodes} />
            ))}
          </div>
        </>
      );

    case "image":
      const defaultSrc =
        cleanStyles?.src || "https://batiment.imag.fr/img/imag.png";
      return (
        <>
          <style>{cssRules}</style>
          <picture
            id={node.id}
            style={{ position: "relative", ...cleanStyles }}
          >
            {viewportWidths.map((viewport, index) => {
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
              src={defaultSrc}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: cleanStyles.borderRadius, // Apply borderRadius to img as well
              }}
              alt=""
            />
          </picture>
        </>
      );

    case "text":
      return (
        <>
          <style>{cssRules}</style>
          <div id={node.id} style={{ position: "relative", ...cleanStyles }}>
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
