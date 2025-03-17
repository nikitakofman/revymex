import React, { useMemo, useState, useEffect } from "react";
import { ResponsiveNodeProps } from "./types";

// Helper function to clean absolute position styles
const cleanAbsolutePosition = (
  style: React.CSSProperties & { src?: string; text?: string }
): React.CSSProperties & { src?: string; text?: string } => {
  const cleanedStyle = { ...style };

  // If it's absolutely positioned, reset position values for preview
  if (cleanedStyle.position === "absolute") {
    cleanedStyle.position = "relative";
    cleanedStyle.left = undefined;
    cleanedStyle.top = undefined;
  }

  // Make sure we preserve the text and src properties
  return cleanedStyle;
};

// Function to extract HTML content from text string
const extractHtmlContent = (text?: string): string => {
  if (!text) return "";

  console.log("Extracting HTML content:", text);

  // If it looks like HTML (contains tags), return as is
  if (text.includes("<") && text.includes(">")) {
    return text;
  }

  // Otherwise wrap in paragraph
  return `<p>${text}</p>`;
};

// Function to convert style object to CSS string
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

// Function to check if a node has a specific connection type
const hasConnectionOfType = (
  node: any,
  originalNodes: any[],
  type: "click" | "hover" | "mouseLeave"
): boolean => {
  // Find the correct node for connections
  let sourceNodeId = node.originalId || node.id;

  // Find the node with connections
  const sourceNode = originalNodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return false;

  // Check if it has connections of the specified type
  return (
    sourceNode.dynamicConnections?.some(
      (conn: any) => conn.sourceId === sourceNodeId && conn.type === type
    ) || false
  );
};

