import { useEffect, useRef } from "react";
import {
  useDropInfo,
  useIsDragging,
  useGetDragBackToParentInfo,
} from "@/builder/context/atoms/drag-store";

// CSS styles for drop target
const dropTargetStyles = `
.dropTarget {
  background: repeating-linear-gradient(
    -45deg,
    #444cf7,
    #444cf745 5px,
    #b0b0b445 5px,
    #d7d7d845 25px
  );
  position: relative;
  z-index: 
  box-shadow: 0 0 0 4px #444cf7;
  pointer-events: none;
}
`;

export const DropTargetHighlighter = () => {
  const dropInfo = useDropInfo(); // Use the reactive hook
  const isDragging = useIsDragging();
  const getDragBackToParentInfo = useGetDragBackToParentInfo(); // NEW: Add drag back to parent info
  const prevTargetId = useRef<string | null>(null);

  // Add style to document once on mount
  useEffect(() => {
    const styleId = "drop-target-styles";
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement("style");
      styleElement.id = styleId;
      styleElement.textContent = dropTargetStyles;
      document.head.appendChild(styleElement);

      return () => {
        const element = document.getElementById(styleId);
        if (element) {
          document.head.removeChild(element);
        }
      };
    }
  }, []);

  // Update drop target class when dropInfo changes
  useEffect(() => {
    // Clear previous target if it exists
    if (prevTargetId.current) {
      const prevElement = document.querySelector(
        `[data-node-id="${prevTargetId.current}"]`
      );
      if (prevElement) {
        prevElement.classList.remove("dropTarget");
      }
    }

    // NEW: Check if we're dragging back to parent
    const isDraggingBackToParent =
      getDragBackToParentInfo().isDraggingBackToParent;

    // Only add drop target styling if position is "inside" AND not dragging back to parent
    const shouldHighlight =
      isDragging &&
      dropInfo &&
      dropInfo.targetId &&
      dropInfo.position === "inside" &&
      !isDraggingBackToParent; // NEW: Added this condition

    // Add class to new target if exists, we're dragging, and position is "inside"
    if (shouldHighlight) {
      const targetElement = document.querySelector(
        `[data-node-id="${dropInfo.targetId}"]`
      );
      if (targetElement) {
        targetElement.classList.add("dropTarget");
        prevTargetId.current = dropInfo.targetId;
      } else {
        prevTargetId.current = null;
      }
    } else {
      // No highlighting needed, clear previous target
      prevTargetId.current = null;
    }

    // Clean up on unmount or when dependencies change
    return () => {
      if (prevTargetId.current) {
        const prevElement = document.querySelector(
          `[data-node-id="${prevTargetId.current}"]`
        );
        if (prevElement) {
          prevElement.classList.remove("dropTarget");
        }
        prevTargetId.current = null;
      }
    };
  }, [dropInfo, isDragging, getDragBackToParentInfo]); // NEW: Added getDragBackToParentInfo to dependencies

  // This component doesn't render anything
  return null;
};
