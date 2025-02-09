import React, { useEffect, useRef } from "react";
import { cn } from "@/providers/cn";

interface DropdownRootProps {
  children: React.ReactNode;
  className?: string;
}

export const DropdownRoot = ({
  children,
  className = "",
}: DropdownRootProps) => (
  <div className={cn("relative", className)}>{children}</div>
);

interface DropdownTriggerProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export const DropdownTrigger = ({
  children,
  onClick,
  className,
}: DropdownTriggerProps) => (
  <div
    className={className}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }}
  >
    {children}
  </div>
);

interface DropdownContentProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  align?: "left" | "right" | "center";
  className?: string;
}

export const DropdownContent = ({
  children,
  isOpen,
  onClose,
  align = "center",
  className = "",
}: DropdownContentProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("click", handleClick);
      document.addEventListener("contextmenu", handleClick);
    }

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const alignmentClasses = {
    left: "left-0",
    right: "right-0",
    center: "left-1/2 -translate-x-1/2",
  };

  const childrenWithClose = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && "onClick" in child.props) {
      return React.cloneElement(child, {
        onClick: () => {
          child.props.onClick?.();
          onClose();
        },
      });
    }
    return child;
  });

  return (
    <div
      ref={contentRef}
      className={cn(
        "absolute bottom-12",
        alignmentClasses[align],
        "w-56",
        "bg-[var(--bg-surface)]",
        "border border-[var(--border-light)]",
        "rounded-[var(--radius-md)]",
        "shadow-[var(--shadow-md)]",
        "py-2 px-1",
        "z-[9999]",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {childrenWithClose}
    </div>
  );
};

interface DropdownItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  shortcut?: string;
}

export const DropdownItem = ({
  children,
  onClick,
  className = "",
  disabled = false,
  shortcut,
}: DropdownItemProps) => (
  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick?.();
    }}
    disabled={disabled}
    className={cn(
      "w-full px-3 py-1.5 text-left text-sm",
      "text-[var(--text-primary)]",
      "hover:bg-[var(--bg-hover)]",
      "rounded-[var(--radius-sm)]",
      "mx-1",
      "flex items-center justify-between gap-2",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
      className
    )}
  >
    <span className="flex items-center gap-2">{children}</span>
    {shortcut && (
      <span className="text-[var(--text-secondary)] text-sm shrink-0">
        {shortcut}
      </span>
    )}
  </button>
);

export const DropdownSeparator = ({
  className = "",
}: {
  className?: string;
}) => (
  <div className={cn("h-px bg-[var(--border-light)] my-1 mx-2", className)} />
);

export {
  type DropdownRootProps,
  type DropdownTriggerProps,
  type DropdownContentProps,
  type DropdownItemProps,
};
