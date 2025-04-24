import { useBuilder } from "@/builder/context/builderState";
import { ChevronDown } from "lucide-react";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { Label } from "./ToolbarAtoms";
import { useGetSelectedIds } from "@/builder/context/atoms/select-store";
import { useEffect, useState } from "react";

interface ToolSelectProps {
  label: string;
  name: string;
  value?: string;
  options: { label: string; value: string; disabled?: boolean }[];
  disabled?: boolean;
  onChange?: (value: string) => void;
  customSelectWidth?: string;
}

export const ToolSelect = ({
  label,
  name,
  value,
  options,
  disabled = false,
  onChange,
  customSelectWidth,
}: ToolSelectProps) => {
  const { setNodeStyle, nodeState, dragState, nodeDisp } = useBuilder();

  // Replace subscription with imperative getter
  const getSelectedIds = useGetSelectedIds();
  const [hasParent, setHasParent] = useState(false);

  // Update hasParent state when needed
  useEffect(() => {
    // Get the current selection
    const selectedIds = getSelectedIds();

    // Calculate if selected node has a parent
    const nodeHasParent =
      selectedIds.length > 0 &&
      nodeState.nodes.some(
        (node) => node.id === selectedIds[0] && node.parentId
      );

    setHasParent(nodeHasParent);
  }, [nodeState.nodes, getSelectedIds]);

  const computedStyle = useComputedStyle({
    property: name,
    usePseudoElement: name && name.toLowerCase().startsWith("border"),
    parseValue: false,
    defaultValue: value || "",
  });

  // Modify options based on parent status if they're dimension-related
  const processedOptions = options.map((option) => ({
    ...option,
    disabled:
      option.disabled ||
      (!hasParent &&
        (option.value === "%" || option.value === "auto") &&
        (name === "width" || name === "height")),
  }));

  const handleChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
    } else {
      // Special case for position changes
      if (name === "position") {
        handlePositionChange(newValue);
      } else {
        setNodeStyle({ [name]: newValue });
      }
    }
  };

  // Handle position changes with special logic for absolute positioning in frames
  const handlePositionChange = (position: string) => {
    // Get the current selection when handling position change
    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) return;

    // If position is absolute, check if node is within a frame
    if (position === "absolute") {
      // For each selected node
      selectedIds.forEach((nodeId) => {
        const node = nodeState.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Check if parent is a frame
        const parentNode = node.parentId
          ? nodeState.nodes.find((n) => n.id === node.parentId)
          : null;

        const isInFrame =
          parentNode && (parentNode.type === "frame" || parentNode.isViewport);

        if (isInFrame) {
          // For elements in frames, set the isAbsoluteInFrame flag
          nodeDisp.updateNode(node.id, { isAbsoluteInFrame: true });

          // If the element already has positions, keep them
          // Otherwise, set initial positions at 0,0 within the frame
          const currentLeft = node.style.left || "0px";
          const currentTop = node.style.top || "0px";

          setNodeStyle(
            {
              position: "absolute",
              left: currentLeft,
              top: currentTop,
            },
            [node.id]
          );

          return;
        }
      });
    } else if (position !== "absolute") {
      // When changing from absolute to another position, reset the flag
      selectedIds.forEach((nodeId) => {
        const node = nodeState.nodes.find((n) => n.id === nodeId);
        if (node?.isAbsoluteInFrame) {
          nodeDisp.updateNode(node.id, { isAbsoluteInFrame: false });
        }
      });
    }

    // Apply the position style
    setNodeStyle({ position });
  };

  // Event handlers to prevent propagation
  const handleMouseDown = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  const handleClick = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  const handleSelectFocus = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  const handleSelectChange = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    handleChange(e.target.value);
  };

  return (
    <div
      className="relative flex items-center justify-between"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {label && <Label>{label}</Label>}

      <select
        value={computedStyle.mixed ? "mixed" : (computedStyle.value as string)}
        onChange={handleSelectChange}
        onFocus={handleSelectFocus}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        disabled={disabled}
        className={`h-7 pl-2 pr-6 ${
          customSelectWidth ? customSelectWidth : ""
        } text-xs appearance-none bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {computedStyle.mixed && (
          <option value="mixed" disabled>
            Mixed
          </option>
        )}
        {processedOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={option.disabled ? "opacity-50" : ""}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)] pointer-events-none" />
    </div>
  );
};
