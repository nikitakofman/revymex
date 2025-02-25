import React from "react";
import { Label } from "./ToolbarAtoms";

interface PlaceholderToolInputProps {
  value: string | number;
  label: string;
}

const PlaceholderToolInput = ({ value, label }: PlaceholderToolInputProps) => {
  return (
    <div className="flex items-center justify-between gap-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <div className="relative">
          <input
            type="text"
            value={value}
            disabled
            className="w-[60px] h-7 px-1.5 text-xs
              bg-[var(--grid-line)] border border-[var(--control-border)] 
              text-[var(--text-primary)]
              rounded-[var(--radius-lg)] focus:outline-none
              [appearance:textfield] 
              [&::-webkit-outer-spin-button]:appearance-none 
              [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>
    </div>
  );
};

export default PlaceholderToolInput;
