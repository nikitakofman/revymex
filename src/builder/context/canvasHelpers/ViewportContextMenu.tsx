import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBuilder } from "@/builder/context/builderState";
import { Plus, Edit, Eye, AlignHorizontalJustifyCenter } from "lucide-react";
import {
  useViewportContextMenu,
  contextMenuOps,
} from "../atoms/context-menu-store";

const ViewportContextMenu = () => {
  const { dragDisp, nodeDisp } = useBuilder();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState({
    left: 0,
    top: 0,
    opacity: 0,
    visibility: "hidden" as "hidden" | "visible",
  });

  // Use the subscription hook since we need to re-render when context menu changes
  const viewportContextMenu = useViewportContextMenu();

  // Using useLayoutEffect to position the menu before browser paint
  useLayoutEffect(() => {
    if (!viewportContextMenu || !menuRef.current || !viewportContextMenu.show) {
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
      if (!viewportContextMenu || !menuRef.current || !viewportContextMenu.show)
        return;

      // Initial position based on click
      let left = viewportContextMenu.position.x;
      let top = viewportContextMenu.position.y;

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
  }, [viewportContextMenu]);

  if (!viewportContextMenu?.show) return null;

  const menuItems = [
    {
      label: "Add Viewport",
      icon: Plus,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        contextMenuOps.hideViewportContextMenu();
        dragDisp.showViewportModal({
          x: viewportContextMenu.position.x,
          y: viewportContextMenu.position.y,
        });
      },
    },
    {
      label: "Edit Viewport",
      icon: Edit,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        contextMenuOps.hideViewportContextMenu();
        dragDisp.showEditViewportModal(viewportContextMenu.viewportId, {
          x: viewportContextMenu.position.x,
          y: viewportContextMenu.position.y,
        });
      },
    },
    {
      label: "Align Viewports",
      icon: AlignHorizontalJustifyCenter, // Import this from lucide-react
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        nodeDisp.alignViewports();
        contextMenuOps.hideViewportContextMenu();
      },
    },
  ];

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-transparent z-[999]"
        onClick={() => contextMenuOps.hideViewportContextMenu()}
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
        {menuItems.map((item) => (
          <div
            key={item.label}
            className="group flex items-center gap-3 mx-1.5 px-2 py-2 cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--accent)] transition-colors duration-150"
            onClick={item.onClick}
          >
            <span className="text-[var(--text-secondary)] group-hover:text-white">
              <item.icon className="w-3 h-3" />
            </span>

            <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-white flex-1">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </>,
    document.body
  );
};

export default ViewportContextMenu;
