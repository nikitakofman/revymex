"use client";

import React, {
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useBuilderRefs } from "@/builder/context/builderState";
import { useTheme } from "next-themes";
import { Sun, Moon, PlayCircle, Copy } from "lucide-react";
import { createPortal } from "react-dom";
import { useGetSelectedIds } from "../context/atoms/select-store";
import {
  canvasOps,
  useTransform,
} from "../context/atoms/canvas-interaction-store";
import { useNodeHistory } from "../context/hooks/useHistory";
import {
  NodeId,
  nodeStore,
  nodeIdsAtom,
  nodeBasicsAtom,
  nodeStyleAtom,
  nodeFlagsAtom,
  nodeParentAtom,
  nodeSharedInfoAtom,
  nodeDynamicInfoAtom,
  nodeVariantInfoAtom,
  nodeSyncFlagsAtom,
  nodeDynamicStateAtom,
  getCurrentNodes,
} from "../context/atoms/node-store";
import {
  useRootNodes,
  childrenMapAtom,
  parentMapAtom,
  hierarchyStore,
} from "../context/atoms/node-store/hierarchy-store";
import { pushNodes } from "../context/atoms/node-store/operations/global-operations";

interface Operation {
  method: string;
  timestamp: number;
  args: any[];
  options?: any;
}

// Function to get a comprehensive view of a node from Jotai
function getDetailedNode(nodeId: NodeId) {
  const basics = nodeStore.get(nodeBasicsAtom(nodeId));
  const style = nodeStore.get(nodeStyleAtom(nodeId));
  const flags = nodeStore.get(nodeFlagsAtom(nodeId));
  const parentId = nodeStore.get(nodeParentAtom(nodeId));
  const sharedInfo = nodeStore.get(nodeSharedInfoAtom(nodeId));
  const dynamicInfo = nodeStore.get(nodeDynamicInfoAtom(nodeId));
  const variantInfo = nodeStore.get(nodeVariantInfoAtom(nodeId));
  const syncFlags = nodeStore.get(nodeSyncFlagsAtom(nodeId));
  const dynamicState = nodeStore.get(nodeDynamicStateAtom(nodeId));

  // Get children from hierarchy store
  const childrenMap = hierarchyStore.get(childrenMapAtom);
  const children = childrenMap.get(nodeId) || [];

  return {
    id: basics.id,
    type: basics.type,
    customName: basics.customName,
    style,
    parentId,
    children,
    sharedId: sharedInfo.sharedId,
    // Dynamic info
    dynamicViewportId: dynamicInfo.dynamicViewportId,
    dynamicFamilyId: dynamicInfo.dynamicFamilyId,
    dynamicParentId: dynamicInfo.dynamicParentId,
    dynamicConnections: dynamicInfo.dynamicConnections,
    dynamicPosition: dynamicInfo.dynamicPosition,
    originalParentId: dynamicInfo.originalParentId,
    originalState: dynamicInfo.originalState,
    // Variant info
    variantParentId: variantInfo.variantParentId,
    variantInfo: variantInfo.variantInfo,
    variantResponsiveId: variantInfo.variantResponsiveId,
    // Flags
    isViewport: flags.isViewport,
    viewportWidth: flags.viewportWidth,
    viewportName: flags.viewportName,
    isVariant: flags.isVariant,
    isDynamic: flags.isDynamic,
    isLocked: flags.isLocked,
    isAbsoluteInFrame: flags.isAbsoluteInFrame,
    inViewport: flags.inViewport,
    // Sync flags
    syncFlags: {
      independentStyles: syncFlags.independentStyles,
      unsyncFromParentViewport: syncFlags.unsyncFromParentViewport,
      variantIndependentSync: syncFlags.variantIndependentSync,
      lowerSyncProps: syncFlags.lowerSyncProps,
    },
    // Dynamic state
    dynamicState,
  };
}

// Function to get all nodes from the Jotai store
function getAllNodesFromJotai() {
  // Get all node IDs from the Jotai store
  const nodeIds = nodeStore.get(nodeIdsAtom);

  // Create detailed nodes for each ID
  return nodeIds.map((id) => getDetailedNode(id));
}

// Function to get nodes grouped by viewport
function getNodesGroupedByViewport() {
  const allNodes = getAllNodesFromJotai();
  const viewports = allNodes.filter((node) => node.isViewport);

  // Create a map of viewport ID to nodes in that viewport
  const nodesByViewport = new Map();

  // Initialize map with empty arrays for each viewport
  viewports.forEach((viewport) => {
    nodesByViewport.set(viewport.id, []);
  });

  // Helper function to find viewport for a node
  const findViewport = (nodeId: NodeId): NodeId | null => {
    const parentMap = hierarchyStore.get(parentMapAtom);
    let current = nodeId;

    while (current) {
      const node = allNodes.find((n) => n.id === current);
      if (node?.isViewport) {
        return current;
      }

      const parentId = parentMap.get(current);
      if (!parentId) break;
      current = parentId;
    }

    return null;
  };

  // Add each node to its viewport's array
  allNodes.forEach((node) => {
    if (!node.isViewport) {
      const viewportId = findViewport(node.id);
      if (viewportId && nodesByViewport.has(viewportId)) {
        nodesByViewport.get(viewportId).push(node);
      }
    }
  });

  return {
    viewports,
    nodesByViewport,
  };
}

