"use client";

import React, { useLayoutEffect, useState } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useTheme } from "next-themes";
import { Sun, Moon, PlayCircle } from "lucide-react";
import { PreviewModal } from "./PreviewRenderer";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { createPortal } from "react-dom";

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

export const ViewportDevTools: React.FC = () => {
  const { transform, setTransform, nodeState, nodeDisp, dragState, dragDisp } =
    useBuilder();
  const [showTree, setShowTree] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "view" | "perViewport" | "import" | "drag"
  >("view");

  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [showPreview, setShowPreview] = useState(false);

  const [openViewportId, setOpenViewportId] = useState<string | number | null>(
    null
  );

  if (!mounted) return null;

  const handleResetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
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

  const viewports = nodeState.nodes.filter((n) => n.isViewport);

  return createPortal(
    <>
      <div className="fixed resize  top-4 right-72 flex gap-2 z-[9999] p-2 bg-[var(--bg-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] border border-[var(--border-light)]">
        {dragState.dynamicModeNodeId && (
          <button
            onClick={() => {
              nodeDisp.resetDynamicNodePositions();
              dragDisp.setDynamicModeNodeId(null);
              nodeDisp.syncViewports(); // Re-sync viewports after restoring
            }}
          >
            Exit Dynamic Mode
          </button>
        )}
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
              setTransform({
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
              setTransform({ ...transform, x: Number(e.target.value) })
            }
            className="w-16 px-1 bg-[var(--control-bg-hover)] rounded-sm"
          />
          <span>X</span>
          <input
            type="number"
            value={Math.round(transform.y)}
            onChange={(e) =>
              setTransform({ ...transform, y: Number(e.target.value) })
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
        <button
          className="p-2 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
        <button
          className="px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
          onClick={() => setShowPreview(true)}
        >
          <PlayCircle className="w-4 h-4" />
        </button>
        {/* Just showing selectedIds count */}
        <button
          className={`px-3 py-1 rounded-[var(--radius-sm)] ${
            activeTab === "import"
              ? "bg-[var(--button-primary-bg)] text-white"
              : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
          }`}
        >
          {dragState.selectedIds.length}
        </button>
      </div>

      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        nodes={nodeState.nodes}
      />

      {/* Modal for Tree view / Import / Per-Viewport */}
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

            {/* Simple tabs: "View" (all), "Per Viewport", "Import" */}
            <div className="flex gap-2 mb-4">
              <button
                className={`px-3 py-1 rounded-[var(--radius-sm)] ${
                  activeTab === "view"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("view")}
              >
                All
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
                  activeTab === "import"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("drag")}
              >
                DregState
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              {activeTab === "view" && (
                <pre className="text-xs whitespace-pre-wrap bg-[var(--control-bg)] p-4 rounded-[var(--radius-md)]">
                  {JSON.stringify(nodeState.nodes, null, 2)}
                </pre>
              )}

              {activeTab === "drag" && (
                <pre className="text-xs whitespace-pre-wrap bg-[var(--control-bg)] p-4 rounded-[var(--radius-md)]">
                  {JSON.stringify(dragState, null, 2)}
                </pre>
              )}

              {activeTab === "perViewport" && (
                <div className="flex gap-4 min-w-[900px] min-h-[600px]">
                  {viewports.map((viewport) => {
                    const isOpen = openViewportId === viewport.id;
                    const descendants = getDescendants(
                      nodeState.nodes,
                      viewport.id
                    );

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
