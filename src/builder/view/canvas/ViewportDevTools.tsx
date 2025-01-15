import React, { useState } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export const ViewportDevTools: React.FC = () => {
  const { transform, setTransform, nodeState, nodeDisp } = useBuilder();
  const [showTree, setShowTree] = useState(false);
  const [activeTab, setActiveTab] = useState<"view" | "import">("view");
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

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

  return (
    <>
      {/* Fixed devtools UI in top-right corner */}
      <div className="fixed top-4 right-72 flex gap-2 z-50 p-2 bg-[var(--bg-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] border border-[var(--border-light)]">
        <button
          className="px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
          onClick={handleResetView}
        >
          Reset View
        </button>
        <div className="px-3 py-1 bg-[var(--control-bg)] text-[var(--text-primary)] rounded-[var(--radius-sm)]">
          {Math.round(transform.scale * 100)}%
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
      </div>

      {/* Modal for Tree view and Import */}
      {showTree && (
        <div className="fixed inset-0 flex z-50 items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] p-4 rounded-[var(--radius-lg)] max-w-[80vw] max-h-[80vh] overflow-hidden flex flex-col shadow-[var(--shadow-lg)] border border-[var(--border-light)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Node Tree</h2>
              <button
                className="px-2 py-1 bg-[var(--control-bg)] rounded-[var(--radius-sm)] hover:bg-[var(--control-bg-hover)]"
                onClick={handleToggleTree}
              >
                Close
              </button>
            </div>

            {/* Simple tabs */}
            <div className="flex gap-2 mb-4">
              <button
                className={`px-3 py-1 rounded-[var(--radius-sm)] ${
                  activeTab === "view"
                    ? "bg-[var(--button-primary-bg)] text-white"
                    : "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
                }`}
                onClick={() => setActiveTab("view")}
              >
                View
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
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              {activeTab === "view" ? (
                <pre className="text-xs whitespace-pre-wrap bg-[var(--control-bg)] p-4 rounded-[var(--radius-md)]">
                  {JSON.stringify(nodeState.nodes, null, 2)}
                </pre>
              ) : (
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
    </>
  );
};
