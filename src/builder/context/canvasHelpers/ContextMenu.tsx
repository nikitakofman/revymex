import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBuilder } from "@/builder/context/builderState";
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
} from "lucide-react";
import { useNodeActions } from "../hooks/useNodeActions";

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
  const { dragState, dragDisp, nodeState, nodeDisp } = useBuilder();
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

  // Using useLayoutEffect to position the menu before browser paint
  useLayoutEffect(() => {
    if (!dragState.contextMenu || !menuRef.current) {
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
      if (!dragState.contextMenu || !menuRef.current) return;

      // Initial position based on click
      let left = dragState.contextMenu.x;
      let top = dragState.contextMenu.y;

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
  }, [dragState.contextMenu]);

  // Check if menu is triggered from canvas
  const isCanvasMenu = dragState.contextMenu?.nodeId === null;

  // Check if something is copied and can be pasted
  const canPaste = true; // Replace with your actual clipboard check logic

  const getMenuItems = () => {
    if (isCanvasMenu) {
      return [
        {
          label: "Paste",
          icon: ClipboardPaste,
          shortcut: "⌘V",
          windowsShortcut: "Ctrl+V",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            handlePaste(dragState.contextMenu?.x, dragState.contextMenu?.y);
            dragDisp.hideContextMenu();
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
            dragDisp.hideContextMenu();
          },
        },
        Separator,
        {
          label: "Add Frame",
          icon: Plus,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            // Handle add frame at coordinates
            dragDisp.hideContextMenu();
          },
        },
        {
          label: "Add Text",
          icon: Plus,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            // Handle add text at coordinates
            dragDisp.hideContextMenu();
          },
        },
      ];
    }

    // Node context menu items
    const menuItems = [];

    // Get the right-clicked node
    const node = nodeState.nodes.find(
      (n) => n.id === dragState.contextMenu?.nodeId
    );

    // Add "Make Dynamic" option only for frame nodes
    if (node && node.type === "frame") {
      menuItems.push(
        {
          label: "Make Dynamic",
          icon: Zap,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            nodeDisp.updateNode(node.id, { isDynamic: true });
            nodeDisp.updateNodeDynamicStatus(node.id);
            dragDisp.hideContextMenu();
          },
        },
        Separator
      );
    }

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
          dragDisp.hideContextMenu();
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
          dragDisp.hideContextMenu();
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
          dragDisp.hideContextMenu();
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
          dragDisp.hideContextMenu();
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
          dragDisp.hideContextMenu();
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
          dragDisp.hideContextMenu();
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
          dragDisp.hideContextMenu();
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
          dragDisp.hideContextMenu();
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
          // Use the nodesToLock array from before
          const nodesToLock =
            dragState.selectedIds.length > 0
              ? dragState.selectedIds
              : [dragState.contextMenu?.nodeId].filter(Boolean);

          nodeDisp.toggleNodeLock(nodesToLock);
          dragDisp.hideContextMenu();
        },
      },
      {
        label: "Hide",
        icon: Eye,
        shortcut: "⌘H",
        windowsShortcut: "Ctrl+H",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          // Handle hide
          dragDisp.hideContextMenu();
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
          dragDisp.hideContextMenu();
        },
      }
    );

    return menuItems;
  };

  if (!dragState.contextMenu) return null;

  const menuItems = getMenuItems();

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-transparent z-[999]"
        onClick={() => dragDisp.hideContextMenu()}
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
