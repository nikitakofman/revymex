// src/builder/components/preview/IframePreview.tsx
import React, { useRef, useEffect, useState } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { usePreview } from "./preview-context";

interface IframePreviewProps {
  nodes: Node[];
  viewport: number;
}

const IframePreview: React.FC<IframePreviewProps> = ({ nodes, viewport }) => {
  const { interfaceState, interfaceDisp } = useBuilder();
  // Get dynamic variant state from preview context
  const { dynamicVariants, originalNodes, transformNode } = usePreview();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSide, setDragSide] = useState<"left" | "right" | null>(null);

  // Collect all viewport widths from the current node tree
  const getViewportWidths = (): number[] => {
    return originalNodes
      .filter((node) => node.isViewport)
      .map((node) => node.viewportWidth || 0);
  };

  // Function to adjust width to avoid exact breakpoints
  const getAdjustedWidth = (width: number): number => {
    const viewportWidths = getViewportWidths();

    // If width exactly matches any viewport width, adjust it slightly
    if (viewportWidths.includes(width)) {
      return width - 10;
    }
    return width;
  };

  // Use the width from interfaceState if available, otherwise use viewport - 10 for safety
  const [previewWidth, setPreviewWidth] = useState(
    getAdjustedWidth(interfaceState.previewWidth || viewport || 1440)
  );

  // Use refs to maintain current drag state without stale closures
  const isDraggingRef = useRef(false);
  const dragSideRef = useRef<"left" | "right" | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Keep track of the previous variant state to detect changes
  const previousDynamicVariantsRef = useRef(dynamicVariants);

  // Listen for changes to previewWidth in the interfaceState
  useEffect(() => {
    if (
      interfaceState.previewWidth &&
      interfaceState.previewWidth !== previewWidth
    ) {
      // Always adjust the width to avoid exact viewport breakpoints
      const adjustedWidth = getAdjustedWidth(interfaceState.previewWidth);
      setPreviewWidth(adjustedWidth);
    }
  }, [interfaceState.previewWidth, previewWidth, originalNodes]);

  useEffect(() => {
    // Listen for the "PREVIEW_READY" message from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "PREVIEW_READY") {
        console.log("Iframe is ready to receive data");
        setIsIframeReady(true);
      } else if (event.data.type === "NODE_EVENT_TRIGGERED") {
        // Handle events triggered from within the iframe
        const { nodeId, eventType } = event.data;
        console.log(`Event ${eventType} on node ${nodeId} triggered in iframe`);
        if (transformNode) {
          transformNode(nodeId, eventType);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [transformNode]);

  // Function to collect all text elements, including nested ones
  const collectAllTextElements = () => {
    const allTextIds = new Set<string>();

    const traverseNode = (node: Node) => {
      if (node.type === "text") {
        allTextIds.add(node.id);
      }

      // Find children of this node
      const children = originalNodes.filter((n) => n.parentId === node.id);
      children.forEach(traverseNode);
    };

    // Start with top-level nodes (including viewport nodes)
    const viewportIds = originalNodes
      .filter((node) => node.isViewport)
      .map((node) => node.id);

    originalNodes
      .filter((n) => !n.parentId || viewportIds.includes(n.parentId))
      .forEach(traverseNode);

    return Array.from(allTextIds);
  };

  // Function to prepare text styles for each text node for more reliable transitions
  const prepareTextStyles = () => {
    const allTextStyles: Record<string, Record<string, any>> = {};

    // Process all text nodes to extract their styles
    originalNodes.forEach((node) => {
      if (node.type === "text" && node.style?.text) {
        try {
          // Extract styles from the HTML text content
          const parser = new DOMParser();
          const doc = parser.parseFromString(node.style.text, "text/html");
          const span = doc.querySelector("span");

          if (span && span.getAttribute("style")) {
            const styleText = span.getAttribute("style");
            const styles: Record<string, string> = {};

            // Extract common text styles
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

            styleProps.forEach(({ prop, regex }) => {
              const match = styleText.match(regex);
              if (match) styles[prop] = match[1].trim();
            });

            // Store styles for this node
            allTextStyles[node.id] = styles;
          }
        } catch (error) {
          console.error("Error extracting text styles:", error);
        }
      }
    });

    return allTextStyles;
  };

  // Whenever dynamic variants change, send updated state to iframe
  useEffect(() => {
    // Check if the variants have actually changed
    const hasVariantsChanged =
      JSON.stringify(previousDynamicVariantsRef.current) !==
      JSON.stringify(dynamicVariants);

    if (
      isIframeReady &&
      iframeRef.current?.contentWindow &&
      hasVariantsChanged
    ) {
      console.log("Sending updated dynamic variants to iframe");

      // Extract text styles for all nodes to enhance text transitions
      const textStyles = prepareTextStyles();

      // Collect all text element IDs, including nested ones
      const allTextIds = collectAllTextElements();

      // Send the regular variant update
      iframeRef.current.contentWindow.postMessage(
        {
          type: "DYNAMIC_VARIANTS_UPDATE",
          dynamicVariants,
          textStyles,
          transitionConfig: {
            duration: 350,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          },
        },
        "*"
      );

      // Send a special message for deep text updates
      iframeRef.current.contentWindow.postMessage(
        {
          type: "DEEP_TEXT_UPDATE",
          nodeIds: Object.keys(dynamicVariants),
          allTextIds: allTextIds,
          textStyles,
          transitionConfig: {
            duration: 350,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          },
        },
        "*"
      );

      // Update ref to track changes
      previousDynamicVariantsRef.current = dynamicVariants;
    }
  }, [isIframeReady, dynamicVariants, originalNodes]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const rawWidth = Math.min(viewport, containerWidth - 100);

        // Always adjust the width to avoid exact viewport breakpoints
        const adjustedWidth = getAdjustedWidth(rawWidth);

        setPreviewWidth(adjustedWidth);
        interfaceDisp.setPreviewWidth(adjustedWidth);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewport, interfaceDisp, originalNodes]);

  // Send data to the iframe when it's ready and when data changes
  useEffect(() => {
    if (isIframeReady && iframeRef.current?.contentWindow) {
      console.log("Sending initial data to iframe");

      // Extract text styles for all nodes to enhance text transitions
      const textStyles = prepareTextStyles();

      // Collect all text element IDs, including nested ones
      const allTextIds = collectAllTextElements();

      // Make sure we're always using an adjusted viewport width
      const adjustedViewport = getAdjustedWidth(previewWidth);

      // Send the initial data
      iframeRef.current.contentWindow.postMessage(
        {
          type: "PREVIEW_DATA",
          nodes,
          viewport: adjustedViewport, // Use adjusted width
          dynamicVariants,
          textStyles,
          transitionConfig: {
            duration: 350,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          },
        },
        "*"
      );

      // Also send a deep text update message for initial setup
      iframeRef.current.contentWindow.postMessage(
        {
          type: "DEEP_TEXT_UPDATE",
          nodeIds: Object.keys(dynamicVariants),
          allTextIds: allTextIds,
          textStyles,
          transitionConfig: {
            duration: 350,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          },
        },
        "*"
      );
    }
  }, [isIframeReady, nodes, previewWidth, dynamicVariants, originalNodes]);

  // Forward events from parent to iframe
  const forwardEventToIframe = (nodeId: string, eventType: string) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "NODE_EVENT",
          nodeId,
          eventType,
        },
        "*"
      );
    }
  };

  // Handle mousedown on resize handles
  const handleMouseDown = (e: React.MouseEvent, side: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();

    startXRef.current = e.clientX;
    startWidthRef.current = previewWidth;
    dragSideRef.current = side;
    isDraggingRef.current = true;
    setIsDragging(true);
    setDragSide(side);

    // Add the events to document to ensure drag continues even when mouse leaves handle
    document.addEventListener("mousemove", handleMouseMove, { capture: true });
    document.addEventListener("mouseup", handleMouseUp, { capture: true });

    // Disable text selection during drag
    document.body.style.userSelect = "none";
  };

  // Handle mousemove during drag
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    // Ensure the drag continues regardless of where the mouse is
    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.clientX - startXRef.current;
    const containerWidth =
      containerRef.current?.clientWidth || window.innerWidth;

    let newWidth: number;
    if (dragSideRef.current === "right") {
      newWidth = Math.min(
        Math.max(320, startWidthRef.current + deltaX * 2),
        containerWidth - 100
      );
    } else {
      newWidth = Math.min(
        Math.max(320, startWidthRef.current - deltaX * 2),
        containerWidth - 100
      );
    }

    // Adjust width to avoid exact breakpoints
    const adjustedWidth = getAdjustedWidth(newWidth);

    setPreviewWidth(adjustedWidth);
    // Store the current width in the global state
    interfaceDisp.setPreviewWidth(adjustedWidth);
  };

  // Handle mouseup to end drag
  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragSideRef.current = null;
    setIsDragging(false);
    setDragSide(null);

    document.removeEventListener("mousemove", handleMouseMove, {
      capture: true,
    });
    document.removeEventListener("mouseup", handleMouseUp, { capture: true });

    // Re-enable text selection
    document.body.style.userSelect = "";
  };

  // Calculate left/right margin for centering the preview
  const margin = containerRef.current
    ? (containerRef.current.clientWidth - previewWidth) / 2
    : 0;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100vh",
        backgroundColor: "var(--bg-canvas)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Main iframe container */}
      <div
        style={{
          width: `${previewWidth}px`,
          height: "100%",
          margin: "0 auto",
          overflow: "hidden",
          backgroundColor: "#fff",
          position: "relative",
        }}
      >
        <iframe
          ref={iframeRef}
          src="/preview"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            // Disable pointer events on the iframe during drag to keep the drag active
            pointerEvents: isDragging ? "none" : "auto",
          }}
          title="Preview"
        />
      </div>

      {/* Width display during dragging */}
      {isDragging && (
        <div
          style={{
            position: "fixed",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "2px 8px",
            background: "#333",
            color: "#fff",
            borderRadius: "4px",
            fontSize: "14px",
            zIndex: 1000,
          }}
        >
          {Math.round(previewWidth)}px
        </div>
      )}

      {/* Left handle - with extended hit area */}
      <div
        style={{
          position: "absolute",
          top: "0",
          left: margin - 37,
          width: "24px", // Wider hit area
          height: "100%", // Full height for easier grabbing
          cursor: "ew-resize",
          zIndex: 100,
        }}
        onMouseDown={(e) => handleMouseDown(e, "left")}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "10px", // Center the visible handle in the hit area
            transform: "translateY(-50%)",
            width: "6px",
            height: "40px",
            backgroundColor:
              isDragging && dragSide === "left" ? "#2563eb" : "#666",
            borderRadius: "9px",
          }}
        />
      </div>

      {/* Right handle - with extended hit area */}
      <div
        style={{
          position: "absolute",
          top: "0",
          right: margin - 37,
          width: "24px", // Wider hit area
          height: "100%", // Full height for easier grabbing
          cursor: "ew-resize",
          zIndex: 100,
        }}
        onMouseDown={(e) => handleMouseDown(e, "right")}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "10px", // Center the visible handle in the hit area
            transform: "translateY(-50%)",
            width: "6px",
            height: "40px",
            backgroundColor:
              isDragging && dragSide === "right" ? "#2563eb" : "#666",
            borderRadius: "9px",
          }}
        />
      </div>
    </div>
  );
};

export default IframePreview;
