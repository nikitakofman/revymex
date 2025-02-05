import React from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";

type ToolbarSegmentOption = {
  label?: string;
  value: string;
  icon?: React.ReactNode;
};

interface ToolbarSegmentedControlProps {
  /**
   * The CSS property you want to bind to, e.g. "flexDirection", "background",
   * "justifyContent", etc.
   */
  cssProperty: string;

  /**
   * If your property can be empty or invalid, set a default fallback value.
   */
  defaultValue?: string;

  /**
   * If you want to parse numeric/units (e.g., `margin: "10px"` -> { value: 10, unit: "px" }),
   * set `parseValue` to `true`. For something like `flexDirection`, leave it `false`.
   */
  parseValue?: boolean;

  /**
   * If your property is definitely a color (like `backgroundColor`), you can set
   * `isColor = true` to handle converting RGB to HEX internally.
   */
  isColor?: boolean;

  /**
   * The list of options to show in the segmented control.
   * Each option has a `value`, optional `label`, and optional `icon`.
   */
  options: ToolbarSegmentOption[];

  /**
   * The size of buttons – "sm", "md", or "lg" (you can expand this as needed).
   */
  size?: "sm" | "md" | "lg";
}

/**
 * A SegmentedControl that automatically reads & sets a given CSS property
 * across all selected nodes. If multiple nodes differ, it shows "mixed."
 */
export function ToolbarSegmentedControl({
  cssProperty,
  defaultValue = "",
  parseValue = false,
  isColor = false,
  options,
  size = "md",
}: ToolbarSegmentedControlProps) {
  const { setNodeStyle } = useBuilder();

  // 1) Get the computed style across selected elements
  const computedStyle = useComputedStyle({
    property: cssProperty,
    parseValue,
    defaultValue,
    isColor,
  });

  // 2) If multiple nodes differ for this property, show "mixed" as a placeholder
  const currentValue = computedStyle.mixed
    ? "mixed"
    : (computedStyle.value as string);

  // 3) When user clicks a segment button, update all selected nodes
  const handleSegmentClick = (newValue: string) => {
    if (newValue === "mixed") {
      // if user clicks "Mixed" itself, do nothing (or override with default)
      return;
    }
    // Overwrite the CSS property for all selected nodes
    setNodeStyle({ [cssProperty]: newValue }, undefined, true);
  };

  // 4) Optionally prepend a "Mixed" button if it’s truly mixed
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
