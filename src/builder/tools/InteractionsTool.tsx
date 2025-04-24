import React, { useState, useEffect, useCallback } from "react";
import { ToolbarSection } from "./_components/ToolbarAtoms";
import { useBuilder } from "@/builder/context/builderState";
import { ToolbarPopup } from "@/builder/view/toolbars/rightToolbar/toolbar-popup";
import { ToolPopupTrigger } from "./_components/ToolbarPopupTrigger";
import { Zap, ChevronRight, X, Plus } from "lucide-react";
import { useGetSelectedIds } from "../context/atoms/select-store";

export const InteractionsTool = () => {
  const { nodeState, dragState } = useBuilder();

  // Replace subscription with imperative getter
  const getSelectedIds = useGetSelectedIds();
  const [selectedNode, setSelectedNode] = useState(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [isDynamicRelated, setIsDynamicRelated] = useState(false);

  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  // Update the selected node when selection changes
  useEffect(() => {
    // Get the current selection
    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) {
      setSelectedNode(null);
      setIsDynamicRelated(false);
      return;
    }

    const selectedNodeId = selectedIds[0];
    const node = nodeState.nodes.find((n) => n.id === selectedNodeId);
    setSelectedNode(node);

    // Update connection count
    setConnectionCount(node?.dynamicConnections?.length || 0);

    // Update dynamic related state
    const isDynamic =
      node &&
      (node.isDynamic ||
        node.dynamicParentId ||
        (node.dynamicConnections && node.dynamicConnections.length > 0));
    setIsDynamicRelated(isDynamic);
  }, [nodeState.nodes, getSelectedIds]);

  // Set up an observer for selection changes
  useEffect(() => {
    const selectionObserver = new MutationObserver(() => {
      // When selection changes, re-run our node finding logic
      const selectedIds = getSelectedIds();
      if (selectedIds.length === 0) {
        setSelectedNode(null);
        setIsDynamicRelated(false);
        return;
      }

      const selectedNodeId = selectedIds[0];
      const node = nodeState.nodes.find((n) => n.id === selectedNodeId);
      setSelectedNode(node);

      // Update connection count
      setConnectionCount(node?.dynamicConnections?.length || 0);

      // Update dynamic related state
      const isDynamic =
        node &&
        (node.isDynamic ||
          node.dynamicParentId ||
          (node.dynamicConnections && node.dynamicConnections.length > 0));
      setIsDynamicRelated(isDynamic);
    });

    // Observe changes to data-selected attribute
    selectionObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-selected"],
      subtree: true,
    });

    return () => {
      selectionObserver.disconnect();
    };
  }, [nodeState.nodes, getSelectedIds]);

  const handleTriggerPopup = useCallback((triggerElement, e) => {
    e.stopPropagation();

    if (triggerElement) {
      const rect = triggerElement.getBoundingClientRect();
      setPopupPosition({ x: rect.right + 10, y: rect.top });
      setShowPopup(true);
    }
  }, []);

  if (!isDynamicRelated) return null;

  return (
    <>
      <ToolbarSection title="Interactions">
        <div className="flex flex-col gap-2">
          <ToolPopupTrigger noTitle onTriggerPopup={handleTriggerPopup}>
            <div className="h-7 w-full flex items-center justify-between px-2 text-xs appearance-none bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors">
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-[var(--text-secondary)]" />
                <span>Manage connections</span>
              </div>
              {connectionCount > 0 && (
                <span className="bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {connectionCount}
                </span>
              )}
            </div>
          </ToolPopupTrigger>
        </div>
      </ToolbarSection>

      <ToolbarPopup
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
        triggerPosition={popupPosition}
        title="Interactions"
        leftPadding
      >
        <InteractionsPopup
          selectedNode={selectedNode}
          onClose={() => setShowPopup(false)}
        />
      </ToolbarPopup>
    </>
  );
};

