import React from "react";
import { cva } from "class-variance-authority";
import { Check, ChevronDown } from "lucide-react";

// Base Container for Tool Sections
export const ToolContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full flex flex-col gap-4 p-3 text-[--text-primary]">
    {children}
  </div>
);

// Section Wrapper
export const ToolSection = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">{children}</div>
);

// Label Component
export const ToolLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs font-medium text-[--text-secondary] mb-1.5">
    {children}
  </div>
);

// Input Component
interface ToolInputProps {
  label?: string;
  value?: string | number;
  onChange?: (value: string) => void;
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const ToolInput = ({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  step,
  unit,
  placeholder,
  disabled = false,
}: ToolInputProps) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <ToolLabel>{label}</ToolLabel>}
    <div className="relative flex items-center">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full h-8 px-2
          bg-[--control-bg]
          border border-[--control-border]
          hover:border-[--control-border-hover]
          focus:border-[--border-focus]
          focus:ring-1 focus:ring-[--border-focus]
          rounded-[--radius-sm]
          text-sm
          disabled:opacity-50
          transition-colors
          outline-none
          ${unit ? "pr-8" : ""}
        `}
      />
      {unit && (
        <span className="absolute right-2 text-xs text-[--text-secondary]">
          {unit}
        </span>
      )}
    </div>
  </div>
);

// Button Component
interface ToolButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary";
  active?: boolean;
}

export const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  (
    { variant = "default", active = false, className, children, ...props },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-[--radius-sm] transition-colors disabled:opacity-50 focus:outline-none select-none";

    const variantStyles =
      variant === "primary"
        ? "bg-[--button-primary-bg] text-white border-none hover:bg-[--button-primary-hover]"
        : "bg-[--control-bg] border border-[--control-border] hover:bg-[--control-bg-hover] hover:border-[--control-border-hover] active:bg-[--control-bg-active]";

    const activeStyles = active
      ? "bg-[--control-bg-active] border-[--control-border-hover]"
      : "";

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles} ${activeStyles} ${
          className || ""
        }`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

// Button Group Component
export const ToolButtonGroup = ({
  children,
}: {
  children: React.ReactNode;
}) => <div className="flex gap-1">{children}</div>;

// Select Component
interface ToolSelectProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: { label: string; value: string }[];
  disabled?: boolean;
}

export const ToolSelect = ({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: ToolSelectProps) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <ToolLabel>{label}</ToolLabel>}
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={`
          w-full h-8
          pl-2 pr-8
          bg-[--control-bg]
          border border-[--control-border]
          hover:border-[--control-border-hover]
          focus:border-[--border-focus]
          focus:ring-1 focus:ring-[--border-focus]
          rounded-[--radius-sm]
          text-sm
          disabled:opacity-50
          transition-colors
          outline-none
          appearance-none
        `}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-secondary]" />
    </div>
  </div>
);

// Toggle Component
interface ToolToggleProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export const ToolToggle = ({
  label,
  checked = false,
  onChange,
  disabled = false,
}: ToolToggleProps) => (
  <div className="flex items-center justify-between gap-2">
    {label && <ToolLabel>{label}</ToolLabel>}
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      disabled={disabled}
      className={`
        relative
        w-9 h-5
        rounded-full
        transition-colors
        focus:outline-none
        ${
          checked
            ? "bg-[--accent]"
            : "bg-[--control-bg] border border-[--control-border]"
        }
        ${disabled ? "opacity-50" : ""}
      `}
    >
      <span
        className={`
          absolute
          w-3.5 h-3.5
          rounded-full
          transition-transform
          ${
            checked
              ? "translate-x-4 bg-white"
              : "translate-x-1 bg-[--text-secondary]"
          }
        `}
      />
    </button>
  </div>
);

// Checkbox Component
interface ToolCheckboxProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export const ToolCheckbox = ({
  label,
  checked = false,
  onChange,
  disabled = false,
}: ToolCheckboxProps) => (
  <label className="flex items-center gap-2">
    <div className="relative">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
      <div
        className={`
          w-4 h-4
          rounded-[--radius-sm]
          border
          transition-colors
          ${
            checked
              ? "bg-[--accent] border-[--accent]"
              : "bg-[--control-bg] border-[--control-border]"
          }
          ${disabled ? "opacity-50" : ""}
        `}
      >
        {checked && (
          <Check className="w-3 h-3 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        )}
      </div>
    </div>
    {label && <span className="text-sm">{label}</span>}
  </label>
);

// Tool Grid for alignment options
export const ToolGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-3 gap-1">{children}</div>
);

// Divider
export const ToolDivider = () => (
  <div className="h-px bg-[--border-light] my-2" />
);

// Collapsible Section
interface ToolCollapsibleProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const ToolCollapsible = ({
  label,
  children,
  defaultOpen = false,
}: ToolCollapsibleProps) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="border-b border-[--border-light]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-2 px-3 hover:bg-[--bg-hover]"
      >
        <span className="text-sm font-medium">{label}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && <div className="p-3">{children}</div>}
    </div>
  );
};
