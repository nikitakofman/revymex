import React, { useRef, useState, useEffect, useCallback } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { ChevronUp, ChevronDown } from "lucide-react";
import { ToolSelect } from "./test-ui";
import { Label } from "./Label";

interface ToolInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  step?: number;
  unit?: string;
  label?: string;
  min?: number;
  max?: number;
  showUnit?: boolean;
  onUnitChange?: (unit: string) => void;
}

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
  ...props
}: ToolInputProps) {
  const { setNodeStyle, dragState, nodeState } = useBuilder();
  const [localValue, setLocalValue] = useState<string | number>(value || "0");
  const [localUnit, setLocalUnit] = useState(unit);
  const [isMixed, setIsMixed] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startYRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const currentValueRef = useRef<number>(0);
  const speedMultiplierRef = useRef(1);
  const isDraggingRef = useRef(false);
  const isInternalUpdate = useRef(false);

  const unitOptions = [
    { label: "px", value: "px" },
    { label: "%", value: "%" },
    { label: "em", value: "em" },
    { label: "rem", value: "rem" },
    { label: "vw", value: "vw" },
    { label: "vh", value: "vh" },
  ];

  // Function to get computed style value based on property name
  const getComputedStyleValue = useCallback(() => {
    if (!dragState.selectedIds.length) return null;

    const computedValues = dragState.selectedIds
      .map((id) => {
        const element = document.querySelector(
          `[data-node-id="${id}"]`
        ) as HTMLElement;
        if (!element) return null;

        // For border properties, get the computed style from ::after
        const isBorderProperty = props.name?.startsWith("border");
        const computedStyle = isBorderProperty
          ? window.getComputedStyle(element, "::after")
          : window.getComputedStyle(element);

        const propertyName = props.name;
        if (!propertyName) return null;

        // Handle shorthand properties
        if (propertyName === "padding" || propertyName === "margin") {
          const top = parseFloat(computedStyle[`${propertyName}Top`]);
          const right = parseFloat(computedStyle[`${propertyName}Right`]);
          const bottom = parseFloat(computedStyle[`${propertyName}Bottom`]);
          const left = parseFloat(computedStyle[`${propertyName}Left`]);

          if (top === right && right === bottom && bottom === left) {
            return {
              value: top,
              unit:
                computedStyle[`${propertyName}Top`]
                  .replace(/[\d.]/g, "")
                  .trim() || "px",
            };
          }
          return null;
        }

        const value = computedStyle[propertyName as any];
        if (!value || value === "none") return null;

        const match = value.match(/^([-\d.]+)(\D+)?$/);
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

    if (!allSameValue) {
      return { mixed: true, unit: allSameUnit ? firstValue.unit : null };
    }

    return firstValue;
  }, [dragState.selectedIds, props.name]);

  // Effect to update value and unit based on computed style
  useEffect(() => {
    if (!isDraggingRef.current && !isInternalUpdate.current) {
      const computed = getComputedStyleValue();

      if (!computed) {
        setLocalValue("0");
        setIsMixed(false);
        return;
      }

      if ("mixed" in computed) {
        setIsMixed(true);
        if (computed.unit) {
          setLocalUnit(computed.unit);
        }
      } else {
        setIsMixed(false);
        setLocalValue(Math.round(computed.value).toString());
        setLocalUnit(computed.unit);
        currentValueRef.current = computed.value;
      }
    }
  }, [
    dragState.selectedIds,
    nodeState.nodes,
    props.name,
    getComputedStyleValue,
  ]);

  const updateValue = (
    increment: boolean,
    multiplier: number = 1,
    isDragging: boolean = false
  ) => {
    const stepValue = step * multiplier;
    const baseSpeed = isDragging ? 1 : 1;
    let newValue = Math.round(
      currentValueRef.current + (increment ? stepValue : -stepValue) * baseSpeed
    );

    newValue = Math.max(min, Math.min(max, newValue));
    currentValueRef.current = newValue;

    isInternalUpdate.current = true;
    setLocalValue(newValue.toString());
    isInternalUpdate.current = false;

    setNodeStyle(
      {
        [props.name || ""]: `${newValue}${localUnit}`,
      },
      undefined,
      true
    );
  };

  const startIncrement = (direction: "up" | "down", e: React.MouseEvent) => {
    e.preventDefault();
    currentValueRef.current = parseFloat(localValue.toString()) || 0;
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

    const handleMouseUp = () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const parsedValue = Math.round(parseFloat(inputValue) || 0);
    const clampedValue = Math.max(min, Math.min(max, parsedValue));

    isInternalUpdate.current = true;
    setLocalValue(clampedValue.toString());
    isInternalUpdate.current = false;
    currentValueRef.current = clampedValue;

    setNodeStyle(
      {
        [props.name || ""]: `${clampedValue}${localUnit}`,
      },
      undefined,
      true
    );
  };

  return (
    <div className="flex items-center justify-between gap-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <div className="relative group">
          {isMixed ? (
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
              min={min}
              max={max}
              className="w-[60px] h-7 px-1.5 text-xs 
                bg-[var(--grid-line)] border border-[var(--control-border)] 
                hover:border-[var(--control-border-hover)] 
                focus:border-[var(--border-focus)] 
                text-[var(--text-primary)] rounded-[var(--radius-lg)] 
                focus:outline-none transition-colors 
                [appearance:textfield] 
                [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none"
            />
          )}
          {!isMixed && type === "number" && (
            <div className="absolute right-1 inset-y-0 w-3 hidden group-focus-within:flex flex-col">
              <button
                onMouseDown={(e) => startIncrement("up", e)}
                className="flex-1 flex items-center justify-center"
              >
                <ChevronUp className="w-2.5 h-2.5 text-[var(--text-secondary)]" />
              </button>
              <button
                onMouseDown={(e) => startIncrement("down", e)}
                className="flex-1 flex items-center justify-center"
              >
                <ChevronDown className="w-2.5 h-2.5 text-[var(--text-secondary)]" />
              </button>
            </div>
          )}
        </div>
        {showUnit && (
          <ToolSelect
            value={localUnit}
            onChange={(value) => {
              if (isMixed) return;
              setLocalUnit(value);
              onUnitChange?.(value);
              setNodeStyle(
                {
                  [props.name || ""]: `${localValue}${value}`,
                },
                undefined,
                true
              );
            }}
            options={unitOptions}
            disabled={isMixed}
          />
        )}
      </div>
    </div>
  );
}
