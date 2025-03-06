import React, { useRef, useState, useEffect, useCallback } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";

import { ToolSelect } from "./ToolSelect";
import { Label } from "./ToolbarAtoms";
import { convertToNewUnit } from "@/builder/context/utils";

interface ToolInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  step?: number;
  unit?: string;
  label?: string;
  min?: number;
  max?: number;
  showUnit?: boolean;
  onUnitChange?: (unit: string) => void;
  customValue?: string | number;
  onCustomChange?: (value: string | number, unit?: string) => void;
  showSlider?: boolean;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
}

const getParentLayoutMode = (
  element: HTMLElement
): "row" | "column" | "grid" | null => {
  const parent = element.parentElement;
  if (!parent) return null;

  const parentStyle = window.getComputedStyle(parent);

  if (parentStyle.display === "grid") return "grid";
  if (parentStyle.display === "flex") {
    const mode = parentStyle.flexDirection === "row" ? "row" : "column";
    return mode;
  }
  return null;
};

const updateFillStyles = (
  element: HTMLElement,
  propertyName: string,
  setNodeStyle: any
) => {
  const parentLayout = getParentLayoutMode(element);
  const isWidthProperty = propertyName === "width";
  const isHeightProperty = propertyName === "height";

  let styles: Record<string, string> = {};

  if (parentLayout === "grid") {
    styles[propertyName] = "100%";
  } else if (parentLayout === "row" || parentLayout === "column") {
    if (parentLayout === "row") {
      if (isWidthProperty) {
        styles = { width: "1px", flex: "1 0 0px" };
      } else {
        styles = { height: "100%" };
      }
    } else {
      // column
      if (isHeightProperty) {
        styles = { height: "1px", flex: "1 0 0px" };
      } else {
        styles = { width: "100%" };
      }
    }
  }

  setNodeStyle(styles, undefined, true);
};

// Function to parse box-shadow value
const parseBoxShadow = (shadowString) => {
  if (!shadowString || shadowString === "none") {
    return {
      offsetX: 0,
      offsetY: 4,
      blur: 8,
      spread: 0,
      color: "rgba(0, 0, 0, 0.2)",
      inset: false,
    };
  }

  // Check for inset
  const inset = shadowString.includes("inset");

  // Extract values with regex
  const pattern =
    /(?:inset\s+)?(-?\d+)(?:px)?\s+(-?\d+)(?:px)?\s+(-?\d+)(?:px)?\s+(-?\d+)(?:px)?\s+(rgba?\([^)]+\)|#[0-9A-Fa-f]+|[a-z]+)/;
  const match = shadowString.match(pattern);

  if (match) {
    return {
      offsetX: parseInt(match[1], 10),
      offsetY: parseInt(match[2], 10),
      blur: parseInt(match[3], 10),
      spread: parseInt(match[4], 10),
      color: match[5],
      inset: inset,
    };
  }

  return {
    offsetX: 0,
    offsetY: 4,
    blur: 8,
    spread: 0,
    color: "rgba(0, 0, 0, 0.2)",
    inset: false,
  };
};

// Function to create box-shadow string
const createBoxShadow = (shadowParts) => {
  const insetText = shadowParts.inset ? "inset " : "";
  return `${insetText}${shadowParts.offsetX}px ${shadowParts.offsetY}px ${shadowParts.blur}px ${shadowParts.spread}px ${shadowParts.color}`;
};

