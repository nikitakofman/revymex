// preview-context.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
  useRef,
} from "react";
import { Node, ResponsiveNode, Viewport } from "./types";
import { buildResponsiveNodeTree } from "./hooks/useResponsiveNodeTree";
import { findNodeById, processInitialDynamicNodes } from "./utils/nodeUtils";
import { buildResponsiveSubtree } from "./utils/sub-tree-builder";
import { find } from "lodash";

type PreviewContextType = {
  originalNodes: Node[];
  currentViewport: number;
  viewportBreakpoints: Viewport[];
  initialNodeTree: ResponsiveNode[];
  nodeTree: ResponsiveNode[];
  dynamicVariants: { [nodeId: string]: ResponsiveNode };
  transformNode: (sourceId: string, type: string) => void;
  setDynamicVariants: React.Dispatch<
    React.SetStateAction<{ [nodeId: string]: ResponsiveNode }>
  >;
};

const defaultContextValue: PreviewContextType = {
  originalNodes: [],
  currentViewport: 1440,
  viewportBreakpoints: [],
  initialNodeTree: [],
  nodeTree: [],
  dynamicVariants: {},
  transformNode: () => {},
  setDynamicVariants: () => {},
};

const PreviewContext = createContext<PreviewContextType>(defaultContextValue);

// Helper function to extract styles from HTML - defined OUTSIDE the component
const extractStylesFromHTML = (html: string) => {
  if (!html) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const span = doc.querySelector("span");
    if (span && span.getAttribute("style")) {
      const styleText = span.getAttribute("style");
      const result: any = {};

      // More comprehensive style extraction
      const colorMatch = styleText.match(/color:\s*([^;]+)/i);
      if (colorMatch) result.color = colorMatch[1].trim();

      const fontSizeMatch = styleText.match(/font-size:\s*([^;]+)/i);
      if (fontSizeMatch) result.fontSize = fontSizeMatch[1].trim();

      const fontWeightMatch = styleText.match(/font-weight:\s*([^;]+)/i);
      if (fontWeightMatch) result.fontWeight = fontWeightMatch[1].trim();

      const fontFamilyMatch = styleText.match(/font-family:\s*([^;]+)/i);
      if (fontFamilyMatch) result.fontFamily = fontFamilyMatch[1].trim();

      const lineHeightMatch = styleText.match(/line-height:\s*([^;]+)/i);
      if (lineHeightMatch) result.lineHeight = lineHeightMatch[1].trim();

      const textDecorationMatch = styleText.match(
        /text-decoration:\s*([^;]+)/i
      );
      if (textDecorationMatch)
        result.textDecoration = textDecorationMatch[1].trim();

      const fontStyleMatch = styleText.match(/font-style:\s*([^;]+)/i);
      if (fontStyleMatch) result.fontStyle = fontStyleMatch[1].trim();

      return result;
    }
  } catch (e) {
    console.error("Error parsing HTML:", e);
  }
  return null;
};

// Helper function to extract text content
const extractTextContent = (html: string) => {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const span = doc.querySelector("span");
    if (span) {
      return span.textContent || "";
    }
  } catch (e) {
    console.error("Error extracting text content:", e);
  }
  return "";
};

