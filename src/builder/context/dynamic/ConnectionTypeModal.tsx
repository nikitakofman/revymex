import React, { useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBuilder, useBuilderDynamic } from "@/builder/context/builderState";
import Button from "@/components/ui/button";
import { selectOps, useGetSelectedIds } from "../atoms/select-store";
import { useGetDynamicModeNodeId } from "../atoms/dynamic-store";
import { useConnectionTypeModal, modalOps } from "../atoms/modal-store";

const ConnectionTypeModal: React.FC = () => {
  const { nodeDisp, nodeState } = useBuilderDynamic();

  const modalRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  // Use the subscription hook for rendering
  const connectionTypeModal = useConnectionTypeModal();

  // Use imperative getters for event handlers
  const getSelectedIds = useGetSelectedIds();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  // Handle clicks outside the modal
  useEffect(() => {
    if (!connectionTypeModal.show) return;

    // Show with a small delay for animation
    const animationTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 10);

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
  }, [connectionTypeModal.show]);

  // Reset visibility when modal is hidden
  useEffect(() => {
    if (!connectionTypeModal.show) {
      setIsVisible(false);
    }
  }, [connectionTypeModal.show]);

  // Function to find responsive counterparts of a node across all viewports
  const findResponsiveCounterparts = useCallback(
    (nodeId: string | number) => {
      const counterparts: string[] = [];
      const node = nodeState.nodes.find((n) => n.id === nodeId);

      if (!node || !node.variantResponsiveId) return counterparts;

      // Find all nodes with the same variantResponsiveId (responsive siblings)
      const responsiveNodes = nodeState.nodes.filter(
        (n) =>
          n.variantResponsiveId === node.variantResponsiveId && n.id !== nodeId
      );

      responsiveNodes.forEach((responsiveNode) => {
        counterparts.push(responsiveNode.id.toString());
      });

      return counterparts;
    },
    [nodeState.nodes]
  );

  // Function to create connections across responsive counterparts
  const createResponsiveConnections = useCallback(
    (
      sourceId: string | number,
      targetId: string | number,
      connectionType: "click" | "hover" | "mouseLeave"
    ) => {
      // Get source and target nodes
      const sourceNode = nodeState.nodes.find((n) => n.id === sourceId);
      const targetNode = nodeState.nodes.find((n) => n.id === targetId);

      if (!sourceNode || !targetNode) return;

      // Find the responsive counterparts
      const sourceCounterparts = findResponsiveCounterparts(sourceId);
      const targetCounterparts = findResponsiveCounterparts(targetId);

      console.log("Source Counterparts:", sourceCounterparts);
      console.log("Target Counterparts:", targetCounterparts);

      // Map targets to their viewport IDs for easier matching
      const targetsByViewport = new Map();

      targetNode.dynamicViewportId &&
        targetsByViewport.set(targetNode.dynamicViewportId, targetId);

      targetCounterparts.forEach((counterpartId) => {
        const counterpart = nodeState.nodes.find((n) => n.id === counterpartId);
        if (counterpart && counterpart.dynamicViewportId) {
          targetsByViewport.set(counterpart.dynamicViewportId, counterpartId);
        }
      });

      // For each source counterpart, find the target in the same viewport and connect them
      sourceCounterparts.forEach((sourceCounterpartId) => {
        const counterpart = nodeState.nodes.find(
          (n) => n.id === sourceCounterpartId
        );

        if (counterpart && counterpart.dynamicViewportId) {
          const viewportId = counterpart.dynamicViewportId;
          const matchingTargetId = targetsByViewport.get(viewportId);

          if (matchingTargetId) {
            console.log(
              `Creating responsive connection: ${sourceCounterpartId} -> ${matchingTargetId} (${connectionType})`
            );

            const dynamicModeNodeId = getDynamicModeNodeId();

            // Create the connection in this viewport
            nodeDisp.addUniqueDynamicConnection(
              sourceCounterpartId,
              matchingTargetId,
              connectionType,
              dynamicModeNodeId
            );
          }
        }
      });
    },
    [
      nodeState.nodes,
      findResponsiveCounterparts,
      getDynamicModeNodeId,
      nodeDisp,
    ]
  );

  if (!connectionTypeModal.show) return null;

  const handleClose = () => {
    // Get the current selection when closing
    const selectedIds = getSelectedIds();

    // Before closing, make sure the source node remains selected
    if (
      connectionTypeModal.sourceId &&
      !selectedIds.includes(connectionTypeModal.sourceId.toString())
    ) {
      selectOps.selectNode(connectionTypeModal.sourceId);
    }

    // Use the modal ops to hide the modal
    modalOps.hideConnectionTypeModal();
  };

  const handleSelectConnectionType = (
    type: "click" | "hover" | "mouseLeave"
  ) => {
    const { sourceId, targetId } = connectionTypeModal;

    const dynamicModeNodeId = getDynamicModeNodeId();
    if (sourceId && targetId) {
      // Create the primary connection
      nodeDisp.addUniqueDynamicConnection(
        sourceId,
        targetId,
        type,
        dynamicModeNodeId
      );

      // Then cascade the connection to all responsive counterparts
      createResponsiveConnections(sourceId, targetId, type);
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
