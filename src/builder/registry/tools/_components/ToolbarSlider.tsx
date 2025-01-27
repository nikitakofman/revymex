import React, { useState, useRef, useEffect } from "react";

interface ToolbarSliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  className?: string;
}

export const ToolbarSlider = ({
  value,
  min = 0,
  max = 100,
  onChange,
  label,
  unit = "",
  className = "",
}: ToolbarSliderProps) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateValue = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const newValue = Math.round(min + x * (max - min));
    onChange(Math.max(min, Math.min(max, newValue)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateValue(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        updateValue(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, min, max, onChange]);

  const position = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      {(label || unit) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-xs text-[var(--text-secondary)]">
              {label}
            </span>
          )}
          {unit && (
            <span className="text-xs text-[var(--text-primary)]">
              {value}
              {unit}
            </span>
          )}
        </div>
      )}
      <div
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        className={`relative h-1.5 rounded-full cursor-pointer ${className} bg-[var(--control-bg)]`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-[var(--border-default)] rounded-full"
          style={{ width: `${position}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-[var(--accent)] shadow-md"
          style={{ left: `${position}%` }}
        />
      </div>
    </div>
  );
};
