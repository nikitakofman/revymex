import React from "react";
import { useBuilder, useBuilderDynamic } from "@/builder/context/builderState";
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
  onChange?: (value: string) => void;
  className?: string;
  currentValue?: string; // Added explicit currentValue prop
  columnLayout?: boolean; // New prop for column layout
}

export function ToolbarSegmentedControl({
  cssProperty,
  defaultValue = "",
  parseValue = false,
  isColor = false,
  options,
  size = "md",
  onChange,
  className = "",
  currentValue, // Use this if provided
  columnLayout = false, // Default to row layout
  noPadding,
}: ToolbarSegmentedControlProps) {
  const { setNodeStyle } = useBuilderDynamic();

  // Only use the computed style if currentValue isn't explicitly provided
  const computedStyle = !currentValue
    ? useComputedStyle({
        property: cssProperty,
        parseValue,
        defaultValue,
        isColor,
      })
    : null;

  // If currentValue is provided, use it; otherwise use the computed style
  const activeValue =
    currentValue ||
    (computedStyle?.mixed ? "mixed" : (computedStyle?.value as string));

  const handleSegmentClick = (newValue: string) => {
    if (newValue === "mixed") return;

    // Only call setNodeStyle if the property is a real CSS property
    // For custom tracking properties, don't call this
    if (
      !cssProperty.includes("fill-type") &&
      !cssProperty.includes("-custom")
    ) {
      setNodeStyle({ [cssProperty]: newValue }, undefined, true);
    }

    // Always call onChange if provided
    if (onChange) {
      onChange(newValue);
    }
  };

  const finalOptions = computedStyle?.mixed
    ? [{ value: "mixed", label: "Mixed" }, ...options]
    : options;

  return (
    <div
      className={`flex ${
        columnLayout ? "flex-col" : "flex-row"
      } bg-[var(--control-bg)] rounded-md ${!noPadding && "p-0.5"}`}
    >
      {finalOptions.map((option) => {
        const isActive = option.value === activeValue;
        return (
          <button
            key={option.value}
            onClick={() => handleSegmentClick(option.value)}
            className={`
              ${columnLayout ? "w-full" : "flex-1"} 
              flex items-center justify-center gap-2
              text-xs 
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
