// ToolbarButton.tsx
import React from "react";

function ToolbarButton({
  children,
  onClick,
  onMouseDown,
  className,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  // Ensure we always prevent default to maintain editor selection
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Critical line: prevents losing editor focus
    if (onMouseDown) onMouseDown(e); // Call parent handler if provided
  };

  return (
    <div
      onClick={onClick}
      onMouseDown={handleMouseDown} // Use our handler that always prevents default
      className={`h-7 w-full flex items-center justify-center text-xs appearance-none bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </div>
  );
}

export default ToolbarButton;
