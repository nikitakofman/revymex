"use client";

import React, {
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useBuilder, useBuilderDynamic } from "@/builder/context/builderState";
import { useTheme } from "next-themes";
import { Sun, Moon, PlayCircle, Copy } from "lucide-react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { createPortal } from "react-dom";
import { useGetSelectedIds } from "../context/atoms/select-store";
import {
  canvasOps,
  useTransform,
} from "../context/atoms/canvas-interaction-store";
import {
  dynamicOps,
  useDynamicModeNodeId,
} from "../context/atoms/dynamic-store";
import {
  NodeId,
  nodeStore,
  nodeIdsAtom,
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeParent,
  useGetNodeChildren,
  useGetNodeSharedInfo,
  useGetNodeDynamicInfo,
  nodeBasicsAtom,
  nodeStyleAtom,
  nodeFlagsAtom,
  nodeParentAtom,
  nodeSharedInfoAtom,
  nodeDynamicInfoAtom,
} from "../context/atoms/node-store";

interface Operation {
  method: string;
  timestamp: number;
  args: any[];
  options?: any;
}

function getNodesFromJotai() {
  // Get all node IDs from the Jotai store
  const nodeIds = nodeStore.get(nodeIdsAtom);

  // Create nodes array from IDs
  return nodeIds.map((id) => {
    const basics = nodeStore.get(nodeBasicsAtom(id));
    const style = nodeStore.get(nodeStyleAtom(id));
    const flags = nodeStore.get(nodeFlagsAtom(id));
    const parentId = nodeStore.get(nodeParentAtom(id));
    const sharedInfo = nodeStore.get(nodeSharedInfoAtom(id));
    const dynamicInfo = nodeStore.get(nodeDynamicInfoAtom(id));

    return {
      id: basics.id,
      type: basics.type,
      customName: basics.customName,
      style,
      parentId,
      sharedId: sharedInfo.sharedId,
      dynamicViewportId: dynamicInfo.dynamicViewportId,
      dynamicFamilyId: dynamicInfo.dynamicFamilyId,
      dynamicParentId: dynamicInfo.dynamicParentId,
      dynamicConnections: dynamicInfo.dynamicConnections,
      dynamicPosition: dynamicInfo.dynamicPosition,
      originalParentId: dynamicInfo.originalParentId,
      originalState: dynamicInfo.originalState,
      isViewport: flags.isViewport,
      viewportWidth: flags.viewportWidth,
      isVariant: flags.isVariant,
      isDynamic: flags.isDynamic,
      isLocked: flags.isLocked,
      isAbsoluteInFrame: flags.isAbsoluteInFrame,
      inViewport: flags.inViewport,
    };
  });
}

function getDescendants(nodes: Node[], rootId: string | number): Node[] {
  const result: Node[] = [];
  const queue = [rootId];

  while (queue.length) {
    const current = queue.shift()!;
    const children = nodes.filter(
      (n) => n.parentId === current && n.type !== "placeholder"
    );
    for (const child of children) {
      result.push(child);
      queue.push(child.id);
    }
  }
  return result;
}

