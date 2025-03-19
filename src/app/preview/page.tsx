"use client";

import { useEffect, useState } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import LoadingScreen from "@/builder/view/canvas/loading-screen";
import PreviewPlay from "@/builder/view/preview/preview-play";

export default function PreviewPage() {
  const [previewData, setPreviewData] = useState<{
    nodes: Node[];
    viewport: number;
  } | null>(null);

  useEffect(() => {
    // Listen for messages from the parent window
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "PREVIEW_DATA") {
        setPreviewData({
          nodes: event.data.nodes,
          viewport: event.data.viewport,
        });
      }
    };

    window.addEventListener("message", handleMessage);

    // Send a ready message to the parent
    window.parent.postMessage({ type: "PREVIEW_READY" }, "*");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  if (!previewData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingScreen isLoading={true} />
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <PreviewPlay nodes={previewData.nodes} />
    </div>
  );
}
