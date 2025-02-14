import React from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";

type ToolbarSegmentOption = {
  label?: string;
  value: string;
  icon?: React.ReactNode;
};

interface ToolbarSegmentedControlProps {
  cssProperty: string;
  defaultValue?: string;
  parseValue?: boolean;
  isColor?: boolean;
  options: ToolbarSegmentOption[];
  size?: "sm" | "md" | "lg";
  onChange?: (value: string) => void; // Added onChange prop
}

export function ToolbarSegmentedControl({
  cssProperty,
  defaultValue = "",
  parseValue = false,
  isColor = false,
  options,
  size = "md",
  onChange, // Added to props
}: ToolbarSegmentedControlProps) {
  const { setNodeStyle } = useBuilder();

  const computedStyle = useComputedStyle({
    property: cssProperty,
    parseValue,
    defaultValue,
    isColor,
  });

  const currentValue = computedStyle.mixed
    ? "mixed"
    : (computedStyle.value as string);

  const handleSegmentClick = (newValue: string) => {
    if (newValue === "mixed") return;

    setNodeStyle({ [cssProperty]: newValue }, undefined, true);
    onChange?.(newValue); // Call onChange if provided
  };

  const finalOptions = computedStyle.mixed
    ? [{ value: "mixed", label: "Mixed" }, ...options]
    : options;

  return (
    <div className="flex bg-[var(--control-bg)] rounded-md p-0.5">
      {finalOptions.map((option) => {
        const isActive = currentValue === option.value;
        return (
          <button
            key={option.value}
            onClick={() => handleSegmentClick(option.value)}
            className={`
              flex-1 flex items-center justify-center gap-2
              text-xs px-3
              ${size === "sm" ? "py-1" : size === "md" ? "py-1.5" : "py-2"}
              rounded transition-colors
              ${
                isActive
                  ? "bg-[var(--control-bg-active)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }
            `}
          >
            {option.icon}
            {option.label && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
