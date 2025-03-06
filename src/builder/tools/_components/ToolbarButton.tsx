import React from "react";

function ToolbarButton({ children }) {
  return (
    <div className="h-7 w-full flex items-center justify-center text-xs appearance-none bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {children}
    </div>
  );
}

export default ToolbarButton;
