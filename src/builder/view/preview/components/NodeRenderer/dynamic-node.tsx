import React, { useMemo, useEffect, useRef, useState } from "react";
import { usePreview } from "../../preview-context";
import { findNodeById } from "../../utils/nodeUtils";
import {
  generateResponsiveCSS,
  generateBackgroundImageCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";

const getActiveBreakpoint = (width, breakpoints) => {
  const sortedBreakpoints = [...breakpoints].sort((a, b) => b.width - a.width);
  for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
    const current = sortedBreakpoints[i];
    const next = sortedBreakpoints[i + 1];
    if (width >= next.width && width <= current.width) {
      return current;
    }
  }
  if (width < sortedBreakpoints[sortedBreakpoints.length - 1].width) {
    return sortedBreakpoints[sortedBreakpoints.length - 1];
  }
  return sortedBreakpoints[0];
};

export const DynamicNode = ({ nodeId }) => {
  const [renderCounter, setRenderCounter] = useState(0);
  const {
    nodeTree,
    dynamicVariants,
    transformNode,
    originalNodes,
    viewportBreakpoints,
    currentViewport,
    setDynamicVariants,
  } = usePreview();

  const adjustedCurrentViewport = useMemo(() => {
    // Check if the current viewport exactly matches any breakpoint
    const exactMatch = viewportBreakpoints.some(
      (bp) => bp.width === currentViewport
    );
    // If it's an exact match, subtract a small amount
    return exactMatch ? currentViewport - 0.1 : currentViewport;
  }, [currentViewport, viewportBreakpoints]);

  const prevDynamicVariantsRef = useRef(dynamicVariants);
  const componentMountedRef = useRef(false);
  // Force component to properly re-render on initial mount and variant changes
  const [forceNestedUpdate, setForceNestedUpdate] = useState(0);

  // Get sorted breakpoints from largest to smallest
  const sortedBreakpoints = useMemo(() => {
    return [...viewportBreakpoints].sort((a, b) => b.width - a.width);
  }, [viewportBreakpoints]);

  // Helper function to get the child for a specific viewport width
  const getChildForViewport = (childNode, viewportWidth) => {
    if (!childNode.sharedId) return childNode;

    // Get all responsive versions of this child
    const responsiveVersions = originalNodes.filter(
      (n) => n.sharedId === childNode.sharedId && n.dynamicViewportId
    );

    if (responsiveVersions.length === 0) return childNode;

    // Special case for exact boundary values
    const exactBreakpoint = viewportBreakpoints.find(
      (bp) => bp.width === viewportWidth
    );
    if (exactBreakpoint) {
      const childForExactBreakpoint = responsiveVersions.find(
        (n) => n.dynamicViewportId === exactBreakpoint.id
      );
      if (childForExactBreakpoint) {
        return childForExactBreakpoint;
      }
    }

    // Normal case - find closest smaller or equal breakpoint
    const sortedBreakpoints = [...viewportBreakpoints].sort(
      (a, b) => b.width - a.width
    );

    for (const breakpoint of sortedBreakpoints) {
      if (breakpoint.width <= viewportWidth) {
        const childForBreakpoint = responsiveVersions.find(
          (n) => n.dynamicViewportId === breakpoint.id
        );
        if (childForBreakpoint) {
          return childForBreakpoint;
        }
      }
    }

    return childNode;
  };

  // Get the base node from the tree (or fallback to originalNodes)
  const baseNode = useMemo(() => {
    const nodeFromTree = findNodeById(nodeTree, nodeId);
    return nodeFromTree || originalNodes.find((n) => n.id === nodeId);
  }, [nodeTree, nodeId, originalNodes]);
  if (!baseNode) return null;

  // Get the current viewport breakpoint.
  const currentViewportObj = getActiveBreakpoint(
    adjustedCurrentViewport,
    viewportBreakpoints
  );

  // Choose the responsive base node based on sharedId and current viewport.
  const responsiveBaseNode = useMemo(() => {
    if (!baseNode.sharedId || !currentViewportObj) return baseNode;

    // Try to find an exact match first
    const exactMatch = originalNodes.find(
      (n) =>
        n.sharedId === baseNode.sharedId &&
        n.dynamicViewportId === currentViewportObj.id
    );

    if (exactMatch) return exactMatch;

    // If no exact match, find the most appropriate responsive node
    const responsiveNodes = originalNodes.filter(
      (n) => n.sharedId === baseNode.sharedId && n.dynamicViewportId
    );

    if (responsiveNodes.length === 0) return baseNode;

    // Sort by viewport width (largest to smallest)
    const sortedNodes = responsiveNodes.sort((a, b) => {
      const aVp = viewportBreakpoints.find(
        (vp) => vp.id === a.dynamicViewportId
      );
      const bVp = viewportBreakpoints.find(
        (vp) => vp.id === b.dynamicViewportId
      );
      if (!aVp || !bVp) return 0;
      return bVp.width - aVp.width;
    });

    // Find the closest responsive node for current viewport
    const currentWidth = adjustedCurrentViewport;
    const bestMatch = sortedNodes.find((n) => {
      const vp = viewportBreakpoints.find((v) => v.id === n.dynamicViewportId);
      return vp && vp.width <= currentWidth;
    });

    return bestMatch || baseNode;
  }, [
    baseNode,
    currentViewportObj,
    originalNodes,
    viewportBreakpoints,
    adjustedCurrentViewport,
  ]);

  // Look up the active variant using the responsive base node's id.
  const activeVariant = dynamicVariants[responsiveBaseNode.id];
  const currentVariant = activeVariant || responsiveBaseNode;

  useEffect(() => {
    if (!dynamicVariants[responsiveBaseNode.id] && baseNode.isDynamic) {
      // Initialize with default state (no variant active)
      setDynamicVariants((prev) => ({
        ...prev,
        [responsiveBaseNode.id]: null,
      }));
    }
  }, [responsiveBaseNode.id, baseNode.isDynamic]);

  // Force a re-render whenever the component mounts to ensure proper rendering
  useEffect(() => {
    if (!componentMountedRef.current) {
      componentMountedRef.current = true;
      setRenderCounter((prev) => prev + 1);
      setForceNestedUpdate((prev) => prev + 1);
      const timer = setTimeout(() => {
        setRenderCounter((prev) => prev + 1);
        setForceNestedUpdate((prev) => prev + 1);
      }, 10);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update when dynamic variants change
  useEffect(() => {
    if (!activeVariant) return;
    setForceNestedUpdate((prev) => prev + 1);
    const timer = setTimeout(() => {
      const rootElement = document.querySelector(`#dynamic-node-${nodeId}`);
      if (rootElement) {
        rootElement.offsetHeight;
        rootElement.setAttribute("data-variant-update", forceNestedUpdate);
        const allChildren = rootElement.querySelectorAll(".dynamic-child");
        allChildren.forEach((child) => {
          child.setAttribute("data-variant-update", forceNestedUpdate);
          child.offsetHeight;
        });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [dynamicVariants, nodeId, activeVariant, forceNestedUpdate]);

  // Update render counter when dynamicVariants change for the responsive base node.
  useEffect(() => {
    if (
      prevDynamicVariantsRef.current[responsiveBaseNode.id] !==
      dynamicVariants[responsiveBaseNode.id]
    ) {
      setRenderCounter((prev) => prev + 1);
    }
    prevDynamicVariantsRef.current = dynamicVariants;
  }, [dynamicVariants, responsiveBaseNode.id]);

  // Enhanced media query generation with non-overlapping breakpoints
  const generateEnhancedResponsiveCSS = (node, breakpoints) => {
    if (!node || !node.sharedId) return "";
    const responsiveNodes = originalNodes.filter(
      (n) => n.sharedId === node.sharedId && n.dynamicViewportId
    );
    if (responsiveNodes.length === 0) return "";
    const sortedBreakpoints = [...breakpoints].sort(
      (a, b) => b.width - a.width
    );
    let cssRules = "";
    const largestBreakpoint = sortedBreakpoints[0];
    if (largestBreakpoint) {
      const largestNode =
        responsiveNodes.find(
          (n) => n.dynamicViewportId === largestBreakpoint.id
        ) || node;
      cssRules += `
        @media (min-width: ${
          sortedBreakpoints[1] ? sortedBreakpoints[1].width : 0
        }px) {
          #dynamic-node-${nodeId} {
            width: ${largestNode.style.width || "auto"} !important;
            height: ${largestNode.style.height || "auto"} !important;
            background-color: ${
              largestNode.style.backgroundColor || "transparent"
            } !important;
            ${
              largestNode.style.flexDirection
                ? `flex-direction: ${largestNode.style.flexDirection} !important;`
                : ""
            }
            ${
              largestNode.style.padding
                ? `padding: ${largestNode.style.padding} !important;`
                : ""
            }
            ${
              largestNode.style.margin
                ? `margin: ${largestNode.style.margin} !important;`
                : ""
            }
            ${
              largestNode.style.borderRadius
                ? `border-radius: ${largestNode.style.borderRadius} !important;`
                : ""
            }
          }
        }
      `;
    }
    for (let i = 1; i < sortedBreakpoints.length - 1; i++) {
      const currentBreakpoint = sortedBreakpoints[i];
      const nextBreakpoint = sortedBreakpoints[i + 1];
      const responsiveNode = responsiveNodes.find(
        (n) => n.dynamicViewportId === currentBreakpoint.id
      );
      if (responsiveNode) {
        const minWidth = nextBreakpoint.width;
        const maxWidth = currentBreakpoint.width - 0.02;
        cssRules += `
          @media (min-width: ${minWidth}px) and (max-width: ${maxWidth}px) {
            #dynamic-node-${nodeId} {
              width: ${responsiveNode.style.width || "auto"} !important;
              height: ${responsiveNode.style.height || "auto"} !important;
              background-color: ${
                responsiveNode.style.backgroundColor || "transparent"
              } !important;
              ${
                responsiveNode.style.flexDirection
                  ? `flex-direction: ${responsiveNode.style.flexDirection} !important;`
                  : ""
              }
              ${
                responsiveNode.style.padding
                  ? `padding: ${responsiveNode.style.padding} !important;`
                  : ""
              }
              ${
                responsiveNode.style.margin
                  ? `margin: ${responsiveNode.style.margin} !important;`
                  : ""
              }
              ${
                responsiveNode.style.borderRadius
                  ? `border-radius: ${responsiveNode.style.borderRadius} !important;`
                  : ""
              }
            }
          }
        `;
      }
    }
    const smallestBreakpoint = sortedBreakpoints[sortedBreakpoints.length - 1];
    if (smallestBreakpoint) {
      const smallestNode = responsiveNodes.find(
        (n) => n.dynamicViewportId === smallestBreakpoint.id
      );
      if (smallestNode) {
        cssRules += `
          @media (max-width: ${smallestBreakpoint.width - 0.02}px) {
            #dynamic-node-${nodeId} {
              width: ${smallestNode.style.width || "auto"} !important;
              height: ${smallestNode.style.height || "auto"} !important;
              background-color: ${
                smallestNode.style.backgroundColor || "transparent"
              } !important;
              ${
                smallestNode.style.flexDirection
                  ? `flex-direction: ${smallestNode.style.flexDirection} !important;`
                  : ""
              }
              ${
                smallestNode.style.padding
                  ? `padding: ${smallestNode.style.padding} !important;`
                  : ""
              }
              ${
                smallestNode.style.margin
                  ? `margin: ${smallestNode.style.margin} !important;`
                  : ""
              }
              ${
                smallestNode.style.borderRadius
                  ? `border-radius: ${smallestNode.style.borderRadius} !important;`
                  : ""
              }
            }
          }
        `;
      }
    }
    return cssRules;
  };

  // Generate responsive CSS and media query content.
  const responsiveCSS = generateResponsiveCSS(baseNode, viewportBreakpoints);
  const enhancedResponsiveCSS = generateEnhancedResponsiveCSS(
    baseNode,
    viewportBreakpoints
  );
  const backgroundImageCSS = baseNode.style.backgroundImage
    ? generateBackgroundImageCSS(baseNode, viewportBreakpoints)
    : "";
  const mediaQueryContent = generateMediaQueryContent(
    baseNode,
    viewportBreakpoints
  );

  const responsiveNode = useMemo(() => {
    return getChildForViewport(baseNode, adjustedCurrentViewport);
  }, [baseNode, adjustedCurrentViewport, viewportBreakpoints]);

  // Compute the merged style based solely on base node, responsive overrides, and variant.
  const mergedStyle = useMemo(() => {
    const baseStyle = { ...baseNode.style };

    if (responsiveNode && responsiveNode.id !== baseNode.id) {
      if (responsiveNode.independentStyles) {
        Object.keys(responsiveNode.independentStyles).forEach((key) => {
          if (
            responsiveNode.independentStyles[key] &&
            responsiveNode.style[key] !== undefined
          ) {
            baseStyle[key] = responsiveNode.style[key];
          }
        });
      } else {
        Object.assign(baseStyle, responsiveNode.style);
      }
    }

    if (activeVariant) {
      const targetId =
        activeVariant.targetId || activeVariant._originalTargetId;
      const targetNode = originalNodes.find((n) => n.id === targetId);
      const variantStyle = targetNode
        ? { ...targetNode.style }
        : { ...activeVariant.style };

      variantStyle.position = "relative";
      delete variantStyle.left;
      delete variantStyle.top;
      delete variantStyle.right;
      delete variantStyle.bottom;
      variantStyle.transition = "all 0.3s ease";
      return variantStyle;
    }

    return baseStyle;
  }, [baseNode.style, activeVariant, originalNodes, responsiveNode]);

  // Interaction handlers
  const handleClick = (e, targetNodeId) => {
    e.stopPropagation();
    const clickedNode = originalNodes.find((n) => n.id === targetNodeId);
    if (!clickedNode) return;

    // Check connections on the responsive version of the node, not just the base node
    if (
      targetNodeId === responsiveBaseNode.id &&
      responsiveBaseNode.dynamicConnections &&
      responsiveBaseNode.dynamicConnections.length > 0
    ) {
      const connection = responsiveBaseNode.dynamicConnections.find(
        (conn) => conn.type === "click"
      );
      if (connection) {
        transformNode(targetNodeId, "click");
        return;
      }
    }
    if (
      clickedNode.dynamicConnections &&
      clickedNode.dynamicConnections.length > 0
    ) {
      const connection = clickedNode.dynamicConnections.find(
        (conn) => conn.type === "click"
      );
      if (connection) {
        transformNode(targetNodeId, "click");
        return;
      }
    }
    if (targetNodeId === responsiveBaseNode.id && activeVariant) {
      transformNode(responsiveBaseNode.id, "click");
      return;
    }
    if (targetNodeId === responsiveBaseNode.id && baseNode.isDynamic) {
      transformNode(responsiveBaseNode.id, "click");
      return;
    }
  };

  const handleMouseEnter = (e, targetNodeId) => {
    e.stopPropagation();
    const hoveredNode = originalNodes.find((n) => n.id === targetNodeId);
    if (!hoveredNode) return;
    if (
      hoveredNode.dynamicConnections &&
      hoveredNode.dynamicConnections.some((conn) => conn.type === "hover")
    ) {
      transformNode(targetNodeId, "hover");
    }
    if (targetNodeId === responsiveBaseNode.id && baseNode.isDynamic) {
      transformNode(responsiveBaseNode.id, "hover");
    }
  };

  const handleMouseLeave = (e, targetNodeId) => {
    e.stopPropagation();
    const node = originalNodes.find((n) => n.id === targetNodeId);
    if (!node) return;
    if (
      node.dynamicConnections &&
      node.dynamicConnections.some((conn) => conn.type === "mouseLeave")
    ) {
      transformNode(targetNodeId, "mouseLeave");
    }
    if (targetNodeId === responsiveBaseNode.id && baseNode.isDynamic) {
      transformNode(responsiveBaseNode.id, "mouseLeave");
    }
  };

  // Determine the parent id for children lookup.
  const findCorrectParentId = () => {
    if (!activeVariant) return responsiveBaseNode.id;
    if (activeVariant.targetId) return activeVariant.targetId;
    if (activeVariant._originalTargetId) return activeVariant._originalTargetId;
    return activeVariant.id;
  };

  const parentId = findCorrectParentId();

  // Fixed version of directChildren that handles exact breakpoint boundaries
  const directChildren = useMemo(() => {
    let childrenForParent = originalNodes.filter(
      (n) => n.parentId === parentId
    );

    const exactBreakpoint = viewportBreakpoints.find(
      (bp) => bp.width === adjustedCurrentViewport
    );

    if (exactBreakpoint) {
      const largestBreakpoint = sortedBreakpoints[0];

      if (exactBreakpoint.id !== largestBreakpoint.id) {
        const breakpointParent = originalNodes.find(
          (n) =>
            n.sharedId === baseNode.sharedId &&
            n.dynamicViewportId === exactBreakpoint.id
        );

        if (breakpointParent) {
          const breakpointChildren = originalNodes.filter(
            (n) => n.parentId === breakpointParent.id
          );
          if (breakpointChildren.length > 0) {
            return breakpointChildren;
          }
        }
      }
    }

    return childrenForParent;
  }, [
    parentId,
    adjustedCurrentViewport,
    viewportBreakpoints,
    baseNode,
    originalNodes,
    sortedBreakpoints,
  ]);

  const parseTextContent = (html) => {
    if (!html) return { content: "", style: {} };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Get the span element that contains the actual text and styles
      const span = doc.querySelector("span");

      if (span) {
        // Get the raw text content without HTML tags
        const textContent = span.textContent || "";

        // Extract the styles from the span element
        const styleAttr = span.getAttribute("style") || "";
        const styles = {};

        // Extract color
        const colorMatch = styleAttr.match(/color:\s*([^;]+)/i);
        if (colorMatch) styles.color = colorMatch[1].trim();

        // Extract font size
        const fontSizeMatch = styleAttr.match(/font-size:\s*([^;]+)/i);
        if (fontSizeMatch) styles.fontSize = fontSizeMatch[1].trim();

        // Extract font weight
        const fontWeightMatch = styleAttr.match(/font-weight:\s*([^;]+)/i);
        if (fontWeightMatch) styles.fontWeight = fontWeightMatch[1].trim();

        // Extract font family - specific improvements for handling quotes
        const fontFamilyMatch = styleAttr.match(/font-family:\s*([^;]+)/i);
        if (fontFamilyMatch) styles.fontFamily = fontFamilyMatch[1].trim();

        // Extract line height
        const lineHeightMatch = styleAttr.match(/line-height:\s*([^;]+)/i);
        if (lineHeightMatch) styles.lineHeight = lineHeightMatch[1].trim();

        return { content: textContent, style: styles };
      }
    } catch (e) {
      console.error("Error parsing HTML:", e);
    }

    return { content: "", style: {} };
  };

  // Recursive render function for a node and its children.
  const renderNode = (nodeId) => {
    const node = originalNodes.find((n) => n.id === nodeId);
    if (!node) return null;

    const responsiveChild = getChildForViewport(node, adjustedCurrentViewport);

    let childStyle = { ...node.style };
    if (responsiveChild && responsiveChild.id !== node.id) {
      if (responsiveChild.independentStyles) {
        Object.keys(responsiveChild.independentStyles).forEach((key) => {
          if (
            responsiveChild.independentStyles[key] &&
            responsiveChild.style[key] !== undefined
          ) {
            childStyle[key] = responsiveChild.style[key];
          }
        });
      } else {
        Object.assign(childStyle, responsiveChild.style);
      }
    }

    if (activeVariant) {
      const targetId =
        activeVariant.targetId || activeVariant._originalTargetId;
      if (targetId) {
        const variantChild = originalNodes.find(
          (n) => n.sharedId === node.sharedId && n.parentId === targetId
        );

        if (variantChild) {
          childStyle = {
            ...variantChild.style,
            position: "relative",
            left: 0,
            top: 0,
            right: "auto",
            bottom: "auto",
            transition: "all 0.3s ease",
          };
        }
      }
    }

    let childrenForNode = originalNodes.filter((n) => n.parentId === node.id);

    const exactBreakpoint = viewportBreakpoints.find(
      (bp) => bp.width === adjustedCurrentViewport
    );

    if (
      exactBreakpoint &&
      responsiveChild.dynamicViewportId === exactBreakpoint.id
    ) {
      const breakpointChildren = originalNodes.filter(
        (n) => n.parentId === responsiveChild.id
      );
      if (breakpointChildren.length > 0) {
        childrenForNode = breakpointChildren;
      }
    }

    const hasChildren = childrenForNode.length > 0;
    const isInteractive =
      node.isDynamic ||
      (node.dynamicConnections && node.dynamicConnections.length > 0);

    const interactiveProps = {
      onClick: (e) => handleClick(e, node.id),
      onMouseEnter: (e) => handleMouseEnter(e, node.id),
      onMouseLeave: (e) => handleMouseLeave(e, node.id),
      "data-is-dynamic": isInteractive ? "true" : undefined,
      "data-node-id": node.id,
      "data-shared-id": node.sharedId || undefined,
      "data-viewport-id":
        responsiveChild.dynamicViewportId || node.dynamicViewportId,
      "data-variant-update": forceNestedUpdate,
      key: node.sharedId || node.id,
      className: `dynamic-child ${node.customName || ""}`,
      style: {
        cursor: isInteractive ? "pointer" : undefined,
        ...childStyle,
        transition: activeVariant ? "all 0.3s ease" : "none",
      },
    };

    switch (node.type) {
      case "image":
        return (
          <img
            {...interactiveProps}
            data-child-type="image"
            src={childStyle.src}
            alt=""
            style={{
              ...interactiveProps.style,
              transform: "none",
              maxWidth: "100%",
              maxHeight: "100%",
              display: "block",
              objectFit: childStyle.objectFit || "cover",
            }}
          />
        );
      case "text":
        const parsedText = parseTextContent(childStyle.text);

        return (
          <div
            {...interactiveProps}
            data-child-type="text"
            style={{
              ...interactiveProps.style,
              // Remove text-specific properties
              color: undefined,
              fontSize: undefined,
              fontWeight: undefined,
              fontFamily: undefined,
              lineHeight: undefined,
              textAlign: undefined,
            }}
          >
            <p
              className="text-inherit"
              style={{ textAlign: childStyle.textAlign || "center" }}
            >
              <span
                style={{
                  color: parsedText.style.color || childStyle.color,
                  fontSize: parsedText.style.fontSize || childStyle.fontSize,
                  fontWeight:
                    parsedText.style.fontWeight || childStyle.fontWeight,
                  fontFamily:
                    parsedText.style.fontFamily || childStyle.fontFamily,
                  lineHeight:
                    parsedText.style.lineHeight || childStyle.lineHeight,
                  transition: "all 0.3s ease",
                  display: "inline-block",
                }}
              >
                {parsedText.content}
              </span>
            </p>
          </div>
        );
      case "frame":
        const hasBackground =
          childStyle.backgroundImage || childStyle.backgroundVideo;
        return (
          <div
            {...interactiveProps}
            data-child-type="frame"
            data-has-children={hasChildren ? "true" : "false"}
            style={{
              ...interactiveProps.style,
              display: childStyle.display || "flex",
              flexDirection: childStyle.flexDirection || "column",
              justifyContent: childStyle.justifyContent || "center",
              alignItems: childStyle.alignItems || "center",
              padding: childStyle.padding || 0,
              borderRadius: childStyle.borderRadius || "",
            }}
          >
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
                {childStyle.backgroundImage && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `url(${childStyle.backgroundImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      transition: activeVariant ? "all 0.3s ease" : "none",
                    }}
                  />
                )}
                {childStyle.backgroundVideo && (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    src={childStyle.backgroundVideo}
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
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                height: "100%",
                display: childStyle.display || "flex",
                flexDirection: childStyle.flexDirection || "column",
                justifyContent: childStyle.justifyContent || "center",
                alignItems: childStyle.alignItems || "center",
                gap: childStyle.gap || 0,
              }}
            >
              {hasChildren &&
                childrenForNode.map((child) => renderNode(child.id))}
            </div>
          </div>
        );
      case "video":
        return (
          <video
            {...interactiveProps}
            data-child-type="video"
            src={childStyle.src}
            autoPlay
            loop
            muted
            playsInline
            style={{
              ...interactiveProps.style,
              objectFit: childStyle.objectFit || "cover",
            }}
          />
        );
      default:
        return <div {...interactiveProps}>Unknown node type: {node.type}</div>;
    }
  };

  const renderDirectChildren = () => {
    if (directChildren.length === 0) {
      return (
        <div style={{ display: "none" }}>No children found for {parentId}</div>
      );
    }
    return directChildren.map((child) => renderNode(child.id));
  };

  const hasBackground =
    mergedStyle.backgroundImage || mergedStyle.backgroundVideo;
  const { src, text, backgroundImage, backgroundVideo, ...containerStyle } =
    mergedStyle;

  // Define animation styles only for variants, not for responsive changes
  const transitionCSS = `
    /* Apply transitions only to variant changes, not responsive changes */
    .dynamic-node {
      transition: ${activeVariant ? "all 0.3s ease" : "none"} !important;
    }
    .dynamic-child {
      transition: ${activeVariant ? "all 0.3s ease" : "none"} !important;
    }
    
    /* Force FOUC prevention */
    .dynamic-node[data-render-count="${renderCounter}"] {
      visibility: visible !important;
    }
  `;

  const filterPositionProps = (style) => {
    if (!style) return {};
    const result = { ...style };
    const excludeProps = ["left", "top", "right", "bottom"];
    excludeProps.forEach((prop) => {
      delete result[prop];
    });
    result.position = "relative";
    return result;
  };

  // Dynamic CSS generation for variant styles
  const variantOverrideCSS = useMemo(() => {
    if (!activeVariant || !activeVariant.style) return "";
    const variantStyle = activeVariant.style;
    const cssRules = Object.entries(variantStyle)
      .filter(
        ([key]) =>
          key !== "position" &&
          key !== "left" &&
          key !== "top" &&
          key !== "right" &&
          key !== "bottom"
      )
      .map(([key, value]) => {
        const cssKey = key.replace(
          /([A-Z])/g,
          (match) => `-${match.toLowerCase()}`
        );
        return `${cssKey}: ${value} !important;`;
      })
      .join("\n");

    return `
      /* Dynamic override for all variant styles */
      #dynamic-node-${nodeId}[data-variant-id="${activeVariant.id}"]#dynamic-node-${nodeId}[data-variant-id="${activeVariant.id}"] {
        position: relative !important;
        ${cssRules}
      }
      
      /* Ensure correct initial state by using render counter */
      #dynamic-node-${nodeId}[data-render-count="${renderCounter}"][data-variant-id="${activeVariant.id}"] {
        position: relative !important;
        ${cssRules}
      }
      
      /* Force update for nested children in variants with data attributes */
      #dynamic-node-${nodeId}[data-variant-update="${forceNestedUpdate}"][data-variant-id="${activeVariant.id}"] {
        position: relative !important;
        ${cssRules}
      }
    `;
  }, [activeVariant, nodeId, renderCounter, forceNestedUpdate]);

  // Additional styles to force style application on initial load
  const initialLoadCSS = `
    @keyframes forceRepaint {
      0% { opacity: 0.999; }
      100% { opacity: 1; }
    }
    
    #dynamic-node-${nodeId} {
      animation: forceRepaint 0.001s;
      will-change: opacity;
    }
    
    #dynamic-node-${nodeId}[data-render-count="${renderCounter}"] {
      animation: forceRepaint 0.001s;
      will-change: opacity;
    }
    
    .dynamic-child[data-variant-update="${forceNestedUpdate}"] {
      animation: forceRepaint 0.001s;
      will-change: opacity, background-color, transform;
    }
  `;

  // Enhanced CSS for variant child styles
  const variantChildrenCSS = useMemo(() => {
    if (!activeVariant || !activeVariant.targetId) return "";
    const targetId = activeVariant.targetId || activeVariant._originalTargetId;
    if (!targetId) return "";
    let cssRules = "";

    const generateVariantChildRules = (parentId, level = 0) => {
      const variantChildren = originalNodes.filter(
        (node) => node.parentId === parentId
      );

      variantChildren.forEach((variantChild) => {
        if (variantChild.sharedId) {
          const variantStyleProps = Object.entries(variantChild.style || {})
            .filter(
              ([key]) =>
                key !== "position" &&
                key !== "left" &&
                key !== "top" &&
                key !== "right" &&
                key !== "bottom"
            )
            .map(([key, value]) => {
              const cssKey = key.replace(
                /([A-Z])/g,
                (match) => `-${match.toLowerCase()}`
              );
              return `${cssKey}: ${value} !important;`;
            })
            .join("\n");

          cssRules += `
            /* Level ${level} variant child styling */
            #dynamic-node-${nodeId} [data-shared-id="${variantChild.sharedId}"][data-variant-update="${forceNestedUpdate}"] {
              ${variantStyleProps}
            }
          `;

          if (variantChild.id) {
            generateVariantChildRules(variantChild.id, level + 1);
          }
        }
      });
    };

    generateVariantChildRules(targetId);

    return cssRules;
  }, [activeVariant, nodeId, originalNodes, forceNestedUpdate]);

  // Update text content for smooth text style transitions.

  return (
    <>
      <style>{transitionCSS}</style>
      <style>{enhancedResponsiveCSS}</style>
      {responsiveCSS && <style>{responsiveCSS}</style>}
      {backgroundImageCSS && <style>{backgroundImageCSS}</style>}
      {mediaQueryContent && <style>{mediaQueryContent}</style>}
      {variantOverrideCSS && <style>{variantOverrideCSS}</style>}
      {variantChildrenCSS && <style>{variantChildrenCSS}</style>}
      <style>{initialLoadCSS}</style>

      <div
        id={`dynamic-node-${nodeId}`}
        data-node-id={responsiveBaseNode.id}
        data-node-type={currentVariant.type}
        data-is-dynamic={baseNode.isDynamic ? "true" : undefined}
        data-variant-id={activeVariant ? activeVariant.id : undefined}
        data-responsive-id={responsiveNode.id}
        data-viewport-id={currentViewportObj?.id}
        data-render-count={renderCounter}
        data-variant-update={forceNestedUpdate}
        className="dynamic-node"
        style={{
          cursor: baseNode.isDynamic ? "pointer" : undefined,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          ...(activeVariant ? filterPositionProps(activeVariant.style) : {}),
        }}
        onClick={(e) => handleClick(e, responsiveBaseNode.id)}
        onMouseEnter={(e) => handleMouseEnter(e, responsiveBaseNode.id)}
        onMouseLeave={(e) => handleMouseLeave(e, responsiveBaseNode.id)}
      >
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
                  transition: activeVariant ? "all 0.3s ease" : "none",
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

        {(() => {
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
              // Parse the HTML to extract content and styling
              const mainParsedText = parseTextContent(mergedStyle.text);

              return (
                <div
                  className="dynamic-node-main-content"
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <p
                    className="text-inherit"
                    style={{ textAlign: mergedStyle.textAlign || "center" }}
                  >
                    <span
                      style={{
                        color: mainParsedText.style.color || mergedStyle.color,
                        fontSize:
                          mainParsedText.style.fontSize || mergedStyle.fontSize,
                        fontWeight:
                          mainParsedText.style.fontWeight ||
                          mergedStyle.fontWeight,
                        fontFamily:
                          mainParsedText.style.fontFamily ||
                          mergedStyle.fontFamily,
                        lineHeight:
                          mainParsedText.style.lineHeight ||
                          mergedStyle.lineHeight,
                        transition: "all 0.3s ease",
                        display: "block",
                        width: "100%",
                        height: "100%",
                      }}
                    >
                      {mainParsedText.content}
                    </span>
                  </p>
                </div>
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
        })()}
      </div>
    </>
  );
};

export default DynamicNode;
