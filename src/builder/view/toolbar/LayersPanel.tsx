import React, { useState, useRef, useEffect } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import {
  ChevronRight,
  ChevronDown,
  Frame,
  Box,
  Type,
  ImageIcon,
  Eye,
} from "lucide-react";
import { cn } from "@/providers/cn";

interface TreeNodeWithChildren extends Node {
  children: TreeNodeWithChildren[];
}

const buildTreeFromNodes = (nodes: Node[]) => {
  // First, filter out placeholder nodes
  const filteredNodes = nodes.filter((node) => node.type !== "placeholder");

  const nodeMap = new Map();
  const tree: Node[] = [];

  // Create map entries only for non-placeholder nodes
  filteredNodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // Build tree structure only with remaining nodes
  filteredNodes.forEach((node) => {
    const mappedNode = nodeMap.get(node.id);
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId);
      parent.children.push(mappedNode);
    } else {
      tree.push(mappedNode);
    }
  });

  return tree;
};

const getElementIcon = (type: string, isSelected: boolean) => {
  switch (type) {
    case "frame":
      return (
        <Frame
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } group-hover:text-white`}
        />
      );
    case "text":
      return (
        <Type
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } group-hover:text-white`}
        />
      );
    case "image":
      return (
        <ImageIcon
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } group-hover:text-white`}
        />
      );
    default:
      return (
        <Box
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } group-hover:text-white`}
        />
      );
  }
};

const TreeNodeComponent = ({
  node,
  level = 0,
}: {
  node: TreeNodeWithChildren;
  level?: number;
}) => {
  const { dragState, dragDisp } = useBuilder();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [nodeName, setNodeName] = useState(node.type);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const hasChildren = node.children?.length > 0;

  const isSelected = dragState.selectedIds.includes(node.id);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && dragState.selectedIds.length > 0) {
      dragDisp.addToSelection(node.id);
    } else {
      dragDisp.selectNode(node.id);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
  };

  return (
    <li className="relative select-none list-none">
      <div
        ref={nodeRef}
        onClick={handleSelect}
        className={cn(
          `group flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] transition-colors duration-150`,
          "cursor-pointer hover:bg-[var(--bg-hover)]",
          isSelected && "bg-[var(--accent)] text-white"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <button
          onClick={handleToggle}
          className={cn(
            "w-4 h-4 flex items-center justify-center",
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors",
            !hasChildren && "invisible"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        <span
          className={cn(
            "text-[var(--text-secondary)]",
            isSelected && "text-white"
          )}
        >
          {getElementIcon(node.type, isSelected)}
        </span>

        <span
          onDoubleClick={handleDoubleClick}
          className={cn(
            "text-xs font-medium truncate flex-1",
            "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]",
            isSelected && "text-white"
          )}
        >
          {nodeName}
        </span>

        <Eye
          className={cn(
            "w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity",
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            isSelected && "text-white"
          )}
        />
      </div>

      {hasChildren && isExpanded && (
        <ul className="mt-0.5 space-y-0.5 list-none">
          {node.children.map((child) => (
            <TreeNodeComponent key={child.id} node={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};

const LayersPanel = () => {
  const { nodeState } = useBuilder();
  const treeData = buildTreeFromNodes(nodeState.nodes);

  return (
    <div className="h-full bg-[var(--bg-surface)] pb-10 overflow-auto">
      <div className="p-2.5 space-y-2">
        {treeData.map((node) => (
          <TreeNodeComponent
            key={node.id}
            node={node as TreeNodeWithChildren}
          />
        ))}
      </div>
    </div>
  );
};

export default LayersPanel;
