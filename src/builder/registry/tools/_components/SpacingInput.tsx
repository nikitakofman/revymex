import React from "react";
import { ToolInput } from "./ToolInput";
import { ToolSelect } from "./DimensionsInput";

interface SpacingInputProps {
  label: string;
  value: {
    top: string | number;
    right: string | number;
    bottom: string | number;
    left: string | number;
  };
  type?: "padding" | "margin";
  onChange?: (value: { [key: string]: string }, unit: string) => void;
}

export const SpacingInput = ({
  label,
  value,
  type = "padding",
  onChange,
}: SpacingInputProps) => {
  const [spacingType, setSpacingType] = React.useState("all");
  const [unit, setUnit] = React.useState("px");
  const [values, setValues] = React.useState(() => ({
    top: parseFloat(value.top?.toString() || "0"),
    right: parseFloat(value.right?.toString() || "0"),
    bottom: parseFloat(value.bottom?.toString() || "0"),
    left: parseFloat(value.left?.toString() || "0"),
  }));

  const spacingOptions = [
    { label: "All", value: "all" },
    { label: "Horizontal", value: "horizontal" },
    { label: "Vertical", value: "vertical" },
    { label: "Individual", value: "individual" },
  ];

  const unitOptions = [
    { label: "Pixels", value: "px" },
    { label: "Relative", value: "%" },
  ];

  const handleSpacingTypeChange = (newType: string) => {
    setSpacingType(newType);

    if (newType === "all") {
      const newValues = {
        top: values.top,
        right: values.top,
        bottom: values.top,
        left: values.top,
      };
      setValues(newValues);
      onChange?.(
        {
          top: `${newValues.top}${unit}`,
          right: `${newValues.right}${unit}`,
          bottom: `${newValues.bottom}${unit}`,
          left: `${newValues.left}${unit}`,
        },
        unit
      );
    }
  };

  const handleValueChange = (side: keyof typeof values, newValue: string) => {
    const val = parseFloat(newValue);
    if (isNaN(val)) return;

    let newValues = { ...values };

    switch (spacingType) {
      case "all":
        newValues = {
          top: val,
          right: val,
          bottom: val,
          left: val,
        };
        break;
      case "horizontal":
        if (side === "left" || side === "right") {
          newValues.left = val;
          newValues.right = val;
        }
        break;
      case "vertical":
        if (side === "top" || side === "bottom") {
          newValues.top = val;
          newValues.bottom = val;
        }
        break;
      case "individual":
        newValues[side] = val;
        break;
    }

    setValues(newValues);
    onChange?.(
      {
        top: `${newValues.top}${unit}`,
        right: `${newValues.right}${unit}`,
        bottom: `${newValues.bottom}${unit}`,
        left: `${newValues.left}${unit}`,
      },
      unit
    );
  };

  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    const conversionFactor = newUnit === "%" ? 0.25 : 4;
    const newValues = Object.entries(values).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: value * conversionFactor,
      }),
      {} as typeof values
    );

    setValues(newValues);
    onChange?.(
      {
        top: `${newValues.top}${newUnit}`,
        right: `${newValues.right}${newUnit}`,
        bottom: `${newValues.bottom}${newUnit}`,
        left: `${newValues.left}${newUnit}`,
      },
      newUnit
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)] w-12">
          {label}
        </span>
        <div className="flex-1 flex gap-2">
          <ToolSelect
            value={spacingType}
            onChange={handleSpacingTypeChange}
            options={spacingOptions}
          />
          <ToolSelect
            value={unit}
            onChange={handleUnitChange}
            options={unitOptions}
          />
        </div>
      </div>

      <div className="grid gap-2">
        {spacingType === "all" && (
          <ToolInput
            type="number"
            value={values.top}
            onChange={(e) => handleValueChange("top", e.target.value)}
            min={0}
            step={unit === "%" ? 1 : 1}
            unit={unit}
          />
        )}

        {spacingType === "horizontal" && (
          <ToolInput
            type="number"
            value={values.left}
            onChange={(e) => handleValueChange("left", e.target.value)}
            min={0}
            step={unit === "%" ? 1 : 1}
            unit={unit}
          />
        )}

        {spacingType === "vertical" && (
          <ToolInput
            type="number"
            value={values.top}
            onChange={(e) => handleValueChange("top", e.target.value)}
            min={0}
            step={unit === "%" ? 1 : 1}
            unit={unit}
          />
        )}

        {spacingType === "individual" && (
          <>
            <ToolInput
              type="number"
              value={values.top}
              onChange={(e) => handleValueChange("top", e.target.value)}
              min={0}
              step={unit === "%" ? 1 : 1}
              unit={unit}
              label="Top"
            />
            <ToolInput
              type="number"
              value={values.right}
              onChange={(e) => handleValueChange("right", e.target.value)}
              min={0}
              step={unit === "%" ? 1 : 1}
              unit={unit}
              label="Right"
            />
            <ToolInput
              type="number"
              value={values.bottom}
              onChange={(e) => handleValueChange("bottom", e.target.value)}
              min={0}
              step={unit === "%" ? 1 : 1}
              unit={unit}
              label="Bottom"
            />
            <ToolInput
              type="number"
              value={values.left}
              onChange={(e) => handleValueChange("left", e.target.value)}
              min={0}
              step={unit === "%" ? 1 : 1}
              unit={unit}
              label="Left"
            />
          </>
        )}
      </div>
    </div>
  );
};
