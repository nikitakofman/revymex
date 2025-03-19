import React, { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import Button from "@/components/ui/button";

const ConnectionTypeModal: React.FC = () => {
  const { dragState, dragDisp, nodeDisp } = useBuilder();
  const { connectionTypeModal } = dragState;
  const modalRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  // Handle clicks outside the modal
  useEffect(() => {
    if (!connectionTypeModal.show) return;

    // Show with a small delay for animation
    const animationTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    // Ensure the source node stays selected
    if (
      connectionTypeModal.sourceId &&
      !dragState.selectedIds.includes(connectionTypeModal.sourceId)
    ) {
      dragDisp.selectNode(connectionTypeModal.sourceId);
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose();
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
  }, [
    connectionTypeModal.show,
    connectionTypeModal.sourceId,
    dragState.selectedIds,
    dragDisp,
  ]);

  // Reset visibility when modal is hidden
  useEffect(() => {
    if (!connectionTypeModal.show) {
      setIsVisible(false);
    }
  }, [connectionTypeModal.show]);

  if (!connectionTypeModal.show) return null;

  const handleClose = () => {
    // Before closing, make sure the source node remains selected
    if (
      connectionTypeModal.sourceId &&
      !dragState.selectedIds.includes(connectionTypeModal.sourceId)
    ) {
      dragDisp.selectNode(connectionTypeModal.sourceId);
    }

    dragDisp.hideConnectionTypeModal();
  };

  const handleSelectConnectionType = (
    type: "click" | "hover" | "mouseLeave"
  ) => {
    const { sourceId, targetId } = connectionTypeModal;

    if (sourceId && targetId) {
      // Use the addUniqueDynamicConnection method directly
      // This enforces one connection per type per source node
      nodeDisp.addUniqueDynamicConnection(
        sourceId,
        targetId,
        type,
        dragState.dynamicModeNodeId
      );

      // Ensure the source node stays selected
      if (!dragState.selectedIds.includes(sourceId)) {
        dragDisp.selectNode(sourceId);
      }
    }

    // Hide the modal
    handleClose();
  };

  // Calculate position to ensure it stays within viewport bounds
  const x = Math.min(connectionTypeModal.position.x, window.innerWidth - 290);
  const y = Math.min(connectionTypeModal.position.y, window.innerHeight - 200);

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed z-50 w-72 bg-[var(--bg-surface)] rounded-lg shadow-lg border border-[var(--border-default)]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.15s ease-out",
        zIndex: 10000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
        <h3 className="text-xs font-bold">Connection Type</h3>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-[var(--bg-hover)] rounded-md transition-colors"
        >
          <X className="w-3 h-3 text-[var(--text-secondary)]" />
        </button>
      </div>

      <div className="p-2 flex flex-col gap-2 pb-4">
        <Button onClick={() => handleSelectConnectionType("click")}>
          On Click
        </Button>

        <Button
          onClick={() => handleSelectConnectionType("hover")}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          On Hover
        </Button>

        <Button
          onClick={() => handleSelectConnectionType("mouseLeave")}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          On Mouse Leave
        </Button>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ConnectionTypeModal;