const NodeDispOperations: React.FC<{
  operations: Operation[];
  onClear: () => void;
}> = ({ operations, onClear }) => {
  const [hideSkipHistory, setHideSkipHistory] = useState(false);

  // Filter operations based on hideSkipHistory state
  const filteredOperations = useMemo(() => {
    if (!hideSkipHistory) return operations;
    return operations.filter((op) => !op.options?.skipHistory);
  }, [operations, hideSkipHistory]);

  // Group operations by method for better visualization
  const groupedOps = useMemo(() => {
    const groups: { [key: string]: number } = {};
    filteredOperations.forEach((op) => {
      groups[op.method] = (groups[op.method] || 0) + 1;
    });
    return groups;
  }, [filteredOperations]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">NodeDispatcher Operations</h3>
          <span className="text-sm text-[var(--text-secondary)]">
            ({filteredOperations.length} total)
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setHideSkipHistory(!hideSkipHistory)}
            className={`px-2 py-1 rounded-[var(--radius-sm)] ${
              hideSkipHistory
                ? "bg-[var(--button-primary-bg)] text-white"
                : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
            }`}
          >
            Hide skipHistory
          </button>
          <button
            onClick={onClear}
            className="px-2 py-1 bg-[var(--control-bg)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Method summary */}
      <div className="mb-4 p-2 bg-[var(--control-bg)] rounded-[var(--radius-sm)]">
        {Object.entries(groupedOps).map(([method, count]) => (
          <div key={method} className="flex justify-between text-sm">
            <span>{method}</span>
            <span>{count}x</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {filteredOperations.map((op, i) => (
          <div
            key={op.timestamp + i}
            className="mb-4 p-3 bg-[var(--control-bg)] rounded-[var(--radius-md)] border border-[var(--border-light)]"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-[var(--text-primary)]">
                {op.method}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {new Date(op.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {op.options && (
              <div className="mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Options:
                </span>
                <pre className="text-xs mt-1 p-1 bg-[var(--bg-surface)] rounded">
                  {JSON.stringify(op.options, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Args:
              </span>
              <pre className="text-xs mt-1 p-1 bg-[var(--bg-surface)] rounded whitespace-pre-wrap break-all">
                {JSON.stringify(op.args, null, 2)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ViewportDevTools: React.FC = () => {
  const { nodeState, nodeDisp, operations, clearOperations } =
    useBuilderDynamic();

  // Get Jotai node state
  const [jotaiNodes, setJotaiNodes] = useState(() => getNodesFromJotai());

  // Update Jotai node state periodically
  useEffect(() => {
    const intervalId = setInterval(() => {
      setJotaiNodes(getNodesFromJotai());
    }, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, []);

  const transform = useTransform();
  const dynamicModeNodeId = useDynamicModeNodeId();

  // Replace subscription with imperative getter
  const getSelectedIds = useGetSelectedIds();
  const [selectedIdsList, setSelectedIdsList] = useState<(string | number)[]>(
    []
  );

  // Update selected IDs when needed
  useEffect(() => {
    // Set up a MutationObserver to detect selection changes via DOM attributes
    const selectionObserver = new MutationObserver(() => {
      const currentSelectedIds = getSelectedIds();
      setSelectedIdsList(currentSelectedIds);
    });

    // Initial update
    setSelectedIdsList(getSelectedIds());

    // Observe changes to data-selected attribute
    selectionObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-selected"],
      subtree: true,
    });

    return () => {
      selectionObserver.disconnect();
    };
  }, [getSelectedIds]);

  const [showTree, setShowTree] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "view" | "jotai" | "perViewport" | "import" | "drag" | "nodeDisp"
  >("view");

  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [showPreview, setShowPreview] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const [openViewportId, setOpenViewportId] = useState<string | number | null>(
    null
  );

  if (!mounted) return null;

  const handleResetView = () => {
    const currentTransform = canvasOps.getState().transform;
    canvasOps.setTransform({
      ...currentTransform,
      x: 0,
      y: 0,
    });
  };

  const handleToggleTree = () => {
    setShowTree((prev) => !prev);
  };

  const handleImport = () => {
    try {
      const nodes = JSON.parse(importValue);
      if (!Array.isArray(nodes)) {
        throw new Error("Invalid format: Expected an array of nodes");
      }
      nodeDisp.setNodes(nodes);
      setImportError(null);
      setImportValue("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Invalid JSON format"
      );
    }
  };

  const handleCopyNodesJson = () => {
    // Use Jotai nodes for copying
    const nodesJson = JSON.stringify(jotaiNodes, null, 2);
    navigator.clipboard
      .writeText(nodesJson)
      .then(() => {
        setCopyStatus("Copied!");
        setTimeout(() => setCopyStatus(""), 2000);
      })
      .catch((err) => {
        setCopyStatus("Failed to copy");
        setTimeout(() => setCopyStatus(""), 2000);
      });
  };

  const handleCopySelectedId = () => {
    // Get the first selected ID, or return if none
    const selectedId = selectedIdsList[0];
    if (!selectedId) {
      setCopyStatus("No ID selected");
      setTimeout(() => setCopyStatus(""), 2000);
      return;
    }

    navigator.clipboard
      .writeText(selectedId.toString())
      .then(() => {
        setCopyStatus("ID copied!");
        setTimeout(() => setCopyStatus(""), 2000);
      })
      .catch((err) => {
        setCopyStatus("Failed to copy ID");
        setTimeout(() => setCopyStatus(""), 2000);
      });
  };

  // Use Jotai nodes instead of nodeState.nodes for viewports
  const viewports = jotaiNodes.filter((n) => n.isViewport);

  return createPortal(
    <>
      <div className="fixed resize bottom-14 scale-75 right-[190px] flex gap-2 p-2 bg-[var(--bg-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] border border-[var(--border-light)]">
        {dynamicModeNodeId && (
          <button
            className="px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
            onClick={() => {
              nodeDisp.resetDynamicNodePositions();
              dynamicOps.setDynamicModeNodeId(null);
              nodeDisp.syncViewports();
            }}
          >
            Exit Dynamic Mode
          </button>
        )}

        <div className="absolute bottom-[-40px] z-[9999] cursor-pointer right-0 p-2">
          {selectedIdsList[0]}
        </div>
        <button
          className="px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
          onClick={handleResetView}
        >
          Reset View
        </button>
        <div className="flex items-center gap-2 px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)]">
          <input
            type="number"
            value={Math.round(transform.scale * 100)}
            onChange={(e) =>
              canvasOps.setTransform({
                ...transform,
                scale: Number(e.target.value) / 100,
              })
            }
            className="w-16 px-1 bg-[var(--control-bg-hover)] rounded-sm"
          />
          <span>%</span>
          <input
            type="number"
            value={Math.round(transform.x)}
            onChange={(e) =>
              canvasOps.setTransform({
                ...transform,
                x: Number(e.target.value),
              })
            }
            className="w-16 px-1 bg-[var(--control-bg-hover)] rounded-sm"
          />
          <span>X</span>
          <input
            type="number"
            value={Math.round(transform.y)}
            onChange={(e) =>
              canvasOps.setTransform({
                ...transform,
                y: Number(e.target.value),
              })
            }
            className="w-16 px-1 bg-[var(--control-bg-hover)] rounded-sm"
          />
          <span>Y</span>
        </div>
        <button
          className="px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
          onClick={handleToggleTree}
        >
          Show Tree
        </button>

        {/* New Copy JSON button */}
        <button
          className="flex items-center gap-1 px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
          onClick={handleCopyNodesJson}
          title="Copy entire node tree as JSON"
        >
          <Copy className="w-4 h-4" />
          Copy JSON
        </button>

        {/* New Copy ID button */}
        <button
          className="flex items-center gap-1 px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
          onClick={handleCopySelectedId}
          title="Copy selected node ID"
          disabled={selectedIdsList.length === 0}
        >
          <Copy className="w-4 h-4" />
          Copy ID
        </button>

        <button
          className={`px-3 py-1 rounded-[var(--radius-sm)] ${
            selectedIdsList.length > 0
              ? "bg-[var(--button-primary-bg)] text-white"
              : "bg-[var(--control-bg)] text-[var(--text-primary)]"
          }`}
        >
          {selectedIdsList.length}
        </button>

        {/* Copy status toast */}
        {copyStatus && (
          <div className="absolute top-[-40px] right-0 bg-[var(--bg-surface)] px-3 py-1 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] border border-[var(--border-light)]">
            {copyStatus}
          </div>
        )}
      </div>

      {showTree && (
        <div className="fixed inset-0 flex z-50 items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] p-4 rounded-[var(--radius-lg)] max-w-[80vw] resize max-h-[80vh] overflow-hidden flex flex-col shadow-[var(--shadow-lg)] border border-[var(--border-light)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Node Tree</h2>
              <button
                className="px-2 py-1 bg-[var(--control-bg)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
                onClick={handleToggleTree}
              >
                Close
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                className={`px-3 py-1 rounded-[var(--radius-sm)] ${
                  activeTab === "view"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("view")}
              >
                Old State
              </button>
              <button
                className={`px-3 py-1 rounded-[var(--radius-sm)] ${
                  activeTab === "jotai"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("jotai")}
              >
                Jotai State
              </button>
              <button
                className={`px-3 py-1 rounded-[var(--radius-sm)] ${
                  activeTab === "perViewport"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("perViewport")}
              >
                Per Viewport
              </button>
              <button
                className={`px-3 py-1 rounded-[var(--radius-sm)] ${
                  activeTab === "import"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("import")}
              >
                Import
              </button>
              <button
                className={`px-3 py-1 rounded-[var(--radius-sm)] ${
                  activeTab === "drag"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("drag")}
              >
                drag state
              </button>
              <button
                className={`px-3 py-1 rounded-[var(--radius-sm)] ${
                  activeTab === "nodeDisp"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("nodeDisp")}
              >
                NodeDisp
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {activeTab === "view" && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {nodeState.nodes.length} nodes
                    </span>
                  </div>
                  <textarea className="text-xs w-full whitespace-pre-wrap bg-[var(--control-bg)] p-4 rounded-[var(--radius-md)]">
                    {JSON.stringify(nodeState.nodes, null, 2)}
                  </textarea>
                </div>
              )}

              {activeTab === "jotai" && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {jotaiNodes.length} nodes (Jotai)
                    </span>
                    <button
                      className="px-2 py-1 bg-[var(--control-bg)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
                      onClick={() => setJotaiNodes(getNodesFromJotai())}
                    >
                      Refresh
                    </button>
                  </div>
                  <textarea className="text-xs w-full whitespace-pre-wrap bg-[var(--control-bg)] p-4 rounded-[var(--radius-md)]">
                    {JSON.stringify(jotaiNodes, null, 2)}
                  </textarea>
                </div>
              )}

              {activeTab === "drag" && (
                <pre className="text-xs whitespace-pre-wrap bg-[var(--control-bg)] p-4 rounded-[var(--radius-md)]">
                  ss
                </pre>
              )}

              {activeTab === "nodeDisp" && (
                <NodeDispOperations
                  operations={operations}
                  onClear={clearOperations}
                />
              )}

              {activeTab === "perViewport" && (
                <div className="flex gap-4 min-w-[900px] min-h-[600px]">
                  {viewports.map((viewport) => {
                    const isOpen = openViewportId === viewport.id;
                    const descendants = getDescendants(jotaiNodes, viewport.id);

                    return (
                      <div
                        key={viewport.id}
                        className="flex-1 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-light)] p-4"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-col">
                            <span className="text-lg font-semibold">
                              {viewport.viewportWidth}px
                            </span>
                            <span className="text-sm text-[var(--text-secondary)]">
                              {viewport.id}
                            </span>
                          </div>
                          <button
                            className="px-4 py-2 bg-[var(--control-bg)] rounded-[var(--radius-md)] hover:bg-[var(--control-bg-hover)] font-medium"
                            onClick={() =>
                              setOpenViewportId(isOpen ? null : viewport.id)
                            }
                          >
                            {isOpen ? "Hide" : "Show"} Content
                          </button>
                        </div>

                        <div className="mt-2">
                          <div className="mb-2 text-sm text-[var(--text-secondary)]">
                            {descendants.length} nodes
                          </div>

                          <pre className="text-sm whitespace-pre-wrap bg-[var(--control-bg)] p-4 rounded-[var(--radius-md)] max-h-[500px] overflow-auto border border-[var(--border-light)]">
                            {JSON.stringify(descendants, null, 2)}
                          </pre>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === "import" && (
                <div className="flex flex-col w-[300px] gap-4">
                  {importError && (
                    <div className="p-4 bg-[var(--error)]/10 border border-[var(--error)] text-[var(--error)] rounded-[var(--radius-md)]">
                      <p className="font-bold">Error</p>
                      <p>{importError}</p>
                    </div>
                  )}

                  <textarea
                    value={importValue}
                    onChange={(e) => setImportValue(e.target.value)}
                    placeholder="Paste your node tree JSON here..."
                    className="w-full h-64 p-2 bg-[var(--control-bg)] border border-[var(--control-border)] rounded-[var(--radius-md)] font-mono text-sm resize-none focus:border-[var(--border-focus)] focus:outline-none"
                  />

                  <button
                    className={`px-4 py-2 rounded-[var(--radius-md)] text-white ${
                      importValue.trim()
                        ? "bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)]"
                        : "bg-[var(--control-bg)] text-[var(--text-disabled)] cursor-not-allowed"
                    }`}
                    onClick={handleImport}
                    disabled={!importValue.trim()}
                  >
                    Import
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default ViewportDevTools;
