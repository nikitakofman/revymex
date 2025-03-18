import { useState, useEffect, useMemo } from "react";
import { Node } from "../types";

export const useViewport = (nodes: Node[]) => {
  const [currentViewport, setCurrentViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setCurrentViewport(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const viewportBreakpoints = useMemo(
    () =>
      nodes
        .filter((node) => node.isViewport)
        .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0))
        .map((viewport) => ({
          id: viewport.id,
          width: viewport.viewportWidth || 0,
          name: viewport.viewportName || "",
        })),
    [nodes]
  );

  return {
    currentViewport,
    viewportBreakpoints,
  };
};
