import React, { useEffect, useState, useRef } from "react";
import { NodeId } from "@/builder/context/atoms/node-store";

/**
 * Hook to accurately track element dimensions in real-time
 * Uses ResizeObserver and getBoundingClientRect for precise measurements
 */
export function useElementSize(ids: NodeId[]) {
  // State to track exact width and height with decimals
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Ref to track the observer
  const observerRef = useRef<ResizeObserver | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Early return if no ids
    if (!ids.length) return;

    const primaryId = ids[0];

    // Function to get the precise dimensions
    const updateSize = () => {
      const element = document.querySelector(
        `[data-node-id="${primaryId}"]`
      ) as HTMLElement;
      if (!element) return;

      // Get precise dimensions from getBoundingClientRect
      const rect = element.getBoundingClientRect();

      // Check if a style attribute with width/height exists
      const elementStyle = element.getAttribute("style");
      let styleWidth = null;
      let styleHeight = null;

      if (elementStyle) {
        // Extract width and height from inline style if they exist
        const widthMatch = elementStyle.match(/width:\s*([\d.]+)px/);
        const heightMatch = elementStyle.match(/height:\s*([\d.]+)px/);

        if (widthMatch && widthMatch[1]) {
          styleWidth = parseFloat(widthMatch[1]);
        }

        if (heightMatch && heightMatch[1]) {
          styleHeight = parseFloat(heightMatch[1]);
        }
      }

      // Use the most precise measurement available
      // Prioritize inline style values if they exist, as they're the "source of truth"
      const width = styleWidth !== null ? styleWidth : Math.round(rect.width);
      const height =
        styleHeight !== null ? styleHeight : Math.round(rect.height);

      // Only update if values changed
      setSize((prev) => {
        if (prev.width !== width || prev.height !== height) {
          return { width, height };
        }
        return prev;
      });
    };

    // Run initial update
    updateSize();

    // Create and setup ResizeObserver
    const observer = new ResizeObserver(() => {
      // Cancel any existing animation frame
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Schedule update in next animation frame for performance
      rafIdRef.current = requestAnimationFrame(updateSize);
    });

    // Start observing the element
    const element = document.querySelector(
      `[data-node-id="${primaryId}"]`
    ) as HTMLElement;
    if (element) {
      observer.observe(element);
    }

    // Store observer reference
    observerRef.current = observer;

    // Cleanup function
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [ids]);

  return size;
}
