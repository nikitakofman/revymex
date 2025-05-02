// Create a new file: src/builder/context/dnd/MouseHandlers.tsx
import React, { useEffect, useRef } from "react";
import { useMouseMove } from "./useMouseMove";
import { useMouseUp } from "./useMouseUp";
import { useImageDrop } from "@/builder/context/hooks/useImageDrop";
import { useBuilderRefs } from "@/builder/context/builderState";
import { useIsPreviewOpen } from "@/builder/context/atoms/interface-store";

const MouseHandlers: React.FC = () => {
  const eventHandlersAttached = useRef(false);
  const { containerRef } = useBuilderRefs();

  // Get the handlers but don't cause re-renders when they change
  const handleMouseMove = useMouseMove();
  const handleMouseUp = useMouseUp();
  const isPreviewOpen = useIsPreviewOpen();

  // Use our extracted image drop hook
  const { handleDragOver, handleDrop } = useImageDrop({
    containerRef,
  });

  // Function to attach event listeners
  const attachEventListeners = () => {
    if (!eventHandlersAttached.current) {
      console.log("Attaching global mouse event listeners");
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      // Add drag over/drop handlers to container if it exists
      if (containerRef.current) {
        containerRef.current.addEventListener("dragover", handleDragOver);
        containerRef.current.addEventListener("drop", handleDrop);
      }

      eventHandlersAttached.current = true;
    }
  };

  // Function to detach event listeners
  const detachEventListeners = () => {
    if (eventHandlersAttached.current) {
      console.log("Detaching global mouse event listeners");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      // Remove drag over/drop handlers from container if it exists
      if (containerRef.current) {
        containerRef.current.removeEventListener("dragover", handleDragOver);
        containerRef.current.removeEventListener("drop", handleDrop);
      }

      eventHandlersAttached.current = false;
    }
  };

  // Attach event listeners when not in preview mode
  useEffect(() => {
    if (!isPreviewOpen) {
      attachEventListeners();
    } else {
      detachEventListeners();
    }

    return () => {
      detachEventListeners();
    };
  }, [isPreviewOpen]);

  // Component doesn't render anything
  return null;
};

export default MouseHandlers;
