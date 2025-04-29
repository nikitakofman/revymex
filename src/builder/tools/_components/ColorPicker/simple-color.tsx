import React from "react";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import { useGetSelectedIds } from "@/builder/context/atoms/select-store";

interface SimpleColorPickerProps {
  title?: string;
}

/**
 * A very simple color picker with just three preset colors
 */
export const SimpleColorPicker: React.FC<SimpleColorPickerProps> = ({
  title,
}) => {
  const getSelectedIds = useGetSelectedIds();

  const colors = [
    "#ff5252", // Red
    "#4caf50", // Green
    "#2196f3", // Blue
  ];

  const handleColorClick = (color: string) => {
    const selectedIds = getSelectedIds();

    selectedIds.forEach((nodeId) => {
      updateNodeStyle(nodeId, { background: color });
    });
  };

  return (
    <div className="p-2">
      {title && <div className="text-sm font-medium mb-2">{title}</div>}
      <div className="flex gap-2">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => handleColorClick(color)}
            className="w-8 h-8 rounded-full border border-gray-300 shadow-sm hover:shadow-md transition-shadow"
            style={{
              backgroundColor: color,
              cursor: "pointer",
            }}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
    </div>
  );
};

export default SimpleColorPicker;