export const PreviewProvider: React.FC<{
  children: ReactNode;
  nodes: Node[];
  initialDynamicVariants?: { [nodeId: string]: ResponsiveNode };
}> = ({ children, nodes, initialDynamicVariants = {} }) => {
  const originalNodes = useMemo(() => nodes, [nodes]);

  const getAllConnectionsForNode = (nodeId: string, eventType: string) => {
    const connections = [];

    // First, look for connections in the original node
    const sourceNode = originalNodes.find((n) => n.id === nodeId);
    if (sourceNode && sourceNode.dynamicConnections) {
      const sourceConnections = sourceNode.dynamicConnections.filter(
        (conn) => conn.type === eventType
      );
      connections.push(...sourceConnections);
    }

    // Next, look for connections in any target variants that match this node's shared ID
    if (sourceNode && sourceNode.sharedId) {
      const variantNodes = originalNodes.filter(
        (n) =>
          n.sharedId === sourceNode.sharedId && n.isVariant && n.id !== nodeId
      );

      variantNodes.forEach((variantNode) => {
        if (variantNode.dynamicConnections) {
          const variantConnections = variantNode.dynamicConnections.filter(
            (conn) => conn.type === eventType
          );
          connections.push(...variantConnections);
        }
      });
    }

    return connections;
  };

  // Basic viewport handling
  const [currentViewport, setCurrentViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );

  const viewportBreakpoints = useMemo(() => {
    return nodes
      .filter((node) => node.isViewport)
      .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0))
      .map((viewport) => ({
        id: viewport.id,
        width: viewport.viewportWidth || 0,
        name: viewport.viewportName || "",
      }));
  }, [nodes]);

  // Build initial tree
  const initialNodeTree = useMemo(() => {
    return buildResponsiveNodeTree(nodes, viewportBreakpoints);
  }, [nodes, viewportBreakpoints]);

  const [nodeTree, setNodeTree] = useState<ResponsiveNode[]>([]);
  const [dynamicVariants, setDynamicVariants] = useState<{
    [nodeId: string]: ResponsiveNode;
  }>(initialDynamicVariants || {});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setCurrentViewport(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const processed = processInitialDynamicNodes(initialNodeTree);
    setNodeTree(processed);
  }, [initialNodeTree]);

  // Store text content to prevent content replacement
  const textContentCache = useRef<{
    [nodeId: string]: { [sharedId: string]: string };
  }>({});

  // The transformNode function with the fix
  // Add this to the top of preview-context.tsx (outside of any component)
  // Enhanced helper function to extract styles from HTML with more thorough regex patterns
  const extractStylesFromHTML = (html: string) => {
    if (!html) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const span = doc.querySelector("span");
      if (span && span.getAttribute("style")) {
        const styleText = span.getAttribute("style");
        const result: any = {};

        // More comprehensive style extraction
        const styleProps = [
          { prop: "color", regex: /color:\s*([^;]+)/i },
          { prop: "fontSize", regex: /font-size:\s*([^;]+)/i },
          { prop: "fontWeight", regex: /font-weight:\s*([^;]+)/i },
          { prop: "fontFamily", regex: /font-family:\s*([^;]+)/i },
          { prop: "lineHeight", regex: /line-height:\s*([^;]+)/i },
          { prop: "textDecoration", regex: /text-decoration:\s*([^;]+)/i },
          { prop: "fontStyle", regex: /font-style:\s*([^;]+)/i },
          { prop: "textAlign", regex: /text-align:\s*([^;]+)/i },
        ];

        // Apply all regex patterns for more thorough style extraction
        styleProps.forEach(({ prop, regex }) => {
          const match = styleText.match(regex);
          if (match) result[prop] = match[1].trim();
        });

        return result;
      }
    } catch (e) {
      console.error("Error parsing HTML:", e);
    }
    return null;
  };

  // Helper function to directly apply text styles to DOM element with debugging
  const applyTextStylesToDom = (
    element: HTMLElement,
    styles: any,
    debugId?: string
  ) => {
    if (!styles || !element) return;

    console.log(`🖌️ Applying styles to ${debugId || element.tagName}:`, styles);

    // Set transition first and force reflow
    element.style.transition = "all 0.3s ease";
    void element.offsetHeight;

    // Apply all styles with !important
    if (styles.color)
      element.style.setProperty("color", styles.color, "important");
    if (styles.fontSize)
      element.style.setProperty("font-size", styles.fontSize, "important");
    if (styles.fontWeight)
      element.style.setProperty("font-weight", styles.fontWeight, "important");
    if (styles.fontFamily)
      element.style.setProperty("font-family", styles.fontFamily, "important");
    if (styles.lineHeight)
      element.style.setProperty("line-height", styles.lineHeight, "important");
    if (styles.textDecoration)
      element.style.setProperty(
        "text-decoration",
        styles.textDecoration,
        "important"
      );
    if (styles.fontStyle)
      element.style.setProperty("font-style", styles.fontStyle, "important");

    // Force reflow again after applying styles
    void element.offsetHeight;

    console.log(`✅ Applied styles to ${debugId || element.tagName}:`, {
      color: element.style.color,
      fontSize: element.style.fontSize,
      fontWeight: element.style.fontWeight,
    });
  };

  // Try multiple strategies to find the element in the DOM
  const findElementInDom = (sourceNode: any, actualSourceId: string) => {
    // Try direct ID match first
    let element = document.querySelector(`[data-node-id="${actualSourceId}"]`);

    // If not found, try responsive ID
    if (!element) {
      element = document.querySelector(
        `[data-responsive-id="${actualSourceId}"]`
      );
    }

    // If not found and we have sharedId and viewportId, try that combo
    if (!element && sourceNode.sharedId && sourceNode.dynamicViewportId) {
      element = document.querySelector(
        `[data-shared-id="${sourceNode.sharedId}"][data-viewport-id="${sourceNode.dynamicViewportId}"]`
      );
    }

    // Try finding by sharedId only as a last resort
    if (!element && sourceNode.sharedId) {
      const possibleElements = document.querySelectorAll(
        `[data-shared-id="${sourceNode.sharedId}"]`
      );

      // Find the element that's in the current viewport
      if (possibleElements.length > 0 && sourceNode.dynamicViewportId) {
        for (const el of possibleElements) {
          const viewportId = el.getAttribute("data-viewport-id");
          if (viewportId === sourceNode.dynamicViewportId) {
            element = el;
            break;
          }
        }

        // If still not found, just use the first one as a fallback
        if (!element && possibleElements.length > 0) {
          element = possibleElements[0];
          console.log(
            `⚠️ Using fallback element with shared ID:`,
            sourceNode.sharedId
          );
        }
      }
    }

    // For debugging - try logging all dynamicNode elements
    if (!element) {
      console.log(
        `🔍 Unable to find element. Dumping all dynamic nodes:`,
        Array.from(document.querySelectorAll(".dynamic-node")).map((el) => ({
          id: el.getAttribute("data-node-id"),
          responsive: el.getAttribute("data-responsive-id"),
          shared: el.getAttribute("data-shared-id"),
          viewport: el.getAttribute("data-viewport-id"),
        }))
      );
    }

    return element;
  };

  // Replace the transformNode function with this improved version
  // The transformNode function with the fix
  const transformNode = useMemo(() => {
    return (sourceId: string, type: string) => {
      console.log(
        `🔍 DEBUG: transformNode called for ${sourceId} with event type ${type}`
      );

      // First, find the node for this ID
      let sourceNode = originalNodes.find((n) => n.id === sourceId);
      if (!sourceNode) {
        console.warn(`Source node ${sourceId} not found`);
        return;
      }

      // Get the actual source node (handle child trigger case)
      let actualSourceId = sourceId;
      let actualSourceNode = sourceNode;

      // Around line 287 in your preview-context.tsx where you handle child triggers
      if (sourceNode.dynamicParentId) {
        console.log(
          `This is a child trigger. Parent ID: ${sourceNode.dynamicParentId}`
        );

        // First get the direct parent node
        const parentNode = originalNodes.find(
          (n) => n.id === sourceNode.dynamicParentId
        );

        if (parentNode) {
          // OLD: actualSourceId = parentNode.id;
          // NEW: Find the viewport-specific version of the parent

          // If we have viewport information, find the parent for this specific viewport
          if (sourceNode.dynamicViewportId && parentNode.sharedId) {
            // Try to find the viewport-specific version of the parent
            const viewportParentNode = originalNodes.find(
              (n) =>
                n.sharedId === parentNode.sharedId &&
                n.dynamicViewportId === sourceNode.dynamicViewportId
            );

            if (viewportParentNode) {
              console.log(
                `📱 Using viewport-specific parent:`,
                viewportParentNode.id
              );
              actualSourceId = viewportParentNode.id;
              actualSourceNode = viewportParentNode;
            } else {
              // Fall back to the original parent if no viewport-specific one is found
              actualSourceId = parentNode.id;
              actualSourceNode = parentNode;
            }
          } else {
            // No viewport info, use the original parent
            actualSourceId = parentNode.id;
            actualSourceNode = parentNode;
          }
        }
      }

      // Initialize or update text content cache for this node
      if (!textContentCache.current[actualSourceId]) {
        textContentCache.current[actualSourceId] = {};
      }

      // Find the connection
      let connections = [];
      const existingVariant = dynamicVariants[actualSourceId];

      if (existingVariant) {
        console.log(`Source has active variant:`, existingVariant);
        const targetId =
          existingVariant.targetId || existingVariant._originalTargetId;
        if (targetId) {
          const targetNode = originalNodes.find((n) => n.id === targetId);
          if (targetNode && targetNode.dynamicConnections) {
            connections = targetNode.dynamicConnections.filter(
              (c) => c.type === type
            );
          }

          // Check if we're going back to the base state (connection from variant to base)
          if (connections.length > 0) {
            const connection = connections[0];
            const isRevertingToBase = connection.targetId === actualSourceId;

            if (isRevertingToBase) {
              console.log(`🔄 Animating back to base state from variant`);

              // Instead of immediately removing the variant, find the base node and apply its styles
              // as a new "variant" to allow for animation
              const baseNode = originalNodes.find(
                (n) => n.id === actualSourceId
              );

              if (baseNode) {
                // Apply DOM changes for text nodes FIRST - before state update for immediate feedback
                try {
                  const element = findElementInDom(sourceNode, actualSourceId);
                  if (element) {
                    // Find and revert all text nodes
                    const textElements = element.querySelectorAll(
                      '[data-child-type="text"]'
                    );

                    textElements.forEach((textEl) => {
                      const sharedId = textEl.getAttribute("data-shared-id");
                      if (!sharedId) return;

                      const span = textEl.querySelector("span");
                      if (!span) return;

                      // Find the original base text node
                      const baseTextNodes = originalNodes.filter(
                        (node) =>
                          node.sharedId === sharedId &&
                          node.type === "text" &&
                          !node.isVariant
                      );

                      if (baseTextNodes.length > 0) {
                        const baseTextNode = baseTextNodes[0];

                        if (baseTextNode?.style?.text) {
                          console.log(
                            `🔙 Preparing text revert for ${sharedId}`
                          );

                          // **** CRITICAL FIX: DO NOT update the HTML content ****
                          // Instead, only extract and apply styles

                          // First, set the transition property before any other changes
                          span.style.transition = "all 0.3s ease";

                          // Extract and apply styles directly
                          const styles = extractStylesFromHTML(
                            baseTextNode.style.text
                          );
                          if (styles) {
                            // Apply each style with !important
                            if (styles.color)
                              span.style.setProperty(
                                "color",
                                styles.color,
                                "important"
                              );
                            if (styles.fontSize)
                              span.style.setProperty(
                                "font-size",
                                styles.fontSize,
                                "important"
                              );
                            if (styles.fontWeight)
                              span.style.setProperty(
                                "font-weight",
                                styles.fontWeight,
                                "important"
                              );
                            if (styles.fontFamily)
                              span.style.setProperty(
                                "font-family",
                                styles.fontFamily,
                                "important"
                              );
                            if (styles.lineHeight)
                              span.style.setProperty(
                                "line-height",
                                styles.lineHeight,
                                "important"
                              );
                            if (styles.textDecoration)
                              span.style.setProperty(
                                "text-decoration",
                                styles.textDecoration,
                                "important"
                              );
                            if (styles.fontStyle)
                              span.style.setProperty(
                                "font-style",
                                styles.fontStyle,
                                "important"
                              );

                            // Force reflow to ensure styles apply immediately
                            void span.offsetHeight;
                          }
                        }
                      }
                    });

                    // Also handle the main text node if it's a text node itself
                    if (baseNode.type === "text") {
                      const mainSpan = element.querySelector(
                        ".dynamic-node-main-content span"
                      );
                      if (mainSpan && baseNode.style?.text) {
                        // Set transition first
                        mainSpan.style.transition = "all 0.3s ease";

                        // Extract and apply styles
                        const styles = extractStylesFromHTML(
                          baseNode.style.text
                        );
                        if (styles) {
                          if (styles.color)
                            mainSpan.style.setProperty(
                              "color",
                              styles.color,
                              "important"
                            );
                          if (styles.fontSize)
                            mainSpan.style.setProperty(
                              "font-size",
                              styles.fontSize,
                              "important"
                            );
                          if (styles.fontWeight)
                            mainSpan.style.setProperty(
                              "font-weight",
                              styles.fontWeight,
                              "important"
                            );
                          // Apply other styles as needed
                        }

                        // Force reflow
                        void mainSpan.offsetHeight;
                      }
                    }
                  }
                } catch (error) {
                  console.error("Error updating text styles:", error);
                }

                // Create a pseudo-variant that represents the base state
                const baseStateVariant = {
                  ...baseNode,
                  _originalTargetId: actualSourceId,
                  targetId: actualSourceId,
                  id: actualSourceId,
                  _isBaseState: true, // Mark this as a special base state variant
                };

                // Update the style.text property of any text nodes in the variant so React doesn't replace the content
                const processedVariant = { ...baseStateVariant };

                // First, handle if the node itself is a text node
                if (
                  processedVariant.type === "text" &&
                  processedVariant.style?.text
                ) {
                  // Store the original text in our cache if not already stored
                  const mainNodeId = actualSourceId;
                  if (!textContentCache.current[mainNodeId][mainNodeId]) {
                    textContentCache.current[mainNodeId][mainNodeId] =
                      extractTextContent(processedVariant.style.text);
                  }
                }

                // Update the variant to switch to the base state with animation
                setDynamicVariants((prev) => {
                  const newVariants = { ...prev };
                  newVariants[actualSourceId] = processedVariant;

                  // Schedule removal of this entry after animation completes
                  setTimeout(() => {
                    setDynamicVariants((current) => {
                      const updated = { ...current };
                      // Only remove if it's still our base state variant
                      if (
                        updated[actualSourceId] &&
                        updated[actualSourceId]._isBaseState
                      ) {
                        delete updated[actualSourceId];
                      }
                      return updated;
                    });
                  }, 350); // Slightly longer than transition duration

                  return newVariants;
                });

                console.log(`✅ Animation to base state initiated`);
                return; // Exit early since we're handling a revert
              }
            }
          }
        }
      } else if (sourceNode.dynamicConnections) {
        console.log(`Source has direct connections`);
        connections = sourceNode.dynamicConnections.filter(
          (c) => c.type === type
        );
      }

      if (connections.length === 0 && sourceNode.dynamicConnections) {
        console.log(`Using fallback connections from source node`);
        connections = sourceNode.dynamicConnections.filter(
          (c) => c.type === type
        );
      }

      if (connections.length === 0) {
        console.log(`❌ No connections found for event type ${type}`);
        return;
      }

      const connection = connections[0];
      console.log(
        `✅ Using connection: ${connection.sourceId || actualSourceId} -> ${
          connection.targetId
        }`
      );

      const targetNode = originalNodes.find(
        (n) => n.id === connection.targetId
      );
      if (!targetNode) {
        console.warn(`❌ Target node ${connection.targetId} not found`);
        return;
      }

      console.log(`Target Node Info:`, {
        id: targetNode.id,
        type: targetNode.type,
        isVariant: targetNode.isVariant,
        backgroundColor: targetNode.style.backgroundColor,
      });

      // Find the appropriate target node for the current viewport
      let viewportTargetNode = targetNode;

      // If we're not in the desktop viewport, try to find the responsive variant
      if (sourceNode.dynamicViewportId) {
        // Get the current viewport ID
        const currentViewportId = sourceNode.dynamicViewportId;

        // Find target's responsive counterpart that matches this viewport
        if (targetNode.sharedId) {
          const responsiveTargets = originalNodes.filter(
            (n) =>
              n.sharedId === targetNode.sharedId &&
              n.dynamicViewportId === currentViewportId
          );

          if (responsiveTargets.length > 0) {
            viewportTargetNode = responsiveTargets[0];
            console.log(
              `📱 Using viewport-specific target:`,
              viewportTargetNode.id
            );
          }
        }
      }

      // Create enhanced variant using the viewport-specific target
      const enhancedVariant = {
        ...viewportTargetNode,
        _originalTargetId: connection.targetId,
        targetId: connection.targetId,
        id: actualSourceId,
        _viewportId: sourceNode.dynamicViewportId, // Add this to track the viewport
      };

      // **** CRITICAL FIX: Process the enhancedVariant to preserve text content ****
      const processedVariant = { ...enhancedVariant };

      // First, handle if the node itself is a text node
      if (processedVariant.type === "text" && processedVariant.style?.text) {
        // Store the original text in our cache if not already stored
        const mainNodeId = actualSourceId;
        if (!textContentCache.current[mainNodeId][mainNodeId]) {
          textContentCache.current[mainNodeId][mainNodeId] = extractTextContent(
            processedVariant.style.text
          );
        }
      }

      console.log(`💡 Enhanced Variant:`, {
        id: processedVariant.id,
        targetId: processedVariant.targetId,
        backgroundColor: processedVariant.style.backgroundColor,
        viewportId: processedVariant._viewportId,
      });

      // Apply DOM changes for text nodes FIRST - before state update for immediate feedback
      try {
        const element = findElementInDom(sourceNode, actualSourceId);
        if (element) {
          // Find all text nodes and update their styles directly
          const textElements = element.querySelectorAll(
            '[data-child-type="text"]'
          );

          textElements.forEach((textEl) => {
            const sharedId = textEl.getAttribute("data-shared-id");
            if (!sharedId) return;

            const span = textEl.querySelector("span");
            if (!span) return;

            // Find text nodes in the variant target that match the current viewport
            const variantTextNodes = originalNodes.filter(
              (node) =>
                node.sharedId === sharedId &&
                node.type === "text" &&
                (node.parentId === viewportTargetNode.id ||
                  node.variantParentId === viewportTargetNode.id)
            );

            if (variantTextNodes.length > 0) {
              const variantTextNode = variantTextNodes[0];

              if (variantTextNode?.style?.text) {
                console.log(`⚡ Directly updating text styles for ${sharedId}`);

                // Store the original text content in our cache if not already stored
                if (!textContentCache.current[actualSourceId][sharedId]) {
                  textContentCache.current[actualSourceId][sharedId] =
                    span.textContent || "";
                }

                // **** CRITICAL FIX: Set transition FIRST ****
                span.style.transition = "all 0.3s ease";

                // Extract and apply styles immediately WITHOUT changing content
                const styles = extractStylesFromHTML(
                  variantTextNode.style.text
                );
                if (styles) {
                  // Apply each style with !important to ensure it overrides
                  if (styles.color)
                    span.style.setProperty("color", styles.color, "important");
                  if (styles.fontSize)
                    span.style.setProperty(
                      "font-size",
                      styles.fontSize,
                      "important"
                    );
                  if (styles.fontWeight)
                    span.style.setProperty(
                      "font-weight",
                      styles.fontWeight,
                      "important"
                    );
                  if (styles.fontFamily)
                    span.style.setProperty(
                      "font-family",
                      styles.fontFamily,
                      "important"
                    );
                  if (styles.lineHeight)
                    span.style.setProperty(
                      "line-height",
                      styles.lineHeight,
                      "important"
                    );
                  if (styles.textDecoration)
                    span.style.setProperty(
                      "text-decoration",
                      styles.textDecoration,
                      "important"
                    );
                  if (styles.fontStyle)
                    span.style.setProperty(
                      "font-style",
                      styles.fontStyle,
                      "important"
                    );

                  // Force a reflow to ensure styles are applied immediately
                  void span.offsetHeight;
                }
              }
            }
          });

          // Also handle the main text node if it's a text node itself
          if (viewportTargetNode.type === "text") {
            const mainSpan = element.querySelector(
              ".dynamic-node-main-content span"
            );
            if (mainSpan && viewportTargetNode.style?.text) {
              // Store the original text content
              const mainNodeId = actualSourceId;
              if (!textContentCache.current[mainNodeId][mainNodeId]) {
                textContentCache.current[mainNodeId][mainNodeId] =
                  mainSpan.textContent || "";
              }

              // Set transition first
              mainSpan.style.transition = "all 0.3s ease";

              // Extract and apply styles
              const styles = extractStylesFromHTML(
                viewportTargetNode.style.text
              );
              if (styles) {
                if (styles.color)
                  mainSpan.style.setProperty(
                    "color",
                    styles.color,
                    "important"
                  );
                if (styles.fontSize)
                  mainSpan.style.setProperty(
                    "font-size",
                    styles.fontSize,
                    "important"
                  );
                if (styles.fontWeight)
                  mainSpan.style.setProperty(
                    "font-weight",
                    styles.fontWeight,
                    "important"
                  );
                // Apply other styles as needed
              }

              // Force reflow
              void mainSpan.offsetHeight;
            }
          }

          // Apply background color directly for immediate visual feedback
          if (viewportTargetNode.style.backgroundColor) {
            element.style.backgroundColor =
              viewportTargetNode.style.backgroundColor;
            console.log(
              `🎨 Setting viewport-specific backgroundColor:`,
              viewportTargetNode.style.backgroundColor
            );
          }
        } else {
          console.log(`❌ Element not found in DOM:`, actualSourceId);
        }
      } catch (error) {
        console.error("Error updating text content:", error);
      }

      // Now update the variant state
      setDynamicVariants((prev) => {
        const newVariants = { ...prev };
        newVariants[actualSourceId] = processedVariant;

        // Debug state update
        console.log(`📊 Updated dynamicVariants state:`, {
          [actualSourceId]: {
            id: processedVariant.id,
            targetId: processedVariant.targetId,
            backgroundColor: processedVariant.style.backgroundColor,
            viewportId: processedVariant._viewportId,
          },
        });

        return newVariants;
      });

      console.log(`✅ Transform complete`);
    };
  }, [originalNodes, dynamicVariants, setDynamicVariants]);

  const contextValue = useMemo(
    () => ({
      originalNodes,
      currentViewport,
      viewportBreakpoints,
      initialNodeTree,
      nodeTree,
      dynamicVariants,
      transformNode,
      setDynamicVariants,
    }),
    [
      originalNodes,
      currentViewport,
      viewportBreakpoints,
      initialNodeTree,
      nodeTree,
      dynamicVariants,
      transformNode,
      setDynamicVariants,
    ]
  );

  return (
    <PreviewContext.Provider value={contextValue}>
      {children}
    </PreviewContext.Provider>
  );
};

export const usePreview = () => useContext(PreviewContext);
