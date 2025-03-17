// src/builder/components/preview/IframePreview.tsx
import React, { useRef, useEffect, useState } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";

interface IframePreviewProps {
  nodes: Node[];
  viewport: number;
}

const IframePreview: React.FC<IframePreviewProps> = ({ nodes, viewport }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);

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

  // Send data to the iframe when it's ready and when data changes
  useEffect(() => {
    if (isIframeReady && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "PREVIEW_DATA",
          nodes,
          viewport,
        },
        "*"
      );
    }
  }, [isIframeReady, nodes, viewport]);

  return (
    <iframe
      ref={iframeRef}
      src="/preview"
      className="w-full h-full border-0"
      title="Design Preview"
    />
  );
};

export default IframePreview;
