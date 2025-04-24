import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { debounce } from "lodash";
import { useGetSelectedIds } from "../atoms/select-store";

// Types and Interfaces
interface StyleValue {
  value: string | number;
  unit?: string;
  mixed?: boolean;
}

interface UseComputedStyleProps {
  property: string;
  usePseudoElement?: boolean;
  pseudoElement?: string;
  parseValue?: boolean;
  defaultValue?: string | number;
  defaultUnit?: string;
  isColor?: boolean;
}

interface BatchProcessOptions {
  parseValue: boolean;
  defaultUnit: string;
  isColor: boolean;
  usePseudoElement: boolean;
  pseudoElement: string;
}

// Global style cache
const styleCache = new Map<string, StyleValue>();

// Color conversion utilities
const rgbToHex = (rgb: string): string => {
  const matches = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!matches) return rgb;

  const r = parseInt(matches[1], 10);
  const g = parseInt(matches[2], 10);
  const b = parseInt(matches[3], 10);

  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

const extractColor = (value: string): string => {
  if (value.startsWith("#")) return value;

  if (value.startsWith("rgb")) {
    const rgbPart = value.match(/^rgba?\([^)]+\)/)?.[0];
    if (rgbPart) return rgbToHex(rgbPart);
  }

  const parts = value.split(" ");
  for (const part of parts) {
    if (part.startsWith("rgb")) {
      return rgbToHex(part);
    }
    if (part.startsWith("#")) {
      return part;
    }
  }

  return "#000000";
};

