import React, { useRef, useState, useEffect } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { ChevronUp, ChevronDown } from "lucide-react";

interface ToolInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  step?: number;
  unit?: string;
  label?: string;
  min?: number;
  max?: number;
}

export function ToolInput({
  step = 1,
  value,
  unit = "px",
  label,
  min = -10000,
  max = 10000,
  ...props
}: ToolInputProps) {
  const { setNodeStyle } = useBuilder();
  const [localValue, setLocalValue] = useState(value);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startYRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const currentValueRef = useRef<number>(0);
  const speedMultiplierRef = useRef(1);
  const isDraggingRef = useRef(false);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current && !isInternalUpdate.current) {
      setLocalValue(value);
    }
  }, [value]);

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

    setNodeStyle({
      [props.name || ""]: `${newValue}${unit}`,
    });
  };

  const startIncrement = (direction: "up" | "down", e: React.MouseEvent) => {
    e.preventDefault();
    currentValueRef.current = parseFloat(localValue as string) || 0;
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
    const parsedValue = parseFloat(inputValue) || 0;
    const clampedValue = Math.max(min, Math.min(max, parsedValue));

    isInternalUpdate.current = true;
    setLocalValue(clampedValue.toString());
    isInternalUpdate.current = false;
    currentValueRef.current = clampedValue;

    setNodeStyle({
      [props.name || ""]: `${clampedValue}${unit}`,
    });
  };

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      )}
      <div className="relative group">
        <input
          {...props}
          value={localValue}
          onChange={handleInputChange}
          min={min}
          max={max}
          className="w-[80px] h-7 px-1.5 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {props.type === "number" && (
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
    </div>
  );
}