function getDescendants(nodes: any[], rootId: string | number): any[] {
  const result: any[] = [];
  const queue = [rootId];

  // Get the children map from hierarchy store
  const childrenMap = hierarchyStore.get(childrenMapAtom);

  while (queue.length) {
    const current = queue.shift()!;
    const children = childrenMap.get(current) || [];

    for (const childId of children) {
      const childNode = nodes.find((n) => n.id === childId);
      if (childNode && childNode.type !== "placeholder") {
        result.push(childNode);
        queue.push(childId);
      }
    }
  }
  return result;
}

const OperationsList: React.FC<{
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
          <h3 className="font-semibold">Operations</h3>
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

// Component to display hierarchy store information
const HierarchyStoreView: React.FC = () => {
  const rootNodes = useRootNodes();

  // Get hierarchy data directly from the stores
  const childrenMap = hierarchyStore.get(childrenMapAtom);
  const parentMap = hierarchyStore.get(parentMapAtom);

  // Create presentable data objects
  const childrenMapData = Array.from(childrenMap.entries()).map(
    ([parentId, children]) => ({
      parentId: parentId || "null", // Replace null with "null" for display
      children,
    })
  );

  const parentMapData = Array.from(parentMap.entries()).map(
    ([childId, parentId]) => ({
      childId,
      parentId: parentId || "null", // Replace null with "null" for display
    })
  );

  return (
    <div className="flex flex-col">
      <h3 className="font-semibold mb-2">Hierarchy Store</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Root Nodes</h4>
          <pre className="text-xs p-2 bg-[var(--control-bg)] rounded-[var(--radius-sm)] max-h-[200px] overflow-auto">
            {JSON.stringify(rootNodes, null, 2)}
          </pre>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Parent Map (Sample)</h4>
          <pre className="text-xs p-2 bg-[var(--control-bg)] rounded-[var(--radius-sm)] max-h-[200px] overflow-auto">
            {JSON.stringify(parentMapData.slice(0, 10), null, 2)}
            {parentMapData.length > 10 && "... (more entries)"}
          </pre>
        </div>

        <div className="col-span-2">
          <h4 className="text-sm font-medium mb-2">Children Map (Sample)</h4>
          <pre className="text-xs p-2 bg-[var(--control-bg)] rounded-[var(--radius-sm)] max-h-[200px] overflow-auto">
            {JSON.stringify(childrenMapData.slice(0, 10), null, 2)}
            {childrenMapData.length > 10 && "... (more entries)"}
          </pre>
        </div>
      </div>
    </div>
  );
};

// Component to show shared nodes and their sync status
const SharedNodesView: React.FC = () => {
  const [sharedGroups, setSharedGroups] = useState<Record<string, any[]>>({});

  useEffect(() => {
    // Get all nodes
    const allNodes = getAllNodesFromJotai();

    // Group nodes by sharedId
    const groups: Record<string, any[]> = {};

    allNodes.forEach((node) => {
      if (node.sharedId) {
        if (!groups[node.sharedId]) {
          groups[node.sharedId] = [];
        }
        groups[node.sharedId].push(node);
      }
    });

    // Filter to only include groups with more than one node
    const filteredGroups: Record<string, any[]> = {};
    Object.entries(groups).forEach(([sharedId, nodes]) => {
      if (nodes.length > 1) {
        filteredGroups[sharedId] = nodes;
      }
    });

    setSharedGroups(filteredGroups);
  }, []);

  return (
    <div className="flex flex-col">
      <h3 className="font-semibold mb-4">Shared Nodes Groups</h3>

      {Object.keys(sharedGroups).length === 0 ? (
        <p className="text-[var(--text-secondary)]">No shared nodes found</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(sharedGroups).map(([sharedId, nodes]) => (
            <div
              key={sharedId}
              className="border border-[var(--border-light)] rounded-[var(--radius-md)] p-4"
            >
              <h4 className="font-medium mb-2">
                Shared ID: {sharedId} ({nodes.length} nodes)
              </h4>

              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--control-bg)]">
                    <th className="p-2 text-left">Node ID</th>
                    <th className="p-2 text-left">Viewport</th>
                    <th className="p-2 text-left">Position</th>
                    <th className="p-2 text-left">Unsync Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => {
                    // Find node's viewport
                    const viewportNode = getDetailedNode(node.parentId);
                    const viewportName =
                      viewportNode?.viewportName ||
                      viewportNode?.viewportWidth ||
                      "Unknown";

                    return (
                      <tr
                        key={node.id}
                        className="border-t border-[var(--border-light)]"
                      >
                        <td className="p-2">{node.id}</td>
                        <td className="p-2">{viewportName}</td>
                        <td className="p-2">
                          {node.style.position || "static"}
                        </td>
                        <td className="p-2">
                          {node.syncFlags?.unsyncFromParentViewport
                            ? Object.keys(
                                node.syncFlags.unsyncFromParentViewport
                              ).join(", ")
                            : "None"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ViewportDevTools: React.FC = () => {
  // Get operations through useNodeHistory
  const { operations = [], clearOperations = () => {} } =
    useNodeHistory() || {};

  // Get Jotai node state
  const [jotaiNodes, setJotaiNodes] = useState(() => getAllNodesFromJotai());
  const [hierarchyData, setHierarchyData] = useState<{
    viewports: any[];
    nodesByViewport: Map<any, any[]>;
  }>(() => getNodesGroupedByViewport());

  // Update Jotai node state periodically
  useEffect(() => {
    const intervalId = setInterval(() => {
      setJotaiNodes(getAllNodesFromJotai());
      setHierarchyData(getNodesGroupedByViewport());
    }, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, []);

  const transform = useTransform();

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
    "jotai" | "perViewport" | "import" | "hierarchy" | "operations" | "shared"
  >("jotai");

  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [copyStatus, setCopyStatus] = useState("");

  const [openViewportId, setOpenViewportId] = useState<string | number | null>(
    null
  );

  // Get detailed node info for the selected node
  const selectedNodeDetails =
    selectedIdsList.length > 0 ? getDetailedNode(selectedIdsList[0]) : null;

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
      pushNodes(nodes);
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

  // Get viewports from hierarchyData instead of filtering jotaiNodes
  const { viewports } = hierarchyData;

  return createPortal(
    <>
      <div className="fixed resize bottom-14 scale-75 right-[190px] flex gap-2 p-2 bg-[var(--bg-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] border border-[var(--border-light)]">
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

        {/* Copy JSON button */}
        <button
          className="flex items-center gap-1 px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
          onClick={handleCopyNodesJson}
          title="Copy entire node tree as JSON"
        >
          <Copy className="w-4 h-4" />
          Copy JSON
        </button>

        {/* Copy ID button */}
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
                  activeTab === "jotai"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("jotai")}
              >
                Full Node State
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
                  activeTab === "hierarchy"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("hierarchy")}
              >
                Hierarchy Store
              </button>
              <button
                className={`px-3 py-1 rounded-[var(--radius-sm)] ${
                  activeTab === "shared"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("shared")}
              >
                Shared Nodes
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
                  activeTab === "operations"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("operations")}
              >
                Operations
              </button>
            </div>

            {/* Selected node details display */}
            {selectedNodeDetails && (
              <div className="mb-4 p-3 bg-[var(--control-bg)] rounded-[var(--radius-md)] border border-[var(--border-light)]">
                <h3 className="font-semibold mb-2">Selected Node Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <strong>ID:</strong> {selectedNodeDetails.id}
                  </div>
                  <div>
                    <strong>Type:</strong> {selectedNodeDetails.type}
                  </div>
                  <div>
                    <strong>Name:</strong>{" "}
                    {selectedNodeDetails.customName || "-"}
                  </div>
                  <div>
                    <strong>Shared ID:</strong>{" "}
                    {selectedNodeDetails.sharedId || "-"}
                  </div>
                  <div>
                    <strong>Parent ID:</strong>{" "}
                    {selectedNodeDetails.parentId || "null"}
                  </div>
                  <div>
                    <strong>Children:</strong>{" "}
                    {selectedNodeDetails.children?.length || 0}
                  </div>
                  <div>
                    <strong>Position:</strong>{" "}
                    {selectedNodeDetails.style.position || "static"}
                  </div>
                  <div>
                    <strong>Flags:</strong>{" "}
                    {Object.entries(selectedNodeDetails)
                      .filter(
                        ([key, value]) =>
                          typeof value === "boolean" && value === true
                      )
                      .map(([key]) => key)
                      .join(", ") || "-"}
                  </div>
                </div>
                <div className="mt-2">
                  <strong>Unsync Flags:</strong>{" "}
                  {selectedNodeDetails.syncFlags?.unsyncFromParentViewport
                    ? Object.keys(
                        selectedNodeDetails.syncFlags.unsyncFromParentViewport
                      ).join(", ")
                    : "None"}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {activeTab === "jotai" && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {jotaiNodes.length} nodes (Jotai)
                    </span>
                    <button
                      className="px-2 py-1 bg-[var(--control-bg)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
                      onClick={() => setJotaiNodes(getAllNodesFromJotai())}
                    >
                      Refresh
                    </button>
                  </div>
                  <textarea
                    className="text-xs w-full whitespace-pre-wrap bg-[var(--control-bg)] p-4 rounded-[var(--radius-md)]"
                    readOnly
                    value={JSON.stringify(jotaiNodes, null, 2)}
                  ></textarea>
                </div>
              )}

              {activeTab === "operations" && (
                <OperationsList
                  operations={operations}
                  onClear={clearOperations}
                />
              )}

              {activeTab === "hierarchy" && <HierarchyStoreView />}

              {activeTab === "shared" && <SharedNodesView />}

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
