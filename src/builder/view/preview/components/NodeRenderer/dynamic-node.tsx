import React, { useMemo, useEffect, useState, useRef } from "react";
import { usePreview } from "../../preview-context";
import { findNodeById } from "../../utils/nodeUtils";
import { BackgroundWrapper } from "../BackgroundWrapper";
import {
  generateResponsiveCSS,
  generateBackgroundImageCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";

type DynamicNodeProps = {
  nodeId: string;
};

const getActiveBreakpoint = (width, breakpoints) => {
  // Sort breakpoints by width (largest to smallest)
  const sortedBreakpoints = [...breakpoints].sort((a, b) => b.width - a.width);

  // For each pair of breakpoints, check if width falls between them
  for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
    const current = sortedBreakpoints[i];
    const next = sortedBreakpoints[i + 1];

    // If width is between current breakpoint (exclusive) and next breakpoint (inclusive)
    if (width > next.width && width <= current.width) {
      return current;
    }
  }

  // If width is smaller than or equal to the smallest breakpoint
  if (width <= sortedBreakpoints[sortedBreakpoints.length - 1].width) {
    return sortedBreakpoints[sortedBreakpoints.length - 1];
  }

  // Default to largest breakpoint
  return sortedBreakpoints[0];
};

export const DynamicNode: React.FC<DynamicNodeProps> = ({ nodeId }) => {
  const {
    nodeTree,
    dynamicVariants,
    transformNode,
    originalNodes,
    viewportBreakpoints,
    currentViewport,
    setDynamicVariants,
  } = usePreview();
  const [forceRender, setForceRender] = useState(0);

  const prevViewportRef = useRef<number>(currentViewport);

  // Find the base node from the tree
  const baseNode = useMemo(
    () => findNodeById(nodeTree, nodeId),
    [nodeTree, nodeId]
  );
  if (!baseNode) return null;

  // Get the active variant for this node (if any)
  const activeVariant = dynamicVariants[nodeId];

  // Use the active variant if it exists, otherwise use the base node
  const currentVariant = activeVariant || baseNode;

  const isBreakpointChange = (prevWidth, currentWidth, breakpoints) => {
    // Find the matching breakpoints for previous and current widths
    const prevBreakpoint = breakpoints.find((bp) => prevWidth >= bp.width);
    const currentBreakpoint = breakpoints.find(
      (bp) => currentWidth >= bp.width
    );

    // If either breakpoint is not found, assume no change (this should rarely happen)
    if (!prevBreakpoint || !currentBreakpoint) return false;

    // Return true if breakpoint IDs are different (we've crossed a boundary)
    return prevBreakpoint.id !== currentBreakpoint.id;
  };

  // Update your useEffect with this improved logic
  useEffect(() => {
    // Don't just check if viewport changed, check if we crossed a breakpoint boundary
    if (prevViewportRef.current !== currentViewport) {
      // Check if this viewport change crosses a breakpoint boundary
      const prevBreakpoint = getActiveBreakpoint(
        prevViewportRef.current,
        viewportBreakpoints
      );
      const currentBreakpoint = getActiveBreakpoint(
        currentViewport,
        viewportBreakpoints
      );
      const crossedBreakpoint = prevBreakpoint.id !== currentBreakpoint.id;

      if (crossedBreakpoint && activeVariant) {
        console.log(
          `Breakpoint change detected from ${prevViewportRef.current}px to ${currentViewport}px`
        );
        console.log(
          `Resetting active variant for node ${nodeId} due to breakpoint change`
        );

        setDynamicVariants((prev) => {
          const newVariants = { ...prev };
          delete newVariants[nodeId];
          return newVariants;
        });
      } else {
        console.log(
          `Viewport changed from ${prevViewportRef.current}px to ${currentViewport}px but still in same breakpoint - keeping variant`
        );
      }

      // Always update the ref with current viewport
      prevViewportRef.current = currentViewport;
    }
  }, [
    currentViewport,
    nodeId,
    activeVariant,
    setDynamicVariants,
    viewportBreakpoints,
  ]);

  // Generate CSS for responsive styling
  const responsiveCSS = generateResponsiveCSS(baseNode, viewportBreakpoints);
  const backgroundImageCSS = baseNode.style.backgroundImage
    ? generateBackgroundImageCSS(baseNode, viewportBreakpoints)
    : "";
  const mediaQueryContent = generateMediaQueryContent(
    baseNode,
    viewportBreakpoints
  );

  // Debug active variant changes
  useEffect(() => {
    if (activeVariant) {
      console.log(`ACTIVE VARIANT CHANGED for ${nodeId}`);
      console.log(`Variant ID: ${activeVariant.id}`);
      console.log(`Force rendering children`);
      setForceRender((prev) => prev + 1);
    }
  }, [activeVariant, nodeId]);

  // Code to update transformNode to handle viewport-specific connections
  const updateTransformNodeForViewport = () => {
    // This function would be used if we needed to modify how transformNode works with viewport connections
    // For now, this is left empty as the transformNode in preview-context already handles connections
  };

  // Monitor viewport changes for debugging
  useEffect(() => {
    const currentViewportObj = getActiveBreakpoint(
      currentViewport,
      viewportBreakpoints
    );

    if (!currentViewportObj) return;

    console.log(
      `Dynamic node ${nodeId} - Current viewport width: ${currentViewport}, matching breakpoint: ${currentViewportObj.width}`
    );
  }, [currentViewport, viewportBreakpoints, nodeId]);

  // Important layout style properties that should be preserved from variant
  const LAYOUT_PROPERTIES = [
    "display",
    "flexDirection",
    "justifyContent",
    "alignItems",
    "gap",
    "flexWrap",
    "flexGrow",
    "flexShrink",
    "flexBasis",
    "gridTemplateColumns",
    "gridTemplateRows",
    "gridGap",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "borderRadius",
    "boxShadow",
    "overflow",
    "overflowX",
    "overflowY",
  ];

  // Merge styles: base style + variant style + responsive styles
  const mergedStyle = useMemo(() => {
    // Start with base style
    const baseStyle = { ...baseNode.style };

    // Apply responsive styles if available
    if (baseNode.responsiveStyles) {
      const currentViewportWidth = currentViewport;

      // Find the appropriate responsive style based on current viewport width
      const viewportBreakpoint = getActiveBreakpoint(
        currentViewportWidth,
        viewportBreakpoints
      );

      if (
        viewportBreakpoint &&
        baseNode.responsiveStyles[viewportBreakpoint.width]
      ) {
        // Apply responsive styles for the current viewport
        const responsiveStyle =
          baseNode.responsiveStyles[viewportBreakpoint.width];
        Object.assign(baseStyle, responsiveStyle);
      }
    }

    // If we have an active variant, merge its styles with the base styles
    if (activeVariant) {
      const variantStyle = { ...activeVariant.style };

      // Remove positioning properties to keep the node in place
      delete variantStyle.left;
      delete variantStyle.top;
      delete variantStyle.right;
      delete variantStyle.bottom;

      // Force relative positioning
      variantStyle.position = "relative";

      // Create merged style object with priority given to variant's layout and visual properties
      const result = { ...baseStyle };

      // First apply all non-layout properties from the base
      Object.keys(baseStyle).forEach((key) => {
        if (!LAYOUT_PROPERTIES.includes(key)) {
          result[key] = baseStyle[key];
        }
      });

      // Then override with ALL properties from the variant (giving it priority)
      Object.keys(variantStyle).forEach((key) => {
        // Take all properties from variant except position coordinates
        if (
          key !== "left" &&
          key !== "top" &&
          key !== "right" &&
          key !== "bottom"
        ) {
          result[key] = variantStyle[key];
        }
      });

      return result;
    }

    return baseStyle;
  }, [
    baseNode.style,
    baseNode.responsiveStyles,
    activeVariant,
    currentViewport,
    viewportBreakpoints,
  ]);

  // Function to get the appropriate connection based on current viewport
  const getViewportSpecificConnection = (node, eventType) => {
    if (!node.dynamicConnections || node.dynamicConnections.length === 0) {
      return null;
    }

    // Get the current viewport ID from breakpoints
    const currentViewportObj = viewportBreakpoints.find(
      (vp) => currentViewport >= vp.width
    );

    if (!currentViewportObj) return null;

    // First, try to find a connection specific to this viewport
    const connections = node.dynamicConnections;

    // Look for connections with viewportId matching the current viewport
    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i];
      if (
        conn.type === eventType &&
        conn.viewportId === currentViewportObj.id
      ) {
        console.log(
          `Found viewport-specific connection for ${eventType} at viewport ${currentViewportObj.id}`
        );
        return conn;
      }
    }

    // Fallback: find a regular connection with the matching event type
    const regularConnection = connections.find(
      (conn) => conn.type === eventType && !conn.viewportId
    );
    if (regularConnection) {
      console.log(`Using fallback regular connection for ${eventType}`);
      return regularConnection;
    }

    return null;
  };

  // Find if a node has dynamic connections or is part of a dynamic system
  const isNodeInteractive = (node) => {
    // If the node itself is dynamic
    if (node.isDynamic) return true;

    // If the node has dynamic connections
    if (node.dynamicConnections && node.dynamicConnections.length > 0)
      return true;

    // If the node is a child of a dynamic system
    if (node.dynamicParentId) return true;

    return false;
  };

  // Handle click on dynamic elements
  const handleClick = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    console.log(`Click handler called for node: ${targetNodeId}`);

    // Find the node that was clicked
    const clickedNode = originalNodes.find((n) => n.id === targetNodeId);

    // Only process if the clicked node has its own connections
    if (
      clickedNode &&
      clickedNode.dynamicConnections &&
      clickedNode.dynamicConnections.length > 0
    ) {
      console.log(`Click on node with connections: ${targetNodeId}`);
      transformNode(targetNodeId, "click");
      return; // Return early, preventing further event handling
    }

    // Special handling for parent node with active variant
    if (targetNodeId === nodeId && activeVariant) {
      console.log(`Click on parent node with active variant: ${nodeId}`);

      // Check if the active variant has connections
      if (
        activeVariant.dynamicConnections &&
        activeVariant.dynamicConnections.length > 0
      ) {
        // Use the active variant for transformation
        console.log(`Using active variant connections for cycling`);
        transformNode(activeVariant.id, "click");
        return;
      }
    }

    // Only bubble to parent if clicked directly on the parent or the node allows bubbling
    if (targetNodeId === nodeId && baseNode.isDynamic) {
      console.log(`Click on dynamic parent node itself: ${nodeId}`);
      transformNode(nodeId, "click");
      return;
    }

    // Explicit bubbling for nodes that opt-in
    if (baseNode.isDynamic && clickedNode && clickedNode.allowEventBubbling) {
      console.log(`Click bubbling to parent: ${nodeId}`);
      transformNode(nodeId, "click");
    }
  };

  // Handle mouse enter events with the same strict logic
  const handleMouseEnter = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    console.log(`Mouse enter handler called for node: ${targetNodeId}`);

    // Find the node that was hovered
    const hoveredNode = originalNodes.find((n) => n.id === targetNodeId);

    // Only process if the hovered node has its own connections
    if (
      hoveredNode &&
      hoveredNode.dynamicConnections &&
      hoveredNode.dynamicConnections.length > 0
    ) {
      console.log(`Mouse enter on node with connections: ${targetNodeId}`);
      transformNode(targetNodeId, "hover");
      return; // Return early, preventing further event handling
    }

    // Special handling for parent node with active variant
    if (targetNodeId === nodeId && activeVariant) {
      console.log(`Hover on parent node with active variant: ${nodeId}`);

      // Check if the active variant has hover connections
      if (
        activeVariant.dynamicConnections &&
        activeVariant.dynamicConnections.some((conn) => conn.type === "hover")
      ) {
        // Use the active variant for transformation
        console.log(`Using active variant connections for hover cycling`);
        transformNode(activeVariant.id, "hover");
        return;
      }
    }

    // Only bubble to parent if hovered directly on the parent or the node allows bubbling
    if (targetNodeId === nodeId && baseNode.isDynamic) {
      console.log(`Hover on dynamic parent node itself: ${nodeId}`);
      transformNode(nodeId, "hover");
      return;
    }

    // Explicit bubbling for nodes that opt-in
    if (baseNode.isDynamic && hoveredNode && hoveredNode.allowEventBubbling) {
      console.log(`Hover event bubbling to parent: ${nodeId}`);
      transformNode(nodeId, "hover");
    }
  };

  // Handle mouse leave events with the same strict logic
  const handleMouseLeave = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    console.log(`Mouse leave handler called for node: ${targetNodeId}`);

    // Find the node that was left
    const leftNode = originalNodes.find((n) => n.id === targetNodeId);

    // Only process if the left node has its own connections
    if (
      leftNode &&
      leftNode.dynamicConnections &&
      leftNode.dynamicConnections.length > 0
    ) {
      console.log(`Mouse leave on node with connections: ${targetNodeId}`);
      transformNode(targetNodeId, "mouseLeave");
      return; // Return early, preventing further event handling
    }

    // Special handling for parent node with active variant
    if (targetNodeId === nodeId && activeVariant) {
      console.log(`Mouse leave on parent node with active variant: ${nodeId}`);

      // Check if the active variant has mouseLeave connections
      if (
        activeVariant.dynamicConnections &&
        activeVariant.dynamicConnections.some(
          (conn) => conn.type === "mouseLeave"
        )
      ) {
        // Use the active variant for transformation
        console.log(`Using active variant connections for mouseLeave cycling`);
        transformNode(activeVariant.id, "mouseLeave");
        return;
      }
    }

    // Only bubble to parent if left directly from the parent or the node allows bubbling
    if (targetNodeId === nodeId && baseNode.isDynamic) {
      console.log(`Mouse leave on dynamic parent node itself: ${nodeId}`);
      transformNode(nodeId, "mouseLeave");
      return;
    }

    // Explicit bubbling for nodes that opt-in
    if (baseNode.isDynamic && leftNode && leftNode.allowEventBubbling) {
      console.log(`Mouse leave event bubbling to parent: ${nodeId}`);
      transformNode(nodeId, "mouseLeave");
    }
  };

  // THIS IS THE KEY FIX: Look for children based on the correct parent ID
  // When a variant is applied, we need to look for children of the original target node
  // not the variant node itself (which has been assigned the parent's ID)
  const findCorrectParentId = () => {
    if (!activeVariant) {
      // No variant is active, use the base node's ID
      return baseNode.id;
    }

    // When a variant is active, we need to find the original target ID
    // For child triggers, find the original target ID in the dynamicVariants
    if (activeVariant.targetId) {
      // If the variant has saved the original target ID, use that
      console.log(`Using saved targetId: ${activeVariant.targetId}`);
      return activeVariant.targetId;
    }

    // For the special property we set in transformNode
    if (activeVariant._originalTargetId) {
      console.log(
        `Using _originalTargetId: ${activeVariant._originalTargetId}`
      );
      return activeVariant._originalTargetId;
    }

    // Fallback: if we can find a connection in the original nodes that matches this variant
    const possibleSourceNodes = originalNodes.filter(
      (n) =>
        n.dynamicConnections &&
        n.dynamicConnections.some(
          (conn) =>
            // Look for connections that point to this variant's underlying ID
            conn.targetId === activeVariant.id
        )
    );

    if (possibleSourceNodes.length > 0) {
      const sourceNode = possibleSourceNodes[0];
      const connection = sourceNode.dynamicConnections.find(
        (conn) => conn.targetId === activeVariant.id
      );
      if (connection) {
        console.log(
          `Found connection to this variant, using targetId: ${connection.targetId}`
        );
        return connection.targetId;
      }
    }

    // Last resort: use the variant's ID directly
    console.log(`Using variant's ID directly: ${activeVariant.id}`);
    return activeVariant.id;
  };

  // Get direct children of the current variant
  const parentId = activeVariant ? findCorrectParentId() : baseNode.id;
  console.log(`Using parentId for children: ${parentId}`);

  // Get direct children of the current variant
  const directChildren = originalNodes.filter((n) => n.parentId === parentId);
  console.log(
    `Found ${directChildren.length} direct children for parentId ${parentId} in current viewport`
  );

  const [visibleChildrenIds, setVisibleChildrenIds] = useState([]);
  const [fadingChildrenIds, setFadingChildrenIds] = useState([]);
  const fadeTimeout = useRef(null);

  // Add this useEffect to detect changes in children
  useEffect(() => {
    // Get the current child IDs
    const currentChildIds = directChildren.map((child) => child.id);

    // Find children that weren't previously visible (to fade them in)
    const newChildrenIds = currentChildIds.filter(
      (id) => !visibleChildrenIds.includes(id)
    );

    // Find children that were previously visible but are no longer (to fade them out)
    const removedChildrenIds = visibleChildrenIds.filter(
      (id) => !currentChildIds.includes(id)
    );

    // Update the fading children state with both new and removed children
    if (newChildrenIds.length > 0 || removedChildrenIds.length > 0) {
      // Clear any existing timeout
      if (fadeTimeout.current) {
        clearTimeout(fadeTimeout.current);
      }

      // Set the fading children (both new appearing and old disappearing)
      setFadingChildrenIds([...newChildrenIds, ...removedChildrenIds]);

      // After animation is complete, update the visible children
      fadeTimeout.current = setTimeout(() => {
        setVisibleChildrenIds(currentChildIds);
        setFadingChildrenIds([]);
      }, 300); // Match this duration with your CSS transition time
    } else {
      // If no changes, just update the visible children
      setVisibleChildrenIds(currentChildIds);
    }

    // Cleanup timeout on unmount
    return () => {
      if (fadeTimeout.current) {
        clearTimeout(fadeTimeout.current);
      }
    };
  }, [directChildren]); // Depend on directChildren to detect changes

  // Recursive function to render a node and its children
  const renderNode = (nodeId) => {
    const node = originalNodes.find((n) => n.id === nodeId);
    if (!node) {
      console.log(`Node not found: ${nodeId}`);
      return null;
    }

    // Get the children of this node
    const children = originalNodes.filter((n) => n.parentId === node.id);
    const hasChildren = children.length > 0;

    if (hasChildren) {
      console.log(`Node ${nodeId} has ${children.length} children`);
    }

    // Check for background
    const hasBackground =
      node.style.backgroundImage || node.style.backgroundVideo;

    // Check if this node is interactive (has dynamic properties or connections)
    const isInteractive = isNodeInteractive(node);

    // Determine if this node is fading in/out
    const isFading = fadingChildrenIds.includes(node.id);
    const isNewChild =
      !visibleChildrenIds.includes(node.id) &&
      directChildren.some((child) => child.id === node.id);

    // Fade classes for CSS transitions
    const fadeClass = isNewChild ? "fade-in" : isFading ? "fade-out" : "";

    // Common event handlers for all node types
    const interactiveProps = {
      onClick: (e) => handleClick(e, node.id),
      onMouseEnter: (e) => handleMouseEnter(e, node.id),
      onMouseLeave: (e) => handleMouseLeave(e, node.id),
      "data-is-dynamic": isInteractive ? "true" : undefined,
      "data-fade-state": fadeClass || undefined,
      className: `dynamic-child ${fadeClass}`,
      style: {
        cursor: isInteractive ? "pointer" : undefined,
        ...node.style,
        position: "relative",
        left: 0,
        top: 0,
        right: "auto",
        bottom: "auto",
        transition: "opacity 0.3s ease-in-out",
        opacity: fadeClass === "fade-in" ? 0 : 1, // Start invisible for fade-in
      },
    };

    switch (node.type) {
      case "image":
        return (
          <img
            key={node.id}
            data-node-id={node.id}
            data-child-id={node.id}
            data-child-type="image"
            src={node.style.src}
            alt=""
            {...interactiveProps}
            style={{
              ...interactiveProps.style,
              transform: "none",
              maxWidth: "100%",
              maxHeight: "100%",
              display: "block",
              objectFit: node.style.objectFit || "cover",
            }}
          />
        );

      case "text":
        return (
          <div
            key={node.id}
            data-node-id={node.id}
            data-child-id={node.id}
            data-child-type="text"
            dangerouslySetInnerHTML={{ __html: node.style.text || "" }}
            {...interactiveProps}
          />
        );

      case "frame":
        return (
          <div
            key={node.id}
            data-node-id={node.id}
            data-child-id={node.id}
            data-child-type="frame"
            data-has-children={hasChildren ? "true" : "false"}
            {...interactiveProps}
            style={{
              ...interactiveProps.style,
              backgroundColor: node.style.backgroundColor || "transparent",
              display: node.style.display || "flex",
              flexDirection: node.style.flexDirection || "column",
              justifyContent: node.style.justifyContent || "center",
              alignItems: node.style.alignItems || "center",
              padding: node.style.padding || 0,
            }}
          >
            {/* Add background wrapper for frames */}
            {hasBackground && (
              <div
                className="dynamic-child-background"
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  overflow: "hidden",
                }}
              >
                {node.style.backgroundImage && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `url(${node.style.backgroundImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}
                {node.style.backgroundVideo && (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    src={node.style.backgroundVideo}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
              </div>
            )}

            {/* Child content container */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                height: "100%",
                display: node.style.display || "flex",
                flexDirection: node.style.flexDirection || "column",
                justifyContent: node.style.justifyContent || "center",
                alignItems: node.style.alignItems || "center",
                gap: node.style.gap || 0,
              }}
            >
              {/* Recursively render all children */}
              {hasChildren && children.map((child) => renderNode(child.id))}
            </div>
          </div>
        );

      case "video":
        return (
          <video
            key={node.id}
            data-node-id={node.id}
            data-child-id={node.id}
            data-child-type="video"
            src={node.style.src}
            autoPlay
            loop
            muted
            playsInline
            {...interactiveProps}
            style={{
              ...interactiveProps.style,
              objectFit: node.style.objectFit || "cover",
            }}
          />
        );

      default:
        return (
          <div
            key={node.id}
            data-node-id={node.id}
            data-child-id={node.id}
            {...interactiveProps}
          >
            Unknown node type: {node.type}
          </div>
        );
    }
  };

  // Force-render children directly using the recursive function
  const renderDirectChildren = () => {
    if (directChildren.length === 0) {
      console.log(`No children found for parent ${parentId}`);
      return (
        <div style={{ display: "none" }}>No children found for {parentId}</div>
      );
    }

    console.log(
      `DIRECT RENDERING ${directChildren.length} children from original nodes for parent ${parentId}`
    );

    return directChildren.map((child) => renderNode(child.id));
  };

  // Determine if there's a background (image or video)
  const hasBackground =
    mergedStyle.backgroundImage || mergedStyle.backgroundVideo;

  // Create the main element based on the node type
  const renderMainContent = () => {
    // Render specific content based on node type
    switch (currentVariant.type) {
      case "image":
        return (
          <img
            className="dynamic-node-main-content"
            src={mergedStyle.src}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: mergedStyle.objectFit || "cover",
              position: "relative",
              zIndex: 1,
            }}
          />
        );

      case "text":
        return (
          <div
            className="dynamic-node-main-content"
            dangerouslySetInnerHTML={{ __html: mergedStyle.text || "" }}
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              zIndex: 1,
            }}
          />
        );

      case "video":
        return (
          <video
            className="dynamic-node-main-content"
            src={mergedStyle.src}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: mergedStyle.objectFit || "cover",
              position: "relative",
              zIndex: 1,
            }}
          />
        );

      case "frame":
      default:
        // For frames, we render children in a container
        return (
          <div
            className="dynamic-node-content"
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              height: "100%",
              display: mergedStyle.display || "flex",
              flexDirection: mergedStyle.flexDirection || "column",
              justifyContent: mergedStyle.justifyContent || "center",
              alignItems: mergedStyle.alignItems || "center",
              gap: mergedStyle.gap || 0,
            }}
          >
            {renderDirectChildren()}
          </div>
        );
    }
  };

  // Calculate combined style (without direct image/video/text properties)
  const { src, text, backgroundImage, backgroundVideo, ...containerStyle } =
    mergedStyle;

  const fadeCss = `
  .fade-in {
    animation: fadeIn 0.3s ease-in-out forwards;
  }
  .fade-out {
    animation: fadeOut 0.3s ease-in-out forwards;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;

  return (
    <>
      {/* Add responsive CSS */}
      <style>{fadeCss}</style>

      {responsiveCSS && <style>{responsiveCSS}</style>}
      {backgroundImageCSS && <style>{backgroundImageCSS}</style>}
      {mediaQueryContent && <style>{mediaQueryContent}</style>}

      <div
        id={`dynamic-node-${nodeId}`}
        data-node-id={nodeId}
        data-node-type={currentVariant.type}
        data-is-dynamic={baseNode.isDynamic ? "true" : undefined}
        data-variant-id={activeVariant ? activeVariant.id : undefined}
        data-render-key={forceRender}
        style={{
          ...containerStyle,
          // cursor: baseNode.isDynamic ? "pointer" : undefined,
          transition: activeVariant ? "all 0.3s ease-in-out" : "none",
          position: "relative",
          backgroundColor: containerStyle.backgroundColor || "transparent",
        }}
        onClick={(e) => handleClick(e, nodeId)}
        onMouseEnter={(e) => handleMouseEnter(e, nodeId)}
        onMouseLeave={(e) => handleMouseLeave(e, nodeId)}
      >
        {/* Background wrapper if present */}
        {hasBackground && (
          <div
            className="dynamic-node-background"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              overflow: "hidden",
            }}
          >
            {mergedStyle.backgroundImage && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${mergedStyle.backgroundImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}
            {mergedStyle.backgroundVideo && (
              <video
                autoPlay
                loop
                muted
                playsInline
                src={mergedStyle.backgroundVideo}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
          </div>
        )}

        {/* Main node content based on type */}
        {renderMainContent()}
      </div>
    </>
  );
};
