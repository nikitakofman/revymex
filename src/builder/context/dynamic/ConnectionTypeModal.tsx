import React, { useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBuilderRefs } from "@/builder/context/builderState";
import Button from "@/components/ui/button";
import { selectOps, useGetSelectedIds } from "../atoms/select-store";
import { useGetDynamicModeNodeId, dynamicOps } from "../atoms/dynamic-store";
import { useConnectionTypeModal, modalOps } from "../atoms/modal-store";
import {
  NodeId,
  getCurrentNodes,
  useGetNodeDynamicInfo,
} from "../atoms/node-store";
import { addUniqueConnection } from "../atoms/node-store/operations/dynamic-operations";

const ConnectionTypeModal: React.FC = () => {
  const { contentRef } = useBuilderRefs();

  const modalRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  const connectionTypeModal = useConnectionTypeModal();

  const getSelectedIds = useGetSelectedIds();

  useEffect(() => {
    if (!connectionTypeModal.show) return;

    const animationTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(animationTimeout);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [connectionTypeModal.show]);

  useEffect(() => {
    if (!connectionTypeModal.show) {
      setIsVisible(false);
    }
  }, [connectionTypeModal.show]);

  const findResponsiveCounterparts = useCallback((nodeId: NodeId) => {
    const allNodes = getCurrentNodes();
    const node = allNodes.find((n) => n.id === nodeId);

    const counterparts: NodeId[] = [];

    if (!node || !node.variantResponsiveId) return counterparts;

    const responsiveNodes = allNodes.filter(
      (n) =>
        n.variantResponsiveId === node.variantResponsiveId && n.id !== nodeId
    );

    responsiveNodes.forEach((responsiveNode) => {
      counterparts.push(responsiveNode.id);
    });

    return counterparts;
  }, []);

  const createResponsiveConnections = useCallback(
    (
      sourceId: NodeId,
      targetId: NodeId,
      connectionType: "click" | "hover" | "mouseLeave"
    ) => {
      const allNodes = getCurrentNodes();

      const sourceNode = allNodes.find((n) => n.id === sourceId);
      const targetNode = allNodes.find((n) => n.id === targetId);

      if (!sourceNode || !targetNode) return;

      const sourceCounterparts = findResponsiveCounterparts(sourceId);
      const targetCounterparts = findResponsiveCounterparts(targetId);

      console.log("Source Counterparts:", sourceCounterparts);
      console.log("Target Counterparts:", targetCounterparts);

      const targetsByViewport = new Map();

      if (targetNode.dynamicViewportId) {
        targetsByViewport.set(targetNode.dynamicViewportId, targetId);
      }

      targetCounterparts.forEach((counterpartId) => {
        const counterpart = allNodes.find((n) => n.id === counterpartId);
        if (counterpart && counterpart.dynamicViewportId) {
          targetsByViewport.set(counterpart.dynamicViewportId, counterpartId);
        }
      });

      sourceCounterparts.forEach((sourceCounterpartId) => {
        const counterpart = allNodes.find((n) => n.id === sourceCounterpartId);

        if (counterpart && counterpart.dynamicViewportId) {
          const viewportId = counterpart.dynamicViewportId;
          const matchingTargetId = targetsByViewport.get(viewportId);

          if (matchingTargetId) {
            console.log(
              `Creating responsive connection: ${sourceCounterpartId} -> ${matchingTargetId} (${connectionType})`
            );

            addUniqueConnection(
              sourceCounterpartId,
              matchingTargetId,
              connectionType
            );
          }
        }
      });
    },
    [findResponsiveCounterparts]
  );

  if (!connectionTypeModal.show) return null;

  const handleClose = () => {
    const selectedIds = getSelectedIds();

    if (
      connectionTypeModal.sourceId &&
      !selectedIds.includes(connectionTypeModal.sourceId)
    ) {
      selectOps.selectNode(connectionTypeModal.sourceId);
    }

    modalOps.hideConnectionTypeModal();
  };

  const handleSelectConnectionType = (
    type: "click" | "hover" | "mouseLeave"
  ) => {
    const { sourceId, targetId } = connectionTypeModal;

    if (sourceId && targetId) {
      addUniqueConnection(sourceId, targetId, type);

      createResponsiveConnections(sourceId, targetId, type);
    }

    handleClose();
  };

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
