import React, { useEffect, useState } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { Label } from "./ToolbarAtoms";
import { Check, X } from "lucide-react";

interface ToolbarSwitchProps {
  cssProperty: string;
  label?: string;
  onValue: string;
  offValue: string;
  defaultValue?: string;
  parseValue?: boolean;
  isColor?: boolean;
  onChange?: (value: string) => void;
  className?: string;
  currentValue?: string;
}

export function ToolbarSwitch({
  cssProperty,
  label,
  onValue,
  offValue,
  defaultValue = "",
  parseValue = false,
  isColor = false,
  onChange,
  className = "",
  currentValue,
}: ToolbarSwitchProps) {
  const { setNodeStyle } = useBuilder();
  const [internalValue, setInternalValue] = useState<string | null>(null);

  // Only use the computed style if currentValue isn't explicitly provided
  const computedStyle = useComputedStyle({
    property: cssProperty,
    parseValue,
    defaultValue,
    isColor,
  });

  // If currentValue is provided, use it; otherwise use the computed style
  const activeValue =
    currentValue ||
    internalValue ||
    (computedStyle?.mixed ? "mixed" : (computedStyle?.value as string));

  // Update internal value when computed style changes
  useEffect(() => {
    if (!currentValue && !computedStyle?.mixed) {
      setInternalValue(computedStyle?.value as string);
    }
  }, [computedStyle, currentValue]);

  const isOn = activeValue === onValue;
  const isMixed = computedStyle?.mixed;

  const handleToggle = () => {
    if (isMixed) return;

    // Explicitly check if we're toggling ON or OFF
    const newValue = isOn ? offValue : onValue;

    // Update internal state immediately for responsive UI
    setInternalValue(newValue);

    // Only call setNodeStyle if the property is a real CSS property
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

  return (
    <div
      className={`flex items-center justify-between ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {label && <Label>{label}</Label>}

      <button
        onClick={handleToggle}
        disabled={isMixed}
        className={`
          relative inline-flex h-5 w-12 flex-shrink-0 cursor-pointer rounded-full 
          border-2 border-transparent transition-colors duration-200 ease-in-out 
          focus:outline-none 
          ${
            isMixed
              ? "bg-[var(--control-border)] cursor-not-allowed"
              : isOn
              ? "bg-[var(--control-border)] bg-opacity-20" /* Light green background when on */
              : "bg-[var(--control-border)]"
          }
        `}
        type="button"
        role="switch"
        aria-checked={isOn}
      >
        {/* Thumb/Handle with icons inside */}
        <span
          className={`
            pointer-events-none inline-flex items-center justify-center h-4 w-4 
            transform rounded-full shadow ring-0 transition duration-200 ease-in-out
            ${isOn ? "bg-[var(--accent)]" : "bg-white"}
            ${
              isMixed
                ? "translate-x-4"
                : isOn
                ? "translate-x-7"
                : "translate-x-0"
            }
          `}
        >
          {/* Show X when off, Check when on */}
          {isOn ? (
            <Check className="h-3 w-3 text-white" />
          ) : (
            <X className="h-3 w-3 text-gray-500" />
          )}
        </span>
      </button>
    </div>
  );
}
