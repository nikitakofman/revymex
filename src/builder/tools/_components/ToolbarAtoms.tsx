import React from "react";

interface ToolbarButtonProps {
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  children?: React.ReactNode;
}

interface ToolbarLabelProps {
  children: React.ReactNode;
}

interface ToolbarContainerProps {
  children: React.ReactNode;
}

interface ToolbarSectionProps {
  children: React.ReactNode;
  title?: string;
}

interface ButtonOption {
  label?: string;
  value: string;
  icon?: React.ReactNode;
}

interface ToolbarSegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: ButtonOption[];
  size?: "sm" | "md";
}

interface ToolbarButtonGroupProps {
  children: React.ReactNode;
  attached?: boolean;
}

interface LabelProps {
  children: React.ReactNode;
}

export function Label({ children }: LabelProps) {
  return (
    <span className="text-xs text-[var(--text-secondary)]">{children}</span>
  );
}

export const ToolbarButton = ({
  icon,
  onClick,
  active,
  children,
}: ToolbarButtonProps) => {
  return (
    <button
      className={`
        flex items-center text-xs justify-center
        w-auto px-2 h-8
        rounded-[var(--radius-lg)]
        transition-colors duration-150
        hover:bg-[var(--control-bg-hover)]
        ${active ? "bg-[var(--grid-line)]" : "bg-[var(--control-bg)]"}
      `}
      onClick={onClick}
    >
      <span className="text-[var(--text-primary)]">
        {icon}
        {children}
      </span>
    </button>
  );
};

export const ToolbarLabel = ({ children }: ToolbarLabelProps) => {
  return (
    <span className="text-xs font-extrabold text-[var(--text-secondary)]">
      {children}
    </span>
  );
};

export const ToolbarContainer = ({ children }: ToolbarContainerProps) => {
  return (
    <div className="flex flex-col bg-[var(--bg-toolbar)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]">
      {React.Children.map(children, (child) => (
        <div>{child}</div>
      ))}
    </div>
  );
};

export const ToolbarSection = ({ children, title }: ToolbarSectionProps) => {
  return (
    <div className="px-3">
      {title && (
        <div className="mb-2">
          <ToolbarLabel>{title}</ToolbarLabel>
        </div>
      )}
      <div className="flex flex-col py-1 gap-3 px-3">
        {React.Children.map(children, (child, index) => (
          <div className={index !== 0 ? "mt-1" : ""}>{child}</div>
        ))}
      </div>
    </div>
  );
};

export const ToolbarDivider = () => {
  return <div className="h-px bg-[var(--border-light)] mx-3 my-4" />;
};

export const ToolbarSegmentedControl = ({
  value,
  onChange,
  options,
  size = "md",
}: ToolbarSegmentedControlProps) => {
  return (
    <div className="flex bg-[var(--control-bg)] rounded-md p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            flex-1 flex items-center justify-center gap-2
            text-xs px-3 
            ${size === "sm" ? "py-1" : "py-1.5"}
            rounded transition-colors
            ${
              value === option.value
                ? "bg-[var(--control-bg-active)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }
          `}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
};

export const ToolbarButtonGroup = ({
  children,
  attached = false,
}: ToolbarButtonGroupProps) => {
  return (
    <div
      className={`flex items-center ${
        attached ? "bg-[var(--control-bg)] rounded-md p-0.5" : ""
      }`}
    >
      {React.Children.map(children, (child, index) => (
        <div className={index !== 0 ? "ml-1" : ""}>{child}</div>
      ))}
    </div>
  );
};
