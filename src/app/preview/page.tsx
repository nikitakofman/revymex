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

  // Once previewData is set, extract fonts and inject the Google Fonts link
  useEffect(() => {
    if (previewData && previewData.nodes) {
      const uniqueFonts = new Set<string>();

      previewData.nodes.forEach((node) => {
        if (node.type === "text") {
          // First, check if fontFamily is defined directly in style
          if (node.style?.fontFamily) {
            uniqueFonts.add(node.style.fontFamily);
          } else if (node.style?.text) {
            // If not, try to extract font-family from the HTML string using a regex
            const match = node.style.text.match(/font-family:\s*([^;"]+)/i);
            if (match) {
              uniqueFonts.add(match[1].trim());
            }
          }
        }
      });

      if (uniqueFonts.size > 0) {
        const familiesQuery = Array.from(uniqueFonts)
          .map(
            (font) => `family=${font.replace(/\s+/g, "+")}:wght@400;500;600;700`
          )
          .join("&");

        const linkHref = `https://fonts.googleapis.com/css2?${familiesQuery}&display=swap`;

        // Check if the link is already in the document head
        if (!document.querySelector(`link[href*="${familiesQuery}"]`)) {
          const link = document.createElement("link");
          link.href = linkHref;
          link.rel = "stylesheet";
          document.head.appendChild(link);
          console.log("Injected Google Fonts:", linkHref);
        }
      }
    }
  }, [previewData]);

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

    // Notify the parent that the preview is ready
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
