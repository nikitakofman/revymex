import { createPortal } from "react-dom";
import { useBuilder } from "@/builder/context/builderState";

const menuItems = [
  {
    label: "Insert",
    shortcut: "⌘I",
    windowsShortcut: "Ctrl+I",
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      // TODO: Insert implementation
    },
  },
  {
    label: "Duplicate",
    shortcut: "⌘D",
    windowsShortcut: "Ctrl+D",
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      // TODO: Duplicate implementation
    },
  },
  {
    label: "Copy",
    shortcut: "⌘C",
    windowsShortcut: "Ctrl+C",
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      // TODO: Copy implementation
    },
  },
  {
    label: "Paste",
    shortcut: "⌘V",
    windowsShortcut: "Ctrl+V",
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      // TODO: Paste implementation
    },
  },
  {
    label: "Lock",
    shortcut: "⌘L",
    windowsShortcut: "Ctrl+L",
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      // TODO: Lock implementation
    },
  },
  {
    label: "Hide",
    shortcut: "⌘H",
    windowsShortcut: "Ctrl+H",
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      // TODO: Hide implementation
    },
  },
  {
    label: "Delete",
    shortcut: "⌫",
    windowsShortcut: "Del",
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      // TODO: Delete implementation
    },
  },
];

export const ContextMenu = () => {
  const { dragState, dragDisp } = useBuilder();
  const isWindows = navigator.platform.includes("Win");

  if (!dragState.contextMenu) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-transparent z-[999]"
        onClick={() => dragDisp.hideContextMenu()}
      />
      <div
        className="fixed bg-[var(--bg-surface)] shadow-[var(--shadow-lg)] rounded-[var(--radius-md)] py-2 z-[1000] min-w-[180px] border border-[var(--border-light)]"
        style={{
          left: dragState.contextMenu.x,
          top: dragState.contextMenu.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuItems.map((item) => (
          <div
            key={item.label}
            className="px-3 py-1.5 hover:bg-[var(--bg-hover)] cursor-pointer flex justify-between items-center text-[var(--text-primary)] text-sm"
            onClick={item.onClick}
          >
            <span>{item.label}</span>
            <span className="text-[var(--text-secondary)] ml-8">
              {isWindows ? item.windowsShortcut : item.shortcut}
            </span>
          </div>
        ))}
      </div>
    </>,
    document.body
  );
};