const InteractionsPopup = ({ selectedNode, onClose }) => {
  const { nodeState, dragState, nodeDisp } = useBuilder();

  // Get the selected node ID from the passed node
  const selectedNodeId = selectedNode?.id;

  // Get current viewport
  const currentViewportId = dragState.activeViewportInDynamicMode;
  const currentViewport = nodeState.nodes.find(
    (n) => n.id === currentViewportId
  );

  // Find the main dynamic node (either this node or its parent)
  const mainDynamicNodeId = selectedNode?.isDynamic
    ? selectedNode.id
    : selectedNode?.dynamicParentId || dragState.dynamicModeNodeId;

  // Get current connections for the selected node
  const currentConnections = selectedNode?.dynamicConnections || [];

  // Track available targets for selection
  const [availableTargets, setAvailableTargets] = useState([]);

  // For managing target selection state
  const [showTargetSelector, setShowTargetSelector] = useState(null);

  // Populate available targets based on current viewport
  useEffect(() => {
    if (!selectedNode || !currentViewportId) return;

    // Find all nodes that:
    // 1. Belong to the current dynamic system (their dynamicParentId matches mainDynamicNodeId)
    // 2. AND are intended for the current viewport
    const targets = nodeState.nodes.filter((node) => {
      // Skip if it's the selected node (no self-connections)
      if (node.id === selectedNodeId) return false;

      // Include all nodes with matching dynamicParentId that are in this viewport
      return (
        // Either it belongs to the same dynamic system
        node.dynamicParentId === mainDynamicNodeId &&
        // AND it should be in the current viewport
        (node.dynamicViewportId === currentViewportId ||
          !node.dynamicViewportId)
      );
    });

    // Update state with found targets
    setAvailableTargets(targets);
  }, [
    nodeState.nodes,
    currentViewportId,
    mainDynamicNodeId,
    selectedNodeId,
    selectedNode,
  ]);

  const addConnection = (targetId, type) => {
    if (!selectedNodeId || !targetId || !type) return;

    // Add the connection
    nodeDisp.addUniqueDynamicConnection(
      selectedNodeId,
      targetId,
      type,
      mainDynamicNodeId
    );

    // Hide the target selector
    setShowTargetSelector(null);

    // Update the connection with viewport information
    setTimeout(() => {
      const updatedNode = nodeState.nodes.find((n) => n.id === selectedNodeId);

      if (updatedNode && updatedNode.dynamicConnections) {
        const connections = [...updatedNode.dynamicConnections];

        // Find the newly added connection
        const connectionIndex = connections.findIndex(
          (conn) => conn.type === type && conn.targetId === targetId
        );

        if (connectionIndex !== -1 && currentViewportId) {
          // Add viewport information
          connections[connectionIndex] = {
            ...connections[connectionIndex],
            viewportId: currentViewportId,
          };

          // Update the node
          nodeDisp.updateNode(selectedNodeId, {
            dynamicConnections: connections,
          });
        }
      }
    }, 100);
  };

  const removeConnection = (connectionType) => {
    if (!selectedNode || !selectedNode.dynamicConnections) return;

    // Create a copy of the connections without the one we want to remove
    const updatedConnections = selectedNode.dynamicConnections.filter(
      (conn) => conn.type !== connectionType
    );

    // Update the node with the filtered connections
    nodeDisp.updateNode(selectedNodeId, {
      dynamicConnections: updatedConnections,
    });
  };

  // Get human-readable name for a node
  const getNodeDisplayName = useCallback(
    (nodeId) => {
      const node = nodeState.nodes.find((n) => n.id === nodeId);
      if (!node) return "Unknown";

      return node.variantInfo?.name || node.customName || "Unnamed";
    },
    [nodeState.nodes]
  );

  // Function to get node type display name
  const getNodeTypeDisplay = useCallback((node) => {
    if (!node) return "";

    if (node.type === "frame") return "Frame";
    if (node.type === "image") return "Image";
    if (node.type === "text") return "Text";

    // Capitalize first letter
    return node.type.charAt(0).toUpperCase() + node.type.slice(1);
  }, []);

  // Get viewport name
  const viewportName = currentViewport?.viewportName || "";

  // Get existing connection for a specific type
  const getExistingConnection = useCallback(
    (type) => {
      return currentConnections.find((conn) => conn.type === type);
    },
    [currentConnections]
  );

  // Check if a connection type is already used
  const hasConnectionType = useCallback(
    (type) => {
      return currentConnections.some((conn) => conn.type === type);
    },
    [currentConnections]
  );

  return (
    <div className="w-full ">
      <div className="space-y-5 py-2">
        {/* On Click Connection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              On Click:
            </div>
          </div>

          {hasConnectionType("click") ? (
            <div className="relative h-7 w-full flex items-center justify-between px-2 text-xs bg-[var(--bg-subtle)] border border-[var(--control-border)] text-[var(--text-primary)] rounded-[var(--radius-lg)]">
              <div className="flex items-center gap-1.5">
                {(() => {
                  const conn = getExistingConnection("click");
                  const targetNode = nodeState.nodes.find(
                    (n) => n.id === conn?.targetId
                  );
                  const nodeType = getNodeTypeDisplay(targetNode);
                  return (
                    <>
                      <span>{getNodeDisplayName(conn?.targetId)}</span>
                      {nodeType && (
                        <span className="text-[10px] text-[var(--fg-muted)]">
                          ({nodeType})
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => removeConnection("click")}
                className="text-xs p-0.5 rounded hover:bg-red-100 hover:text-red-700 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              {showTargetSelector === "click" ? (
                <div className="space-y-2">
                  {availableTargets.length === 0 ? (
                    <div className="text-xs text-[var(--fg-muted)] p-2 bg-[var(--bg-subtle)] rounded">
                      No targets available in this viewport
                    </div>
                  ) : (
                    <div className="max-h-[125px] overflow-y-auto space-y-1">
                      {availableTargets.map((target) => (
                        <button
                          key={target.id}
                          onClick={() => addConnection(target.id, "click")}
                          className="relative h-7 w-full flex items-center justify-between px-2 text-xs bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] text-[var(--text-primary)] rounded-[var(--radius-lg)] transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{getNodeDisplayName(target.id)}</span>
                            <span className="text-[10px] text-[var(--fg-muted)]">
                              ({getNodeTypeDisplay(target)})
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowTargetSelector(null)}
                    className="text-xs text-[var(--fg-muted)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTargetSelector("click")}
                  className="relative h-7 w-full flex items-center justify-between px-2 text-xs bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] text-[var(--text-primary)] rounded-[var(--radius-lg)] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Plus size={12} />
                    <span>Add click trigger</span>
                  </div>
                </button>
              )}
            </>
          )}
        </div>

        {/* On Hover Connection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              On Hover:
            </div>
          </div>

          {hasConnectionType("hover") ? (
            <div className="relative h-7 w-full flex items-center justify-between px-2 text-xs bg-[var(--bg-subtle)] border border-[var(--control-border)] text-[var(--text-primary)] rounded-[var(--radius-lg)]">
              <div className="flex items-center gap-1.5">
                {(() => {
                  const conn = getExistingConnection("hover");
                  const targetNode = nodeState.nodes.find(
                    (n) => n.id === conn?.targetId
                  );
                  const nodeType = getNodeTypeDisplay(targetNode);
                  return (
                    <>
                      <span>{getNodeDisplayName(conn?.targetId)}</span>
                      {nodeType && (
                        <span className="text-[10px] text-[var(--fg-muted)]">
                          ({nodeType})
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => removeConnection("hover")}
                className="text-xs p-0.5 rounded hover:bg-red-100 hover:text-red-700 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              {showTargetSelector === "hover" ? (
                <div className="space-y-2">
                  {availableTargets.length === 0 ? (
                    <div className="text-xs text-[var(--fg-muted)] p-2 bg-[var(--bg-subtle)] rounded">
                      No targets available in this viewport
                    </div>
                  ) : (
                    <div className="max-h-[125px] overflow-y-auto space-y-1">
                      {availableTargets.map((target) => (
                        <button
                          key={target.id}
                          onClick={() => addConnection(target.id, "hover")}
                          className="relative h-7 w-full flex items-center justify-between px-2 text-xs bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] text-[var(--text-primary)] rounded-[var(--radius-lg)] transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{getNodeDisplayName(target.id)}</span>
                            <span className="text-[10px] text-[var(--fg-muted)]">
                              ({getNodeTypeDisplay(target)})
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowTargetSelector(null)}
                    className="text-xs text-[var(--fg-muted)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTargetSelector("hover")}
                  className="relative h-7 w-full flex items-center justify-between px-2 text-xs bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] text-[var(--text-primary)] rounded-[var(--radius-lg)] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Plus size={12} />
                    <span>Add hover trigger</span>
                  </div>
                </button>
              )}
            </>
          )}
        </div>

        {/* On Leave Connection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              On Leave:
            </div>
          </div>

          {hasConnectionType("mouseLeave") ? (
            <div className="relative h-7 w-full flex items-center justify-between px-2 text-xs bg-[var(--bg-subtle)] border border-[var(--control-border)] text-[var(--text-primary)] rounded-[var(--radius-lg)]">
              <div className="flex items-center gap-1.5">
                {(() => {
                  const conn = getExistingConnection("mouseLeave");
                  const targetNode = nodeState.nodes.find(
                    (n) => n.id === conn?.targetId
                  );
                  const nodeType = getNodeTypeDisplay(targetNode);
                  return (
                    <>
                      <span>{getNodeDisplayName(conn?.targetId)}</span>
                      {nodeType && (
                        <span className="text-[10px] text-[var(--fg-muted)]">
                          ({nodeType})
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => removeConnection("mouseLeave")}
                className="text-xs p-0.5 rounded hover:bg-red-100 hover:text-red-700 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              {showTargetSelector === "mouseLeave" ? (
                <div className="space-y-2">
                  {availableTargets.length === 0 ? (
                    <div className="text-xs text-[var(--fg-muted)] p-2 bg-[var(--bg-subtle)] rounded">
                      No targets available in this viewport
                    </div>
                  ) : (
                    <div className="max-h-[125px] overflow-y-auto space-y-1">
                      {availableTargets.map((target) => (
                        <button
                          key={target.id}
                          onClick={() => addConnection(target.id, "mouseLeave")}
                          className="relative h-7 w-full flex items-center justify-between px-2 text-xs bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] text-[var(--text-primary)] rounded-[var(--radius-lg)] transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{getNodeDisplayName(target.id)}</span>
                            <span className="text-[10px] text-[var(--fg-muted)]">
                              ({getNodeTypeDisplay(target)})
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowTargetSelector(null)}
                    className="text-xs text-[var(--fg-muted)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTargetSelector("mouseLeave")}
                  className="relative h-7 w-full flex items-center justify-between px-2 text-xs bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] text-[var(--text-primary)] rounded-[var(--radius-lg)] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Plus size={12} />
                    <span>Add leave trigger</span>
                  </div>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractionsTool;
