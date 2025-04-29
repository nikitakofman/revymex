import React, { useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useBuilder, useBuilderDynamic } from "@/builder/context/builderState";
import {
  Copy,
  Trash2,
  Eye,
  Lock,
  Plus,
  ClipboardPaste,
  ArrowUp,
  ArrowDown,
  MoveDiagonal,
  Combine,
  CornerUpLeft,
  Zap,
  Settings,
} from "lucide-react";
import { useNodeActions } from "../hooks/useNodeActions";
import { useGetSelectedIds } from "../atoms/select-store";
import {
  useNodeContextMenu,
  contextMenuOps,
} from "../atoms/context-menu-store";
import { modalOps } from "../atoms/modal-store";

const Separator = () => (
  <div className="h-[1px] bg-[var(--border-light)] mx-2 my-1" />
);

const MenuItemComponent = ({
  item,
  isWindows,
}: {
  item: {
    label: string;
    icon: any;
    shortcut?: string;
    windowsShortcut?: string;
    onClick: (e: React.MouseEvent) => void;
    disabled?: boolean;
  };
  isWindows: boolean;
}) => {
  const Icon = item.icon;

  return (
    <div
      className={`group flex items-center gap-3 mx-1.5 px-2 py-2 cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--accent)] transition-colors duration-150 ${
        item.disabled ? "opacity-50 pointer-events-none" : ""
      }`}
      onClick={item.onClick}
    >
      <span className="text-[var(--text-secondary)] group-hover:text-white">
        <Icon className="w-3 h-3" />
      </span>

      <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-white flex-1">
        {item.label}
      </span>

      {item.shortcut && (
        <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-white ml-8">
          {isWindows ? item.windowsShortcut : item.shortcut}
        </span>
      )}
    </div>
  );
};

