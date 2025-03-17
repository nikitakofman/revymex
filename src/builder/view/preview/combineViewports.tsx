import React, { useState, useMemo } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import ResponsiveNode from "./responsiveNode";
import { ResponsiveNode as ResponsiveNodeType } from "./types";

/**
 * Helper function to convert style to CSS string
 */
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

/**
 * Combines nodes into responsive nodes with viewport-specific styles
 */
function combineNodes(nodes: Node[]): ResponsiveNodeType[] {
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

  const result = new Map<string, ResponsiveNodeType>();

  const processNode = (node: Node, viewportWidth: number) => {
    if (!node.sharedId) return;

    const parentSharedId = node.parentId
      ? idToSharedId.get(node.parentId)
      : null;

    // Create a clean style object without absolute positioning values
    const cleanStyle = { ...node.style };

    // Reset absolute positioning values
    if (cleanStyle.position === "absolute") {
      cleanStyle.position = "relative";
      cleanStyle.left = undefined;
      cleanStyle.top = undefined;
    }

    // Ensure we preserve the text property from style
    const textContent = node.text || node.style?.text || "";
    const srcContent = node.style?.src || node.src || "";

    if (result.has(node.sharedId)) {
      result.get(node.sharedId)!.viewportStyles[viewportWidth] = {
        ...cleanStyle,
        src: srcContent,
        text: textContent,
      };

      // Preserve text at the top level too
      if (textContent && !result.get(node.sharedId)!.text) {
        result.get(node.sharedId)!.text = textContent;
      }

      // Preserve dynamic properties
      if (node.isDynamic) {
        result.get(node.sharedId)!.isDynamic = true;
      }

      if (node.dynamicConnections) {
        result.get(node.sharedId)!.dynamicConnections = node.dynamicConnections;
      }
    } else {
      result.set(node.sharedId, {
        id: node.sharedId,
        originalId: node.id,
        type: node.type,
        parentId: parentSharedId,
        viewportStyles: {
          [viewportWidth]: {
            ...cleanStyle,
            src: srcContent,
            text: textContent,
          },
        },
        isDynamic: node.isDynamic,
        dynamicConnections: node.dynamicConnections,
        text: textContent,
        src: srcContent,
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

  // Direct mapping of original node IDs to ResponsiveNodes (for variants reference)
  const nodeMap = new Map<string, ResponsiveNodeType>();

  // Process all dynamic nodes and their variants
  const processedDynamicParentIds = new Set<string | number>();

  nodes.forEach((node) => {
    // Skip nodes that have already been processed through sharedId
    if (node.sharedId && result.has(node.sharedId)) {
      nodeMap.set(node.id, result.get(node.sharedId)!);
      return;
    }

    // Process dynamic nodes and their variants
    if (node.isDynamic || node.dynamicParentId) {
      // If it's a variant, add it only if we haven't processed its parent yet
      if (node.dynamicParentId) {
        if (processedDynamicParentIds.has(node.dynamicParentId)) {
          return; // Skip variants of already processed dynamic parents
        }
      } else if (node.isDynamic) {
        processedDynamicParentIds.add(node.id);
      }

      // Create a clean style object
      const cleanStyle = { ...node.style };
      if (cleanStyle.position === "absolute") {
        cleanStyle.position = "relative";
        cleanStyle.left = undefined;
        cleanStyle.top = undefined;
      }

      // Ensure we preserve the text property from style
      const textContent = node.text || node.style?.text || "";
      const srcContent = node.style?.src || node.src || "";

      const responsiveNode: ResponsiveNodeType = {
        id: node.id,
        originalId: node.id,
        type: node.type,
        viewportStyles: {
          [viewports[0].viewportWidth!]: {
            ...cleanStyle,
            src: srcContent,
            text: textContent,
          },
        },
        isDynamic: node.isDynamic,
        dynamicConnections: node.dynamicConnections,
        dynamicParentId: node.dynamicParentId,
        text: textContent,
        parentId: node.parentId,
        src: srcContent,
      };

      nodeMap.set(node.id, responsiveNode);

      // Only add it to the result if it's not a variant (variants are accessed via nodeMap)
      if (!node.dynamicParentId) {
        result.set(node.id, responsiveNode);
      }
    }
  });

  // Process children for all nodes (including dynamic variants)
  nodes.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      // This is a child of a dynamic node or variant
      const parent = nodeMap.get(node.parentId)!;

      // Create a clean style
      const cleanStyle = { ...node.style };
      if (cleanStyle.position === "absolute") {
        cleanStyle.position = "relative";
        cleanStyle.left = undefined;
        cleanStyle.top = undefined;
      }

      // Ensure we preserve the text property from style
      const textContent = node.text || node.style?.text || "";
      const srcContent = node.style?.src || node.src || "";

      const childNode: ResponsiveNodeType = {
        id: node.id,
        originalId: node.id,
        type: node.type,
        viewportStyles: {
          [viewports[0].viewportWidth!]: {
            ...cleanStyle,
            src: srcContent,
            text: textContent,
          },
        },
        parentId: node.parentId,
        text: textContent,
        src: srcContent,
      };

      // Add to nodeMap for reference
      nodeMap.set(node.id, childNode);

      // Add to parent's children
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(childNode);
    }
  });

  return Array.from(result.values());
}

export const ResponsivePreview: React.FC<{
  nodes: Node[];
  viewport: number;
}> = ({ nodes, viewport }) => {
  // Create a state map to track the active state for each dynamic node
  const [nodeStates, setNodeStates] = useState<
    Map<string | number, string | number | null>
  >(new Map());

  // Function to update the state for a specific node
  const setNodeState = (
    nodeId: string | number,
    stateId: string | number | null
  ) => {
    setNodeStates((prev) => {
      const newMap = new Map(prev);
      newMap.set(nodeId, stateId);
      return newMap;
    });
  };

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

  // Create a nodeMap for fast lookups by ID
  const nodeMap = useMemo(() => {
    const map = new Map<string, ResponsiveNodeType>();

    // Process all variants and their children
    nodes.forEach((node) => {
      // Skip non-dynamic nodes and non-variants
      if (!node.isDynamic && !node.dynamicParentId) return;

      // Create a clean style
      const cleanStyle = { ...node.style };
      if (cleanStyle.position === "absolute") {
        cleanStyle.position = "relative";
        cleanStyle.left = undefined;
        cleanStyle.top = undefined;
      }

      // Ensure we preserve the text property from style
      const textContent = node.text || node.style?.text || "";
      const srcContent = node.style?.src || node.src || "";

      const responsiveNode: ResponsiveNodeType = {
        id: node.id,
        originalId: node.id,
        type: node.type,
        viewportStyles: {
          [viewportWidths[0]]: {
            ...cleanStyle,
            src: srcContent,
            text: textContent,
          },
        },
        isDynamic: node.isDynamic,
        dynamicConnections: node.dynamicConnections,
        dynamicParentId: node.dynamicParentId,
        text: textContent,
        parentId: node.parentId,
        src: srcContent,
        children: [],
      };

      map.set(node.id, responsiveNode);
    });

    // Now process all children of variants
    nodes.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        const parentNode = map.get(node.parentId)!;

        // Create a clean style
        const cleanStyle = { ...node.style };
        if (cleanStyle.position === "absolute") {
          cleanStyle.position = "relative";
          cleanStyle.left = undefined;
          cleanStyle.top = undefined;
        }

        // Ensure we preserve the text property from style
        const textContent = node.text || node.style?.text || "";
        const srcContent = node.style?.src || node.src || "";

        const childNode: ResponsiveNodeType = {
          id: node.id,
          originalId: node.id,
          type: node.type,
          viewportStyles: {
            [viewportWidths[0]]: {
              ...cleanStyle,
              src: srcContent,
              text: textContent,
            },
          },
          parentId: node.parentId,
          text: textContent,
          src: srcContent,
        };

        map.set(node.id, childNode);

        // Add to parent's children
        if (!parentNode.children) {
          parentNode.children = [];
        }
        parentNode.children.push(childNode);
      }
    });

    return map;
  }, [nodes, viewportWidths]);

  const responsiveNodes = useMemo(() => {
    const combined = combineNodes(nodes);

    // Debug output to check if text is being preserved
    combined.forEach((node) => {
      const hasText =
        node.text ||
        Object.values(node.viewportStyles).some((style) => style.text);
      if (hasText) {
        console.log("ResponsiveNode with text:", {
          id: node.id,
          type: node.type,
          text: node.text,
          viewportStylesText: Object.entries(node.viewportStyles).map(
            ([vw, style]) => ({ viewport: vw, text: style.text })
          ),
        });
      }
    });

    return combined;
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

  // Filter out variants from root nodes (only show them when active)
  const rootNodes = responsiveNodes.filter((n) => {
    // Only include top-level nodes
    if (n.parentId) return false;

    // Hide variants
    if (n.dynamicParentId) return false;

    return true;
  });

  return (
    <>
      <style>{viewportCssRules}</style>
      <div
        className="viewport-container"
        style={{ position: "relative", width: "100%" }}
      >
        {rootNodes.map((node) => (
          <ResponsiveNode
            key={node.id}
            node={node}
            allNodes={responsiveNodes}
            originalNodes={nodes}
            viewport={viewport}
            nodeStates={nodeStates}
            setNodeState={setNodeState}
            nodeMap={nodeMap}
          />
        ))}
      </div>
    </>
  );
};

export default ResponsivePreview;
