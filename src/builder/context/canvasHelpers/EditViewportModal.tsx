import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import Button from "@/components/ui/button";

const EditViewportModal: React.FC = () => {
  const { nodeState, nodeDisp, dragState, dragDisp } = useBuilder();
  const modalRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const { editViewportModal } = dragState;

  // Find the viewport to edit
  const viewport = nodeState.nodes.find(
    (n) => n.id === editViewportModal.viewportId && n.isViewport
  );

  const [widthValue, setWidthValue] = useState(
    viewport?.viewportWidth?.toString() || ""
  );
  const [nameValue, setNameValue] = useState(viewport?.viewportName || "");

  // Handle clicks outside the modal
  useEffect(() => {
    if (!editViewportModal.show) return;

    // Show with a small delay for animation
    const animationTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        dragDisp.hideEditViewportModal();
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
  }, [editViewportModal.show, dragDisp]);

  // Reset visibility when modal is hidden
  useEffect(() => {
    if (!editViewportModal.show) {
      setIsVisible(false);
    }
  }, [editViewportModal.show]);

  // Update form values when viewport changes
  useEffect(() => {
    if (viewport) {
      setWidthValue(viewport.viewportWidth?.toString() || "");
      setNameValue(viewport.viewportName || "");
    }
  }, [viewport, editViewportModal.viewportId]);

  if (!editViewportModal.show || !viewport) return null;

  const handleClose = () => {
    dragDisp.hideEditViewportModal();
  };

  const updateViewport = () => {
    const width = parseInt(widthValue);

    if (isNaN(width) || width <= 0) {
      alert("Please enter a valid width");
      return;
    }

    nodeDisp.editViewport(editViewportModal.viewportId, width, nameValue);
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      updateViewport();
    }
  };

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed z-[10000] w-72 bg-[var(--bg-surface)] rounded-lg shadow-lg border border-[var(--border-default)]"
      style={{
        left: `${editViewportModal.position.x}px`,
        top: `${editViewportModal.position.y}px`,
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.15s ease-out",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
        <h3 className="text-xs font-bold">Edit Viewport</h3>
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
          onClick={updateViewport}
          className="mt-1 w-full"
        >
          Update Viewport
        </Button>
      </div>
    </div>
  );

  // Render the modal to document.body
  return createPortal(
    <>
      {/* Add this overlay div to block wheel panning */}
      <div
        className="fixed inset-0 bg-transparent z-[999]"
        onClick={() => dragDisp.hideEditViewportModal()}
        onContextMenu={(e) => e.preventDefault()}
      />
      {modalContent}
    </>,
    document.body
  );
};

export default EditViewportModal;