export const ContextMenu = () => {
  const { nodeState, nodeDisp, setNodeStyle } = useBuilderDynamic();
  const { handleDelete, handleDuplicate, handleCopy, handlePaste } =
    useNodeActions();
  const isWindows = navigator.platform.includes("Win");
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState({
    left: 0,
    top: 0,
    opacity: 0,
    visibility: "hidden" as "hidden" | "visible",
  });

  // Use the subscription hook since we need to re-render when context menu changes
  const nodeContextMenu = useNodeContextMenu();

  // Imperative getter for selected IDs (used in event handlers)
  const getSelectedIds = useGetSelectedIds();

  // Using useLayoutEffect to position the menu before browser paint
  useLayoutEffect(() => {
    if (!nodeContextMenu || !menuRef.current) {
      setMenuStyle((prev) => ({ ...prev, visibility: "hidden", opacity: 0 }));
      return;
    }

    // Set initial position off-screen but visible to measure dimensions
    setMenuStyle({
      left: -9999,
      top: -9999,
      opacity: 0,
      visibility: "visible",
    });

    // Use requestAnimationFrame to calculate position after menu is rendered but before paint
    requestAnimationFrame(() => {
      if (!nodeContextMenu || !menuRef.current) return;

      // Initial position based on click
      let left = nodeContextMenu.x;
      let top = nodeContextMenu.y;

      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Menu dimensions (now accurately measured)
      const menuWidth = menuRef.current.offsetWidth;
      const menuHeight = menuRef.current.offsetHeight;

      // Adjust if menu would go off right edge
      if (left + menuWidth > viewportWidth) {
        left = viewportWidth - menuWidth - 16; // 16px padding from edge
      }

      // Adjust if menu would go off bottom edge
      if (top + menuHeight > viewportHeight) {
        top = viewportHeight - menuHeight - 16; // 16px padding from edge
      }

      // Ensure the menu doesn't go off the left or top edge
      left = Math.max(16, left);
      top = Math.max(16, top);

      // Update to final position and make visible
      setMenuStyle({
        left,
        top,
        opacity: 1,
        visibility: "visible",
      });
    });
  }, [nodeContextMenu]);

  // Check if menu is triggered from canvas
  const isCanvasMenu = nodeContextMenu?.nodeId === null;

  // Check if something is copied and can be pasted
  const canPaste = true; // Replace with your actual clipboard check logic

  const isViewportHeaderMenu = nodeContextMenu?.isViewportHeader;

  const getMenuItems = useCallback(() => {
    if (isViewportHeaderMenu) {
      const node = nodeState.nodes.find(
        (n) => n.id === nodeContextMenu?.nodeId
      );

      return [
        {
          label: "Add Viewport",
          icon: Plus,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            contextMenuOps.hideContextMenu();
            modalOps.showViewportModal({
              x: nodeContextMenu?.x,
              y: nodeContextMenu?.y,
            });
          },
        },
        {
          label: "Edit Viewport",
          icon: Settings,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            contextMenuOps.hideContextMenu();
            modalOps.showEditViewportModal(nodeContextMenu?.nodeId, {
              x: nodeContextMenu?.x,
              y: nodeContextMenu?.y,
            });
          },
        },
        {
          label: node?.isLocked ? "Unlock" : "Lock",
          icon: Lock,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            nodeDisp.toggleNodeLock([node.id]);
            contextMenuOps.hideContextMenu();
          },
        },
        {
          label: "Delete",
          icon: Trash2,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            handleDelete();
            contextMenuOps.hideContextMenu();
          },
        },
      ];
    }

    if (isCanvasMenu) {
      return [
        {
          label: "Paste",
          icon: ClipboardPaste,
          shortcut: "⌘V",
          windowsShortcut: "Ctrl+V",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            handlePaste(nodeContextMenu?.x, nodeContextMenu?.y);
            contextMenuOps.hideContextMenu();
          },
          disabled: !canPaste,
        },
        {
          label: "Select All",
          icon: Combine,
          shortcut: "⌘A",
          windowsShortcut: "Ctrl+A",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            // Handle select all
            contextMenuOps.hideContextMenu();
          },
        },
        Separator,
        {
          label: "Add Frame",
          icon: Plus,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            // Handle add frame at coordinates
            contextMenuOps.hideContextMenu();
          },
        },
        {
          label: "Add Text",
          icon: Plus,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            // Handle add text at coordinates
            contextMenuOps.hideContextMenu();
          },
        },
      ];
    }

    // Node context menu items
    const menuItems = [];

    // Get the right-clicked node
    const node = nodeState.nodes.find((n) => n.id === nodeContextMenu?.nodeId);

    // Add "Make Dynamic" option only for frame nodes
    if (node) {
      menuItems.push(
        {
          label: "Make Dynamic",
          icon: Zap,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            nodeDisp.updateNode(node.id, { isDynamic: true });
            nodeDisp.updateNodeDynamicStatus(node.id);
            contextMenuOps.hideContextMenu();
          },
        },
        Separator
      );
    }

    // Get the current selected ids at the time of menu creation
    const selectedIds = getSelectedIds();

    // Add standard node menu items
    menuItems.push(
      {
        label: "Cut",
        icon: CornerUpLeft,
        shortcut: "⌘X",
        windowsShortcut: "Ctrl+X",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleCopy();
          handleDelete();
          contextMenuOps.hideContextMenu();
        },
      },
      {
        label: "Copy",
        icon: Copy,
        shortcut: "⌘C",
        windowsShortcut: "Ctrl+C",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleCopy();
          contextMenuOps.hideContextMenu();
        },
      },
      {
        label: "Paste",
        icon: ClipboardPaste,
        shortcut: "⌘V",
        windowsShortcut: "Ctrl+V",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handlePaste();
          contextMenuOps.hideContextMenu();
        },
        disabled: !canPaste,
      },
      {
        label: "Duplicate",
        icon: Copy,
        shortcut: "⌘D",
        windowsShortcut: "Ctrl+D",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleDuplicate(true);
          contextMenuOps.hideContextMenu();
        },
      },
      Separator,
      {
        label: "Bring Forward",
        icon: ArrowUp,
        shortcut: "⌘]",
        windowsShortcut: "Ctrl+]",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          // Handle bring forward
          contextMenuOps.hideContextMenu();
        },
      },
      {
        label: "Send Backward",
        icon: ArrowDown,
        shortcut: "⌘[",
        windowsShortcut: "Ctrl+[",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          // Handle send backward
          contextMenuOps.hideContextMenu();
        },
      },
      {
        label: "Bring to Front",
        icon: MoveDiagonal,
        shortcut: "⌘⇧]",
        windowsShortcut: "Ctrl+Shift+]",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          // Handle bring to front
          contextMenuOps.hideContextMenu();
        },
      },
      {
        label: "Send to Back",
        icon: MoveDiagonal,
        shortcut: "⌘⇧[",
        windowsShortcut: "Ctrl+Shift+[",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          // Handle send to back
          contextMenuOps.hideContextMenu();
        },
      },
      Separator,
      {
        label: node?.isLocked ? "Unlock" : "Lock",
        icon: Lock,
        shortcut: "⌘L",
        windowsShortcut: "Ctrl+L",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          // Use the nodesToLock array from before, but get current selection when the handler runs
          const currentSelectedIds = getSelectedIds();
          const nodesToLock =
            currentSelectedIds.length > 0
              ? currentSelectedIds
              : [nodeContextMenu?.nodeId].filter(Boolean);

          nodeDisp.toggleNodeLock(nodesToLock);
          contextMenuOps.hideContextMenu();
        },
      },
      {
        label: "Hide",
        icon: Eye,
        shortcut: "⌘I",
        windowsShortcut: "Ctrl+H",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          // Handle hide
          contextMenuOps.hideContextMenu();
          setNodeStyle(
            {
              display: "none",
            },
            undefined,
            true
          );
        },
      },
      {
        label: "Delete",
        icon: Trash2,
        shortcut: "⌫",
        windowsShortcut: "Del",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleDelete();
          contextMenuOps.hideContextMenu();
        },
      }
    );

    return menuItems;
  }, [
    isViewportHeaderMenu,
    isCanvasMenu,
    nodeState.nodes,
    nodeContextMenu,
    handleDelete,
    handleCopy,
    handlePaste,
    handleDuplicate,
    nodeDisp,
    setNodeStyle,
    getSelectedIds,
  ]);

  // Don't render anything if there's no context menu
  if (!nodeContextMenu?.show) return null;

  const menuItems = getMenuItems();

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-transparent z-[999]"
        onClick={() => contextMenuOps.hideContextMenu()}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={menuRef}
        className="fixed bg-[var(--bg-surface)] shadow-[var(--shadow-lg)] rounded-[var(--radius-md)] py-2 z-[1000] min-w-[200px] border border-[var(--border-light)] space-y-1"
        style={{
          ...menuStyle,
          transition: "opacity 0.1s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuItems.map((item, index) =>
          item === Separator ? (
            <Separator key={`sep-${index}`} />
          ) : (
            <MenuItemComponent
              key={item.label}
              item={item}
              isWindows={isWindows}
            />
          )
        )}
      </div>
    </>,
    document.body
  );
};

export default ContextMenu;
