import React, { useMemo } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";

interface ResponsiveNode {
  id: string;
  type: string;
  src?: string;
  text?: string;
  styles: {
    [viewport: number]: React.CSSProperties;
  };
  parentId?: string | null;
}

function combineNodes(nodes: Node[]): ResponsiveNode[] {
  const viewports = nodes
    .filter((n) => n.isViewport)
    .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0));

  const result = new Map<string, ResponsiveNode>();

  viewports.forEach((viewport) => {
    const viewportNodes = nodes.filter((n) => n.parentId === viewport.id);
    viewportNodes.forEach((node) => {
      if (!node.sharedId) return;

      const existing = result.get(node.sharedId);
      if (existing) {
        existing.styles[viewport.viewportWidth!] = node.style;
      } else {
        result.set(node.sharedId, {
          id: node.sharedId,
          type: node.type,
          src: node.src,
          text: node.text,
          parentId:
            node.parentId === viewport.id
              ? null
              : nodes.find((n) => n.id === node.parentId)?.sharedId,
          styles: {
            [viewport.viewportWidth!]: node.style,
          },
        });
      }
    });
  });

  return Array.from(result.values());
}

interface StyleProviderProps {
  styles: { [viewport: number]: React.CSSProperties };
}

const StyleProvider: React.FC<StyleProviderProps> = ({ styles }) => {
  // Convert viewport-specific styles to media queries
  const cssRules = Object.entries(styles)
    .map(([viewport, style]) => {
      const breakpoint = parseInt(viewport);
      let mediaQuery = "";

      if (breakpoint === 1440) {
        mediaQuery = "@media (min-width: 1024px)";
      } else if (breakpoint === 768) {
        mediaQuery = "@media (min-width: 768px) and (max-width: 1023px)";
      } else if (breakpoint === 375) {
        mediaQuery = "@media (max-width: 767px)";
      }

      return `${mediaQuery} {
      ${Object.entries(style)
        .map(([prop, value]) => `${prop}: ${value};`)
        .join("\n")}
    }`;
    })
    .join("\n");

  return <style>{cssRules}</style>;
};

const PreviewNode: React.FC<{
  node: ResponsiveNode;
  allNodes: ResponsiveNode[];
}> = ({ node, allNodes }) => {
  const children = allNodes.filter((n) => n.parentId === node.id);

  switch (node.type) {
    case "frame":
      return (
        <>
          <StyleProvider styles={node.styles} />
          <div id={node.id}>
            {children.map((child) => (
              <PreviewNode key={child.id} node={child} allNodes={allNodes} />
            ))}
          </div>
        </>
      );

    case "image":
      return (
        <>
          <StyleProvider styles={node.styles} />
          <img
            id={node.id}
            src={node.src || "/api/placeholder/400/300"}
            alt=""
          />
        </>
      );

    case "text":
      return (
        <>
          <StyleProvider styles={node.styles} />
          <div id={node.id}>{node.text}</div>
        </>
      );

    default:
      return null;
  }
};

export const ResponsivePreview: React.FC<{ nodes: Node[] }> = ({ nodes }) => {
  const responsiveNodes = useMemo(() => {
    const combined = combineNodes(nodes);
    console.log("Combined nodes:", combined);
    return combined;
  }, [nodes]);

  const rootNodes = responsiveNodes.filter((n) => !n.parentId);

  return (
    <div className="preview-container">
      {rootNodes.map((node) => (
        <PreviewNode key={node.id} node={node} allNodes={responsiveNodes} />
      ))}
    </div>
  );
};
