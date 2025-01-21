import React, { useState } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Play, X } from "lucide-react";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  nodes,
}) => {
  const [viewport, setViewport] = useState(1440);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-surface)] w-full h-full max-w-7xl max-h-[90vh] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] flex flex-col border border-[var(--border-light)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Play className="w-4 h-4" />
            <h2 className="font-medium">Preview</h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="px-3 py-1.5 bg-[var(--control-bg)] border border-[var(--control-border)] text-[var(--text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--control-bg-hover)] focus:border-[var(--border-focus)] outline-none"
              value={viewport}
              onChange={(e) => setViewport(Number(e.target.value))}
            >
              <option value={1440}>Desktop (1440px)</option>
              <option value={768}>Tablet (768px)</option>
              <option value={375}>Mobile (375px)</option>
            </select>

            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-[var(--radius-md)] text-[var(--text-secondary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto p-4 bg-[var(--bg-canvas)]">
          <div
            className="mx-auto bg-white shadow-[var(--shadow-md)] transition-all duration-300 overflow-hidden"
            style={{ width: viewport }}
          >
            <PreviewRenderer nodes={nodes} viewport={viewport} />
          </div>
        </div>
      </div>
    </div>
  );
};

interface PreviewRendererProps {
  nodes: Node[];
}

const PreviewRenderer: React.FC<PreviewRendererProps> = ({ nodes }) => {
  const renderNode = (node: Node) => {
    // Convert editor node to preview component
    const style = {
      ...node.style,
      position: node.inViewport ? "relative" : "absolute",
    };

    switch (node.type) {
      case "frame":
        return (
          <div key={node.id} style={style} className="preview-frame">
            {node.children?.map(renderNode)}
          </div>
        );

      case "text":
        return (
          <div key={node.id} style={style} className="preview-text">
            {node.text || "Text"}
          </div>
        );

      case "image":
        return (
          <img
            key={node.id}
            src={node.src}
            alt="Preview"
            style={style}
            className="preview-image"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="preview-container relative">
      {nodes.filter((node) => node.inViewport).map(renderNode)}
    </div>
  );
};
