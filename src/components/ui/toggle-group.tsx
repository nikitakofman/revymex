import React from "react";

interface ToggleGroupProps {
  options: { label: any; value: string }[];
  value: string;
  onChange: (value: string) => void;
  type?: "icons" | "text";
}

const ToggleGroup = ({
  options,
  value,
  onChange,
  type = "text",
}: ToggleGroupProps) => {
  const renderButton = (option: { label: any; value: string }) => {
    const isActive = value === option.value;

    if (type === "icons") {
      return (
        <button
          key={option.value}
          className={`
            "h-8 px-3 text-sm rounded-medium ${
              isActive
                ? "bg-primary text-button-text"
                : "bg-ghost text-button-text hover:bg-background-alt transition-colors duration-100"
            }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      );
    }

    return (
      <button
        key={option.value}
        className={`px-3 py-2 text-sm font-medium ${
          isActive
            ? "bg-primary text-button-text"
            : "bg-ghost text-button-text hover:bg-background-alt transition-colors duration-100"
        }`}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    );
  };

  return (
    <div
      className={`inline-flex ${
        type === "icons"
          ? "gap-1"
          : "rounded-medium overflow-hidden border border-border"
      }`}
    >
      {options.map(renderButton)}
    </div>
  );
};

export default ToggleGroup;
