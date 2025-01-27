import React from "react";
import { ChevronDown } from "lucide-react";
import { ToolInput } from "./ToolInput";

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

interface DimensionInputProps {
  label: string;
  value: string | number;
  type?: "width" | "height";
  onChange?: (value: string, unit: string) => void;
}

export const DimensionInput = ({
  label,
  value,
  type = "width",
  onChange,
}: DimensionInputProps) => {
  const [sizeType, setSizeType] = React.useState("fixed");
  const [localValue, setLocalValue] = React.useState(() => {
    const val = typeof value === "number" ? value : parseFloat(value);
    return isNaN(val) ? 0 : val;
  });

  const sizeOptions = [
    { label: "Fixed", value: "fixed" },
    { label: "Relative", value: "relative" },
    { label: "Fit", value: "fit" },
  ];

  const handleSizeTypeChange = (newType: string) => {
    setSizeType(newType);
    // Convert value when switching between fixed and relative
    if (newType === "relative" && sizeType === "fixed") {
      setLocalValue(100); // Default to 100% when switching to relative
    } else if (newType === "fixed" && sizeType === "relative") {
      setLocalValue(0); // Default to 0px when switching to fixed
    }
    onChange?.(localValue.toString(), newType === "relative" ? "%" : "px");
  };

  const handleValueChange = (newValue: string) => {
    const val = parseFloat(newValue);
    if (!isNaN(val)) {
      setLocalValue(val);
      onChange?.(val.toString(), sizeType === "relative" ? "%" : "px");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-secondary)] w-12">{label}</span>
      <div className="flex-1">
        {sizeType !== "fit" && (
          <ToolInput
            type="number"
            value={localValue}
            onChange={(e) => handleValueChange(e.target.value)}
            min={0}
            step={sizeType === "relative" ? 1 : 1}
            unit={sizeType === "relative" ? "%" : "px"}
          />
        )}
      </div>
      <ToolSelect
        value={sizeType}
        onChange={handleSizeTypeChange}
        options={sizeOptions}
      />
    </div>
  );
};
