import { useBuilderDynamic } from "@/builder/context/builderState";
import { ChevronDown } from "lucide-react";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { Label } from "./ToolbarAtoms";
import {
  useGetSelectedIds,
  useSelectedIds,
} from "@/builder/context/atoms/select-store";
import { useEffect, useState } from "react";
import {
  NodeId,
  useNodeParent,
  useGetNode,
  getCurrentNodes,
  useGetNodeStyle,
} from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import { updateNodeFlags } from "@/builder/context/atoms/node-store/operations/update-operations";

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
  // Use reactive hooks for selected IDs
  const selectedIds = useSelectedIds();
  const getSelectedIds = useGetSelectedIds();
  const [hasParent, setHasParent] = useState(false);
  const getNode = useGetNode();
  const getNodeStyle = useGetNodeStyle();
  const parentId = useNodeParent(selectedIds[0]);

  // Update hasParent state when needed
  useEffect(() => {
    if (selectedIds.length === 0) {
      setHasParent(false);
      return;
    }

    // Get parent of first selected node using Jotai
    setHasParent(!!parentId);
  }, [selectedIds]);

  const computedStyle = useComputedStyle({
    property: name,
    usePseudoElement: name && name.toLowerCase().startsWith("border"),
    parseValue: false,
    defaultValue: value || "",
  });

  // For position property specifically, check for 'isFakeFixed'
  let displayValue = computedStyle.value as string;
  if (name === "position" && selectedIds.length > 0) {
    const style = getNodeStyle(selectedIds[0]);
    if (style && style["isFakeFixed"] === "true") {
      displayValue = "fixed";
    }
  }

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
        // Use updateNodeStyle for each selected node
        selectedIds.forEach((id) => {
          updateNodeStyle(id, { [name]: newValue });
        });
      }
    }
  };

  const handlePositionChange = (position: string) => {
    // Get the current selection when handling position change
    const currentSelectedIds = getSelectedIds();
    if (currentSelectedIds.length === 0) return;

    console.log("🔍 handlePositionChange called with position:", position);
    console.log("🔍 Selected IDs:", currentSelectedIds);

    // If position is "fixed", handle as fake fixed
    if (position === "fixed") {
      // For each selected node
      currentSelectedIds.forEach((nodeId) => {
        // Get node info from Jotai
        const node = getNode(nodeId);
        if (!node) return;

        // Get parent node info from Jotai
        const parentId = node.parentId;
        let isInFrame = false;

        if (parentId) {
          const parentNode = getNode(parentId);
          isInFrame =
            parentNode &&
            (parentNode.type === "frame" || parentNode.isViewport);
        }

        // 1. Set position to absolute but mark it as fake fixed
        updateNodeStyle(nodeId, {
          position: "absolute", // Always use absolute in the DOM
          isFakeFixed: "true", // Add flag for fake fixed
          isAbsoluteInFrame: isInFrame ? "true" : "false",
        });

        // 2. Handle positioning within frames
        if (isInFrame) {
          // Calculate position within the parent frame
          const parentElement = document.querySelector(
            `[data-node-id="${parentId}"]`
          ) as HTMLElement;

          const element = document.querySelector(
            `[data-node-id="${nodeId}"]`
          ) as HTMLElement;

          if (parentElement && element) {
            // Get element's current position relative to parent
            const parentRect = parentElement.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();

            // Calculate position in pixels
            const left = elementRect.left - parentRect.left;
            const top = elementRect.top - parentRect.top;

            // Apply coordinates as a separate update
            updateNodeStyle(nodeId, {
              left: `${Math.round(left)}px`,
              top: `${Math.round(top)}px`,
            });
          } else {
            // If elements not found, use default position
            updateNodeStyle(nodeId, {
              left: node.style.left || "0px",
              top: node.style.top || "0px",
            });
          }
        }
      });
    }
    // If position is absolute, handle normally
    else if (position === "absolute") {
      // For each selected node
      currentSelectedIds.forEach((nodeId) => {
        // Get node info from Jotai
        const node = getNode(nodeId);
        if (!node) return;

        // Get parent node info from Jotai
        const parentId = node.parentId;
        let isInFrame = false;

        if (parentId) {
          const parentNode = getNode(parentId);
          isInFrame =
            parentNode &&
            (parentNode.type === "frame" || parentNode.isViewport);
        }

        // 1. First update position by itself so it cascades properly
        updateNodeStyle(nodeId, {
          position: position,
          isFakeFixed: "false", // Clear any fake fixed flag
        });

        // 2. Update isAbsoluteInFrame as a style property instead of a flag
        updateNodeStyle(nodeId, {
          isAbsoluteInFrame: isInFrame ? "true" : "false",
        });

        // 3. Handle positioning within frames
        if (isInFrame) {
          // Calculate position within the parent frame
          const parentElement = document.querySelector(
            `[data-node-id="${parentId}"]`
          ) as HTMLElement;

          const element = document.querySelector(
            `[data-node-id="${nodeId}"]`
          ) as HTMLElement;

          if (parentElement && element) {
            // Get element's current position relative to parent
            const parentRect = parentElement.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();

            // Calculate position in pixels
            const left = elementRect.left - parentRect.left;
            const top = elementRect.top - parentRect.top;

            // Apply coordinates as a separate update
            updateNodeStyle(nodeId, {
              left: `${Math.round(left)}px`,
              top: `${Math.round(top)}px`,
            });
          } else {
            // If elements not found, use default position
            updateNodeStyle(nodeId, {
              left: node.style.left || "0px",
              top: node.style.top || "0px",
            });
          }
        }
      });
    } else if (position === "sticky") {
      // Special handling for sticky positioning
      currentSelectedIds.forEach((nodeId) => {
        // 1. Update position first (separate from other styles)
        updateNodeStyle(nodeId, {
          position: "sticky",
          isFakeFixed: "false", // Clear any fake fixed flag
        });

        // 2. Update isAbsoluteInFrame as a style property instead of a flag
        updateNodeStyle(nodeId, { isAbsoluteInFrame: "false" });

        // 3. Add top value in separate call
        updateNodeStyle(nodeId, { top: "0px" });

        // 4. Clear other position properties
        updateNodeStyle(nodeId, {
          left: "",
          right: "",
          bottom: "",
        });
      });
    } else {
      // When changing to other positions (relative, static, etc.)
      currentSelectedIds.forEach((nodeId) => {
        // 1. Update position first (separate from other styles)
        updateNodeStyle(nodeId, {
          position: position,
          isFakeFixed: "false", // Clear any fake fixed flag
        });

        // 2. Update isAbsoluteInFrame as a style property instead of a flag
        updateNodeStyle(nodeId, { isAbsoluteInFrame: "false" });

        // 3. Clear positioning properties in a separate call
        updateNodeStyle(nodeId, {
          left: "",
          top: "",
          right: "",
          bottom: "",
        });
      });
    }
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
        value={computedStyle.mixed ? "mixed" : displayValue}
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
