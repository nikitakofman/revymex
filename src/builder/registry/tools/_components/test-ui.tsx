import { ChevronDown } from "lucide-react";
import React from "react";

export const ToolbarButton = ({ icon, onClick, active, children }) => {
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

export const ToolbarLabel = ({ children }) => {
  return (
    <span className="text-xs font-extrabold text-[var(--text-secondary)]">
      {children}
    </span>
  );
};

interface ToolSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

export const ToolSelect = ({ value, onChange, options }: ToolSelectProps) => {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 pl-2 pr-6 text-xs appearance-none bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)] pointer-events-none" />
    </div>
  );
};

export const ToolbarContainer = ({ children }) => {
  // Apply gap to direct children of the container
  return (
    <div className="flex flex-col bg-[var(--bg-toolbar)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]">
      {React.Children.map(children, (child, index) => (
        <div>{child}</div>
      ))}
    </div>
  );
};

export const ToolbarSection = ({ children, title }) => {
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

interface ToolbarButtonGroupProps {
  children: React.ReactNode;
  attached?: boolean;
}

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