export function ToolInput({
  step = 1,
  value,
  unit = "px",
  label,
  min = -10000,
  max = 10000,
  showUnit = false,
  onUnitChange,
  type,
  customValue,
  onCustomChange,
  showSlider = false,
  sliderMin = 0,
  sliderMax = 100,
  sliderStep = 1,
  ...props
}: ToolInputProps) {
  const { setNodeStyle, dragState, nodeState, startRecording, stopRecording } =
    useBuilder();
  const [localValue, setLocalValue] = useState<string | number>(
    value || customValue || "0"
  );
  const [localUnit, setLocalUnit] = useState(unit);
  const [isMixed, setIsMixed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startYRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const currentValueRef = useRef<number>(0);
  const speedMultiplierRef = useRef(1);
  const isDraggingRef = useRef(false);
  const isInternalUpdate = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);

  const isGridInput = label === "Columns" || label === "Rows";
  const isCustomMode = typeof onCustomChange !== "undefined";

  // Check if this is a box-shadow property
  const isBoxShadowProp = props.name?.startsWith("boxShadow.");
  const boxShadowPart = isBoxShadowProp ? props.name?.split(".")[1] : null;

  const hasParent = useCallback(() => {
    if (!dragState.selectedIds.length) return false;
    const selectedNode = nodeState.nodes.find(
      (node) => node.id === dragState.selectedIds[0]
    );
    return !!selectedNode?.parentId;
  }, [dragState.selectedIds, nodeState.nodes]);

  const unitOptions = [
    { label: "Fix", value: "px" },
    { label: "Fill", value: "fill", disabled: !hasParent() },
    { label: "%", value: "%", disabled: !hasParent() },
    { label: "Fit", value: "auto", disabled: !hasParent() },
  ];

  const getComputedStyleValue = useCallback(() => {
    if (isCustomMode) return null;
    if (!dragState.selectedIds.length) return null;

    // Handle boxShadow properties specially
    if (isBoxShadowProp) {
      const computedValues = dragState.selectedIds
        .map((id) => {
          const element = document.querySelector(
            `[data-node-id="${id}"]`
          ) as HTMLElement;
          if (!element) return null;

          const computedStyle = window.getComputedStyle(element);
          const boxShadow = computedStyle.boxShadow;

          // Parse the box-shadow
          const shadowParts = parseBoxShadow(boxShadow);

          // Return the specific part we're looking for
          if (boxShadowPart === "offsetX")
            return { value: shadowParts.offsetX, unit: "px" };
          if (boxShadowPart === "offsetY")
            return { value: shadowParts.offsetY, unit: "px" };
          if (boxShadowPart === "blur")
            return { value: shadowParts.blur, unit: "px" };
          if (boxShadowPart === "spread")
            return { value: shadowParts.spread, unit: "px" };
          if (boxShadowPart === "color") return { value: shadowParts.color };
          if (boxShadowPart === "inset")
            return { value: shadowParts.inset ? 1 : 0 };

          return null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      if (computedValues.length === 0) return null;

      const firstValue = computedValues[0];
      const allSameValue = computedValues.every(
        (v) => v.value === firstValue.value
      );
      const allSameUnit = computedValues.every(
        (v) => !v.unit || !firstValue.unit || v.unit === firstValue.unit
      );

      if (!allSameValue || !allSameUnit) {
        return { mixed: true, unit: allSameUnit ? firstValue.unit : null };
      }

      return firstValue;
    }

    // Regular property handling (non-boxShadow)
    const computedValues = dragState.selectedIds
      .map((id) => {
        const element = document.querySelector(
          `[data-node-id="${id}"]`
        ) as HTMLElement;
        if (!element) return null;

        const computedStyle = window.getComputedStyle(element);

        if (isGridInput) {
          const property =
            label === "Columns" ? "gridTemplateColumns" : "gridTemplateRows";
          const gridTemplate = computedStyle[property];

          if (gridTemplate && gridTemplate !== "none") {
            const count = gridTemplate.trim().split(/\s+/).length;
            return {
              value: count,
              unit: "fr",
            };
          }
          return {
            value: 3,
            unit: "fr",
          };
        }

        const propertyName = props.name;
        if (!propertyName) return null;

        const cssValue = element.style[propertyName as any];
        if (!cssValue || cssValue === "none") return null;

        if (cssValue === "auto") {
          return {
            value: 0,
            unit: "auto",
          };
        }

        // Check if element has flex: 1 0 0px and this dimension is 1px to determine if it's in fill mode
        const flexValue = element.style.flex;
        const parentLayout = getParentLayoutMode(element);
        const isWidthProperty = propertyName === "width";
        const isHeightProperty = propertyName === "height";

        if (flexValue === "1 0 0px" && cssValue === "1px") {
          if (
            (parentLayout === "row" && isWidthProperty) ||
            (parentLayout === "column" && isHeightProperty)
          ) {
            return {
              value: 1,
              unit: "fill",
            };
          }
        }

        const match = cssValue.match(/^([-\d.]+)(\D+)?$/);
        if (!match) return null;

        return {
          value: parseFloat(match[1]),
          unit: match[2] || "px",
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (computedValues.length === 0) return null;

    const firstValue = computedValues[0];
    const allSameValue = computedValues.every(
      (v) => Math.abs(v.value - firstValue.value) < 0.1
    );
    const allSameUnit = computedValues.every((v) => v.unit === firstValue.unit);

    if (!allSameValue || !allSameUnit) {
      return { mixed: true, unit: allSameUnit ? firstValue.unit : null };
    }

    return firstValue;
  }, [
    dragState.selectedIds,
    props.name,
    label,
    isGridInput,
    isCustomMode,
    isBoxShadowProp,
    boxShadowPart,
  ]);

  useEffect(() => {
    if (!isCustomMode && !isDraggingRef.current && !isInternalUpdate.current) {
      const computed = getComputedStyleValue();
      if (!computed) {
        const defaultValue = isGridInput ? "3" : "0";
        if (localValue !== defaultValue) {
          setLocalValue(defaultValue);
          setIsMixed(false);
        }
        return;
      }

      if ("mixed" in computed) {
        setIsMixed(true);
      } else {
        // For regular numeric values
        let newValue = computed.value;
        if (typeof newValue === "number") {
          newValue = Math.round(newValue).toString();
        } else {
          newValue = String(newValue);
        }
        setIsMixed(false);
        setLocalValue(newValue);
        if (computed.unit) {
          setLocalUnit(computed.unit);
        }
        currentValueRef.current = Number(computed.value);
      }
    }
  }, [
    dragState.selectedIds,
    nodeState.nodes,
    isCustomMode,
    getComputedStyleValue,
  ]);

  useEffect(() => {
    if (isCustomMode && customValue !== undefined) {
      setLocalValue(customValue.toString());
      currentValueRef.current = Number(customValue);
    }
  }, [customValue, isCustomMode]);

  const getStepForUnit = (unit: string) => {
    if (unit === "%") return 1;
    if (unit === "em" || unit === "rem") return 0.1;
    if (unit === "vw" || unit === "vh") return 1;
    return step;
  };

  // Special handling for box-shadow updates
  const updateBoxShadow = (newValue) => {
    if (!dragState.selectedIds.length) return;

    // Get the current box-shadow
    const element = document.querySelector(
      `[data-node-id="${dragState.selectedIds[0]}"]`
    ) as HTMLElement;

    if (!element) return;

    const computedStyle = window.getComputedStyle(element);
    const currentShadow = computedStyle.boxShadow;

    // Parse the current shadow
    const shadowParts = parseBoxShadow(currentShadow);

    // Update the specific part
    if (boxShadowPart === "offsetX")
      shadowParts.offsetX = parseInt(newValue, 10);
    if (boxShadowPart === "offsetY")
      shadowParts.offsetY = parseInt(newValue, 10);
    if (boxShadowPart === "blur") shadowParts.blur = parseInt(newValue, 10);
    if (boxShadowPart === "spread") shadowParts.spread = parseInt(newValue, 10);
    if (boxShadowPart === "color") shadowParts.color = newValue;
    if (boxShadowPart === "inset") shadowParts.inset = Boolean(newValue);

    // Create the new shadow string
    const newShadow = createBoxShadow(shadowParts);

    // Apply the new shadow
    setNodeStyle({ boxShadow: newShadow }, undefined, true);
  };

  const updateValue = (
    increment: boolean,
    multiplier: number = 1,
    isDragging: boolean = false
  ) => {
    const stepValue = isDragging
      ? getStepForUnit(localUnit) * multiplier
      : getStepForUnit(localUnit);
    let newValue =
      currentValueRef.current + (increment ? stepValue : -stepValue);

    newValue = Math.max(min, Math.min(max, newValue));
    currentValueRef.current = newValue;

    isInternalUpdate.current = true;
    setLocalValue(Math.round(newValue).toString());
    isInternalUpdate.current = false;

    if (isCustomMode) {
      onCustomChange?.(newValue, localUnit);
      return;
    }

    // Handle box-shadow specially
    if (isBoxShadowProp) {
      updateBoxShadow(newValue);
      return;
    }

    if (isGridInput) {
      const property =
        label === "Columns" ? "gridTemplateColumns" : "gridTemplateRows";
      setNodeStyle(
        {
          display: "grid",
          [property]: `repeat(${Math.round(newValue)}, 1fr)`,
        },
        undefined,
        true
      );
    } else if (localUnit === "fill") {
      const element = document.querySelector(
        `[data-node-id="${dragState.selectedIds[0]}"]`
      ) as HTMLElement;
      if (element) {
        updateFillStyles(element, props.name || "", setNodeStyle);
      }
    } else {
      setNodeStyle(
        {
          [props.name || ""]: `${newValue}${localUnit}`,
        },
        undefined,
        true
      );
    }
  };

  const handleUnitChange = (newUnit: string) => {
    if (isMixed && !isCustomMode) return;

    const elements = dragState.selectedIds
      .map(
        (id) => document.querySelector(`[data-node-id="${id}"]`) as HTMLElement
      )
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    if (newUnit === "fill") {
      setLocalUnit(newUnit);
      setLocalValue("1");
      updateFillStyles(elements[0], props.name || "", setNodeStyle);
    } else {
      // Handle conversion from fill or other units
      const currentValue = parseFloat(localValue.toString()) || 0;
      const convertedValue = convertToNewUnit(
        currentValue,
        localUnit,
        newUnit,
        props.name || "",
        elements[0]
      );

      setLocalUnit(newUnit);
      setLocalValue(Math.round(convertedValue).toString());

      if (localUnit === "fill") {
        // Reset flex property when changing from fill to another unit
        setNodeStyle(
          {
            [props.name || ""]: `${convertedValue}${newUnit}`,
            flex: "0 0 auto", // Reset flex to default
          },
          undefined,
          true
        );
      } else {
        setNodeStyle(
          {
            [props.name || ""]: `${convertedValue}${newUnit}`,
          },
          undefined,
          true
        );
      }
    }

    onUnitChange?.(newUnit);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const inputValue = e.target.value;
    const parsedValue = parseFloat(inputValue) || 0;
    const clampedValue = Math.max(min, Math.min(max, parsedValue));

    isInternalUpdate.current = true;
    setLocalValue(clampedValue.toString());
    currentValueRef.current = clampedValue;
    isInternalUpdate.current = false;

    if (isCustomMode) {
      onCustomChange?.(clampedValue, localUnit);
      return;
    }

    // Handle box-shadow specially
    if (isBoxShadowProp) {
      updateBoxShadow(clampedValue);
      return;
    }

    if (localUnit === "fill") {
      const element = document.querySelector(
        `[data-node-id="${dragState.selectedIds[0]}"]`
      ) as HTMLElement;
      if (element) {
        updateFillStyles(element, props.name || "", setNodeStyle);
      }
    } else {
      setNodeStyle(
        {
          [props.name || ""]: `${clampedValue}${localUnit}`,
        },
        undefined,
        true
      );
    }
  };

  const handleSliderChange = (newValue: number[]) => {
    const sliderValue = newValue[0];

    isInternalUpdate.current = true;
    setLocalValue(sliderValue.toString());
    currentValueRef.current = sliderValue;
    isInternalUpdate.current = false;

    if (isCustomMode) {
      onCustomChange?.(sliderValue, localUnit);
      return;
    }

    // Handle box-shadow specially
    if (isBoxShadowProp) {
      updateBoxShadow(sliderValue);
      return;
    }

    if (isGridInput) {
      const property =
        label === "Columns" ? "gridTemplateColumns" : "gridTemplateRows";
      setNodeStyle(
        {
          display: "grid",
          [property]: `repeat(${Math.round(sliderValue)}, 1fr)`,
        },
        undefined,
        true
      );
    } else if (localUnit === "fill") {
      const element = document.querySelector(
        `[data-node-id="${dragState.selectedIds[0]}"]`
      ) as HTMLElement;
      if (element) {
        updateFillStyles(element, props.name || "", setNodeStyle);
      }
    } else {
      setNodeStyle(
        {
          [props.name || ""]: `${sliderValue}${localUnit}`,
        },
        undefined,
        true
      );
    }
  };

  const startIncrement = (direction: "up" | "down", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sessionId = startRecording();

    currentValueRef.current =
      parseFloat(localValue.toString()) || (isGridInput ? 3 : 0);
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;

    updateValue(direction === "up", 1, false);

    holdTimerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        if (!isDraggingRef.current) {
          updateValue(direction === "up", 1, false);
        }
      }, 50);
    }, 200);

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const currentY = e.clientY;
      const deltaY = currentY - lastYRef.current;
      const totalDelta = Math.abs(currentY - startYRef.current);

      if (Math.abs(deltaY) > 0) {
        isDraggingRef.current = true;
        speedMultiplierRef.current = Math.pow(1 + totalDelta / 100, 2);
        updateValue(deltaY < 0, speedMultiplierRef.current, true);
      }

      lastYRef.current = currentY;
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      isDraggingRef.current = false;
      stopRecording(sessionId);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleFocus = (e: React.FocusEvent) => {
    e.stopPropagation();
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  // Convert the string value to a number for the slider
  const sliderValue = isMixed
    ? [(sliderMin + sliderMax) / 2]
    : [Number(localValue)];

  return (
    <div
      className="flex items-center justify-between gap-2"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center  justify-between gap-2 flex-1">
        {label && <Label>{label}</Label>}

        {/* shadcn Slider component - positioned between label and input */}
        {showSlider && !isMixed && (
          <div className="justif mx-1">
            <Slider
              value={sliderValue}
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              onValueChange={handleSliderChange}
              className="w-[60px]"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative group">
          {isMixed && !isCustomMode ? (
            <input
              {...props}
              type="text"
              value="Mixed"
              disabled
              className="w-[60px] h-7 px-1.5 text-xs
                bg-[var(--grid-line)] border border-[var(--control-border)] 
                text-[var(--text-secondary)]
                rounded-[var(--radius-lg)] focus:outline-none"
            />
          ) : (
            <input
              {...props}
              type="number"
              value={localValue}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onMouseDown={(e) => e.stopPropagation()}
              min={min}
              max={max}
              className={`w-[60px] h-7 px-1.5 text-xs 
                bg-[var(--grid-line)] border border-[var(--control-border)] 
                hover:border-[var(--control-border-hover)] 
                focus:border-[var(--border-focus)] 
                text-[var(--text-primary)] rounded-[var(--radius-lg)] 
                focus:outline-none transition-colors 
                [appearance:textfield] 
                [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none
                ${isFocused ? "border-[var(--border-focus)]" : ""}`}
            />
          )}
          {(!isMixed || isCustomMode) && type === "number" && (
            <div
              className={`absolute right-1 inset-y-0 w-3 ${
                isFocused ? "flex" : "hidden group-hover:flex"
              } flex-col`}
            >
              <button
                onMouseDown={(e) => startIncrement("up", e)}
                className="flex-1 flex items-center justify-center"
                type="button"
              >
                <ChevronUp className="w-2.5 h-2.5 text-[var(--text-secondary)]" />
              </button>
              <button
                onMouseDown={(e) => startIncrement("down", e)}
                className="flex-1 flex items-center justify-center"
                type="button"
              >
                <ChevronDown className="w-2.5 h-2.5 text-[var(--text-secondary)]" />
              </button>
            </div>
          )}
        </div>
        {showUnit && (
          <ToolSelect
            value={localUnit}
            onChange={handleUnitChange}
            options={unitOptions}
            disabled={isMixed && !isCustomMode}
          />
        )}
      </div>
    </div>
  );
}
