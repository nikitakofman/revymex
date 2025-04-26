import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import Button from "@/components/ui/button";
import { nanoid } from "nanoid";
import { canvasOps } from "../atoms/canvas-interaction-store";
import { useViewportModal, modalOps } from "../atoms/modal-store";

const AddViewportModal: React.FC = () => {
  const { nodeDisp } = useBuilder();
  const modalRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [widthValue, setWidthValue] = useState("768");
  const [nameValue, setNameValue] = useState("Tablet");

  // Use the subscription hook for the viewport modal
  const viewportModal = useViewportModal();

  // Handle clicks outside the modal
  useEffect(() => {
    if (!viewportModal.show) return;

    // Show with a small delay for animation
    const animationTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        modalOps.hideViewportModal();
      }
    };

    // Add event listener with slight delay to prevent immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(animationTimeout);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [viewportModal.show]);

  // Reset visibility when modal is hidden
  useEffect(() => {
    if (!viewportModal.show) {
      setIsVisible(false);
    }
  }, [viewportModal.show]);

  if (!viewportModal.show) return null;

  const handleClose = () => {
    modalOps.hideViewportModal();
  };

  const createViewport = () => {
    const width = parseInt(widthValue);

    if (isNaN(width) || width <= 0) {
      alert("Please enter a valid width");
      return;
    }

    nodeDisp.addNode(
      {
        id: `viewport-${nanoid()}`,
        type: "frame",
        isViewport: true,
        viewportWidth: width,
        viewportName: nameValue || `${width}px`,
        style: {
          width: `${width}px`,
          height: "1000px",
          position: "absolute",
          backgroundColor: "white",
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          left: "100px",
          top: "100px",
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        },
        inViewport: false,
        parentId: null,
        position: { x: 100, y: 100 },
      },
      null,
      null,
      false
    );
    nodeDisp.syncViewports();
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      createViewport();
    }
  };

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed z-[10000] w-72 bg-[var(--bg-surface)] rounded-lg shadow-lg border border-[var(--border-default)]"
      style={{
        left: `${viewportModal.position.x}px`,
        top: `${viewportModal.position.y}px`,
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.15s ease-out",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
        <h3 className="text-xs font-bold">Add Viewport</h3>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-[var(--bg-hover)] rounded-md transition-colors"
        >
          <X className="w-3 h-3 text-[var(--text-secondary)]" />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Width input */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Width</span>
          <div className="flex items-center">
            <input
              type="number"
              value={widthValue}
              onChange={(e) => setWidthValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onSelect={(e) => canvasOps.setIsEditingText(true)}
              onBlur={(e) => canvasOps.setIsEditingText(false)}
              min={1}
              className="w-[60px] h-7 px-2 text-xs 
                bg-[var(--grid-line)] border border-[var(--control-border)] 
                hover:border-[var(--control-border-hover)] 
                focus:border-[var(--border-focus)] 
                text-[var(--text-primary)] rounded-[var(--radius-lg)] 
                focus:outline-none transition-colors
                [appearance:textfield] 
                [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-[var(--text-secondary)] ml-1">
              px
            </span>
          </div>
        </div>

        {/* Name input */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Name</span>
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onSelect={() => canvasOps.setIsEditingText(true)}
            onBlur={() => canvasOps.setIsEditingText(false)}
            onKeyDown={handleKeyDown}
            placeholder="Viewport name"
            className="w-[140px] h-7 px-2 text-xs 
              bg-[var(--grid-line)] border border-[var(--control-border)] 
              hover:border-[var(--control-border-hover)] 
              focus:border-[var(--border-focus)] 
              text-[var(--text-primary)] rounded-[var(--radius-lg)] 
              focus:outline-none transition-colors"
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={createViewport}
          className="mt-1 w-full"
        >
          Add Viewport
        </Button>
      </div>
    </div>
  );

  // Render the modal to document.body instead of the canvas
  return createPortal(
    <>
      {/* Add this overlay div to block wheel panning */}
      <div
        className="fixed inset-0 bg-transparent z-[999]"
        onClick={() => modalOps.hideViewportModal()}
        onContextMenu={(e) => e.preventDefault()}
      />
      {modalContent}
    </>,
    document.body
  );
};

export default AddViewportModal;