// Batch processing function
const batchProcessElements = (
  elements: HTMLElement[],
  property: string,
  options: BatchProcessOptions
): StyleValue | null => {
  const computedValues = elements
    .map((element) => {
      const cacheKey = `${element.dataset.nodeId}-${property}${
        options.usePseudoElement ? options.pseudoElement : ""
      }`;

      if (styleCache.has(cacheKey)) {
        return styleCache.get(cacheKey)!;
      }

      const computedStyle = options.usePseudoElement
        ? window.getComputedStyle(element, options.pseudoElement)
        : window.getComputedStyle(element);

      let value = computedStyle[property as any];

      // Special handling for specific properties
      if (property === "backgroundImage" || property === "backgroundVideo") {
        // For these properties, empty or transparent is significant, don't overwrite with defaults
        if (!value || value === "none") {
          return { value: "none" };
        }
      } else if (
        !value ||
        value === "none" ||
        value === "rgba(0, 0, 0, 0)" ||
        value === "transparent"
      ) {
        return null;
      }

      // Special case for background image
      if (property === "backgroundImage" && value !== "none") {
        // Don't apply color conversion to URL values
        if (value.startsWith("url(")) {
          return { value };
        }
      }

      if (
        options.isColor ||
        property === "background" ||
        property === "backgroundColor"
      ) {
        // Only extract color if it's not a URL value
        if (!value.includes("url(")) {
          value = extractColor(value);
        }
      }

      let result: StyleValue;
      if (!options.parseValue) {
        result = { value };
      } else {
        const match = value.match(/^([-\d.]+)(\D+)?$/);
        result = match
          ? {
              value: parseFloat(match[1]),
              unit: match[2] || options.defaultUnit,
            }
          : { value };
      }

      styleCache.set(cacheKey, result);
      return result;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (computedValues.length === 0) return null;

  const firstValue = computedValues[0];
  const allSameValue = computedValues.every(
    (v) =>
      v.value === firstValue.value && (!v.unit || v.unit === firstValue.unit)
  );

  if (!allSameValue) {
    return {
      value: firstValue.value,
      mixed: true,
      unit: computedValues.every((v) => v.unit === firstValue.unit)
        ? firstValue.unit
        : undefined,
    };
  }

  return firstValue;
};

// Main hook
export function useComputedStyle({
  property,
  usePseudoElement = false,
  pseudoElement = "::after",
  parseValue = false,
  defaultValue = "",
  defaultUnit = "px",
  isColor = false,
}: UseComputedStyleProps): StyleValue {
  const { dragState, nodeState } = useBuilder();
  const [styleValue, setStyleValue] = useState<StyleValue>(() => ({
    value: defaultValue,
    unit: defaultUnit,
  }));

  // Replace subscription with imperative getter
  const getSelectedIds = useGetSelectedIds();

  const observerRef = useRef<MutationObserver | null>(null);
  const elementsRef = useRef<HTMLElement[]>([]);
  const isUpdatingRef = useRef(false);
  const lastComputedRef = useRef<StyleValue | null>(null);

  // Main update function
  const updateComputedStyle = useCallback(() => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;

    try {
      // Get the current selected IDs only when computing styles
      const selectedIds = getSelectedIds();

      const elements = selectedIds
        .map(
          (id) =>
            document.querySelector(`[data-node-id="${id}"]`) as HTMLElement
        )
        .filter((el): el is HTMLElement => el !== null);

      elementsRef.current = elements;

      if (elements.length === 0) {
        const defaultStyleValue = { value: defaultValue, unit: defaultUnit };
        if (
          JSON.stringify(lastComputedRef.current) !==
          JSON.stringify(defaultStyleValue)
        ) {
          lastComputedRef.current = defaultStyleValue;
          setStyleValue(defaultStyleValue);
        }
        return;
      }

      const computed = batchProcessElements(elements, property, {
        parseValue,
        defaultUnit,
        isColor,
        usePseudoElement,
        pseudoElement,
      });

      if (!computed) {
        const defaultStyleValue = { value: defaultValue, unit: defaultUnit };
        if (
          JSON.stringify(lastComputedRef.current) !==
          JSON.stringify(defaultStyleValue)
        ) {
          lastComputedRef.current = defaultStyleValue;
          setStyleValue(defaultStyleValue);
        }
        return;
      }

      if (
        JSON.stringify(lastComputedRef.current) !== JSON.stringify(computed)
      ) {
        lastComputedRef.current = computed;
        setStyleValue(computed);
      }
    } finally {
      isUpdatingRef.current = false;
    }
  }, [
    getSelectedIds,
    property,
    defaultValue,
    defaultUnit,
    parseValue,
    isColor,
    usePseudoElement,
    pseudoElement,
  ]);

  // Debounced update function
  const debouncedUpdate = useMemo(
    () => debounce(updateComputedStyle, 16),
    [updateComputedStyle]
  );

  // Setup a listener for selection changes
  useEffect(() => {
    // Initial update on mount
    updateComputedStyle();

    // Set up a MutationObserver on document.body to detect DOM changes
    // This avoids subscribing directly to selection changes
    const selectionChangeObserver = new MutationObserver(() => {
      // Clear the style cache when selection might have changed
      styleCache.clear();
      // Update computed style
      updateComputedStyle();
    });

    // Observe changes to data-selected attribute on any element
    selectionChangeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-selected"],
      subtree: true,
    });

    return () => {
      selectionChangeObserver.disconnect();
    };
  }, [updateComputedStyle]);

  // Setup observers and handle cleanup
  useEffect(() => {
    const cleanup = () => {
      observerRef.current?.disconnect();
      debouncedUpdate.cancel();
    };

    // Setup mutation observer for selected elements
    if (elementsRef.current.length > 0) {
      observerRef.current = new MutationObserver((mutations) => {
        const hasStyleChange = mutations.some(
          (mutation) =>
            mutation.type === "attributes" && mutation.attributeName === "style"
        );
        if (hasStyleChange) {
          debouncedUpdate();
        }
      });

      elementsRef.current.forEach((element) => {
        observerRef.current?.observe(element, {
          attributes: true,
          attributeFilter: ["style"],
          subtree: false,
        });
      });
    }

    return cleanup;
  }, [debouncedUpdate]);

  // Handle drag state updates
  useEffect(() => {
    if (dragState.isDragging) {
      debouncedUpdate();
    }
  }, [
    dragState.isDragging,
    dragState.dragPositions.x,
    dragState.dragPositions.y,
    debouncedUpdate,
  ]);

  return styleValue;
}

export default useComputedStyle;
