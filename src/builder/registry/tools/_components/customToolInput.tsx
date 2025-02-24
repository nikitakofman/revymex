import React, { useRef, useState, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { ToolSelect } from "./ToolbarAtoms";
import { Label } from "./Label";

interface CustomToolInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  step?: number;
  unit?: string;
  label?: string;
  min?: number;
  max?: number;
  showUnit?: boolean;
  onUnitChange?: (unit: string) => void;
  customValue?: string | number;
  onCustomChange?: (value: string | number, unit?: string) => void;
}

export function CustomToolInput({
  step = 1,
  unit = "px",
  label,
  min = -10000,
  max = 10000,
  showUnit = false,
  onUnitChange,
  type,
  customValue,
  onCustomChange,
  ...props
}: CustomToolInputProps) {
  const [localUnit, setLocalUnit] = useState(unit);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startYRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const currentValueRef = useRef<number>(0);
  const speedMultiplierRef = useRef(1);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateValue = (
    increment: boolean,
    multiplier: number = 1,
    isDragging: boolean = false,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    const stepValue = isDragging ? step * multiplier : 1;
    let currentVal = parseFloat(customValue?.toString() || "0");
    let newValue = Math.round(
      currentVal + (increment ? stepValue : -stepValue)
    );
    newValue = Math.max(min, Math.min(max, newValue));
    currentValueRef.current = newValue;
    onCustomChange?.(newValue, localUnit);
  };

  const startIncrement = (direction: "up" | "down", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    currentValueRef.current = parseFloat(customValue?.toString() || "0");
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;

    updateValue(direction === "up", 1, false, e);

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
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const inputValue = e.target.value;
    const parsedValue = Math.round(parseFloat(inputValue) || 0);
    const clampedValue = Math.max(min, Math.min(max, parsedValue));
    onCustomChange?.(clampedValue, localUnit);
  };

  const handleFocus = (e: React.FocusEvent) => {
    e.stopPropagation();
    setIsFocused(true);
    inputRef.current?.select();
  };

  const unitOptions = [
    { label: "px", value: "px" },
    { label: "%", value: "%" },
    { label: "em", value: "em" },
    { label: "rem", value: "rem" },
    { label: "vw", value: "vw" },
    { label: "vh", value: "vh" },
  ];

  return (
    <div
      ref={wrapperRef}
      className="flex items-center justify-between gap-2"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <div className="relative group">
          <input
            {...props}
            ref={inputRef}
            type="number"
            value={customValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
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
          {type === "number" && (
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
            onChange={(value) => {
              setLocalUnit(value);
              onUnitChange?.(value);
              onCustomChange?.(customValue || 0, value);
            }}
            options={unitOptions}
          />
        )}
      </div>
    </div>
  );
}
