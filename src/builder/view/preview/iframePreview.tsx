// src/builder/components/preview/IframePreview.tsx
import React, { useRef, useEffect, useState } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";

interface IframePreviewProps {
  nodes: Node[];
  viewport: number;
}

const IframePreview: React.FC<IframePreviewProps> = ({ nodes, viewport }) => {
  const { interfaceState, interfaceDisp } = useBuilder();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSide, setDragSide] = useState<"left" | "right" | null>(null);

  // Use the width from interfaceState if available, otherwise use viewport
  const [previewWidth, setPreviewWidth] = useState(
    interfaceState.previewWidth || viewport || 1440
  );

  // Use refs to maintain current drag state without stale closures
  const isDraggingRef = useRef(false);
  const dragSideRef = useRef<"left" | "right" | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Listen for changes to previewWidth in the interfaceState
  useEffect(() => {
    if (
      interfaceState.previewWidth &&
      interfaceState.previewWidth !== previewWidth
    ) {
      setPreviewWidth(interfaceState.previewWidth);
    }
  }, [interfaceState.previewWidth]);

  useEffect(() => {
    // Listen for the "PREVIEW_READY" message from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "PREVIEW_READY") {
        setIsIframeReady(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const newWidth = Math.min(viewport, containerWidth - 100);
        setPreviewWidth(newWidth);
        interfaceDisp.setPreviewWidth(newWidth);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewport, interfaceDisp]);

  // Send data to the iframe when it's ready and when data changes
  useEffect(() => {
    if (isIframeReady && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "PREVIEW_DATA",
          nodes,
          viewport: previewWidth,
        },
        "*"
      );
    }
  }, [isIframeReady, nodes, previewWidth]);

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

    setPreviewWidth(newWidth);
    // Store the current width in the global state
    interfaceDisp.setPreviewWidth(newWidth);
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
