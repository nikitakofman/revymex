import React, { useMemo, useState } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Play, X } from "lucide-react";
import { ResponsivePreview } from "./combineViewports";

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

        <div className="flex-1 overflow-auto p-4 bg-[var(--bg-canvas)]">
          <div
            className="mx-auto bg-white min-h-[100px] transition-all duration-300 overflow-hidden relative flex justify-center items-start"
            style={{ width: "100%" }}
          >
            <ResponsivePreview nodes={nodes} viewport={viewport} />
          </div>
        </div>
      </div>
    </div>
  );
};

interface PreviewRendererProps {
  nodes: Node[];
}

const PreviewRenderer: React.FC<PreviewRendererProps> = ({
  nodes,
  viewport,
}) => {
  const viewportNodes = useMemo(() => {
    // Find all viewports ordered by width descending
    const viewports = nodes
      .filter((n) => n.isViewport)
      .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0));

    // Find current viewport and the next larger one
    const targetViewport = viewports.find(
      (v) => (v.viewportWidth || 0) <= viewport
    );
    const baseViewport = viewports.find((v) => (v.viewportWidth || 0) === 1440);

    if (!targetViewport || !baseViewport) return [];

    // Get nodes from desktop viewport as base
    const baseNodes = getViewportNodes(nodes, baseViewport.id);

    if (targetViewport.id === baseViewport.id) {
      return baseNodes;
    }

    // Find nodes in current viewport to override styles
    const currentViewportNodes = getViewportNodes(nodes, targetViewport.id);

    // Map nodes by sharedId
    const nodesBySharedId = new Map<string, Node>();
    currentViewportNodes.forEach((node) => {
      if (node.sharedId) {
        nodesBySharedId.set(node.sharedId, node);
      }
    });

    // Merge styles from current viewport
    return baseNodes.map((node) => {
      const overrideNode = node.sharedId
        ? nodesBySharedId.get(node.sharedId)
        : undefined;
      if (!overrideNode) return node;

      return {
        ...node,
        style: {
          ...node.style,
          ...Object.keys(overrideNode.style).reduce((acc, key) => {
            if (overrideNode.independentStyles?.[key]) {
              acc[key] = overrideNode.style[key];
            }
            return acc;
          }, {} as Record<string, any>),
        },
      };
    });
  }, [nodes, viewport]);

  const renderNode = (node: Node) => {
    const style = {
      ...node.style,
      position: "relative",
    };

    switch (node.type) {
      case "frame":
        const children = viewportNodes.filter((n) => n.parentId === node.id);
        return (
          <div key={node.id} style={style} className="preview-frame">
            {children.map(renderNode)}
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
            src={node.style.src || "https://batiment.imag.fr/img/imag.png"}
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
      {viewportNodes
        .filter(
          (n) =>
            !n.parentId ||
            n.parentId ===
              nodes.find((v) => v.isViewport && v.viewportWidth === viewport)
                ?.id
        )
        .map(renderNode)}
    </div>
  );
};

function getViewportNodes(nodes: Node[], viewportId: string | number): Node[] {
  const result: Node[] = [];
  const queue = [viewportId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = nodes.filter((n) => n.parentId === currentId);
    result.push(...children);
    queue.push(...children.map((n) => n.id));
  }

  return result;
}
