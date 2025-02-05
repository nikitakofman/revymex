import { useBuilder } from "@/builder/context/builderState";
import { ChevronDown } from "lucide-react";
import { Label } from "./Label";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";

interface ToolSelectProps {
  label: string;
  name: string;
  value?: string;
  options: { label: string; value: string }[];
  disabled?: boolean;
}

export const ToolSelect = ({
  label,
  name,
  value,
  options,
  disabled = false,
}: ToolSelectProps) => {
  const { setNodeStyle } = useBuilder();

  const computedStyle = useComputedStyle({
    property: name,
    usePseudoElement: name.toLowerCase().startsWith("border"),
    parseValue: false,
    defaultValue: value || "",
  });

  const handleChange = (newValue: string) => {
    setNodeStyle({ [name]: newValue });
  };

  return (
    <div className="relative flex items-center justify-between">
      {label && <Label>{label}</Label>}

      <select
        value={computedStyle.mixed ? "mixed" : (computedStyle.value as string)}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className="h-7 pl-2 pr-6 text-xs appearance-none bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {computedStyle.mixed && (
          <option value="mixed" disabled>
            Mixed
          </option>
        )}
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