const ResponsiveNode: React.FC<ResponsiveNodeProps> = ({
  node,
  allNodes,
  originalNodes,
  viewport,
  nodeStates,
  setNodeState,
  nodeMap,
}) => {
  // Get children of this node
  const children = node.children || [];

  // Add hover state tracking
  const [isHovered, setIsHovered] = useState(false);
  const [wasHovered, setWasHovered] = useState(false);

  const viewportWidths = Object.keys(node.viewportStyles || {})
    .map((v) => parseInt(v))
    .sort((a, b) => b - a);

  const cssRules = viewportWidths
    .map((viewportWidth, index) => {
      const styles = { ...node.viewportStyles[viewportWidth] };

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
        mediaQuery = `@media (min-width: ${viewportWidth}px)`;
      } else {
        const nextLargerViewport = viewportWidths[index - 1];
        mediaQuery = `@media (min-width: ${viewportWidth}px) and (max-width: ${
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

  const defaultStyles =
    viewportWidths.length > 0 && node.viewportStyles
      ? node.viewportStyles[viewportWidths[0]]
      : node.style || {};

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
  } = defaultStyles || {};

  // Keep borderRadius in the main element styles
  if (!cleanStyles.borderRadius) {
    delete cleanStyles.borderRadius;
  }

  // Get the active state for this node (if any)
  const activeVariantId = nodeStates.get(node.id);

  // Check if the node has hover-type connections
  const hasHoverConnection = useMemo(
    () => hasConnectionOfType(node, originalNodes, "hover"),
    [node, originalNodes]
  );

  // Check if the node has click-type connections
  const hasClickConnection = useMemo(
    () => hasConnectionOfType(node, originalNodes, "click"),
    [node, originalNodes]
  );

  // Check if the node has mouseLeave-type connections
  const hasMouseLeaveConnection = useMemo(
    () => hasConnectionOfType(node, originalNodes, "mouseLeave"),
    [node, originalNodes]
  );

  // Track wasHovered state to handle mouseLeave connections
  useEffect(() => {
    if (isHovered && !wasHovered) {
      setWasHovered(true);
    }
  }, [isHovered, wasHovered]);

  // Helper function to find the closest dynamic parent
  const findDynamicParent = (nodeId: string | number): string | number => {
    // If no parent or this is already a top-level node, return the current node ID
    if (!nodeId) return node.id;

    const parent = allNodes.find((n) => n.id === nodeId);
    if (!parent) return node.id;

    // If parent is dynamic, use its ID
    if (parent.isDynamic) return parent.id;

    // Otherwise recursively check its parent
    if (parent.parentId) return findDynamicParent(parent.parentId);

    return node.id;
  };

  // Handle dynamic element clicks
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Find the correct node for connections
    let sourceNodeId = node.originalId || node.id;

    // If we're already showing a variant, we need to use that variant's ID for connections
    if (activeVariantId) {
      const activeVariantNode = originalNodes.find(
        (n) => n.id === activeVariantId
      );
      if (activeVariantNode && activeVariantNode.dynamicConnections) {
        sourceNodeId = activeVariantId;
      }
    }

    // Find the node with connections
    const sourceNode = originalNodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return;

    // Find click connection for this specific node
    const clickConnection = sourceNode.dynamicConnections?.find(
      (conn) => conn.sourceId === sourceNodeId && conn.type === "click"
    );

    if (clickConnection) {
      console.log(
        `Switching from ${sourceNodeId} to ${clickConnection.targetId}`
      );

      // Important: Use the parent's ID for state tracking if this is a child node
      let stateNodeId = node.id;

      // If this is a child node, find the closest dynamic parent
      if (node.parentId) {
        stateNodeId = findDynamicParent(node.parentId);
      }

      // Set state on the appropriate node (parent or self)
      setNodeState(stateNodeId, clickConnection.targetId);
    }
  };

  // Handle mouse enter for hover interactions
  const handleMouseEnter = () => {
    setIsHovered(true);

    // Find the correct node for connections
    let sourceNodeId = node.originalId || node.id;

    // If we're already showing a variant, we need to use that variant's ID for connections
    if (activeVariantId) {
      const activeVariantNode = originalNodes.find(
        (n) => n.id === activeVariantId
      );
      if (activeVariantNode && activeVariantNode.dynamicConnections) {
        sourceNodeId = activeVariantId;
      }
    }

    // Find the node with connections
    const sourceNode = originalNodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return;

    // Find hover connection for this specific node
    const hoverConnection = sourceNode.dynamicConnections?.find(
      (conn) => conn.sourceId === sourceNodeId && conn.type === "hover"
    );

    if (hoverConnection) {
      console.log(
        `Hover connection from ${sourceNodeId} to ${hoverConnection.targetId}`
      );

      // Important: Use the parent's ID for state tracking if this is a child node
      let stateNodeId = node.id;

      // If this is a child node, find the closest dynamic parent
      if (node.parentId) {
        stateNodeId = findDynamicParent(node.parentId);
      }

      // Set state on the appropriate node (parent or self)
      setNodeState(stateNodeId, hoverConnection.targetId);
    }
  };

  // Handle mouse leave for hover and mouseLeave interactions
  const handleMouseLeave = () => {
    setIsHovered(false);

    // Find the correct node for connections
    let sourceNodeId = node.originalId || node.id;

    // If we're already showing a variant, we need to use that variant's ID for connections
    if (activeVariantId) {
      const activeVariantNode = originalNodes.find(
        (n) => n.id === activeVariantId
      );
      if (activeVariantNode && activeVariantNode.dynamicConnections) {
        sourceNodeId = activeVariantId;
      }
    }

    // Find the node with connections
    const sourceNode = originalNodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return;

    // Check for hover connections first
    const hoverConnection = sourceNode.dynamicConnections?.find(
      (conn) => conn.sourceId === sourceNodeId && conn.type === "hover"
    );

    // Check for mouseLeave connections
    const mouseLeaveConnection = sourceNode.dynamicConnections?.find(
      (conn) => conn.sourceId === sourceNodeId && conn.type === "mouseLeave"
    );

    // Important: Use the parent's ID for state tracking if this is a child node
    let stateNodeId = node.id;

    // If this is a child node, find the closest dynamic parent
    if (node.parentId) {
      stateNodeId = findDynamicParent(node.parentId);
    }

    if (hoverConnection && !mouseLeaveConnection) {
      // If we have hover but no mouseLeave connection, reset to default state
      console.log(`Hover ended from ${sourceNodeId}`);
      setNodeState(stateNodeId, null);
    } else if (mouseLeaveConnection && wasHovered) {
      // If we have a mouseLeave connection and the element was previously hovered,
      // switch to the mouseLeave target
      console.log(
        `Mouse leave from ${sourceNodeId} to ${mouseLeaveConnection.targetId}`
      );
      setNodeState(stateNodeId, mouseLeaveConnection.targetId);
      setWasHovered(false); // Reset the wasHovered state
    }
  };

  // If this node has an active variant, we need to render the target instead
  if (activeVariantId) {
    // Find the target node in the node map
    const targetDynamicNode = nodeMap.get(activeVariantId);
    if (targetDynamicNode) {
      // Get original node for style reference
      const originalTargetNode = originalNodes.find(
        (n) => n.id === activeVariantId
      );

      // Use the target node's styles but clean absolute positioning
      const originalStyles = originalTargetNode?.style || {};
      const targetStyles = cleanAbsolutePosition(originalStyles);

      // Check if target has dynamic connections
      const targetHasHoverConnection =
        originalTargetNode?.dynamicConnections?.some(
          (conn) => conn.sourceId === activeVariantId && conn.type === "hover"
        );

      const targetHasClickConnection =
        originalTargetNode?.dynamicConnections?.some(
          (conn) => conn.sourceId === activeVariantId && conn.type === "click"
        );

      const targetHasMouseLeaveConnection =
        originalTargetNode?.dynamicConnections?.some(
          (conn) =>
            conn.sourceId === activeVariantId && conn.type === "mouseLeave"
        );

      // Add interactive styles
      const enhancedStyles = {
        ...targetStyles,
        cursor:
          targetHasClickConnection || targetHasHoverConnection
            ? "pointer"
            : "default",
        transition: "all 0.3s ease",
      };

      // Get and render children of the variant
      const variantChildren = targetDynamicNode.children || [];

      switch (targetDynamicNode.type) {
        case "frame":
          // Check if frame has text content
          if (enhancedStyles.text || originalTargetNode?.style?.text) {
            const frameTextContent =
              enhancedStyles.text || originalTargetNode?.style?.text || "";
            return (
              <>
                <style>{cssRules}</style>
                <div
                  id={node.id}
                  style={{
                    ...enhancedStyles,
                    display: "flex",
                    flexDirection: enhancedStyles.flexDirection || "row",
                    justifyContent: enhancedStyles.justifyContent || "center",
                    alignItems: enhancedStyles.alignItems || "center",
                    position: "relative", // Force relative positioning in preview
                  }}
                  onClick={targetHasClickConnection ? handleClick : undefined}
                  onMouseEnter={
                    targetHasHoverConnection ? handleMouseEnter : undefined
                  }
                  onMouseLeave={
                    targetHasHoverConnection || targetHasMouseLeaveConnection
                      ? handleMouseLeave
                      : undefined
                  }
                  data-node-id={node.id}
                  data-dynamic="true"
                  data-variant-active={activeVariantId}
                  dangerouslySetInnerHTML={{
                    __html: extractHtmlContent(frameTextContent),
                  }}
                />
              </>
            );
          }

          return (
            <>
              <style>{cssRules}</style>
              <div
                id={node.id}
                style={{
                  ...enhancedStyles,
                  display: "flex",
                  flexDirection: enhancedStyles.flexDirection || "row",
                  justifyContent: enhancedStyles.justifyContent || "center",
                  alignItems: enhancedStyles.alignItems || "center",
                  position: "relative", // Force relative positioning in preview
                }}
                onClick={targetHasClickConnection ? handleClick : undefined}
                onMouseEnter={
                  targetHasHoverConnection ? handleMouseEnter : undefined
                }
                onMouseLeave={
                  targetHasHoverConnection || targetHasMouseLeaveConnection
                    ? handleMouseLeave
                    : undefined
                }
                data-node-id={node.id}
                data-dynamic="true"
                data-variant-active={activeVariantId}
              >
                {variantChildren.map((child) => (
                  <ResponsiveNode
                    key={child.id}
                    node={child}
                    allNodes={allNodes}
                    originalNodes={originalNodes}
                    viewport={viewport}
                    nodeStates={nodeStates}
                    setNodeState={setNodeState}
                    nodeMap={nodeMap}
                  />
                ))}
              </div>
            </>
          );

        case "text":
          const variantTextContent =
            originalTargetNode?.text ||
            originalTargetNode?.style?.text ||
            targetDynamicNode.text ||
            targetDynamicNode.style?.text ||
            "";
          return (
            <>
              <style>{cssRules}</style>
              <div
                id={node.id}
                style={{
                  ...enhancedStyles,
                  position: "relative",
                }}
                onClick={targetHasClickConnection ? handleClick : undefined}
                onMouseEnter={
                  targetHasHoverConnection ? handleMouseEnter : undefined
                }
                onMouseLeave={
                  targetHasHoverConnection || targetHasMouseLeaveConnection
                    ? handleMouseLeave
                    : undefined
                }
                data-node-id={node.id}
                data-dynamic="true"
                data-variant-active={activeVariantId}
                dangerouslySetInnerHTML={{
                  __html: extractHtmlContent(variantTextContent),
                }}
              />
            </>
          );

        case "image":
          // Get image src from style.src or src property
          const imageSrc =
            originalTargetNode?.style?.src ||
            originalTargetNode?.src ||
            "https://via.placeholder.com/150";

          // Get the explicit width and height from the original styles
          const imageWidth = originalTargetNode?.style?.width || "auto";
          const imageHeight = originalTargetNode?.style?.height || "auto";

          return (
            <>
              <style>{cssRules}</style>
              <img
                id={node.id}
                src={imageSrc}
                style={{
                  ...enhancedStyles,
                  position: "relative",
                  width: imageWidth, // Use explicit width from node
                  height: imageHeight, // Use explicit height from node
                  objectFit: "cover",
                }}
                onClick={targetHasClickConnection ? handleClick : undefined}
                onMouseEnter={
                  targetHasHoverConnection ? handleMouseEnter : undefined
                }
                onMouseLeave={
                  targetHasHoverConnection || targetHasMouseLeaveConnection
                    ? handleMouseLeave
                    : undefined
                }
                data-node-id={node.id}
                data-dynamic="true"
                data-variant-active={activeVariantId}
                alt=""
              />
            </>
          );

        default:
          return (
            <>
              <style>{cssRules}</style>
              <div
                id={node.id}
                style={{
                  ...enhancedStyles,
                  position: "relative", // Force relative positioning in preview
                }}
                onClick={targetHasClickConnection ? handleClick : undefined}
                onMouseEnter={
                  targetHasHoverConnection ? handleMouseEnter : undefined
                }
                onMouseLeave={
                  targetHasHoverConnection || targetHasMouseLeaveConnection
                    ? handleMouseLeave
                    : undefined
                }
                data-node-id={node.id}
                data-dynamic="true"
                data-variant-active={activeVariantId}
              >
                {variantChildren.map((child) => (
                  <ResponsiveNode
                    key={child.id}
                    node={child}
                    allNodes={allNodes}
                    originalNodes={originalNodes}
                    viewport={viewport}
                    nodeStates={nodeStates}
                    setNodeState={setNodeState}
                    nodeMap={nodeMap}
                  />
                ))}
              </div>
            </>
          );
      }
    }
  }

  // Regular rendering (no active variant)
  switch (node.type) {
    case "frame":
      // Check if frame has text content
      if (node.style?.text || cleanStyles.text) {
        const frameTextContent = node.style?.text || cleanStyles.text || "";
        return (
          <>
            <style>{cssRules}</style>
            <div
              id={node.id}
              style={{
                position: "relative", // Force relative positioning in preview
                display: "flex",
                flexDirection: cleanStyles.flexDirection || "row",
                justifyContent: cleanStyles.justifyContent || "center",
                alignItems: cleanStyles.alignItems || "center",
                ...cleanStyles,
                ...(node.isDynamic ||
                hasClickConnection ||
                hasHoverConnection ||
                hasMouseLeaveConnection
                  ? {
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }
                  : {}),
              }}
              onClick={hasClickConnection ? handleClick : undefined}
              onMouseEnter={hasHoverConnection ? handleMouseEnter : undefined}
              onMouseLeave={
                hasHoverConnection || hasMouseLeaveConnection
                  ? handleMouseLeave
                  : undefined
              }
              data-node-id={node.id}
              data-dynamic={node.isDynamic ? "true" : "false"}
              dangerouslySetInnerHTML={{
                __html: extractHtmlContent(frameTextContent),
              }}
            />
          </>
        );
      }

      return (
        <>
          <style>{cssRules}</style>
          <div
            id={node.id}
            style={{
              position: "relative", // Force relative positioning in preview
              display: "flex",
              flexDirection: cleanStyles.flexDirection || "row",
              justifyContent: cleanStyles.justifyContent || "center",
              alignItems: cleanStyles.alignItems || "center",
              ...cleanStyles,
              ...(node.isDynamic ||
              hasClickConnection ||
              hasHoverConnection ||
              hasMouseLeaveConnection
                ? {
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }
                : {}),
            }}
            onClick={hasClickConnection ? handleClick : undefined}
            onMouseEnter={hasHoverConnection ? handleMouseEnter : undefined}
            onMouseLeave={
              hasHoverConnection || hasMouseLeaveConnection
                ? handleMouseLeave
                : undefined
            }
            data-node-id={node.id}
            data-dynamic={node.isDynamic ? "true" : "false"}
          >
            {children.map((child) => (
              <ResponsiveNode
                key={child.id}
                node={child}
                allNodes={allNodes}
                originalNodes={originalNodes}
                viewport={viewport}
                nodeStates={nodeStates}
                setNodeState={setNodeState}
                nodeMap={nodeMap}
              />
            ))}
          </div>
        </>
      );

    case "image":
      // First check in style.src, then node.src, then node.viewportStyles
      const imageSrc =
        node.style?.src ||
        node.src ||
        cleanStyles.src ||
        "https://via.placeholder.com/150";

      // Get the explicit width and height
      const imageWidth = cleanStyles.width || node.style?.width || "auto";
      const imageHeight = cleanStyles.height || node.style?.height || "auto";

      return (
        <>
          <style>{cssRules}</style>
          <img
            id={node.id}
            src={imageSrc}
            style={{
              position: "relative",
              width: imageWidth, // Use explicit width
              height: imageHeight, // Use explicit height
              objectFit: "cover",
              ...cleanStyles,
              // Override width and height after spreading cleanStyles
              width: imageWidth,
              height: imageHeight,
              ...(node.isDynamic ||
              hasClickConnection ||
              hasHoverConnection ||
              hasMouseLeaveConnection
                ? { cursor: "pointer" }
                : {}),
            }}
            onClick={hasClickConnection ? handleClick : undefined}
            onMouseEnter={hasHoverConnection ? handleMouseEnter : undefined}
            onMouseLeave={
              hasHoverConnection || hasMouseLeaveConnection
                ? handleMouseLeave
                : undefined
            }
            data-node-id={node.id}
            alt=""
          />
        </>
      );

    case "text":
      // Get text content from multiple potential sources
      const textContent =
        node.text || node.style?.text || cleanStyles.text || "";

      // If we find any text content, log it for debugging
      if (textContent) {
        console.log("Found text content for node:", {
          id: node.id,
          nodeText: node.text,
          styleText: node.style?.text,
          cleanStylesText: cleanStyles.text,
        });
      }

      // Directly output the HTML content
      return (
        <>
          <style>{cssRules}</style>
          <div
            id={node.id}
            style={{
              position: "relative",
              ...cleanStyles,
              ...(node.isDynamic ||
              hasClickConnection ||
              hasHoverConnection ||
              hasMouseLeaveConnection
                ? { cursor: "pointer" }
                : {}),
            }}
            onClick={hasClickConnection ? handleClick : undefined}
            onMouseEnter={hasHoverConnection ? handleMouseEnter : undefined}
            onMouseLeave={
              hasHoverConnection || hasMouseLeaveConnection
                ? handleMouseLeave
                : undefined
            }
            data-node-id={node.id}
            dangerouslySetInnerHTML={{
              __html: extractHtmlContent(textContent),
            }}
          />
        </>
      );

    default:
      return (
        <>
          <style>{cssRules}</style>
          <div
            id={node.id}
            style={{
              ...cleanStyles,
              position: "relative",
              ...(node.isDynamic ||
              hasClickConnection ||
              hasHoverConnection ||
              hasMouseLeaveConnection
                ? { cursor: "pointer" }
                : {}),
            }}
            onClick={hasClickConnection ? handleClick : undefined}
            onMouseEnter={hasHoverConnection ? handleMouseEnter : undefined}
            onMouseLeave={
              hasHoverConnection || hasMouseLeaveConnection
                ? handleMouseLeave
                : undefined
            }
            data-node-id={node.id}
          >
            {children.map((child) => (
              <ResponsiveNode
                key={child.id}
                node={child}
                allNodes={allNodes}
                originalNodes={originalNodes}
                viewport={viewport}
                nodeStates={nodeStates}
                setNodeState={setNodeState}
                nodeMap={nodeMap}
              />
            ))}
          </div>
        </>
      );
  }
};

export default ResponsiveNode;
